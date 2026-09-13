import React, { useState } from 'react';
import { useBike } from '../context/BikeContext.jsx';
import { Icon } from '../components/common/Icons.jsx';

export function SecurityScreen({ onNavigate }) {
  const {
    status,
    securityEvents,
    simulateTamperAlert,
    secureVehicle,
    toggleSecurityMode,
    securityModeActive,
  } = useBike();

  const [securingInProgress, setSecuringInProgress] = useState(false);
  const [secureResult, setSecureResult] = useState(null);

  const isTheft = status.theftDetected || status.alarmTriggered;
  const isOnline = status.isOnline !== false;
  const isMoving = (status.speed || 0) > 0.5;

  const handleSecureVehicle = async () => {
    setSecuringInProgress(true);
    const result = await secureVehicle();
    setSecuringInProgress(false);
    if (result) {
      setSecureResult(result);
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div className="top-header">
        <div>
          <h2 style={{ fontFamily: 'Chakra Petch', fontSize: 22, color: isTheft ? '#ff3b30' : '#ffffff', letterSpacing: '0.04em' }}>
            {isTheft ? '⚠ THEFT ALERT' : 'VEHICLE SECURITY'}
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {isTheft ? 'UNAUTHORIZED VEHICLE MOVEMENT' : 'Real-time Perimeter & Ignition Guard'}
          </p>
        </div>
        <span className={`badge ${isTheft ? 'badge-red' : ''}`} style={{
          background: isTheft ? 'rgba(255, 59, 48, 0.15)' : '#111113',
          border: isTheft ? '1px solid #ff3b30' : '1px solid rgba(255,255,255,0.18)',
          color: isTheft ? '#ff3b30' : '#ffffff',
          fontWeight: 700,
          fontFamily: 'Chakra Petch',
          letterSpacing: '0.06em',
          animation: isTheft ? 'pulse 1.2s infinite' : 'none',
        }}>
          {isTheft ? '⚠ THEFT DETECTED' : '● SECURITY ACTIVE'}
        </span>
      </div>

      {/* Primary Status Card */}
      <div
        className="card"
        style={{
          borderColor: isTheft ? '#ff3b30' : 'var(--border-subtle)',
          background: isTheft ? 'linear-gradient(180deg, rgba(255, 59, 48, 0.1) 0%, #0d0d0f 100%)' : 'var(--bg-card)',
        }}
      >
        <div className="card-title-row">
          <span className="card-title">Anti-Theft System State</span>
          <Icon name="shield" size={18} color={isTheft ? '#ff3b30' : '#ffffff'} />
        </div>

        {/* Status Grid matching requirements */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, margin: '12px 0 16px 0' }}>
          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>STATUS</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: isTheft ? '#ff3b30' : '#ffffff', fontFamily: 'Chakra Petch', marginTop: 3 }}>
              {isTheft ? 'THEFT DETECTED' : '● SECURITY ACTIVE'}
            </div>
          </div>

          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>IGNITION</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: isTheft ? '#ff3b30' : (status.ignition ? '#ffffff' : '#8e8e93'), fontFamily: 'Chakra Petch', marginTop: 3 }}>
              {isTheft ? 'UNAUTHORIZED' : (status.ignition ? 'ACTIVE (RUNNING)' : 'OFF (LOCKED)')}
            </div>
          </div>

          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>MOVEMENT</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: isMoving ? '#ff3b30' : '#ffffff', fontFamily: 'Chakra Petch', marginTop: 3 }}>
              {isMoving ? `DETECTED (${Math.round(status.speed)} km/h)` : 'STATIONARY'}
            </div>
          </div>

          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>GPS FIX</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', fontFamily: 'Chakra Petch', marginTop: 3 }}>
              {isTheft ? 'LIVE TRACKING' : 'LOCKED (10 SATS)'}
            </div>
          </div>

          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>CAMERA DASHCAM</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: isTheft ? '#ff3b30' : '#ffffff', fontFamily: 'Chakra Petch', marginTop: 3 }}>
              {isTheft ? 'RECORDING ●' : 'STANDBY READY'}
            </div>
          </div>

          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TCU TELEMETRY</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: isOnline ? '#ffffff' : '#8e8e93', fontFamily: 'Chakra Petch', marginTop: 3 }}>
              {isOnline ? 'LTE ONLINE' : 'DISCONNECTED'}
            </div>
          </div>
        </div>

        {/* Security Mode Toggle Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--border-subtle)', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', fontFamily: 'Chakra Petch' }}>
              CONTINUOUS STANDBY GUARD
            </div>
            <div style={{ fontSize: 11, color: securityModeActive ? '#ffffff' : 'var(--text-muted)', fontWeight: 500 }}>
              {securityModeActive ? 'Perimeter sensors active' : 'Disarmed / Maintenance'}
            </div>
          </div>

          <button
            onClick={() => toggleSecurityMode(!securityModeActive)}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              border: '1px solid #ffffff',
              background: securityModeActive ? '#ffffff' : 'transparent',
              color: securityModeActive ? '#000000' : '#ffffff',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'Chakra Petch',
              letterSpacing: '0.05em',
              transition: 'all 0.15s ease',
            }}
          >
            {securityModeActive ? 'ARMED ●' : 'DISARM'}
          </button>
        </div>

        {/* Emergency [ SECURE VEHICLE ] Button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleSecureVehicle}
            disabled={securingInProgress}
            style={{
              padding: '14px',
              borderRadius: 12,
              border: isTheft ? '1px solid #ff3b30' : '1px solid rgba(255, 59, 48, 0.4)',
              background: '#b00020',
              color: '#ffffff',
              fontFamily: 'Chakra Petch',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              letterSpacing: '0.08em',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🔒</span>
            <span>{securingInProgress ? 'SECURING VEHICLE...' : 'SECURE VEHICLE'}</span>
          </button>

          {/* Quick Actions Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <button
              onClick={() => onNavigate && onNavigate('location')}
              className="btn-secondary"
              style={{
                padding: '11px',
                borderRadius: 10,
                fontFamily: 'Chakra Petch',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <span>📍</span>
              <span>VIEW LOCATION</span>
            </button>

            <button
              onClick={() => onNavigate && onNavigate('camera')}
              className="btn-secondary"
              style={{
                padding: '11px',
                borderRadius: 10,
                fontFamily: 'Chakra Petch',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <span>📷</span>
              <span>VIEW CAMERA</span>
            </button>
          </div>
        </div>

        {/* Secure Result Feedback */}
        {secureResult && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 10,
              background: '#111113',
              border: `1px solid ${secureResult.immediateCutoff ? '#ffffff' : '#ff9f0a'}`,
              fontSize: 12,
              color: '#ffffff',
              lineHeight: 1.4,
            }}
          >
            <div style={{ fontWeight: 700, color: secureResult.immediateCutoff ? '#ffffff' : '#ff9f0a', marginBottom: 4, fontFamily: 'Chakra Petch' }}>
              {secureResult.immediateCutoff ? '✓ VEHICLE IMMOBILIZED' : '⚠ SAFE ENGINE CUTOFF DEFERRED'}
            </div>
            <span style={{ color: '#8e8e93' }}>{secureResult.message || secureResult.result?.message}</span>
          </div>
        )}
      </div>

      {/* Simulator Test Trigger */}
      <div className="card">
        <div className="card-title-row">
          <span className="card-title">Hardware Simulation Tests</span>
          <span className="badge">TEST CONSOLE</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 10 }}>
          <button
            onClick={simulateTamperAlert}
            className="btn-secondary"
            style={{
              padding: 10,
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'Chakra Petch',
            }}
          >
            VIBRATION SENSOR
          </button>

          <button
            onClick={async () => {
              try {
                await fetch('http://localhost:5005/api/simulator/security/unauthorized-movement', { method: 'POST' });
              } catch (e) {}
            }}
            style={{
              padding: 10,
              borderRadius: 8,
              background: '#0d0d0f',
              border: '1px solid rgba(255, 59, 48, 0.4)',
              color: '#ff3b30',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'Chakra Petch',
            }}
          >
            TOWING THEFT ALERT
          </button>
        </div>
      </div>

      {/* Security Audit Events Log */}
      <div className="card">
        <div className="card-title-row">
          <span className="card-title">Audited Security Events</span>
          <span className="badge">{securityEvents?.length || 0} LOGGED</span>
        </div>

        {securityEvents && securityEvents.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {securityEvents.map((evt, i) => (
              <div
                key={evt.eventId || evt._id || i}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#ffffff', fontFamily: 'Chakra Petch' }}>
                  <span>{evt.eventType}</span>
                  <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', fontSize: 10 }}>
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {evt.message || 'Security sensor trigger'}
                </div>
                {evt.cameraEventId && (
                  <div style={{ fontSize: 10, color: '#ffffff', marginTop: 4, fontFamily: 'JetBrains Mono' }}>
                    📷 SNAPSHOT: {evt.cameraEventId}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
            No security violations recorded. System perimeter secure.
          </div>
        )}
      </div>
    </div>
  );
}

export function NotificationsScreen() {
  const { notifications } = useBike();

  return (
    <div>
      <div className="top-header">
        <div>
          <h2 style={{ fontFamily: 'Chakra Petch', fontSize: 22, color: '#ffffff', letterSpacing: '0.04em' }}>NOTIFICATIONS</h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Alerts, Geofence & System Events</p>
        </div>
      </div>

      <div className="card">
        {notifications && notifications.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notifications.map((n, i) => (
              <div
                key={n._id || i}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#ffffff', fontFamily: 'Chakra Petch' }}>
                  <span>{n.title}</span>
                  <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', fontSize: 10 }}>
                    {new Date(n.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{n.body}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
            No new notifications.
          </div>
        )}
      </div>
    </div>
  );
}
