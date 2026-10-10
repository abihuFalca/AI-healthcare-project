import React from 'react';

export function RiskTimelineChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        No historical risk score data available yet.
      </div>
    );
  }

  const width = 600;
  const height = 220;
  const padding = { top: 25, right: 30, bottom: 40, left: 45 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Scale Y: 0 to 100
  const getY = (val) => padding.top + plotHeight - (val / 100) * plotHeight;
  // Scale X: points index
  const getX = (idx) => {
    if (data.length === 1) return padding.left + plotWidth / 2;
    return padding.left + (idx / (data.length - 1)) * plotWidth;
  };

  // Build SVG path for line
  const points = data.map((d, i) => `${getX(i)},${getY(d.risk_score)}`).join(' ');

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxHeight: '240px' }} role="img" aria-label="Risk score timeline chart">
        {/* Background Threshold Bands (PRD VIS-1) */}
        {/* High Band: 70 - 100 */}
        <rect
          x={padding.left}
          y={getY(100)}
          width={plotWidth}
          height={getY(70) - getY(100)}
          fill="#fee2e2"
          opacity="0.4"
        />
        {/* Moderate Band: 40 - 69 */}
        <rect
          x={padding.left}
          y={getY(69)}
          width={plotWidth}
          height={getY(40) - getY(69)}
          fill="#fef3c7"
          opacity="0.4"
        />
        {/* Low Band: 0 - 39 */}
        <rect
          x={padding.left}
          y={getY(39)}
          width={plotWidth}
          height={getY(0) - getY(39)}
          fill="#dcfce7"
          opacity="0.4"
        />

        {/* Threshold lines */}
        <line x1={padding.left} y1={getY(70)} x2={width - padding.right} y2={getY(70)} stroke="#fca5a5" strokeDasharray="3 3" />
        <line x1={padding.left} y1={getY(40)} x2={width - padding.right} y2={getY(40)} stroke="#fcd34d" strokeDasharray="3 3" />

        {/* Y Axis labels */}
        <text x={padding.left - 8} y={getY(85)} fill="#991b1b" fontSize="10" textAnchor="end" fontWeight="600">HIGH (70-100)</text>
        <text x={padding.left - 8} y={getY(55)} fill="#92400e" fontSize="10" textAnchor="end" fontWeight="600">MOD (40-69)</text>
        <text x={padding.left - 8} y={getY(20)} fill="#166534" fontSize="10" textAnchor="end" fontWeight="600">LOW (0-39)</text>

        {/* The connecting line */}
        {data.length > 1 && (
          <polyline
            fill="none"
            stroke="#0284c7"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        )}

        {/* Data points */}
        {data.map((d, i) => {
          const cx = getX(i);
          const cy = getY(d.risk_score);
          const dotColor = d.risk_score >= 70 ? '#ef4444' : d.risk_score >= 40 ? '#f59e0b' : '#10b981';
          const dateStr = d.created_at ? new Date(d.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : `T${i+1}`;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r="6" fill={dotColor} stroke="#ffffff" strokeWidth="2" />
              {/* Score label above point */}
              <text x={cx} y={cy - 10} fill="#1e293b" fontSize="11" fontWeight="700" textAnchor="middle">
                {d.risk_score}
              </text>
              {/* Date below X axis */}
              <text x={cx} y={height - 12} fill="#64748b" fontSize="10" textAnchor="middle">
                {dateStr}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function VitalTrendsChart({ data = [] }) {
  if (!data || data.length === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.875rem' }}>
      {data.map((pt, idx) => (
        <div
          key={idx}
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '0.75rem',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
            {new Date(pt.created_at || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </div>
          <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#0f172a' }}>
              BP: <span style={{ color: pt.systolic_bp >= 140 ? '#ef4444' : '#0284c7' }}>{pt.systolic_bp || '--'}/{pt.diastolic_bp || '--'}</span>
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#0f172a' }}>
              HR: <span style={{ color: pt.heart_rate >= 100 ? '#ef4444' : '#0f766e' }}>{pt.heart_rate || '--'} bpm</span>
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#0f172a' }}>
              SpO₂: <span style={{ color: pt.spo2 < 95 ? '#ef4444' : '#059669' }}>{pt.spo2 || '--'}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
