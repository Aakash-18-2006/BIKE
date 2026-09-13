import React, { useState, useEffect } from 'react';
import { useBike } from '../context/BikeContext.jsx';
import { Icon } from '../components/common/Icons.jsx';

export function DashboardScreen({ onNavigate }) {
  const {
    motorcycle,
    status,
    commandStates,
    sendRemoteCommand,
    startVehicleWithPin,
    sleepVehicle,
  } = useBike();

  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (status?.updatedAt) {
        const diff = Math.max(0, Math.floor((Date.now() - new Date(status.updatedAt).getTime()) / 1000));
        setSecondsAgo(diff);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [status?.updatedAt]);

  const bikeName = motorcycle?.name ? motorcycle.name.replace(/Apex/g, 'AEROVYN') : 'AEROVYN';
  const isRunning = status.vehicleState === 'RUNNING' || status.ignition === true;
  const isOnline = status.isOnline !== false;

  // Real telemetry values with safe fallbacks
  const battery = status.batteryPercentage || 85;
  const estimatedRange = Math.round(battery * 1.36); // e.g. 116 km at 85%
  const tireFront = status.tirePressure?.front || 38;
  const tireRear = status.tirePressure?.rear || 40;
  const lat = status.gps?.latitude?.toFixed(4) || '13.0608';
  const lng = status.gps?.longitude?.toFixed(4) || '77.0057';
  const accuracy = status.gps?.accuracy?.toFixed(1) || '1.8';

  const handleRemoteStart = () => {
    startVehicleWithPin(pinInput || '1234');
    setPinPromptOpen(false);
    setPinInput('');
  };

  const handleLocate = () => {
    sendRemoteCommand('FIND_MY_BIKE');
    setTimeout(() => {
      onNavigate('location');
    }, 400);
  };

  return (
    <div>
      {/* 1. Header Row */}
      <div className="sample-header">
        <div className="sample-brand">
          <div className="sample-avatar" style={{ width: 52, height: 52, minWidth: 52, padding: 0, overflow: 'hidden', background: 'transparent', border: 'none' }}>
            <img
              src="/brand-logo.png"
              alt="Brand Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div className="sample-brand-title">{bikeName}</div>
            <div className="sample-brand-subtitle">TCU ID: 218.9933 · IMEI: 8645-88.8522</div>
          </div>
        </div>

        <div>
          {isOnline ? (
            <div className="sample-online-badge">
              <span className="dot-pulse"></span>
              <span>4G ONLINE</span>
            </div>
          ) : (
            <div className="badge badge-red">OFFLINE</div>
          )}
        </div>
      </div>

      {/* 2. Hero Vehicle Stage with Electric Scooter Render */}
      <div className="hero-scooter-card">
        {/* Floating Left Pill: Energy & Range */}
        <div className="floating-pill floating-pill-left">
          <div className="floating-pill-row">
            <span>⚡ FUEL: {status.fuelLevel || 78}%</span>
          </div>
          <div className="floating-pill-row sub">
            <span>RANGE: {estimatedRange} km</span>
          </div>
        </div>

        {/* Photorealistic Center Scooter Render */}
        <img
          src="/scooter-hero.jpg"
          alt="AEROVYN Smart Electric Scooter"
          className="hero-scooter-img"
        />

        {/* Ambient Underglow Aura */}
        <div className="hero-scooter-underglow"></div>

        {/* Floating Right Pill: TPMS Tire Pressures */}
        <div className="floating-pill floating-pill-right">
          <div className="floating-pill-row">
            <span>FL: {tireFront} PSI</span>
          </div>
          <div className="floating-pill-row sub">
            <span>RL: {tireRear} PSI</span>
          </div>
        </div>
      </div>

      {/* 3. Primary 3 Action Buttons Row */}
      <div className="primary-actions-row">
        {/* 1. Start / Stop Button */}
        {!isRunning ? (
          <button
            className="btn-hero-action btn-action-start"
            onClick={() => setPinPromptOpen(true)}
          >
            <div className="icon-circle">
              <Icon name="play" size={18} color="#000000" />
            </div>
            <span className="label">START</span>
          </button>
        ) : (
          <button
            className="btn-hero-action btn-action-start running"
            onClick={sleepVehicle}
          >
            <div className="icon-circle">
              <Icon name="power" size={18} color="#ffffff" />
            </div>
            <span className="label">STOP</span>
          </button>
        )}

        {/* 2. Locate Button */}
        <button
          className="btn-hero-action btn-action-locate"
          onClick={handleLocate}
          disabled={commandStates.FIND_MY_BIKE?.state === 'SENDING'}
        >
          <Icon name="mapPin" size={20} color="#ffffff" />
          <span className="label">LOCATE</span>
          <span className="sub">PULSE BIKE</span>
        </button>

        {/* 3. Lock Button */}
        <button
          className={`btn-hero-action btn-action-lock ${status.lock ? 'locked' : ''}`}
          onClick={() => (status.lock ? sendRemoteCommand('UNLOCK') : sleepVehicle())}
          disabled={commandStates.LOCK?.state === 'SENDING' || commandStates.UNLOCK?.state === 'SENDING'}
        >
          <Icon name={status.lock ? 'lock' : 'unlock'} size={20} color="#ffffff" />
          <span className="label">{status.lock ? 'LOCKED' : 'UNLOCKED'}</span>
        </button>
      </div>

      {/* 4. Secondary 4-Button Grid */}
      <div className="secondary-quick-grid">
        {/* Seat Unlock */}
        <button
          className="quick-action-card"
          onClick={() => sendRemoteCommand('OPEN_SEAT')}
          title="Open underseat storage"
        >
          <div className="quick-action-icon">
            <Icon name="seat" size={18} color="#ffffff" />
          </div>
          <span className="quick-action-title">Open<br />Seat</span>
        </button>

        {/* Charging Port Unlock */}
        <button
          className="quick-action-card"
          onClick={() => sendRemoteCommand('OPEN_CHARGING_PORT')}
          title="Unlock charging flap"
        >
          <div className="quick-action-icon">
            <Icon name="chargingPort" size={18} color="#ffffff" />
          </div>
          <span className="quick-action-title">Open<br />Port</span>
        </button>

        {/* Service Request / Diagnostics */}
        <button
          className="quick-action-card"
          onClick={() => {
            sendRemoteCommand('SERVICE_REQUEST');
            onNavigate('telemetry');
          }}
          title="Request vehicle diagnostic check"
        >
          <div className="quick-action-icon">
            <Icon name="tool" size={18} color="#ffffff" />
          </div>
          <span className="quick-action-title">Service<br />Check</span>
        </button>

        {/* Ride History */}
        <button
          className="quick-action-card"
          onClick={() => onNavigate('history')}
          title="View trip statistics and odometer log"
        >
          <div className="quick-action-icon">
            <Icon name="history" size={18} color="#ffffff" />
          </div>
          <span className="quick-action-title">Ride<br />History</span>
        </button>
      </div>

      {/* 5. Bottom Telemetry Pair */}
      <div className="bottom-telemetry-row">
        {/* Riding Mode Card */}
        <div
          className="telemetry-pill-card"
          onClick={() => onNavigate('controls')}
          title="Tap to change riding profile"
        >
          <div className="telemetry-card-title">RIDING MODE</div>
          <div className="telemetry-card-val">
            {status.ridingMode || 'NORMAL'}
          </div>
          <div className="telemetry-card-sub">Change mode →</div>
        </div>

        {/* GPS Location Card */}
        <div
          className="telemetry-pill-card"
          onClick={() => onNavigate('location')}
          title="Tap to view live satellite map"
        >
          <div className="telemetry-card-title">GPS LOCATION</div>
          <div
            className="telemetry-card-val"
            style={{ fontSize: 13, fontFamily: 'JetBrains Mono', color: '#fff', fontWeight: 600 }}
          >
            {lat} N<br />{lng} E
          </div>
          <div className="telemetry-card-sub">Accuracy: {accuracy}m →</div>
        </div>
      </div>

      {/* PIN Prompt Modal for Keyless Start */}
      {pinPromptOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 360, background: '#0d0d0f', border: '1px solid var(--border-contrast)' }}>
            <h3 style={{ fontFamily: 'Chakra Petch', color: '#fff', fontSize: 18, marginBottom: 8 }}>
              KEYLESS VEHICLE START
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Enter security PIN to authorize drive system:
            </p>

            <input
              type="password"
              maxLength={4}
              className="input-field"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter PIN (1234)"
              autoFocus
              style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, fontFamily: 'JetBrains Mono' }}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => setPinPromptOpen(false)}>
                CANCEL
              </button>
              <button
                className="btn-primary"
                onClick={handleRemoteStart}
              >
                AUTHENTICATE & START
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
