import React from 'react';
import { HelpCircle, Stethoscope, UserCheck, Activity, AlertCircle } from 'lucide-react';

export default function ExplainabilityCard({ factors = [], rawData = {}, review = null }) {
  const importanceBadges = {
    high: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', label: 'High Influence' },
    medium: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d', label: 'Moderate Influence' },
    low: { bg: '#e0f2fe', text: '#075985', border: '#bae6fd', label: 'Low Influence' }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Model-Derived Factors (PRD Section 6.6) */}
      <div className="card" style={{ borderColor: '#cbd5e1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Activity size={20} color="#0284c7" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>
            AI-Identified Risk Drivers & Factor Attribution (SHAP)
          </h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
          The machine learning pipeline evaluated following clinical features from your submission as the primary drivers of this risk score:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {(!factors || factors.length === 0) ? (
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', fontStyle: 'italic' }}>
              Standard baseline risk calculation. No acute individual high-influence anomalies identified.
            </p>
          ) : (
            factors.map((f, idx) => {
              const imp = importanceBadges[f.importance] || importanceBadges.medium;
              const formattedContribution = f.contribution > 0 ? `+${f.contribution}` : `${f.contribution}`;
              return (
                <div
                  key={idx}
                  style={{
                    padding: '0.875rem 1rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: '700', fontSize: '0.925rem', color: '#1e293b' }}>
                        {f.label || f.feature}
                      </span>
                      <span
                        style={{
                          backgroundColor: imp.bg,
                          color: imp.text,
                          border: `1px solid ${imp.border}`,
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '9999px'
                        }}
                      >
                        {imp.label}
                      </span>
                    </div>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        color: f.contribution > 0 ? '#b91c1c' : '#059669',
                        backgroundColor: '#ffffff',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      SHAP: {formattedContribution}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: '1.4' }}>
                    {f.explanation_text}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Patient-Provided Information ("What you told us") */}
      {rawData && Object.keys(rawData).length > 0 && (
        <div className="card" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <UserCheck size={18} color="#0f766e" />
            <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>
              What You Provided (Assessment Snapshot)
            </h4>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {rawData.symptoms && (
              <div style={{ backgroundColor: '#f8fafc', padding: '0.625rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Reported Symptoms</span>
                <p style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a' }}>
                  {Array.isArray(rawData.symptoms) ? rawData.symptoms.join(', ') : rawData.symptoms}
                </p>
              </div>
            )}
            {rawData.duration && (
              <div style={{ backgroundColor: '#f8fafc', padding: '0.625rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Duration</span>
                <p style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a' }}>{rawData.duration}</p>
              </div>
            )}
            {rawData.vitals && (
              <div style={{ backgroundColor: '#f8fafc', padding: '0.625rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Recorded Vitals</span>
                <p style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a' }}>
                  BP: {rawData.vitals.systolic_bp || '--'}/{rawData.vitals.diastolic_bp || '--'} · HR: {rawData.vitals.heart_rate || '--'} bpm · SpO₂: {rawData.vitals.spo2 || '--'}%
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Clinical Review (Doctor Attributed, DOC-6, RES-1) */}
      {review && (
        <div
          className="card"
          style={{
            backgroundColor: '#f0fdf4',
            borderColor: '#86efac',
            borderLeftWidth: '5px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Stethoscope size={18} color="#15803d" />
              <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#166534' }}>
                Healthcare Clinician Review & Confirmation
              </h4>
            </div>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: '700',
                padding: '0.2rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: review.review_status === 'REVIEWED' ? '#dcfce7' : '#fef3c7',
                color: review.review_status === 'REVIEWED' ? '#166534' : '#92400e'
              }}
            >
              Status: {review.review_status}
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#14532d', marginBottom: '0.5rem' }}>
            {review.clinical_notes || "Clinician confirmed triage priority. No supplementary notes recorded."}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#4ade80' }}>
            <span>Reviewed by: {review.doctor_name || "Assigned Triage Physician"}</span>
            {review.reviewed_at && <span>{new Date(review.reviewed_at).toLocaleDateString()}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
