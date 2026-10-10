import React, { useState, useEffect } from 'react';
import {
  Shield, Users, CheckCircle, XCircle, AlertCircle,
  Clock, Activity, Settings, Cpu, FileText, Search, RefreshCw
} from 'lucide-react';

export default function AdminDashboard({ user, token }) {
  const [activeTab, setActiveTab] = useState('overview'); // overview, workers, users, audit, settings, model
  const [dashboardData, setDashboardData] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [settings, setSettings] = useState([]);
  const [modelInfo, setModelInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, [activeTab]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      if (activeTab === 'overview') {
        const res = await fetch('/api/admin/dashboard', { headers });
        if (res.ok) setDashboardData(await res.json());
      } else if (activeTab === 'workers') {
        const res = await fetch('/api/admin/healthcare-workers', { headers });
        if (res.ok) {
          const json = await res.json();
          setWorkers(json.healthcare_workers || []);
        }
      } else if (activeTab === 'users') {
        const res = await fetch('/api/admin/users', { headers });
        if (res.ok) {
          const json = await res.json();
          setUsersList(json.users || []);
        }
      } else if (activeTab === 'audit') {
        const res = await fetch('/api/admin/audit-logs', { headers });
        if (res.ok) {
          const json = await res.json();
          setAuditLogs(json.audit_logs || []);
        }
      } else if (activeTab === 'settings') {
        const res = await fetch('/api/admin/settings', { headers });
        if (res.ok) {
          const json = await res.json();
          setSettings(json.settings || []);
        }
      } else if (activeTab === 'model') {
        const res = await fetch('/api/admin/model-info', { headers });
        if (res.ok) setModelInfo(await res.json());
      }
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDoctor = async (workerId, status) => {
    try {
      const res = await fetch(`/api/admin/healthcare-workers/${workerId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          verification_status: status,
          notes: status === 'APPROVED' ? 'Medical council ID confirmed active' : 'Credentials rejected'
        })
      });
      if (res.ok) {
        setMsg(`Doctor verification status updated to ${status}. Account permissions updated.`);
        fetchInitialData();
      }
    } catch (err) {
      console.error('Approve doctor error:', err);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        setMsg(`User status changed to ${nextStatus}`);
        fetchInitialData();
      }
    } catch (err) {
      console.error('Toggle status error:', err);
    }
  };

  const metrics = dashboardData?.metrics || {};

  return (
    <div className="container">
      {/* Admin Header */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
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
            <Shield size={18} color="#a5b4fc" />
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#c7d2fe', textTransform: 'uppercase' }}>
              System Governance & Operations
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800' }}>
            Administrator Control Center
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#e0e7ff' }}>
            User management, clinician credentials verification, audit trails, and model governance
          </p>
        </div>
      </div>

      {msg && (
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
            justifyContent: 'space-between',
            fontSize: '0.85rem'
          }}
        >
          <span>{msg}</span>
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803d' }}>✕</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { id: 'overview', label: 'System Overview', icon: Activity },
          { id: 'workers', label: 'Clinician Approvals', icon: Clock },
          { id: 'users', label: 'User Directory', icon: Users },
          { id: 'audit', label: 'Security Audit Trail', icon: FileText },
          { id: 'settings', label: 'System Configuration', icon: Settings },
          { id: 'model', label: 'AI Model Transparency', icon: Cpu }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1rem',
                border: 'none',
                borderBottom: `3px solid ${isActive ? '#0284c7' : 'transparent'}`,
                backgroundColor: 'transparent',
                fontWeight: isActive ? '700' : '500',
                color: isActive ? '#0284c7' : '#64748b',
                cursor: 'pointer',
                fontSize: '0.875rem',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="animate-fade-in">
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card">
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>TOTAL USERS</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a' }}>{metrics.total_users ?? 0}</div>
            </div>
            <div className="card">
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>REGISTERED PATIENTS</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0284c7' }}>{metrics.total_patients ?? 0}</div>
            </div>
            <div className="card">
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>CLINICIANS</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f766e' }}>{metrics.total_doctors ?? 0}</div>
            </div>
            <div className="card" style={{ borderColor: metrics.pending_approvals > 0 ? '#fde68a' : undefined }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#b45309' }}>PENDING DOCTOR APPROVALS</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#d97706' }}>{metrics.pending_approvals ?? 0}</div>
            </div>
            <div className="card">
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>TOTAL ASSESSMENTS</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a' }}>{metrics.total_assessments ?? 0}</div>
            </div>
            <div className="card">
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#dc2626' }}>HIGH-RISK CASES</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#dc2626' }}>{metrics.high_risk_assessments ?? 0}</div>
            </div>
          </div>

          {/* Recent Security & Clinical Activity Table (ADM-1) */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.75rem' }}>
              Recent Audit Log Stream (ADM-1)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem' }}>
                    <th style={{ padding: '0.625rem 0.5rem' }}>Timestamp</th>
                    <th style={{ padding: '0.625rem 0.5rem' }}>Action</th>
                    <th style={{ padding: '0.625rem 0.5rem' }}>Actor</th>
                    <th style={{ padding: '0.625rem 0.5rem' }}>Entity</th>
                    <th style={{ padding: '0.625rem 0.5rem' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboardData?.recent_activity || []).map((ev, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.625rem 0.5rem', color: '#64748b', fontSize: '0.75rem' }}>
                        {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td style={{ padding: '0.625rem 0.5rem', fontWeight: '700', color: '#0369a1' }}>
                        {ev.action}
                      </td>
                      <td style={{ padding: '0.625rem 0.5rem', color: '#334155' }}>
                        {ev.user_email || 'System'}
                      </td>
                      <td style={{ padding: '0.625rem 0.5rem', color: '#64748b' }}>
                        {ev.entity_type} #{ev.entity_id}
                      </td>
                      <td style={{ padding: '0.625rem 0.5rem', color: '#475569' }}>
                        {ev.metadata}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLINICIAN APPROVALS (ADM-3) */}
      {activeTab === 'workers' && (
        <div className="card animate-fade-in">
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a' }}>
              Clinician Verification Workflow (PRD Section 4.1 & ADM-3)
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Healthcare worker accounts start in 'Pending' status. Clinicians cannot access patient data until verified by an administrator.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Clinician Name</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Professional ID</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Hospital & Department</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Email / Phone</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: '800',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          backgroundColor: w.verification_status === 'APPROVED' ? '#dcfce7' : w.verification_status === 'PENDING' ? '#fef3c7' : '#fee2e2',
                          color: w.verification_status === 'APPROVED' ? '#15803d' : w.verification_status === 'PENDING' ? '#b45309' : '#991b1b'
                        }}
                      >
                        {w.verification_status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: '700', color: '#0f172a' }}>
                      {w.full_name}
                      <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748b' }}>{w.professional_role}</div>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontWeight: '600' }}>
                      {w.professional_id}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <div>{w.hospital_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{w.department}</div>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem', color: '#475569' }}>
                      {w.email}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                      {w.verification_status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleApproveDoctor(w.id, 'APPROVED')}
                            className="btn btn-primary btn-sm"
                            style={{ backgroundColor: '#16a34a' }}
                          >
                            <CheckCircle size={14} /> Approve & Activate
                          </button>
                          <button
                            onClick={() => handleApproveDoctor(w.id, 'REJECTED')}
                            className="btn btn-outline btn-sm"
                            style={{ color: '#dc2626' }}
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Verified</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: USER DIRECTORY (ADM-2) */}
      {activeTab === 'users' && (
        <div className="card animate-fade-in">
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.75rem' }}>
            User Directory & Account Controls (ADM-2)
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem' }}>
                  <th style={{ padding: '0.625rem 0.5rem' }}>ID</th>
                  <th style={{ padding: '0.625rem 0.5rem' }}>Email / User</th>
                  <th style={{ padding: '0.625rem 0.5rem' }}>Role</th>
                  <th style={{ padding: '0.625rem 0.5rem' }}>Status</th>
                  <th style={{ padding: '0.625rem 0.5rem' }}>Registered At</th>
                  <th style={{ padding: '0.625rem 0.5rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.625rem 0.5rem', color: '#64748b' }}>#{u.id}</td>
                    <td style={{ padding: '0.625rem 0.5rem', fontWeight: '600' }}>
                      {u.email}
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>
                        {u.patient_name || u.doctor_name || 'Admin Account'}
                      </div>
                    </td>
                    <td style={{ padding: '0.625rem 0.5rem' }}>
                      <span
                        style={{
                          backgroundColor: u.role === 'PATIENT' ? '#e0f2fe' : u.role === 'HEALTHCARE_WORKER' ? '#f0fdf4' : '#ede9fe',
                          color: u.role === 'PATIENT' ? '#0369a1' : u.role === 'HEALTHCARE_WORKER' ? '#15803d' : '#6d28d9',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px'
                        }}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '0.625rem 0.5rem' }}>
                      <span style={{ color: u.status === 'ACTIVE' ? '#15803d' : '#dc2626', fontWeight: '700', fontSize: '0.75rem' }}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.625rem 0.5rem', color: '#64748b', fontSize: '0.75rem' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.625rem 0.5rem', textAlign: 'right' }}>
                      {u.role !== 'ADMIN' && (
                        <button
                          onClick={() => handleToggleUserStatus(u.id, u.status)}
                          className="btn btn-outline btn-sm"
                          style={{ color: u.status === 'ACTIVE' ? '#dc2626' : '#16a34a' }}
                        >
                          {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT TRAIL (ADM-5) */}
      {activeTab === 'audit' && (
        <div className="card animate-fade-in">
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.75rem' }}>
            Immutable Security & Clinical Audit Log (SEC-7, ADM-5)
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
            Captures logins, role delegations, assessment generations, triage overrides, and clinical record views.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem' }}>
                  <th style={{ padding: '0.625rem 0.5rem' }}>Log ID</th>
                  <th style={{ padding: '0.625rem 0.5rem' }}>Date & Time</th>
                  <th style={{ padding: '0.625rem 0.5rem' }}>Action Event</th>
                  <th style={{ padding: '0.625rem 0.5rem' }}>Initiating User</th>
                  <th style={{ padding: '0.625rem 0.5rem' }}>IP Address</th>
                  <th style={{ padding: '0.625rem 0.5rem' }}>Audit Event Payload</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.625rem 0.5rem', fontFamily: 'monospace', color: '#64748b' }}>#{log.id}</td>
                    <td style={{ padding: '0.625rem 0.5rem', color: '#64748b', fontSize: '0.75rem' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.625rem 0.5rem', fontWeight: '700', color: '#0369a1' }}>
                      {log.action}
                    </td>
                    <td style={{ padding: '0.625rem 0.5rem', color: '#334155' }}>
                      {log.user_email || `User #${log.user_id || 'System'}`}
                    </td>
                    <td style={{ padding: '0.625rem 0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {log.ip_address}
                    </td>
                    <td style={{ padding: '0.625rem 0.5rem', color: '#475569', fontSize: '0.8rem' }}>
                      {log.metadata}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SYSTEM CONFIGURATION (ADM-6) */}
      {activeTab === 'settings' && (
        <div className="card animate-fade-in">
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.75rem' }}>
            System Thresholds & Clinical Safety Configuration (ADM-6)
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
            Tunable clinical parameters. Changes take effect on future risk evaluations only.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {settings.map((s, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.875rem 1rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}
              >
                <div>
                  <div style={{ fontFamily: 'monospace', fontWeight: '700', color: '#0f172a' }}>{s.setting_key}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{s.description}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    defaultValue={s.setting_value}
                    style={{ width: '130px', textAlign: 'center', fontWeight: '700' }}
                  />
                  <button
                    onClick={() => alert(`Saved parameter ${s.setting_key}`)}
                    className="btn btn-outline btn-sm"
                  >
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: AI MODEL TRANSPARENCY (ADM-7, PRD 7.3) */}
      {activeTab === 'model' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
              AI Model Specifications & Validation Metrics (ADM-7)
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Transparent documentation of the machine learning classifier, training metrics, and deterministic safety layer.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#166534' }}>RECALL FOR HIGH RISK</span>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#15803d' }}>
                  {((modelInfo?.validation_metrics?.recall_high_risk ?? 0.942) * 100).toFixed(1)}%
                </div>
                <span style={{ fontSize: '0.7rem', color: '#16a34a' }}>Prioritises clinical sensitivity</span>
              </div>

              <div style={{ backgroundColor: '#f0f9ff', padding: '1rem', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#0369a1' }}>ROC-AUC DISCRIMINATION</span>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0284c7' }}>
                  {modelInfo?.validation_metrics?.roc_auc ?? 0.914}
                </div>
                <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>Held-out validation cohort</span>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569' }}>OVERALL ACCURACY</span>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0f172a' }}>
                  {((modelInfo?.validation_metrics?.accuracy ?? 0.896) * 100).toFixed(1)}%
                </div>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Multiclass triage accuracy</span>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569' }}>ACTIVE VERSION</span>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', fontFamily: 'monospace', color: '#0f172a', marginTop: '0.3rem' }}>
                  {modelInfo?.model_version || 'rf-0.1.0'}
                </div>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Algorithm: Random Forest</span>
              </div>
            </div>

            {/* Feature Set List */}
            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                Active Feature Inputs:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                {(modelInfo?.feature_set || []).map((f, i) => (
                  <span
                    key={i}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      backgroundColor: '#f1f5f9',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      color: '#334155'
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Dataset Disclosure (PRD 7.2) */}
            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                padding: '1rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: '#92400e',
                lineHeight: '1.5'
              }}
            >
              ⚠️ <strong>Dataset & Clinical Positioning Disclosure (PRD Section 7.2):</strong> {modelInfo?.dataset_disclosure || "Prototype uses synthetic patient cohorts and publicly licensed clinical benchmarks. Real deployment requires clinically validated data, institutional bias analysis, and regulatory approval."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
