import React, { useState } from 'react';
import {
  Shield, AlertCircle, CheckCircle2, ChevronDown, Lock,
  FileText, BarChart3, Zap, Users, Database
} from 'lucide-react';
import TextToSpeech from '../components/TextToSpeech';

/**
 * ConsentScreen (PRD §9.2, §6.3)
 * 
 * Displays privacy notice and explicit consent acceptance before first assessment.
 * Stores consent acceptance with timestamp and IP address for audit trail.
 * Users can view full privacy policy, then accept or decline AI data usage.
 */
export default function ConsentScreen({ onConsent, onDecline, token, loading = false }) {
  const [showFullPolicy, setShowFullPolicy] = useState(false);
  const [acceptedCheckbox, setAcceptedCheckbox] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAccept = async () => {
    if (!acceptedCheckbox) {
      setError('Please confirm that you accept the privacy notice before proceeding.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          consent_version: 'v1.0',
          accepted: true
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to record consent');
      }

      const data = await res.json();
      onConsent(data); // Trigger callback with consent record
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          consent_version: 'v1.0',
          accepted: false
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to record consent decline');
      }

      const data = await res.json();
      onDecline(data); // Trigger callback; the assessment will not start
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '780px', marginTop: '2rem', marginBottom: '2rem' }}>
      <div className="card">
        {/* Header */}
        <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Shield size={28} color="#0284c7" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Privacy Notice & AI Consent
            </h1>
          </div>
          <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0, marginTop: '0.5rem' }}>
            Please review and accept our privacy practices before using the AI-powered health assessment.
          </p>
          
          {/* TTS Button for Privacy Notice */}
          <div style={{ marginTop: '1rem' }}>
            <TextToSpeech 
              text="We collect your health information including symptoms, medical history, vitals, and medications. We use this data to generate an AI health risk assessment and explain the reasoning. Your data is stored securely and never shared with third parties. You have the right to access, correct, or delete your data. Healthcare professionals make final clinical decisions. This is a decision-support tool, not a medical device. For privacy questions, contact support at example dot com."
              label="Read Privacy Notice Aloud"
            />
          </div>
        </div>

        {/* Quick Summary */}
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '10px',
          padding: '1.25rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0c4a6e', marginTop: 0, marginBottom: '0.75rem' }}>
            What We Do With Your Data
          </h3>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.85rem', color: '#0c4a6e', lineHeight: '1.6' }}>
            <li><strong>Collect:</strong> Symptoms, medical history, vitals, medications, risk factors you enter.</li>
            <li><strong>Process:</strong> Send to AI model to estimate health risk and suggest urgency level.</li>
            <li><strong>Store:</strong> All data securely in our encrypted database (Supabase PostgreSQL).</li>
            <li><strong>Show:</strong> Risk score, triage level, and AI reasoning to you and your healthcare provider.</li>
            <li><strong>Protect:</strong> Your data is never sold, shared with third parties, or used for marketing.</li>
          </ul>
        </div>

        {/* Key Points */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', backgroundColor: '#fafafa', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Database size={18} color="#10b981" />
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#065f46' }}>Data Security</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>
              End-to-end encryption. Access restricted to you and authorized healthcare workers only.
            </p>
          </div>

          <div style={{ padding: '1rem', backgroundColor: '#fafafa', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Users size={18} color="#8b5cf6" />
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#553399' }}>Your Rights</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>
              You can decline AI analysis. You may request data deletion or correction anytime.
            </p>
          </div>

          <div style={{ padding: '1rem', backgroundColor: '#fafafa', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Zap size={18} color="#f59e0b" />
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#92400e' }}>AI is Support Only</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>
              AI output is for decision support. Healthcare professionals make final clinical decisions.
            </p>
          </div>
        </div>

        {/* Full Privacy Policy (Collapsible) */}
        <div style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={() => setShowFullPolicy(!showFullPolicy)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#0284c7',
              padding: 0,
              marginBottom: showFullPolicy ? '1rem' : 0
            }}
          >
            <FileText size={18} />
            {showFullPolicy ? 'Hide' : 'Show'} Full Privacy Policy (v1.0)
            <ChevronDown
              size={16}
              style={{
                transform: showFullPolicy ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            />
          </button>

          {showFullPolicy && (
            <div style={{
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
              padding: '1.25rem',
              fontSize: '0.8rem',
              color: '#4b5563',
              lineHeight: '1.7',
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              <h4 style={{ marginTop: 0, fontSize: '0.9rem', fontWeight: '700', color: '#1f2937' }}>Privacy Policy v1.0</h4>

              <p><strong>1. Data Collection</strong></p>
              <p>
                We collect health information you voluntarily provide during account creation and assessment:
                demographics (age, gender, height, weight), medical history, current medications, risk factors,
                symptoms, vital signs (blood pressure, heart rate, SpO₂, temperature, respiratory rate, blood glucose),
                and emergency contact information.
              </p>

              <p><strong>2. Data Usage</strong></p>
              <p>
                Your data is used solely to: (a) generate a personalized health risk assessment via machine learning,
                (b) provide explainable reasoning for the AI output, (c) support healthcare worker review and triage,
                (d) maintain audit logs for security and compliance, (e) improve system reliability and safety.
              </p>

              <p><strong>3. Data Minimization</strong></p>
              <p>
                We send only essential, de-identified information to external AI services (if any).
                Your name, email, and contact details are NEVER sent to AI providers. All processing is logged for audit.
              </p>

              <p><strong>4. Data Retention</strong></p>
              <p>
                Assessment records and health data are retained for as long as your account is active.
                You may request data deletion by contacting support; we will comply within 30 days
                (except where retention is required by law or clinical guidelines).
              </p>

              <p><strong>5. Data Sharing</strong></p>
              <p>
                Your data is shared ONLY with: (a) healthcare workers you authorize to review your assessments,
                (b) system administrators for security and maintenance (under strict confidentiality), (c) legal
                authorities if required by law. Your data is NEVER sold, rented, or used for marketing.
              </p>

              <p><strong>6. Security</strong></p>
              <p>
                All data is encrypted in transit (HTTPS/TLS) and at rest in our database.
                Access is restricted to authorized personnel via role-based access control.
                We conduct regular security audits and maintain an audit log of all data access.
              </p>

              <p><strong>7. Your Rights</strong></p>
              <p>
                You have the right to: (a) access, review, and download your data, (b) correct inaccurate data,
                (c) request deletion of your account and associated data, (d) withdraw consent for AI analysis,
                (e) lodge a complaint with relevant data protection authorities.
              </p>

              <p><strong>8. Synthetic Data Disclosure</strong></p>
              <p>
                This prototype system uses synthetic (simulated) data for AI model training and demonstration.
                The AI model is NOT clinically validated. This system is for research and prototyping only
                and does NOT replace professional medical evaluation.
              </p>

              <p><strong>9. Disclaimer</strong></p>
              <p>
                This is a clinical decision-support tool, not a medical device. AI outputs are estimates and
                recommendations, not diagnoses. A qualified healthcare professional retains full clinical
                responsibility. If you suspect a medical emergency, contact local emergency services immediately.
              </p>

              <p><strong>10. Contact & Questions</strong></p>
              <p>
                For privacy questions, data requests, or to file a complaint, contact our data protection officer
                at support@example.com or call +1-800-HEALTH-1.
              </p>

              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '1.5rem' }}>
                <em>Last updated: 10 October 2026</em>
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#991b1b',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem'
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Acceptance Checkbox */}
        <div style={{
          backgroundColor: '#fef9e7',
          border: '1px solid #fcd34d',
          borderRadius: '10px',
          padding: '1.25rem',
          marginBottom: '1.5rem'
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            cursor: 'pointer',
            fontSize: '0.9rem',
            color: '#78350f'
          }}>
            <input
              type="checkbox"
              checked={acceptedCheckbox}
              onChange={(e) => {
                setAcceptedCheckbox(e.target.checked);
                setError(''); // Clear error when user checks
              }}
              style={{
                marginTop: '0.25rem',
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                accentColor: '#0284c7'
              }}
            />
            <span>
              I have read and understand the privacy notice. I consent to the collection and AI processing of my
              health information as described above. I understand this is a prototype system and not a regulated
              medical device. <strong>I acknowledge that AI outputs are recommendations only, and I will seek
              professional medical evaluation for clinical decisions.</strong>
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <button
            onClick={handleDecline}
            disabled={submitting}
            style={{
              padding: '0.75rem 1.5rem',
              border: '2px solid #e5e7eb',
              backgroundColor: '#ffffff',
              color: '#475569',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.95rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
              transition: 'all 0.2s'
            }}
          >
            {submitting ? 'Recording...' : 'I Decline'}
          </button>

          <button
            onClick={handleAccept}
            disabled={!acceptedCheckbox || submitting}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: acceptedCheckbox && !submitting ? '#0284c7' : '#cbd5e1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.95rem',
              cursor: acceptedCheckbox && !submitting ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {submitting ? 'Recording...' : (
              <>
                <CheckCircle2 size={18} />
                Accept & Continue to Assessment
              </>
            )}
          </button>
        </div>

        {/* Footer Note */}
        <p style={{
          fontSize: '0.75rem',
          color: '#9ca3af',
          marginTop: '1.25rem',
          marginBottom: 0,
          lineHeight: '1.6'
        }}>
          By proceeding, you acknowledge that your consent is recorded with a timestamp for audit compliance.
          You may withdraw or change your consent preferences in your account settings at any time.
        </p>
      </div>
    </div>
  );
}
