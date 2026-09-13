import React from 'react';
import { useBike } from '../context/BikeContext.jsx';
import { Icon } from '../components/common/Icons.jsx';

export function SpeedometerSettingsScreen() {
  const { speedometerSettings, sendRemoteCommand } = useBike();
  const [unit, setUnit] = React.useState(speedometerSettings?.unit || 'KMH');
  const [theme, setTheme] = React.useState(speedometerSettings?.theme || 'MONOCHROME_LUXURY');
  const [brightness, setBrightness] = React.useState(speedometerSettings?.brightness || 90);

  const handleSaveTheme = (selectedTheme) => {
    setTheme(selectedTheme);
    sendRemoteCommand('SET_SPEEDOMETER_THEME', { theme: selectedTheme });
  };

  const handleSaveBrightness = (val) => {
    setBrightness(val);
    sendRemoteCommand('SET_SPEEDOMETER_BRIGHTNESS', { brightness: parseInt(val, 10) });
  };

  return (
    <div>
      <div className="top-header">
        <div>
          <h2 style={{ fontFamily: 'Chakra Petch', fontSize: 22, color: '#ffffff', letterSpacing: '0.04em' }}>SPEEDOMETER SETTINGS</h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Configure Motorcycle Instrument Cluster</p>
        </div>
        <Icon name="gauge" size={20} color="#ffffff" />
      </div>

      {/* Speed Unit */}
      <div className="card">
        <div className="card-title">Speed Display Units</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          {['KMH', 'MPH'].map((u) => {
            const isSelected = unit === u;
            return (
              <button
                key={u}
                onClick={() => setUnit(u)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  border: isSelected ? '1px solid #ffffff' : '1px solid var(--border-subtle)',
                  background: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.02)',
                  color: isSelected ? '#000000' : '#ffffff',
                  fontFamily: 'Chakra Petch',
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {u === 'KMH' ? 'METRIC (KM/H)' : 'IMPERIAL (MPH)'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cluster Theme */}
      <div className="card">
        <div className="card-title">Cluster Theme Profile</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 10 }}>
          {[
            { id: 'MONOCHROME_LUXURY', name: 'Monochrome Luxury', color: '#ffffff' },
            { id: 'STEALTH_DARK', name: 'Stealth Matte Dark', color: '#777777' },
            { id: 'PURE_MINIMAL', name: 'High Contrast Silver', color: '#e5e5ea' },
            { id: 'OBSIDIAN_BLACK', name: 'Obsidian Midnight', color: '#222226' },
          ].map((t) => {
            const isSelected = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleSaveTheme(t.id)}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: isSelected ? '1px solid #ffffff' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 11,
                  fontFamily: 'Chakra Petch',
                }}
              >
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.color, border: '1px solid rgba(255,255,255,0.4)', flexShrink: 0 }}></div>
                <span>{t.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Display Brightness */}
      <div className="card">
        <div className="card-title-row">
          <span className="card-title">Backlight Brightness</span>
          <span style={{ fontFamily: 'JetBrains Mono', color: '#ffffff', fontWeight: 700 }}>{brightness}%</span>
        </div>
        <input
          type="range"
          min="20"
          max="100"
          value={brightness}
          onChange={(e) => handleSaveBrightness(e.target.value)}
          style={{ width: '100%', marginTop: 10, accentColor: '#ffffff', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'JetBrains Mono' }}>
          <span>NIGHT (DIM)</span>
          <span>SUNLIGHT (MAX)</span>
        </div>
      </div>
    </div>
  );
}

export function ProfileScreen() {
  const { user, motorcycle, logout } = useBike();

  return (
    <div>
      <div className="top-header">
        <div>
          <h2 style={{ fontFamily: 'Chakra Petch', fontSize: 22, color: '#ffffff', letterSpacing: '0.04em' }}>RIDER PROFILE</h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Account & Motorcycle Registry</p>
        </div>
        <Icon name="user" size={20} color="#ffffff" />
      </div>

      {/* Rider Info */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#000000', fontFamily: 'Chakra Petch' }}>
          {user?.name?.[0] || 'A'}
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#ffffff', fontFamily: 'Chakra Petch' }}>{user?.name || 'Alex Mercer'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.email || 'demo@smartbike.io'}</div>
          <div style={{ fontSize: 10, color: '#ffffff', marginTop: 4, fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'Chakra Petch' }}>● VERIFIED RIDER</div>
        </div>
      </div>

      {/* Motorcycle Specs */}
      <div className="card">
        <div className="card-title">Connected Vehicle Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>MACHINE</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', marginTop: 2, fontFamily: 'Chakra Petch' }}>{(motorcycle?.name ? motorcycle.name.replace(/Apex/g, 'AEROVYN') : 'AEROVYN Stealth 900')}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>MODEL</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', marginTop: 2, fontFamily: 'Chakra Petch' }}>{(motorcycle?.model ? motorcycle.model.replace(/Apex/g, 'AEROVYN') : 'AEROVYN R-900')}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>REGISTRATION</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', marginTop: 2, fontFamily: 'JetBrains Mono' }}>{motorcycle?.registrationNumber || 'KA-04-EQ-9921'}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>IOT MODEM ID</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', marginTop: 2, fontFamily: 'JetBrains Mono' }}>{motorcycle?.deviceId || 'BIKE-4G-9021'}</div>
          </div>
        </div>
      </div>

      <button className="btn-secondary" onClick={logout} style={{ marginTop: 12, width: '100%', borderColor: 'rgba(255,59,48,0.3)', color: '#ff3b30' }}>
        SIGN OUT OF AEROVYN
      </button>
    </div>
  );
}

export function AppSettingsScreen() {
  const { status, startVehicleWithPin, sleepVehicle, simulateTamperAlert } = useBike();

  return (
    <div>
      <div className="top-header">
        <div>
          <h2 style={{ fontFamily: 'Chakra Petch', fontSize: 22, color: '#ffffff', letterSpacing: '0.04em' }}>APPLICATION SETTINGS</h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Connectivity & Environment</p>
        </div>
        <Icon name="settings" size={20} color="#ffffff" />
      </div>

      <div className="card">
        <div className="card-title">Network & Gateway Architecture</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>REST API Server:</span>
            <strong style={{ color: '#ffffff', fontFamily: 'JetBrains Mono' }}>http://localhost:5000</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>MQTT Broker:</span>
            <strong style={{ color: '#ffffff', fontFamily: 'JetBrains Mono' }}>localhost:1883 (TCP / QoS 1)</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>WebSocket Gateway:</span>
            <strong style={{ color: '#ffffff', fontFamily: 'JetBrains Mono' }}>CONNECTED</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Vehicle Start Architecture:</span>
            <strong style={{ color: '#ffffff', fontFamily: 'Chakra Petch' }}>KEYLESS TFT + CLOUD PIN</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Vehicle State Simulation Bridge</div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 12px 0' }}>
          Simulate vehicle startup and standby transitions directly:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {status.vehicleState !== 'RUNNING' ? (
            <button className="btn-primary" onClick={() => startVehicleWithPin('1234')}>
              Keyless PIN Start Vehicle (PIN: 1234)
            </button>
          ) : (
            <button className="btn-secondary" onClick={sleepVehicle} style={{ color: '#ff3b30', borderColor: 'rgba(255,59,48,0.3)' }}>
              Lock & Enter Low-Power Standby
            </button>
          )}
          <button className="btn-secondary" onClick={simulateTamperAlert}>
            Trigger Anti-Theft Vibration Sensor
          </button>
        </div>
      </div>
    </div>
  );
}
