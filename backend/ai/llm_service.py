"""
LLM Service for accessibility and explainability (Phase 3 Track A).

Provides:
1. Plain-language paraphrase of privacy notice
2. Narrative explanation of assessment results
3. Caching to reduce API costs
"""

import os
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import hashlib
from functools import lru_cache

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("Warning: OpenAI not installed. Install with: pip install openai")


# Providers that speak the OpenAI chat-completions API.
# Gemini and Groq both have free tiers; pick one with LLM_PROVIDER in .env.
PROVIDERS = {
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "key_env": "GEMINI_API_KEY",
        "default_model": "gemini-2.5-flash",
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "key_env": "GROQ_API_KEY",
        "default_model": "llama-3.3-70b-versatile",
    },
    "openai": {
        "base_url": None,
        "key_env": "OPENAI_API_KEY",
        "default_model": "gpt-4o-mini",
    },
}


class LLMService:
    """
    Wrapper around an OpenAI-compatible chat API (Gemini, Groq or OpenAI)
    for healthcare-specific text generation, with simple in-memory caching.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        """
        Initialize LLM service.

        Reads from .env:
            LLM_PROVIDER  gemini | groq | openai (default: openai)
            <PROVIDER>_API_KEY  e.g. GEMINI_API_KEY
            LLM_MODEL     optional model override
        """
        self.provider = (os.getenv("LLM_PROVIDER") or "openai").strip().lower()
        if self.provider not in PROVIDERS:
            print(f"Unknown LLM_PROVIDER '{self.provider}', falling back to openai.")
            self.provider = "openai"
        cfg = PROVIDERS[self.provider]
        self.key_env = cfg["key_env"]

        self.api_key = api_key or os.getenv(cfg["key_env"])
        legacy_model = os.getenv("OPENAI_MODEL") if self.provider == "openai" else None
        self.model = model or os.getenv("LLM_MODEL") or legacy_model or cfg["default_model"]
        self.cache = {}  # Simple in-memory cache {hash(prompt): response}
        self.cache_ttl = 86400  # 24 hours

        # Treat template values such as "sk-REPLACE_WITH_YOUR_KEY" as not configured
        if self.api_key and any(m in self.api_key.upper() for m in ("REPLACE", "YOUR_", "CHANGEME")):
            print(f"{cfg['key_env']} looks like a placeholder; AI features are disabled until a real key is set.")
            self.api_key = None

        if self.api_key and OPENAI_AVAILABLE:
            self.client = OpenAI(api_key=self.api_key, base_url=cfg["base_url"])
            self.available = True
        else:
            self.client = None
            self.available = False
            print(f"LLM service not available. Set {cfg['key_env']} in .env (LLM_PROVIDER={self.provider}).")
    
    def _cache_key(self, prompt: str) -> str:
        """Generate cache key from prompt."""
        return hashlib.md5(prompt.encode()).hexdigest()
    
    def _get_cached(self, prompt: str) -> Optional[str]:
        """Retrieve from cache if available and not expired."""
        key = self._cache_key(prompt)
        if key in self.cache:
            response, timestamp = self.cache[key]
            age = (datetime.now() - timestamp).total_seconds()
            if age < self.cache_ttl:
                return response
            else:
                del self.cache[key]  # Expired
        return None
    
    def _set_cached(self, prompt: str, response: str) -> None:
        """Store in cache with timestamp."""
        key = self._cache_key(prompt)
        self.cache[key] = (response, datetime.now())
    
    def paraphrase_privacy_notice(self, notice: str) -> str:
        """
        Convert legal privacy notice to plain language.
        
        Args:
            notice: Original privacy notice text
            
        Returns:
            Plain-language version suitable for non-technical readers
        """
        if not self.available:
            return notice  # Fallback: return original
        
        # Check cache
        cached = self._get_cached(f"paraphrase:{notice[:100]}")
        if cached:
            return cached
        
        try:
            prompt = f"""
You are a healthcare communications specialist. Rephrase the following legal privacy notice into simple, clear language that a patient can easily understand. Use short sentences, plain words, and explain what it means for them.

Original notice:
{notice}

Plain language version:
"""
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=600,
                temperature=0.3
            )
            
            result = response.choices[0].message.content.strip()
            self._set_cached(f"paraphrase:{notice[:100]}", result)
            return result
            
        except Exception as e:
            print(f"LLM paraphrase error: {e}")
            return notice  # Fallback
    
    def explain_assessment_result(
        self,
        risk_score: float,
        risk_level: str,
        shap_features: List[Dict[str, Any]],
        triage_level: str,
        age: int = None,
        symptoms: List[str] = None
    ) -> str:
        """
        Generate plain-language explanation of assessment results.
        
        Args:
            risk_score: Numerical risk score (0-100)
            risk_level: Risk category (LOW, MODERATE, HIGH)
            shap_features: Top SHAP feature importances (list of {feature, impact})
            triage_level: Triage classification (ROUTINE, PROMPT, URGENT)
            age: Patient age (optional, for context)
            symptoms: Patient symptoms (optional, for context)
            
        Returns:
            Narrative explanation suitable for patient reading
        """
        if not self.available:
            return f"Your risk level is {risk_level} (score: {risk_score}/100). Please consult a healthcare provider for personalized advice."
        
        # Build context string
        features_text = "\n".join([
            f"- {f.get('feature', 'Unknown feature')}: {f.get('impact', 'N/A')}"
            for f in (shap_features[:5] if shap_features else [])
        ])
        
        symptoms_text = ", ".join(symptoms) if symptoms else "Not specified"
        age_text = f" Age {age}" if age else ""
        
        # Check cache
        cache_key = f"explain:{risk_score}:{risk_level}:{triage_level}:{age}:{symptoms_text[:50]}"
        cached = self._get_cached(cache_key)
        if cached:
            return cached
        
        try:
            prompt = f"""
You are a healthcare communication specialist explaining test results to a patient. Based on these results, write a clear, empathetic explanation of what the risk score means and what the patient should do next.

Assessment Results:
- Risk Score: {risk_score}/100 ({risk_level})
- Triage Level: {triage_level}
- Symptoms: {symptoms_text}
{age_text}

Key Contributing Factors:
{features_text if features_text else "Not available"}

Instructions:
1. Explain what the risk level means in simple terms (avoid medical jargon)
2. Mention the top 1-2 contributing factors
3. Suggest appropriate next steps based on triage level:
   - ROUTINE: Schedule a regular checkup within 2 weeks
   - PROMPT: Schedule an appointment within 3-5 days
   - URGENT: Seek immediate medical attention
4. Remind them this is an estimate, not a diagnosis
5. Keep the explanation under 150 words
6. Be empathetic and reassuring

Plain-language explanation:
"""
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.4
            )
            
            result = response.choices[0].message.content.strip()
            self._set_cached(cache_key, result)
            return result
            
        except Exception as e:
            print(f"LLM explain error: {e}")
            fallback = f"Your risk assessment shows {risk_level} risk (score: {risk_score}/100). "
            if triage_level == "URGENT":
                fallback += "Please seek medical attention promptly. "
            elif triage_level == "PROMPT":
                fallback += "Please schedule a medical appointment soon. "
            else:
                fallback += "Schedule a regular checkup with your healthcare provider. "
            fallback += "This is an AI estimate, not a diagnosis."
            return fallback
    
    def generate_tts_text(self, text: str, max_length: int = 300) -> str:
        """
        Prepare text for text-to-speech (TTS).
        Trim to reasonable length and ensure punctuation is clear.
        
        Args:
            text: Full text to prepare
            max_length: Maximum characters
            
        Returns:
            TTS-friendly text (truncated if needed)
        """
        if len(text) <= max_length:
            return text
        
        # Truncate at sentence boundary
        truncated = text[:max_length]
        last_period = truncated.rfind('.')
        if last_period > max_length * 0.7:  # If period is reasonably close
            return truncated[:last_period + 1]
        
        return truncated.rstrip() + "."
    
    # ------------------------------------------------------------------
    # Shared helper
    # ------------------------------------------------------------------
    def _chat(self, messages: List[Dict[str, str]], max_tokens: int = 400,
              temperature: float = 0.2, json_mode: bool = False) -> str:
        """Single chat completion call with a short timeout. Raises on failure."""
        kwargs = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "timeout": 20,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        response = self.client.chat.completions.create(**kwargs)
        return (response.choices[0].message.content or "").strip()

    # ------------------------------------------------------------------
    # 1. Smarter symptom reading (assists the rule-based NLP; never replaces it)
    # ------------------------------------------------------------------
    def extract_symptoms(self, text: str, allowed_symptoms: List[str]) -> List[str]:
        """
        Read free-text symptoms and map them onto the canonical symptom list.

        Only names from `allowed_symptoms` are ever returned, and negated or
        merely-mentioned symptoms are excluded. Returns [] when the LLM is
        unavailable or anything goes wrong, so the rule-based parser result
        always stands on its own.
        """
        if not self.available or not text or not text.strip():
            return []

        cache_key = f"symptoms:{text.strip().lower()}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return json.loads(cached)

        system = (
            "You map a patient's own description of their symptoms onto a fixed list of "
            "canonical symptom names. Rules:\n"
            "- Only use names exactly as written in the allowed list.\n"
            "- Include a symptom only if the patient says they currently have it.\n"
            "- Exclude anything denied or negated (e.g. 'no fever', 'not dizzy').\n"
            "- Do not guess or infer diagnoses. If unsure, leave it out.\n"
            'Respond with JSON only: {"symptoms": ["..."]}'
        )
        user = f"Allowed list: {json.dumps(allowed_symptoms)}\n\nPatient text: \"\"\"{text.strip()[:2000]}\"\"\""
        try:
            raw = self._chat(
                [{"role": "system", "content": system}, {"role": "user", "content": user}],
                max_tokens=200, temperature=0, json_mode=True,
            )
            found = json.loads(raw).get("symptoms", [])
            allowed = set(allowed_symptoms)
            result = list(dict.fromkeys(s for s in found if isinstance(s, str) and s in allowed))
            self._set_cached(cache_key, json.dumps(result))
            return result
        except Exception as e:
            print(f"LLM symptom extraction error: {e}")
            return []

    # ------------------------------------------------------------------
    # 2. Clinician case summary
    # ------------------------------------------------------------------
    def summarize_case(self, case: Dict[str, Any]) -> str:
        """
        Write a short structured summary of an assessment for a healthcare worker.
        `case` holds the assessment facts already stored in the database.
        """
        if not self.available:
            raise RuntimeError("LLM service not available")

        cache_key = f"case:{case.get('assessment_id')}:{case.get('review_status')}"
        cached = self._get_cached(cache_key)
        if cached:
            return cached

        system = (
            "You are assisting a licensed clinician reviewing an AI triage assessment. "
            "Write a concise case summary using only the facts provided. Never add findings, "
            "test results or diagnoses that are not in the data. Use these headings, each with "
            "1-3 short bullet points:\n"
            "Presenting complaint\nKey vitals (flag abnormal values)\nRelevant history & risk factors\n"
            "AI risk drivers\nSuggested points to check\n"
            "Keep it under 180 words. Plain text, no markdown bold."
        )
        try:
            result = self._chat(
                [{"role": "system", "content": system},
                 {"role": "user", "content": json.dumps(case, default=str)}],
                max_tokens=450, temperature=0.2,
            )
            self._set_cached(cache_key, result)
            return result
        except Exception as e:
            print(f"LLM case summary error: {e}")
            raise

    # ------------------------------------------------------------------
    # 3. Patient assistant (questions about their own result)
    # ------------------------------------------------------------------
    def answer_patient_question(self, context: Dict[str, Any],
                                history: List[Dict[str, str]], question: str) -> str:
        """
        Answer a patient's question about their assessment result in plain language.
        The assistant explains; it never diagnoses, prescribes or changes the triage.
        """
        if not self.available:
            raise RuntimeError("LLM service not available")

        system = (
            "You are a friendly assistant inside a health triage app. The patient has just "
            "received an AI risk assessment, described in the JSON below. Help them understand "
            "it.\nRules:\n"
            "- Use simple words and short answers (under 120 words).\n"
            "- Do not diagnose, name a likely disease, prescribe, or suggest medication doses.\n"
            "- Never lower the urgency of the result or tell them to ignore it.\n"
            "- If they describe worsening or emergency symptoms (chest pain, trouble breathing, "
            "fainting, stroke signs, severe bleeding, thoughts of self-harm), tell them to call "
            "local emergency services now.\n"
            "- For decisions about treatment, tell them to speak with their doctor.\n"
            "- If the question is unrelated to their health or this result, politely say you can "
            "only help with their assessment.\n\n"
            f"Assessment: {json.dumps(context, default=str)}"
        )
        messages = [{"role": "system", "content": system}]
        for turn in history[-8:]:
            if turn.get("role") in ("user", "assistant") and turn.get("content"):
                messages.append({"role": turn["role"], "content": str(turn["content"])[:1500]})
        messages.append({"role": "user", "content": question[:1500]})
        return self._chat(messages, max_tokens=300, temperature=0.3)

    def health_check(self) -> Dict[str, Any]:
        """Check if LLM service is operational."""
        return {
            "available": self.available,
            "provider": self.provider,
            "model": self.model,
            "cache_size": len(self.cache),
            "openai_available": OPENAI_AVAILABLE
        }


# Singleton instance
_llm_service: Optional[LLMService] = None

def get_llm_service() -> LLMService:
    """Get or create LLM service singleton."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
