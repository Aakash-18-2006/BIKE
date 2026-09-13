import assert from 'assert';

// 1. Test Search for Bengaluru
console.log('\n--- TEST A: Search for Bengaluru ---');
const searchUrl = 'http://localhost:3000/api/navigation/search?query=Bengaluru';
const searchRes = await fetch(searchUrl);
assert.strictEqual(searchRes.status, 200, `Search status should be 200, got ${searchRes.status}`);
const searchData = await searchRes.json();
assert(searchData.success, 'Search should be successful');
const results = searchData.data || searchData.results;
assert(Array.isArray(results) && results.length > 0, `Search should return places, got ${results?.length}`);
console.log(`PASS: Found ${results.length} search results for "Bengaluru"`);
const firstPlace = results[0];
console.log(`First place: "${firstPlace.name}" (eLoc: ${firstPlace.eLoc})`);

// 2. Test Destination Selection & Coordinate Resolution
console.log('\n--- TEST B: Select real search result & resolve coordinates ---');
assert(firstPlace.eLoc, 'First place must have an eLoc');
const coordUrl = `http://localhost:3000/api/navigation/coordinates?eLoc=${firstPlace.eLoc}`;
const coordRes = await fetch(coordUrl);
assert.strictEqual(coordRes.status, 200, `Coord status should be 200, got ${coordRes.status}`);
const coordData = await coordRes.json();
assert(coordData.success, 'Coordinate resolution should succeed');
const lat = coordData.latitude ?? coordData.data?.latitude;
const lng = coordData.longitude ?? coordData.data?.longitude;
assert(typeof lat === 'number' && lat > 12 && lat < 14, `Valid Bengaluru latitude expected, got ${lat}`);
assert(typeof lng === 'number' && lng > 77 && lng < 78, `Valid Bengaluru longitude expected, got ${lng}`);
console.log(`PASS: Resolved coordinates: [${lat}, ${lng}]`);

// 3. Test Calculate existing Mappls Biking Route
console.log('\n--- TEST C: Calculate existing Mappls biking route ---');
const origin = { lat: 12.9716, lng: 77.5946 }; // MG Road / Cubbon Park, Bengaluru
const routeUrl = `http://localhost:3000/api/navigation/route?originLat=${origin.lat}&originLng=${origin.lng}&destLat=${lat}&destLng=${lng}&profile=biking`;
const routeRes = await fetch(routeUrl);
assert.strictEqual(routeRes.status, 200, `Route status should be 200, got ${routeRes.status}`);
const routeData = await routeRes.json();
assert(routeData.success, 'Route request should be successful');
assert(routeData.routes && routeData.routes.length > 0, 'Route data should contain routes');
const activeRoute = routeData.routes[0];
assert(activeRoute.distance > 0, `Route should have distance > 0, got ${activeRoute.distance}`);
assert(activeRoute.duration > 0, `Route should have duration > 0, got ${activeRoute.duration}`);
console.log(`PASS: Biking route calculated: distance = ${activeRoute.distance} m, duration = ${activeRoute.duration} s`);

// 4. Test Navigation Logic (mapplsNavigationEngine & tftNavigationBridge)
console.log('\n--- TEST D: Confirm navigation starts normally ---');
import {
  processNavigationTick,
  haversineDistance,
  formatNavDistance,
  formatNavDuration,
  findNearestPointOnRoute,
  calculateRemainingDistance,
  calculateRouteProgress,
  determineNextManeuver,
  normalizeManeuver,
} from '../mobile-app/src/navigation/mapplsNavigationEngine.js';
import { parseRouteSteps } from '../mobile-app/src/utils/navigationEngine.js';
import { tftNavigationBridge } from '../mobile-app/src/services/tftNavigationBridge.js';

const steps = parseRouteSteps(activeRoute.legs?.[0]?.steps || []);
console.log(`Parsed ${steps.length} route step(s)`);
assert(steps.length > 0, 'Route must have turn-by-turn steps');

const coords = activeRoute.geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })) || [];
assert(coords.length > 0, 'Route must have geometry coordinates');

// Simulate first tick of navigation
const tick = processNavigationTick({
  currentLocation: origin,
  destination: { name: 'Bengaluru', lat, lng },
  routeData: {
    distance: activeRoute.distance,
    duration: activeRoute.duration,
    coordinates: coords,
    steps,
  },
  currentStepIndex: 0,
});
assert(!tick.arrived, 'Should not have arrived at start');
assert(tick.remainingDistance > 0, `Should have remaining distance, got ${tick.remainingDistance}`);
console.log(`Navigation tick status: progress=${(tick.progress).toFixed(1)}%, remainingDistance=${formatNavDistance(tick.remainingDistance)}`);

// Build TFT packet
tftNavigationBridge.createSession('Bengaluru');
const initialPacket = tftNavigationBridge.buildPacket({
  type: 'navigation_update',
  isNavigating: true,
  isDestinationReached: false,
  current: origin,
  destination: { name: 'Bengaluru', lat, lng },
  maneuver: normalizeManeuver(steps[0]?.maneuverType, steps[0]?.modifier),
  instruction: steps[0]?.instruction || 'Proceed',
  remainingDistance: tick.remainingDistance,
  etaMinutes: Math.round(activeRoute.duration / 60),
}, 'NAVIGATING');

assert.strictEqual(initialPacket.type, 'navigation_update');
assert.strictEqual(initialPacket.navigationStatus, 'NAVIGATING');
console.log(`PASS: TFT packet generated cleanly: session=${initialPacket.navigationSessionId}, seq=${initialPacket.sequence}`);

console.log('\nALL STEP 4 CHECKS PASSED PERFECTLY!\n');
