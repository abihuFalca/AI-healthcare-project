import React from 'react';
import { Clock, ShieldAlert, ArrowLeft, RefreshCw, Stethoscope } from 'lucide-react';

export default function PendingDoctorView({ user, onRefresh, onLogout }) {
  const doc = user.doctor_profile || {};

  return (
    <div className="container" style={{ maxWidth: '640px', padding: '3rem 1rem' }}>
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem'
          }}
        >
          <Clock size={32} color="#d97706" />
        </div>

        <span
          style={{
            backgroundColor: '#fef3c7',
            color: '#b45309',
            border: '1px solid #fde68a',
            fontSize: '0.75rem',
            fontWeight: '800',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            textTransform: 'uppercase'
          }}
        >
          Verification In Progress (PRD AUTH-4, DOC-8)
        </span>

        <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', marginTop: '1rem', marginBottom: '0.5rem' }}>
          Clinician Account Verification In Progress
        </h2>

        <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: '1.5', marginBottom: '1.5rem' }}>
          Welcome, <strong>{doc.full_name || 'Clinician'}</strong>. Your professional license and institutional affiliation are currently being processed.
        </p>

        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1rem',
            textAlign: 'left',
            marginBottom: '1.5rem',
            fontSize: '0.85rem'
          }}
        >
          <div><strong>Professional ID / License:</strong> {doc.professional_id || 'Submitted'}</div>
          <div><strong>Hospital / Facility:</strong> {doc.hospital_name || 'Hospital Clinic'}</div>
          <div><strong>Department:</strong> {doc.department || 'Emergency Medicine'}</div>
          <div><strong>Role:</strong> {doc.professional_role || 'Resident'}</div>
        </div>

        <div
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '0.875rem',
            fontSize: '0.8rem',
            color: '#1e40af',
            marginBottom: '1.5rem',
            textAlign: 'left'
          }}
        >
          🔒 <strong>Privacy & Governance Guarantee:</strong> In compliance with clinical regulatory requirements, protected health information (PHI) and patient triage records remain locked until clinical credentials are fully verified.
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button onClick={onRefresh} className="btn btn-primary">
            <RefreshCw size={16} /> Refresh Verification Status
          </button>
          <button onClick={onLogout} className="btn btn-outline">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
