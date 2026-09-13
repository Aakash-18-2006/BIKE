import React from 'react';

/**
 * Converts polar angle (in degrees, 0 = North/Up, 90 = East/Right) to SVG cartesian coordinates around center (cx, cy)
 */
function polarToCartesian(cx, cy, radius, angleInDegrees) {
  // Convert 0° North to standard math angles (North = -90° in standard math)
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: Math.round(cx + radius * Math.cos(angleInRadians)),
    y: Math.round(cy + radius * Math.sin(angleInRadians)),
  };
}

/**
 * JunctionView - Clean vector schematic visualization of approaching intersection
 */
export function JunctionView({ junctionInfo, distanceFormatted = '' }) {
  if (!junctionInfo || !junctionInfo.available) {
    return null;
  }

  const {
    bearings = [],
    inIndex,
    outIndex,
    inBearing,
    outBearing,
    maneuver = 'STRAIGHT',
    currentRoad = '',
    nextRoad = '',
    distanceToJunction,
  } = junctionInfo;

  const cx = 50;
  const cy = 50;
  const radius = 38;

  // Approach road enters from the bottom (angle 180° = South)
  // We rotate the junction so the incoming bearing is oriented at 180° (bottom)
  const baseAngle = inBearing != null ? inBearing : 180;
  const rotationOffset = 180 - baseAngle;

  const displayDist = distanceFormatted || (distanceToJunction != null ? `${Math.round(distanceToJunction)} m` : '');

  return (
    <div
      className="junction-view-container"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 14px',
        margin: '8px 0',
        background: 'linear-gradient(135deg, rgba(8, 14, 24, 0.95), rgba(12, 20, 34, 0.95))',
        border: '1px solid rgba(0, 240, 255, 0.3)',
        borderRadius: 10,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Schematic Vector Mini-Map */}
      <div
        style={{
          width: 72,
          height: 72,
          flexShrink: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg viewBox="0 0 100 100" width="68" height="68" style={{ overflow: 'visible' }}>
          {/* Intersection Center Hub */}
          <circle cx={cx} cy={cy} r="6" fill="#1C283E" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="2" />

          {/* Neutral Inactive Road Branches */}
          {Array.isArray(bearings) && bearings.length > 0 ? (
            bearings.map((b, idx) => {
              const isOut = idx === outIndex;
              const isIn = idx === inIndex;
              if (isOut || isIn) return null; // Drawn with special styles below

              const normalizedAngle = (b + rotationOffset + 360) % 360;
              const pt = polarToCartesian(cx, cy, radius, normalizedAngle);

              return (
                <line
                  key={idx}
                  x1={cx}
                  y1={cy}
                  x2={pt.x}
                  y2={pt.y}
                  stroke="rgba(255, 255, 255, 0.22)"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              );
            })
          ) : (
            // Default crossroad fallback if no raw bearings
            <>
              <line x1="20" y1="50" x2="80" y2="50" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="5" strokeLinecap="round" />
              <line x1="50" y1="20" x2="50" y2="80" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="5" strokeLinecap="round" />
            </>
          )}

          {/* Approach Road (Inbound - from bottom up to center) */}
          <line
            x1={cx}
            y1="88"
            x2={cx}
            y2={cy}
            stroke="#00F0FF"
            strokeWidth="6"
            strokeLinecap="round"
          />

          {/* Outbound Road (Turn Trajectory) */}
          {outBearing != null ? (
            (() => {
              const outAngle = (outBearing + rotationOffset + 360) % 360;
              const pt = polarToCartesian(cx, cy, radius, outAngle);
              return (
                <>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={pt.x}
                    y2={pt.y}
                    stroke="#30D158"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  {/* Arrowhead at exit */}
                  <circle cx={pt.x} cy={pt.y} r="4" fill="#30D158" />
                </>
              );
            })()
          ) : (
            // Outbound fallback based on maneuver direction
            (() => {
              let exitPt = { x: cx, y: 14 }; // Straight
              if (maneuver.includes('LEFT')) exitPt = { x: 14, y: cy };
              if (maneuver.includes('RIGHT')) exitPt = { x: 86, y: cy };
              return (
                <line
                  x1={cx}
                  y1={cy}
                  x2={exitPt.x}
                  y2={exitPt.y}
                  stroke="#30D158"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              );
            })()
          )}

          {/* Rider Position Dot */}
          <circle cx={cx} cy="76" r="3.5" fill="#ffffff" />
        </svg>
      </div>

      {/* Junction Text Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 10, fontFamily: 'Chakra Petch', color: '#30D158', fontWeight: 700, letterSpacing: '0.04em' }}>
            JUNCTION AHEAD
          </span>
          {displayDist && (
            <span style={{ fontSize: 12, fontFamily: 'Chakra Petch', color: '#ffffff', fontWeight: 700 }}>
              {displayDist}
            </span>
          )}
        </div>

        {nextRoad ? (
          <div style={{ fontSize: 12, fontWeight: 700, color: '#00F0FF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            → {nextRoad}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Follow indicated road exit
          </div>
        )}

        {currentRoad && (
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            From: {currentRoad}
          </div>
        )}
      </div>
    </div>
  );
}

export default JunctionView;
