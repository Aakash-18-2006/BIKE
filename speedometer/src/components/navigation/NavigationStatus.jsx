import React, { useState } from 'react';

export const QUICK_DESTINATIONS = [
  { name: 'Hosur', lat: 12.7409, lng: 77.8253, label: 'Hosur (NH 44)' },
  { name: 'Electronic City', lat: 12.8452, lng: 77.6602, label: 'Electronic City Phase 1' },
  { name: 'MG Road', lat: 12.9756, lng: 77.6066, label: 'MG Road / Metro Station' },
  { name: 'Whitefield', lat: 12.9698, lng: 77.7499, label: 'Whitefield ITPL' },
  { name: 'Koramangala', lat: 12.9352, lng: 77.6245, label: 'Koramangala 5th Block' },
  { name: 'KIA Airport', lat: 13.1986, lng: 77.7066, label: 'Kempegowda Int. Airport' },
];

/**
 * NavigationStatus - Reusable Navigation Status HUD Bar for TFT
 * 
 * Displays:
 * - Current Destination badge ("MG ROAD") with interactive destination picker
 * - Speed Limit indicator circle
 * - Real-time GPS Satellite connectivity status
 */
export function NavigationStatus({ destination, route, gps, currentLocation, onSelectDestination }) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const destName = destination?.name || 'Select Destination';
  const speedLimit = route?.speedLimitKm || 60;
  const satellites = gps?.satellites || 12;

  // Extract City / State from destination object or fallback to current location
  let cityState = '';
  if (destination?.city && destination?.state) {
    cityState = `${destination.city} / ${destination.state}`;
  } else if (destination?.city) {
    cityState = destination.city;
  } else if (destination?.state) {
    cityState = destination.state;
  } else if (destination?.address) {
    const parts = destination.address.split(',').map((s) => s.trim()).filter(Boolean);
    const cleaned = parts.filter((p) => !/^\d{5,6}$/.test(p) && p.toLowerCase() !== 'india');
    if (cleaned.length >= 2) {
      cityState = `${cleaned[cleaned.length - 2]} / ${cleaned[cleaned.length - 1]}`;
    } else if (cleaned.length === 1) {
      cityState = cleaned[0];
    }
  }
  if (!cityState) {
    cityState = currentLocation?.city ? `${currentLocation.city} / Karnataka` : 'Bengaluru / Karnataka';
  }

  const handleSelect = (d) => {
    setIsPickerOpen(false);
    if (typeof onSelectDestination === 'function') {
      onSelectDestination({
        name: d.name,
        lat: d.lat,
        lng: d.lng,
      });
    }
  };

  return (
    <div className="tft-nav-status-bar">
      {/* City & Destination Banner (Interactive on TFT) */}
      <div
        className="tft-nav-dest-pill"
        onClick={() => setIsPickerOpen((prev) => !prev)}
        style={{ cursor: 'pointer', position: 'relative' }}
        title="Tap to select destination from TFT"
      >
        <span className="tft-nav-dest-icon">◎</span>
        <div className="tft-nav-dest-text">
          <span className="tft-nav-dest-label">DESTINATION</span>
          <span className="tft-nav-dest-target">{destName} ▾</span>
          <span className="tft-nav-dest-citystate">{cityState}</span>
        </div>

        {/* Quick Destination Picker Dropdown */}
        {isPickerOpen && (
          <div
            className="tft-dest-picker-dropdown"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '8px',
              backgroundColor: 'rgba(10, 15, 25, 0.95)',
              border: '1px solid rgba(0, 240, 255, 0.4)',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
              zIndex: 100,
              minWidth: '220px',
              backdropFilter: 'blur(12px)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '6px 12px',
                fontSize: '10px',
                fontFamily: 'Chakra Petch, sans-serif',
                letterSpacing: '1px',
                color: 'var(--text-dim, #718096)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                textTransform: 'uppercase',
              }}
            >
              Select Destination
            </div>
            {QUICK_DESTINATIONS.map((d) => (
              <div
                key={d.name}
                onClick={() => handleSelect(d)}
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 240, 255, 0.15)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontWeight: 600 }}>{d.name}</span>
                <span style={{ fontSize: '10px', color: '#00F0FF' }}>{d.lat.toFixed(2)}, {d.lng.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Speed Limit Automotive Badge */}
      <div className="tft-nav-speed-limit" title="Regulatory Speed Limit">
        <span className="tft-limit-text">LIMIT</span>
        <span className="tft-limit-number">{speedLimit}</span>
      </div>

      {/* GPS Satellite Lock Status */}
      <div className="tft-nav-gps-chip" title="GPS Satellite Fix">
        <span className="tft-gps-pulse-dot" />
        <span className="tft-gps-text">GPS 3D ({satellites} SATS)</span>
      </div>
    </div>
  );
}
