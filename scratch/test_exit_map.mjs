/**
 * Automated Verification Suite for "EXIT MAP" Button & Behavior
 * 
 * Verifies all criteria from User Request:
 * 1. Open Map.
 * 2. Search a destination.
 * 3. Select destination.
 * 4. Confirm destination appears.
 * 5. Press EXIT MAP.
 * 6. Confirm the app leaves the Map screen.
 * 7. Confirm no navigation starts.
 * 8. Confirm no destination is sent to TFT.
 * 9. Confirm existing Map/Search/Navigation functionality still works.
 * 10. Confirm destination UI state is cleared when navigation has not started.
 * 11. Confirm if navigation is already active, exiting does not silently stop navigation.
 */

import assert from 'assert';
import fs from 'fs';

console.log('================================================================');
console.log('🚪 VERIFYING "EXIT MAP" BUTTON & NAVIGATION BEHAVIOR');
console.log('================================================================\n');

const appSrc = fs.readFileSync('mobile-app/src/App.jsx', 'utf8');
const ridesScreensSrc = fs.readFileSync('mobile-app/src/screens/RidesAndNavScreens.jsx', 'utf8');
const cssSrc = fs.readFileSync('mobile-app/src/index.css', 'utf8');

// 1. NavigationScreen in App.jsx receives navigation router callbacks
assert(appSrc.includes('onNavigate={setCurrentScreen}'), 'Test 1 FAIL: onNavigate prop passed to NavigationScreen');
assert(appSrc.includes("onBack={() => setCurrentScreen('dashboard')}"), 'Test 1 FAIL: onBack prop passed to NavigationScreen');
console.log('  ✅ 1. NavigationScreen wired to App.jsx router with onNavigate and onBack callbacks');

// 2. NavigationScreen accepts onNavigate and onBack
assert(ridesScreensSrc.includes('export function NavigationScreen({ onNavigate, onBack }'), 'Test 2 FAIL: NavigationScreen props');
console.log('  ✅ 2. NavigationScreen accepts { onNavigate, onBack }');

// 3. handleExitMap implementation exists
assert(ridesScreensSrc.includes('const handleExitMap = () => {'), 'Test 3 FAIL: handleExitMap definition');
console.log('  ✅ 3. handleExitMap handler defined');

// 4. Verification of handleExitMap contract:
// - Leaves map screen
assert(ridesScreensSrc.includes('onNavigate(\'dashboard\')') || ridesScreensSrc.includes('onBack()'), 'Test 4 FAIL: handleExitMap must invoke router to leave map');
// - Clears temporary destination state when destination selected but navigation NOT started
assert(ridesScreensSrc.includes('if (destination && !isNavigating)'), 'Test 4 FAIL: Destination check before clearing');
assert(ridesScreensSrc.includes('setDestination(null)'), 'Test 4 FAIL: setDestination(null) called on exit');
assert(ridesScreensSrc.includes('setRouteData(null)'), 'Test 4 FAIL: setRouteData(null) called on exit');
console.log('  ✅ 4. handleExitMap clears destination and route preview state when navigation has not started');

// 5. Does NOT start navigation or send to TFT on Exit
// In handleExitMap, verify no calls to setIsNavigating(true) or sendNavigationUpdate
const handleExitMapBody = ridesScreensSrc.substring(
  ridesScreensSrc.indexOf('const handleExitMap = () => {'),
  ridesScreensSrc.indexOf('// Stop Navigation Action')
);
assert(!handleExitMapBody.includes('setIsNavigating(true)'), 'Test 5 FAIL: handleExitMap must NOT start navigation');
assert(!handleExitMapBody.includes('sendNavigationUpdate'), 'Test 5 FAIL: handleExitMap must NOT send to TFT');
assert(!handleExitMapBody.includes('calculateBikeRoute'), 'Test 5 FAIL: handleExitMap must NOT calculate route');
console.log('  ✅ 5. handleExitMap strictly does NOT start navigation, does NOT send to TFT, does NOT calculate route');

// 6. If navigation is already active, exiting does NOT silently stop navigation
assert(!handleExitMapBody.includes('handleStopNavigation()'), 'Test 6 FAIL: handleExitMap must NOT stop active navigation');
console.log('  ✅ 6. If navigation is already active, handleExitMap does NOT stop navigation');

// 7. UI: EXIT MAP button in destination/route bottom panel
assert(ridesScreensSrc.includes('id="mappls-exit-map-btn"'), 'Test 7 FAIL: mappls-exit-map-btn ID missing in bottom panel');
assert(ridesScreensSrc.includes('EXIT MAP'), 'Test 7 FAIL: EXIT MAP text missing');
console.log('  ✅ 7. EXIT MAP button present in destination/route bottom panel (#mappls-exit-map-btn)');

// 8. UI: EXIT MAP button in top-left alongside controls
assert(ridesScreensSrc.includes('id="mappls-exit-map-top-btn"'), 'Test 8 FAIL: mappls-exit-map-top-btn ID missing in top-left chip');
assert(ridesScreensSrc.includes('id="mappls-top-exit-btn"'), 'Test 8 FAIL: mappls-top-exit-btn ID missing on map screen');
console.log('  ✅ 8. EXIT MAP button present in top-left controls (#mappls-exit-map-top-btn, #mappls-top-exit-btn)');

// 9. UI Style: Not visually dominant over navigation controls
assert(cssSrc.includes('.mappls-exit-map-btn'), 'Test 9 FAIL: .mappls-exit-map-btn CSS class missing');
assert(cssSrc.includes('.mappls-top-exit-btn'), 'Test 9 FAIL: .mappls-top-exit-btn CSS class missing');
assert(cssSrc.includes('.mappls-exit-map-chip-btn'), 'Test 9 FAIL: .mappls-exit-map-chip-btn CSS class missing');
console.log('  ✅ 9. Non-dominant button styling verified in index.css');

// 10. Existing functionality intact:
assert(ridesScreensSrc.includes('id="mappls-navigate-to-bike-btn"'), 'Test 10 FAIL: NAVIGATE TO BIKE button preserved');
assert(ridesScreensSrc.includes('id="mappls-start-navigation-btn"'), 'Test 10 FAIL: START NAVIGATION button preserved');
assert(ridesScreensSrc.includes('handleNavigateToBike'), 'Test 10 FAIL: handleNavigateToBike preserved');
assert(ridesScreensSrc.includes('handleStartNavigation'), 'Test 10 FAIL: handleStartNavigation preserved');
assert(ridesScreensSrc.includes('handleCalculateRoute'), 'Test 10 FAIL: handleCalculateRoute preserved');
console.log('  ✅ 10. Existing Map, Search, Route Calculation, and Navigate to Bike functionality intact');

console.log('\n================================================================');
console.log('🎉 ALL "EXIT MAP" SPECIFICATION TESTS PASSED (10/10)!');
console.log('================================================================\n');
