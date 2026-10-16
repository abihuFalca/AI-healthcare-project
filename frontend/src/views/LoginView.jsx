import React, { useState } from 'react';
import {
  Shield, User, Stethoscope, Lock, Mail, Phone,
  ArrowRight, CheckCircle2, AlertCircle, HeartPulse, Sparkles
} from 'lucide-react';
import CountryPhoneInput from '../components/CountryPhoneInput';

export default function LoginView({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // login, register_patient, register_doctor
  const [loginMethod, setLoginMethod] = useState('phone'); // 'phone' | 'email'
  const [phoneLogin, setPhoneLogin] = useState('');
  const [emailLogin, setEmailLogin] = useState('');
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

    const loginIdentifier = loginMethod === 'phone' ? phoneLogin.trim() : emailLogin.trim();
    if (!loginIdentifier) {
      setError(loginMethod === 'phone' ? 'Please enter a valid phone number' : 'Please enter your email address');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginIdentifier, password })
      });

      // Handle non-OK status codes
      if (!res.ok) {
        let errorDetail = 'Invalid credentials or login failed';
        try {
          const errorData = await res.json();
          errorDetail = errorData.detail || errorDetail;
        } catch {
          // Response wasn't valid JSON
        }
        throw new Error(errorDetail);
      }

      const data = await res.json();
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
        } catch {
          // Response wasn't valid JSON
        }
        throw new Error(errorDetail);
      }
      const data = await res.json();
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
        } catch {
          // Response wasn't valid JSON
        }
        throw new Error(errorDetail);
      }
      const data = await res.json();
      onLoginSuccess(data.user, data.access_token);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      {/* Top Clinical Header */}
      <header
        style={{
          background: 'linear-gradient(135deg, #091e3a, #034b75)',
          color: '#ffffff',
          padding: '1.25rem 2rem',
          borderBottom: '1px solid #0f2c4c',
          boxShadow: '0 4px 20px -2px rgba(9, 30, 58, 0.25)'
        }}
      >
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                padding: '0.55rem',
                borderRadius: '12px',
                display: 'flex',
                boxShadow: '0 4px 10px rgba(2, 132, 199, 0.4)'
              }}
            >
              <HeartPulse size={28} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                AegisAI Clinical Decision Support
                <span style={{ fontSize: '0.65rem', backgroundColor: '#0284c7', padding: '0.15rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Live
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#93c5fd', marginTop: '0.15rem' }}>
                AI Early-Risk Detection & Patient Triage System · PRD v1.0
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: '0.75rem',
              color: '#bae6fd',
              backgroundColor: 'rgba(2, 132, 199, 0.25)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              padding: '0.4rem 0.9rem',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Shield size={14} color="#38bdf8" />
            <span>Safety-First: Deterministic Rules & Explainable SHAP</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem' }}>
        <div style={{ width: '100%', maxWidth: '520px' }}>
          {/* Main Auth Card */}
          <div
            className="card"
            style={{
              boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '2rem 1.75rem',
              backgroundColor: '#ffffff'
            }}
          >
            {/* Top Navigation Tabs */}
            <div
              style={{
                display: 'flex',
                background: '#f1f5f9',
                padding: '0.35rem',
                borderRadius: '10px',
                marginBottom: '1.75rem'
              }}
            >
              <button
                type="button"
                onClick={() => { setActiveTab('login'); setError(''); }}
                style={{
                  flex: 1,
                  padding: '0.65rem 0.75rem',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: activeTab === 'login' ? '#ffffff' : 'transparent',
                  fontWeight: activeTab === 'login' ? '700' : '500',
                  color: activeTab === 'login' ? '#0284c7' : '#64748b',
                  boxShadow: activeTab === 'login' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  transition: 'all 0.15s ease'
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('register_patient'); setError(''); }}
                style={{
                  flex: 1,
                  padding: '0.65rem 0.75rem',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: activeTab === 'register_patient' ? '#ffffff' : 'transparent',
                  fontWeight: activeTab === 'register_patient' ? '700' : '500',
                  color: activeTab === 'register_patient' ? '#0284c7' : '#64748b',
                  boxShadow: activeTab === 'register_patient' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  transition: 'all 0.15s ease'
                }}
              >
                New Patient
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('register_doctor'); setError(''); }}
                style={{
                  flex: 1,
                  padding: '0.65rem 0.75rem',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: activeTab === 'register_doctor' ? '#ffffff' : 'transparent',
                  fontWeight: activeTab === 'register_doctor' ? '700' : '500',
                  color: activeTab === 'register_doctor' ? '#0284c7' : '#64748b',
                  boxShadow: activeTab === 'register_doctor' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  transition: 'all 0.15s ease'
                }}
              >
                Clinician Join
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#991b1b',
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  animation: 'fadeIn 0.2s ease-out'
                }}
              >
                <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* TAB: LOGIN (AUTH-1) */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin}>
                {/* Login Method Sub-Toggle (Phone vs Email) */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
                    Choose Sign-in Method
                  </label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.5rem',
                      backgroundColor: '#f8fafc',
                      padding: '0.25rem',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setLoginMethod('phone')}
                      style={{
                        padding: '0.5rem 0.75rem',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: loginMethod === 'phone' ? '#0284c7' : 'transparent',
                        color: loginMethod === 'phone' ? '#ffffff' : '#64748b',
                        fontWeight: loginMethod === 'phone' ? '700' : '500',
                        fontSize: '0.825rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Phone size={15} /> Mobile Number
                    </button>

                    <button
                      type="button"
                      onClick={() => setLoginMethod('email')}
                      style={{
                        padding: '0.5rem 0.75rem',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: loginMethod === 'email' ? '#0284c7' : 'transparent',
                        color: loginMethod === 'email' ? '#ffffff' : '#64748b',
                        fontWeight: loginMethod === 'email' ? '700' : '500',
                        fontSize: '0.825rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Mail size={15} /> Email Address
                    </button>
                  </div>
                </div>

                {/* Dynamic Input based on Login Method */}
                {loginMethod === 'phone' ? (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                      Phone Number with Country Code *
                    </label>
                    <CountryPhoneInput
                      value={phoneLogin}
                      onChange={(full) => setPhoneLogin(full)}
                      required
                    />
                    <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.35rem' }}>
                      Select your country dial code and type your phone number
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                      Email Address *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="email"
                        required
                        className="form-input"
                        placeholder="e.g. yourname@domain.com"
                        value={emailLogin}
                        onChange={(e) => setEmailLogin(e.target.value)}
                        style={{ paddingLeft: '2.4rem' }}
                      />
                      <Mail
                        size={16}
                        color="#94a3b8"
                        style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }}
                      />
                    </div>
                  </div>
                )}

                {/* Password Field */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Account Password *</label>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="password"
                      required
                      className="form-input"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ paddingLeft: '2.4rem' }}
                    />
                    <Lock
                      size={16}
                      color="#94a3b8"
                      style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }}
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    fontSize: '0.95rem',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    borderRadius: '8px'
                  }}
                >
                  {loading ? 'Authenticating...' : 'Sign In to Portal'}
                  <ArrowRight size={18} />
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
                    placeholder="e.g. Ramesh Kumar"
                    value={patForm.full_name}
                    onChange={(e) => setPatForm({ ...patForm, full_name: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: '0.875rem' }}>
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    placeholder="patient@example.com"
                    value={patForm.email}
                    onChange={(e) => setPatForm({ ...patForm, email: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: '0.875rem' }}>
                  <label className="form-label">Phone Number *</label>
                  <CountryPhoneInput
                    value={patForm.phone}
                    onChange={(full) => setPatForm({ ...patForm, phone: full })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                  <div>
                    <label className="form-label">Date of Birth</label>
                    <input
                      type="date"
                      required
                      className="form-input"
                      value={patForm.date_of_birth}
                      onChange={(e) => setPatForm({ ...patForm, date_of_birth: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Gender</label>
                    <select
                      className="form-input"
                      value={patForm.gender}
                      onChange={(e) => setPatForm({ ...patForm, gender: e.target.value })}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Create Password *</label>
                  <input
                    type="password"
                    required
                    className="form-input"
                    placeholder="At least 6 characters"
                    value={patForm.password}
                    onChange={(e) => setPatForm({ ...patForm, password: e.target.value })}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.8rem', fontWeight: '700' }}
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
                    onChange={(e) => setDocForm({ ...docForm, full_name: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: '0.875rem' }}>
                  <label className="form-label">Contact Phone Number *</label>
                  <CountryPhoneInput
                    value={docForm.phone}
                    onChange={(full) => setDocForm({ ...docForm, phone: full })}
                    required
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
                      onChange={(e) => setDocForm({ ...docForm, hospital_name: e.target.value })}
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
                      onChange={(e) => setDocForm({ ...docForm, department: e.target.value })}
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
                      onChange={(e) => setDocForm({ ...docForm, professional_role: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Medical License / ID *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. MD-NY-99120"
                      value={docForm.professional_id}
                      onChange={(e) => setDocForm({ ...docForm, professional_id: e.target.value })}
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
                      onChange={(e) => setDocForm({ ...docForm, email: e.target.value })}
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
                      onChange={(e) => setDocForm({ ...docForm, password: e.target.value })}
                    />
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#f0fdfa',
                    border: '1px solid #99f6e4',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    color: '#0f766e',
                    marginBottom: '1rem'
                  }}
                >
                  🛡️ <strong>Professional Credential Verification:</strong> Please provide your official medical license / institutional ID and healthcare facility details. Your credentials are validated upon registration for direct clinical triage access.
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.8rem', backgroundColor: '#0f766e', fontWeight: '700' }}
                >
                  {loading ? 'Verifying & Registering...' : 'Register Clinician Account'}
                </button>
              </form>
            )}

            {/* Bottom Security Trust Badge */}
            <div
              style={{
                marginTop: '1.75rem',
                paddingTop: '1rem',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                fontSize: '0.75rem',
                color: '#64748b'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCircle2 size={14} color="#10b981" />
                <span>Supabase Cloud DB</span>
              </div>
              <span>•</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Shield size={14} color="#0284c7" />
                <span>256-Bit Encrypted</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
