import React, { useState, useEffect } from 'react';
import {
  Heart, Activity, Calendar, ArrowRight, ShieldCheck,
  TrendingUp, PlusCircle, UserCheck, AlertTriangle
} from 'lucide-react';
import RiskBadge from '../components/RiskBadge';
import { RiskTimelineChart, VitalTrendsChart } from '../components/Charts';

export default function PatientDashboard({ user, token, onStartAssessment, onViewResult }) {
  const [profileData, setProfileData] = useState(null);
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const [resProfile, resTimeline] = await Promise.all([
        fetch('/api/patients/me', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/patients/me/risk-timeline', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (resProfile.ok) {
        const p = await resProfile.json();
        setProfileData(p);
      }
      if (resTimeline.ok) {
        const t = await resTimeline.json();
        setTimelineData(t.timeline || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '3rem', textAlign: 'center' }}>
        <Activity size={32} color="#0284c7" className="animate-spin" />
        <p style={{ marginTop: '0.75rem', color: '#64748b' }}>Loading Patient Health Records...</p>
      </div>
    );
  }

  const p = profileData?.profile || {};
  const latest = profileData?.latest_assessment;

  return (
    <div className="container">
      {/* Welcome Banner (PRD PAT-1) */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #ffffff, #f0f9ff)',
          borderColor: '#bae6fd',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#0369a1', textTransform: 'uppercase' }}>
              Patient Health Portal
            </span>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a' }}>
            Welcome, {p.full_name || 'Patient'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
            AegisAI Early-Risk Detection & Patient Triage System
          </p>
        </div>

        <button
          onClick={onStartAssessment}
          className="btn btn-primary"
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '0.95rem',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
          }}
        >
          <PlusCircle size={18} /> Start New Assessment
        </button>
      </div>

      {/* Grid: Current Risk Badge & Health Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Current Risk Badge Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Current Triage Status
            </span>
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <RiskBadge
                level={latest ? latest.risk_level : 'LOW'}
                isEmergency={latest?.safety_rule_triggered}
                size="lg"
              />
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <span style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a' }}>
                {latest ? `${latest.risk_score}` : '--'}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: '4px' }}>
                / 100 Risk Score
              </span>
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
            Last assessed: {latest ? new Date(latest.created_at).toLocaleDateString() : 'No assessment yet'}
          </div>
        </div>

        {/* Vital Signs Overview Card */}
        <div className="card">
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
            Latest Physiological Vitals
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Blood Pressure</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>
                {latest?.systolic_bp ? `${latest.systolic_bp}/${latest.diastolic_bp}` : '--'} <span style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>mmHg</span>
              </div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Heart Rate</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>
                {latest?.heart_rate ? `${latest.heart_rate}` : '--'} <span style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>bpm</span>
              </div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Oxygen (SpO₂)</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>
                {latest?.spo2 ? `${latest.spo2}` : '--'} <span style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>%</span>
              </div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Calculated BMI</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>
                {p.bmi ? `${p.bmi}` : '--'} <span style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>kg/m²</span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile & History Snapshot */}
        <div className="card">
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
            Medical Profile Summary
          </span>
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.825rem' }}>
            <div><strong>Age:</strong> {p.date_of_birth ? `${new Date().getFullYear() - new Date(p.date_of_birth).getFullYear()} yrs` : '--'} ({p.gender || 'Not specified'})</div>
            <div><strong>Active Conditions:</strong> {profileData?.medical_history && profileData.medical_history.length > 0 ? profileData.medical_history.map(h => h.condition).join(', ') : 'None recorded'}</div>
            <div><strong>Medications:</strong> {profileData?.medications && profileData.medications.length > 0 ? profileData.medications.map(m => m.medication_name).join(', ') : 'None recorded'}</div>
            <div><strong>Emergency Contact:</strong> {p.emergency_contact || 'None registered'}</div>
          </div>
        </div>
      </div>

      {/* Risk Score Longitudinal Timeline Chart (PRD 6.11 VIS-1) */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>
              Longitudinal Risk Score Progression
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Chronological score changes mapped against clinical risk threshold bands (0–39 Low, 40–69 Moderate, 70–100 High).
            </p>
          </div>
        </div>
        <RiskTimelineChart data={timelineData} />
      </div>

      {/* Vital Trends (PRD VIS-2) */}
      {timelineData.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.75rem' }}>
            Recorded Vital Signs History
          </h3>
          <VitalTrendsChart data={timelineData} />
        </div>
      )}

      {/* Recent Assessments Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>
            Recent Health Assessments
          </h3>
        </div>

        {timelineData.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No recorded assessments found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Date</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Risk Score</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Risk Level</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Triage Priority</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Recommendation</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {timelineData.slice().reverse().map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#1e293b', fontWeight: '600' }}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: '800' }}>
                      {item.risk_score} / 100
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <RiskBadge level={item.risk_level} isEmergency={item.safety_rule_triggered} size="sm" />
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600', color: '#475569' }}>
                      {item.triage_level}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#64748b', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.recommendation || 'Standard monitoring'}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                      <button
                        onClick={() => onViewResult(item.id)}
                        className="btn btn-outline btn-sm"
                      >
                        View AI Details <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
