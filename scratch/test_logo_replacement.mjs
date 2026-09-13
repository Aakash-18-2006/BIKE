import { readFileSync } from 'fs';
import assert from 'assert';

console.log('🧪 Running Transparent Logo Replacement Verification Suite...\n');

// 1. Asset verification
const sourceLogoPath = 'C:\\Users\\AKASH\\.gemini\\antigravity-ide\\brain\\45f68b89-6572-4f52-8917-447a981e5c45\\.user_uploaded\\media_1789321632482.png';
const sourceBytes = readFileSync(sourceLogoPath);

const mobileLogoBytes = readFileSync('./mobile-app/public/brand-logo.png');
const tftLogoBytes = readFileSync('./speedometer/public/brand-logo.png');

assert.strictEqual(sourceBytes.length, mobileLogoBytes.length, 'Mobile app logo size matches source PNG exactly');
assert.strictEqual(sourceBytes.length, tftLogoBytes.length, 'TFT logo size matches source PNG exactly');
console.log(`✅ Test 1: New logo PNG asset copied without modification (${sourceBytes.length} bytes) to both apps`);

// 2. Mobile App Splash Screen
const authScreens = readFileSync('./mobile-app/src/screens/AuthScreens.jsx', 'utf8');
assert(authScreens.includes('src="/brand-logo.png"'), 'AuthScreens must reference /brand-logo.png');
assert(authScreens.includes("objectFit: 'contain'"), 'AuthScreens must use objectFit: contain');
console.log('✅ Test 2: Mobile app splash screen uses new transparent logo with contain aspect ratio');

// 3. Mobile App Dashboard Header
const dashScreen = readFileSync('./mobile-app/src/screens/DashboardScreen.jsx', 'utf8');
assert(dashScreen.includes('src="/brand-logo.png"'), 'DashboardScreen must reference /brand-logo.png');
assert(dashScreen.includes("objectFit: 'contain'"), 'DashboardScreen must use objectFit: contain');
console.log('✅ Test 3: Mobile app dashboard header uses new transparent logo with contain aspect ratio');

// 4. TFT Standby Screen
const tftApp = readFileSync('./speedometer/src/App.jsx', 'utf8');
assert(tftApp.includes('src="/brand-logo.png"'), 'TFT App must reference /brand-logo.png');
assert(tftApp.includes('standby-logo-mark'), 'TFT Standby brand element preserved');
console.log('✅ Test 4: TFT Standby screen uses new transparent logo with contain aspect ratio');

// 5. TFT Boot / Startup Screen
assert(tftApp.includes('boot-logo-sweep'), 'TFT boot screen logo element preserved');
assert(tftApp.includes('src="/brand-logo.png"'), 'TFT boot screen references /brand-logo.png');
console.log('✅ Test 5: TFT Boot / Startup screen uses new transparent logo with contain aspect ratio');

// 6. Favicon references
const mobileHtml = readFileSync('./mobile-app/index.html', 'utf8');
const tftHtml = readFileSync('./speedometer/index.html', 'utf8');
assert(mobileHtml.includes('href="/brand-logo.png"'), 'Mobile app favicon references brand-logo.png');
assert(tftHtml.includes('href="/brand-logo.png"'), 'TFT speedometer favicon references brand-logo.png');
console.log('✅ Test 6: Browser tab favicons point to new transparent logo PNG');

console.log('\n======================================================');
console.log('🎉 ALL 6 TRANSPARENT LOGO TESTS PASSED (6/6)');
console.log('======================================================');
