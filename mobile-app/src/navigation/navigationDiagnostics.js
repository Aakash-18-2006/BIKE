/**
 * Lightweight Safe Navigation Diagnostics & Telemetry Monitor for Smart Bike
 *
 * Development-only, throttled diagnostic system that exposes:
 * - navigationSessionId & sequence
 * - GPS latitude, longitude, accuracy, speed, heading, quality
 * - distance from route, route progress, remaining distance
 * - distance to next maneuver, step index, total steps, maneuver
 * - navigation lifecycle status, rerouting state, ETA, arrival state, timestamp
 *
 * Designed for real-world field trials:
 * - Completely silent in production builds (zero performance/logging overhead)
 * - Throttled in development to prevent console flooding
 * - Emits immediate logs on critical navigation lifecycle events
 */

const IS_DEV = typeof import.meta !== 'undefined' && import.meta.env ? Boolean(import.meta.env.DEV) : (process.env.NODE_ENV !== 'production');

export class NavigationDiagnostics {
  constructor(options = {}) {
    this.throttleIntervalMs = options.throttleIntervalMs || 1500;
    this.lastLoggedTime = 0;
    this.lastLoggedStatus = null;
    this.lastLoggedStepIndex = null;
    this.lastLoggedManeuver = null;
    this.latestSnapshot = null;
  }

  /**
   * Records a navigation telemetry event and emits throttled diagnostics in development mode.
   *
   * @param {Object} params
   * @param {Object} params.telemetry - Output of processNavigationTick
   * @param {Object} [params.currentLocation] - Raw or filtered GPS location
   * @param {Object} [params.destination] - Active destination object
   * @param {Object} [params.tftPacket] - Current bridge packet if available
   */
  record({ telemetry, currentLocation, destination, tftPacket }) {
    if (!telemetry) return null;

    const now = Date.now();
    const lat = Number(telemetry.currentLocation?.lat ?? currentLocation?.lat ?? currentLocation?.latitude ?? 0);
    const lng = Number(telemetry.currentLocation?.lng ?? currentLocation?.lng ?? currentLocation?.longitude ?? 0);
    const accuracy = Number.isFinite(currentLocation?.accuracy) ? currentLocation.accuracy : null;
    const speed = Number.isFinite(currentLocation?.speed) ? Number((currentLocation.speed * 3.6).toFixed(1)) : 0; // km/h
    const heading = Number.isFinite(currentLocation?.heading) ? Math.round(currentLocation.heading) : null;
    const quality = currentLocation?.quality || (accuracy != null ? (accuracy <= 15 ? 'GOOD' : accuracy <= 35 ? 'FAIR' : 'POOR') : 'UNKNOWN');

    const sessionId = tftPacket?.navigationSessionId || telemetry.navigationSessionId || 'none';
    const sequence = tftPacket?.sequence || telemetry.sequence || 0;
    const status = tftPacket?.navigationStatus || telemetry.navigationStatus || 'IDLE';
    const maneuver = telemetry.nextManeuver || 'CONTINUE';
    const stepIndex = telemetry.currentStepIndex || 0;
    const totalSteps = telemetry.totalSteps || 0;
    const distToManeuver = telemetry.distanceToManeuver || 0;
    const remainingDistance = telemetry.distanceRemaining || 0;
    const progress = telemetry.progress || 0;
    const eta = telemetry.durationRemainingFormatted || telemetry.eta || '0 min';
    const isRerouting = Boolean(telemetry.isRerouting);
    const arrived = Boolean(telemetry.arrived || telemetry.isDestinationReached);
    const distFromRoute = telemetry.offRouteDistance || 0;

    const snapshot = {
      navigationSessionId: sessionId,
      sequence,
      gps: {
        latitude: lat,
        longitude: lng,
        accuracy,
        speedKmH: speed,
        headingDeg: heading,
        quality,
      },
      route: {
        distanceFromRouteMeters: distFromRoute,
        progressPercent: progress,
        remainingDistanceMeters: remainingDistance,
        distanceToNextManeuverMeters: distToManeuver,
        stepIndex,
        totalSteps,
        maneuver,
      },
      lifecycle: {
        navigationStatus: status,
        isRerouting,
        eta,
        arrived,
      },
      destination: destination ? {
        name: destination.name || destination.address || 'Destination',
        lat: destination.lat ?? destination.latitude,
        lng: destination.lng ?? destination.longitude,
      } : null,
      timestamp: now,
    };

    this.latestSnapshot = snapshot;

    // Check if this is a critical event that requires immediate diagnostic output
    const isStatusChange = status !== this.lastLoggedStatus;
    const isStepChange = stepIndex !== this.lastLoggedStepIndex;
    const isManeuverChange = maneuver !== this.lastLoggedManeuver;
    const isCritical = isStatusChange || isStepChange || isManeuverChange || isRerouting || arrived;

    const timeSinceLastLog = now - this.lastLoggedTime;
    const shouldLog = isCritical || timeSinceLastLog >= this.throttleIntervalMs;

    if (IS_DEV && shouldLog) {
      this.lastLoggedTime = now;
      this.lastLoggedStatus = status;
      this.lastLoggedStepIndex = stepIndex;
      this.lastLoggedManeuver = maneuver;

      const flag = isCritical ? '⚡' : '⏱️';
      const gpsStr = `${lat.toFixed(5)}, ${lng.toFixed(5)} (${accuracy ? `±${accuracy}m` : 'no acc'}, ${speed}km/h, ${heading != null ? `${heading}°` : 'no hdg'})`;
      const navStr = `${maneuver} in ${distToManeuver}m (step ${stepIndex + 1}/${totalSteps}) | rem: ${remainingDistance}m (${eta}) | prog: ${progress}%`;
      console.log(`[NAV DIAG ${flag}] #${sequence} [${status}] GPS: ${gpsStr} | Route: ${navStr}`);
    }

    return snapshot;
  }

  /**
   * Retrieves the latest diagnostic telemetry snapshot.
   */
  getLatestDiagnostics() {
    return this.latestSnapshot;
  }

  /**
   * Resets diagnostic counters and history.
   */
  reset() {
    this.lastLoggedTime = 0;
    this.lastLoggedStatus = null;
    this.lastLoggedStepIndex = null;
    this.lastLoggedManeuver = null;
    this.latestSnapshot = null;
  }
}

export const navigationDiagnostics = new NavigationDiagnostics();
export default navigationDiagnostics;
