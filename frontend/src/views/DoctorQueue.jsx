import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertOctagon, ArrowRight, Search, Activity, ArrowLeft } from 'lucide-react';
import RiskBadge from '../components/RiskBadge';

export default function DoctorQueue({ token, onSelectPatient, onBack }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      const res = await fetch('/api/doctor/high-risk', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setQueue(json.high_risk_queue || []);
      }
    } catch (err) {
      console.error('Queue error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredQueue = queue.filter(item => {
    if (!query) return true;
    return item.patient_name.toLowerCase().includes(query.toLowerCase()) ||
           (item.symptom_text && item.symptom_text.toLowerCase().includes(query.toLowerCase()));
  });

  return (
    <div className="container">
      <button
        onClick={onBack}
        className="btn btn-outline btn-sm"
        style={{ marginBottom: '1.25rem' }}
      >
        <ArrowLeft size={16} /> Back to Doctor Dashboard
      </button>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <ShieldAlert size={20} color="#dc2626" />
              <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>
                Dedicated High-Risk & Emergency Triage Queue (DOC-3)
              </h1>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Real-time clinician triage prioritisation stream sorted strictly by clinical urgency, risk score, and waiting time.
            </p>
          </div>

          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search high-risk patient..."
              className="form-input"
              style={{ paddingLeft: '32px', fontSize: '0.825rem' }}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            <Activity size={24} className="animate-spin" color="#0284c7" />
            <p style={{ marginTop: '0.5rem' }}>Loading high risk assessments...</p>
          </div>
        ) : filteredQueue.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            No high-risk patients currently waiting in queue.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredQueue.map((item, idx) => (
              <div
                key={idx}
                style={{
                  border: item.safety_rule_triggered ? '2px solid #ef4444' : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  backgroundColor: item.safety_rule_triggered ? '#fff5f5' : '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <RiskBadge
                      level={item.risk_level}
                      isEmergency={item.safety_rule_triggered}
                      size="md"
                    />
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>
                      Priority: {item.triage_level}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a' }}>
                    {item.patient_name}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#475569', fontStyle: 'italic', margin: '0.35rem 0' }}>
                    "{item.symptom_text || 'Reported acute symptoms'}"
                  </p>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    BP: <strong>{item.systolic_bp}/{item.diastolic_bp} mmHg</strong> · HR: <strong>{item.heart_rate} bpm</strong> · SpO₂: <strong>{item.spo2}%</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#dc2626' }}>
                      {item.risk_score}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>RISK SCORE</div>
                  </div>

                  <button
                    onClick={() => onSelectPatient(item.patient_id, item.assessment_id)}
                    className="btn btn-primary"
                  >
                    Open Clinical Review <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
