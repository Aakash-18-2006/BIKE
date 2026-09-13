import React from 'react';
import { NavigationMap } from './NavigationMap.jsx';
import { NavigationTurnCard } from './NavigationTurnCard.jsx';
import { NavigationStatus } from './NavigationStatus.jsx';
import { SAMPLE_NAVIGATION_DATA } from './navigationModel.js';

/**
 * NavigationMode - Comprehensive Navigation Screen for Smart Bike TFT
 * 
 * Replaces the central cluster with a high-visibility central Mappls Navigation container,
 * while keeping the surrounding motorcycle dashboard elements intact:
 * - Left flank: Battery Gauge + EV RANGE
 * - Right flank: Fuel Gauge + FUEL RANGE
 * - Overlaid HUD Turn Card: Next Turn Arrow ("Right"), "450 m", "MG Road", "8.4 km", ETA "12:48"
 * - Overlaid Status Bar: Destination, Speed Limit, GPS Satellite fix
 */
export function NavigationMode({
  navigationData = SAMPLE_NAVIGATION_DATA,
  onExitNavigation,
  onSelectDestination,
}) {
  const data = navigationData || SAMPLE_NAVIGATION_DATA;

  return (
    <div className="tft-navigation-stage">
      {/* 1. Large Central Mappls Navigation Container */}
      <NavigationMap
        currentLocation={data.currentLocation}
        destination={data.destination}
        route={data.route}
        className="tft-central-nav-map"
      />

      {/* 2. Overlaid Turn-by-Turn HUD Card (Top-Left of map) */}
      {(data.active || data.status === 'ARRIVED') && (
        <div className="tft-nav-turn-overlay">
          <NavigationTurnCard
            nextTurn={data.nextTurn}
            route={data.route}
            status={data.status}
            trafficInfo={data.trafficInfo}
          />
        </div>
      )}

      {/* 3. Overlaid Navigation Status Bar (Top-Right / Header of map) */}
      <div className="tft-nav-status-overlay">
        <NavigationStatus
          destination={data.destination}
          route={data.route}
          gps={data.gps}
          currentLocation={data.currentLocation}
          onSelectDestination={onSelectDestination}
        />
      </div>

      {/* 4. Quick Return to Speedometer Dashboard Button */}
      {onExitNavigation && (
        <button
          className="tft-nav-close-btn"
          onClick={onExitNavigation}
          title="Return to Speedometer Instrument Cluster [M]"
        >
          <span>✕</span>
          <span>CLOSE MAP</span>
        </button>
      )}
    </div>
  );
}
