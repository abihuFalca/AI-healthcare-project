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


class LLMService:
    """
    Wrapper around OpenAI API for healthcare-specific text generation.
    Includes simple in-memory caching to reduce API calls.
    """
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4-turbo"):
        """
        Initialize LLM service.
        
        Args:
            api_key: OpenAI API key (default: read from OPENAI_API_KEY env var)
            model: Model to use (default: gpt-4-turbo, fallback: gpt-3.5-turbo)
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self.cache = {}  # Simple in-memory cache {hash(prompt): response}
        self.cache_ttl = 86400  # 24 hours
        
        if self.api_key and OPENAI_AVAILABLE:
            self.client = OpenAI(api_key=self.api_key)
            self.available = True
        else:
            self.client = None
            self.available = False
            print("LLM service not available. Set OPENAI_API_KEY environment variable.")
    
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
    
    def health_check(self) -> Dict[str, Any]:
        """Check if LLM service is operational."""
        return {
            "available": self.available,
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
