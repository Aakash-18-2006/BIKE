import React, { useState, useEffect } from 'react';
import { useBike } from '../context/BikeContext.jsx';
import { Icon } from '../components/common/Icons.jsx';

export function LiveStatusScreen() {
  const { status } = useBike();
  const isIgnitionOn = status.ignition === true;

  return (
    <div>
      <div className="top-header">
        <div>
          <h2 style={{ fontFamily: 'Chakra Petch', fontSize: 22, color: '#ffffff', letterSpacing: '0.04em' }}>LIVE TELEMETRY</h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Real-time Motorcycle Telemetry Stream</p>
        </div>
        <span className="badge" style={{
          background: isIgnitionOn ? '#ffffff' : '#111113',
          color: isIgnitionOn ? '#000000' : '#8e8e93',
          border: isIgnitionOn ? '1px solid #ffffff' : '1px solid rgba(255,255,255,0.15)',
          fontFamily: 'Chakra Petch',
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}>
          {isIgnitionOn ? '● DRIVE SYSTEM ACTIVE' : '○ STANDBY'}
        </span>
      </div>

      {/* Hero Speed & RPM Display */}
      <div
        className="card"
        style={{
          textAlign: 'center',
          padding: '24px 16px',
          background: 'linear-gradient(180deg, #111114 0%, #08080a 100%)',
          borderColor: isIgnitionOn ? 'rgba(255,255,255,0.3)' : 'var(--border-subtle)',
        }}
      >
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)' }}>
          VEHICLE VELOCITY
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', margin: '8px 0 12px 0' }}>
          <span style={{ fontFamily: 'Chakra Petch', fontSize: 72, fontWeight: 700, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {status.speed || 0}
          </span>
          <span style={{ fontSize: 16, color: 'var(--text-muted)', fontFamily: 'Chakra Petch', marginLeft: 8, fontWeight: 700, letterSpacing: '0.05em' }}>
            KM/H
          </span>
        </div>

        {/* Tachometer RPM Bar */}
        <div style={{ marginTop: 12, padding: '0 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', marginBottom: 6 }}>
            <span>TACHOMETER</span>
            <span style={{ color: '#ffffff', fontWeight: 700 }}>{status.rpm || 0} RPM</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, ((status.rpm || 0) / 11000) * 100)}%`,
                background: (status.rpm || 0) > 8800 ? '#ff3b30' : '#ffffff',
                borderRadius: 3,
                transition: 'width 0.15s ease',
              }}
            ></div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 20, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>GEAR</div>
            <div style={{ fontFamily: 'Chakra Petch', fontSize: 24, fontWeight: 700, color: '#ffffff', marginTop: 2 }}>
              {status.gear || (isIgnitionOn ? '1' : 'N')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>COOLANT</div>
            <div style={{ fontFamily: 'Chakra Petch', fontSize: 24, fontWeight: 700, color: (status.engineTemp || 25) > 105 ? '#ff3b30' : '#ffffff', marginTop: 2 }}>
              {status.engineTemp || 25}°C
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>BATTERY</div>
            <div style={{ fontFamily: 'Chakra Petch', fontSize: 24, fontWeight: 700, color: '#ffffff', marginTop: 2 }}>
              {status.batteryVoltage || 12.58}V
            </div>
          </div>
        </div>
      </div>

      {/* Sensor Vitals */}
      <div className="card">
        <div className="card-title-row">
          <span className="card-title">Vehicle Subsystems</span>
          <span className="badge">CAN-BUS ACTIVE</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 10 }}>
          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>LIGHTING</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: status.headlight ? '#ffffff' : '#8e8e93', marginTop: 3, fontFamily: 'Chakra Petch' }}>
              {status.headlight ? (status.highBeam ? 'HIGH BEAM ACTIVE' : 'LOW BEAM ACTIVE') : 'OFF'}
            </div>
          </div>

          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>INDICATORS</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: status.indicators !== 'OFF' ? '#ff9f0a' : '#8e8e93', marginTop: 3, fontFamily: 'Chakra Petch' }}>
              {status.indicators || 'OFF'}
            </div>
          </div>

          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>POWER BUS</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: isIgnitionOn ? '#ffffff' : '#8e8e93', marginTop: 3, fontFamily: 'Chakra Petch' }}>
              {isIgnitionOn ? '12V BUS NOMINAL' : '4G SLEEP STANDBY'}
            </div>
          </div>

          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>PERIMETER ALARM</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: status.alarmArmed ? '#ffffff' : '#8e8e93', marginTop: 3, fontFamily: 'Chakra Petch' }}>
              {status.alarmArmed ? 'ARMED & MONITORING' : 'DISARMED'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LocationScreen({ onNavigate }) {
  const { status, motorcycle } = useBike();
  const [userLocation, setUserLocation] = useState(null);
  const [locatedBike, setLocatedBike] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(10);

  const lat = status.gps?.latitude || 12.9785;
  const lon = status.gps?.longitude || 77.6408;
  const isOnline = status.isOnline !== false;
  const speed = status.speed || 0;
  const isMoving = speed > 0.5;

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setSecondsAgo(0);
  }, [status.gps?.latitude, status.gps?.longitude]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        () => {
          setUserLocation({ latitude: 12.9716, longitude: 77.5946, accuracy: 5.0 });
        }
      );
    }
  }, []);

  const calculateDistanceKm = () => {
    if (!userLocation) return '0.85';
    const R = 6371;
    const dLat = ((lat - userLocation.latitude) * Math.PI) / 180;
    const dLon = ((lon - userLocation.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userLocation.latitude * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
  };

  const handleLocateBike = () => {
    setLocatedBike(true);
    setTimeout(() => setLocatedBike(false), 1500);
  };

  const handleNavigateToBike = () => {
    if (typeof onNavigate === 'function') {
      onNavigate('navigation');
    } else {
      setLocatedBike(true);
      setTimeout(() => setLocatedBike(false), 1500);
    }
  };

  return (
    <div>
      <div className="top-header">
        <div>
          <h2 style={{ fontFamily: 'Chakra Petch', fontSize: 22, color: '#ffffff', letterSpacing: '0.04em' }}>LIVE LOCATION</h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {isOnline ? 'LTE High-Precision Positioning' : 'Last Known Location'}
          </p>
        </div>
        <span className="badge" style={{
          background: isOnline ? '#ffffff' : '#111113',
          color: isOnline ? '#000000' : '#8e8e93',
          border: '1px solid rgba(255,255,255,0.2)',
          fontFamily: 'Chakra Petch',
          fontWeight: 700,
        }}>
          {isOnline ? '● GPS LOCKED' : '○ LAST KNOWN'}
        </span>
      </div>

      {/* Map Viewport Card */}
      <div
        className="card"
        style={{
          height: 290,
          position: 'relative',
          background: '#0a0a0c',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          border: '1px solid var(--border-subtle)',
          transform: locatedBike ? 'scale(1.02)' : 'none',
          transition: 'transform 0.3s ease',
        }}
      >
        {/* Radar Rings & Grid Lines */}
        <div style={{ position: 'absolute', width: 280, height: 280, border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', width: 180, height: 180, border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', width: '100%', height: 1, background: 'rgba(255, 255, 255, 0.05)' }}></div>
        <div style={{ position: 'absolute', height: '100%', width: 1, background: 'rgba(255, 255, 255, 0.05)' }}></div>

        {/* Route Line from User to Bike */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <line x1="80" y1="210" x2="190" y2="120" stroke="#ffffff" strokeWidth="2" strokeDasharray="6,4" opacity="0.8" />
        </svg>

        {/* User Location Pin */}
        <div style={{ position: 'absolute', left: 65, top: 195, textAlign: 'center' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ffffff', color: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(255,255,255,0.4)' }}>
            <span style={{ fontSize: 13 }}>🚶</span>
          </div>
          <span style={{ fontSize: 9, color: '#ffffff', fontWeight: 700, fontFamily: 'Chakra Petch', letterSpacing: '0.08em' }}>YOU</span>
        </div>

        {/* Motorcycle Location Pin */}
        <div style={{ position: 'absolute', left: 170, top: 100, textAlign: 'center', zIndex: 10 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: '#ffffff',
              color: '#000000',
              boxShadow: '0 0 25px rgba(255,255,255,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 6px auto',
              border: '2px solid #000000',
            }}
          >
            <span style={{ fontSize: 20 }}>🏍️</span>
          </div>
          <div style={{ background: '#000000', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', fontFamily: 'Chakra Petch', letterSpacing: '0.04em' }}>
              {(motorcycle?.name ? motorcycle.name.replace(/Apex/g, 'AEROVYN') : 'AEROVYN')} {isMoving ? `(${Math.round(speed)} km/h)` : '· PARKED'}
            </span>
          </div>
        </div>

        {/* Last Updated Timestamp & Status Overlay */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 14,
            background: 'rgba(0, 0, 0, 0.85)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 10,
            fontFamily: 'JetBrains Mono',
          }}
        >
          <div style={{ color: 'var(--text-muted)' }}>STATUS:</div>
          <div style={{ fontWeight: 700, color: isOnline ? '#ffffff' : '#8e8e93' }}>
            {isOnline ? 'LTE TELEMETRY ACTIVE' : 'OFFLINE (CACHED FIX)'}
          </div>
          <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
            Fix: {secondsAgo < 5 ? 'Realtime' : `${secondsAgo}s ago`}
          </div>
        </div>

        {/* Bottom Coordinates & Accuracy */}
        <div style={{ position: 'absolute', bottom: 10, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
          <span>LAT: {lat.toFixed(5)}</span>
          <span>LON: {lon.toFixed(5)}</span>
          <span>ACCURACY: ±{status.gps?.accuracy || 1.8}m</span>
        </div>
      </div>

      {/* Action Buttons: [ LOCATE BIKE ] & [ NAVIGATE TO BIKE ] */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
        <button
          onClick={handleLocateBike}
          className="btn-secondary"
          style={{
            padding: '13px',
            borderRadius: 10,
            fontFamily: 'Chakra Petch',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            letterSpacing: '0.04em',
          }}
        >
          <span>🎯</span>
          <span>LOCATE BIKE</span>
        </button>

        <button
          onClick={handleNavigateToBike}
          className="btn-primary"
          style={{
            padding: '13px',
            borderRadius: 10,
            fontFamily: 'Chakra Petch',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            letterSpacing: '0.04em',
          }}
        >
          <span>🧭</span>
          <span>NAVIGATE TO BIKE</span>
        </button>
      </div>

      {/* Route & Telemetry Cards */}
      <div className="card">
        <div className="card-title-row">
          <span className="card-title">Proximity & Tracking Telemetry</span>
          <Icon name="mapPin" size={16} color="#ffffff" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 10 }}>
          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>DISTANCE TO BIKE</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', fontFamily: 'Chakra Petch', marginTop: 3 }}>
              {calculateDistanceKm()} KM
            </div>
          </div>

          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>VEHICLE MOVEMENT</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', fontFamily: 'Chakra Petch', marginTop: 3 }}>
              {isMoving ? `MOVING (${Math.round(speed)} KM/H)` : 'STATIONARY'}
            </div>
          </div>

          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>HEADING</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', fontFamily: 'Chakra Petch', marginTop: 3 }}>
              {status.gps?.heading || 78}° NE
            </div>
          </div>

          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TCU LINK</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: isOnline ? '#ffffff' : '#8e8e93', fontFamily: 'Chakra Petch', marginTop: 3 }}>
              {isOnline ? 'LTE ONLINE' : 'OFFLINE'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
