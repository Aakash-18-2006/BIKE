import React from 'react';

/**
 * ISO 2575 / SAE J515 Standard Anti-Lock Braking System (ABS) Telltale Indicator
 * Automotive symbol: Circle enclosing "ABS" surrounded by curved brake shoe brackets.
 * Fault / Warning: Automotive Warning Amber with radiant halo.
 * Normal / Inactive: Dim dark slate outline.
 */
export function ABSIndicator({ warning = false, size = 26, className = '' }) {
  return (
    <div
      className={`telltale-icon-wrapper abs ${warning ? 'active-abs-warn' : 'inactive'} ${className}`}
      title={warning ? 'ABS Fault / Warning Active' : 'ABS System Operational'}
      role="status"
      aria-label={warning ? 'ABS Fault Active' : 'ABS Operational'}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="telltale-svg"
      >
        {/* Central Disc / Brake Drum */}
        <circle
          cx="16"
          cy="16"
          r="9.5"
          fill={warning ? 'currentColor' : 'none'}
          fillOpacity={warning ? '0.15' : '0'}
          stroke="currentColor"
          strokeWidth="2.2"
        />
        {/* Left Brake Shoe Segment Arc */}
        <path
          d="M4.5 10C3.5 11.8 3 13.8 3 16C3 18.2 3.5 20.2 4.5 22"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* Right Brake Shoe Segment Arc */}
        <path
          d="M27.5 10C28.5 11.8 29 13.8 29 16C29 18.2 28.5 20.2 27.5 22"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* Stylized Vector ABS Letters inside disc */}
        <text
          x="16"
          y="19.5"
          textAnchor="middle"
          fill="currentColor"
          fontSize="9.5"
          fontWeight="900"
          fontFamily="'Chakra Petch', 'Arial Black', sans-serif"
          letterSpacing="-0.5"
        >
          ABS
        </text>
      </svg>
    </div>
  );
}

export default ABSIndicator;
