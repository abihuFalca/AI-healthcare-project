import React, { useState } from 'react';
import {
  Shield, User, Stethoscope, Lock, Mail, Phone,
  ArrowRight, Sparkles, CheckCircle2, AlertCircle, HeartPulse
} from 'lucide-react';

export default function LoginView({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // login, register_patient, register_doctor
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Patient Registration Form
  const [patForm, setPatForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    date_of_birth: '1985-05-15',
    gender: 'Female',
    height: 165,
    weight: 65,
    preferred_language: 'English',
    emergency_contact: ''
  });

  // Doctor Registration Form
  const [docForm, setDocForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    professional_role: 'Emergency Medicine Physician',
    professional_id: 'MD-2026-',
    hospital_name: 'City General Hospital',
    department: 'Emergency & Acute Care'
  });

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginInput, password: password })
      });
      
      // Handle non-OK status codes
      if (!res.ok) {
        let errorDetail = 'Login failed';
        try {
          const errorData = await res.json();
          errorDetail = errorData.detail || errorDetail;
        } catch (e) {
          // Response wasn't valid JSON, use default error
        }
        throw new Error(errorDetail);
      }

      // Parse response safely
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error('Server response was not valid JSON. Please check your connection and try again.');
      }

      // Validate required fields in response
      if (!data.access_token || !data.user) {
        throw new Error('Invalid login response from server');
      }

      onLoginSuccess(data.user, data.access_token);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (email, pwd) => {
    setLoginInput(email);
    setPassword(pwd);
    // Submit automatically
    setLoading(true);
    setError('');
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: email, password: pwd })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(e => { throw new Error(e.detail || 'Login failed'); });
        }
        return res.json().catch(err => {
          throw new Error('Server response was not valid JSON');
        });
      })
      .then(data => {
        if (!data.access_token || !data.user) {
          throw new Error('Invalid login response from server');
        }
        onLoginSuccess(data.user, data.access_token);
      })
      .catch(err => setError(err.message || 'An unexpected error occurred'))
      .finally(() => setLoading(false));
  };

  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patForm)
      });
      if (!res.ok) {
        let errorDetail = 'Registration failed';
        try {
          const errorData = await res.json();
          errorDetail = errorData.detail || errorDetail;
        } catch (e) {
          // Response wasn't valid JSON
        }
        throw new Error(errorDetail);
      }
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error('Server response was not valid JSON');
      }
      onLoginSuccess(data.user, data.access_token);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterDoctor = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register-doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docForm)
      });
      if (!res.ok) {
        let errorDetail = 'Clinician registration failed';
        try {
          const errorData = await res.json();
          errorDetail = errorData.detail || errorDetail;
        } catch (e) {
          // Response wasn't valid JSON
        }
        throw new Error(errorDetail);
      }
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error('Server response was not valid JSON');
      }
      onLoginSuccess(data.user, data.access_token);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      {/* Top Banner with Clinical Positioning (PRD Page 1 & Table of Contents) */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a, #0c4a6e)',
          color: '#ffffff',
          padding: '1.25rem 2rem',
          borderBottom: '1px solid #1e293b'
        }}
      >
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ backgroundColor: '#0284c7', padding: '0.5rem', borderRadius: '10px' }}>
              <HeartPulse size={26} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
                AegisAI Clinical Decision Support
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                AI Early-Risk Detection & Patient Triage System · PRD v1.0
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: '0.75rem',
              color: '#bae6fd',
              backgroundColor: 'rgba(2, 132, 199, 0.2)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '0.35rem 0.75rem',
              borderRadius: '9999px'
            }}
          >
            🛡️ Safety-First: Deterministic Rules & Explainable SHAP
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ width: '100%', maxWidth: '560px' }}>
          {/* Quick Demo Logins Box (One-Click instant role access) */}
          <div
            className="card"
            style={{
              marginBottom: '1.5rem',
              background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
              borderColor: '#7dd3fc',
              padding: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
              <Sparkles size={18} color="#0284c7" />
              <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase' }}>
                Instant Demo Evaluation Accounts
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => handleQuickLogin('patient@demo.com', 'demo123')}
                className="btn btn-outline"
                style={{ padding: '0.5rem', fontSize: '0.775rem', textAlign: 'left', justifyContent: 'flex-start' }}
              >
                <User size={14} color="#0284c7" />
                <div>
                  <strong>Patient (John Doe)</strong>
                  <div style={{ fontSize: '0.675rem', color: '#64748b' }}>58yo, Hypertension</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('doctor@hospital.com', 'demo123')}
                className="btn btn-outline"
                style={{ padding: '0.5rem', fontSize: '0.775rem', textAlign: 'left', justifyContent: 'flex-start' }}
              >
                <Stethoscope size={14} color="#0f766e" />
                <div>
                  <strong>Doctor (Dr. Sarah Chen)</strong>
                  <div style={{ fontSize: '0.675rem', color: '#64748b' }}>Approved Lead Clinician</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('admin@healthsystem.org', 'demo123')}
                className="btn btn-outline"
                style={{ padding: '0.5rem', fontSize: '0.775rem', textAlign: 'left', justifyContent: 'flex-start' }}
              >
                <Shield size={14} color="#6d28d9" />
                <div>
                  <strong>Admin System</strong>
                  <div style={{ fontSize: '0.675rem', color: '#64748b' }}>Logs, Approvals & Config</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('newdoc@clinic.com', 'demo123')}
                className="btn btn-outline"
                style={{ padding: '0.5rem', fontSize: '0.775rem', textAlign: 'left', justifyContent: 'flex-start' }}
              >
                <Stethoscope size={14} color="#d97706" />
                <div>
                  <strong>Pending Doctor</strong>
                  <div style={{ fontSize: '0.675rem', color: '#b45309' }}>Awaiting Admin Approval</div>
                </div>
              </button>
            </div>
          </div>

          {/* Main Auth Card */}
          <div className="card">
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: 'none',
                  borderBottom: `3px solid ${activeTab === 'login' ? '#0284c7' : 'transparent'}`,
                  backgroundColor: 'transparent',
                  fontWeight: activeTab === 'login' ? '700' : '500',
                  color: activeTab === 'login' ? '#0284c7' : '#64748b',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('register_patient')}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: 'none',
                  borderBottom: `3px solid ${activeTab === 'register_patient' ? '#0284c7' : 'transparent'}`,
                  backgroundColor: 'transparent',
                  fontWeight: activeTab === 'register_patient' ? '700' : '500',
                  color: activeTab === 'register_patient' ? '#0284c7' : '#64748b',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                New Patient
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('register_doctor')}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: 'none',
                  borderBottom: `3px solid ${activeTab === 'register_doctor' ? '#0284c7' : 'transparent'}`,
                  backgroundColor: 'transparent',
                  fontWeight: activeTab === 'register_doctor' ? '700' : '500',
                  color: activeTab === 'register_doctor' ? '#0284c7' : '#64748b',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Clinician Join
              </button>
            </div>

            {error && (
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#991b1b',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* TAB: LOGIN (AUTH-1) */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Email Address or Phone Number</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="Enter your email address or phone number"
                    value={loginInput}
                    onChange={e => setLoginInput(e.target.value)}
                  />
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Account Password</label>
                  <input
                    type="password"
                    required
                    className="form-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.75rem' }}
                >
                  {loading ? 'Authenticating...' : 'Sign In to Portal'}
                  <ArrowRight size={16} />
                </button>
              </form>
            )}

            {/* TAB: PATIENT REGISTER (AUTH-3) */}
            {activeTab === 'register_patient' && (
              <form onSubmit={handleRegisterPatient}>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. John Doe"
                    value={patForm.full_name}
                    onChange={e => setPatForm({ ...patForm, full_name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                  <div>
                    <label className="form-label">Email Address *</label>
                    <input
                      type="email"
                      required
                      className="form-input"
                      placeholder="john@example.com"
                      value={patForm.email}
                      onChange={e => setPatForm({ ...patForm, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="+1-555..."
                      value={patForm.phone}
                      onChange={e => setPatForm({ ...patForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                  <div>
                    <label className="form-label">Date of Birth</label>
                    <input
                      type="date"
                      required
                      className="form-input"
                      value={patForm.date_of_birth}
                      onChange={e => setPatForm({ ...patForm, date_of_birth: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Gender</label>
                    <select
                      className="form-input"
                      value={patForm.gender}
                      onChange={e => setPatForm({ ...patForm, gender: e.target.value })}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Password *</label>
                  <input
                    type="password"
                    required
                    className="form-input"
                    placeholder="At least 6 characters"
                    value={patForm.password}
                    onChange={e => setPatForm({ ...patForm, password: e.target.value })}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.75rem' }}
                >
                  {loading ? 'Creating Account...' : 'Register Patient Account'}
                </button>
              </form>
            )}

            {/* TAB: DOCTOR REGISTER (AUTH-4) */}
            {activeTab === 'register_doctor' && (
              <form onSubmit={handleRegisterDoctor}>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label className="form-label">Clinician Full Name & Title *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Dr. Alex Patel, MD"
                    value={docForm.full_name}
                    onChange={e => setDocForm({ ...docForm, full_name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                  <div>
                    <label className="form-label">Hospital / Clinic *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. City Trauma Center"
                      value={docForm.hospital_name}
                      onChange={e => setDocForm({ ...docForm, hospital_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Department *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. Emergency Triage"
                      value={docForm.department}
                      onChange={e => setDocForm({ ...docForm, department: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                  <div>
                    <label className="form-label">Professional Role *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. Triage Resident"
                      value={docForm.professional_role}
                      onChange={e => setDocForm({ ...docForm, professional_role: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Professional ID / Medical License *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. MD-NY-99120"
                      value={docForm.professional_id}
                      onChange={e => setDocForm({ ...docForm, professional_id: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label className="form-label">Institutional Email *</label>
                    <input
                      type="email"
                      required
                      className="form-input"
                      placeholder="doctor@hospital.org"
                      value={docForm.email}
                      onChange={e => setDocForm({ ...docForm, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Password *</label>
                    <input
                      type="password"
                      required
                      className="form-input"
                      placeholder="••••••••"
                      value={docForm.password}
                      onChange={e => setDocForm({ ...docForm, password: e.target.value })}
                    />
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    color: '#92400e',
                    marginBottom: '1rem'
                  }}
                >
                  ℹ️ <strong>Administrative Verification Required:</strong> Newly registered clinician accounts start in <strong>Pending</strong> status until verified by an administrator.
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0f766e' }}
                >
                  {loading ? 'Submitting Registration...' : 'Submit Clinician Application'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
