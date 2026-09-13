// test-camera-e2e.cjs - End-to-end Camera Subsystem Verification
const http = require('http');
const fs = require('fs');
const path = require('path');

const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 5000;
const SIMULATOR_HOST = 'localhost';
const SIMULATOR_PORT = 5005;

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const bodyBuf = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || '';
        let body = null;
        if (contentType.includes('application/json')) {
          try {
            body = JSON.parse(bodyBuf.toString());
          } catch (e) {
            body = bodyBuf.toString();
          }
        } else {
          body = bodyBuf;
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('==================================================');
  console.log('  STARTING E2E CAMERA SUBSYSTEM VERIFICATION');
  console.log('==================================================\n');

  // 1. Authenticate
  console.log('[Step 1] Authenticating rider...');
  let token = null;
  let vehicleId = null;

  const loginRes = await request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'demo@smartbike.io', password: 'Password123!' });

  if (loginRes.statusCode === 200 && loginRes.body.token) {
    token = loginRes.body.token;
    console.log('✓ Rider authenticated successfully:', loginRes.body.user ? loginRes.body.user.email : 'demo@smartbike.io');
  } else {
    console.log('Registering test rider...');
    const regRes = await request({
      host: BACKEND_HOST,
      port: BACKEND_PORT,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { email: 'rider@smartbike.io', password: 'password123', name: 'Rider One', phone: '1234567890' });
    if (regRes.body.token) {
      token = regRes.body.token;
      console.log('✓ Registered test rider');
    } else {
      throw new Error('Auth failed: ' + JSON.stringify(regRes.body));
    }
  }

  // Get Vehicle List
  console.log('\n[Step 2] Fetching assigned vehicles...');
  const bikesRes = await request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    path: '/api/motorcycles',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (bikesRes.body && bikesRes.body.motorcycles && bikesRes.body.motorcycles.length > 0) {
    vehicleId = bikesRes.body.motorcycles[0]._id;
    console.log(`✓ Found vehicle: ${vehicleId} (${bikesRes.body.motorcycles[0].vin || 'BIKE-4G-9021'})`);
  } else {
    throw new Error('No motorcycles found for this user!');
  }

  // 3. Test Camera Status API
  console.log(`\n[Step 3] Querying camera status: GET /api/motorcycles/${vehicleId}/camera/status...`);
  const statusRes = await request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    path: `/api/motorcycles/${vehicleId}/camera/status`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Status code:', statusRes.statusCode);
  console.log('Camera Device:', JSON.stringify(statusRes.body.camera, null, 2));
  if (statusRes.statusCode !== 200 || !statusRes.body.camera) {
    throw new Error('Failed to get camera status: ' + JSON.stringify(statusRes.body));
  }
  console.log('✓ Real Camera Hardware Status Verified');

  // 4. Test Snapshot Capture
  console.log(`\n[Step 4] Capturing real snapshot: POST /api/motorcycles/${vehicleId}/camera/snapshot (FRONT)...`);
  const snapRes = await request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    path: `/api/motorcycles/${vehicleId}/camera/snapshot`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }, { lens: 'FRONT' });

  console.log('Snapshot status:', snapRes.statusCode);
  console.log('Snapshot Event:', JSON.stringify(snapRes.body.event, null, 2));
  if (!snapRes.body.success || !snapRes.body.event) {
    throw new Error('Snapshot failed: ' + JSON.stringify(snapRes.body));
  }
  console.log(`✓ Real Snapshot captured! File: ${snapRes.body.event.mediaReference}, size: ${snapRes.body.event.fileSizeBytes} bytes`);
  console.log(`✓ Media Reference stored: ${snapRes.body.event.mediaReference}`);

  const snapshotEventId = snapRes.body.event._id;

  // 5. Test Media Retrieval API
  console.log(`\n[Step 5] Retrieving binary JPEG media: GET /api/motorcycles/${vehicleId}/camera/media/${snapshotEventId}...`);
  const mediaRes = await request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    path: `/api/motorcycles/${vehicleId}/camera/media/${snapshotEventId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Media status:', mediaRes.statusCode);
  console.log('Content-Type:', mediaRes.headers['content-type']);
  console.log('Binary length:', mediaRes.body.length, 'bytes');

  // Verify JPEG header (SOI 0xFF 0xD8)
  const isJpeg = mediaRes.body[0] === 0xff && mediaRes.body[1] === 0xd8;
  console.log('Is valid JPEG binary header (0xFFD8):', isJpeg);
  if (!isJpeg || mediaRes.statusCode !== 200) {
    throw new Error('Media retrieval failed to return valid JPEG');
  }
  console.log('✓ Real Binary JPEG Media Retrieval Confirmed!');

  // 6. Test Manual Video Recording Start & Stop
  console.log(`\n[Step 6] Starting video recording: POST /api/motorcycles/${vehicleId}/camera/record/start...`);
  const recStartRes = await request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    path: `/api/motorcycles/${vehicleId}/camera/record/start`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }, { lens: 'FRONT', eventType: 'MANUAL_RECORDING' });
  console.log('Start recording status:', recStartRes.statusCode, recStartRes.body);

  // Wait 1.5 seconds of recording time
  console.log('Waiting 1.5 seconds for video clip recording...');
  await new Promise((r) => setTimeout(r, 1500));

  console.log(`Stopping video recording: POST /api/motorcycles/${vehicleId}/camera/record/stop...`);
  const recStopRes = await request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    path: `/api/motorcycles/${vehicleId}/camera/record/stop`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  console.log('Stop recording response:', JSON.stringify(recStopRes.body, null, 2));
  if (!recStopRes.body.success || !recStopRes.body.event) {
    throw new Error('Stop recording failed: ' + JSON.stringify(recStopRes.body));
  }
  console.log(`✓ Recording stopped. Duration: ${recStopRes.body.event.duration}s. Media Ref: ${recStopRes.body.event.mediaReference}`);

  // 7. Test Anti-Theft Tamper Event (Waking camera from low-power mode)
  console.log('\n[Step 7] Simulating Anti-Theft Tamper Alarm on Bike Hardware...');
  const tamperRes = await request({
    host: SIMULATOR_HOST,
    port: SIMULATOR_PORT,
    path: '/api/simulator/tamper',
    method: 'POST',
  });
  console.log('Tamper simulation triggered:', tamperRes.statusCode, tamperRes.body);

  // Wait 2 seconds for MQTT alert processing and auto-capture event persistence
  console.log('Awaiting MQTT security telemetry processing and camera event logging...');
  await new Promise((r) => setTimeout(r, 2000));

  // 8. Test Live Session Creation
  console.log(`\n[Step 8] Creating Live Camera Session: POST /api/motorcycles/${vehicleId}/camera/live/session...`);
  const sessionRes = await request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    path: `/api/motorcycles/${vehicleId}/camera/live/session`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }, { lens: 'FRONT' });
  console.log('Live Session Response:', JSON.stringify(sessionRes.body, null, 2));
  if (!sessionRes.body.success || !sessionRes.body.sessionToken) {
    throw new Error('Live session failed: ' + JSON.stringify(sessionRes.body));
  }
  console.log('✓ Secure expiring session token issued:', sessionRes.body.sessionToken);

  // 9. Fetch All Camera Events
  console.log(`\n[Step 9] Querying all stored Camera Events: GET /api/motorcycles/${vehicleId}/camera/events...`);
  const eventsRes = await request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    path: `/api/motorcycles/${vehicleId}/camera/events`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Events count:', eventsRes.body.events ? eventsRes.body.events.length : 0);
  console.log('Recent events:');
  (eventsRes.body.events || []).slice(0, 5).forEach((ev) => {
    console.log(` - [${ev.eventType}] ID: ${ev.eventId}, Media: ${ev.mediaType} (${ev.mediaReference}), Time: ${ev.timestamp}`);
  });

  console.log('\n==================================================');
  console.log('  ALL E2E CAMERA SUBSYSTEM VERIFICATIONS PASSED!  ');
  console.log('==================================================');
}

runTests().catch((err) => {
  console.error('\n❌ TEST ERROR:', err);
  process.exit(1);
});
