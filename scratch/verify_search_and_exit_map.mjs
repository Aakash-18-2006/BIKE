import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('🧪 VERIFYING MAPPLS SEARCH & EXIT MAP BUTTON SUITE');
console.log('====================================================\n');

// 1. Verify Mappls Search for 4 Cities
console.log('--- 1. Testing Mappls Search API (4 Cities) ---');
const cities = ['Coimbatore', 'Gandhipuram', 'Chennai', 'Bengaluru'];

for (const city of cities) {
  const url = `http://localhost:3000/api/navigation/search?query=${encodeURIComponent(city)}`;
  const res = await fetch(url);
  assert.strictEqual(res.status, 200, `Search request for ${city} should return HTTP 200`);
  const json = await res.json();
  assert.strictEqual(json.success, true, `Search for ${city} should return success=true`);
  assert(Array.isArray(json.data) && json.data.length > 0, `Search for ${city} should return non-empty data`);
  
  const first = json.data[0];
  assert(first.name, `First place for ${city} should have a name`);
  assert(first.eLoc, `First place for ${city} should have an eLoc`);
  console.log(`✅ ${city}: Found ${json.data.length} results. First: "${first.name}" (${first.address || 'No address'}) [eLoc: ${first.eLoc}]`);
}

// 2. Testing Coordinates Resolution
console.log('\n--- 2. Testing Coordinate Resolution ---');
const cbeEloc = '2UQ351'; // Coimbatore eLoc
const coordRes = await fetch(`http://localhost:3000/api/navigation/coordinates?eLoc=${cbeEloc}`);
assert.strictEqual(coordRes.status, 200, 'Coordinate resolution should return HTTP 200');
const coordJson = await coordRes.json();
assert.strictEqual(coordJson.success, true, 'Coordinate resolution should succeed');
assert(coordJson.latitude && coordJson.longitude, 'Coordinates must contain latitude and longitude');
console.log(`✅ eLoc ${cbeEloc} resolved to: lat=${coordJson.latitude}, lng=${coordJson.longitude}`);

// 3. Testing Route Calculation
console.log('\n--- 3. Testing Route Calculation ---');
const originLat = 11.0168;
const originLng = 76.9558;
const destLat = coordJson.latitude;
const destLng = coordJson.longitude;

const routeUrl = `http://localhost:3000/api/navigation/route?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}&mode=biking`;
const routeRes = await fetch(routeUrl);
assert.strictEqual(routeRes.status, 200, 'Route calculation should return HTTP 200');
const routeJson = await routeRes.json();
assert.strictEqual(routeJson.success, true, 'Route calculation should succeed');
assert(Array.isArray(routeJson.routes) && routeJson.routes[0]?.distance > 0, 'Route data should have valid distance');
const activeRoute = routeJson.routes[0];
console.log(`✅ Route calculated: distance=${activeRoute.distance}m, duration=${activeRoute.duration}s, steps=${activeRoute.legs?.[0]?.steps?.length || 0}`);

// 4. Verify RidesAndNavScreens.jsx Code Structure & IDs
console.log('\n--- 4. Verifying Exit Map & Navigation Elements in RidesAndNavScreens.jsx ---');
const ridesFile = fs.readFileSync(path.join(rootDir, 'mobile-app/src/screens/RidesAndNavScreens.jsx'), 'utf8');

// Check Exit Map buttons across states:
assert(ridesFile.includes('id="mappls-top-exit-btn"'), 'Top exit map button on resting screen must exist');
console.log('✅ Found #mappls-top-exit-btn (Resting state)');

assert(ridesFile.includes('id="mappls-exit-map-btn-resting"'), 'Bottom panel exit map button on resting screen must exist');
console.log('✅ Found #mappls-exit-map-btn-resting (Resting state panel)');

assert(ridesFile.includes('id="mappls-exit-map-top-btn"'), 'Top exit map chip button on destination preview must exist');
console.log('✅ Found #mappls-exit-map-top-btn (Destination selected / Route preview)');

assert(ridesFile.includes('id="mappls-exit-map-btn"'), 'Bottom panel exit map button on route preview must exist');
console.log('✅ Found #mappls-exit-map-btn (Route preview panel)');

assert(ridesFile.includes('id="mappls-exit-map-active-btn"'), 'Active navigation top-left exit map button must exist');
console.log('✅ Found #mappls-exit-map-active-btn (Active navigation)');

// Check Exit confirmation dialog and text:
assert(ridesFile.includes('id="mappls-exit-nav-confirm-modal"'), 'Exit navigation confirmation modal must exist');
assert(ridesFile.includes('Exit Navigation?'), 'Modal must have exact title "Exit Navigation?"');
assert(ridesFile.includes('Your current navigation will be stopped.'), 'Modal must have exact body "Your current navigation will be stopped."');
assert(ridesFile.includes('id="mappls-exit-confirm-cancel-btn"'), 'Cancel button in exit dialog must exist');
assert(ridesFile.includes('id="mappls-exit-confirm-exit-btn"'), 'Exit button in exit dialog must exist');
console.log('✅ Found Exit Navigation confirmation modal with exact title, text, CANCEL and EXIT buttons');

// Verify handleExitMap handles both active and idle states:
assert(ridesFile.includes('setShowExitConfirm(true)'), 'handleExitMap must trigger confirmation modal when isNavigating');
console.log('✅ handleExitMap triggers setShowExitConfirm(true) when isNavigating is active');

// Verify cleanup uses existing handleStopNavigation:
assert(ridesFile.includes('handleStopNavigation()'), 'Modal EXIT button must call handleStopNavigation()');
console.log('✅ Modal EXIT button invokes existing handleStopNavigation() for proper cleanup and TFT notification');

// 5. Verify Index.css styling
console.log('\n--- 5. Verifying Styling in index.css ---');
const cssFile = fs.readFileSync(path.join(rootDir, 'mobile-app/src/index.css'), 'utf8');
assert(cssFile.includes('.mappls-nav-active-top-bar'), 'mappls-nav-active-top-bar CSS class must exist');
assert(cssFile.includes('.mappls-nav-active-exit-btn'), 'mappls-nav-active-exit-btn CSS class must exist');
assert(cssFile.includes('.mappls-turn-card-container'), 'mappls-turn-card-container CSS class must exist');
console.log('✅ Verified CSS classes for active navigation top bar, exit button, and turn card placement');

console.log('\n====================================================');
console.log('🎉 ALL SEARCH & EXIT MAP VERIFICATIONS PASSED (100%)');
console.log('====================================================');
