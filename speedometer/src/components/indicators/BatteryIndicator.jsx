import React from 'react';

/**
 * ISO 2575 / SAE J515 Standard Battery & Charging System Warning Telltale Indicator
 * Automotive symbol: Rectangular 12V battery with top terminal posts and polarity symbols.
 * Warning: Automotive Warning Red with charging discharge alert glow.
 * Normal/Inactive: Dim dark slate outline.
 */
export function BatteryIndicator({ warning = false, critical = false, size = 26, className = '' }) {
  return (
    <div
      className={`telltale-icon-wrapper battery ${warning ? 'active-battery-warn' : 'inactive'} ${critical ? 'critical-pulse' : ''} ${className}`}
      title={warning ? (critical ? 'CRITICAL BATTERY LOW' : '12V Battery Warning') : 'Battery Normal'}
      role="status"
      aria-label={warning ? 'Battery Warning Active' : 'Battery Status Normal'}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="telltale-svg"
      >
        {/* Battery Main Case */}
        <rect
          x="5"
          y="11"
          width="22"
          height="14"
          rx="2"
          fill={warning ? 'currentColor' : 'none'}
          fillOpacity={warning ? '0.2' : '0'}
          stroke="currentColor"
          strokeWidth="2.2"
        />
        {/* Left Positive Terminal Post */}
        <rect x="8" y="7.5" width="4.5" height="3.5" rx="0.8" fill="currentColor" />
        {/* Right Negative Terminal Post */}
        <rect x="19.5" y="7.5" width="4.5" height="3.5" rx="0.8" fill="currentColor" />
        {/* Left Positive Sign (+) */}
        <line x1="8.5" y1="18" x2="13.5" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="11" y1="15.5" x2="11" y2="20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Right Negative Sign (-) */}
        <line x1="18.5" y1="18" x2="23.5" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default BatteryIndicator;
