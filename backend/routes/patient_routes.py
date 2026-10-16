from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db
from auth_utils import get_current_user, require_role, log_audit_event
from ai.risk_model import calculate_bmi

router = APIRouter(prefix="/api/patients", tags=["patients"])

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    preferred_language: Optional[str] = None
    emergency_contact: Optional[str] = None

class HistoryItemRequest(BaseModel):
    condition: str
    diagnosed_date: Optional[str] = None
    notes: Optional[str] = None

class MedicationItemRequest(BaseModel):
    medication_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None

class RiskFactorItemRequest(BaseModel):
    factor_type: str
    value: str
    notes: Optional[str] = None

@router.get("/me")
def get_my_patient_profile(user: dict = Depends(require_role(["PATIENT"]))):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM patient_profiles WHERE user_id = %s", (user["id"],))
    p_row = cursor.fetchone()
    if not p_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Patient profile not found")
    
    profile = dict(p_row)
    patient_id = profile["id"]
    profile["bmi"] = calculate_bmi(profile.get("height"), profile.get("weight"))

    # Medical history
    cursor.execute("SELECT id, condition, status, diagnosed_date, notes FROM medical_history WHERE patient_id = %s", (patient_id,))
    history = [dict(r) for r in cursor.fetchall()]

    # Medications
    cursor.execute("SELECT id, medication_name, dosage, frequency FROM medications WHERE patient_id = %s", (patient_id,))
    medications = [dict(r) for r in cursor.fetchall()]

    # Risk factors
    cursor.execute("SELECT id, factor_type, value, notes FROM risk_factors WHERE patient_id = %s", (patient_id,))
    risk_factors = [dict(r) for r in cursor.fetchall()]

    # Latest assessment & vitals summary
    cursor.execute("""
        SELECT a.id, a.risk_score, a.risk_level, a.triage_level, a.safety_rule_triggered,
               a.recommendation, a.created_at,
               v.systolic_bp, v.diastolic_bp, v.heart_rate, v.spo2, v.temperature, v.blood_glucose
        FROM assessments a
        LEFT JOIN patient_vitals v ON a.id = v.assessment_id
        WHERE a.patient_id = %s
        ORDER BY a.created_at DESC LIMIT 1
    """, (patient_id,))
    latest_row = cursor.fetchone()
    latest_assessment = dict(latest_row) if latest_row else None

    conn.close()
    return {
        "profile": profile,
        "medical_history": history,
        "medications": medications,
        "risk_factors": risk_factors,
        "latest_assessment": latest_assessment
    }

@router.put("/me")
def update_patient_profile(req: ProfileUpdateRequest, user: dict = Depends(require_role(["PATIENT"]))):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM patient_profiles WHERE user_id = %s", (user["id"],))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Profile not found")
    
    fields = []
    values = []
    for k, v in req.dict(exclude_unset=True).items():
        fields.append(f"{k} = %s")
        values.append(v)

    if fields:
        values.append(user["id"])
        query = f"UPDATE patient_profiles SET {', '.join(fields)} WHERE user_id = %s"
        cursor.execute(query, values)
        conn.commit()

    conn.close()
    return {"message": "Profile updated successfully"}

@router.post("/me/consent")
def accept_consent(user: dict = Depends(require_role(["PATIENT"]))):
    conn = get_db()
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()
    cursor.execute("""
        UPDATE patient_profiles SET consent_accepted = TRUE, consent_accepted_at = %s
        WHERE user_id = %s
    """, (now_iso, user["id"]))
    conn.commit()
    conn.close()
    return {"message": "Consent accepted", "consent_accepted_at": now_iso}

@router.get("/me/risk-timeline")
def get_risk_timeline(user: dict = Depends(require_role(["PATIENT", "HEALTHCARE_WORKER", "ADMIN"]))):
    """Returns longitudinal timeline of risk scores and vitals trends for chart visualization (PRD 6.11)."""
    conn = get_db()
    cursor = conn.cursor()

    patient_id = None
    if user["role"] == "PATIENT":
        cursor.execute("SELECT id FROM patient_profiles WHERE user_id = %s", (user["id"],))
        p_row = cursor.fetchone()
        if p_row:
            patient_id = p_row["id"]
    
    if not patient_id:
        conn.close()
        return {"timeline": []}

    cursor.execute("""
        SELECT a.id, a.risk_score, a.risk_level, a.triage_level, a.created_at,
               v.systolic_bp, v.diastolic_bp, v.heart_rate, v.spo2, v.temperature, v.blood_glucose
        FROM assessments a
        LEFT JOIN patient_vitals v ON a.id = v.assessment_id
        WHERE a.patient_id = %s
        ORDER BY a.created_at ASC
    """, (patient_id,))
    
    rows = cursor.fetchall()
    timeline = []
    for r in rows:
        d = dict(r)
        timeline.append(d)

    conn.close()
    return {"timeline": timeline}

@router.post("/me/medical-history")
def add_medical_history(req: HistoryItemRequest, user: dict = Depends(require_role(["PATIENT"]))):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM patient_profiles WHERE user_id = %s", (user["id"],))
    pid = cursor.fetchone()["id"]
    cursor.execute("""
        INSERT INTO medical_history (patient_id, condition, status, diagnosed_date, notes)
        VALUES (%s, %s, 'ACTIVE', %s, %s)
    """, (pid, req.condition, req.diagnosed_date, req.notes))
    conn.commit()
    conn.close()
    return {"message": "Condition added"}

@router.post("/me/medications")
def add_medication(req: MedicationItemRequest, user: dict = Depends(require_role(["PATIENT"]))):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM patient_profiles WHERE user_id = %s", (user["id"],))
    pid = cursor.fetchone()["id"]
    cursor.execute("""
        INSERT INTO medications (patient_id, medication_name, dosage, frequency)
        VALUES (%s, %s, %s, %s)
    """, (pid, req.medication_name, req.dosage, req.frequency))
    conn.commit()
    conn.close()
    return {"message": "Medication added"}

@router.post("/me/risk-factors")
def add_risk_factor(req: RiskFactorItemRequest, user: dict = Depends(require_role(["PATIENT"]))):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM patient_profiles WHERE user_id = %s", (user["id"],))
    pid = cursor.fetchone()["id"]
    cursor.execute("""
        INSERT INTO risk_factors (patient_id, factor_type, value, notes)
        VALUES (%s, %s, %s, %s)
    """, (pid, req.factor_type, req.value, req.notes))
    conn.commit()
    conn.close()
    return {"message": "Risk factor added"}
