import React from 'react';
import {
  ShieldAlert, AlertTriangle, CheckCircle, PhoneCall,
  Calendar, FileText, ArrowLeft, RefreshCw, UserCheck, Stethoscope
} from 'lucide-react';
import RiskBadge from '../components/RiskBadge';
import RiskScoreGauge from '../components/RiskScoreGauge';
import ExplainabilityCard from '../components/ExplainabilityCard';
import AssessmentExplanation from '../components/AssessmentExplanation';
import PatientAssistant from '../components/PatientAssistant';

export default function AssessmentResultView({ result, onBack, onNewAssessment }) {
  if (!result) return null;

  const isEmergency = result.safety_rule_triggered || result.triage_level === 'EMERGENCY';
  const isHigh = result.risk_level === 'HIGH';

  return (
    <div className="container" style={{ maxWidth: '860px' }}>
      {/* Back button */}
      <button
        onClick={onBack}
        className="btn btn-outline btn-sm"
        style={{ marginBottom: '1.25rem' }}
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      {/* Prominent Emergency Safety Banner (PRD Section 6.8 RES-3 & Section 8.1) */}
      {isEmergency && (
        <div
          className="emergency-pulse"
          style={{
            backgroundColor: '#991b1b',
            color: '#ffffff',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            border: '2px solid #ef4444',
            boxShadow: '0 10px 25px -5px rgba(220, 38, 38, 0.4)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <ShieldAlert size={36} color="#fca5a5" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.35rem' }}>
                <span
                  style={{
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    letterSpacing: '0.05em'
                  }}
                >
                  CRITICAL CLINICAL OVERRIDE
                </span>
                <span style={{ fontSize: '0.85rem', color: '#fecaca', fontWeight: '600' }}>
                  Safety Rules Engine Triggered
                </span>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', lineHeight: '1.3', marginBottom: '0.5rem' }}>
                Seek Immediate Emergency Medical Attention
              </h2>
              <p style={{ fontSize: '0.95rem', color: '#fef2f2', lineHeight: '1.5', marginBottom: '1rem' }}>
                {result.recommendation}
              </p>

              {result.safety_rule_details && result.safety_rule_details.length > 0 && (
                <div style={{ backgroundColor: 'rgba(0,0,0,0.25)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#fca5a5', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    Triggered Clinical Safety Criteria:
                  </div>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#fecaca' }}>
                    {result.safety_rule_details.map((rule, idx) => (
                      <li key={idx} style={{ marginBottom: '0.2rem' }}>{rule}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <a
                  href="tel:911"
                  className="btn"
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#991b1b',
                    fontWeight: '800',
                    fontSize: '0.95rem',
                    padding: '0.65rem 1.25rem'
                  }}
                >
                  <PhoneCall size={18} /> Call Emergency Services (911 / 112)
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Result Card (PRD RES-1) */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                Clinical Assessment ID #{result.assessment_id || result.id || 'N/A'} · {new Date(result.created_at || Date.now()).toLocaleTimeString()}
              </span>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: '#0f172a', marginTop: '0.2rem' }}>
                {result.headline || "AI identified an elevated risk pattern based on the information provided."}
              </h2>
            </div>
            <RiskBadge level={result.risk_level} isEmergency={isEmergency} size="lg" />
          </div>
        </div>

        {/* Score & Urgency Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          {/* Calibrated Risk Score Gauge */}
          <div
            style={{
              padding: '1.25rem',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Calibrated Risk Score
            </span>
            <RiskScoreGauge score={result.risk_score} level={result.risk_level} triage={result.triage_level} />
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
              Model Version: <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{result.model_version || 'rf-0.1.0'}</span>
            </div>
          </div>

          {/* Recommended Next Step & Triage Priority */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                padding: '1.25rem',
                borderRadius: '12px',
                backgroundColor: isHigh || isEmergency ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${isHigh || isEmergency ? '#fecaca' : '#bbf7d0'}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Calendar size={18} color={isHigh || isEmergency ? '#dc2626' : '#16a34a'} />
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    color: isHigh || isEmergency ? '#991b1b' : '#166534'
                  }}
                >
                  Triage Priority: {result.triage_level || 'IMMEDIATE'}
                </span>
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: isHigh || isEmergency ? '#991b1b' : '#14532d', marginBottom: '0.5rem' }}>
                {result.urgency_label || 'Immediate Clinical Assessment'}
              </h4>
              <p style={{ fontSize: '0.875rem', color: isHigh || isEmergency ? '#7f1d1d' : '#166534', lineHeight: '1.5' }}>
                {result.recommendation}
              </p>
            </div>

            {/* Quick Action Buttons (PRD RES-2) */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => alert("Connecting you with St. Jude Hospital Emergency Triage Desk...")}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                <PhoneCall size={16} /> Contact Healthcare Facility
              </button>
              <button
                onClick={onNewAssessment}
                className="btn btn-outline"
              >
                <RefreshCw size={16} /> New Assessment
              </button>
            </div>
          </div>
        </div>

        {/* Explainability Breakdown (SHAP-compatible) */}
        <ExplainabilityCard
          factors={result.factors}
          rawData={{
            symptoms: result.combined_symptoms || result.symptoms_json,
            duration: result.duration,
            vitals: result.vitals || result.vitals_snapshot
          }}
          review={result.review}
        />

        {/* LLM-Generated Plain Language Explanation (Phase 3 Track A) */}
        <AssessmentExplanation
          riskScore={result.risk_score}
          riskLevel={result.risk_level}
          triageLevel={result.triage_level}
          shapFeatures={result.factors}
          age={result.age}
          symptoms={result.combined_symptoms || result.symptoms_json}
          token={localStorage.getItem('med_token')}
        />

        {/* Symptoms picked up by the AI reader that the keyword parser missed */}
        {result.ai_extracted_symptoms?.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: '#334155' }}>
            <strong>AI also noticed in your description:</strong> {result.ai_extracted_symptoms.join(', ')}.
            These were included in your assessment.
          </div>
        )}

        {/* Patient AI assistant: questions about this result */}
        <PatientAssistant
          assessmentId={result.assessment_id || result.id}
          token={localStorage.getItem('med_token')}
        />

        {/* Mandatory Clinical Disclaimer (PRD Section 6.7 & Appendix B) */}
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: '#f1f5f9',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '0.775rem',
            color: '#475569',
            lineHeight: '1.5'
          }}
        >
          <strong>Mandatory Regulatory & Clinical Disclaimer:</strong> {result.disclaimer || "This result is an AI-assisted risk assessment and does not constitute a medical diagnosis. A qualified healthcare professional should make the final decision. If you think you are having a medical emergency, contact local emergency services immediately."}
        </div>
      </div>
    </div>
  );
}
