/**
 * TFT Navigation Bridge & Session Synchronization Service
 * 
 * Provides:
 * 1. Monotonic Session Management (navigationSessionId)
 * 2. Monotonic Packet Sequencing (sequence & timestamp)
 * 3. In-memory Latest Navigation Snapshot storage
 * 4. Safe Packet Factory with Throttling for Flooding Prevention
 * 5. Lifecycle Packet generation (NAVIGATING, GPS_LOST, GPS_RECOVERED, OFF_ROUTE, REROUTING, ARRIVED, STOPPED)
 */

export class TftNavigationBridge {
  constructor() {
    this.currentSessionId = null;
    this.currentSequence = 0;
    this.latestSnapshot = null;
    this.lastEmittedTime = 0;
    this.lastEmittedCoord = null;
    this.minUpdateIntervalMs = 300; // Minimum interval between purely informational movement ticks
  }

  /**
   * Generates a unique, collision-free navigation session ID.
   * Example: "nav_1726123456789_a1b2"
   */
  createSession(destinationName = 'Destination') {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    this.currentSessionId = `nav_${timestamp}_${randomSuffix}`;
    this.currentSequence = 0;
    this.latestSnapshot = null;
    this.lastEmittedTime = 0;
    this.lastEmittedCoord = null;
    console.log(`[TFT Bridge] Created new navigation session: ${this.currentSessionId} for ${destinationName}`);
    return this.currentSessionId;
  }

  getCurrentSessionId() {
    if (!this.currentSessionId) {
      return this.createSession();
    }
    return this.currentSessionId;
  }

  getNextSequence() {
    this.currentSequence += 1;
    return this.currentSequence;
  }

  getLatestSnapshot() {
    return this.latestSnapshot;
  }

  setLatestSnapshot(packet) {
    this.latestSnapshot = packet;
  }

  /**
   * Builds a complete, standardized navigation packet with session and sequence headers.
   */
  buildPacket(navData, statusOverride = null) {
    const sessionId = this.getCurrentSessionId();
    const seq = this.getNextSequence();
    const timestamp = Date.now();

    const status = statusOverride || navData.navigationStatus || (navData.isNavigating ? 'NAVIGATING' : 'IDLE');

    const packet = {
      ...navData,
      type: 'navigation_update',
      navigationSessionId: sessionId,
      sequence: seq,
      timestamp,
      navigationStatus: status,
      status,
      isNavigating: status !== 'STOPPED' && Boolean(navData.isNavigating),
      isDestinationReached: status === 'ARRIVED' || Boolean(navData.isDestinationReached),
      arrived: status === 'ARRIVED' || Boolean(navData.arrived),
      isRerouting: status === 'REROUTING' || Boolean(navData.isRerouting),
      offRoute: status === 'OFF_ROUTE' || Boolean(navData.offRoute),
    };

    this.latestSnapshot = packet;
    this.lastEmittedTime = timestamp;
    if (packet.current) {
      this.lastEmittedCoord = { lat: packet.current.lat, lng: packet.current.lng };
    }

    return packet;
  }

  /**
   * Builds an explicit STOPPED lifecycle packet to reset the TFT.
   */
  buildStopPacket(currentCoord = null) {
    const sessionId = this.currentSessionId || `nav_${Date.now()}_stop`;
    const seq = this.getNextSequence();
    const timestamp = Date.now();
    const cur = currentCoord ? { lat: currentCoord.lat, lng: currentCoord.lng } : { lat: 12.9716, lng: 77.5946 };

    const stopPacket = {
      type: 'navigation_update',
      navigationSessionId: sessionId,
      sequence: seq,
      timestamp,
      navigationStatus: 'STOPPED',
      status: 'STOPPED',
      isNavigating: false,
      isDestinationReached: false,
      arrived: false,
      isRerouting: false,
      offRoute: false,
      current: cur,
      destination: null,
      maneuver: 'none',
      instruction: '',
      roadName: '',
      distanceToTurn: 0,
      remainingDistance: 0,
      etaMinutes: 0,
      stepIndex: 0,
      totalSteps: 0,
      progress: 0,
      laneAssist: { available: false },
      junctionInfo: { available: false },
      trafficInfo: { available: false },
      route: { geometry: [] },
      distanceToTurnMeters: 0,
      distanceToTurnFormatted: '0 m',
      remainingDistanceMeters: 0,
      remainingDistanceFormatted: '0 m',
    };

    // End session
    this.latestSnapshot = null;
    this.currentSessionId = null;
    this.currentSequence = 0;
    this.lastEmittedCoord = null;

    console.log(`[TFT Bridge] Generated STOPPED packet for session ${sessionId} seq=${seq}`);
    return stopPacket;
  }

  buildStoppedPacket(currentCoord = null) {
    return this.buildStopPacket(currentCoord);
  }

  /**
   * Determines if a non-critical location tick should be emitted or throttled.
   * Lifecycle transitions, maneuver changes, step changes, and arrival are NEVER throttled.
   */
  shouldThrottleTick(isSignificantChange, currentTime = Date.now()) {
    if (isSignificantChange) return false;
    return (currentTime - this.lastEmittedTime) < this.minUpdateIntervalMs;
  }

  reset() {
    this.currentSessionId = null;
    this.currentSequence = 0;
    this.latestSnapshot = null;
    this.lastEmittedTime = 0;
    this.lastEmittedCoord = null;
  }
}

export const tftNavigationBridge = new TftNavigationBridge();
export default tftNavigationBridge;
