from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from auth_utils import get_current_user
from ai.nlp import parse_free_text_symptoms
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
            detail="LLM service not available. Set OPENAI_API_KEY environment variable."
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
