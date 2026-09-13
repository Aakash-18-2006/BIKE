import React from 'react';

/**
 * ISO 2575 / SAE J515 Standard Low Fuel Warning Telltale Indicator
 * Automotive symbol: Fuel dispenser pump with body, display window, nozzle hose.
 * Warning: Automotive Warning Amber with luminous glow (pulse when critical).
 * Normal/Inactive: Dim dark slate outline.
 */
export function LowFuelIndicator({ warning = false, critical = false, size = 26, className = '' }) {
  return (
    <div
      className={`telltale-icon-wrapper low-fuel ${warning ? 'active-low-fuel' : 'inactive'} ${critical ? 'critical-pulse' : ''} ${className}`}
      title={warning ? (critical ? 'CRITICAL LOW FUEL' : 'Low Fuel Warning') : 'Fuel Level Normal'}
      role="status"
      aria-label={warning ? 'Low Fuel Warning Active' : 'Fuel Level Normal'}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="telltale-svg"
      >
        {/* Pump Main Body */}
        <rect
          x="7"
          y="7"
          width="13"
          height="18"
          rx="2"
          fill={warning ? 'currentColor' : 'none'}
          fillOpacity={warning ? '0.2' : '0'}
          stroke="currentColor"
          strokeWidth="2.2"
        />
        {/* Fuel Gauge Window on Pump */}
        <rect
          x="10"
          y="10"
          width="7"
          height="5"
          rx="1"
          fill={warning ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {/* Pump Base Stand */}
        <line x1="5.5" y1="26" x2="21.5" y2="26" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        {/* Hose and Nozzle hanging on the right side */}
        <path
          d="M20 11H22.5C23.9 11 25 12.1 25 13.5V19.5C25 21 26 22 27 22H27.5V17L26 15V13"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default LowFuelIndicator;
