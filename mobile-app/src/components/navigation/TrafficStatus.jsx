import React from 'react';

/**
 * TrafficStatus - Displays real-time traffic congestion indicator if provided by Mappls
 * 
 * Safely returns null when Mappls does not provide traffic data.
 */
export function TrafficStatus({ trafficInfo }) {
  if (!trafficInfo || !trafficInfo.available) {
    return null;
  }

  const level = String(trafficInfo.level || 'LOW').toUpperCase();
  const delay = trafficInfo.delayFormatted || '';

  const getTrafficBadge = (lvl) => {
    switch (lvl) {
      case 'SEVERE':
        return { color: '#FF3B30', bg: 'rgba(255, 59, 48, 0.18)', border: '#FF3B30', label: 'TRAFFIC: SEVERE' };
      case 'HIGH':
        return { color: '#FF9500', bg: 'rgba(255, 149, 0, 0.18)', border: '#FF9500', label: 'TRAFFIC: HEAVY' };
      case 'MODERATE':
        return { color: '#FFD60A', bg: 'rgba(255, 214, 10, 0.18)', border: '#FFD60A', label: 'TRAFFIC: MODERATE' };
      case 'LOW':
      default:
        return { color: '#30D158', bg: 'rgba(48, 209, 88, 0.18)', border: '#30D158', label: 'TRAFFIC: LIGHT' };
    }
  };

  const badge = getTrafficBadge(level);

  return (
    <div
      className="traffic-status-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        borderRadius: 6,
        background: badge.bg,
        border: `1px solid ${badge.border}`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: badge.color,
          boxShadow: `0 0 6px ${badge.color}`,
        }}
      />
      <span
        style={{
          fontFamily: 'Chakra Petch',
          fontSize: 10,
          fontWeight: 700,
          color: badge.color,
          letterSpacing: '0.04em',
        }}
      >
        {badge.label} {delay ? `(+${delay})` : ''}
      </span>
    </div>
  );
}

export default TrafficStatus;
