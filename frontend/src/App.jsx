import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LoginView from './views/LoginView';
import PatientDashboard from './views/PatientDashboard';
import AssessmentWizard from './views/AssessmentWizard';
import AssessmentResultView from './views/AssessmentResultView';
import DoctorDashboard from './views/DoctorDashboard';
import DoctorQueue from './views/DoctorQueue';
import DoctorPatientReview from './views/DoctorPatientReview';
import PendingDoctorView from './views/PendingDoctorView';
import AdminDashboard from './views/AdminDashboard';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('med_token') || null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('med_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activePage, setActivePage] = useState('dashboard');
  const [currentResult, setCurrentResult] = useState(null);
  const [selectedPatientReview, setSelectedPatientReview] = useState(null);

  // Sync token to localStorage
  useEffect(() => {
    if (token) {
      localStorage.setItem('med_token', token);
    } else {
      localStorage.removeItem('med_token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('med_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('med_user');
    }
  }, [user]);

  const handleLoginSuccess = (userData, accessToken) => {
    setUser(userData);
    setToken(accessToken);
    setActivePage('dashboard');
    setCurrentResult(null);
    setSelectedPatientReview(null);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setActivePage('dashboard');
    setCurrentResult(null);
    setSelectedPatientReview(null);
    localStorage.removeItem('med_token');
    localStorage.removeItem('med_user');
  };

  const handleQuickSwitchRole = async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: email, password: password })
      });
      if (res.ok) {
        const data = await res.json();
        handleLoginSuccess(data.user, data.access_token);
      }
    } catch (err) {
      console.error('Quick switch error:', err);
    }
  };

  const handleAssessmentComplete = (resultData) => {
    setCurrentResult(resultData);
    setActivePage('result');
  };

  const handleSelectPatientForReview = (patientId, assessmentId) => {
    setSelectedPatientReview({ patientId, assessmentId });
    setActivePage('patient_review');
  };

  const handleViewAssessmentDetails = async (assessmentId) => {
    try {
      const res = await fetch(`/api/assessments/${assessmentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentResult(data);
        setActivePage('result');
      }
    } catch (err) {
      console.error('Error viewing assessment:', err);
    }
  };

  // If not authenticated, render Login/Public landing view
  if (!user || !token) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // Doctor in PENDING verification state (PRD Section 4.1 & DOC-8)
  if (user.role === 'HEALTHCARE_WORKER' && user.doctor_profile?.verification_status === 'PENDING') {
    return (
      <div>
        <Navbar
          user={user}
          token={token}
          onLogout={handleLogout}
          onNavigate={() => {}}
          activePage="pending"
          onQuickSwitchRole={handleQuickSwitchRole}
        />
        <PendingDoctorView
          user={user}
          onRefresh={() => handleQuickSwitchRole(user.email, 'demo123')}
          onLogout={handleLogout}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        user={user}
        token={token}
        onLogout={handleLogout}
        onNavigate={(page) => setActivePage(page)}
        activePage={activePage}
        onQuickSwitchRole={handleQuickSwitchRole}
      />

      <main style={{ flex: 1, padding: '1.5rem 0' }}>
        {/* PATIENT VIEWS */}
        {user.role === 'PATIENT' && (
          <>
            {activePage === 'dashboard' && (
              <PatientDashboard
                user={user}
                token={token}
                onStartAssessment={() => setActivePage('assessment')}
                onViewResult={handleViewAssessmentDetails}
              />
            )}

            {activePage === 'assessment' && (
              <AssessmentWizard
                token={token}
                onComplete={handleAssessmentComplete}
                onCancel={() => setActivePage('dashboard')}
              />
            )}

            {activePage === 'result' && (
              <AssessmentResultView
                result={currentResult}
                onBack={() => setActivePage('dashboard')}
                onNewAssessment={() => setActivePage('assessment')}
              />
            )}
          </>
        )}

        {/* HEALTHCARE WORKER / DOCTOR VIEWS */}
        {user.role === 'HEALTHCARE_WORKER' && (
          <>
            {activePage === 'dashboard' && (
              <DoctorDashboard
                user={user}
                token={token}
                onSelectPatient={handleSelectPatientForReview}
              />
            )}

            {activePage === 'high_risk' && (
              <DoctorQueue
                token={token}
                onSelectPatient={handleSelectPatientForReview}
                onBack={() => setActivePage('dashboard')}
              />
            )}

            {activePage === 'patient_review' && selectedPatientReview && (
              <DoctorPatientReview
                patientId={selectedPatientReview.patientId}
                assessmentId={selectedPatientReview.assessmentId}
                token={token}
                onBack={() => setActivePage('dashboard')}
              />
            )}
          </>
        )}

        {/* ADMIN VIEWS */}
        {user.role === 'ADMIN' && (
          <AdminDashboard
            user={user}
            token={token}
          />
        )}
      </main>

      {/* Persistent Clinical Positioning Footer (PRD Page 1) */}
      <footer
        style={{
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          padding: '1.25rem 2rem',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: '#64748b'
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <strong>Clinical Decision-Support & Patient Triage System (PRD v1.0)</strong>:
          This software-only web platform is an AI-assisted triage tool. It does not diagnose disease or replace a qualified healthcare professional. All risk outputs are estimates; clinicians retain final clinical responsibility.
        </div>
      </footer>
    </div>
  );
}
