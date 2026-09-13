import React from 'react';
import {
  HighBeamIndicator,
  ABSIndicator,
  TractionControlIndicator,
  SideStandIndicator,
} from './indicators/index.js';

/**
 * CentralInfoDisplay - Hero Central Riding Information Console for Motorcycle TFT
 * 
 * Replaces the speedometer entirely with:
 * 1. CLOCK (Large 24-Hour Digital Time)
 * 2. TRIP A (Trip distance with interactive reset control)
 * 3. ODO (Persistent total odometer distance)
 * 4. 4 Symmetrical status telltale icons (High Beam, TC, ABS, Side Stand)
 */
export function CentralInfoDisplay({
  time = '10:42',
  tripA = 124.6,
  odo = 12458,
  onResetTripA,
  isHighBeamActive = false,
  isAbsFault = false,
  isTcWarning = false,
  tcStatus = 'ACTIVE',
  isSideStandDown = false,
  onToggleIndicator,
}) {
  return (
    <div className="central-info-stage">
      {/* Outer Shell Sockets for the 4 Critical Status Telltales */}
      <div className="central-telltale-socket socket-top-left" title="High Beam">
        <HighBeamIndicator
          active={isHighBeamActive}
          onClick={() => onToggleIndicator && onToggleIndicator('highBeam')}
        />
      </div>

      <div className="central-telltale-socket socket-top-right" title="Traction Control">
        <TractionControlIndicator
          warning={isTcWarning}
          status={tcStatus}
          onClick={() => onToggleIndicator && onToggleIndicator('tractionControlStatus')}
        />
      </div>

      <div className="central-telltale-socket socket-bottom-left" title="ABS System">
        <ABSIndicator
          warning={isAbsFault}
          onClick={() => onToggleIndicator && onToggleIndicator('absStatus')}
        />
      </div>

      <div className="central-telltale-socket socket-bottom-right" title="Side Stand">
        <SideStandIndicator
          down={isSideStandDown}
          inGear={false}
          onClick={() => onToggleIndicator && onToggleIndicator('sideStandStatus')}
        />
      </div>

      {/* Main Automotive Information Console */}
      <div className="central-info-console">
        {/* 1. CLOCK Hero Section */}
        <div className="info-clock-section">
          <div className="info-section-header">
            <span className="info-header-label">CLOCK</span>
            <span className="info-header-sub">24H AUTO</span>
          </div>
          <div className="info-clock-digits">
            {time}
          </div>
        </div>

        <div className="info-console-divider" />

        {/* 2. Metrics Section: TRIP A & ODO */}
        <div className="info-metrics-grid">
          {/* TRIP A */}
          <div className="info-metric-card trip-card">
            <div className="info-metric-header">
              <span className="info-badge-tag">TRIP A</span>
              <button
                className="info-trip-reset-btn"
                onClick={onResetTripA}
                title="Click to Reset Trip A"
              >
                RESET
              </button>
            </div>
            <div className="info-metric-val-row">
              <span className="info-metric-number">
                {Number(tripA || 0).toFixed(1)}
              </span>
              <span className="info-metric-unit">km</span>
            </div>
          </div>

          {/* ODO */}
          <div className="info-metric-card odo-card">
            <div className="info-metric-header">
              <span className="info-badge-tag odo-tag">ODO</span>
              <span className="info-non-resettable-note">TOTAL</span>
            </div>
            <div className="info-metric-val-row">
              <span className="info-metric-number">
                {Math.round(Number(odo || 0)).toLocaleString()}
              </span>
              <span className="info-metric-unit">km</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
