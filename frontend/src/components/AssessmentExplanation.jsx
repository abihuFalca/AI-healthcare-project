import React, { useState, useEffect } from 'react';
import { Loader, AlertCircle, CheckCircle2 } from 'lucide-react';
import TextToSpeech from './TextToSpeech';

/**
 * AssessmentExplanation Component (Phase 3 Track A)
 * 
 * Fetches LLM-generated plain-language explanation of assessment results.
 * Displays narrative explanation alongside risk visualization.
 * Includes TTS for accessibility.
 */
export default function AssessmentExplanation({
  riskScore,
  riskLevel,
  triageLevel,
  shapFeatures,
  age,
  symptoms,
  token
}) {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchExplanation = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/ai/explain-result', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            risk_score: riskScore,
            risk_level: riskLevel,
            triage_level: triageLevel,
            shap_features: shapFeatures || [],
            age: age,
            symptoms: symptoms || []
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || 'Failed to generate explanation');
        }

        const data = await res.json();
        setExplanation(data.explanation);
      } catch (err) {
        console.error('Explanation fetch error:', err);
        setError(err.message);
        // Provide fallback explanation
        setExplanation(generateFallbackExplanation(riskScore, riskLevel, triageLevel));
      } finally {
        setLoading(false);
      }
    };

    if (riskScore !== null && riskLevel && token) {
      fetchExplanation();
    }
  }, [riskScore, riskLevel, triageLevel, token]);

  const generateFallbackExplanation = (score, level, triage) => {
    let result = `Your health risk assessment shows a ${level.toLowerCase()} risk level (score: ${score}/100). `;
    
    switch (triage) {
      case 'URGENT':
        result += 'This suggests you should seek immediate medical attention. Please contact emergency services or go to the nearest emergency room. ';
        break;
      case 'PROMPT':
        result += 'This suggests you should schedule a medical appointment soon, ideally within 3-5 days. ';
        break;
      case 'ROUTINE':
        result += 'This suggests you can schedule a regular checkup with your healthcare provider. ';
        break;
      default:
        result += 'Please consult with your healthcare provider. ';
    }
    
    result += 'Remember, this is an AI-assisted estimate and not a diagnosis. A healthcare professional will review your assessment and provide personalized clinical guidance.';
    return result;
  };

  return (
    <div style={{
      backgroundColor: '#f0f9ff',
      border: '1px solid #bae6fd',
      borderRadius: '10px',
      padding: '1.5rem',
      marginTop: '1.5rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1rem'
      }}>
        <CheckCircle2 size={24} color="#0284c7" />
        <h3 style={{
          fontSize: '1.1rem',
          fontWeight: '700',
          color: '#0c4a6e',
          margin: 0
        }}>
          What Your Results Mean
        </h3>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#64748b'
        }}>
          <Loader
            size={20}
            style={{
              animation: 'spin 1s linear infinite',
              color: '#0284c7'
            }}
          />
          <span>Generating personalized explanation...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem'
        }}>
          <AlertCircle size={20} color="#991b1b" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#991b1b',
              margin: '0 0 0.5rem 0'
            }}>
              Could not generate detailed explanation
            </p>
            <p style={{
              fontSize: '0.85rem',
              color: '#7f1d1d',
              margin: 0,
              lineHeight: '1.5'
            }}>
              {error}. Showing standard explanation below.
            </p>
          </div>
        </div>
      )}

      {/* Explanation Text */}
      {explanation && (
        <div>
          <p style={{
            fontSize: '0.95rem',
            color: '#1f2937',
            lineHeight: '1.7',
            marginTop: loading || error ? '1rem' : 0,
            marginBottom: '1rem',
            whiteSpace: 'pre-wrap'
          }}>
            {explanation}
          </p>

          {/* TTS Button */}
          <div style={{ marginTop: '1rem' }}>
            <TextToSpeech
              text={explanation}
              label="Read Explanation Aloud"
              rate={1}
            />
          </div>
        </div>
      )}

      {/* Footer Note */}
      <div style={{
        marginTop: '1rem',
        paddingTop: '1rem',
        borderTop: '1px solid #bae6fd',
        fontSize: '0.8rem',
        color: '#0c4a6e',
        fontStyle: 'italic'
      }}>
        <strong>Important:</strong> This explanation is generated by AI and is for informational purposes only. 
        A qualified healthcare professional will review your assessment and provide personalized clinical guidance.
      </div>
    </div>
  );
}

// Add CSS animation for spinner
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
