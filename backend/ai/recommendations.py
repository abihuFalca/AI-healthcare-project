"""
Deterministic Clinical Recommendation Engine
PRD Section 6.7 & Appendix B:
Provides standardized, safe clinical guidance templated by triage urgency and safety rules.
Enforces non-diagnostic phrasing standards.
"""

from typing import Dict, Any

STANDARD_DISCLAIMER = (
    "This result is an AI-assisted risk assessment and does not constitute a medical diagnosis. "
    "A qualified healthcare professional should make the final clinical decision. "
    "If you think you are having a medical emergency, contact local emergency services immediately."
)

RESULT_HEADLINE = "AI identified an elevated risk pattern based on the information provided."

def get_recommendation(triage_level: str, safety_triggered: bool = False, safety_rules: list = None) -> Dict[str, Any]:
    """
    Returns structured recommendations and standard disclaimers based on triage level.
    """
    if safety_triggered or triage_level == "EMERGENCY":
        rec_text = (
            "Seek immediate medical attention now; do not rely on this application. "
            "Call local emergency services (911 / 112) or proceed to the nearest emergency department immediately."
        )
        urgency_label = "Emergency"
        action_button = "Call Emergency Services (911)"
    elif triage_level == "IMMEDIATE":
        rec_text = (
            "Immediate clinical assessment is recommended. A healthcare provider should evaluate your "
            "symptoms in person as soon as possible (within 1 to 2 hours)."
        )
        urgency_label = "Immediate Attention"
        action_button = "Contact Healthcare Facility"
    elif triage_level == "PROMPT":
        rec_text = (
            "Prompt healthcare consultation is recommended. Schedule an in-person or telehealth visit with "
            "your physician within 24 to 48 hours, and monitor your vital signs closely."
        )
        urgency_label = "Prompt Consultation"
        action_button = "Schedule Consultation"
    else:  # ROUTINE
        rec_text = (
            "Routine healthcare consultation and continued monitoring. Maintain standard preventative care, "
            "continue your prescribed medications, and log any changes in symptoms."
        )
        urgency_label = "Routine Care"
        action_button = "Log Health Journal"

    return {
        "headline": RESULT_HEADLINE,
        "recommendation_text": rec_text,
        "urgency_label": urgency_label,
        "action_button": action_button,
        "disclaimer": STANDARD_DISCLAIMER,
        "emergency_guidance": (
            "If you have severe symptoms, chest pain, difficulty breathing, or feel your life is in danger, "
            "seek immediate medical attention or call your local emergency number. Do not rely on this application."
        )
    }
