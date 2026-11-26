import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Activity, Heart, ShieldAlert, CheckCircle,
  Stethoscope, Clock, AlertTriangle, FileText, Send
} from 'lucide-react';
import RiskBadge from '../components/RiskBadge';
import RiskScoreGauge from '../components/RiskScoreGauge';
import ExplainabilityCard from '../components/ExplainabilityCard';
import AiCaseSummary from '../components/AiCaseSummary';
import { RiskTimelineChart, VitalTrendsChart } from '../components/Charts';

export default function DoctorPatientReview({ patientId, assessmentId, token, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewStatus, setReviewStatus] = useState('REVIEWED');
  const [finalTriage, setFinalTriage] = useState('EMERGENCY');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchPatient();
  }, [patientId]);

  const fetchPatient = async () => {
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        // Pre-fill triage status with current assessment triage level
        if (json.assessments && json.assessments.length > 0) {
          const latest = json.assessments[0];
          setFinalTriage(latest.triage_level || 'IMMEDIATE');
          if (latest.clinical_notes) setReviewNote(latest.clinical_notes);
        }
      }
    } catch (err) {
      console.error('Fetch patient error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!latestAsm) return;
    setSubmitting(true);
    setSuccessMsg('');
    try {
      const res = await fetch('/api/doctor/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          assessment_id: latestAsm.id,
          review_status: reviewStatus,
          clinical_notes: reviewNote,
          final_triage_status: finalTriage
        })
      });
      if (res.ok) {
        setSuccessMsg('Clinical review and triage decision successfully saved. Patient notified.');
        fetchPatient();
      }
    } catch (err) {
      console.error('Submit review error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '3rem', textAlign: 'center' }}>
        <Activity size={32} color="#0284c7" className="animate-spin" />
        <p style={{ marginTop: '0.75rem', color: '#64748b' }}>Loading Patient Health Records & AI Evidence...</p>
      </div>
    );
  }

  const profile = data?.profile || {};
  const assessments = data?.assessments || [];
  const latestAsm = assessments[0];
  const factors = data?.latest_factors || [];

  return (
    <div className="container" style={{ maxWidth: '960px' }}>
      <button
        onClick={onBack}
        className="btn btn-outline btn-sm"
        style={{ marginBottom: '1.25rem' }}
      >
        <ArrowLeft size={16} /> Back to Doctor Dashboard
      </button>

      {/* Patient Header Card */}
      <div className="card" style={{ marginBottom: '1.5rem', background: '#ffffff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#0369a1', textTransform: 'uppercase' }}>
                Patient ID: #{profile.id}
              </span>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>
              {profile.full_name}
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {profile.gender} · {profile.date_of_birth} · BMI: {profile.bmi || '27.1'} kg/m² · Preferred Language: {profile.preferred_language || 'English'}
            </p>
          </div>

          {latestAsm && (
            <div style={{ textAlign: 'right' }}>
              <RiskBadge
                level={latestAsm.risk_level}
                isEmergency={latestAsm.safety_rule_triggered}
                size="lg"
              />
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                AI Score: <strong>{latestAsm.risk_score}/100</strong> (Triage: {latestAsm.triage_level})
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid: Patient Background & Latest Assessment Evidence */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Background & Chronic History */}
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.75rem' }}>
            Medical History & Active Regimen
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: '0.85rem' }}>
            <div>
              <span style={{ fontWeight: '600', color: '#475569' }}>Chronic Conditions: </span>
              <span style={{ color: '#0f172a' }}>
                {data.medical_history?.map(h => h.condition).join(', ') || 'None recorded'}
              </span>
            </div>
            <div>
              <span style={{ fontWeight: '600', color: '#475569' }}>Active Medications: </span>
              <span style={{ color: '#0f172a' }}>
                {data.medications?.map(m => `${m.medication_name} ${m.dosage || ''}`).join(', ') || 'None recorded'}
              </span>
            </div>
            <div>
              <span style={{ fontWeight: '600', color: '#475569' }}>Risk Factors: </span>
              <span style={{ color: '#0f172a' }}>
                {data.risk_factors?.map(r => `${r.factor_type}: ${r.value}`).join(', ') || 'None recorded'}
              </span>
            </div>
            <div>
              <span style={{ fontWeight: '600', color: '#475569' }}>Emergency Contact: </span>
              <span style={{ color: '#0f172a' }}>{profile.emergency_contact || 'None'}</span>
            </div>
          </div>
        </div>

        {/* Latest Assessment Raw Evidence */}
        {latestAsm && (
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.75rem' }}>
              Latest Presenting Complaint & Vitals
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: '0.85rem' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '0.625rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>RAW SYMPTOMS VERBATIM</span>
                <p style={{ fontStyle: 'italic', color: '#1e293b', marginTop: '0.2rem' }}>
                  "{latestAsm.symptom_text || 'None'}"
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                <div>BP: <strong>{latestAsm.systolic_bp}/{latestAsm.diastolic_bp} mmHg</strong></div>
                <div>Heart Rate: <strong>{latestAsm.heart_rate} bpm</strong></div>
                <div>SpO₂: <strong>{latestAsm.spo2}%</strong></div>
                <div>Temperature: <strong>{latestAsm.temperature || '--'}°C</strong></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LLM case summary for the reviewing clinician */}
      {latestAsm && <AiCaseSummary assessmentId={latestAsm.id} token={token} />}

      {/* Explainable AI Factor Attribution (PRD 6.6) */}
      <div style={{ marginBottom: '1.5rem' }}>
        <ExplainabilityCard
          factors={factors}
          rawData={{
            symptoms: latestAsm ? latestAsm.symptoms_json : [],
            duration: latestAsm ? latestAsm.duration : '3 hours',
            vitals: latestAsm
          }}
        />
      </div>

      {/* Longitudinal Risk Score Timeline (DOC-7) */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.75rem' }}>
          Longitudinal Risk & Vitals Timeline
        </h3>
        <RiskTimelineChart data={assessments.slice().reverse()} />
      </div>

      {/* Clinician Review & Override Action Box (DOC-5, DOC-6) */}
      <div
        className="card"
        style={{
          border: '2px solid #0284c7',
          backgroundColor: '#f0f9ff'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Stethoscope size={20} color="#0369a1" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0c4a6e' }}>
            Clinician Review & Triage Override (DOC-5, DOC-6)
          </h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#0369a1', marginBottom: '1.25rem' }}>
          Clinician decisions are stored as a distinct review record. The original AI output remains immutable and permanently transparent.
        </p>

        {successMsg && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#dcfce7',
              border: '1px solid #86efac',
              borderRadius: '8px',
              color: '#15803d',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: '600'
            }}
          >
            <CheckCircle size={16} />
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmitReview}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label className="form-label">Review Status State (DOC-5)</label>
              <select
                className="form-input"
                value={reviewStatus}
                onChange={e => setReviewStatus(e.target.value)}
              >
                <option value="PENDING">PENDING - Awaiting Further Action</option>
                <option value="REVIEWED">REVIEWED - Confirmed by Clinician</option>
                <option value="ESCALATED">ESCALATED - Transferred to Specialist / ER</option>
                <option value="CLOSED">CLOSED - Case Completed</option>
              </select>
            </div>

            <div>
              <label className="form-label">Confirmed / Overridden Triage Priority</label>
              <select
                className="form-input"
                value={finalTriage}
                onChange={e => setFinalTriage(e.target.value)}
              >
                <option value="EMERGENCY">EMERGENCY (Immediate 911 / ER Transfer)</option>
                <option value="IMMEDIATE">IMMEDIATE (Clinical evaluation within 1-2 hours)</option>
                <option value="PROMPT">PROMPT (Consultation within 24-48 hours)</option>
                <option value="ROUTINE">ROUTINE (Standard monitoring / outpatient care)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Clinical Impression & Physician Notes *</label>
            <textarea
              className="form-input"
              rows="3"
              required
              placeholder="e.g. Acute presentation consistent with cardiac ischemia pattern. Patient advised to proceed to ER immediately. Cardiology team notified."
              value={reviewNote}
              onChange={e => setReviewNote(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
            >
              <Send size={16} />
              {submitting ? 'Recording Review...' : 'Submit Clinical Review & Notify Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
