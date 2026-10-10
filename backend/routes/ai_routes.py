from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from auth_utils import get_current_user
from ai.nlp import parse_free_text_symptoms
from ai.risk_model import predict_patient_risk
from ai.safety_rules import evaluate_safety_rules
from ai.explainability import generate_shap_explanations
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

@router.post("/analyze-symptoms")
def analyze_symptoms_nlp(req: SymptomAnalysisRequest, user: dict = Depends(get_current_user)):
    """
    NLP layer converts free text into structured output for user confirmation (PRD 6.5).
    Example: 'I have chest discomfort and dizziness for 3 hours and I am sweating.'
    -> symptoms = [chest discomfort, dizziness, sweating]; duration = 3 hours; severity = Unknown
    """
    result = parse_free_text_symptoms(req.text)
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
        WHERE assessment_id = ?
    """, (assessment_id,))
    rows = cursor.fetchall()
    conn.close()
    if not rows:
        raise HTTPException(status_code=404, detail="No explanations found for this assessment")
    return {"factors": [dict(r) for r in rows]}
