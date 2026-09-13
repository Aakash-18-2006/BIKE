import React from 'react';

/**
 * ISO 2575 / SAE J515 Standard High Beam Telltale Indicator
 * Automotive symbol: Headlamp profile facing left with 5 horizontal parallel rays.
 * Active: Brilliant ISO Electric Blue with luminous bloom.
 * Inactive: Dim dark slate outline.
 */
export function HighBeamIndicator({ active = false, size = 26, className = '' }) {
  return (
    <div
      className={`telltale-icon-wrapper high-beam ${active ? 'active-high-beam' : 'inactive'} ${className}`}
      title={active ? 'High Beam: ON' : 'High Beam: OFF'}
      role="status"
      aria-label={active ? 'High Beam Active' : 'High Beam Inactive'}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="telltale-svg"
      >
        {/* Headlamp Housing / Parabolic Reflector Body */}
        <path
          d="M17 9.5C21.5 9.5 25 12.5 25 16C25 19.5 21.5 22.5 17 22.5V9.5Z"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M17 9.5H15.5C14.5 9.5 14 10.5 14 11.5V20.5C14 21.5 14.5 22.5 15.5 22.5H17"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* 5 Horizontal High Beam Parallel Light Rays (pointing left) */}
        <line x1="6" y1="10.5" x2="13" y2="10.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="4.5" y1="13.2" x2="13" y2="13.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="4" y1="16" x2="13" y2="16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="4.5" y1="18.8" x2="13" y2="18.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="6" y1="21.5" x2="13" y2="21.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default HighBeamIndicator;
