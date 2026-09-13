import React from 'react';
import { SideStandIndicator } from './SideStandIndicator.jsx';
import { ABSIndicator } from './ABSIndicator.jsx';
import { BatteryIndicator } from './BatteryIndicator.jsx';
import { LowFuelIndicator } from './LowFuelIndicator.jsx';
import { TractionControlIndicator } from './TractionControlIndicator.jsx';

/**
 * Intelligent Safety-Critical Warning Priority System
 * Automatically prioritizes vehicle safety warnings:
 *  1. SIDE STAND DOWN (Highest critical safety interlock)
 *  2. ABS FAULT (Braking system safety)
 *  3. LOW BATTERY (Electrical system failure risk)
 *  4. LOW FUEL (Range depletion risk)
 *  5. TC OFF (Electronic stability disabled)
 *
 * Renders a compact, high-priority warning telltale ribbon
 * without covering the main speedometer readout.
 */
export function WarningPriorityBar({
  sideStandDown = false,
  absFault = false,
  lowBattery = false,
  lowFuel = false,
  tcOff = false,
  speed = 0,
}) {
  const activeWarnings = [];

  if (sideStandDown) {
    activeWarnings.push({
      id: 'sidestand',
      priority: 1,
      level: 'CRITICAL',
      color: '#ff3b30',
      component: <SideStandIndicator down={true} inGear={speed > 0} size={20} />,
      label: 'SIDE STAND DOWN',
    });
  }

  if (absFault) {
    activeWarnings.push({
      id: 'abs',
      priority: 2,
      level: 'CRITICAL',
      color: '#ff9f0a',
      component: <ABSIndicator warning={true} size={20} />,
      label: 'ABS FAULT',
    });
  }

  if (lowBattery) {
    activeWarnings.push({
      id: 'battery',
      priority: 3,
      level: 'WARNING',
      color: '#ff453a',
      component: <BatteryIndicator warning={true} size={20} />,
      label: 'LOW BATTERY',
    });
  }

  if (lowFuel) {
    activeWarnings.push({
      id: 'fuel',
      priority: 4,
      level: 'WARNING',
      color: '#ff9f0a',
      component: <LowFuelIndicator warning={true} size={20} />,
      label: 'LOW FUEL',
    });
  }

  if (tcOff) {
    activeWarnings.push({
      id: 'tc',
      priority: 5,
      level: 'CAUTION',
      color: '#ff9f0a',
      component: <TractionControlIndicator warning={true} status="OFF" size={20} />,
      label: 'TC OFF',
    });
  }

  if (activeWarnings.length === 0) return null;

  // Highest priority warning item
  const primaryWarning = activeWarnings[0];

  return (
    <div className={`safety-priority-banner priority-${primaryWarning.level.toLowerCase()}`}>
      <div className="safety-banner-glow"></div>
      <div className="safety-banner-content">
        <div className="safety-active-icons">
          {activeWarnings.map((w) => (
            <div key={w.id} className="priority-icon-pill" title={w.label}>
              {w.component}
            </div>
          ))}
        </div>

        {/* Secondary subtle automotive warning text for accessibility only */}
        <div className="safety-priority-tag">
          <span className="priority-pulse-dot" style={{ background: primaryWarning.color }}></span>
          <span className="priority-lead-text">{primaryWarning.label}</span>
          {activeWarnings.length > 1 && (
            <span className="priority-count-badge">+{activeWarnings.length - 1} FAULTS</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default WarningPriorityBar;
