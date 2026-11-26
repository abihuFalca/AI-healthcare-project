import React, { useState, useEffect } from 'react';
import ConsentScreen from './ConsentScreen';
import AssessmentWizard from './AssessmentWizard';
import { AlertCircle, Loader } from 'lucide-react';

/**
 * AssessmentWizardWrapper
 * 
 * Wraps AssessmentWizard with consent workflow enforcement (PRD §9.2, §6.3).
 * 
 * Flow:
 * 1. Check if user has existing consent record via /api/auth/consent/status
 * 2. If NO consent → show ConsentScreen
 * 3. If user accepts → proceed to AssessmentWizard
 * 4. If user declines → show opt-out message; the assessment is not started
 *    (the backend rejects assessments without accepted consent)
 * 5. If consent exists → skip directly to AssessmentWizard
 */
export default function AssessmentWizardWrapper({ onComplete, onCancel, token }) {
  const [consentStatus, setConsentStatus] = useState(null); // null = loading, true = consented, false = checked
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [declined, setDeclined] = useState(false);

  // Check consent status on mount
  useEffect(() => {
    const checkConsent = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/auth/consent/status', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || 'Failed to check consent status');
        }

        const data = await res.json();
        setConsentStatus(data.has_consented);
      } catch (err) {
        console.error('Consent check error:', err);
        // If check fails, show error but allow retry
        setError(err.message);
        setConsentStatus(null); // Reset to allow retry
      } finally {
        setLoading(false);
      }
    };

    checkConsent();
  }, [token]);

  const handleConsentAccepted = (consentData) => {
    console.log('Consent accepted:', consentData);
    setConsentStatus(true);
  };

  const handleConsentDeclined = (consentData) => {
    console.log('Consent declined:', consentData);
    // Every assessment runs through AI triage, so it cannot start without consent.
    setDeclined(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="container" style={{ maxWidth: '600px', marginTop: '3rem', marginBottom: '3rem' }}>
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            textAlign: 'center',
            minHeight: '300px'
          }}
        >
          <Loader size={40} style={{ color: '#0284c7', animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '0.95rem' }}>
            Checking consent status...
          </p>
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error && consentStatus === null) {
    return (
      <div className="container" style={{ maxWidth: '600px', marginTop: '3rem', marginBottom: '3rem' }}>
        <div className="card">
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              marginBottom: '1.5rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <AlertCircle size={20} color="#991b1b" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#991b1b', marginBottom: '0.5rem' }}>
                  Unable to Verify Consent
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#7f1d1d', lineHeight: '1.5' }}>
                  {error}
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.95rem'
              }}
            >
              Retry
            </button>
            <button
              onClick={onCancel}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#ffffff',
                color: '#475569',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.95rem'
              }}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Declined → explain and offer a way back
  if (declined) {
    return (
      <div className="container" style={{ maxWidth: '600px', marginTop: '3rem', marginBottom: '3rem' }}>
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <AlertCircle size={36} color="#b45309" style={{ marginBottom: '0.75rem' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Assessment not started</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            You declined AI processing, so we have not collected or analysed any health data.
            Risk assessments rely on AI triage and need your consent. You can review the
            privacy notice again at any time.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={onCancel}>Back to Dashboard</button>
            <button className="btn btn-primary" onClick={() => setDeclined(false)}>Review Notice Again</button>
          </div>
        </div>
      </div>
    );
  }

  // If NO consent → Show ConsentScreen
  if (consentStatus === false) {
    return (
      <ConsentScreen
        onConsent={handleConsentAccepted}
        onDecline={handleConsentDeclined}
        token={token}
      />
    );
  }

  // If consent exists OR was just accepted → Show AssessmentWizard
  if (consentStatus === true) {
    return (
      <AssessmentWizard
        onComplete={onComplete}
        onCancel={onCancel}
        token={token}
      />
    );
  }

  return null; // Should not reach here
}
