import React from 'react';

/**
 * ISO 2575 Standard Motorcycle Side-Stand Telltale Indicator
 * Automotive symbol: Motorcycle chassis profile with deployed angled kickstand arm & ground contact pad.
 * Warning: High-priority Safety Red/Amber with prominent luminous glow.
 * Normal / Inactive: Dim dark slate outline.
 */
export function SideStandIndicator({ down = false, inGear = false, size = 26, className = '' }) {
  const isPulsing = down && inGear;

  return (
    <div
      className={`telltale-icon-wrapper side-stand ${down ? 'active-sidestand-warn' : 'inactive'} ${isPulsing ? 'critical-pulse' : ''} ${className}`}
      title={down ? 'SAFETY WARNING: Side Stand Down' : 'Side Stand Retracted (UP)'}
      role="status"
      aria-label={down ? 'Side Stand Down Warning' : 'Side Stand Up'}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="telltale-svg"
      >
        {/* Ground Line Reference */}
        <line
          x1="5"
          y1="27"
          x2="27"
          y2="27"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeOpacity={down ? '1' : '0.4'}
        />

        {/* Motorcycle Body Silhouette / Frame Bracket */}
        {/* Front wheel hub */}
        <circle cx="23" cy="21" r="4.5" stroke="currentColor" strokeWidth="2.2" />
        {/* Rear wheel hub */}
        <circle cx="9" cy="21" r="4.5" stroke="currentColor" strokeWidth="2.2" />

        {/* Frame & Handlebars */}
        <path
          d="M9 21L13 14H19L23 21"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 14L19 9H22"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Deployed Side Stand Arm & Foot Pad */}
        {down ? (
          /* Kickstand Extended DOWN to ground */
          <g className="kickstand-deployed">
            <line
              x1="13"
              y1="19"
              x2="8"
              y2="27"
              stroke="#ff3b30"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            {/* Stand Foot Pad Flat on Ground */}
            <line
              x1="6"
              y1="27"
              x2="10"
              y2="27"
              stroke="#ff3b30"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </g>
        ) : (
          /* Kickstand Retracted UP */
          <line
            x1="13"
            y1="19"
            x2="18"
            y2="18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="2 2"
          />
        )}
      </svg>
    </div>
  );
}

export default SideStandIndicator;
