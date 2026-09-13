import React from 'react';
import { sanitizeText } from './navigationModel.js';

/**
 * NavigationTurnCard - Reusable HUD Turn Instruction Component for TFT
 * 
 * Displays:
 * - High-contrast Next-Turn vector arrow (e.g. Right, Left, Straight)
 * - Distance to next turn (e.g. "450 m")
 * - Upcoming Road / Street Name (e.g. "MG Road", "RECALCULATING...", "WAITING FOR GPS...")
 * - Summary footer: Remaining Route Distance ("8.4 km") & ETA ("12:48")
 */
export const NavigationTurnCard = React.memo(function NavigationTurnCard({ nextTurn, route, status, trafficInfo }) {
  const isArrived = status === 'ARRIVED' || nextTurn?.action === 'ARRIVED' || nextTurn?.maneuver === 'arrived';
  const isGpsLost = status === 'GPS_LOST';
  const isRerouting = status === 'REROUTING' || Boolean(nextTurn?.isRerouting);

  const action = isArrived ? 'ARRIVED' : (nextTurn?.action || 'STRAIGHT');

  const distanceMeters = Number.isFinite(nextTurn?.distanceMeters) ? nextTurn.distanceMeters : null;
  const distance = isArrived
    ? '0 m'
    : (isRerouting && !nextTurn?.distanceFormatted && distanceMeters === null
      ? 'RECALC'
      : sanitizeText(nextTurn?.distanceFormatted, distanceMeters !== null ? (distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(1)} km` : `${Math.round(distanceMeters)} m`) : '--'));

  const street = isArrived
    ? (sanitizeText(nextTurn?.streetName) ? `Arrived at ${sanitizeText(nextTurn.streetName)}` : 'Destination Reached')
    : (isRerouting
      ? 'RECALCULATING...'
      : (isGpsLost
        ? 'WAITING FOR GPS...'
        : sanitizeText(nextTurn?.streetName, 'Continue straight')));

  const remainingKm = isArrived
    ? '0 km'
    : (route?.distanceRemainingFormatted || (Number.isFinite(route?.distanceRemainingKm) ? `${route.distanceRemainingKm} km` : '--'));

  const eta = isArrived
    ? 'Arrived'
    : sanitizeText(route?.eta, '--');

  return (
    <div className="tft-nav-turn-card">
      <div className="tft-turn-main-row">
        {/* Crisp Vector Turn Arrow */}
        <div className={`tft-turn-arrow-badge action-${action.toLowerCase()}`}>
          {action === 'RIGHT' && (
            <svg viewBox="0 0 32 32" className="tft-turn-arrow-svg" fill="none" stroke="currentColor">
              <path
                d="M10 26 V14 C10 10.7 12.7 8 16 8 H24 M24 8 L18 2 M24 8 L18 14"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {action === 'LEFT' && (
            <svg viewBox="0 0 32 32" className="tft-turn-arrow-svg" fill="none" stroke="currentColor">
              <path
                d="M22 26 V14 C22 10.7 19.3 8 16 8 H8 M8 8 L14 2 M8 8 L14 14"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {action === 'SLIGHT_RIGHT' && (
            <svg viewBox="0 0 32 32" className="tft-turn-arrow-svg" fill="none" stroke="currentColor">
              <path
                d="M12 26 V16 C12 12 15 9 20 7 M20 7 L15 5 M20 7 L21 13"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {action === 'SLIGHT_LEFT' && (
            <svg viewBox="0 0 32 32" className="tft-turn-arrow-svg" fill="none" stroke="currentColor">
              <path
                d="M20 26 V16 C20 12 17 9 12 7 M12 7 L17 5 M12 7 L11 13"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {action === 'UTURN' && (
            <svg viewBox="0 0 32 32" className="tft-turn-arrow-svg" fill="none" stroke="currentColor">
              <path
                d="M22 26 V14 C22 8 10 8 10 14 V26 M10 26 L5 20 M10 26 L15 20"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {action === 'ROUNDABOUT' && (
            <svg viewBox="0 0 32 32" className="tft-turn-arrow-svg" fill="none" stroke="currentColor">
              <circle cx="16" cy="16" r="7" strokeWidth="3" />
              <path d="M16 26 V23 M16 9 V6 M6 16 L9 16 M23 16 L26 16" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          )}
          {action === 'MERGE' && (
            <svg viewBox="0 0 32 32" className="tft-turn-arrow-svg" fill="none" stroke="currentColor">
              <path
                d="M8 26 L16 16 V6 M16 6 L11 11 M16 6 L21 11 M24 26 L17 17"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {action === 'EXIT' && (
            <svg viewBox="0 0 32 32" className="tft-turn-arrow-svg" fill="none" stroke="currentColor">
              <path
                d="M12 26 V12 C12 8 16 7 22 7 M22 7 L17 3 M22 7 L17 11 M12 26 V6"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {action === 'ARRIVED' && (
            <svg viewBox="0 0 32 32" className="tft-turn-arrow-svg" fill="none" stroke="currentColor">
              <circle cx="16" cy="16" r="9" strokeWidth="3" />
              <circle cx="16" cy="16" r="3.5" fill="currentColor" />
            </svg>
          )}
          {action === 'STRAIGHT' && (
            <svg viewBox="0 0 32 32" className="tft-turn-arrow-svg" fill="none" stroke="currentColor">
              <path
                d="M16 26 V6 M16 6 L10 12 M16 6 L22 12"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {action !== 'RIGHT' && action !== 'LEFT' && action !== 'SLIGHT_RIGHT' && action !== 'SLIGHT_LEFT' && action !== 'UTURN' && action !== 'ROUNDABOUT' && action !== 'ARRIVED' && action !== 'STRAIGHT' && (
            <svg viewBox="0 0 32 32" className="tft-turn-arrow-svg" fill="none" stroke="currentColor">
              <path
                d="M16 26 V6 M16 6 L10 12 M16 6 L22 12"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        {/* Turn Distance & Street Name */}
        <div className="tft-turn-info">
          <div className={`tft-turn-distance ${isArrived ? 'arrived-text' : ''}`}>
            {isArrived ? 'ARRIVED' : distance}
          </div>
          <div className="tft-turn-street">{street}</div>
        </div>
      </div>

      {/* 4. TFT Lane Assistance Strip (shown only when available) */}
      {nextTurn?.laneAssist?.available && Array.isArray(nextTurn.laneAssist.lanes) && nextTurn.laneAssist.lanes.length > 0 && (
        <div
          className="tft-lane-strip"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            margin: '4px 0',
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: 6,
            border: '1px solid rgba(0, 240, 255, 0.25)',
          }}
        >
          <span style={{ fontSize: 9, fontFamily: 'Chakra Petch', color: '#00F0FF', fontWeight: 700, marginRight: 4 }}>
            LANE:
          </span>
          {nextTurn.laneAssist.lanes.map((l, lIdx) => {
            const isRec = l.recommended || lIdx === nextTurn.laneAssist.recommendedLane;
            return (
              <div
                key={lIdx}
                style={{
                  padding: '1px 5px',
                  borderRadius: 4,
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: 'Chakra Petch',
                  background: isRec ? '#00F0FF' : 'rgba(255, 255, 255, 0.08)',
                  color: isRec ? '#000000' : 'rgba(255, 255, 255, 0.5)',
                  border: isRec ? '1px solid #00F0FF' : '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                {lIdx + 1}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. TFT Junction Indicator (shown only when approaching and available) */}
      {nextTurn?.junctionInfo?.available && (
        <div
          className="tft-junction-strip"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '3px 8px',
            margin: '3px 0',
            background: 'rgba(48, 209, 88, 0.12)',
            borderRadius: 6,
            border: '1px solid rgba(48, 209, 88, 0.3)',
          }}
        >
          <span style={{ fontSize: 9, fontFamily: 'Chakra Petch', color: '#30D158', fontWeight: 700 }}>
            ⚡ JUNCTION IN {Math.round(nextTurn.junctionInfo.distanceToJunction || 0)}M
          </span>
          {nextTurn.junctionInfo.nextRoad && (
            <span style={{ fontSize: 9, fontFamily: 'Chakra Petch', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
              → {nextTurn.junctionInfo.nextRoad}
            </span>
          )}
        </div>
      )}

      {/* Sub-bar: Remaining Distance, ETA, Traffic */}
      <div className="tft-turn-meta-row">
        <div className="tft-meta-item">
          <span className="tft-meta-label">REMAINING</span>
          <span className="tft-meta-val">{remainingKm}</span>
        </div>
        <div className="tft-meta-divider">/</div>
        <div className="tft-meta-item">
          <span className="tft-meta-label">ETA</span>
          <span className="tft-meta-val">{eta}</span>
        </div>
        {trafficInfo?.available && (
          <>
            <div className="tft-meta-divider">/</div>
            <div className="tft-meta-item">
              <span className="tft-meta-label">TRAFFIC</span>
              <span className="tft-meta-val" style={{ color: trafficInfo.level === 'SEVERE' || trafficInfo.level === 'HIGH' ? '#FF9500' : '#30D158' }}>
                {trafficInfo.level}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export default NavigationTurnCard;
