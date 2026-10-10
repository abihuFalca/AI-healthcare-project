"""
Deterministic Emergency Safety Rule Engine
PRD Section 8 & Appendix A:
Guarantees emergency warning signs are never left to a probabilistic model or an LLM alone.
Rule hits force triage = Emergency / HIGH and generate high-priority notifications.
"""

from typing import Dict, Any, List, Tuple

def evaluate_safety_rules(
    symptoms: List[str],
    vitals: Dict[str, Any],
    raw_symptom_text: str = "",
    history: List[str] = None
) -> Tuple[bool, List[str], str]:
    """
    Evaluates clinical emergency rules deterministically.
    Returns:
        (is_emergency, list_of_triggered_rules, recommendation_override)
    """
    triggered_rules = []
    text_lower = (raw_symptom_text or "").lower()
    symptoms_set = {s.lower().strip() for s in (symptoms or [])}
    history_set = {h.lower().strip() for h in (history or [])}

    # Helper: check vitals safely
    sbp = vitals.get("systolic_bp")
    dbp = vitals.get("diastolic_bp")
    hr = vitals.get("heart_rate")
    spo2 = vitals.get("spo2")
    temp = vitals.get("temperature")
    glucose = vitals.get("blood_glucose")

    # 1. Cardiac Pattern Emergency Rule (PRD 8.1 & Section 15 Demo)
    # Chest pain/discomfort combined with sweating, breathlessness, radiating pain, or dizziness
    has_chest_pain = any(k in symptoms_set or k in text_lower for k in [
        "chest discomfort", "chest pain", "tight chest", "chest pressure", "heavy chest", "angina"
    ])
    has_cardiac_assoc = any(k in symptoms_set or k in text_lower for k in [
        "sweating", "sweaty", "cold sweat", "perspiring", "breathlessness", "shortness of breath",
        "difficulty breathing", "radiating pain", "arm pain", "jaw pain", "dizziness", "dizzy", "lightheaded"
    ])
    if has_chest_pain and has_cardiac_assoc:
        triggered_rules.append("Cardiac Pattern: Chest discomfort accompanied by autonomic/hypoperfusion signs (sweating/dizziness/dyspnea)")

    # 2. Neurological Emergency Signs (PRD 8.1 - FAST stroke / sudden severe neuro deficits)
    neuro_signs = [
        "sudden weakness", "facial droop", "face drooping", "speech difficulty", "slurred speech",
        "loss of consciousness", "passed out", "fainted", "unresponsive", "sudden paralysis",
        "thunderclap headache", "worst headache of my life"
    ]
    if any(n in text_lower or n in symptoms_set for n in neuro_signs):
        triggered_rules.append("Neurological Warning: Acute neurological deficit / stroke alert criteria detected")

    # 3. Respiratory Failure / Severe Hypoxemia (PRD 8.1 & Appendix A)
    if spo2 is not None and float(spo2) < 90.0:
        triggered_rules.append(f"Severe Hypoxemia: SpO2 {spo2}% is below critical clinical threshold (90%)")
    
    if any(k in text_lower for k in ["cannot breathe", "gasping for air", "unable to speak", "choking"]):
        triggered_rules.append("Acute Respiratory Distress: Severe acute respiratory compromise indicated")

    # 4. Critical Vitals Limits (PRD 8.1 & Appendix A - Hard limits)
    if sbp is not None:
        val = float(sbp)
        if val >= 180.0:
            triggered_rules.append(f"Hypertensive Crisis: Systolic BP {val} mmHg >= 180 mmHg")
        elif val < 85.0:
            triggered_rules.append(f"Hypotensive Shock Warning: Systolic BP {val} mmHg < 85 mmHg")

    if dbp is not None:
        val = float(dbp)
        if val >= 120.0:
            triggered_rules.append(f"Hypertensive Crisis: Diastolic BP {val} mmHg >= 120 mmHg")

    if hr is not None:
        val = float(hr)
        if val >= 135.0:
            triggered_rules.append(f"Severe Tachycardia: Heart rate {val} bpm >= 135 bpm")
        elif val < 45.0:
            triggered_rules.append(f"Severe Bradycardia: Heart rate {val} bpm < 45 bpm")

    if temp is not None:
        val = float(temp)
        if val >= 40.0:
            triggered_rules.append(f"Hyperpyrexia: Core temperature {val}°C >= 40.0°C")
        elif val < 35.0:
            triggered_rules.append(f"Hypothermia: Core temperature {val}°C < 35.0°C")

    if glucose is not None:
        val = float(glucose)
        if val >= 400.0:
            triggered_rules.append(f"Severe Hyperglycemia / DKA Warning: Blood glucose {val} mg/dL >= 400 mg/dL")
        elif val <= 50.0:
            triggered_rules.append(f"Severe Hypoglycemia: Blood glucose {val} mg/dL <= 50 mg/dL")

    # 5. Other Urgent Emergencies (PRD 8.1)
    critical_terms = ["heavy bleeding", "bleeding profusely", "seizure", "convulsions", "anaphylaxis", "throat swelling"]
    if any(c in text_lower for c in critical_terms):
        triggered_rules.append("Critical Acute Condition: Acute systemic emergency pattern identified")

    # 6. Crisis / Self-Harm Safety Guarantee (PRD 8.1)
    self_harm_terms = ["suicide", "kill myself", "end my life", "self harm", "harming myself"]
    if any(s in text_lower for s in self_harm_terms):
        triggered_rules.append("Urgent Mental Health Crisis / Safety Support Protocol triggered")

    is_emergency = len(triggered_rules) > 0
    recommendation_override = ""
    if is_emergency:
        recommendation_override = "EMERGENCY SAFETY OVERRIDE: Immediate medical attention required. Call emergency services (911/112) or go to the nearest emergency department immediately. Do not delay seeking care."

    return is_emergency, triggered_rules, recommendation_override
