import React, { useState, useEffect } from 'react';
import {
  Users, AlertOctagon, Clock, CheckCircle2, Search,
  ArrowRight, ShieldAlert, Filter, Activity, Stethoscope
} from 'lucide-react';
import RiskBadge from '../components/RiskBadge';

export default function DoctorDashboard({ user, token, onSelectPatient }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/doctor/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Doctor dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '3rem', textAlign: 'center' }}>
        <Activity size={32} color="#0284c7" className="animate-spin" />
        <p style={{ marginTop: '0.75rem', color: '#64748b' }}>Loading Clinician Triage Dashboard...</p>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const queue = (data?.priority_queue || []).filter(item => {
    if (!filterQuery) return true;
    return item.patient_name.toLowerCase().includes(filterQuery.toLowerCase());
  });

  return (
    <div className="container">
      {/* Clinician Welcome Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #082f49, #0f766e)',
          color: '#ffffff',
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
            <Stethoscope size={18} color="#38bdf8" />
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#7dd3fc', textTransform: 'uppercase' }}>
              Clinical Decision Support & Prioritisation
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800' }}>
            {user.doctor_profile?.full_name || user.email?.split('@')[0] || 'Clinician Portal'}
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#bae6fd' }}>
            {user.doctor_profile?.professional_role || 'Healthcare Clinician'}{user.doctor_profile?.hospital_name ? ` · ${user.doctor_profile.hospital_name}` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(8px)',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.2)',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#bae6fd', textTransform: 'uppercase' }}>Queue Urgency</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffffff' }}>Active Prioritisation</div>
          </div>
        </div>
      </div>

      {/* KPI Metrics Cards (DOC-1) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: '#e0f2fe', padding: '0.75rem', borderRadius: '10px' }}>
            <Users size={24} color="#0284c7" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>TOTAL PATIENTS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{metrics.total_patients ?? 0}</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: '#fef3c7', padding: '0.75rem', borderRadius: '10px' }}>
            <Clock size={24} color="#d97706" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>PENDING REVIEWS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#b45309' }}>{metrics.pending_reviews ?? 0}</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: '#fee2e2', padding: '0.75rem', borderRadius: '10px' }}>
            <AlertOctagon size={24} color="#dc2626" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>HIGH-RISK PATIENTS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#dc2626' }}>{metrics.high_risk_count ?? 0}</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: '#fef9c3', padding: '0.75rem', borderRadius: '10px' }}>
            <Activity size={24} color="#ca8a04" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>MODERATE RISK</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#854d0e' }}>{metrics.moderate_risk_count ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Prioritised High-Risk & Urgent Patient Queue Table (DOC-1, DOC-3) */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a' }}>
              Prioritised High-Risk & Urgent Triage Queue
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Sorted deterministically by Emergency Safety Flag, Triage Urgency, and Risk Score (DOC-3).
            </p>
          </div>

          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search patient name..."
              className="form-input"
              style={{ paddingLeft: '32px', fontSize: '0.825rem' }}
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
            />
          </div>
        </div>

        {queue.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            No high-risk patients currently waiting in queue.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Urgency / Priority</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Patient Name</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>AI Risk Score</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Key Vitals</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Review Status</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Submitted At</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Clinical Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((row, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: row.safety_rule_triggered ? '#fef2f2' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <RiskBadge
                        level={row.risk_level}
                        isEmergency={row.safety_rule_triggered}
                        size="sm"
                      />
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <div style={{ fontWeight: '700', color: '#0f172a' }}>{row.patient_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {row.gender} · {row.date_of_birth ? `${new Date().getFullYear() - new Date(row.date_of_birth).getFullYear()} yrs` : '58 yrs'}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: '800',
                          color: row.risk_score >= 70 ? '#dc2626' : '#d97706'
                        }}
                      >
                        {row.risk_score}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>/100</span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem' }}>
                      <div>BP: <strong>{row.systolic_bp || '--'}/{row.diastolic_bp || '--'}</strong></div>
                      <div style={{ color: '#64748b' }}>HR: {row.heart_rate || '--'} · SpO₂: {row.spo2 || '--'}%</div>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '9999px',
                          backgroundColor: row.review_status === 'REVIEWED' ? '#dcfce7' : '#fef3c7',
                          color: row.review_status === 'REVIEWED' ? '#15803d' : '#b45309'
                        }}
                      >
                        {row.review_status || 'PENDING'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#64748b', fontSize: '0.75rem' }}>
                      {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                      <button
                        onClick={() => onSelectPatient(row.patient_id, row.assessment_id)}
                        className="btn btn-primary btn-sm"
                      >
                        Review Patient <ArrowRight size={14} />
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
