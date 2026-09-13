import React from 'react';

/**
 * LaneDirectionArrow - Renders SVG arrow for a lane maneuver
 */
function LaneDirectionArrow({ maneuver, isRecommended }) {
  const color = isRecommended ? '#00F0FF' : 'rgba(255, 255, 255, 0.4)';
  const strokeWidth = isRecommended ? 3.5 : 2.5;

  const m = String(maneuver || '').toUpperCase();

  if (m === 'TURN_LEFT' || m === 'LEFT') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color}>
        <path
          d="M17 19 V11 C17 8.5 15 7 12 7 H5 M5 7 L9 3 M5 7 L9 11"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (m === 'TURN_RIGHT' || m === 'RIGHT') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color}>
        <path
          d="M7 19 V11 C7 8.5 9 7 12 7 H19 M19 7 L15 3 M19 7 L15 11"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (m === 'SLIGHT_LEFT') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color}>
        <path
          d="M15 19 V12 C15 9 13 7 9 5 M9 5 L13 4 M9 5 L8 9"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (m === 'SLIGHT_RIGHT') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color}>
        <path
          d="M9 19 V12 C9 9 11 7 15 5 M15 5 L11 4 M15 5 L16 9"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (m === 'U_TURN' || m === 'UTURN') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color}>
        <path
          d="M17 19 V10 C17 6 7 6 7 10 V19 M7 19 L3 15 M7 19 L11 15"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Default: STRAIGHT
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color}>
      <path
        d="M12 19 V5 M12 5 L7 10 M12 5 L17 10"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * LaneAssist - Reusable visual motorcycle lane recommendation HUD
 * 
 * Safely hides completely when lane data is unavailable from Mappls.
 */
export function LaneAssist({ laneAssist }) {
  if (!laneAssist || !laneAssist.available || !Array.isArray(laneAssist.lanes) || laneAssist.lanes.length === 0) {
    return null;
  }

  const { lanes, recommendedLane, totalLanes } = laneAssist;

  return (
    <div
      className="lane-assist-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 12px',
        margin: '8px 0',
        background: 'rgba(10, 16, 26, 0.75)',
        border: '1px solid rgba(0, 240, 255, 0.25)',
        borderRadius: 10,
        boxShadow: 'inset 0 1px 6px rgba(0, 240, 255, 0.1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          marginBottom: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontFamily: 'Chakra Petch', color: '#00F0FF', fontWeight: 700, letterSpacing: '0.06em' }}>
            LANE GUIDANCE
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Chakra Petch' }}>
            ({totalLanes} LANES)
          </span>
        </div>
        <div
          style={{
            fontSize: 9,
            fontFamily: 'Chakra Petch',
            fontWeight: 700,
            color: '#00F0FF',
            background: 'rgba(0, 240, 255, 0.15)',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          LANE {recommendedLane + 1} RECOMMENDED
        </div>
      </div>

      {/* Lane Indicators Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 6,
          width: '100%',
          justifyContent: 'center',
        }}
      >
        {lanes.map((lane, idx) => {
          const isRec = lane.recommended || idx === recommendedLane;
          const allowed = Array.isArray(lane.allowedManeuvers) && lane.allowedManeuvers.length > 0
            ? lane.allowedManeuvers
            : ['STRAIGHT'];

          return (
            <div
              key={idx}
              className={`lane-box ${isRec ? 'lane-recommended' : 'lane-neutral'}`}
              style={{
                flex: '1 1 0',
                maxWidth: 68,
                minWidth: 42,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 4px',
                borderRadius: 6,
                background: isRec ? 'rgba(0, 240, 255, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                border: isRec ? '1.5px solid #00F0FF' : '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: isRec ? '0 0 12px rgba(0, 240, 255, 0.35)' : 'none',
                transition: 'all 0.25s ease',
              }}
            >
              <div style={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
                {allowed.map((m, mIdx) => (
                  <LaneDirectionArrow key={mIdx} maneuver={m} isRecommended={isRec} />
                ))}
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: 'Chakra Petch',
                  marginTop: 3,
                  color: isRec ? '#00F0FF' : 'rgba(255, 255, 255, 0.4)',
                }}
              >
                {idx + 1}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LaneAssist;
