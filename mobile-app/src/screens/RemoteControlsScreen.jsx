import React from 'react';
import { useBike } from '../context/BikeContext.jsx';
import { Icon } from '../components/common/Icons.jsx';

export function RemoteControlsScreen() {
  const { status, commandStates, sendRemoteCommand } = useBike();

  const handleCommand = (cmd, params = {}) => {
    sendRemoteCommand(cmd, params);
  };

  const getCmdState = (cmdName) => {
    return commandStates[cmdName] || { state: 'IDLE' };
  };

  return (
    <div>
      <div className="top-header">
        <div>
          <h2 style={{ fontFamily: 'Chakra Petch', fontSize: 22, color: '#ffffff', letterSpacing: '0.04em' }}>REMOTE CONTROLS</h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>LTE Cloud IoT Command Pipeline</p>
        </div>
        <span className="badge" style={{
          background: '#111113',
          border: '1px solid rgba(255,255,255,0.18)',
          color: '#ffffff',
          fontFamily: 'Chakra Petch',
          fontWeight: 700,
        }}>
          MQTT QoS 1
        </span>
      </div>

      {/* Security & Access Section */}
      <div className="card">
        <div className="card-title-row">
          <span className="card-title">Security & Locks</span>
          <Icon name="shield" size={16} color="#ffffff" />
        </div>

        <div className="control-grid" style={{ marginTop: 10 }}>
          {/* Lock */}
          <button
            className={`control-btn ${status.lock ? 'active' : ''}`}
            onClick={() => handleCommand('LOCK')}
            disabled={getCmdState('LOCK').state === 'SENDING'}
          >
            {getCmdState('LOCK').state !== 'IDLE' && (
              <span className={`cmd-state-pill state-${getCmdState('LOCK').state}`}>
                {getCmdState('LOCK').state}
              </span>
            )}
            <div className="control-btn-icon">
              <Icon name="lock" size={20} color={status.lock ? '#000000' : '#ffffff'} />
            </div>
            <span className="control-btn-label">LOCK BIKE</span>
            <span className="control-btn-status">{status.lock ? 'Engaged' : 'Tap to Lock'}</span>
          </button>

          {/* Unlock */}
          <button
            className={`control-btn ${!status.lock ? 'active' : ''}`}
            onClick={() => handleCommand('UNLOCK')}
            disabled={getCmdState('UNLOCK').state === 'SENDING'}
          >
            {getCmdState('UNLOCK').state !== 'IDLE' && (
              <span className={`cmd-state-pill state-${getCmdState('UNLOCK').state}`}>
                {getCmdState('UNLOCK').state}
              </span>
            )}
            <div className="control-btn-icon">
              <Icon name="unlock" size={20} color={!status.lock ? '#000000' : '#ffffff'} />
            </div>
            <span className="control-btn-label">UNLOCK BIKE</span>
            <span className="control-btn-status">{!status.lock ? 'Disengaged' : 'Tap to Unlock'}</span>
          </button>

          {/* Find My Bike */}
          <button
            className="control-btn"
            onClick={() => handleCommand('FIND_MY_BIKE')}
            disabled={getCmdState('FIND_MY_BIKE').state === 'SENDING'}
          >
            {getCmdState('FIND_MY_BIKE').state !== 'IDLE' && (
              <span className={`cmd-state-pill state-${getCmdState('FIND_MY_BIKE').state}`}>
                {getCmdState('FIND_MY_BIKE').state}
              </span>
            )}
            <div className="control-btn-icon">
              <Icon name="compass" size={20} color="#ffffff" />
            </div>
            <span className="control-btn-label">FIND MY BIKE</span>
            <span className="control-btn-status">Chirp & Flash</span>
          </button>

          {/* Alarm Trigger */}
          <button
            className={`control-btn ${status.alarmTriggered ? 'active' : ''}`}
            onClick={() => handleCommand(status.alarmTriggered ? 'ALARM_DISARM' : 'TRIGGER_ALARM')}
            disabled={getCmdState('TRIGGER_ALARM').state === 'SENDING'}
            style={status.alarmTriggered ? { borderColor: '#ff3b30', background: 'rgba(255, 59, 48, 0.15)' } : {}}
          >
            {getCmdState('TRIGGER_ALARM').state !== 'IDLE' && (
              <span className={`cmd-state-pill state-${getCmdState('TRIGGER_ALARM').state}`}>
                {getCmdState('TRIGGER_ALARM').state}
              </span>
            )}
            <div className="control-btn-icon" style={status.alarmTriggered ? { background: '#ff3b30', color: '#ffffff' } : {}}>
              <Icon name="bell" size={20} color={status.alarmTriggered ? '#ffffff' : '#ff3b30'} />
            </div>
            <span className="control-btn-label">{status.alarmTriggered ? 'STOP ALARM' : 'PANIC ALARM'}</span>
            <span className="control-btn-status">{status.alarmTriggered ? 'SIREN ACTIVE' : 'Sound Siren'}</span>
          </button>
        </div>
      </div>

      {/* Lighting & Signaling */}
      <div className="card">
        <div className="card-title-row">
          <span className="card-title">Lighting & Signals</span>
          <Icon name="lightbulb" size={16} color="#ffffff" />
        </div>

        <div className="control-grid" style={{ marginTop: 10 }}>
          {/* Headlight */}
          <button
            className={`control-btn ${status.headlight ? 'active' : ''}`}
            onClick={() => handleCommand('HEADLIGHT_TOGGLE')}
          >
            {getCmdState('HEADLIGHT_TOGGLE').state !== 'IDLE' && (
              <span className={`cmd-state-pill state-${getCmdState('HEADLIGHT_TOGGLE').state}`}>
                {getCmdState('HEADLIGHT_TOGGLE').state}
              </span>
            )}
            <div className="control-btn-icon">
              <Icon name="lightbulb" size={20} color={status.headlight ? '#000000' : '#ffffff'} />
            </div>
            <span className="control-btn-label">HEADLIGHT</span>
            <span className="control-btn-status">{status.headlight ? 'ON' : 'OFF'}</span>
          </button>

          {/* High Beam */}
          <button
            className={`control-btn ${status.highBeam ? 'active' : ''}`}
            onClick={() => handleCommand('HIGH_BEAM_TOGGLE')}
          >
            {getCmdState('HIGH_BEAM_TOGGLE').state !== 'IDLE' && (
              <span className={`cmd-state-pill state-${getCmdState('HIGH_BEAM_TOGGLE').state}`}>
                {getCmdState('HIGH_BEAM_TOGGLE').state}
              </span>
            )}
            <div className="control-btn-icon">
              <Icon name="zap" size={20} color={status.highBeam ? '#000000' : '#ffffff'} />
            </div>
            <span className="control-btn-label">HIGH BEAM</span>
            <span className="control-btn-status">{status.highBeam ? 'ACTIVE' : 'OFF'}</span>
          </button>

          {/* Hazard Lights */}
          <button
            className={`control-btn ${status.hazard ? 'active' : ''}`}
            onClick={() => handleCommand('HAZARD_TOGGLE')}
            style={status.hazard ? { borderColor: '#ff9f0a', background: 'rgba(255, 159, 10, 0.12)' } : {}}
          >
            {getCmdState('HAZARD_TOGGLE').state !== 'IDLE' && (
              <span className={`cmd-state-pill state-${getCmdState('HAZARD_TOGGLE').state}`}>
                {getCmdState('HAZARD_TOGGLE').state}
              </span>
            )}
            <div className="control-btn-icon" style={status.hazard ? { background: '#ff9f0a', color: '#000000' } : {}}>
              <Icon name="activity" size={20} color={status.hazard ? '#000000' : '#ff9f0a'} />
            </div>
            <span className="control-btn-label">HAZARD STROBE</span>
            <span className="control-btn-status">{status.hazard ? 'BLINKING' : 'OFF'}</span>
          </button>

          {/* Horn Pulse */}
          <button
            className="control-btn"
            onClick={() => handleCommand('HORN_PULSE')}
          >
            {getCmdState('HORN_PULSE').state !== 'IDLE' && (
              <span className={`cmd-state-pill state-${getCmdState('HORN_PULSE').state}`}>
                {getCmdState('HORN_PULSE').state}
              </span>
            )}
            <div className="control-btn-icon">
              <Icon name="volume2" size={20} color="#ffffff" />
            </div>
            <span className="control-btn-label">SOUND HORN</span>
            <span className="control-btn-status">Chirp / Pulse</span>
          </button>
        </div>
      </div>

      {/* Riding Modes */}
      <div className="card">
        <div className="card-title-row">
          <span className="card-title">Engine Riding Mode</span>
          <span className="badge" style={{ background: '#ffffff', color: '#000000', fontWeight: 700 }}>
            {((status.ridingMode === 'SPORT' || status.ridingMode === 'NORMAL') ? 'FUEL' : (status.ridingMode || 'ECO'))}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
          {['ECO', 'FUEL', 'EV'].map((mode) => {
            const currentMode = (status.ridingMode === 'SPORT' || status.ridingMode === 'NORMAL') ? 'FUEL' : (status.ridingMode || 'ECO');
            const isSelected = currentMode === mode;
            return (
              <button
                key={mode}
                onClick={() => handleCommand('SET_RIDING_MODE', { mode })}
                style={{
                  padding: '12px 6px',
                  borderRadius: 8,
                  border: isSelected ? '1px solid #ffffff' : '1px solid var(--border-subtle)',
                  background: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.02)',
                  color: isSelected ? '#000000' : '#ffffff',
                  fontFamily: 'Chakra Petch',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                  letterSpacing: '0.04em',
                }}
              >
                {mode}
              </button>
            );
          })}
        </div>
        {getCmdState('SET_RIDING_MODE').state !== 'IDLE' && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#8e8e93', textAlign: 'center', fontFamily: 'JetBrains Mono' }}>
            Status: {getCmdState('SET_RIDING_MODE').state} {getCmdState('SET_RIDING_MODE').details || ''}
          </div>
        )}
      </div>

      {/* Cluster Theme Sync */}
      <div className="card">
        <div className="card-title-row">
          <span className="card-title">Cluster Dashboard Theme</span>
          <Icon name="gauge" size={16} color="#ffffff" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 10 }}>
          {[
            { id: 'MONOCHROME_LUXURY', name: 'Monochrome Luxury', color: '#ffffff' },
            { id: 'STEALTH_DARK', name: 'Stealth Matte Dark', color: '#666666' },
            { id: 'CYBER_NEON', name: 'High Contrast Silver', color: '#e5e5ea' },
            { id: 'RACING_AMBER', name: 'Obsidian Black', color: '#1a1a1e' },
          ].map((theme) => (
            <button
              key={theme.id}
              onClick={() => handleCommand('SET_SPEEDOMETER_THEME', { theme: theme.id })}
              className="btn-secondary"
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'Chakra Petch',
                textAlign: 'left',
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: theme.color, border: '1px solid rgba(255,255,255,0.4)', flexShrink: 0 }}></div>
              <span style={{ color: '#ffffff' }}>{theme.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
