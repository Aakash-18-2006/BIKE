import React, { useState, useEffect, useRef } from 'react';
import {
  HighBeamIndicator,
  ABSIndicator,
  TractionControlIndicator,
  SideStandIndicator,
} from './indicators/index.js';

/**
 * ArcSpeedometer - Modern Arc-Shaped Speedometer for Motorcycle Digital Cluster
 * 
 * Features:
 * - Precision semi-circular / arc gauge geometry spanning 260 degrees (from 140° to 40°).
 * - High-contrast white active arc with subtle monochrome inactive track.
 * - Exact visual center speed digits with km/h unit.
 * - Configurable maximum speed (derived from vehicle config or default 220 km/h).
 * - Smooth 60fps interpolation via requestAnimationFrame to eliminate sudden jumps.
 * - Balanced automotive placement of 6 telltale status icons around the arc.
 */
/**
 * Dynamic Speedometer Arc Color Transition:
 * - 0 to 60 km/h: GREEN (#30d158)
 * - 60 to 85 km/h: ORANGE (#ff9f0a)
 * - 85 to 100 km/h: RED (#ff3b30)
 * Seamless smooth color interpolation between speed zones.
 */
export const getSpeedColor = (val) => {
  const s = Math.max(0, Math.min(100, Number(val) || 0));

  if (s < 50) {
    return '#30d158'; // Green
  } else if (s <= 62) {
    // Smooth transition from Green to Orange
    const t = (s - 50) / 12;
    const r = Math.round(48 + (255 - 48) * t);
    const g = Math.round(209 + (159 - 209) * t);
    const b = Math.round(88 + (10 - 88) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (s < 78) {
    return '#ff9f0a'; // Orange
  } else if (s <= 88) {
    // Smooth transition from Orange to Red
    const t = (s - 78) / 10;
    const r = 255;
    const g = Math.round(159 + (59 - 159) * t);
    const b = Math.round(10 + (48 - 10) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    return '#ff3b30'; // Red
  }
};

export function ArcSpeedometer({
  speed = 0,
  maxSpeed = 220,
  unit = 'KMH',
  isHighBeamActive = false,
  isAbsFault = false,
  isTcWarning = false,
  tcStatus = 'ACTIVE',
  isSideStandDown = false,
  onToggleIndicator,
}) {
  // Smooth animated speed state
  const [displaySpeed, setDisplaySpeed] = useState(speed);
  const targetSpeedRef = useRef(speed);
  const currentSpeedRef = useRef(speed);
  const animationFrameRef = useRef(null);

  // Update target when prop changes
  useEffect(() => {
    targetSpeedRef.current = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  }, [speed]);

  // Smooth interpolation loop (lerp)
  useEffect(() => {
    let active = true;
    const updateLoop = () => {
      if (!active) return;
      const diff = targetSpeedRef.current - currentSpeedRef.current;
      if (Math.abs(diff) > 0.05) {
        // Damping factor: 0.15 gives fast, smooth automotive needle-like response
        currentSpeedRef.current += diff * 0.15;
        const rounded = Math.round(currentSpeedRef.current);
        setDisplaySpeed((prev) => (prev !== rounded ? rounded : prev));
        animationFrameRef.current = requestAnimationFrame(updateLoop);
      } else {
        currentSpeedRef.current = targetSpeedRef.current;
        const rounded = Math.round(currentSpeedRef.current);
        setDisplaySpeed((prev) => (prev !== rounded ? rounded : prev));
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateLoop);
    return () => {
      active = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [speed]);

  // Perfectly Balanced Arc Geometry: center (330, 222), horizontal radius 270, vertical radius 198
  const cx = 330;
  const cy = 222;
  const rx = 270;
  const ry = 198;

  // Gauge angles: starts at 140° (bottom-left) and sweeps clockwise to 40° (bottom-right)
  // Sweep angle = 260°
  const startAngleDeg = 140;
  const sweepAngleDeg = 260;

  // Arc progress clamped [0, 1]
  const progress = Math.min(1, Math.max(0, currentSpeedRef.current / (maxSpeed || 220)));

  // Dynamic speed color based on current speed
  const speedColor = getSpeedColor(displaySpeed);

  // SVG elliptical arc path helper
  const polarToElliptical = (centerX, centerY, radiusX, radiusY, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radiusX * Math.cos(angleInRadians),
      y: centerY + radiusY * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x, y, radiusX, radiusY, startAngle, endAngle) => {
    const start = polarToElliptical(x, y, radiusX, radiusY, endAngle);
    const end = polarToElliptical(x, y, radiusX, radiusY, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', radiusX, radiusY, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  // Base background arc path (0 to 100%)
  const baseArcPath = describeArc(cx, cy, rx, ry, startAngleDeg, startAngleDeg + sweepAngleDeg);

  // Active arc path (based on current progress)
  const activeEndAngle = startAngleDeg + Math.max(1, progress * sweepAngleDeg);
  const activeArcPath = describeArc(cx, cy, rx, ry, startAngleDeg, activeEndAngle);

  // Speed graduation ticks (every 30 km/h)
  const ticks = [];
  const step = 30;
  const totalTicks = Math.floor(maxSpeed / step);

  for (let i = 0; i <= totalTicks; i++) {
    const val = i * step;
    const tickProgress = val / maxSpeed;
    const angle = startAngleDeg + tickProgress * sweepAngleDeg;
    const innerP = polarToElliptical(cx, cy, rx - 20, ry - 16, angle);
    const outerP = polarToElliptical(cx, cy, rx - 6, ry - 5, angle);
    const labelP = polarToElliptical(cx, cy, rx - 40, ry - 32, angle);

    const isMajor = val % 60 === 0 || val === maxSpeed;
    ticks.push(
      <g key={val}>
        <line
          x1={innerP.x}
          y1={innerP.y}
          x2={outerP.x}
          y2={outerP.y}
          stroke={val <= currentSpeedRef.current ? '#ffffff' : 'rgba(255,255,255,0.22)'}
          strokeWidth={isMajor ? 3.2 : 1.6}
          strokeLinecap="round"
        />
        {isMajor && (
          <text
            x={labelP.x}
            y={labelP.y + 4}
            fill={val <= currentSpeedRef.current ? '#ffffff' : 'rgba(255,255,255,0.38)'}
            fontSize="13"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="600"
            textAnchor="middle"
          >
            {val}
          </text>
        )}
      </g>
    );
  }

  return (
    <div className="arc-speedometer-stage">
      {/* Outer Shell Sockets for the 4 Critical Status Telltales */}
      <div className="arc-telltale-socket socket-top-left" title="High Beam">
        <HighBeamIndicator
          active={isHighBeamActive}
          onClick={() => onToggleIndicator && onToggleIndicator('highBeam')}
        />
      </div>

      <div className="arc-telltale-socket socket-top-right" title="Traction Control">
        <TractionControlIndicator
          warning={isTcWarning}
          status={tcStatus}
          onClick={() => onToggleIndicator && onToggleIndicator('tractionControlStatus')}
        />
      </div>

      <div className="arc-telltale-socket socket-bottom-left" title="ABS System">
        <ABSIndicator
          warning={isAbsFault}
          onClick={() => onToggleIndicator && onToggleIndicator('absStatus')}
        />
      </div>

      <div className="arc-telltale-socket socket-bottom-right" title="Side Stand">
        <SideStandIndicator
          down={isSideStandDown}
          inGear={speed > 0}
          onClick={() => onToggleIndicator && onToggleIndicator('sideStandStatus')}
        />
      </div>

      {/* SVG Arc Gauge */}
      <svg
        className="arc-speedometer-svg"
        viewBox="0 0 660 460"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        {/* Subtle Decorative Ellipse Ring */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx + 24}
          ry={ry + 20}
          fill="none"
          stroke="rgba(255, 255, 255, 0.04)"
          strokeWidth="1"
          strokeDasharray="4 6"
        />

        {/* Inactive Base Track */}
        <path
          d={baseArcPath}
          fill="none"
          stroke="#161619"
          strokeWidth="14"
          strokeLinecap="round"
        />

        {/* Ticks & Graduations */}
        {ticks}

        {/* Active Speed Arc with Dynamic Speed Color: 0-60 Green, 60-85 Orange, 85-100 Red */}
        {progress > 0.005 && (
          <path
            d={activeArcPath}
            fill="none"
            stroke={speedColor}
            strokeWidth="15"
            strokeLinecap="round"
            filter={`drop-shadow(0 0 14px ${speedColor})`}
            style={{ transition: 'stroke 0.12s linear, filter 0.12s linear' }}
          />
        )}

        {/* Leading Tip Indicator Dot on Active Arc */}
        {progress > 0.01 && (
          <circle
            cx={polarToElliptical(cx, cy, rx, ry, activeEndAngle).x}
            cy={polarToElliptical(cx, cy, rx, ry, activeEndAngle).y}
            r="5.5"
            fill="#000000"
            stroke={speedColor}
            strokeWidth="3.5"
            filter={`drop-shadow(0 0 10px ${speedColor})`}
            style={{ transition: 'stroke 0.12s linear, filter 0.12s linear' }}
          />
        )}
      </svg>

      {/* Visual Center Readout Container (No Gear badge, pure prominent speed) */}
      <div className="arc-center-content">
        {/* Hero Speed Digits */}
        <div
          className="arc-speed-number"
          style={{
            textShadow: displaySpeed > 0 ? `0 0 32px ${speedColor}` : '0 0 32px rgba(255, 255, 255, 0.35)',
            transition: 'text-shadow 0.2s linear',
          }}
        >
          {displaySpeed}
        </div>

        {/* Speed Unit */}
        <div className="arc-speed-unit">
          {unit === 'MPH' ? 'MPH' : 'KM/H'}
        </div>
      </div>
    </div>
  );
}
