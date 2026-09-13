import React from 'react';

/**
 * ISO 2575 / SAE J515 Standard Traction Control (TC) Telltale Indicator
 * Automotive symbol: Motorcycle / vehicle chassis with dynamic wheel slip tracks underneath.
 * States:
 *   - warning / OFF: Warning Amber (telltale illuminates when TC is disabled or fault)
 *   - intervening: Rapid flash amber (wheel slip intervention in progress)
 *   - active / armed: Dim outline (protection active in background)
 */
export function TractionControlIndicator({
  status = 'ACTIVE', // 'ACTIVE' | 'OFF' | 'INTERVENING' | 'NORMAL'
  warning = false,
  size = 26,
  className = '',
}) {
  const isOff = warning || status === 'OFF';
  const isIntervening = status === 'INTERVENING';
  const isWarningState = isOff || isIntervening;

  return (
    <div
      className={`telltale-icon-wrapper traction-control ${isWarningState ? 'active-tc-warn' : 'inactive'} ${isIntervening ? 'critical-pulse' : ''} ${className}`}
      title={isOff ? 'Traction Control DISABLED (TC OFF)' : isIntervening ? 'TC Active Intervention' : 'Traction Control Armed'}
      role="status"
      aria-label={isOff ? 'Traction Control Disabled' : 'Traction Control Active'}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="telltale-svg"
      >
        {/* Motorcycle / Vehicle Rear Chassis Contour */}
        <path
          d="M12 7C12 5.5 13.5 4 16 4C18.5 4 20 5.5 20 7L21 11H11L12 7Z"
          fill={isWarningState ? 'currentColor' : 'none'}
          fillOpacity={isWarningState ? '0.2' : '0'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Main Body & Wheel Arch */}
        <path
          d="M8 15C8 13.5 9 12 11 12H21C23 12 24 13.5 24 15L25 18H7L8 15Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Left Wheel Slip / Skid S-Curve */}
        <path
          d="M11 20C9.5 22 12.5 24 10.5 26"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Right Wheel Slip / Skid S-Curve */}
        <path
          d="M21 20C19.5 22 22.5 24 20.5 26"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* OFF badge banner at bottom when disabled */}
        {isOff && (
          <g className="tc-off-badge">
            <rect x="7" y="25" width="18" height="6" rx="1.5" fill="#ff9f0a" />
            <text
              x="16"
              y="29.8"
              textAnchor="middle"
              fill="#040810"
              fontSize="5.5"
              fontWeight="900"
              fontFamily="'Chakra Petch', sans-serif"
              letterSpacing="0.5"
            >
              OFF
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

export default TractionControlIndicator;
