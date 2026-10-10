import React from 'react';
import { CheckCircle, AlertTriangle, AlertOctagon, ShieldAlert } from 'lucide-react';

export default function RiskBadge({ level, isEmergency = false, size = 'md' }) {
  const normLevel = (level || 'LOW').toUpperCase();

  let badgeClass = 'badge-low';
  let IconComponent = CheckCircle;
  let text = 'LOW RISK';

  if (isEmergency || normLevel === 'EMERGENCY') {
    badgeClass = 'badge-emergency emergency-pulse';
    IconComponent = ShieldAlert;
    text = 'EMERGENCY TRIAGE';
  } else if (normLevel === 'HIGH') {
    badgeClass = 'badge-high';
    IconComponent = AlertOctagon;
    text = 'HIGH RISK';
  } else if (normLevel === 'MODERATE') {
    badgeClass = 'badge-mod';
    IconComponent = AlertTriangle;
    text = 'MODERATE RISK';
  }

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 22
  };

  const textSizes = {
    sm: '0.7rem',
    md: '0.75rem',
    lg: '0.9rem'
  };

  return (
    <span
      className={`badge ${badgeClass}`}
      style={{
        padding: size === 'lg' ? '0.4rem 0.85rem' : undefined,
        fontSize: textSizes[size]
      }}
    >
      <IconComponent size={iconSizes[size]} />
      {text}
    </span>
  );
}
