"""
Rule/Lexicon-Based NLP Symptom Extraction Engine
PRD Section 6.5:
Converts free-text symptom descriptions into structured clinical features:
- Extracted symptoms (synonym mapping)
- Duration extraction
- Severity detection
- Negation handling ("no fever", "denies shortness of breath")
- Never invents symptoms; raw text preserved verbatim for clinician review.
"""

import re
from typing import Dict, Any, List

# Canonical symptom mapping table (synonyms -> canonical symptom)
CANONICAL_SYMPTOMS = {
    "chest discomfort": [
        "chest discomfort", "chest pain", "tight chest", "chest pressure",
        "heavy chest", "angina", "pain in chest", "chest tightness", "burning in chest"
    ],
    "dizziness": [
        "dizziness", "dizzy", "lightheaded", "lightheadedness", "faint", "faintness",
        "feeling faint", "spinning", "vertigo", "woozy", "unsteady"
    ],
    "sweating": [
        "sweating", "sweaty", "perspiring", "cold sweat", "cold sweats",
        "diaphoresis", "profuse sweating", "night sweats"
    ],
    "shortness of breath": [
        "shortness of breath", "breathless", "breathlessness", "difficulty breathing",
        "trouble breathing", "dyspnea", "out of breath", "hard to breathe", "winded", "gasping"
    ],
    "cough": [
        "cough", "coughing", "persistent cough", "dry cough", "hacking cough", "wet cough", "phlegm"
    ],
    "fever": [
        "fever", "high temperature", "chills", "feverish", "shivering", "hot and cold"
    ],
    "headache": [
        "headache", "head pain", "migraine", "throbbing head", "head ache", "pressure in head"
    ],
    "fatigue": [
        "fatigue", "tired", "tiredness", "exhaustion", "lethargy", "weakness", "worn out"
    ],
    "nausea": [
        "nausea", "nauseous", "feel sick", "queasy", "upset stomach"
    ],
    "vomiting": [
        "vomiting", "vomit", "throwing up", "threw up", "puking"
    ],
    "abdominal pain": [
        "abdominal pain", "stomach pain", "belly ache", "stomach ache", "gut pain", "cramping"
    ],
    "palpitations": [
        "palpitations", "racing heart", "heart pounding", "fluttering heart", "rapid heartbeat", "skipped beats"
    ],
    "numbness": [
        "numbness", "tingling", "pins and needles", "loss of sensation", "numb"
    ],
    "diarrhoea": [
        "diarrhoea", "diarrhea", "loose stools", "watery stools"
    ],
    "blurred vision": [
        "blurred vision", "blurry vision", "double vision", "diminished vision"
    ],
    "excessive thirst": [
        "excessive thirst", "extreme thirst", "thirsty", "polydipsia", "dry mouth"
    ],
    "drowsiness": [
        "drowsiness", "drowsy", "sleepy", "somnolence", "sluggish"
    ]
}

# Negation patterns
NEGATION_REGEX = re.compile(
    r"\b(no|not|without|denies|negative for|free of|never had)\s+([a-zA-Z\s]{1,30})",
    re.IGNORECASE
)

# Duration patterns
DURATION_REGEXES = [
    re.compile(r"(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(hours?|hrs?|minutes?|mins?|days?|weeks?|months?)", re.IGNORECASE),
    re.compile(r"since\s+(yesterday|this morning|last night|last week|\w+)", re.IGNORECASE),
    re.compile(r"for\s+(about\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(hours?|hrs?|minutes?|mins?|days?|weeks?)", re.IGNORECASE)
]

# Word numbers map
WORD_TO_NUM = {
    "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
    "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10"
}

# Severity keywords
SEVERITY_MAP = {
    "severe": ["severe", "unbearable", "excruciating", "intense", "extreme", "very bad", "terrible", "worst"],
    "moderate": ["moderate", "medium", "noticeable", "fairly bad", "bothersome", "distressing"],
    "mild": ["mild", "slight", "minor", "little bit", "tolerable", "occasional"]
}

def extract_negated_terms(text: str) -> List[str]:
    """Find phrases that are preceded by negation markers."""
    negated = []
    for match in NEGATION_REGEX.finditer(text):
        negated.append(match.group(2).strip().lower())
    return negated

def extract_duration(text: str) -> str:
    """Extract temporal duration mentions from text."""
    for regex in DURATION_REGEXES:
        match = regex.search(text)
        if match:
            dur = match.group(0).strip()
            # Normalize word numbers if any
            for word, num in WORD_TO_NUM.items():
                dur = re.sub(rf"\b{word}\b", num, dur, flags=re.IGNORECASE)
            return dur
    return "Unknown"

def extract_severity(text: str) -> str:
    """Detect stated severity level."""
    text_lower = text.lower()
    for level, words in SEVERITY_MAP.items():
        if any(w in text_lower for w in words):
            return level.capitalize()
    return "Unknown"

def parse_free_text_symptoms(text: str) -> Dict[str, Any]:
    """
    Main NLP parsing function.
    Returns:
    {
        "extracted_symptoms": ["chest discomfort", "dizziness", "sweating"],
        "duration": "3 hours",
        "severity": "Unknown",
        "negated_symptoms": [],
        "raw_text": text
    }
    """
    if not text or not text.strip():
        return {
            "extracted_symptoms": [],
            "duration": "Unknown",
            "severity": "Unknown",
            "negated_symptoms": [],
            "raw_text": ""
        }

    text_lower = text.lower()
    negated_phrases = extract_negated_terms(text)
    
    extracted_symptoms = []
    negated_found = []

    for canonical, synonyms in CANONICAL_SYMPTOMS.items():
        matched = False
        for syn in synonyms:
            # Word boundary check for synonym
            pattern = rf"\b{re.escape(syn)}\b"
            if re.search(pattern, text_lower):
                # Verify if this was negated
                is_negated = any(re.search(rf"\b{re.escape(syn)}\b", neg) for neg in negated_phrases)
                if is_negated:
                    negated_found.append(canonical)
                else:
                    extracted_symptoms.append(canonical)
                    matched = True
                    break
        if matched:
            continue

    duration = extract_duration(text)
    severity = extract_severity(text)

    # Remove duplicates preserving order
    unique_symptoms = list(dict.fromkeys(extracted_symptoms))

    return {
        "extracted_symptoms": unique_symptoms,
        "duration": duration,
        "severity": severity,
        "negated_symptoms": list(dict.fromkeys(negated_found)),
        "raw_text": text.strip()
    }
