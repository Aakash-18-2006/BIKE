import React from 'react';
import { LaneAssist } from './LaneAssist.jsx';
import { JunctionView } from './JunctionView.jsx';
import { TrafficStatus } from './TrafficStatus.jsx';

/**
 * High-Contrast Vector Maneuver Icons for Motorcycle HUD
 */
export function ManeuverIcon({ maneuver, size = 44, color = 'currentColor' }) {
  const m = String(maneuver || '').toUpperCase().trim();

  switch (m) {
    case 'TURN_LEFT':
    case 'LEFT':
      return (
        <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke={color}>
          <path
            d="M22 26 V14 C22 10.7 19.3 8 16 8 H8 M8 8 L14 2 M8 8 L14 14"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'TURN_RIGHT':
    case 'RIGHT':
      return (
        <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke={color}>
          <path
            d="M10 26 V14 C10 10.7 12.7 8 16 8 H24 M24 8 L18 2 M24 8 L18 14"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'SLIGHT_LEFT':
      return (
        <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke={color}>
          <path
            d="M20 26 V16 C20 12 17 9 12 7 M12 7 L17 5 M12 7 L11 13"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'SLIGHT_RIGHT':
      return (
        <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke={color}>
          <path
            d="M12 26 V16 C12 12 15 9 20 7 M20 7 L15 5 M20 7 L21 13"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'U_TURN':
    case 'UTURN':
      return (
        <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke={color}>
          <path
            d="M22 26 V14 C22 8 10 8 10 14 V26 M10 26 L5 20 M10 26 L15 20"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'ROUNDABOUT':
    case 'ROTARY':
      return (
        <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke={color}>
          <circle cx="16" cy="16" r="7" strokeWidth="3" />
          <path d="M16 26 V23 M16 9 V6 M6 16 L9 16 M23 16 L26 16" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'MERGE':
      return (
        <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke={color}>
          <path
            d="M16 26 V6 M16 6 L10 12 M16 6 L22 12 M8 26 C8 20 13 14 16 12 M24 26 C24 20 19 14 16 12"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'EXIT':
      return (
        <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke={color}>
          <path
            d="M12 26 V6 M12 6 L7 11 M12 6 L17 11 M12 18 C15 16 22 15 24 10 M24 10 L19 10 M24 10 L24 15"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'ARRIVE':
    case 'ARRIVED':
      return (
        <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke={color}>
          <circle cx="16" cy="16" r="9" strokeWidth="3" />
          <circle cx="16" cy="16" r="3.5" fill={color} />
          <path d="M16 2 V5 M16 27 V30 M2 16 H5 M27 16 H30" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'STRAIGHT':
    case 'CONTINUE':
    default:
      return (
        <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke={color}>
          <path
            d="M16 26 V6 M16 6 L10 12 M16 6 L22 12"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

/**
 * Returns visual theme configuration based on active guidance band
 */
export function getBandTheme(guidanceBand) {
  switch (guidanceBand) {
    case 'NOW':
      return {
        accent: '#30D158',
        border: '1px solid #30D158',
        shadow: '0 0 28px rgba(48, 209, 88, 0.45)',
        badgeBg: 'rgba(48, 209, 88, 0.2)',
        badgeText: '#30D158',
        badgeLabel: '⚡ TURN NOW',
        pulse: true,
      };
    case 'IMMEDIATE':
      return {
        accent: '#FF9500',
        border: '1px solid #FF9500',
        shadow: '0 0 24px rgba(255, 149, 0, 0.35)',
        badgeBg: 'rgba(255, 149, 0, 0.2)',
        badgeText: '#FF9500',
        badgeLabel: '⚠️ IMMEDIATE TURN',
        pulse: true,
      };
    case 'SOON':
      return {
        accent: '#FFD60A',
        border: '1px solid #FFD60A',
        shadow: '0 0 20px rgba(255, 214, 10, 0.25)',
        badgeBg: 'rgba(255, 214, 10, 0.18)',
        badgeText: '#FFD60A',
        badgeLabel: 'PREPARE TO TURN',
        pulse: false,
      };
    case 'APPROACHING':
      return {
        accent: '#00F0FF',
        border: '1px solid #00F0FF',
        shadow: '0 0 22px rgba(0, 240, 255, 0.28)',
        badgeBg: 'rgba(0, 240, 255, 0.15)',
        badgeText: '#00F0FF',
        badgeLabel: 'APPROACHING',
        pulse: false,
      };
    case 'NORMAL':
    default:
      return {
        accent: '#00F0FF',
        border: '1px solid rgba(0, 240, 255, 0.4)',
        shadow: '0 6px 20px rgba(0, 240, 255, 0.15)',
        badgeBg: 'rgba(0, 240, 255, 0.1)',
        badgeText: '#00F0FF',
        badgeLabel: 'NAVIGATING',
        pulse: false,
      };
  }
}

/**
 * VisualNavigationHUD - Primary Visual Turn-by-Turn Experience for Smart Bike
 */
export function VisualNavigationHUD({
  navigationGuidance,
  navTelemetry,
  currentLocation,
  destination,
  isOffRoute = false,
  isRecalculating = false,
  isDestinationReached = false,
  isGpsSignalLost = false,
  isVoiceEnabled = true,
  onToggleVoice,
  onStopNavigation,
}) {
  const g = navigationGuidance || navTelemetry || {};

  const isArrived = Boolean(
    isDestinationReached ||
    g.arrived ||
    g.navigationStatus === 'ARRIVED' ||
    g.nextManeuver === 'ARRIVE'
  );

  const maneuver = isArrived
    ? 'ARRIVE'
    : (isRecalculating ? 'CONTINUE' : (g.nextManeuver || 'CONTINUE'));

  const guidanceBand = isArrived ? 'NORMAL' : (g.guidanceBand || 'NORMAL');
  const theme = getBandTheme(guidanceBand);

  // Safe distance & instruction fallbacks
  const distanceFormatted = isArrived
    ? '0 m'
    : (g.distanceToManeuverFormatted || g.distanceToNextTurnFormatted || '0 m');

  const instruction = isArrived
    ? 'You have arrived at your destination.'
    : (isRecalculating
      ? 'Recalculating route...'
      : (g.nextInstruction || g.currentStep?.instruction || 'Follow highlighted route'));

  // Roads: current & next
  const currentRoad = currentLocation?.roadName || g.currentStep?.currentRoad || '';
  const nextRoad = g.nextRoadName || g.currentStep?.roadName || '';

  // Progress metrics
  const progressPercent = Math.max(0, Math.min(100, Math.round(g.progress || 0)));
  const remainingDist = isArrived
    ? '0 m'
    : (g.remainingDistanceFormatted || g.distanceRemainingFormatted || '0 m');
  const remainingEta = isArrived
    ? '0 min'
    : (g.remainingDurationFormatted || g.eta || '1 min');
  const currentSpeed = currentLocation?.speed != null && Number.isFinite(currentLocation.speed)
    ? Math.round(currentLocation.speed * 3.6)
    : 0;

  return (
    <div
      className="card visual-nav-hud"
      style={{
        marginBottom: 14,
        background: 'linear-gradient(135deg, rgba(14, 22, 36, 0.98), rgba(8, 12, 20, 0.98))',
        border: isOffRoute ? '1px solid #FF9500' : theme.border,
        boxShadow: isOffRoute ? '0 0 24px rgba(255, 149, 0, 0.35)' : theme.shadow,
        padding: 16,
        borderRadius: 14,
        position: 'relative',
        overflow: 'hidden',
        transition: 'border 0.3s ease, box-shadow 0.3s ease',
      }}
    >
      {/* Dynamic Top Progress Bar */}
      {!isArrived && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #00F0FF, #30D158)',
              boxShadow: '0 0 8px #00F0FF',
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      )}

      {/* GPS Signal Lost Banner */}
      {isGpsSignalLost && !isArrived && (
        <div
          style={{
            background: 'rgba(255, 59, 48, 0.2)',
            border: '1px solid #FF3B30',
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            boxShadow: '0 0 16px rgba(255, 59, 48, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13 }}>📡</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#FF3B30', fontFamily: 'Chakra Petch' }}>
              GPS SIGNAL LOST
            </span>
          </div>
          <span style={{ fontSize: 11, color: '#ffffff', fontFamily: 'Chakra Petch', fontWeight: 600 }}>
            WAITING FOR GPS...
          </span>
        </div>
      )}

      {/* Off-Route / Recalculating Banner */}
      {isOffRoute && (
        <div
          style={{
            background: 'rgba(255, 149, 0, 0.15)',
            border: '1px solid rgba(255, 149, 0, 0.45)',
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13 }}>⚠️</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#FF9500', fontFamily: 'Chakra Petch' }}>
              OFF ROUTE {g.offRouteDistance ? `(${Math.round(g.offRouteDistance)}m)` : ''}
            </span>
          </div>
          <span style={{ fontSize: 11, color: '#ffffff', fontFamily: 'Chakra Petch', fontWeight: 600 }}>
            {isRecalculating ? 'RECALCULATING ROUTE...' : 'RECALCULATING WITH MAPPLS...'}
          </span>
        </div>
      )}

      {/* Destination Arrival State */}
      {isArrived ? (
        <div style={{ textAlign: 'center', padding: '14px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>🏁</div>
          <div
            style={{
              fontFamily: 'Chakra Petch',
              fontSize: 20,
              fontWeight: 800,
              color: '#30D158',
              letterSpacing: '0.04em',
            }}
          >
            YOU HAVE ARRIVED
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {destination?.name || destination?.address || 'Your Destination'}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 16,
              margin: '14px 0',
              padding: '10px 16px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Chakra Petch' }}>STATUS</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#30D158', fontFamily: 'Chakra Petch' }}>
                TRIP COMPLETE
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Chakra Petch' }}>REMAINING</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', fontFamily: 'Chakra Petch' }}>0 m</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Chakra Petch' }}>PROGRESS</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', fontFamily: 'Chakra Petch' }}>100%</div>
            </div>
          </div>

          <button
            onClick={onStopNavigation}
            className="btn-primary"
            style={{
              marginTop: 6,
              padding: '10px 28px',
              fontFamily: 'Chakra Petch',
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.04em',
            }}
          >
            FINISH TRIP
          </button>
        </div>
      ) : (
        <>
          {/* Top Status Row: Guidance Band Badge & Voice Button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'Chakra Petch',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: theme.badgeBg,
                  color: theme.badgeText,
                  border: `1px solid ${theme.accent}`,
                  textTransform: 'uppercase',
                }}
              >
                {theme.badgeLabel}
              </span>

              {/* Progress Chip */}
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'Chakra Petch',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                }}
              >
                {progressPercent}% COMPLETE
              </span>

              {/* Real-time Traffic Status (only shown when available) */}
              <TrafficStatus trafficInfo={g.trafficInfo} />
            </div>

            {/* Voice Guidance Toggle Button */}
            {typeof onToggleVoice === 'function' && (
              <button
                onClick={onToggleVoice}
                style={{
                  background: isVoiceEnabled ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${isVoiceEnabled ? '#00F0FF' : 'rgba(255, 255, 255, 0.18)'}`,
                  color: isVoiceEnabled ? '#00F0FF' : 'var(--text-muted)',
                  borderRadius: 14,
                  padding: '3px 9px',
                  fontSize: 10,
                  fontFamily: 'Chakra Petch',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                }}
                title={isVoiceEnabled ? 'Voice Guidance Active' : 'Voice Guidance Muted'}
              >
                <span>{isVoiceEnabled ? '🔊' : '🔇'}</span>
                <span>{isVoiceEnabled ? 'VOICE' : 'MUTED'}</span>
              </button>
            )}
          </div>

          {/* Main Turn Guidance Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            {/* Large High-Contrast Vector Maneuver Icon */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 14,
                background: `radial-gradient(circle, ${theme.badgeBg}, rgba(0, 0, 0, 0.4))`,
                border: `2px solid ${theme.accent}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 0 20px ${theme.accent}44`,
                transition: 'border 0.3s ease, box-shadow 0.3s ease',
              }}
            >
              <ManeuverIcon maneuver={maneuver} size={38} color={theme.accent} />
            </div>

            {/* Turn Distance & Instruction */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: '#ffffff',
                    fontFamily: 'Chakra Petch',
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                  }}
                >
                  {distanceFormatted}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: theme.accent,
                    fontFamily: 'Chakra Petch',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                  }}
                >
                  TO TURN
                </span>
              </div>

              {/* Maneuver Instruction */}
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#ffffff',
                  fontFamily: 'Chakra Petch',
                  marginTop: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {instruction}
              </div>

              {/* Current & Next Road Names */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {currentRoad && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Chakra Petch' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', marginRight: 3 }}>ON</span>
                    <span>{currentRoad}</span>
                  </div>
                )}
                {nextRoad && (
                  <div style={{ fontSize: 11, color: theme.accent, fontFamily: 'Chakra Petch', fontWeight: 600 }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', marginRight: 3 }}>NEXT</span>
                    <span>{nextRoad}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lane Guidance (shown only when reliable lane data is available from Mappls) */}
          <LaneAssist laneAssist={g.laneAssist} />

          {/* Junction / Intersection View (shown only when approaching and available) */}
          <JunctionView junctionInfo={g.junctionInfo} distanceFormatted={distanceFormatted} />

          {/* Telemetry Bar: Remaining Distance, ETA, Speed */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 8,
              marginBottom: 12,
              textAlign: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Chakra Petch' }}>REMAINING</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', fontFamily: 'Chakra Petch', marginTop: 2 }}>
                {remainingDist}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Chakra Petch' }}>EST. ARRIVAL</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#00F0FF', fontFamily: 'Chakra Petch', marginTop: 2 }}>
                {remainingEta}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Chakra Petch' }}>SPEED</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', fontFamily: 'Chakra Petch', marginTop: 2 }}>
                {currentSpeed} km/h
              </div>
            </div>
          </div>

          {/* Subsequent Maneuver Preview if available */}
          {g.nextStep && g.nextStep.instruction && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                color: 'var(--text-muted)',
                marginBottom: 12,
                padding: '6px 10px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 6,
                border: '1px solid rgba(255, 255, 255, 0.04)',
              }}
            >
              <ManeuverIcon maneuver={g.nextStep.normalizedManeuver || g.nextStep.turnDirection} size={16} color="#00F0FF" />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Then: {g.nextStep.instruction}
              </span>
            </div>
          )}

          {/* Stop Navigation Control */}
          <button
            onClick={onStopNavigation}
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 13,
              fontFamily: 'Chakra Petch',
              fontWeight: 700,
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'rgba(255, 69, 58, 0.15)',
              color: '#ff453a',
              border: '1px solid rgba(255, 69, 58, 0.35)',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <span>🛑</span>
            <span>STOP NAVIGATION</span>
          </button>
        </>
      )}
    </div>
  );
}

export default VisualNavigationHUD;
