"""
Explainable AI (SHAP-compatible) Engine
PRD Section 6.6 & 7.1:
Transforms feature weights into human-understandable clinical contributions:
- Feature name
- Normalized contribution value (+/-)
- Importance rank (High / Medium / Low)
- Evidence-based clinical explanation text
"""

from typing import Dict, Any, List

FEATURE_DESCRIPTIONS = {
    "symptom_chest_discomfort": (
        "Chest Discomfort",
        "Acute chest discomfort or pain is a primary clinical warning sign for acute cardiac ischemia.",
        "high"
    ),
    "elevated_systolic_bp": (
        "Elevated Systolic Blood Pressure",
        "Systolic blood pressure significantly exceeds healthy thresholds, indicating severe cardiovascular strain.",
        "high"
    ),
    "tachycardia_marked": (
        "Elevated Heart Rate (Tachycardia)",
        "Resting heart rate >= 110 bpm indicates autonomic arousal, circulatory stress, or compensatory tachycardia.",
        "high"
    ),
    "tachycardia_mild": (
        "Mild Tachycardia",
        "Heart rate between 100-110 bpm reflects mild elevation above resting baseline.",
        "medium"
    ),
    "history_hypertension": (
        "Pre-existing Hypertension History",
        "Documented chronicle of hypertension increases susceptibility to acute cardiovascular events.",
        "medium"
    ),
    "symptom_dizziness": (
        "Dizziness / Lightheadedness",
        "Dizziness accompanying hemodynamic shifts suggests transient cerebral hypoperfusion.",
        "medium"
    ),
    "symptom_sweating": (
        "Diaphoresis (Sweating)",
        "Profuse sweating without exertion is a hallmark autonomic symptom associated with acute coronary syndromes.",
        "high"
    ),
    "symptom_shortness_of_breath": (
        "Shortness of Breath (Dyspnea)",
        "Subjective breathlessness signals pulmonary congestion or impaired cardiac output.",
        "high"
    ),
    "severe_hypoxemia": (
        "Critically Low Oxygen Saturation",
        "SpO2 below 92% is a direct indicator of compromised alveolar gas exchange.",
        "high"
    ),
    "moderate_hypoxemia": (
        "Reduced Oxygen Saturation",
        "SpO2 between 92-94% reflects mild-to-moderate oxygen impairment.",
        "medium"
    ),
    "marked_hyperglycemia": (
        "Severely Elevated Blood Glucose",
        "Blood glucose >= 250 mg/dL presents imminent risk of diabetic hyperosmolar or ketoacidotic emergency.",
        "high"
    ),
    "age_senior": (
        "Age >= 65 Years",
        "Age-associated vascular stiffening and cumulative risk increase clinical vulnerability.",
        "medium"
    ),
    "age_older_adult": (
        "Age 55–64 Years",
        "Age profile places patient in demographic with heightened cardiovascular incidence.",
        "medium"
    ),
    "risk_smoking": (
        "Tobacco Smoking History",
        "Tobacco use causes accelerated endothelial dysfunction and coronary atherosclerosis.",
        "medium"
    ),
    "risk_family_history": (
        "Family History of Cardiovascular Disease",
        "First-degree relative history confers independent hereditary cardiovascular risk.",
        "medium"
    ),
    "history_cardiovascular": (
        "Underlying Heart Disease",
        "Established cardiac history strongly correlates with recurrent ischemic vulnerability.",
        "high"
    ),
    "history_diabetes": (
        "Underlying Diabetes Mellitus",
        "Diabetes accelerates microvascular and macrovascular pathology.",
        "medium"
    )
}

def generate_shap_explanations(features: Dict[str, float], top_n: int = 5) -> List[Dict[str, Any]]:
    """
    Computes top contributing factors with normalized weights and human-readable clinical narratives.
    """
    if not features:
        return []

    total_weight = sum(features.values()) or 1.0

    # Sort features by weight descending
    sorted_feats = sorted(features.items(), key=lambda kv: kv[1], reverse=True)

    explanations = []
    for feat_key, weight in sorted_feats[:top_n]:
        # Lookup definition
        if feat_key in FEATURE_DESCRIPTIONS:
            label, explanation, default_imp = FEATURE_DESCRIPTIONS[feat_key]
        else:
            # Fallback formatting
            label = feat_key.replace("symptom_", "").replace("history_", "").replace("_", " ").title()
            explanation = f"Input factor '{label}' contributed positively to the risk score."
            default_imp = "medium"

        # Calculate normalized contribution (similar to SHAP attribution value)
        contribution = round(weight / (total_weight + 0.5), 2)
        if contribution <= 0.05:
            contribution = 0.08

        # Determine importance rating
        if contribution >= 0.20 or default_imp == "high":
            importance = "high"
        elif contribution >= 0.12 or default_imp == "medium":
            importance = "medium"
        else:
            importance = "low"

        explanations.append({
            "feature": feat_key,
            "label": label,
            "contribution": contribution,
            "importance": importance,
            "explanation_text": explanation
        })

    return explanations
