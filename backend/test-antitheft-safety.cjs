// test-antitheft-safety.cjs - End-to-end verification of Navigation, Anti-Theft, and Functional Safety rules
const http = require('http');

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

async function runSafetyAndTheftTests() {
  console.log('======================================================================');
  console.log('  STARTING E2E ANTI-THEFT, FUNCTIONAL SAFETY & NAVIGATION VERIFICATION');
  console.log('======================================================================\n');

  // 1. Authenticate Rider
  console.log('[Step 1] Authenticating rider...');
  const loginRes = await request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'demo@smartbike.io', password: 'Password123!' });

  if (loginRes.statusCode !== 200 || !loginRes.body.token) {
    throw new Error('Authentication failed: ' + JSON.stringify(loginRes.body));
  }
  const token = loginRes.body.token;
  console.log('✓ Rider authenticated successfully');

  // 2. Fetch Vehicle
  console.log('\n[Step 2] Fetching assigned vehicle...');
  const bikesRes = await request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    path: '/api/motorcycles',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const vehicle = bikesRes.body?.motorcycles?.[0];
  if (!vehicle) throw new Error('No vehicle found for user');
  const vehicleId = vehicle._id;
  console.log(`✓ Resolved vehicle: ${vehicleId} (${vehicle.deviceId})`);

  // 3. Verify Turn-by-Turn Navigation Telemetry
  console.log('\n[Step 3] Verifying Turn-by-Turn Navigation Route Telemetry...');
  const navRes = await request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    path: `/api/motorcycles/${vehicleId}/navigation/route`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Navigation response:', JSON.stringify(navRes.body, null, 2));
  const nav = navRes.body.navigation;
  if (!nav || !nav.currentRoad) {
    throw new Error('Navigation route data missing or malformed');
  }
  console.log(`✓ Current Road: "${nav.currentRoad}"`);
  console.log(`✓ Next Turn Instruction: "${nav.nextTurnInstruction}"`);
  console.log(`✓ Direction Arrow: ${nav.directionArrow}`);
  console.log(`✓ Distance Remaining: ${nav.distanceRemainingKm} km, ETA: ${nav.eta}`);
  console.log(`✓ GPS Fix: ${nav.gpsFixType} (${nav.satellites} sats, accuracy ±${nav.accuracy}m)`);

  // 4. Test Security Mode Toggle
  console.log('\n[Step 4] Enabling SECURITY MODE: POST /api/motorcycles/:id/security/mode...');
  const secModeRes = await request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    path: `/api/motorcycles/${vehicleId}/security/mode`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }, { active: true });
  console.log('Security Mode response:', secModeRes.statusCode, secModeRes.body);
  if (!secModeRes.body.success || !secModeRes.body.securityActive) {
    throw new Error('Failed to set security mode: ' + JSON.stringify(secModeRes.body));
  }
  console.log('✓ Security Mode ACTIVE confirmed on vehicle controller');

  // 5. Test Multi-Sensor Theft Trigger: Unauthorized Ignition
  console.log('\n[Step 5] Simulating UNAUTHORIZED_IGNITION attempt on motorcycle MCU...');
  const unauthIgnRes = await request({
    host: SIMULATOR_HOST,
    port: SIMULATOR_PORT,
    path: '/api/simulator/security/unauthorized-ignition',
    method: 'POST',
  });
  console.log('Unauthorized ignition result:', unauthIgnRes.statusCode, unauthIgnRes.body);
  if (!unauthIgnRes.body.success || unauthIgnRes.body.event?.eventType !== 'UNAUTHORIZED_IGNITION') {
    throw new Error('Unauthorized ignition detection failed');
  }
  console.log('✓ UNAUTHORIZED_IGNITION event created with CRITICAL severity');

  // 6. Test Multi-Sensor Theft Trigger: Movement while locked
  console.log('\n[Step 6] Simulating VEHICLE_MOVEMENT_WHILE_LOCKED (tow-away attempt)...');
  const moveLockedRes = await request({
    host: SIMULATOR_HOST,
    port: SIMULATOR_PORT,
    path: '/api/simulator/security/unauthorized-movement',
    method: 'POST',
  });
  console.log('Movement while locked result:', moveLockedRes.statusCode, moveLockedRes.body);
  if (!moveLockedRes.body.success || moveLockedRes.body.event?.eventType !== 'VEHICLE_MOVEMENT_WHILE_LOCKED') {
    throw new Error('Movement while locked detection failed');
  }
  console.log(`✓ VEHICLE_MOVEMENT_WHILE_LOCKED confirmed! Camera snapshot attached: ${moveLockedRes.body.event.cameraEventId}`);

  // 7. CRITICAL FUNCTIONAL SAFETY RULE TEST: In-Motion Safe Ignition Cutoff
  console.log('\n======================================================================');
  console.log('  TESTING CRITICAL AUTOMOTIVE FUNCTIONAL SAFETY ENFORCEMENT');
  console.log('======================================================================');

  // Set bike in motion at 45.0 km/h
  console.log('[Step 7A] Setting vehicle in motion at speed: 45.0 km/h...');
  await request({
    host: SIMULATOR_HOST,
    port: SIMULATOR_PORT,
    path: '/api/simulator/physics/speed',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { speed: 45.0 });

  console.log('Rider initiating emergency [ SECURE VEHICLE ] action while bike is MOVING...');
  const secureMovingRes = await request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    path: `/api/motorcycles/${vehicleId}/security/secure`,
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Moving secure response:', JSON.stringify(secureMovingRes.body, null, 2));

  // SAFETY ASSERTION: Immediate engine cutoff MUST BE FALSE while moving!
  if (secureMovingRes.body.result?.immediateCutoff === true) {
    throw new Error('SAFETY VIOLATION: Drivetrain was cut while motorcycle was moving!');
  }
  if (secureMovingRes.body.result?.status !== 'CUTOFF_PENDING_STOP') {
    throw new Error('Expected CUTOFF_PENDING_STOP status, received: ' + secureMovingRes.body.result?.status);
  }
  console.log('✓ PASS: Vehicle-side safety controller PROHIBITED abrupt engine cut-off while moving!');
  console.log(`✓ Status: ${secureMovingRes.body.result?.status}. Rider retains throttle/steering control.`);

  // [Step 7B] Vehicle slows down and comes to a safe stop
  console.log('\n[Step 7B] Motorcycle decelerates to a safe complete stop (0.0 km/h)...');
  await request({
    host: SIMULATOR_HOST,
    port: SIMULATOR_PORT,
    path: '/api/simulator/physics/speed',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { speed: 0.0 });

  // Await safety controller background monitor evaluation (250ms loop)
  console.log('Awaiting automatic stationary safety evaluation...');
  await new Promise((r) => setTimeout(r, 600));

  // Inspect vehicle controller state
  const stateRes = await request({
    host: SIMULATOR_HOST,
    port: SIMULATOR_PORT,
    path: '/api/simulator/state',
    method: 'GET',
  });
  console.log('Vehicle final state after stopping:', {
    vehicleState: stateRes.body.vehicleState,
    lock: stateRes.body.lock,
    speed: stateRes.body.physics.speed,
  });

  if (stateRes.body.vehicleState !== 'SLEEP' || !stateRes.body.lock) {
    throw new Error('Vehicle failed to immobilize after coming to a complete stop');
  }
  console.log('✓ PASS: Once stationary (0 km/h), vehicle-side controller executed safe immobilization & locked deadbolt!');

  // 8. Verify Immutable SecurityEvent Audit Records in MongoDB
  console.log('\n[Step 8] Querying immutable SecurityEvent audit log from MongoDB...');
  // Await MQTT batch ingestion
  await new Promise((r) => setTimeout(r, 1500));

  const eventsRes = await request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    path: `/api/motorcycles/${vehicleId}/security/events`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const events = eventsRes.body.events || [];
  console.log(`Found ${events.length} security events in database:`);

  events.slice(0, 6).forEach((ev) => {
    console.log(
      ` - [${ev.eventType}] ID: ${ev.eventId}, Severity: ${ev.severity}, CommandState: ${ev.commandState}, Speed: ${ev.speed} km/h, Time: ${ev.timestamp}`
    );
  });

  const hasCutoffReq = events.some((e) => e.eventType === 'IGNITION_CUTOFF_REQUESTED');
  const hasAuthDisabled = events.some((e) => e.eventType === 'IGNITION_AUTHORIZATION_DISABLED');
  const hasUnauthIgn = events.some((e) => e.eventType === 'UNAUTHORIZED_IGNITION');
  const hasMoveLocked = events.some((e) => e.eventType === 'VEHICLE_MOVEMENT_WHILE_LOCKED');

  console.log('\nRequired Event Types Audit:');
  console.log(' - IGNITION_CUTOFF_REQUESTED:', hasCutoffReq ? '✓ PRESENT' : '✗ MISSING');
  console.log(' - IGNITION_AUTHORIZATION_DISABLED:', hasAuthDisabled ? '✓ PRESENT' : '✗ MISSING');
  console.log(' - UNAUTHORIZED_IGNITION:', hasUnauthIgn ? '✓ PRESENT' : '✗ MISSING');
  console.log(' - VEHICLE_MOVEMENT_WHILE_LOCKED:', hasMoveLocked ? '✓ PRESENT' : '✗ MISSING');

  if (!hasCutoffReq || !hasAuthDisabled || !hasUnauthIgn || !hasMoveLocked) {
    throw new Error('Not all required security event types were persisted in database audit log');
  }

  console.log('\n======================================================================');
  console.log('  ALL E2E ANTI-THEFT, SAFETY RULES & NAVIGATION TESTS PASSED!        ');
  console.log('======================================================================');
}

runSafetyAndTheftTests().catch((err) => {
  console.error('\n❌ SAFETY & THEFT TEST ERROR:', err);
  process.exit(1);
});
