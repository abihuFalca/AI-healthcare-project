import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from database import get_db
from auth_utils import get_current_user, require_role, log_audit_event
from ai.safety_rules import evaluate_safety_rules
from ai.nlp import parse_free_text_symptoms
from ai.risk_model import predict_patient_risk, MODEL_VERSION
from ai.explainability import generate_shap_explanations
from ai.recommendations import get_recommendation

router = APIRouter(prefix="/api/assessments", tags=["assessments"])

class VitalsInput(BaseModel):
    systolic_bp: Optional[float] = None
    diastolic_bp: Optional[float] = None
    heart_rate: Optional[float] = None
    spo2: Optional[float] = None
    temperature: Optional[float] = None
    respiratory_rate: Optional[float] = None
    blood_glucose: Optional[float] = None

class AssessmentCreateRequest(BaseModel):
    age: int = Field(..., ge=1, le=120)
    gender: str
    height: Optional[float] = None
    weight: Optional[float] = None
    symptom_text: Optional[str] = ""
    selected_symptoms: Optional[List[str]] = []
    duration: Optional[str] = "Unknown"
    severity: Optional[str] = "Unknown"
    medical_history: Optional[List[str]] = []
    medications: Optional[List[str]] = []
    risk_factors: Optional[List[str]] = []
    vitals: VitalsInput
    assigned_healthcare_worker_id: Optional[int] = None

def validate_vitals_limits(v: VitalsInput) -> List[str]:
    """
    Appendix A: Proposed Vital Sign Validation Ranges.
    Hard limits raise an error (rejecting corrupt input); warning ranges are logged.
    """
    warnings = []
    if v.systolic_bp is not None:
        if v.systolic_bp < 50 or v.systolic_bp > 300:
            raise HTTPException(status_code=400, detail=f"Systolic BP {v.systolic_bp} mmHg is outside biologically plausible limits (50–300 mmHg)")
        if v.systolic_bp < 90 or v.systolic_bp > 180:
            warnings.append(f"Unusual systolic BP reading ({v.systolic_bp} mmHg)")

    if v.diastolic_bp is not None:
        if v.diastolic_bp < 30 or v.diastolic_bp > 200:
            raise HTTPException(status_code=400, detail=f"Diastolic BP {v.diastolic_bp} mmHg is outside plausible limits (30–200 mmHg)")
        if v.diastolic_bp < 60 or v.diastolic_bp > 110:
            warnings.append(f"Unusual diastolic BP reading ({v.diastolic_bp} mmHg)")

    if v.heart_rate is not None:
        if v.heart_rate < 20 or v.heart_rate > 250:
            raise HTTPException(status_code=400, detail=f"Heart rate {v.heart_rate} bpm is outside plausible limits (20–250 bpm)")
        if v.heart_rate < 50 or v.heart_rate > 120:
            warnings.append(f"Unusual heart rate ({v.heart_rate} bpm)")

    if v.spo2 is not None:
        if v.spo2 < 50 or v.spo2 > 100:
            raise HTTPException(status_code=400, detail=f"SpO2 {v.spo2}% is outside plausible limits (50–100%)")
        if v.spo2 < 94:
            warnings.append(f"Low oxygen saturation ({v.spo2}%)")

    if v.temperature is not None:
        if v.temperature < 30 or v.temperature > 45:
            raise HTTPException(status_code=400, detail=f"Temperature {v.temperature}°C is outside plausible limits (30–45°C)")
        if v.temperature < 35.5 or v.temperature > 38.0:
            warnings.append(f"Unusual temperature ({v.temperature}°C)")

    if v.respiratory_rate is not None:
        if v.respiratory_rate < 4 or v.respiratory_rate > 60:
            raise HTTPException(status_code=400, detail=f"Respiratory rate {v.respiratory_rate}/min is outside plausible limits (4–60/min)")
        if v.respiratory_rate < 10 or v.respiratory_rate > 24:
            warnings.append(f"Unusual respiratory rate ({v.respiratory_rate}/min)")

    if v.blood_glucose is not None:
        if v.blood_glucose < 20 or v.blood_glucose > 800:
            raise HTTPException(status_code=400, detail=f"Blood glucose {v.blood_glucose} mg/dL is outside plausible limits (20–800 mg/dL)")
        if v.blood_glucose < 70 or v.blood_glucose > 250:
            warnings.append(f"Unusual blood glucose ({v.blood_glucose} mg/dL)")

    return warnings

@router.post("")
def create_assessment(req: AssessmentCreateRequest, user: dict = Depends(require_role(["PATIENT"]))):
    """
    Submits patient assessment through the complete AI triage pipeline (PRD Section 6.3 & 6.4).
    
    IMPORTANT: Consent enforcement (PRD §9.2)
    - Checks if user has accepted consent before processing any health data
    - If consent not found, returns 403 error requiring user to accept privacy notice first
    """
    conn = get_db()
    cursor = conn.cursor()
    
    # ========================================================================
    # CONSENT CHECK (PRD §9.2) - BEFORE ANY DATA PROCESSING
    # ========================================================================
    cursor.execute("""
        SELECT id, accepted FROM consent_records
        WHERE user_id = %s
        ORDER BY id DESC LIMIT 1
    """, (user["id"],))
    consent_row = cursor.fetchone()

    # The latest decision must be an acceptance; a decline or withdrawal blocks processing
    if not consent_row or not consent_row["accepted"]:
        conn.close()
        raise HTTPException(
            status_code=403,
            detail="Consent required: You must review and accept the privacy notice before submitting an assessment. "
                   "Please complete the consent screen and try again."
        )
    
    # ========================================================================
    # ASSESSMENT PROCESSING CONTINUES (only if consent exists)
    # ========================================================================
    # 1. Range validation
    warnings = validate_vitals_limits(req.vitals)

    # 2. Extract NLP symptoms from free text
    nlp_result = parse_free_text_symptoms(req.symptom_text or "")
    combined_symptoms = list(dict.fromkeys((req.selected_symptoms or []) + nlp_result["extracted_symptoms"]))
    
    duration = req.duration if req.duration and req.duration != "Unknown" else nlp_result["duration"]
    severity = req.severity if req.severity and req.severity != "Unknown" else nlp_result["severity"]

    vitals_dict = req.vitals.dict()

    # 3. Emergency Safety Rule Check (Deterministic, runs FIRST)
    is_emergency, triggered_rules, emergency_recommendation = evaluate_safety_rules(
        symptoms=combined_symptoms,
        vitals=vitals_dict,
        raw_symptom_text=req.symptom_text,
        history=req.medical_history
    )

    # 4. Feature engineering & Calibrated ML Risk Prediction
    prob, score, risk_level, triage_level, features = predict_patient_risk(
        age=req.age,
        gender=req.gender,
        height=req.height,
        weight=req.weight,
        symptoms=combined_symptoms,
        vitals=vitals_dict,
        history=req.medical_history,
        risk_factors=req.risk_factors,
        medications=req.medications,
        safety_rule_triggered=is_emergency
    )

    # 5. Explainable AI (SHAP-compatible factor attribution)
    factors = generate_shap_explanations(features, top_n=5)

    # 6. Recommendation Engine
    rec_info = get_recommendation(triage_level, safety_triggered=is_emergency, safety_rules=triggered_rules)
    final_recommendation = emergency_recommendation if is_emergency else rec_info["recommendation_text"]

    # 7. Persistence in PostgreSQL DB
    # (conn and cursor already opened above for consent check, reuse them)
    
    cursor.execute("SELECT id, full_name FROM patient_profiles WHERE user_id = %s", (user["id"],))
    pat_profile = cursor.fetchone()
    patient_id = pat_profile["id"]
    patient_name = pat_profile["full_name"]

    now_iso = datetime.now().isoformat()

    # Default doctor assignment to primary doctor if none provided
    assigned_doc_id = req.assigned_healthcare_worker_id
    if not assigned_doc_id:
        cursor.execute("SELECT id FROM healthcare_workers WHERE verification_status = 'APPROVED' LIMIT 1")
        doc_row = cursor.fetchone()
        if doc_row:
            assigned_doc_id = doc_row["id"]

    cursor.execute("""
        INSERT INTO assessments (
            patient_id, assigned_healthcare_worker_id, symptom_text, symptoms_json,
            duration, severity, history_snapshot, risk_factors_snapshot, medications_snapshot,
            vitals_snapshot, risk_score, risk_level, triage_level, safety_rule_triggered,
            safety_rule_details, ai_status, recommendation, model_version, created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'COMPLETED', %s, %s, %s) RETURNING id
    """, (
        patient_id, assigned_doc_id, req.symptom_text, json.dumps(combined_symptoms),
        duration, severity, json.dumps(req.medical_history), json.dumps(req.risk_factors),
        json.dumps(req.medications), json.dumps(vitals_dict), score, risk_level,
        triage_level, is_emergency,
        json.dumps(triggered_rules), final_recommendation, MODEL_VERSION, now_iso
    ))
    assessment_id = cursor.fetchone()["id"]

    # Insert vitals record
    cursor.execute("""
        INSERT INTO patient_vitals (
            patient_id, assessment_id, systolic_bp, diastolic_bp, heart_rate,
            spo2, temperature, respiratory_rate, blood_glucose, recorded_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        patient_id, assessment_id, vitals_dict.get("systolic_bp"), vitals_dict.get("diastolic_bp"),
        vitals_dict.get("heart_rate"), vitals_dict.get("spo2"), vitals_dict.get("temperature"),
        vitals_dict.get("respiratory_rate"), vitals_dict.get("blood_glucose"), now_iso
    ))

    # Insert explanation factors
    for f in factors:
        cursor.execute("""
            INSERT INTO ai_explanations (assessment_id, feature, contribution, importance, explanation_text)
            VALUES (%s, %s, %s, %s, %s)
        """, (assessment_id, f["feature"], f["contribution"], f["importance"], f["explanation_text"]))

    # Insert pending healthcare review record
    if assigned_doc_id:
        cursor.execute("""
            INSERT INTO healthcare_reviews (assessment_id, healthcare_worker_id, review_status, clinical_notes, final_triage_status)
            VALUES (%s, %s, 'PENDING', NULL, NULL)
        """, (assessment_id, assigned_doc_id))

        # Doctor Notification if HIGH / EMERGENCY (PRD 6.12)
        if risk_level == "HIGH" or is_emergency:
            cursor.execute("SELECT user_id FROM healthcare_workers WHERE id = %s", (assigned_doc_id,))
            doc_user = cursor.fetchone()
            if doc_user:
                notif_msg = f"Patient {patient_name} submitted a HIGH risk assessment (Score: {score}/100, Triage: {triage_level}). Immediate review requested."
                cursor.execute("""
                    INSERT INTO notifications (user_id, title, message, type, is_read, link_url, created_at)
                    VALUES (%s, 'High-Risk Patient Assessment Alert', %s, 'HIGH_RISK_ALERT', FALSE, %s, %s)
                """, (doc_user["user_id"], notif_msg, f"/doctor/patient/{patient_id}", now_iso))

    # Patient confirmation notification
    cursor.execute("""
        INSERT INTO notifications (user_id, title, message, type, is_read, link_url, created_at)
        VALUES (%s, 'Assessment Analyzed', %s, 'ASSESSMENT_COMPLETED', FALSE, %s, %s)
    """, (user["id"], f"Your health assessment has been analyzed (Estimated Risk Level: {risk_level}).", f"/patient/assessment-result/{assessment_id}", now_iso))

    conn.commit()

    log_audit_event(
        user["id"], "ASSESSMENT_CREATED", "ASSESSMENT", str(assessment_id),
        f"Score: {score}, Level: {risk_level}, Triage: {triage_level}, SafetyTriggered: {is_emergency}"
    )

    conn.close()

    # Response conforming directly to PRD Section 12.1 sample response format
    return {
        "assessment_id": assessment_id,
        "risk_score": score,
        "risk_level": risk_level,
        "triage_level": triage_level,
        "safety_rule_triggered": is_emergency,
        "safety_rule_details": triggered_rules,
        "factors": factors,
        "recommendation": final_recommendation,
        "urgency_label": rec_info["urgency_label"],
        "action_button": rec_info["action_button"],
        "headline": rec_info["headline"],
        "disclaimer": rec_info["disclaimer"],
        "model_version": MODEL_VERSION,
        "warnings": warnings,
        "extracted_symptoms": nlp_result["extracted_symptoms"],
        "combined_symptoms": combined_symptoms,
        "created_at": now_iso
    }

@router.get("/{id}")
def get_assessment(id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT a.*, p.full_name as patient_name, p.date_of_birth, p.gender, p.user_id as patient_user_id
        FROM assessments a
        JOIN patient_profiles p ON a.patient_id = p.id
        WHERE a.id = %s
    """, (id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    asm = dict(row)

    # RBAC check: patients can only access their own assessments
    if user["role"] == "PATIENT" and asm["patient_user_id"] != user["id"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Unauthorized access to patient record")

    # Vitals
    cursor.execute("SELECT * FROM patient_vitals WHERE assessment_id = %s", (id,))
    v_row = cursor.fetchone()
    asm["vitals"] = dict(v_row) if v_row else None

    # Factors
    cursor.execute("SELECT feature, contribution, importance, explanation_text FROM ai_explanations WHERE assessment_id = %s", (id,))
    asm["factors"] = [dict(r) for r in cursor.fetchall()]

    # Review
    cursor.execute("""
        SELECT r.*, w.full_name as doctor_name, w.professional_role, w.hospital_name
        FROM healthcare_reviews r
        JOIN healthcare_workers w ON r.healthcare_worker_id = w.id
        WHERE r.assessment_id = %s
    """, (id,))
    r_row = cursor.fetchone()
    asm["review"] = dict(r_row) if r_row else None

    conn.close()
    return asm

@router.get("/history/list")
def get_assessment_history(user: dict = Depends(require_role(["PATIENT"]))):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM patient_profiles WHERE user_id = %s", (user["id"],))
    pid = cursor.fetchone()["id"]

    cursor.execute("""
        SELECT a.id, a.risk_score, a.risk_level, a.triage_level, a.safety_rule_triggered,
               a.created_at, a.recommendation,
               r.review_status, r.final_triage_status, r.clinical_notes, r.reviewed_at
        FROM assessments a
        LEFT JOIN healthcare_reviews r ON a.id = r.assessment_id
        WHERE a.patient_id = %s
        ORDER BY a.created_at DESC
    """, (pid,))
    rows = cursor.fetchall()
    history = [dict(r) for r in rows]
    conn.close()
    return {"history": history}
