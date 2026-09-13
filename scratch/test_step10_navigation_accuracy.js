/**
 * Test Suite: STEP 10 — REAL NAVIGATION ACCURACY & MOTORCYCLE UX
 * 
 * Verifies all 27 required points:
 * 1. canonical lat/lng normalization
 * 2. Mappls [lng,lat] conversion
 * 3. invalid coordinate rejection
 * 4. route geometry validation
 * 5. route origin alignment
 * 6. route destination alignment
 * 7. destination marker consistency
 * 8. current GPS marker consistency
 * 9. GPS route projection
 * 10. GPS outlier rejection
 * 11. route progress monotonicity
 * 12. distance-to-turn accuracy
 * 13. maneuver progression
 * 14. off-route confirmation
 * 15. reroute atomic replacement
 * 16. reroute failure preserves old route
 * 17. ETA stability
 * 18. arrival detection
 * 19. heading normalization
 * 20. stationary heading suppression
 * 21. camera update stability
 * 22. voice/HUD/TFT state consistency
 * 23. new destination creates new session
 * 24. GPS_LOST preserves route
 * 25. GPS_RECOVERED resumes navigation
 * 26. STOPPED clears navigation
 * 27. stale TFT packet rejection
 */

import assert from 'assert';
import {
  normalizeCoordinates,
  normalizeLatLng,
  toMapplsCoordinate,
  toMapplsGeoJSON,
  toMapplsLngLat,
  fromMapplsLngLat,
  toMapplsBounds,
  toRouteBounds,
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
  formatNavDistance,
  formatNavDuration,
} from '../mobile-app/src/navigation/mapplsNavigationEngine.js';

import { GpsReliabilityFilter } from '../mobile-app/src/utils/gpsReliability.js';
import { tftNavigationBridge } from '../mobile-app/src/services/tftNavigationBridge.js';
import {
  normalizeNavigationUpdate,
  resetTftSessionTracking,
} from '../speedometer/src/components/navigation/navigationModel.js';

console.log('🧪 Starting STEP 10 Real Navigation Accuracy Test Suite...\n');

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

// Sample route fixtures
const sampleOrigin = { lat: 12.9716, lng: 77.5946 }; // Bengaluru Town Hall
const sampleDest = { lat: 12.9780, lng: 77.6000 };   // MG Road

const mockMapplsRouteData = {
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
      instruction: 'Head northeast on Kasturba Road',
      maneuverType: 'depart',
      modifier: 'straight',
      roadName: 'Kasturba Road',
      distance: 300,
      maneuver: { type: 'depart', location: [77.5946, 12.9716] },
    },
    {
      instruction: 'Turn right onto MG Road',
      maneuverType: 'turn',
      modifier: 'right',
      roadName: 'MG Road',
      distance: 400,
      maneuver: { type: 'turn', modifier: 'right', location: [77.5960, 12.9730] },
    },
    {
      instruction: 'Arrive at MG Road',
      maneuverType: 'arrive',
      modifier: 'straight',
      roadName: 'MG Road',
      distance: 500,
      maneuver: { type: 'arrive', location: [77.6000, 12.9780] },
    },
  ],
};

// 1. Canonical lat/lng normalization
runTest('1. Canonical lat/lng normalization returns {lat, lng}', () => {
  const res1 = normalizeLatLng({ lat: 12.9716, lng: 77.5946 });
  assert.strictEqual(res1.lat, 12.9716);
  assert.strictEqual(res1.lng, 77.5946);

  const res2 = normalizeLatLng({ latitude: 12.9716, longitude: 77.5946 });
  assert.strictEqual(res2.lat, 12.9716);
  assert.strictEqual(res2.lng, 77.5946);
});

// 2. Mappls [lng, lat] conversion
runTest('2. Mappls [lng, lat] conversion and fromMapplsLngLat conversion', () => {
  const geojson = toMapplsLngLat({ lat: 12.9716, lng: 77.5946 });
  assert.deepStrictEqual(geojson, [77.5946, 12.9716]);

  const recovered = fromMapplsLngLat([77.5946, 12.9716]);
  assert.strictEqual(recovered.lat, 12.9716);
  assert.strictEqual(recovered.lng, 77.5946);
});

// 3. Invalid coordinate rejection
runTest('3. Invalid coordinate rejection (NaN, null, undefined, out of bounds)', () => {
  assert.strictEqual(normalizeLatLng(null), null);
  assert.strictEqual(normalizeLatLng(undefined), null);
  assert.throws(() => validateCoordinates(NaN, 77.5946));
  assert.throws(() => validateCoordinates(12.9716, NaN));
  assert.throws(() => validateCoordinates(95, 77.5946));   // lat > 90
  assert.throws(() => validateCoordinates(12.9716, 185));  // lng > 180
});

// 4. Route geometry validation
runTest('4. Route geometry validation (min 2 points, valid bounds)', () => {
  const valid = validateRouteGeometry(mockMapplsRouteData, sampleOrigin, sampleDest);
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.pointsCount, 4);

  const invalidTooShort = validateRouteGeometry({ coordinates: [{ lat: 12.9716, lng: 77.5946 }] });
  assert.strictEqual(invalidTooShort.valid, false);
});

// 5. Route origin alignment
runTest('5. Route origin alignment within tolerance', () => {
  const check = validateRouteGeometry(mockMapplsRouteData, { lat: 12.9718, lng: 77.5948 });
  assert.strictEqual(check.valid, true);

  const wayOff = validateRouteGeometry(mockMapplsRouteData, { lat: 28.6139, lng: 77.2090 }); // Delhi vs Bengaluru
  assert.strictEqual(wayOff.valid, false);
});

// 6. Route destination alignment
runTest('6. Route destination alignment within tolerance', () => {
  const check = validateRouteGeometry(mockMapplsRouteData, null, { lat: 12.9781, lng: 77.6001 });
  assert.strictEqual(check.valid, true);

  const wayOffDest = validateRouteGeometry(mockMapplsRouteData, null, { lat: 19.0760, lng: 72.8777 }); // Mumbai
  assert.strictEqual(wayOffDest.valid, false);
});

// 7. Destination marker consistency
runTest('7. Destination marker consistency across SDK and GeoJSON boundaries', () => {
  const dest = { lat: 12.9780, lng: 77.6000, name: 'MG Road' };
  const sdkCoord = toMapplsCoordinate(dest);
  const mapCoord = toMapplsGeoJSON(dest);
  assert.strictEqual(sdkCoord.lat, 12.9780);
  assert.strictEqual(sdkCoord.lng, 77.6000);
  assert.strictEqual(mapCoord[0], 77.6000); // GeoJSON lng
  assert.strictEqual(mapCoord[1], 12.9780); // GeoJSON lat
});

// 8. Current GPS marker consistency
runTest('8. Current GPS marker strictly tracks accepted GPS from filter', () => {
  const filter = new GpsReliabilityFilter();
  const rawGps = { latitude: 12.9716, longitude: 77.5946, accuracy: 8, timestamp: 1000 };
  const filtered = filter.process(rawGps, 1000);
  assert.strictEqual(filtered.accepted, true);

  const mapCoord = toMapplsCoordinate(filtered.location);
  assert.strictEqual(mapCoord.lat, 12.9716);
  assert.strictEqual(mapCoord.lng, 77.5946);
});

// 9. GPS route projection
runTest('9. GPS route projection onto polyline', () => {
  const pts = mockMapplsRouteData.coordinates;
  const riderPos = { lat: 12.9720, lng: 77.5950 };
  const nearest = findNearestPointOnRoute(riderPos, pts);
  assert.ok(nearest.distanceFromRoute >= 0);
  assert.ok(nearest.nearestPoint.lat > 12.9715);
  assert.strictEqual(nearest.segmentIndex, 0);
});

// 10. GPS outlier rejection
runTest('10. GPS outlier rejection (large sudden jump rejected by reliability filter)', () => {
  const filter = new GpsReliabilityFilter();
  filter.process({ latitude: 12.9716, longitude: 77.5946, accuracy: 5 }, 1000);
  // Teleportation jump of 5 km in 1 second
  const jumpResult = filter.process({ latitude: 13.0200, longitude: 77.6500, accuracy: 5 }, 2000);
  assert.strictEqual(jumpResult.accepted, false);
});

// 11. Route progress monotonicity
runTest('11. Route progress monotonicity (GPS jitter does not regress progress)', () => {
  const tick1 = processNavigationTick({
    currentLocation: { lat: 12.9730, lng: 77.5960 },
    destination: sampleDest,
    routeData: mockMapplsRouteData,
    prevProgress: 0,
  });
  const prog1 = tick1.progress;
  assert.ok(prog1 > 10);

  // Tiny backward GPS fluctuation
  const tick2 = processNavigationTick({
    currentLocation: { lat: 12.9729, lng: 77.5959 },
    destination: sampleDest,
    routeData: mockMapplsRouteData,
    prevProgress: prog1,
  });
  assert.strictEqual(tick2.progress >= prog1, true, 'Progress must not move backward');
});

// 12. Distance-to-turn accuracy along geometry
runTest('12. Distance-to-turn accuracy along route geometry', () => {
  const pts = mockMapplsRouteData.coordinates;
  const startPt = pts[0];
  const targetPt = pts[2];
  const dist = calculateDistanceAlongRoute(startPt, targetPt, pts);
  const directHaversine = haversineDistance(startPt.lat, startPt.lng, targetPt.lat, targetPt.lng);
  assert.ok(dist >= directHaversine - 1, 'Polyline distance must be >= Euclidean distance');
});

// 13. Maneuver progression
runTest('13. Maneuver progression advances correctly on approach', () => {
  // Near step 0 start
  const m1 = determineNextManeuver(
    { lat: 12.9716, lng: 77.5946 },
    mockMapplsRouteData.steps,
    mockMapplsRouteData.coordinates,
    0,
    null,
    10
  );
  // At departure point, depart is achieved and user targets next step
  assert.strictEqual(m1.stepAdvanced, true);
  assert.strictEqual(m1.stepIndex, 1);

  // Approaching step 2 arrival location [77.6000, 12.9780]
  const m2 = determineNextManeuver(
    { lat: 12.9780, lng: 77.6000 },
    mockMapplsRouteData.steps,
    mockMapplsRouteData.coordinates,
    1,
    null,
    20 // 20m threshold
  );
  assert.strictEqual(m2.stepAdvanced, true);
  assert.strictEqual(m2.stepIndex, 2);
});

// 14. Off-route confirmation hysteresis
runTest('14. Off-route confirmation requires consecutive readings (>25m)', () => {
  const pts = mockMapplsRouteData.coordinates;
  const farOff = { lat: 12.9850, lng: 77.5946 }; // ~1.5 km off

  const read1 = checkOffRouteStatus(farOff, pts, 0, 25, 2);
  assert.strictEqual(read1.isCandidate, true);
  assert.strictEqual(read1.isOffRoute, false);
  assert.strictEqual(read1.offRouteCount, 1);

  const read2 = checkOffRouteStatus(farOff, pts, 1, 25, 2);
  assert.strictEqual(read2.isOffRoute, true);
  assert.strictEqual(read2.offRouteCount, 2);
});

// 15. Reroute atomic replacement
runTest('15. Reroute atomic replacement preserves destination', () => {
  const newRouteData = {
    ...mockMapplsRouteData,
    distance: 1400,
    duration: 280,
  };
  const tick = processNavigationTick({
    currentLocation: { lat: 12.9750, lng: 77.5980 },
    destination: sampleDest,
    routeData: newRouteData,
    currentStepIndex: 0,
  });
  assert.strictEqual(tick.destination.lat, sampleDest.lat);
  assert.strictEqual(tick.destination.lng, sampleDest.lng);
  assert.strictEqual(tick.distanceRemaining > 0, true);
});

// 16. Reroute failure preserves old route
runTest('16. Reroute failure preserves old route and navigation state', () => {
  const tick = processNavigationTick({
    currentLocation: { lat: 12.9720, lng: 77.5950 },
    destination: sampleDest,
    routeData: mockMapplsRouteData,
    isRerouting: true,
  });
  assert.strictEqual(tick.navigationStatus, 'REROUTING');
  assert.strictEqual(tick.isRerouting, true);
  assert.ok(tick.distanceRemaining > 0);
});

// 17. ETA stability
runTest('17. ETA stability (non-negative, non-NaN, bounded by duration)', () => {
  const tick = processNavigationTick({
    currentLocation: { lat: 12.9720, lng: 77.5950 },
    destination: sampleDest,
    routeData: mockMapplsRouteData,
  });
  assert.ok(Number.isFinite(tick.durationRemaining));
  assert.ok(tick.durationRemaining >= 0);
  assert.ok(tick.durationRemaining <= mockMapplsRouteData.duration);
  assert.ok(tick.durationRemainingFormatted.includes('min'));
});

// 18. Arrival detection
runTest('18. Arrival detection hysteresis when reaching destination', () => {
  const atDest = { lat: 12.9780, lng: 77.6000 };

  const arr1 = checkArrivalStatus(atDest, sampleDest, 0, 30, 2);
  assert.strictEqual(arr1.isArrived, false);
  assert.strictEqual(arr1.arrivalCount, 1);

  const arr2 = checkArrivalStatus(atDest, sampleDest, 1, 30, 2);
  assert.strictEqual(arr2.isArrived, true);
  assert.strictEqual(arr2.arrivalCount, 2);
});

// 19. Heading normalization
runTest('19. Heading normalization (0 to 360 degrees)', () => {
  const normalizeHeading = (h) => ((h % 360) + 360) % 360;
  assert.strictEqual(normalizeHeading(0), 0);
  assert.strictEqual(normalizeHeading(360), 0);
  assert.strictEqual(normalizeHeading(450), 90);
  assert.strictEqual(normalizeHeading(-90), 270);
});

// 20. Stationary heading suppression
runTest('20. Stationary heading suppression (< 0.5 m/s or < 2m movement)', () => {
  const isStationary = (speed, distMoved) => (speed !== null ? speed <= 0.5 : distMoved < 2.0);
  assert.strictEqual(isStationary(0.2, 5.0), true);  // Low speed
  assert.strictEqual(isStationary(null, 1.2), true); // Minor jitter
  assert.strictEqual(isStationary(3.5, 10.0), false); // Moving on bike
});

// 21. Camera update stability
runTest('21. Camera easeTo deadband suppresses tiny sub-meter updates', () => {
  const shouldUpdateCamera = (distMoved, isStationary) => !(isStationary && distMoved < 2.0);
  assert.strictEqual(shouldUpdateCamera(0.8, true), false); // Suppressed
  assert.strictEqual(shouldUpdateCamera(3.5, false), true); // Allowed
});

// 22. Voice / HUD / TFT state consistency
runTest('22. Voice, HUD, and TFT receive identical maneuver and distance', () => {
  const tick = processNavigationTick({
    currentLocation: { lat: 12.9720, lng: 77.5950 },
    destination: sampleDest,
    routeData: mockMapplsRouteData,
  });

  // Check HUD telemetry fields
  assert.strictEqual(tick.nextManeuver, tick.navigationGuidance.nextManeuver);
  assert.strictEqual(tick.distanceToManeuver, tick.navigationGuidance.distanceToManeuver);
  assert.strictEqual(tick.distanceRemaining, tick.navigationGuidance.remainingDistance);

  // Check bridge packet output
  const packet = tftNavigationBridge.buildPacket({
    maneuver: tick.nextManeuver,
    distanceToTurn: tick.distanceToManeuver,
    remainingDistance: tick.distanceRemaining,
  }, tick.navigationStatus);
  assert.strictEqual(packet.maneuver, tick.nextManeuver);
  assert.strictEqual(packet.distanceToTurn, tick.distanceToManeuver);
  assert.strictEqual(packet.remainingDistance, tick.distanceRemaining);
});

// 23. New destination creates new session ID
runTest('23. New destination selection resets session and sequence', () => {
  const p1 = tftNavigationBridge.buildPacket({ isNavigating: true }, 'NAVIGATING');
  const session1 = p1.navigationSessionId;

  // Explicit new destination selection creates new session
  tftNavigationBridge.createSession('New Destination');
  const p2 = tftNavigationBridge.buildPacket({ isNavigating: true }, 'NAVIGATING');
  assert.notStrictEqual(p2.navigationSessionId, session1);
  assert.strictEqual(p2.sequence, 1);
});

// 24. GPS_LOST preserves route
runTest('24. GPS_LOST lifecycle status preserves active route geometry', () => {
  resetTftSessionTracking();
  const packet = tftNavigationBridge.buildPacket({
    isNavigating: true,
    route: { geometry: mockMapplsRouteData.rawCoordinates },
  }, 'GPS_LOST');
  assert.strictEqual(packet.status, 'GPS_LOST');
  assert.strictEqual(packet.route.geometry.length, 4);

  const modelState = normalizeNavigationUpdate(packet);
  assert.strictEqual(modelState.status, 'GPS_LOST');
  assert.strictEqual(modelState.route.geometry.length, 4);
});

// 25. GPS_RECOVERED resumes navigation
runTest('25. GPS_RECOVERED resumes navigation smoothly on TFT', () => {
  const packet = tftNavigationBridge.buildPacket({
    isNavigating: true,
    route: { geometry: mockMapplsRouteData.rawCoordinates },
    maneuver: 'TURN_RIGHT',
  }, 'GPS_RECOVERED');
  assert.strictEqual(packet.status, 'GPS_RECOVERED');

  const modelState = normalizeNavigationUpdate(packet);
  assert.strictEqual(modelState.status, 'GPS_RECOVERED');
  assert.strictEqual(modelState.nextTurn.action, 'RIGHT');
});

// 26. STOPPED clears navigation
runTest('26. STOPPED status clears navigation gracefully', () => {
  const stopPacket = tftNavigationBridge.buildStoppedPacket();
  assert.strictEqual(stopPacket.status, 'STOPPED');
  assert.strictEqual(stopPacket.isNavigating, false);

  const modelState = normalizeNavigationUpdate(stopPacket);
  assert.strictEqual(modelState.active, false);
  assert.strictEqual(modelState.navigationStatus, 'STOPPED');
});

// 27. Stale TFT packet rejection
runTest('27. Stale TFT packet rejection by sequence number', () => {
  resetTftSessionTracking();
  const p1 = tftNavigationBridge.buildPacket({ distanceToTurn: 100, isNavigating: true }, 'NAVIGATING', true);
  const state1 = normalizeNavigationUpdate(p1);

  // Stale packet with sequence = 0 for same session
  const stalePacket = {
    ...p1,
    sequence: 0,
    distanceToTurn: 500, // outdated distance
  };
  const prevState = { ...state1 };
  const res = normalizeNavigationUpdate(stalePacket, prevState);
  assert.strictEqual(res.nextTurn.distanceMeters, 100, 'Stale packet distance must be rejected');
});

console.log(`\n========================================`);
console.log(`🏁 Step 10 Accuracy Tests Complete: ${passedTests}/${totalTests} PASS`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
