import React, { useState, useEffect } from 'react';
import {
  HeartPulse, Bell, LogOut, User, Stethoscope, Shield,
  Sparkles, Check, ChevronDown, Activity, Clock
} from 'lucide-react';

export default function Navbar({ user, token, onLogout, onNavigate, activePage, onQuickSwitchRole }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  useEffect(() => {
    if (token) {
      fetchNotifications();
    }
  }, [token, activePage]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.notifications || []);
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <nav
      style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
      }}
    >
      <div
        style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        {/* Brand */}
        <div
          onClick={() => onNavigate('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #0284c7, #0f766e)',
              padding: '0.45rem',
              borderRadius: '8px',
              display: 'flex'
            }}
          >
            <HeartPulse size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#0f172a', letterSpacing: '-0.02em', lineHeight: '1.2' }}>
              AegisAI Triage
            </div>
            <div style={{ fontSize: '0.675rem', fontWeight: '600', color: '#64748b' }}>
              Clinical Decision Support
            </div>
          </div>
        </div>

        {/* Navigation Links based on Role */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {user.role === 'PATIENT' && (
            <>
              <button
                onClick={() => onNavigate('dashboard')}
                className={`btn btn-sm ${activePage === 'dashboard' ? 'btn-primary' : 'btn-outline'}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => onNavigate('assessment')}
                className={`btn btn-sm ${activePage === 'assessment' ? 'btn-primary' : 'btn-outline'}`}
              >
                New Assessment (7-Steps)
              </button>
            </>
          )}

          {user.role === 'HEALTHCARE_WORKER' && (
            <>
              <button
                onClick={() => onNavigate('dashboard')}
                className={`btn btn-sm ${activePage === 'dashboard' ? 'btn-primary' : 'btn-outline'}`}
              >
                Doctor Dashboard
              </button>
              <button
                onClick={() => onNavigate('high_risk')}
                className={`btn btn-sm ${activePage === 'high_risk' ? 'btn-primary' : 'btn-outline'}`}
              >
                High-Risk Queue
              </button>
            </>
          )}
        </div>

        {/* Right side controls: Role Badge, Quick Demo Switcher, Notifications, Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
          {/* Authenticated User Identity Chip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '0.35rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.8rem'
            }}
          >
            {user.role === 'HEALTHCARE_WORKER' ? (
              <Stethoscope size={15} color="#0f766e" />
            ) : user.role === 'ADMIN' ? (
              <Shield size={15} color="#6d28d9" />
            ) : (
              <User size={15} color="#0284c7" />
            )}
            <span style={{ fontWeight: '700', color: '#0f172a' }}>
              {user.doctor_profile?.full_name || user.profile?.full_name || user.email?.split('@')[0] || 'User'}
            </span>
            <span
              style={{
                fontSize: '0.675rem',
                fontWeight: '700',
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor:
                  user.role === 'HEALTHCARE_WORKER'
                    ? '#f0fdfa'
                    : user.role === 'ADMIN'
                    ? '#f5f3ff'
                    : '#f0f9ff',
                color:
                  user.role === 'HEALTHCARE_WORKER'
                    ? '#0f766e'
                    : user.role === 'ADMIN'
                    ? '#6d28d9'
                    : '#0284c7',
                border: `1px solid ${
                  user.role === 'HEALTHCARE_WORKER'
                    ? '#99f6e4'
                    : user.role === 'ADMIN'
                    ? '#ddd6fe'
                    : '#bae6fd'
                }`
              }}
            >
              {user.role === 'HEALTHCARE_WORKER' ? 'Clinician' : user.role === 'ADMIN' ? 'Admin' : 'Patient'}
            </span>
          </div>

          {/* Notifications Bell */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              style={{
                position: 'relative',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.45rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Bell size={18} color="#475569" />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: '800',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #ffffff'
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '110%',
                  width: '320px',
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                  border: '1px solid #e2e8f0',
                  padding: '0.75rem',
                  zIndex: 100
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', paddingBottom: '0.35rem', borderBottom: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0f172a' }}>Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer' }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {notifications.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>
                      No notifications
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '6px',
                          backgroundColor: n.is_read ? '#f8fafc' : '#f0f9ff',
                          border: `1px solid ${n.is_read ? '#e2e8f0' : '#bae6fd'}`,
                          fontSize: '0.775rem'
                        }}
                      >
                        <div style={{ fontWeight: '700', color: n.is_read ? '#475569' : '#0369a1' }}>{n.title}</div>
                        <div style={{ color: '#64748b', fontSize: '0.725rem', marginTop: '0.15rem' }}>{n.message}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.65rem', marginTop: '0.25rem' }}>
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Signout */}
          <button
            onClick={onLogout}
            className="btn btn-outline btn-sm"
            title="Sign out"
            style={{ color: '#64748b' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </nav>
  );
}
