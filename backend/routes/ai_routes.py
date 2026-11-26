import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from auth_utils import get_current_user, require_role, log_audit_event
from ai.nlp import parse_free_text_symptoms, CANONICAL_SYMPTOMS
from ai.risk_model import predict_patient_risk
from ai.safety_rules import evaluate_safety_rules
from ai.explainability import generate_shap_explanations
from ai.llm_service import get_llm_service
from database import get_db

router = APIRouter(prefix="/api/ai", tags=["ai"])

class SymptomAnalysisRequest(BaseModel):
    text: str

class RiskPredictionPreviewRequest(BaseModel):
    age: int
    gender: str
    height: Optional[float] = None
    weight: Optional[float] = None
    symptoms: List[str]
    vitals: Dict[str, Any]
    history: Optional[List[str]] = []
    risk_factors: Optional[List[str]] = []
    medications: Optional[List[str]] = []

class ExplainResultRequest(BaseModel):
    risk_score: float
    risk_level: str
    triage_level: str
    shap_features: List[Dict[str, Any]]
    age: Optional[int] = None
    symptoms: Optional[List[str]] = None

@router.post("/analyze-symptoms")
def analyze_symptoms_nlp(req: SymptomAnalysisRequest, user: dict = Depends(get_current_user)):
    """
    NLP layer converts free text into structured output for user confirmation (PRD 6.5).
    Example: 'I have chest discomfort and dizziness for 3 hours and I am sweating.'
    -> symptoms = [chest discomfort, dizziness, sweating]; duration = 3 hours; severity = Unknown
    """
    result = parse_free_text_symptoms(req.text)

    # LLM reader catches wording the rules miss; it can only add canonical symptoms
    llm_symptoms = get_llm_service().extract_symptoms(req.text, list(CANONICAL_SYMPTOMS.keys()))
    result["ai_extracted_symptoms"] = [
        s for s in llm_symptoms
        if s not in result["extracted_symptoms"] and s not in result["negated_symptoms"]
    ]
    result["extracted_symptoms"] = result["extracted_symptoms"] + result["ai_extracted_symptoms"]
    return result

@router.post("/predict-risk")
def preview_risk(req: RiskPredictionPreviewRequest, user: dict = Depends(get_current_user)):
    """Predicts risk preview without persisting to database."""
    is_emergency, rules, _ = evaluate_safety_rules(
        symptoms=req.symptoms,
        vitals=req.vitals,
        history=req.history
    )

    prob, score, risk_level, triage_level, features = predict_patient_risk(
        age=req.age,
        gender=req.gender,
        height=req.height,
        weight=req.weight,
        symptoms=req.symptoms,
        vitals=req.vitals,
        history=req.history,
        risk_factors=req.risk_factors,
        medications=req.medications,
        safety_rule_triggered=is_emergency
    )

    factors = generate_shap_explanations(features, top_n=5)

    return {
        "risk_probability": round(prob, 4),
        "risk_score": score,
        "risk_level": risk_level,
        "triage_level": triage_level,
        "safety_rule_triggered": is_emergency,
        "safety_rules": rules,
        "factors": factors
    }

@router.get("/explanation/{assessment_id}")
def get_assessment_explanation(assessment_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT feature, contribution, importance, explanation_text
        FROM ai_explanations
        WHERE assessment_id = %s
    """, (assessment_id,))
    rows = cursor.fetchall()
    conn.close()
    if not rows:
        raise HTTPException(status_code=404, detail="No explanations found for this assessment")
    return {"factors": [dict(r) for r in rows]}

@router.post("/explain-result")
def explain_assessment_result(req: ExplainResultRequest, user: dict = Depends(get_current_user)):
    """
    Generate plain-language LLM explanation of assessment result (Phase 3 Track A).
    
    Takes structured assessment data and returns narrative explanation suitable
    for patient reading, using GPT-4 to explain risk in understandable terms.
    
    Args:
        req: ExplainResultRequest with risk_score, risk_level, triage_level, shap_features
        user: Current authenticated user
        
    Returns:
        explanation: Plain-language narrative explanation
        generated_at: Timestamp of generation
        model: Which LLM model was used
    """
    llm = get_llm_service()
    
    if not llm.available:
        raise HTTPException(
            status_code=503,
            detail=f"LLM service not available. Set {llm.key_env} in .env."
        )
    
    try:
        explanation = llm.explain_assessment_result(
            risk_score=req.risk_score,
            risk_level=req.risk_level,
            shap_features=req.shap_features,
            triage_level=req.triage_level,
            age=req.age,
            symptoms=req.symptoms
        )
        
        return {
            "explanation": explanation,
            "generated_at": datetime.now().isoformat(),
            "model": llm.model
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM explanation error: {str(e)}")

@router.get("/llm/status")
def llm_health_check(user: dict = Depends(get_current_user)):
    """Check if LLM service is available."""
    llm = get_llm_service()
    return llm.health_check()


# ============================================================================
# Helpers for the LLM features below
# ============================================================================

def _load_assessment_facts(assessment_id: int) -> Dict[str, Any]:
    """Load the stored facts of one assessment (no free-form AI output)."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT a.*, p.user_id AS patient_user_id, p.gender, p.date_of_birth
            FROM assessments a
            JOIN patient_profiles p ON a.patient_id = p.id
            WHERE a.id = %s
        """, (assessment_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Assessment not found")
        asm = dict(row)

        cursor.execute("""
            SELECT feature, contribution, explanation_text FROM ai_explanations
            WHERE assessment_id = %s ORDER BY importance DESC NULLS LAST
        """, (assessment_id,))
        asm["factors"] = [dict(r) for r in cursor.fetchall()]

        cursor.execute("""
            SELECT review_status, final_triage_status, healthcare_worker_id
            FROM healthcare_reviews WHERE assessment_id = %s
        """, (assessment_id,))
        r = cursor.fetchone()
        asm["review"] = dict(r) if r else None
        return asm
    finally:
        conn.close()


def _parse_json_field(value):
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return value
    return value


def _case_facts(asm: Dict[str, Any]) -> Dict[str, Any]:
    """The subset of an assessment that is shared with the LLM. No names or contact details."""
    return {
        "assessment_id": asm["id"],
        "gender": asm.get("gender"),
        "date_of_birth": str(asm.get("date_of_birth") or ""),
        "symptom_text": asm.get("symptom_text"),
        "symptoms": _parse_json_field(asm.get("symptoms_json")),
        "duration": asm.get("duration"),
        "severity": asm.get("severity"),
        "medical_history": _parse_json_field(asm.get("history_snapshot")),
        "medications": _parse_json_field(asm.get("medications_snapshot")),
        "risk_factors": _parse_json_field(asm.get("risk_factors_snapshot")),
        "vitals": _parse_json_field(asm.get("vitals_snapshot")),
        "risk_score": asm.get("risk_score"),
        "risk_level": asm.get("risk_level"),
        "triage_level": asm.get("triage_level"),
        "emergency_rules_triggered": _parse_json_field(asm.get("safety_rule_details")) if asm.get("safety_rule_triggered") else [],
        "top_risk_factors": [
            {"feature": f["feature"], "contribution": f["contribution"]} for f in asm.get("factors", [])[:5]
        ],
        "recommendation": asm.get("recommendation"),
        "review_status": (asm.get("review") or {}).get("review_status"),
    }


def _require_llm():
    llm = get_llm_service()
    if not llm.available:
        raise HTTPException(status_code=503, detail=f"AI features are not available right now ({llm.key_env} not configured in .env).")
    return llm


# ============================================================================
# Doctor: AI case summary
# ============================================================================

@router.get("/case-summary/{assessment_id}")
def get_case_summary(assessment_id: int, user: dict = Depends(require_role(["HEALTHCARE_WORKER", "ADMIN"]))):
    """Short LLM-written clinical summary of an assessment for the reviewing clinician."""
    llm = _require_llm()
    asm = _load_assessment_facts(assessment_id)
    try:
        summary = llm.summarize_case(_case_facts(asm))
    except Exception:
        raise HTTPException(status_code=502, detail="The AI summary could not be generated. Please try again.")

    log_audit_event(user["id"], "AI_CASE_SUMMARY_VIEWED", "ASSESSMENT", str(assessment_id), f"model={llm.model}")
    return {
        "assessment_id": assessment_id,
        "summary": summary,
        "model": llm.model,
        "generated_at": datetime.now().isoformat(),
        "disclaimer": "AI-generated from the recorded assessment. Verify against the source data before acting.",
    }


# ============================================================================
# Patient: AI assistant about their own result
# ============================================================================

class ChatTurn(BaseModel):
    role: str
    content: str

class AssistantRequest(BaseModel):
    assessment_id: int
    message: str = Field(..., min_length=1, max_length=1500)
    history: List[ChatTurn] = []

EMERGENCY_PHRASES = [
    "chest pain", "can't breathe", "cannot breathe", "trouble breathing", "difficulty breathing",
    "passed out", "fainted", "unconscious", "stroke", "face drooping", "slurred speech",
    "severe bleeding", "bleeding heavily", "suicide", "kill myself", "end my life", "self harm", "self-harm",
]
EMERGENCY_REPLY = (
    "What you're describing could be an emergency. Please call your local emergency number "
    "or go to the nearest emergency department right now. Don't wait for an online answer."
)

@router.post("/assistant")
def ask_assistant(req: AssistantRequest, user: dict = Depends(require_role(["PATIENT"]))):
    """Answers a patient's questions about their own assessment result."""
    asm = _load_assessment_facts(req.assessment_id)
    if asm["patient_user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only ask about your own assessments.")

    # Deterministic emergency check first: never rely on the LLM for this
    text = req.message.lower()
    if any(p in text for p in EMERGENCY_PHRASES):
        log_audit_event(user["id"], "AI_ASSISTANT_EMERGENCY_ESCALATION", "ASSESSMENT", str(req.assessment_id), "Emergency phrase detected")
        return {"reply": EMERGENCY_REPLY, "emergency": True}

    llm = _require_llm()
    context = _case_facts(asm)
    context.pop("date_of_birth", None)
    try:
        reply = llm.answer_patient_question(context, [t.dict() for t in req.history], req.message)
    except Exception:
        raise HTTPException(status_code=502, detail="The assistant couldn't answer just now. Please try again.")

    log_audit_event(user["id"], "AI_ASSISTANT_QUESTION", "ASSESSMENT", str(req.assessment_id), f"model={llm.model}")
    return {"reply": reply, "emergency": False}
