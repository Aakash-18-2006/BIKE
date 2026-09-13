import React from 'react';
import { BatteryIndicator } from './indicators/BatteryIndicator.jsx';
import { LowFuelIndicator } from './indicators/LowFuelIndicator.jsx';

/**
 * VerticalGauge - Automotive Segmented Flank Gauge for Motorcycle TFT Display
 * 
 * Used symmetrically on:
 * - LEFT side: Battery Level (E -> F) with Battery Icon
 * - RIGHT side: Fuel Level (E -> F) with Fuel Pump Icon
 */
export function VerticalGauge({
  type = 'battery', // 'battery' | 'fuel'
  value = 75,       // 0 to 100
  isWarning = false,
  isCritical = false,
  side = 'left',    // 'left' | 'right'
  onClick,
}) {
  const clampedVal = Math.max(0, Math.min(100, Number(value) || 0));
  const totalSegments = 10;
  const activeSegmentsCount = Math.round((clampedVal / 100) * totalSegments);
  const isLow = isWarning || clampedVal <= 20;

  // Build segments from Top (Full = 10) to Bottom (Empty = 1)
  const segments = [];
  for (let i = totalSegments; i >= 1; i--) {
    const isActive = i <= activeSegmentsCount;
    const isLowestSegment = i <= 2;
    const isWarningSegment = isLow && isActive && isLowestSegment;

    segments.push(
      <div
        key={i}
        className={`vertical-gauge-segment ${isActive ? 'active' : 'inactive'} ${
          isWarningSegment ? 'segment-warning' : ''
        }`}
      />
    );
  }

  return (
    <div
      className={`vertical-gauge-column side-${side} type-${type} ${isLow ? 'gauge-warning' : ''}`}
      onClick={onClick}
      title={`${type.toUpperCase()} LEVEL ${isLow ? '(LOW WARNING)' : ''}`}
    >
      {/* Top Header Icon */}
      <div className="vertical-gauge-icon-header">
        {type === 'battery' ? (
          <BatteryIndicator
            warning={isLow}
            critical={isCritical || clampedVal <= 10}
            size={22}
          />
        ) : (
          <LowFuelIndicator
            warning={isLow}
            critical={isCritical || clampedVal <= 10}
            size={22}
          />
        )}
      </div>

      {/* Main Gauge Body: Segment Track + Graduation Ticks */}
      <div className="vertical-gauge-body">
        {/* Graduation Tick Scale */}
        <div className={`vertical-gauge-scale side-${side}`}>
          <div className="scale-mark mark-full">
            <span className="scale-tick" />
            <span className="scale-text">F</span>
          </div>
          <div className="scale-mark mark-half">
            <span className="scale-tick" />
            <span className="scale-text">1/2</span>
          </div>
          <div className="scale-mark mark-empty">
            <span className="scale-tick" />
            <span className="scale-text">E</span>
          </div>
        </div>

        {/* Segmented Bar Track */}
        <div className="vertical-gauge-track">
          {segments}
        </div>
      </div>

      {/* Bottom Type Label */}
      <div className="vertical-gauge-footer-label">
        {type === 'battery' ? 'BATT' : 'FUEL'}
      </div>
    </div>
  );
}
