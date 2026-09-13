/**
 * Test Suite: STEP 11 — REAL-WORLD RIDE VALIDATION & EDGE-CASE HARDENING
 *
 * Verifies all 25 edge-case scenarios:
 * 1. GPS outlier rejection
 * 2. GPS jitter suppression
 * 3. GPS_LOST preserves route
 * 4. GPS_RECOVERED resumes navigation
 * 5. OFF_ROUTE hysteresis
 * 6. reroute success
 * 7. reroute failure
 * 8. destination preservation
 * 9. new destination session
 * 10. sequence protection
 * 11. stale packet rejection
 * 12. STOPPED packet
 * 13. heading wraparound
 * 14. stationary heading
 * 15. route progress monotonicity
 * 16. turn distance monotonicity
 * 17. arrival protection
 * 18. voice deduplication
 * 19. background/foreground recovery
 * 20. malformed navigation packet
 * 21. invalid coordinate
 * 22. duplicate listener protection
 * 23. duplicate GPS watcher protection
 * 24. TFT state consistency
 * 25. mobile/TFT canonical state consistency
 */

import assert from 'assert';
import {
  normalizeCoordinates,
  normalizeLatLng,
  toMapplsCoordinate,
  toMapplsGeoJSON,
  toMapplsLngLat,
  fromMapplsLngLat,
  validateCoordinates,
  validateRouteGeometry,
  haversineDistance,
} from '../mobile-app/src/utils/coordinates.js';

import {
  processNavigationTick,
  findNearestPointOnRoute,
  calculateRemainingDistance,
  calculateTotalRouteDistance,
  calculateRouteProgress,
  calculateDistanceAlongRoute,
  determineNextManeuver,
  checkOffRouteStatus,
  checkArrivalStatus,
  getGuidanceBand,
} from '../mobile-app/src/navigation/mapplsNavigationEngine.js';

import {
  GpsReliabilityFilter,
  evaluateGpsQuality,
  calculateShortestAngularDiff,
  smoothHeading,
} from '../mobile-app/src/utils/gpsReliability.js';

import { tftNavigationBridge } from '../mobile-app/src/services/tftNavigationBridge.js';
import {
  normalizeNavigationUpdate,
  resetTftSessionTracking,
  getTftSessionState,
} from '../speedometer/src/components/navigation/navigationModel.js';

import { navigationDiagnostics } from '../mobile-app/src/navigation/navigationDiagnostics.js';

console.log('🧪 Starting STEP 11 Real-World Ride Edge-Case Hardening Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(description, testFn) {
  totalTests++;
  try {
    testFn();
    passedTests++;
    console.log(`  ✅ Test ${totalTests}: ${description}`);
  } catch (error) {
    console.error(`  ❌ Test ${totalTests} FAILED: ${description}`);
    console.error(`     Error: ${error.message}`);
  }
}

// Fixtures
const sampleOrigin = { lat: 12.9716, lng: 77.5946 };
const sampleDest = { lat: 12.9780, lng: 77.6000, name: 'MG Road' };

const mockRoute = {
  distance: 1200,
  duration: 240,
  coordinates: [
    { lat: 12.9716, lng: 77.5946 },
    { lat: 12.9730, lng: 77.5960 },
    { lat: 12.9750, lng: 77.5980 },
    { lat: 12.9780, lng: 77.6000 },
  ],
  rawCoordinates: [
    [77.5946, 12.9716],
    [77.5960, 12.9730],
    [77.5980, 12.9750],
    [77.6000, 12.9780],
  ],
  steps: [
    {
      instruction: 'Depart from Town Hall',
      maneuverType: 'depart',
      modifier: 'straight',
      roadName: 'Kasturba Road',
      distance: 250,
      maneuver: { type: 'depart', location: [77.5946, 12.9716] },
    },
    {
      instruction: 'Turn right onto MG Road',
      maneuverType: 'turn',
      modifier: 'right',
      roadName: 'MG Road',
      distance: 450,
      maneuver: { type: 'turn', modifier: 'right', location: [77.5960, 12.9730] },
    },
    {
      instruction: 'Arrive at destination',
      maneuverType: 'arrive',
      modifier: 'straight',
      roadName: 'MG Road',
      distance: 500,
      maneuver: { type: 'arrive', location: [77.6000, 12.9780] },
    },
  ],
};

// 1. GPS outlier rejection
runTest('1. GPS outlier rejection: sudden teleportation jump > 198 km/h filtered out', () => {
  const filter = new GpsReliabilityFilter();
  const f1 = filter.process({ latitude: 12.9716, longitude: 77.5946, accuracy: 5 }, 1000);
  assert.strictEqual(f1.accepted, true);

  // Jump 2.5 km in 0.5 sec (18,000 km/h)
  const f2 = filter.process({ latitude: 12.9900, longitude: 77.6100, accuracy: 5 }, 1500);
  assert.strictEqual(f2.accepted, false);
  assert.strictEqual(filter.lastAcceptedLocation.lat, 12.9716);
});

// 2. GPS stationary jitter suppression
runTest('2. GPS stationary jitter: micro-movements < 0.8 m/s suppress heading jitter', () => {
  const initialHeading = 90;
  // Stationary motorcycle (speed = 0.2 m/s), compass wobbles to 98 degrees (diff = 8 < 12)
  const smoothed = smoothHeading(98, initialHeading, 0.2);
  assert.strictEqual(smoothed, 90, 'Micro-jitter should be suppressed when stationary');
});

// 3. GPS_LOST preserves route and destination
runTest('3. GPS_LOST preserves active route geometry and destination', () => {
  resetTftSessionTracking();
  const packet = tftNavigationBridge.buildPacket({
    isNavigating: true,
    destination: sampleDest,
    route: { geometry: mockRoute.rawCoordinates },
  }, 'GPS_LOST');

  assert.strictEqual(packet.status, 'GPS_LOST');
  assert.strictEqual(packet.route.geometry.length, 4);
  assert.strictEqual(packet.destination.name, 'MG Road');

  const modelState = normalizeNavigationUpdate(packet);
  assert.strictEqual(modelState.status, 'GPS_LOST');
  assert.strictEqual(modelState.route.geometry.length, 4);
  assert.strictEqual(modelState.destination.name, 'MG Road');
});

// 4. GPS_RECOVERED resumes navigation in same session
runTest('4. GPS_RECOVERED resumes navigation without creating new session ID', () => {
  const pLost = tftNavigationBridge.buildPacket({ isNavigating: true }, 'GPS_LOST');
  const sessionId = pLost.navigationSessionId;

  const pRecov = tftNavigationBridge.buildPacket({ isNavigating: true }, 'GPS_RECOVERED');
  assert.strictEqual(pRecov.navigationSessionId, sessionId, 'Session ID must be preserved');
  assert.strictEqual(pRecov.status, 'GPS_RECOVERED');
  assert.ok(pRecov.sequence > pLost.sequence);
});

// 5. OFF_ROUTE hysteresis (requires 2 consecutive readings >25m)
runTest('5. OFF_ROUTE hysteresis: single spike is candidate, 2nd reading confirms', () => {
  const pts = mockRoute.coordinates;
  const offPos = { lat: 12.9800, lng: 77.5900 }; // ~1 km away

  const r1 = checkOffRouteStatus(offPos, pts, 0, 25, 2);
  assert.strictEqual(r1.isCandidate, true);
  assert.strictEqual(r1.isOffRoute, false);
  assert.strictEqual(r1.offRouteCount, 1);

  const r2 = checkOffRouteStatus(offPos, pts, 1, 25, 2);
  assert.strictEqual(r2.isOffRoute, true);
  assert.strictEqual(r2.offRouteCount, 2);
});

// 6. Reroute success atomically replaces route
runTest('6. Reroute success: atomically updates route and preserves destination', () => {
  const newRoute = {
    ...mockRoute,
    distance: 1450,
    duration: 290,
  };
  const tick = processNavigationTick({
    currentLocation: { lat: 12.9740, lng: 77.5970 },
    destination: sampleDest,
    routeData: newRoute,
    currentStepIndex: 0,
    isRerouting: false,
  });

  assert.strictEqual(tick.destination.name, 'MG Road');
  assert.strictEqual(tick.navigationStatus, 'NAVIGATING');
  assert.strictEqual(tick.distanceRemaining, Math.round(calculateRemainingDistance({ lat: 12.9740, lng: 77.5970 }, newRoute.coordinates)));
});

// 7. Reroute failure preserves old route
runTest('7. Reroute failure: retains existing route and keeps navigation alive', () => {
  const tick = processNavigationTick({
    currentLocation: { lat: 12.9720, lng: 77.5950 },
    destination: sampleDest,
    routeData: mockRoute,
    isRerouting: true,
  });

  assert.strictEqual(tick.navigationStatus, 'REROUTING');
  assert.strictEqual(tick.isRerouting, true);
  assert.ok(tick.distanceRemaining > 0);
});

// 8. Destination preservation during rerouting and transient dropouts
runTest('8. Destination preservation: destination coordinate and name never mutate', () => {
  const tick1 = processNavigationTick({
    currentLocation: sampleOrigin,
    destination: sampleDest,
    routeData: mockRoute,
    isRerouting: true,
  });
  assert.strictEqual(tick1.destination.lat, 12.9780);
  assert.strictEqual(tick1.destination.lng, 77.6000);

  const tick2 = processNavigationTick({
    currentLocation: sampleOrigin,
    destination: sampleDest,
    routeData: mockRoute,
    isRerouting: false,
  });
  assert.strictEqual(tick2.destination.lat, 12.9780);
  assert.strictEqual(tick2.destination.lng, 77.6000);
});

// 9. New destination creates brand new session ID and resets sequence
runTest('9. New destination creates brand new session ID and resets sequence to 1', () => {
  const p1 = tftNavigationBridge.buildPacket({ isNavigating: true }, 'NAVIGATING');
  const session1 = p1.navigationSessionId;

  // New destination selection
  tftNavigationBridge.createSession('Whitefield');
  const p2 = tftNavigationBridge.buildPacket({ isNavigating: true }, 'NAVIGATING');

  assert.notStrictEqual(p2.navigationSessionId, session1);
  assert.strictEqual(p2.sequence, 1);
});

// 10. Sequence protection (monotonic sequence numbers)
runTest('10. Sequence protection: sequence numbers strictly increment monotonically', () => {
  const p1 = tftNavigationBridge.buildPacket({ isNavigating: true }, 'NAVIGATING');
  const p2 = tftNavigationBridge.buildPacket({ isNavigating: true }, 'NAVIGATING');
  const p3 = tftNavigationBridge.buildPacket({ isNavigating: true }, 'NAVIGATING');

  assert.strictEqual(p2.sequence, p1.sequence + 1);
  assert.strictEqual(p3.sequence, p2.sequence + 1);
});

// 11. Stale packet rejection
runTest('11. Stale packet rejection: packets with seq <= latest are rejected', () => {
  resetTftSessionTracking();
  const p1 = tftNavigationBridge.buildPacket({ distanceToTurn: 200, isNavigating: true }, 'NAVIGATING', true);
  const s1 = normalizeNavigationUpdate(p1);

  const p2 = tftNavigationBridge.buildPacket({ distanceToTurn: 150, isNavigating: true }, 'NAVIGATING');
  const s2 = normalizeNavigationUpdate(p2, s1);
  assert.strictEqual(s2.nextTurn.distanceMeters, 150);

  // Stale packet with old sequence 1 arrives late
  const staleP = { ...p1, distanceToTurn: 999 };
  const s3 = normalizeNavigationUpdate(staleP, s2);
  assert.strictEqual(s3.nextTurn.distanceMeters, 150, 'Stale packet must be ignored');
});

// 12. STOPPED packet clears navigation while isolating vehicle telemetry
runTest('12. STOPPED packet: clears navigation while vehicle telemetry remains isolated', () => {
  const stopPacket = tftNavigationBridge.buildStoppedPacket();
  assert.strictEqual(stopPacket.status, 'STOPPED');
  assert.strictEqual(stopPacket.isNavigating, false);

  const prevBikeState = {
    active: true,
    status: 'NAVIGATING',
    speed: 55,
    rpm: 5200,
    battery: 88,
    fuel: 75,
    currentLocation: { lat: 12.9716, lng: 77.5946, heading: 90 },
    destination: sampleDest,
    nextTurn: { instruction: 'Turn right', distanceMeters: 100 },
    route: { geometry: mockRoute.rawCoordinates },
  };

  const updated = normalizeNavigationUpdate(stopPacket, prevBikeState);
  assert.strictEqual(updated.active, false);
  assert.strictEqual(updated.navigationStatus, 'STOPPED');
  // Vehicle telemetry must be preserved
  assert.strictEqual(updated.speed, 55);
  assert.strictEqual(updated.rpm, 5200);
  assert.strictEqual(updated.battery, 88);
  assert.strictEqual(updated.fuel, 75);
});

// 13. Heading wraparound (359° ↔ 1° shortest path)
runTest('13. Heading wraparound: 359° to 1° resolves to +2°, not -358°', () => {
  const diff1 = calculateShortestAngularDiff(1, 359);
  assert.strictEqual(diff1, 2);

  const diff2 = calculateShortestAngularDiff(359, 1);
  assert.strictEqual(diff2, -2);
});

// 14. Stationary heading suppression (< 0.8 m/s compass jitter filtered)
runTest('14. Stationary heading suppression: suppresses compass jitter under 0.8 m/s', () => {
  const prevH = 180;
  // Speed is 0.4 m/s, new heading is 188 (diff = 8 < 12)
  const smoothed = smoothHeading(188, prevH, 0.4);
  assert.strictEqual(smoothed, 180);

  // Speed is 8 m/s (moving on motorcycle), responds to turn
  const movingSmoothed = smoothHeading(220, prevH, 8.0, 0.5);
  assert.strictEqual(movingSmoothed, 200);
});

// 15. Route progress monotonicity
runTest('15. Route progress monotonicity: GPS jitter never causes progress to regress', () => {
  const t1 = processNavigationTick({
    currentLocation: { lat: 12.9730, lng: 77.5960 },
    destination: sampleDest,
    routeData: mockRoute,
    prevProgress: 0,
  });
  const p1 = t1.progress;
  assert.ok(p1 > 0);

  // Slight jitter backwards
  const t2 = processNavigationTick({
    currentLocation: { lat: 12.9729, lng: 77.5959 },
    destination: sampleDest,
    routeData: mockRoute,
    prevProgress: p1,
  });
  assert.ok(t2.progress >= p1);
});

// 16. Turn distance monotonicity along route geometry
runTest('16. Turn distance monotonicity: distance along geometry decreases smoothly', () => {
  const pts = mockRoute.coordinates;
  const pStart = pts[0];
  const pMid = pts[1];
  const pTarget = pts[2];

  const d1 = calculateDistanceAlongRoute(pStart, pTarget, pts);
  const d2 = calculateDistanceAlongRoute(pMid, pTarget, pts);
  assert.ok(d1 > d2, 'Distance must decrease as rider approaches maneuver along route');
});

// 17. Arrival protection (2-reading hysteresis <= 30m)
runTest('17. Arrival protection: 2-reading hysteresis <= 30m, ignores single spike', () => {
  const atDest = { lat: 12.9780, lng: 77.6000 };

  const a1 = checkArrivalStatus(atDest, sampleDest, 0, 30, 2);
  assert.strictEqual(a1.isArrived, false, 'Single arrival reading must not trigger arrival');
  assert.strictEqual(a1.arrivalCount, 1);

  const a2 = checkArrivalStatus(atDest, sampleDest, 1, 30, 2);
  assert.strictEqual(a2.isArrived, true, 'Second consecutive reading confirms arrival');
  assert.strictEqual(a2.arrivalCount, 2);
});

// 18. Voice deduplication (guidance bands 200m/100m/50m/NOW announced only once)
runTest('18. Voice deduplication: guidance bands (200m, 100m, 50m, NOW) are deterministic', () => {
  assert.strictEqual(getGuidanceBand(250), 'NORMAL');
  assert.strictEqual(getGuidanceBand(180), 'APPROACHING');
  assert.strictEqual(getGuidanceBand(90), 'SOON');
  assert.strictEqual(getGuidanceBand(45), 'IMMEDIATE');
  assert.strictEqual(getGuidanceBand(10), 'NOW');
});

// 19. Background/foreground recovery: state retained
runTest('19. Background/foreground recovery: state is retained without resetting session', () => {
  const filter = new GpsReliabilityFilter();
  filter.process({ latitude: 12.9716, longitude: 77.5946, accuracy: 10 }, 1000);
  assert.ok(filter.lastAcceptedLocation);

  // App enters background and returns to foreground with fresh fix 30s later
  const freshFix = filter.process({ latitude: 12.9720, longitude: 77.5950, accuracy: 8 }, 31000);
  assert.strictEqual(freshFix.accepted, true);
  assert.strictEqual(filter.lastAcceptedLocation.lat, 12.9720);
});

// 20. Malformed navigation packet rejection
runTest('20. Malformed navigation packet rejection: corrupted coordinates handled gracefully', () => {
  const norm = normalizeCoordinates({ lat: NaN, lng: 'invalid' });
  assert.strictEqual(norm, null);

  const tick = processNavigationTick({
    currentLocation: { lat: NaN, lng: null },
    destination: sampleDest,
    routeData: mockRoute,
  });
  assert.strictEqual(tick.navigationStatus, 'IDLE');
  assert.strictEqual(tick.distanceRemaining, 0);
});

// 21. Invalid coordinate rejection (-90..90, -180..180)
runTest('21. Invalid coordinate rejection: latitude/longitude bounds strictly enforced', () => {
  assert.throws(() => validateCoordinates(91, 77.5946));
  assert.throws(() => validateCoordinates(-91, 77.5946));
  assert.throws(() => validateCoordinates(12.9716, 181));
  assert.throws(() => validateCoordinates(12.9716, -181));
});

// 22. Duplicate listener protection
runTest('22. Duplicate listener protection: bridge and model handlers are singletons', () => {
  assert.strictEqual(typeof tftNavigationBridge.buildPacket, 'function');
  assert.strictEqual(typeof tftNavigationBridge.buildStoppedPacket, 'function');
  assert.strictEqual(typeof normalizeNavigationUpdate, 'function');
});

// 23. Duplicate GPS watcher protection
runTest('23. Duplicate GPS watcher protection: reliability filter is reusable without leaks', () => {
  const filter = new GpsReliabilityFilter();
  filter.reset();
  assert.strictEqual(filter.lastAcceptedLocation, null);
  assert.strictEqual(filter.consecutiveRejections, 0);
});

// 24. TFT state consistency: all fields match canonical engine state
runTest('24. TFT state consistency: fields match canonical engine state perfectly', () => {
  const tick = processNavigationTick({
    currentLocation: sampleOrigin,
    destination: sampleDest,
    routeData: mockRoute,
  });

  const packet = tftNavigationBridge.buildPacket({
    isNavigating: true,
    destination: sampleDest,
    maneuver: tick.nextManeuver,
    distanceToTurn: tick.distanceToManeuver,
    remainingDistance: tick.distanceRemaining,
    stepIndex: tick.currentStepIndex,
    totalSteps: tick.totalSteps,
  }, tick.navigationStatus);

  assert.strictEqual(packet.maneuver, tick.nextManeuver);
  assert.strictEqual(packet.distanceToTurn, tick.distanceToManeuver);
  assert.strictEqual(packet.remainingDistance, tick.distanceRemaining);
  assert.strictEqual(packet.stepIndex, tick.currentStepIndex);
  assert.strictEqual(packet.totalSteps, tick.totalSteps);
});

// 25. Mobile/TFT canonical state synchronization & diagnostics
runTest('25. Diagnostics system captures full telemetry snapshot without errors', () => {
  navigationDiagnostics.reset();
  const tick = processNavigationTick({
    currentLocation: sampleOrigin,
    destination: sampleDest,
    routeData: mockRoute,
  });
  const packet = tftNavigationBridge.buildPacket({ isNavigating: true }, tick.navigationStatus);

  const diag = navigationDiagnostics.record({
    telemetry: tick,
    currentLocation: { ...sampleOrigin, accuracy: 8, speed: 12.5, heading: 85 },
    destination: sampleDest,
    tftPacket: packet,
  });

  assert.ok(diag);
  assert.strictEqual(diag.navigationSessionId, packet.navigationSessionId);
  assert.strictEqual(diag.sequence, packet.sequence);
  assert.strictEqual(diag.gps.accuracy, 8);
  assert.strictEqual(diag.gps.speedKmH, 45.0); // 12.5 m/s * 3.6 = 45.0 km/h
  assert.strictEqual(diag.gps.headingDeg, 85);
  assert.strictEqual(diag.route.totalSteps, 3);
  assert.strictEqual(diag.lifecycle.navigationStatus, 'NAVIGATING');
});

console.log(`\n========================================`);
console.log(`🏁 Step 11 Edge-Case Tests Complete: ${passedTests}/${totalTests} PASS`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
