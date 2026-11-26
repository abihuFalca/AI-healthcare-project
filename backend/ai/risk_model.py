"""
Interpretable Clinical Risk Prediction Model & Feature Engineering
PRD Section 6.4 & 7.1:
Combines demographic factors, clinical history, symptoms, and vital signs
into a calibrated probability and integer risk score (0-100).
Configurable bands:
- 0 to 39: LOW
- 40 to 69: MODERATE
- 70 to 100: HIGH
"""

import math
import re
from typing import Dict, Any, List, Tuple

MODEL_VERSION = "rf-0.1.0"

def calculate_bmi(height_cm: float, weight_kg: float) -> float:
    """Calculates BMI from height in cm and weight in kg."""
    if not height_cm or not weight_kg or height_cm <= 0:
        return 24.0  # Normal default if unprovided
    height_m = height_cm / 100.0
    return round(weight_kg / (height_m * height_m), 1)

SURGERY_REGEX = re.compile(
    r"\b(surgery|surgeries|surgical|operation|operated|laparoscop\w*|post[- ]?op\w*|"
    r"appendectomy|appendicectomy|cholecystectomy|hernia repair|c[- ]?section|caesarean|cesarean)\b",
    re.IGNORECASE,
)
_SURGERY_NEGATION = re.compile(r"\b(no|never|not had|without)\s+(\w+\s+){0,3}$", re.IGNORECASE)

def mentions_surgery(text: str) -> bool:
    """True if free text mentions an operation that is not negated ("no surgery")."""
    for m in SURGERY_REGEX.finditer(text or ""):
        if not _SURGERY_NEGATION.search(text[max(0, m.start() - 30):m.start()]):
            return True
    return False

def parse_duration_hours(duration: str):
    """'5 hours' -> 5, '2 days' -> 48, '30 minutes' -> 0.5; None if unknown."""
    m = re.search(r"(\d+(?:\.\d+)?)\s*(minute|min|hour|hr|day|week|month)", (duration or "").lower())
    if not m:
        return None
    n = float(m.group(1))
    unit = m.group(2)
    return n * {"minute": 1 / 60, "min": 1 / 60, "hour": 1, "hr": 1, "day": 24, "week": 168, "month": 720}[unit]

def compute_risk_features(
    age: int,
    gender: str,
    height: float,
    weight: float,
    symptoms: List[str],
    vitals: Dict[str, Any],
    history: List[str],
    risk_factors: List[str],
    medications: List[str],
    severity: str = "Unknown",
    duration: str = "Unknown",
    raw_text: str = ""
) -> Dict[str, float]:
    """
    Constructs normalized clinical risk weight vector.
    Each feature produces a weighted contribution to the log-odds of high risk.
    """
    features = {}
    bmi = calculate_bmi(height, weight)

    # 1. Demographic weights
    # Age factor: risk increases significantly above age 50
    if age >= 65:
        features["age_senior"] = 0.55
    elif age >= 55:
        features["age_older_adult"] = 0.38
    elif age >= 45:
        features["age_middle"] = 0.20
    else:
        features["age_young"] = 0.05

    # BMI
    if bmi >= 35.0:
        features["severe_obesity"] = 0.35
    elif bmi >= 30.0:
        features["obesity"] = 0.22
    elif bmi >= 25.0:
        features["overweight"] = 0.10

    # 2. Symptoms Weights (multi-hot clinical indicators)
    symp_set = {s.lower().strip() for s in (symptoms or [])}

    if "chest discomfort" in symp_set or "chest pain" in symp_set:
        features["symptom_chest_discomfort"] = 0.85
    if "shortness of breath" in symp_set:
        features["symptom_shortness_of_breath"] = 0.70
    if "dizziness" in symp_set:
        features["symptom_dizziness"] = 0.45
    if "sweating" in symp_set:
        features["symptom_sweating"] = 0.40
    if "palpitations" in symp_set:
        features["symptom_palpitations"] = 0.35
    if "drowsiness" in symp_set or "confusion" in symp_set:
        features["symptom_altered_sensorium"] = 0.60
    if "blurred vision" in symp_set:
        features["symptom_blurred_vision"] = 0.30
    if "fever" in symp_set:
        features["symptom_fever"] = 0.25
    if "headache" in symp_set:
        features["symptom_headache"] = 0.20
    if "cough" in symp_set:
        features["symptom_cough"] = 0.15
    if "abdominal pain" in symp_set:
        features["symptom_abdominal_pain"] = 0.45
    if "vomiting" in symp_set:
        features["symptom_vomiting"] = 0.35
    elif "nausea" in symp_set:
        features["symptom_nausea"] = 0.15
    if "diarrhoea" in symp_set:
        features["symptom_diarrhoea"] = 0.20
    if "numbness" in symp_set:
        features["symptom_numbness"] = 0.45
    if "excessive thirst" in symp_set:
        features["symptom_excessive_thirst"] = 0.25
    if "fatigue" in symp_set:
        features["symptom_fatigue"] = 0.10

    # Stated severity and duration of the presenting symptoms
    sev = (severity or "Unknown").strip().lower()
    if sev == "severe":
        features["severity_severe"] = 0.45
    elif sev == "moderate":
        features["severity_moderate"] = 0.20
    duration_hours = parse_duration_hours(duration)

    # Recent surgery (from history or mentioned in the symptom text)
    hist_text = " ".join(history or []).lower()
    recent_surgery = bool(SURGERY_REGEX.search(hist_text)) or mentions_surgery(raw_text)
    if recent_surgery:
        features["history_recent_surgery"] = 0.40

    # Clinically meaningful combinations
    if "abdominal pain" in symp_set:
        if recent_surgery:
            features["postoperative_abdominal_pain"] = 0.55
        if "vomiting" in symp_set or "nausea" in symp_set:
            features["abdominal_pain_with_vomiting"] = 0.30 if "vomiting" in symp_set else 0.15
        if sev == "severe":
            features["severe_abdominal_pain"] = 0.35
        if sev == "severe" and duration_hours is not None and duration_hours >= 6:
            features["persistent_severe_abdominal_pain"] = 0.30

    # 3. Vitals Deviations
    sbp = vitals.get("systolic_bp")
    dbp = vitals.get("diastolic_bp")
    hr = vitals.get("heart_rate")
    spo2 = vitals.get("spo2")
    temp = vitals.get("temperature")
    glucose = vitals.get("blood_glucose")

    if sbp is not None:
        val = float(sbp)
        if val >= 160:
            features["elevated_systolic_bp"] = 0.75
        elif val >= 140:
            features["elevated_systolic_bp"] = 0.45
        elif val < 90:
            features["low_systolic_bp"] = 0.60

    if dbp is not None:
        val = float(dbp)
        if val >= 100:
            features["elevated_diastolic_bp"] = 0.50
        elif val >= 90:
            features["elevated_diastolic_bp"] = 0.30

    if hr is not None:
        val = float(hr)
        if val >= 110:
            features["tachycardia_marked"] = 0.65
        elif val >= 100:
            features["tachycardia_mild"] = 0.40
        elif val < 50:
            features["bradycardia"] = 0.45

    if spo2 is not None:
        val = float(spo2)
        if val < 92:
            features["severe_hypoxemia"] = 0.85
        elif val < 95:
            features["moderate_hypoxemia"] = 0.50

    if temp is not None:
        val = float(temp)
        if val >= 38.5:
            features["fever_high"] = 0.35
        elif val >= 37.8:
            features["fever_mild"] = 0.20

    if glucose is not None:
        val = float(glucose)
        if val >= 250:
            features["marked_hyperglycemia"] = 0.70
        elif val >= 180:
            features["hyperglycemia"] = 0.35
        elif val <= 65:
            features["hypoglycemia"] = 0.60

    # 4. Medical History
    hist_set = {h.lower().strip() for h in (history or [])}
    if any("hypertension" in h for h in hist_set):
        features["history_hypertension"] = 0.40
    if any("heart" in h or "cad" in h or "coronary" in h or "angina" in h for h in hist_set):
        features["history_cardiovascular"] = 0.55
    if any("diabetes" in h for h in hist_set):
        features["history_diabetes"] = 0.45
    if any("stroke" in h or "tia" in h for h in hist_set):
        features["history_stroke"] = 0.50
    if any("kidney" in h or "renal" in h for h in hist_set):
        features["history_kidney_disease"] = 0.40
    if any("asthma" in h or "copd" in h for h in hist_set):
        features["history_respiratory"] = 0.35

    # 5. Risk Factors
    rf_set = {r.lower().strip() for r in (risk_factors or [])}
    if any("smoking" in r or "smoker" in r for r in rf_set):
        features["risk_smoking"] = 0.25
    if any("family" in r for r in rf_set):
        features["risk_family_history"] = 0.20
    if any("inactivity" in r or "sedentary" in r for r in rf_set):
        features["risk_sedentary"] = 0.15

    return features

def predict_patient_risk(
    age: int,
    gender: str,
    height: float,
    weight: float,
    symptoms: List[str],
    vitals: Dict[str, Any],
    history: List[str],
    risk_factors: List[str],
    medications: List[str],
    safety_rule_triggered: bool = False,
    severity: str = "Unknown",
    duration: str = "Unknown",
    raw_text: str = ""
) -> Tuple[float, int, str, str, Dict[str, float]]:
    """
    Computes calibrated probability, risk score (0-100), risk level (LOW/MODERATE/HIGH),
    and triage priority (ROUTINE/PROMPT/IMMEDIATE/EMERGENCY).
    """
    features = compute_risk_features(
        age, gender, height, weight, symptoms, vitals, history, risk_factors, medications,
        severity=severity, duration=duration, raw_text=raw_text
    )

    # Base log-odds (calibrated baseline for general population)
    base_log_odds = -2.2
    total_weights = sum(features.values())
    z = base_log_odds + total_weights

    # Sigmoid calibration to probability
    prob = 1.0 / (1.0 + math.exp(-z))
    # Map to 0-100 risk score
    score = int(round(prob * 100))
    score = max(5, min(98, score))  # Keep within reasonable display bounds

    # Deterministic escalation: severe abdominal pain after recent surgery can be a
    # post-operative complication and must be seen the same day (HIGH / IMMEDIATE).
    if "postoperative_abdominal_pain" in features and "severity_severe" in features:
        score = max(score, 72)

    # Rule hit forces high risk
    if safety_rule_triggered:
        score = max(score, 82)
        risk_level = "HIGH"
        triage_level = "EMERGENCY"
    else:
        if score >= 70:
            risk_level = "HIGH"
            triage_level = "IMMEDIATE"
        elif score >= 40:
            risk_level = "MODERATE"
            triage_level = "PROMPT"
        else:
            risk_level = "LOW"
            triage_level = "ROUTINE"

    return prob, score, risk_level, triage_level, features
