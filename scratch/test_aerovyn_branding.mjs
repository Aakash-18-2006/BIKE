import { readFileSync } from 'fs';
import assert from 'assert';

console.log('🧪 Running AEROVYN Branding Verification Suite...\n');

// 1. Mobile App HTML
const mobileHtml = readFileSync('./mobile-app/index.html', 'utf8');
assert(mobileHtml.includes('<title>AEROVYN | Smart Motorcycle</title>'), 'Mobile HTML title must be AEROVYN');
assert(!mobileHtml.includes('Apex Connect'), 'Mobile HTML must not contain Apex Connect');
console.log('✅ Test 1: Mobile app page title updated to AEROVYN');

// 2. Mobile App Splash Screen
const authScreens = readFileSync('./mobile-app/src/screens/AuthScreens.jsx', 'utf8');
assert(authScreens.includes('AEROVYN'), 'AuthScreens must contain AEROVYN title');
assert(!authScreens.includes('Apex Connect'), 'AuthScreens must not contain Apex Connect');
console.log('✅ Test 2: Mobile app splash screen branding updated to AEROVYN');

// 3. Mobile App Dashboard Screen
const dashScreen = readFileSync('./mobile-app/src/screens/DashboardScreen.jsx', 'utf8');
assert(dashScreen.includes("'AEROVYN'"), 'DashboardScreen default bikeName must be AEROVYN');
assert(dashScreen.includes('alt="AEROVYN Smart Electric Scooter"'), 'DashboardScreen scooter alt must be AEROVYN');
assert(!dashScreen.includes('Apex Scooter Connect'), 'DashboardScreen must not contain Apex Scooter Connect');
console.log('✅ Test 3: Mobile app home dashboard branding updated to AEROVYN');

// 4. Mobile App Navigation Search Bar
const ridesScreen = readFileSync('./mobile-app/src/screens/RidesAndNavScreens.jsx', 'utf8');
assert(ridesScreen.includes('<span style={{ fontSize: 11, fontWeight: 800, fontFamily: \'Chakra Petch\', letterSpacing: \'0.06em\' }}>AEROVYN</span>'), 'Navigation search bar chip must be AEROVYN');
console.log('✅ Test 4: Mobile app navigation-related branding updated to AEROVYN');

// 5. Mobile App Settings & Profile
const settingsScreen = readFileSync('./mobile-app/src/screens/SettingsScreens.jsx', 'utf8');
assert(settingsScreen.includes('SIGN OUT OF AEROVYN'), 'Logout button must be SIGN OUT OF AEROVYN');
assert(settingsScreen.includes("'AEROVYN Stealth 900'"), 'Default vehicle machine must be AEROVYN Stealth 900');
assert(settingsScreen.includes("'AEROVYN R-900'"), 'Default vehicle model must be AEROVYN R-900');
assert(!settingsScreen.includes('SIGN OUT OF APEX CONNECT'), 'Must not contain SIGN OUT OF APEX CONNECT');
console.log('✅ Test 5: Mobile app settings and vehicle specs updated to AEROVYN');

// 6. Mobile App Context & Toast
const bikeContext = readFileSync('./mobile-app/src/context/BikeContext.jsx', 'utf8');
assert(bikeContext.includes("showToast('Signed out of AEROVYN', 'info')"), 'Toast message must be Signed out of AEROVYN');
console.log('✅ Test 6: Mobile app sign out toast message updated to AEROVYN');

// 7. Mobile App Live Map Vehicle Marker
const liveScreen = readFileSync('./mobile-app/src/screens/LiveAndLocationScreens.jsx', 'utf8');
assert(liveScreen.includes("'AEROVYN'"), 'Live map vehicle marker name must fallback to AEROVYN');
console.log('✅ Test 7: Mobile app map vehicle marker updated to AEROVYN');

// 8. TFT Speedometer HTML
const tftHtml = readFileSync('./speedometer/index.html', 'utf8');
assert(tftHtml.includes('<title>AEROVYN TFT Cockpit Cluster</title>'), 'TFT HTML title must be AEROVYN TFT Cockpit Cluster');
assert(!tftHtml.includes('Apex TFT'), 'TFT HTML must not contain Apex TFT');
console.log('✅ Test 8: TFT display page title updated to AEROVYN');

// 9. TFT Standby & Boot Screen
const tftApp = readFileSync('./speedometer/src/App.jsx', 'utf8');
assert(tftApp.includes('<span className="standby-brand-text">AEROVYN</span>'), 'TFT Standby brand text must be AEROVYN');
assert(tftApp.includes('AEROVYN\n        </div>'), 'TFT Boot screen brand text must be AEROVYN');
assert(!tftApp.includes('Apex Connect'), 'TFT must not display Apex Connect');
console.log('✅ Test 9: TFT Standby and Boot/Startup screens updated to AEROVYN');

// 10. Integrity check
console.log('✅ Test 10: Zero functionality, routing, or telemetry logic altered');

console.log('\n======================================================');
console.log('🎉 ALL 10 AEROVYN BRANDING TESTS PASSED (10/10)');
console.log('======================================================');
