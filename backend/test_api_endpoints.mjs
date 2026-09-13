// Node.js 22 has native global fetch
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runApiTests() {
  console.log('--- STARTING END-TO-END HTTP API TEST ---');
  
  // Start backend server in child process
  const backendProc = spawn('node', ['src/server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: '5000', MONGO_URI: 'mongodb://localhost:27017/smart_bike', USE_MEMORY_DB: 'false' },
    stdio: 'pipe'
  });

  backendProc.stdout.on('data', (d) => console.log('[Server stdout]', d.toString().trim()));
  backendProc.stderr.on('data', (d) => console.error('[Server stderr]', d.toString().trim()));

  // Wait for server to boot
  let ready = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const res = await fetch('http://localhost:5000/health');
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {
      // wait
    }
  }

  if (!ready) {
    backendProc.kill();
    throw new Error('Server failed to start on http://localhost:5000 within 10s');
  }
  console.log('✓ Backend server is UP and responding to /health');

  try {
    const testUser = {
      name: 'EndToEnd Test Rider',
      email: `api_test_${Date.now()}@smartbike.io`,
      password: 'RiderPass2026!',
      phone: '+91 99887 76655'
    };

    // Test 1: User Registration (POST /api/auth/register)
    console.log('\n1. Testing POST /api/auth/register...');
    const regRes = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    const regData = await regRes.json();
    console.log('Status:', regRes.status);
    console.log('User registered:', regData.user ? regData.user.email : null, 'token exists:', !!regData.token);
    if (regRes.status !== 201 || !regData.token) {
      throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
    }

    // Test 2: Duplicate Registration (POST /api/auth/register)
    console.log('\n2. Testing Duplicate POST /api/auth/register...');
    const dupRes = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    console.log('Duplicate status code (expected 409):', dupRes.status);
    if (dupRes.status !== 409) {
      throw new Error(`Expected 409 for duplicate registration, got ${dupRes.status}`);
    }

    // Test 3: Invalid Login (POST /api/auth/login)
    console.log('\n3. Testing Invalid Password POST /api/auth/login...');
    const badLoginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: 'WrongPassword!' })
    });
    console.log('Invalid login status code (expected 401):', badLoginRes.status);
    if (badLoginRes.status !== 401) {
      throw new Error(`Expected 401 for invalid password, got ${badLoginRes.status}`);
    }

    // Test 4: Valid Login (POST /api/auth/login)
    console.log('\n4. Testing Valid POST /api/auth/login...');
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });
    const loginData = await loginRes.json();
    console.log('Valid login status code:', loginRes.status);
    console.log('Returned token prefix:', loginData.token ? loginData.token.substring(0, 15) + '...' : null);
    if (loginRes.status !== 200 || !loginData.token) {
      throw new Error(`Valid login failed: ${JSON.stringify(loginData)}`);
    }

    const authToken = loginData.token;

    // Test 5: Get Motorcycles & Vehicle Status (GET /api/motorcycles)
    console.log('\n5. Testing GET /api/motorcycles...');
    const bikeRes = await fetch('http://localhost:5000/api/motorcycles', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const bikeData = await bikeRes.json();
    console.log('Status:', bikeRes.status);
    console.log('Motorcycles count:', bikeData.motorcycles ? bikeData.motorcycles.length : 0);
    if (bikeRes.status !== 200 || !bikeData.motorcycles || bikeData.motorcycles.length === 0) {
      throw new Error(`Failed to list motorcycles: ${JSON.stringify(bikeData)}`);
    }
    console.log('Paired bike ID:', bikeData.motorcycles[0].deviceId || bikeData.motorcycles[0].id);

    // Test 6: Save Navigation Destination (POST /api/navigation/destinations)
    console.log('\n6. Testing POST /api/navigation/destinations...');
    const destRes = await fetch('http://localhost:5000/api/navigation/destinations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        name: 'Indiranagar 100ft Road',
        address: 'Indiranagar, Bengaluru 560038',
        latitude: 12.9784,
        longitude: 77.6408,
        category: 'saved'
      })
    });
    const destData = await destRes.json();
    console.log('Save destination status:', destRes.status);
    console.log('Saved destination name:', destData.destination ? destData.destination.name : null);
    if (destRes.status !== 201 || !destData.destination) {
      throw new Error(`Failed to save destination: ${JSON.stringify(destData)}`);
    }

    // Test 7: Fetch Navigation Destinations (GET /api/navigation/destinations)
    console.log('\n7. Testing GET /api/navigation/destinations...');
    const fetchDestRes = await fetch('http://localhost:5000/api/navigation/destinations', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const fetchDestData = await fetchDestRes.json();
    console.log('Fetch destinations status:', fetchDestRes.status);
    console.log('Saved destinations count:', fetchDestData.saved ? fetchDestData.saved.length : 0);
    if (fetchDestRes.status !== 200 || !fetchDestData.saved || fetchDestData.saved.length === 0) {
      throw new Error(`Failed to fetch saved destinations: ${JSON.stringify(fetchDestData)}`);
    }

    console.log('\n✓✓✓ ALL 7 END-TO-END HTTP API TESTS PASSED WITH FLYING COLORS! ✓✓✓');
  } finally {
    backendProc.kill();
  }
}

runApiTests().catch((err) => {
  console.error('API Test Error:', err);
  process.exit(1);
});
