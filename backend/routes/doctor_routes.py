from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db
from auth_utils import get_current_user, require_role, log_audit_event
from ai.risk_model import calculate_bmi

router = APIRouter(prefix="/api/doctor", tags=["doctor"])

class ReviewSubmissionRequest(BaseModel):
    assessment_id: int
    review_status: str  # PENDING, REVIEWED, ESCALATED, CLOSED
    clinical_notes: str
    final_triage_status: str  # ROUTINE, PROMPT, IMMEDIATE, EMERGENCY

@router.get("/dashboard")
def get_doctor_dashboard(user: dict = Depends(require_role(["HEALTHCARE_WORKER", "ADMIN"]))):
    """Dashboard statistics and high-priority patient triage queue (PRD 6.9, DOC-1)."""
    conn = get_db()
    cursor = conn.cursor()

    # Total unique patients
    cursor.execute("SELECT COUNT(*) FROM patient_profiles")
    total_patients = cursor.fetchone()[0]

    # Pending reviews
    cursor.execute("SELECT COUNT(*) FROM healthcare_reviews WHERE review_status = 'PENDING'")
    pending_reviews = cursor.fetchone()[0]

    # High-risk assessments count
    cursor.execute("SELECT COUNT(*) FROM assessments WHERE risk_level = 'HIGH'")
    high_risk_count = cursor.fetchone()[0]

    # Moderate-risk count
    cursor.execute("SELECT COUNT(*) FROM assessments WHERE risk_level = 'MODERATE'")
    mod_risk_count = cursor.fetchone()[0]

    # High-priority triage queue table
    cursor.execute("""
        SELECT a.id as assessment_id, a.patient_id, p.full_name as patient_name,
               p.date_of_birth, p.gender, a.risk_score, a.risk_level, a.triage_level,
               a.safety_rule_triggered, a.created_at,
               r.id as review_id, COALESCE(r.review_status, 'PENDING') as review_status,
               r.final_triage_status, v.systolic_bp, v.diastolic_bp, v.heart_rate, v.spo2
        FROM assessments a
        JOIN patient_profiles p ON a.patient_id = p.id
        LEFT JOIN healthcare_reviews r ON a.id = r.assessment_id
        LEFT JOIN patient_vitals v ON a.id = v.assessment_id
        WHERE a.risk_level IN ('HIGH', 'MODERATE') OR a.safety_rule_triggered = 1
        ORDER BY
            CASE WHEN a.triage_level = 'EMERGENCY' THEN 1
                 WHEN a.triage_level = 'IMMEDIATE' THEN 2
                 WHEN a.triage_level = 'PROMPT' THEN 3
                 ELSE 4 END ASC,
            a.risk_score DESC,
            a.created_at ASC
        LIMIT 20
    """)
    priority_rows = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "metrics": {
            "total_patients": total_patients,
            "pending_reviews": pending_reviews,
            "high_risk_count": high_risk_count,
            "moderate_risk_count": mod_risk_count
        },
        "priority_queue": priority_rows
    }

@router.get("/patients")
def get_patient_list(
    risk_level: Optional[str] = None,
    review_status: Optional[str] = None,
    query: Optional[str] = None,
    user: dict = Depends(require_role(["HEALTHCARE_WORKER", "ADMIN"]))
):
    """Filterable list of patients (DOC-2)."""
    conn = get_db()
    cursor = conn.cursor()

    sql = """
        SELECT p.id as patient_id, p.user_id, p.full_name, p.date_of_birth, p.gender,
               p.preferred_language, p.emergency_contact,
               latest.id as latest_assessment_id, latest.risk_score, latest.risk_level,
               latest.triage_level, latest.created_at as last_assessed_at,
               latest.safety_rule_triggered,
               r.review_status, r.final_triage_status
        FROM patient_profiles p
        LEFT JOIN (
            SELECT a1.*
            FROM assessments a1
            JOIN (
                SELECT patient_id, MAX(created_at) as max_created
                FROM assessments GROUP BY patient_id
            ) a2 ON a1.patient_id = a2.patient_id AND a1.created_at = a2.max_created
        ) latest ON p.id = latest.patient_id
        LEFT JOIN healthcare_reviews r ON latest.id = r.assessment_id
        WHERE 1=1
    """
    params = []

    if query:
        sql += " AND (p.full_name LIKE ? OR p.emergency_contact LIKE ?)"
        params.extend([f"%{query}%", f"%{query}%"])

    if risk_level:
        sql += " AND latest.risk_level = ?"
        params.append(risk_level.upper())

    if review_status:
        sql += " AND r.review_status = ?"
        params.append(review_status.upper())

    sql += " ORDER BY latest.risk_score DESC NULLS LAST"

    cursor.execute(sql, params)
    patients = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"patients": patients}

@router.get("/high-risk")
def get_high_risk_queue(user: dict = Depends(require_role(["HEALTHCARE_WORKER", "ADMIN"]))):
    """High-risk queue sorted by urgency, then score, then waiting time (DOC-3)."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT a.id as assessment_id, a.patient_id, p.full_name as patient_name,
               p.date_of_birth, p.gender, a.risk_score, a.risk_level, a.triage_level,
               a.safety_rule_triggered, a.safety_rule_details, a.symptom_text, a.duration,
               a.created_at, r.review_status, r.final_triage_status, r.clinical_notes,
               v.systolic_bp, v.diastolic_bp, v.heart_rate, v.spo2, v.blood_glucose
        FROM assessments a
        JOIN patient_profiles p ON a.patient_id = p.id
        LEFT JOIN healthcare_reviews r ON a.id = r.assessment_id
        LEFT JOIN patient_vitals v ON a.id = v.assessment_id
        WHERE a.risk_level = 'HIGH' OR a.safety_rule_triggered = 1
        ORDER BY
            CASE WHEN a.triage_level = 'EMERGENCY' THEN 1
                 WHEN a.triage_level = 'IMMEDIATE' THEN 2
                 ELSE 3 END ASC,
            a.risk_score DESC,
            a.created_at ASC
    """)
    queue = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"high_risk_queue": queue}

@router.get("/patients/{id}")
def get_patient_detail(id: int, user: dict = Depends(require_role(["HEALTHCARE_WORKER", "ADMIN"]))):
    """Comprehensive patient record for clinician review (DOC-4)."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM patient_profiles WHERE id = ?", (id,))
    p_row = cursor.fetchone()
    if not p_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Patient record not found")
    
    profile = dict(p_row)
    profile["bmi"] = calculate_bmi(profile.get("height"), profile.get("weight"))

    # Conditions
    cursor.execute("SELECT * FROM medical_history WHERE patient_id = ?", (id,))
    history = [dict(r) for r in cursor.fetchall()]

    # Medications
    cursor.execute("SELECT * FROM medications WHERE patient_id = ?", (id,))
    medications = [dict(r) for r in cursor.fetchall()]

    # Risk factors
    cursor.execute("SELECT * FROM risk_factors WHERE patient_id = ?", (id,))
    risk_factors = [dict(r) for r in cursor.fetchall()]

    # Assessments history
    cursor.execute("""
        SELECT a.*, r.review_status, r.final_triage_status, r.clinical_notes, r.reviewed_at,
               v.systolic_bp, v.diastolic_bp, v.heart_rate, v.spo2, v.temperature, v.blood_glucose
        FROM assessments a
        LEFT JOIN healthcare_reviews r ON a.id = r.assessment_id
        LEFT JOIN patient_vitals v ON a.id = v.assessment_id
        WHERE a.patient_id = ?
        ORDER BY a.created_at DESC
    """, (id,))
    assessments = [dict(r) for r in cursor.fetchall()]

    # Fetch AI explanations for the latest assessment
    latest_factors = []
    if assessments:
        latest_asm_id = assessments[0]["id"]
        cursor.execute("SELECT * FROM ai_explanations WHERE assessment_id = ?", (latest_asm_id,))
        latest_factors = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "profile": profile,
        "medical_history": history,
        "medications": medications,
        "risk_factors": risk_factors,
        "assessments": assessments,
        "latest_factors": latest_factors
    }

@router.post("/reviews")
def submit_review(req: ReviewSubmissionRequest, user: dict = Depends(require_role(["HEALTHCARE_WORKER", "ADMIN"]))):
    """
    Submits clinician review and triage decision (DOC-5, DOC-6).
    Preserves original AI prediction while storing human doctor confirmation or override.
    """
    conn = get_db()
    cursor = conn.cursor()

    # Determine doctor ID
    doctor_id = 1
    cursor.execute("SELECT id FROM healthcare_workers WHERE user_id = ?", (user["id"],))
    d_row = cursor.fetchone()
    if d_row:
        doctor_id = d_row["id"]

    now_iso = datetime.now().isoformat()

    # Verify assessment exists
    cursor.execute("SELECT patient_id, risk_score, risk_level, triage_level FROM assessments WHERE id = ?", (req.assessment_id,))
    asm_row = cursor.fetchone()
    if not asm_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    patient_id = asm_row["patient_id"]

    # Check if review record exists
    cursor.execute("SELECT id FROM healthcare_reviews WHERE assessment_id = ?", (req.assessment_id,))
    existing_rev = cursor.fetchone()

    if existing_rev:
        cursor.execute("""
            UPDATE healthcare_reviews
            SET healthcare_worker_id = ?, review_status = ?, clinical_notes = ?,
                final_triage_status = ?, reviewed_at = ?
            WHERE assessment_id = ?
        """, (doctor_id, req.review_status, req.clinical_notes, req.final_triage_status, now_iso, req.assessment_id))
    else:
        cursor.execute("""
            INSERT INTO healthcare_reviews (assessment_id, healthcare_worker_id, review_status, clinical_notes, final_triage_status, reviewed_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (req.assessment_id, doctor_id, req.review_status, req.clinical_notes, req.final_triage_status, now_iso))

    # Send Notification to Patient (PRD 6.12)
    cursor.execute("SELECT user_id FROM patient_profiles WHERE id = ?", (patient_id,))
    pat_user = cursor.fetchone()
    if pat_user:
        notif_msg = f"A healthcare clinician has reviewed your assessment. Triage status: {req.final_triage_status}."
        cursor.execute("""
            INSERT INTO notifications (user_id, title, message, type, is_read, link_url, created_at)
            VALUES (?, 'Clinician Review Completed', ?, 'REVIEW_COMPLETED', 0, ?, ?)
        """, (pat_user["user_id"], notif_msg, f"/patient/assessment-result/{req.assessment_id}", now_iso))

    conn.commit()

    log_audit_event(
        user["id"], "REVIEW_SUBMITTED", "ASSESSMENT", str(req.assessment_id),
        f"Status: {req.review_status}, FinalTriage: {req.final_triage_status}, Note: {req.clinical_notes[:60]}"
    )

    conn.close()
    return {"message": "Review submitted successfully", "reviewed_at": now_iso}
