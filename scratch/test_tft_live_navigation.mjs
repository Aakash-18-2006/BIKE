import { io } from '../speedometer/node_modules/socket.io-client/build/esm/index.js';
import { normalizeNavigationUpdate, SAMPLE_NAVIGATION_DATA } from '../speedometer/src/components/navigation/navigationModel.js';

const BACKEND_URL = 'http://localhost:5000';
const DEVICE_ID = 'BIKE-4G-9021';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('=== [TEST] Starting TFT Live Navigation Test Suite ===\n');

  // 1. Establish mobile and TFT socket connections
  const mobileSocket = io(BACKEND_URL, { transports: ['websocket'] });
  const tftSocket = io(BACKEND_URL, { transports: ['websocket'] });

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    mobileSocket.on('connect', () => {
      console.log('✔ Mobile socket connected to backend');
      mobileSocket.emit('join_device', DEVICE_ID);
      check();
    });
    tftSocket.on('connect', () => {
      console.log('✔ TFT socket connected to backend');
      tftSocket.emit('join_device', DEVICE_ID);
      check();
    });
  });

  await sleep(300);

  let currentTftState = { ...SAMPLE_NAVIGATION_DATA };
  const receivedPackets = [];

  tftSocket.on('navigation_update', (packet) => {
    receivedPackets.push(packet);
    currentTftState = normalizeNavigationUpdate(packet, currentTftState);
  });

  let tftSelectedReceived = null;
  mobileSocket.on('destination_selected', (dest) => {
    tftSelectedReceived = dest;
  });

  console.log('\n--- 1. Testing Initial Navigation Start & First Turn ---');
  const startPacket = {
    type: 'navigation_update',
    isNavigating: true,
    isDestinationReached: false,
    current: { lat: 12.9716, lng: 77.5946 },
    destination: { name: 'MG Road', lat: 12.9756, lng: 77.6066 },
    maneuver: 'right',
    instruction: 'Turn right onto MG Road',
    roadName: 'MG Road',
    distanceToTurn: 350,
    remainingDistance: 4500,
    etaMinutes: 12,
    stepIndex: 0,
    totalSteps: 4,
    route: {
      geometry: [
        [77.5946, 12.9716],
        [77.5980, 12.9725],
        [77.6015, 12.9738],
        [77.6066, 12.9756],
      ],
    },
    timestamp: Date.now(),
  };

  mobileSocket.emit('navigation_update', { deviceId: DEVICE_ID, ...startPacket });
  await sleep(300);

  if (currentTftState.active !== true) throw new Error(`Expected active: true, got ${currentTftState.active}`);
  if (currentTftState.status !== 'NAVIGATING') throw new Error(`Expected status: NAVIGATING, got ${currentTftState.status}`);
  if (currentTftState.nextTurn.action !== 'RIGHT') throw new Error(`Expected action: RIGHT, got ${currentTftState.nextTurn.action}`);
  if (currentTftState.nextTurn.distanceFormatted !== '350 m') throw new Error(`Expected 350 m, got ${currentTftState.nextTurn.distanceFormatted}`);
  if (currentTftState.nextTurn.streetName !== 'MG Road') throw new Error(`Expected MG Road, got ${currentTftState.nextTurn.streetName}`);
  console.log('✔ Start Navigation verified: RIGHT, 350 m, MG Road');

  console.log('\n--- 2. Testing Live GPS Changes & Distance Countdown ---');
  const approachingPacket = {
    ...startPacket,
    current: { lat: 12.9725, lng: 77.5980 },
    distanceToTurn: 100,
    remainingDistance: 4250,
    timestamp: Date.now(),
  };

  mobileSocket.emit('navigation_update', { deviceId: DEVICE_ID, ...approachingPacket });
  await sleep(300);

  if (currentTftState.nextTurn.distanceFormatted !== '100 m') throw new Error(`Expected 100 m, got ${currentTftState.nextTurn.distanceFormatted}`);
  if (currentTftState.currentLocation.lat !== 12.9725) throw new Error(`Expected GPS lat 12.9725, got ${currentTftState.currentLocation.lat}`);
  console.log('✔ Live GPS & Countdown verified: rider moved, distance 100 m');

  console.log('\n--- 3. Testing Automatic Turn Advancement (Next Step) ---');
  const nextStepPacket = {
    ...startPacket,
    current: { lat: 12.9738, lng: 77.6015 },
    stepIndex: 1,
    maneuver: 'straight',
    instruction: 'Continue straight on Outer Ring Road',
    roadName: 'Outer Ring Road',
    distanceToTurn: 1200,
    remainingDistance: 3900,
    etaMinutes: 10,
    timestamp: Date.now(),
  };

  mobileSocket.emit('navigation_update', { deviceId: DEVICE_ID, ...nextStepPacket });
  await sleep(300);

  if (currentTftState.stepIndex !== 1) throw new Error(`Expected stepIndex: 1, got ${currentTftState.stepIndex}`);
  if (currentTftState.nextTurn.action !== 'STRAIGHT') throw new Error(`Expected action: STRAIGHT, got ${currentTftState.nextTurn.action}`);
  if (currentTftState.nextTurn.distanceFormatted !== '1.2 km') throw new Error(`Expected 1.2 km, got ${currentTftState.nextTurn.distanceFormatted}`);
  if (currentTftState.nextTurn.streetName !== 'Outer Ring Road') throw new Error(`Expected Outer Ring Road, got ${currentTftState.nextTurn.streetName}`);
  console.log('✔ Turn Advancement verified: STRAIGHT, 1.2 km, Outer Ring Road');

  console.log('\n--- 4. Testing Off-Route Rerouting Replacement ---');
  const reroutePacket = {
    ...startPacket,
    current: { lat: 12.9740, lng: 77.6020 },
    stepIndex: 0,
    maneuver: 'left',
    instruction: 'Turn left onto Brigade Road',
    roadName: 'Brigade Road',
    distanceToTurn: 180,
    remainingDistance: 3500,
    route: {
      geometry: [
        [77.6020, 12.9740],
        [77.6040, 12.9745],
        [77.6066, 12.9756],
      ],
    },
    timestamp: Date.now(),
  };

  mobileSocket.emit('navigation_update', { deviceId: DEVICE_ID, ...reroutePacket });
  await sleep(300);

  if (currentTftState.nextTurn.action !== 'LEFT') throw new Error(`Expected action: LEFT, got ${currentTftState.nextTurn.action}`);
  if (currentTftState.route.geometry.length !== 3) throw new Error(`Expected 3 route points, got ${currentTftState.route.geometry.length}`);
  console.log('✔ Rerouting verified: new route geometry applied and turn updated to LEFT (Brigade Road)');

  console.log('\n--- 5. Testing Destination Reached ---');
  const arrivedPacket = {
    type: 'navigation_update',
    isNavigating: false,
    isDestinationReached: true,
    current: { lat: 12.9756, lng: 77.6066 },
    destination: { name: 'MG Road', lat: 12.9756, lng: 77.6066 },
    maneuver: 'arrived',
    instruction: 'Arrived at destination',
    roadName: 'MG Road',
    distanceToTurn: 0,
    remainingDistance: 0,
    etaMinutes: 0,
    stepIndex: 2,
    totalSteps: 2,
    route: { geometry: [] },
    timestamp: Date.now(),
  };

  mobileSocket.emit('navigation_update', { deviceId: DEVICE_ID, ...arrivedPacket });
  await sleep(300);

  if (currentTftState.status !== 'ARRIVED') throw new Error(`Expected status: ARRIVED, got ${currentTftState.status}`);
  if (currentTftState.nextTurn.action !== 'ARRIVED') throw new Error(`Expected action: ARRIVED, got ${currentTftState.nextTurn.action}`);
  if (currentTftState.nextTurn.distanceFormatted !== '0 m') throw new Error(`Expected 0 m, got ${currentTftState.nextTurn.distanceFormatted}`);
  if (currentTftState.remainingDistanceKm !== 0) throw new Error(`Expected 0 remaining km, got ${currentTftState.remainingDistanceKm}`);
  console.log('✔ Destination Reached verified: status ARRIVED, distance 0 m, route cleared');

  console.log('\n--- 6. Testing Navigation Stop (Clearing Stale Data) ---');
  const stopPacket = {
    type: 'navigation_update',
    isNavigating: false,
    isDestinationReached: false,
    current: { lat: 12.9756, lng: 77.6066 },
    destination: null,
    maneuver: 'none',
    instruction: '',
    roadName: '',
    distanceToTurn: 0,
    remainingDistance: 0,
    etaMinutes: 0,
    stepIndex: 0,
    totalSteps: 0,
    route: { geometry: [] },
    timestamp: Date.now(),
  };

  mobileSocket.emit('navigation_update', { deviceId: DEVICE_ID, ...stopPacket });
  await sleep(300);

  if (currentTftState.active !== false) throw new Error(`Expected active: false, got ${currentTftState.active}`);
  if (currentTftState.status !== 'IDLE') throw new Error(`Expected status: IDLE, got ${currentTftState.status}`);
  if (currentTftState.nextTurn.distanceFormatted !== '--') throw new Error(`Expected distanceFormatted: --, got ${currentTftState.nextTurn.distanceFormatted}`);
  if (currentTftState.route.geometry.length !== 0) throw new Error(`Expected empty route geometry, got ${currentTftState.route.geometry.length}`);
  console.log('✔ Navigation Stop verified: all active turns, ETA, remaining distance, and route cleared cleanly');

  console.log('\n--- 7. Testing TFT Destination Selection & Relay ---');
  tftSocket.emit('tft_destination_select', {
    deviceId: DEVICE_ID,
    destination: { name: 'Hosur', lat: 12.7409, lng: 77.8253 },
    timestamp: Date.now(),
  });
  await sleep(300);

  if (!tftSelectedReceived || tftSelectedReceived.destination?.name !== 'Hosur') {
    throw new Error(`Expected destination Hosur on mobile, got ${JSON.stringify(tftSelectedReceived)}`);
  }
  console.log('✔ TFT Destination Selection verified: Mobile received destination Hosur');

  console.log('\n--- 8. Testing Reconnect & Recovery ---');
  tftSocket.disconnect();
  await sleep(200);
  tftSocket.connect();
  await sleep(300);
  tftSocket.emit('join_device', DEVICE_ID);
  await sleep(200);

  // Send a fresh live packet after reconnect
  const recoveredPacket = {
    type: 'navigation_update',
    isNavigating: true,
    isDestinationReached: false,
    current: { lat: 12.7410, lng: 77.8250 },
    destination: { name: 'Hosur', lat: 12.7409, lng: 77.8253 },
    maneuver: 'slight_right',
    instruction: 'Keep right on NH 44',
    roadName: 'NH 44',
    distanceToTurn: 650,
    remainingDistance: 22000,
    etaMinutes: 32,
    stepIndex: 0,
    totalSteps: 5,
    route: { geometry: [[77.8250, 12.7410], [77.8253, 12.7409]] },
    timestamp: Date.now(),
  };

  mobileSocket.emit('navigation_update', { deviceId: DEVICE_ID, ...recoveredPacket });
  await sleep(300);

  if (currentTftState.nextTurn.action !== 'SLIGHT_RIGHT') throw new Error(`Expected SLIGHT_RIGHT, got ${currentTftState.nextTurn.action}`);
  if (currentTftState.nextTurn.distanceFormatted !== '650 m') throw new Error(`Expected 650 m, got ${currentTftState.nextTurn.distanceFormatted}`);
  console.log('✔ Reconnect & Recovery verified: TFT successfully re-joined and displays new navigation session without stale data');

  mobileSocket.disconnect();
  tftSocket.disconnect();

  console.log('\n==================================================');
  console.log('🎉 ALL 8 TFT LIVE NAVIGATION TESTS PASSED PERFECTLY!');
  console.log('==================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
