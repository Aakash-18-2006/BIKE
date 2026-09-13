/**
 * GPS Reliability, Outlier Filtering & Heading Stabilization for Smart Bike
 * 
 * Provides:
 * - GPS accuracy & quality classification (GOOD, FAIR, POOR, INVALID)
 * - Jump / outlier protection against teleportation spikes
 * - Heading stabilization with 0°/360° wrapping
 * - Session state filtering without fabricating data
 */

import { haversineDistance } from '../navigation/mapplsNavigationEngine.js';

/**
 * Evaluates real-world GPS quality based on geographic validity and accuracy radius.
 */
export function evaluateGpsQuality(coords) {
  if (!coords) {
    return { quality: 'INVALID', reason: 'Null or missing coordinates' };
  }

  const lat = coords.lat ?? coords.latitude;
  const lng = coords.lng ?? coords.longitude;

  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { quality: 'INVALID', reason: 'Non-finite latitude or longitude' };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { quality: 'INVALID', reason: 'Coordinates out of geographic range [-90..90, -180..180]' };
  }

  const accuracy = Number.isFinite(coords.accuracy) ? coords.accuracy : null;

  if (accuracy !== null) {
    if (accuracy <= 15) return { quality: 'GOOD', accuracy };
    if (accuracy <= 35) return { quality: 'FAIR', accuracy };
    return { quality: 'POOR', accuracy };
  }

  // When accuracy is not provided by device, treat as standard baseline without fabricating numbers
  return { quality: 'GOOD', accuracy: null };
}

/**
 * Calculates the shortest signed angular difference between two headings in degrees [-180, 180].
 * Correctly resolves the 0°/360° boundary (e.g. 359° to 1° is +2°, not -358°).
 */
export function calculateShortestAngularDiff(targetHeading, currentHeading) {
  if (!Number.isFinite(targetHeading) || !Number.isFinite(currentHeading)) return 0;
  return ((((targetHeading - currentHeading) % 360) + 540) % 360) - 180;
}

/**
 * Smooths heading changes to prevent rapid left/right camera and arrow oscillation.
 * Suppresses stationary micro-jitter while preserving quick response during legitimate turns.
 */
export function smoothHeading(newHeading, prevHeading, speedMps = 0, alpha = 0.35) {
  if (!Number.isFinite(newHeading)) {
    return Number.isFinite(prevHeading) ? prevHeading : null;
  }

  if (!Number.isFinite(prevHeading)) {
    return Number(((newHeading % 360 + 360) % 360).toFixed(1));
  }

  const diff = calculateShortestAngularDiff(newHeading, prevHeading);

  // When motorcycle is stationary or nearly stopped (< 0.8 m/s ~ 3 km/h),
  // suppress small heading jitter (< 12°) caused by smartphone compass noise.
  if (speedMps < 0.8 && Math.abs(diff) < 12) {
    return prevHeading;
  }

  const smoothed = (prevHeading + diff * alpha + 360) % 360;
  return Number(smoothed.toFixed(1));
}

/**
 * Stateful GPS Reliability & Outlier Filter for active navigation sessions.
 */
export class GpsReliabilityFilter {
  constructor(options = {}) {
    // Maximum plausible motorcycle velocity in m/s (55 m/s = 198 km/h)
    this.maxMotorcycleSpeedMps = options.maxSpeedMps || 55;
    this.lastAcceptedLocation = null;
    this.lastAcceptedTime = 0;
    this.prevHeading = null;
    this.consecutiveRejections = 0;
  }

  reset() {
    this.lastAcceptedLocation = null;
    this.lastAcceptedTime = 0;
    this.prevHeading = null;
    this.consecutiveRejections = 0;
  }

  /**
   * Filters incoming GPS reading. Returns accepted location or fallback to last accepted location.
   */
  process(rawCoords, timestamp = Date.now()) {
    const evalResult = evaluateGpsQuality(rawCoords);

    if (evalResult.quality === 'INVALID') {
      return {
        accepted: false,
        reason: evalResult.reason,
        location: this.lastAcceptedLocation,
        quality: 'INVALID',
      };
    }

    const lat = rawCoords.lat ?? rawCoords.latitude;
    const lng = rawCoords.lng ?? rawCoords.longitude;
    const accuracy = evalResult.accuracy;
    const reportedSpeed = Number.isFinite(rawCoords.speed) ? Math.max(0, rawCoords.speed) : 0;
    const rawHeading = Number.isFinite(rawCoords.heading) && rawCoords.heading >= 0 && rawCoords.heading <= 360
      ? rawCoords.heading
      : null;

    // First accepted fix
    if (!this.lastAcceptedLocation) {
      const initialHeading = rawHeading !== null ? smoothHeading(rawHeading, null, reportedSpeed) : null;
      this.lastAcceptedLocation = {
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        accuracy,
        speed: reportedSpeed,
        heading: initialHeading,
        quality: evalResult.quality,
        timestamp,
      };
      this.lastAcceptedTime = timestamp;
      this.prevHeading = initialHeading;
      return {
        accepted: true,
        location: this.lastAcceptedLocation,
        quality: evalResult.quality,
      };
    }

    const dt = Math.max(0.1, (timestamp - this.lastAcceptedTime) / 1000);
    const dist = haversineDistance(
      this.lastAcceptedLocation.lat,
      this.lastAcceptedLocation.lng,
      lat,
      lng
    );
    const impliedSpeed = dist / dt;

    // Outlier Check:
    // Reject sudden teleportation spikes (> 120m in < 2s, or speed > 55 m/s / ~200 km/h)
    // Protection: allow relocation if 3 consecutive readings confirm the new spot (e.g. after long tunnel)
    const isImplausibleSpeed = impliedSpeed > this.maxMotorcycleSpeedMps && dt < 8;
    const isExtremeJump = dist > 120 && dt < 2.5;

    if ((isImplausibleSpeed || isExtremeJump) && this.consecutiveRejections < 3) {
      this.consecutiveRejections++;
      console.warn(`[GPS] rejected outlier: jumped ${dist.toFixed(1)}m in ${dt.toFixed(1)}s (implied ${(impliedSpeed * 3.6).toFixed(0)} km/h)`);
      return {
        accepted: false,
        reason: 'Implausible GPS jump / outlier',
        location: this.lastAcceptedLocation,
        quality: 'REJECTED_OUTLIER',
      };
    }

    // Reading accepted
    this.consecutiveRejections = 0;
    const smoothedH = rawHeading !== null
      ? smoothHeading(rawHeading, this.prevHeading, reportedSpeed)
      : this.prevHeading;

    if (smoothedH !== null) {
      this.prevHeading = smoothedH;
    }

    this.lastAcceptedLocation = {
      lat,
      lng,
      latitude: lat,
      longitude: lng,
      accuracy,
      speed: reportedSpeed,
      heading: smoothedH,
      quality: evalResult.quality,
      timestamp,
    };
    this.lastAcceptedTime = timestamp;

    return {
      accepted: true,
      location: this.lastAcceptedLocation,
      quality: evalResult.quality,
    };
  }
}

export default {
  evaluateGpsQuality,
  calculateShortestAngularDiff,
  smoothHeading,
  GpsReliabilityFilter,
};
