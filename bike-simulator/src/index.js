import http from 'http';
import readline from 'readline';
import { SimulatorBikeController } from './controller/SimulatorBikeController.js';

const DEVICE_ID = process.env.DEVICE_ID || 'BIKE-4G-9021';
const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const SIMULATOR_PORT = process.env.SIMULATOR_PORT || 5005;

async function run() {
  console.log('====================================================');
  console.log('  CONNECTED SMART MOTORCYCLE - IOT BIKE CONTROLLER  ');
  console.log('  KEYLESS TFT STARTUP & VEHICLE STATE CONTROLLER    ');
  console.log('====================================================');
  console.log(`Device ID: ${DEVICE_ID}`);
  console.log(`MQTT Broker: ${BROKER_URL}`);
  console.log('----------------------------------------------------');

  const bike = new SimulatorBikeController(DEVICE_ID, BROKER_URL);
  await bike.connect();

  // 1. Lightweight HTTP Control Server for TFT & testing
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/api/simulator/vehicle/start' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const result = bike.startWithPin(parsed.pin || '1234');
          res.writeHead(result.success ? 200 : 401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (req.url === '/api/simulator/vehicle/sleep' && req.method === 'POST') {
      const result = bike.enterSleep();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.url === '/api/simulator/tamper' && req.method === 'POST') {
      bike.triggerTamper().then((evt) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Tamper vibration simulated', event: evt }));
      });
      return;
    }

    if (req.url === '/api/simulator/security/unauthorized-ignition' && req.method === 'POST') {
      bike.securityController.handleSensorTrigger('UNAUTHORIZED_IGNITION').then((evt) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, event: evt }));
      });
      return;
    }

    if (req.url === '/api/simulator/security/unauthorized-movement' && req.method === 'POST') {
      bike.securityController.handleSensorTrigger('MOVEMENT_WHILE_LOCKED').then((evt) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, event: evt }));
      });
      return;
    }

    if (req.url === '/api/simulator/security/secure-vehicle' && req.method === 'POST') {
      bike.securityController.requestEmergencySecure().then((result) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      });
      return;
    }

    if (req.url === '/api/simulator/security/mode' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const parsed = body ? JSON.parse(body) : {};
        const result = bike.securityController.setSecurityMode(parsed.active !== false);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      });
      return;
    }

    if (req.url === '/api/simulator/navigation/route' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(bike.gps.getNavigationData()));
      return;
    }

    if (req.url === '/api/simulator/physics/speed' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const parsed = body ? JSON.parse(body) : {};
        bike.physics.speed = Number(parsed.speed || 0);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ speed: bike.physics.speed }));
      });
      return;
    }

    if (req.url === '/api/simulator/telemetry/toggle' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const parsed = body ? JSON.parse(body) : {};
        const sensor = parsed.sensor;
        if (sensor === 'highBeam') bike.highBeam = parsed.value !== undefined ? Boolean(parsed.value) : !bike.highBeam;
        else if (sensor === 'lowFuel') bike.lowFuel = parsed.value !== undefined ? Boolean(parsed.value) : !bike.lowFuel;
        else if (sensor === 'batteryStatus') bike.batteryStatus = parsed.value || (bike.batteryStatus === 'LOW' ? 'NORMAL' : 'LOW');
        else if (sensor === 'absStatus') bike.absStatus = parsed.value || (bike.absStatus === 'FAULT' ? 'NORMAL' : 'FAULT');
        else if (sensor === 'tractionControlStatus') bike.tractionControlStatus = parsed.value || (bike.tractionControlStatus === 'OFF' ? 'ACTIVE' : 'OFF');
        else if (sensor === 'sideStandStatus') {
          const next = parsed.value || (bike.sideStandStatus === 'DOWN' ? 'UP' : 'DOWN');
          bike.sideStandStatus = next;
          bike.sidestandDown = next === 'DOWN';
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          highBeam: bike.highBeam,
          lowFuel: bike.lowFuel,
          batteryStatus: bike.batteryStatus,
          absStatus: bike.absStatus,
          tractionControlStatus: bike.tractionControlStatus,
          sideStandStatus: bike.sideStandStatus,
        }));
      });
      return;
    }

    if (req.url === '/api/simulator/state' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        deviceId: bike.deviceId,
        vehicleState: bike.vehicleState,
        ignition: bike.ignition,
        lock: bike.lock,
        alarmArmed: bike.alarmArmed,
        alarmTriggered: bike.alarmTriggered,
        ridingMode: bike.ridingMode,
        headlight: bike.headlight,
        highBeam: bike.highBeam,
        lowFuel: bike.lowFuel,
        batteryStatus: bike.batteryStatus,
        absStatus: bike.absStatus,
        tractionControlStatus: bike.tractionControlStatus,
        sideStandStatus: bike.sideStandStatus,
        indicators: bike.indicators,
        hazard: bike.hazard,
        horn: bike.horn,
        physics: bike.physics.getState(),
        gps: bike.gps.getData(),
      }));
      return;
    }

    if (req.url === '/api/simulator/camera/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(bike.camera.getStatus()));
      return;
    }

    if (req.url === '/api/simulator/camera/snapshot' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const snap = await bike.camera.captureSnapshot(parsed.facing || 'FRONT', {
            speed: bike.physics.speed,
            rpm: bike.physics.rpm,
            gps: bike.gps.getData(),
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(snap));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (req.url === '/api/simulator/camera/record/start' && req.method === 'POST') {
      bike.camera.startRecording('FRONT').then((r) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(r));
      });
      return;
    }

    if (req.url === '/api/simulator/camera/record/stop' && req.method === 'POST') {
      bike.camera.stopRecording().then((r) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(r));
      });
      return;
    }

    if (req.url.startsWith('/api/simulator/camera/frame')) {
      const urlParams = new URL(req.url, `http://${req.headers.host}`);
      const facing = urlParams.searchParams.get('facing') || 'FRONT';
      const { jpegBuffer } = bike.camera.generateRealFrame(facing, {
        speed: bike.physics.speed,
        rpm: bike.physics.rpm,
        gps: bike.gps.getData(),
      });
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': jpegBuffer.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      res.end(jpegBuffer);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });

  server.listen(SIMULATOR_PORT, () => {
    console.log(`[Simulator HTTP Bridge] Listening at http://localhost:${SIMULATOR_PORT}`);
    console.log('Commands:');
    console.log('  [POST /api/simulator/vehicle/start] - Keyless PIN Start');
    console.log('  [POST /api/simulator/vehicle/sleep] - Lock and enter standby');
    console.log('  [POST /api/simulator/tamper]        - Simulate tamper / vibration');
    console.log('  [GET  /api/simulator/state]         - Inspect vehicle & IoT state');
    console.log('----------------------------------------------------');
  });

  // 2. Interactive Terminal Keystroke Handling (if TTY)
  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    console.log('Keyboard shortcuts:');
    console.log('  [s] Start vehicle (PIN: 1234)');
    console.log('  [l] Lock / Sleep vehicle');
    console.log('  [t] Simulate anti-theft movement / tamper');
    console.log('  [q] Quit simulator');
    console.log('----------------------------------------------------');

    process.stdin.on('keypress', (str, key) => {
      if (key.name === 's') {
        bike.startWithPin('1234');
      } else if (key.name === 'l') {
        bike.enterSleep();
      } else if (key.name === 't') {
        bike.triggerTamper();
      } else if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
        console.log('\nStopping simulator...');
        bike.disconnect().then(() => process.exit(0));
      }
    });
  }
}

run().catch((err) => {
  console.error('[Fatal Simulator Error]', err);
  process.exit(1);
});
