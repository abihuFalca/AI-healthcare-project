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
        "nausea", "nauseous", "nauseated", "feel sick", "feeling sick", "queasy", "upset stomach"
    ],
    "vomiting": [
        "vomiting", "vomit", "vomited", "throwing up", "threw up", "puking", "puked"
    ],
    "abdominal pain": [
        "abdominal pain", "stomach pain", "belly ache", "stomach ache", "gut pain", "cramping",
        "belly pain", "tummy ache", "tummy pain", "abdominal cramps", "stomach cramps", "abdomen pain"
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

# Word-order-free body-part pain patterns, e.g. "pain in my abdomen",
# "my stomach hurts", "sharp pain around the lower belly".
_PAIN = r"(?:pain|pains|ache|aches|aching|hurts?|hurting|cramps?|cramping|discomfort|tenderness|soreness)"
_PREP = r"(?:in|on|around|at|across|of)\s+(?:my|the|his|her)?\s*(?:lower|upper|right|left|whole|entire|middle)?\s*"
_BODY_PARTS = {
    "abdominal pain": r"(?:abdomen|abdominal(?: area| region)?|belly|stomach|tummy|gut|navel|belly button)",
    "chest discomfort": r"(?:chest)",
    "headache": r"(?:head|forehead|temples?)",
}
BODY_PAIN_PATTERNS = {
    canonical: [
        re.compile(rf"\b{_PAIN}\b[^.,;!?]{{0,25}}?\b{_PREP}{part}\b", re.IGNORECASE),
        re.compile(rf"\b{part}\b\s*(?:is|are|feels?|has been|have been|keeps?)?\s*(?:\w+\s+)?\b{_PAIN}\b", re.IGNORECASE),
    ]
    for canonical, part in _BODY_PARTS.items()
}

# "vomiting sensation", "feel like vomiting", "urge to throw up" describe NAUSEA,
# not actual vomiting. These spans are mapped to nausea and hidden from the
# vomiting synonyms so they are not double counted.
NAUSEA_PHRASE_REGEX = re.compile(
    r"\b(?:vomiting|vomit|throwing up|puking)\s+(?:sensation|feeling)s?\b"
    r"|\b(?:feel|feels|feeling|felt)\s+(?:like\s+)?(?:i\s+(?:might|could|will|am going to|'m going to)\s+)?(?:vomiting|vomit|throwing up|throw up|puking)\b"
    r"|\b(?:urge|want|wanting|need)\s+to\s+(?:vomit|throw up|puke)\b"
    r"|\b(?:about|going)\s+to\s+(?:vomit|throw up)\b",
    re.IGNORECASE,
)

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
    "severe": ["severe", "unbearable", "excruciating", "intense", "extreme", "very bad", "terrible", "worst",
               "strong pain", "strong", "sharp pain", "really bad", "killing me", "10/10", "9/10", "8/10"],
    "moderate": ["moderate", "medium", "noticeable", "fairly bad", "bothersome", "distressing"],
    "mild": ["mild", "slight", "minor", "little bit", "tolerable", "occasional"]
}

# A negation stops at a contrast or clause break: "no chest pain but my head aches"
NEGATION_BREAK_REGEX = re.compile(r"\b(?:but|however|although|though|except|yet)\b|[,.;!?]", re.IGNORECASE)

def _negation_matches(text: str):
    """Yield (start, end, phrase) for each negated phrase, cut at the first clause break."""
    for match in NEGATION_REGEX.finditer(text):
        phrase = match.group(2)
        cut = NEGATION_BREAK_REGEX.search(phrase)
        if cut:
            phrase = phrase[:cut.start()]
        yield match.start(), match.start(2) + len(phrase), phrase.strip().lower()

def extract_negated_terms(text: str) -> List[str]:
    """Find phrases that are preceded by negation markers."""
    return [phrase for _, _, phrase in _negation_matches(text) if phrase]

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
    negation_spans = [(start, end) for start, end, _ in _negation_matches(text)]

    def _is_negated_at(pos: int) -> bool:
        return any(start <= pos < end for start, end in negation_spans)

    extracted_symptoms = []
    negated_found = []

    # Nausea phrased as "vomiting sensation" etc. (checked before vomiting synonyms)
    for m in NAUSEA_PHRASE_REGEX.finditer(text):
        (negated_found if _is_negated_at(m.start()) else extracted_symptoms).append("nausea")
    # Hide those spans so "vomiting" inside "vomiting sensation" is not read as vomiting
    text_lower = NAUSEA_PHRASE_REGEX.sub(" ", text_lower)

    # Body-part pain phrased in any word order ("pain in my abdomen")
    for canonical, patterns in BODY_PAIN_PATTERNS.items():
        for pat in patterns:
            m = pat.search(text)
            if m:
                (negated_found if _is_negated_at(m.start()) else extracted_symptoms).append(canonical)
                break

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
    unique_symptoms = [s for s in dict.fromkeys(extracted_symptoms) if s not in negated_found or extracted_symptoms.count(s) > 1]

    return {
        "extracted_symptoms": unique_symptoms,
        "duration": duration,
        "severity": severity,
        "negated_symptoms": list(dict.fromkeys(negated_found)),
        "raw_text": text.strip()
    }
