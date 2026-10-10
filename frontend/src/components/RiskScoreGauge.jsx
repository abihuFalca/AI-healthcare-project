import React from 'react';

export default function RiskScoreGauge({ score = 0, level = 'LOW', triage = 'ROUTINE' }) {
  const clampedScore = Math.max(0, Math.min(100, Number(score) || 0));

  let color = '#10b981';
  let bandName = 'Low Risk Band (0–39)';
  if (clampedScore >= 70) {
    color = '#ef4444';
    bandName = 'High Risk Band (70–100)';
  } else if (clampedScore >= 40) {
    color = '#f59e0b';
    bandName = 'Moderate Risk Band (40–69)';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ position: 'relative', width: '180px', height: '110px' }}>
        <svg viewBox="0 0 200 120" style={{ width: '100%', height: '100%' }}>
          {/* Background arc segments */}
          {/* Low Band: 0 to 39% -> 180 to 110 deg */}
          <path
            d="M 20 110 A 80 80 0 0 1 75 35"
            fill="none"
            stroke="#a7f3d0"
            strokeWidth="16"
            strokeLinecap="round"
          />
          {/* Mod Band: 40 to 69% -> 110 to 55 deg */}
          <path
            d="M 80 32 A 80 80 0 0 1 140 38"
            fill="none"
            stroke="#fde68a"
            strokeWidth="16"
          />
          {/* High Band: 70 to 100% -> 55 to 0 deg */}
          <path
            d="M 145 42 A 80 80 0 0 1 180 110"
            fill="none"
            stroke="#fecaca"
            strokeWidth="16"
            strokeLinecap="round"
          />
          
          {/* Score needle / dot indicator */}
          {(() => {
            // angle from 180 (0 score) to 0 (100 score)
            const angleDeg = 180 - (clampedScore / 100) * 180;
            const angleRad = (angleDeg * Math.PI) / 180;
            const cx = 100 + 80 * Math.cos(angleRad);
            const cy = 110 - 80 * Math.sin(angleRad);
            return (
              <circle
                cx={cx}
                cy={cy}
                r="9"
                fill={color}
                stroke="#ffffff"
                strokeWidth="3"
                style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))' }}
              />
            );
          })()}
        </svg>

        {/* Center Score number */}
        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: '800', lineHeight: '1', color: color }}>
            {clampedScore}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>
            OUT OF 100
          </div>
        </div>
      </div>

      <div style={{ marginTop: '0.75rem' }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: '0.75rem',
            fontWeight: '600',
            color: '#475569',
            backgroundColor: '#f1f5f9',
            padding: '0.2rem 0.6rem',
            borderRadius: '9999px'
          }}
        >
          {bandName}
        </span>
      </div>
    </div>
  );
}
