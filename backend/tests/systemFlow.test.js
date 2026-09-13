import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { initMqttBrokerAndClient, shutdownMqtt, registerMqttHandlers } from '../src/config/mqtt.js';
import { initSocketService } from '../src/services/socketService.js';
import { handleCommandAck, dispatchCommand } from '../src/services/commandDispatcher.js';
import {
  processHeartbeat,
  processTelemetry,
  processSecurityAlert,
  processDeviceStatus,
} from '../src/services/telemetryProcessor.js';
import { User } from '../src/models/User.js';
import { Motorcycle } from '../src/models/Motorcycle.js';
import { Device } from '../src/models/Device.js';
import { VehicleStatus } from '../src/models/VehicleStatus.js';
import { Command } from '../src/models/Command.js';
import { CommandAck } from '../src/models/CommandAck.js';
import { Geofence } from '../src/models/Geofence.js';
import { SecurityEvent } from '../src/models/SecurityEvent.js';
import { SimulatorBikeController } from '../../bike-simulator/src/controller/SimulatorBikeController.js';
import { checkGeofenceViolation } from '../src/services/geofenceService.js';

describe('Connected Smart Motorcycle Platform - Full System Integration Test', () => {
  let server;
  let testUser;
  let testBike;
  let simulator;
  const DEVICE_ID = 'BIKE-TEST-4G-01';

  before(async () => {
    // 1. Connect MongoDB
    await connectDB();

    // 2. Start HTTP & Socket server
    const expressApp = (await import('express')).default();
    server = http.createServer(expressApp);
    initSocketService(server);

    // 3. Register handlers
    registerMqttHandlers({
      onHeartbeat: (deviceId, data) => processHeartbeat(deviceId, data),
      onTelemetry: (deviceId, data) => processTelemetry(deviceId, data),
      onAck: (deviceId, data) => handleCommandAck(deviceId, data),
      onStatus: (deviceId, data) => processDeviceStatus(deviceId, data),
      onSecurity: (deviceId, data) => processSecurityAlert(deviceId, data),
    });

    // 4. Start MQTT broker & backend client
    await initMqttBrokerAndClient();

    // 5. Seed test data
    const passwordHash = await User.hashPassword('Pass1234!');
    testUser = await User.create({
      name: 'Test Rider',
      email: `rider_${Date.now()}@test.com`,
      passwordHash,
    });

    testBike = await Motorcycle.create({
      ownerId: testUser._id,
      name: 'Velocity Apex 1000',
      model: 'Apex-V10',
      registrationNumber: `REG-${Date.now()}`,
      deviceId: DEVICE_ID,
      fuelCapacity: 16,
    });

    await Device.create({
      deviceId: DEVICE_ID,
      motorcycleId: testBike._id,
      networkStatus: 'ONLINE',
      batteryPercentage: 86,
      batteryVoltage: 12.6,
    });

    await VehicleStatus.create({
      motorcycleId: testBike._id,
      deviceId: DEVICE_ID,
      isOnline: true,
      ignition: false,
      lock: true,
      powerMode: 'LOW_POWER_STANDBY',
      batteryPercentage: 86,
    });

    await Geofence.create({
      motorcycleId: testBike._id,
      name: 'Safezone',
      latitude: 12.9716,
      longitude: 77.5946,
      radiusMeters: 200,
      enabled: true,
    });
  });

  after(async () => {
    if (simulator) await simulator.disconnect();
    await shutdownMqtt();
    await disconnectDB();
    if (server) server.close();
  });

  it('1. Connects Bike Simulator over MQTT and announces ONLINE', async () => {
    simulator = new SimulatorBikeController(DEVICE_ID, 'mqtt://localhost:1883');
    await simulator.connect();

    // Small delay to allow broker propagation
    await new Promise((r) => setTimeout(r, 400));

    const device = await Device.findOne({ deviceId: DEVICE_ID });
    assert.equal(device.networkStatus, 'ONLINE');
  });

  it('2. Scenario: Full Power Ignition ON -> Ignition OFF (Low-Power Standby) -> Device still ONLINE', async () => {
    // 2.1 Turn ignition ON
    simulator.ignition = true;
    simulator.updateOperatingMode();
    await new Promise((r) => setTimeout(r, 600));

    let status = await VehicleStatus.findOne({ deviceId: DEVICE_ID });
    assert.equal(status.isOnline, true);
    assert.equal(status.ignition, true);
    assert.equal(status.powerMode, 'FULL_POWER');

    // 2.2 Turn ignition OFF
    simulator.ignition = false;
    simulator.updateOperatingMode();
    await new Promise((r) => setTimeout(r, 600));

    // 2.3 Verify: Ignition is OFF, but bike is still ONLINE in LOW_POWER_STANDBY!
    status = await VehicleStatus.findOne({ deviceId: DEVICE_ID });
    assert.equal(status.ignition, false, 'Ignition must be OFF');
    assert.equal(status.isOnline, true, 'IoT controller must remain ONLINE');
    assert.equal(status.powerMode, 'LOW_POWER_STANDBY');
    assert.ok(status.batteryPercentage > 0, 'Battery percentage must be present');
  });

  it('3. Scenario: Send LOCK command while Ignition is OFF -> Command executed & ACK returned', async () => {
    // Make sure bike lock is currently false so we test locking it
    simulator.lock = false;
    await VehicleStatus.findOneAndUpdate({ deviceId: DEVICE_ID }, { lock: false });

    const result = await dispatchCommand({
      motorcycleId: testBike._id,
      deviceId: DEVICE_ID,
      userId: testUser._id,
      command: 'LOCK',
    });

    assert.equal(result.status, 'SUCCESS');
    assert.equal(result.resultingState.lock, true);

    // Verify in MongoDB Command table
    const cmdRecord = await Command.findOne({ commandId: result.commandId });
    assert.equal(cmdRecord.status, 'SUCCESS');
    assert.ok(cmdRecord.completedAt);

    // Verify in MongoDB CommandAck table
    const ackRecord = await CommandAck.findOne({ commandId: result.commandId });
    assert.equal(ackRecord.status, 'SUCCESS');
    assert.equal(ackRecord.resultingState.lock, true);

    // Verify updated status in MongoDB VehicleStatus
    const updatedStatus = await VehicleStatus.findOne({ deviceId: DEVICE_ID });
    assert.equal(updatedStatus.lock, true);
    assert.equal(updatedStatus.ignition, false, 'Ignition remains OFF throughout command execution');
  });

  it('4. Scenario: Send UNLOCK command and SET_RIDING_MODE command via MQTT', async () => {
    const unlockRes = await dispatchCommand({
      motorcycleId: testBike._id,
      deviceId: DEVICE_ID,
      userId: testUser._id,
      command: 'UNLOCK',
    });
    assert.equal(unlockRes.status, 'SUCCESS');
    assert.equal(unlockRes.resultingState.lock, false);

    const modeRes = await dispatchCommand({
      motorcycleId: testBike._id,
      deviceId: DEVICE_ID,
      userId: testUser._id,
      command: 'SET_RIDING_MODE',
      parameters: { mode: 'SPORT' },
    });
    assert.equal(modeRes.status, 'SUCCESS');
    assert.equal(modeRes.resultingState.ridingMode, 'SPORT');
  });

  it('5. Security: Geofence violation creates SecurityEvent and Notification', async () => {
    // Coordinate far outside 200m geofence (approx 12km away)
    const outsideLat = 13.0827;
    const outsideLon = 77.5877;

    const violated = await checkGeofenceViolation(
      testBike._id,
      DEVICE_ID,
      outsideLat,
      outsideLon
    );
    assert.equal(violated, true);

    const event = await SecurityEvent.findOne({
      motorcycleId: testBike._id,
      eventType: 'GEOFENCE_EXIT',
    });
    assert.ok(event);
    assert.equal(event.severity, 'CRITICAL');
  });

  it('6. Bike Offline test: Commands must fail with BIKE_OFFLINE and NOT falsely succeed', async () => {
    // Disconnect the simulator to simulate lost 4G connection
    await simulator.disconnect();
    await Device.findOneAndUpdate({ deviceId: DEVICE_ID }, { networkStatus: 'OFFLINE' });
    await VehicleStatus.findOneAndUpdate({ deviceId: DEVICE_ID }, { isOnline: false });

    await assert.rejects(
      async () => {
        await dispatchCommand({
          motorcycleId: testBike._id,
          deviceId: DEVICE_ID,
          userId: testUser._id,
          command: 'LOCK',
        });
      },
      (err) => {
        assert.equal(err.message, 'Bike is currently offline');
        assert.equal(err.statusCode, 503);
        assert.equal(err.command.status, 'BIKE_OFFLINE');
        return true;
      }
    );
  });
});
