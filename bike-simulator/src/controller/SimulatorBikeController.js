import mqtt from 'mqtt';
import { BikeController } from './BikeController.js';
import { PhysicsEngine } from '../sensors/PhysicsEngine.js';
import { GpsSensor } from '../sensors/GpsSensor.js';
import { VehicleStartController } from './VehicleStartController.js';
import { MotorcycleCameraSubsystem } from '../camera/MotorcycleCameraSubsystem.js';
import { VehicleSecurityController } from './VehicleSecurityController.js';

export class SimulatorBikeController extends BikeController {
  constructor(deviceId = 'BIKE-4G-9021', brokerUrl = 'mqtt://localhost:1883') {
    super(deviceId);
    this.brokerUrl = brokerUrl;
    this.mqttClient = null;

    // Camera Subsystem Hardware
    this.camera = new MotorcycleCameraSubsystem({ deviceId: this.deviceId });

    // Vehicle State Machine (Keyless startup architecture)
    this.vehicleState = 'SLEEP'; // 'SLEEP' | 'WAKE' | 'RUNNING'
    this.startController = new VehicleStartController({ pin: '1234' });

    // Vehicle Security Controller (Functional safety & anti-theft)
    this.securityController = new VehicleSecurityController(this);

    // Subsystem States
    this.ignition = false; // Maintained for protocol backward compatibility (true when RUNNING)
    this.lock = true; // Locked by default in SLEEP
    this.alarmArmed = true;
    this.alarmTriggered = false;
    this.headlight = false;
    this.highBeam = false;
    this.lowFuel = false;
    this.batteryStatus = 'NORMAL';
    this.absStatus = 'NORMAL';
    this.tractionControlStatus = 'ACTIVE';
    this.sideStandStatus = 'UP';
    this.sidestandDown = false;
    this.indicators = 'OFF';
    this.hazard = false;
    this.horn = false;
    this.ridingMode = 'ECO';
    this.speedometerTheme = 'CYBER_NEON';
    this.speedometerBrightness = 90;

    // Physics & Sensors
    this.physics = new PhysicsEngine();
    this.gps = new GpsSensor();

    // Timers
    this.telemetryInterval = null;
    this.heartbeatInterval = null;
    this.isConnected = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log(`[Simulator IoT] Connecting 4G/LTE modem for ${this.deviceId} to ${this.brokerUrl}...`);

      this.mqttClient = mqtt.connect(this.brokerUrl, {
        clientId: `sim_${this.deviceId}_${Math.random().toString(16).slice(2, 8)}`,
        clean: true,
        will: {
          topic: `bike/${this.deviceId}/status`,
          payload: JSON.stringify({
            deviceId: this.deviceId,
            networkStatus: 'OFFLINE',
            timestamp: Date.now(),
          }),
          qos: 1,
          retain: true,
        },
      });

      this.mqttClient.on('connect', () => {
        this.isConnected = true;
        console.log(`[Simulator IoT] 4G/LTE Modem connected! Device: ${this.deviceId}`);

        // Announce online
        this.mqttClient.publish(
          `bike/${this.deviceId}/status`,
          JSON.stringify({
            deviceId: this.deviceId,
            networkStatus: 'ONLINE',
            timestamp: Date.now(),
          }),
          { qos: 1, retain: true }
        );

        // Subscribe to server commands topic
        const commandTopic = `bike/${this.deviceId}/commands`;
        this.mqttClient.subscribe(commandTopic, { qos: 1 }, (err) => {
          if (err) console.error(`[Simulator IoT] Failed to subscribe to ${commandTopic}:`, err);
          else console.log(`[Simulator IoT] Listening for remote commands on: ${commandTopic}`);
        });

        // Start appropriate background loop
        this.updateOperatingMode();
        resolve();
      });

      this.mqttClient.on('message', async (topic, payload) => {
        try {
          const packet = JSON.parse(payload.toString());
          if (topic.endsWith('/commands')) {
            await this.receiveCommand(packet);
          }
        } catch (err) {
          console.error('[Simulator IoT] Error parsing command message:', err.message);
        }
      });

      this.mqttClient.on('error', (err) => {
        console.error('[Simulator IoT] MQTT Error:', err.message);
      });
    });
  }

  updateOperatingMode() {
    clearInterval(this.telemetryInterval);
    clearInterval(this.heartbeatInterval);

    if (this.vehicleState === 'RUNNING') {
      this.ignition = true;
      console.log(`[Simulator IoT] ---> VEHICLE STATE: RUNNING (Drive System Active) <---`);
      // High-frequency telemetry stream (every 250ms)
      this.telemetryInterval = setInterval(() => {
        this.tickFullPowerTelemetry();
      }, 250);
    } else {
      this.ignition = false;
      console.log(`[Simulator IoT] ---> VEHICLE STATE: ${this.vehicleState} (Low-Power 4G Standby) <---`);
      // Initial heartbeat immediately
      this.tickLowPowerHeartbeat();
      // Periodic heartbeat every 10 seconds
      this.heartbeatInterval = setInterval(() => {
        this.tickLowPowerHeartbeat();
      }, 10000);
    }
  }

  tickFullPowerTelemetry() {
    const physicsData = this.physics.update(true, this.ridingMode);
    const gpsData = this.gps.update(physicsData.speed);

    const payload = {
      deviceId: this.deviceId,
      powerMode: 'FULL_POWER',
      vehicleState: this.vehicleState,
      ignition: true,
      lock: this.lock,
      alarmArmed: this.alarmArmed,
      alarmTriggered: this.alarmTriggered,
      ridingMode: this.ridingMode,
      headlight: this.headlight,
      highBeam: this.highBeam,
      lowFuel: this.lowFuel !== undefined ? this.lowFuel : (physicsData.fuelLevel < 20),
      batteryStatus: this.batteryStatus || (physicsData.batteryPercentage < 20 ? 'LOW' : 'NORMAL'),
      absStatus: this.absStatus || 'NORMAL',
      tractionControlStatus: this.tractionControlStatus || 'ACTIVE',
      sideStandStatus: this.sideStandStatus || (this.sidestandDown ? 'DOWN' : (physicsData.speed === 0 ? 'DOWN' : 'UP')),
      sidestandDown: this.sideStandStatus === 'DOWN' || this.sidestandDown,
      indicators: this.indicators,
      hazard: this.hazard,
      horn: this.horn,
      ...physicsData,
      gps: gpsData,
      security: this.securityController.getStatus(),
      timestamp: Date.now(),
    };

    this.sendTelemetry(payload);
  }

  tickLowPowerHeartbeat() {
    const physicsData = this.physics.update(false);
    const gpsData = this.gps.getData();

    const payload = {
      deviceId: this.deviceId,
      powerMode: 'LOW_POWER_STANDBY',
      vehicleState: this.vehicleState,
      ignition: false,
      lock: this.lock,
      alarmArmed: this.alarmArmed,
      alarmTriggered: this.alarmTriggered,
      ridingMode: this.ridingMode,
      highBeam: false,
      lowFuel: physicsData.lowFuel,
      batteryStatus: physicsData.batteryStatus,
      absStatus: 'NORMAL',
      tractionControlStatus: 'ACTIVE',
      sideStandStatus: 'DOWN',
      sidestandDown: true,
      batteryPercentage: physicsData.batteryPercentage,
      batteryVoltage: physicsData.batteryVoltage,
      fuelLevel: physicsData.fuelLevel,
      tirePressure: physicsData.tirePressure,
      stabilityIndex: physicsData.stabilityIndex,
      network: '4G-LTE',
      signalQuality: 92,
      gps: gpsData,
      security: this.securityController.getStatus(),
      timestamp: Date.now(),
    };

    this.sendHeartbeat(payload);
  }

  sendTelemetry(data) {
    if (!this.isConnected || !this.mqttClient) return;
    this.mqttClient.publish(`bike/${this.deviceId}/telemetry`, JSON.stringify(data), { qos: 0 });
  }

  sendHeartbeat(data) {
    if (!this.isConnected || !this.mqttClient) return;
    this.mqttClient.publish(`bike/${this.deviceId}/heartbeat`, JSON.stringify(data), { qos: 1 });
  }

  async receiveCommand(cmdPacket) {
    const { commandId, command, parameters = {}, expiresAt } = cmdPacket;
    console.log(`[Simulator IoT] Received remote command: ${command} (${commandId})`);

    // Check expiration
    if (expiresAt && Date.now() > expiresAt) {
      await this.acknowledgeCommand(commandId, 'FAILED', null, 'Command expired before arrival');
      return;
    }

    // 1. Send intermediate ACK: DEVICE_RECEIVED
    await this.acknowledgeCommand(commandId, 'DEVICE_RECEIVED', null, 'Command received by MCU');

    // 2. Hardware actuator delay simulation (150-250ms)
    await new Promise((r) => setTimeout(r, 200));

    let resultingState = {};
    let details = '';

    switch (command) {
      case 'START_VEHICLE': {
        // Authenticated Keyless Startup Flow
        const pin = parameters.pin || '';
        const authRes = this.startController.verifyPin(pin);
        if (!authRes.success) {
          await this.acknowledgeCommand(commandId, 'FAILED', { vehicleState: 'AUTH_FAILED' }, authRes.reason);
          return;
        }

        // Safety interlocks check
        const safetyRes = this.startController.performSafetyCheck(this);
        if (!safetyRes.passed) {
          await this.acknowledgeCommand(commandId, 'FAILED', { vehicleState: 'SAFETY_CHECK_FAILED' }, safetyRes.reason);
          return;
        }

        // Vehicle successfully started
        this.vehicleState = 'RUNNING';
        this.ignition = true;
        this.lock = false;
        this.alarmArmed = false;
        this.alarmTriggered = false;
        this.updateOperatingMode();

        resultingState = {
          vehicleState: 'RUNNING',
          ignition: true,
          lock: false,
          alarmArmed: false,
          alarmTriggered: false,
          powerMode: 'FULL_POWER',
        };
        details = 'Vehicle authenticated and drive system started';
        break;
      }

      case 'SLEEP_VEHICLE':
      case 'LOCK': {
        // Lock and enter Standby / Sleep
        this.vehicleState = 'SLEEP';
        this.ignition = false;
        this.lock = true;
        this.alarmArmed = true;
        this.updateOperatingMode();

        resultingState = {
          vehicleState: 'SLEEP',
          ignition: false,
          lock: true,
          alarmArmed: true,
          powerMode: 'LOW_POWER_STANDBY',
        };
        details = 'Vehicle locked and TFT returned to low-power standby';
        break;
      }

      case 'UNLOCK': {
        this.lock = false;
        resultingState = { lock: false };
        details = 'Lock disengaged';
        break;
      }

      case 'WAKE_TFT': {
        if (this.vehicleState === 'SLEEP') {
          this.vehicleState = 'WAKE';
        }
        resultingState = { vehicleState: this.vehicleState };
        details = 'TFT cluster awakened to standby touch screen';
        break;
      }

      case 'FIND_MY_BIKE': {
        this.flashLightsAndChirp();
        details = 'Hazard lights flashed with chime';
        resultingState = { hazard: false };
        break;
      }

      case 'ALARM_ARM': {
        this.alarmArmed = true;
        resultingState = { alarmArmed: true };
        details = 'Alarm armed';
        break;
      }

      case 'ALARM_DISARM': {
        this.alarmArmed = false;
        this.alarmTriggered = false;
        resultingState = { alarmArmed: false, alarmTriggered: false };
        details = 'Alarm disarmed';
        break;
      }

      case 'TRIGGER_ALARM': {
        this.alarmTriggered = true;
        this.horn = true;
        this.hazard = true;
        resultingState = { alarmTriggered: true, horn: true, hazard: true };
        details = 'Alarm siren and hazard active';
        break;
      }

      case 'HEADLIGHT_TOGGLE': {
        this.headlight = !this.headlight;
        resultingState = { headlight: this.headlight };
        details = `Headlight switched ${this.headlight ? 'ON' : 'OFF'}`;
        break;
      }

      case 'HIGH_BEAM_TOGGLE': {
        this.highBeam = !this.highBeam;
        resultingState = { highBeam: this.highBeam };
        details = `High beam switched ${this.highBeam ? 'ON' : 'OFF'}`;
        break;
      }

      case 'HAZARD_TOGGLE': {
        this.hazard = !this.hazard;
        this.indicators = this.hazard ? 'HAZARD' : 'OFF';
        resultingState = { hazard: this.hazard, indicators: this.indicators };
        details = `Hazard lights switched ${this.hazard ? 'ON' : 'OFF'}`;
        break;
      }

      case 'HORN_PULSE': {
        this.horn = true;
        setTimeout(() => { this.horn = false; }, 400);
        details = 'Horn pulsed for 400ms';
        resultingState = { horn: false };
        break;
      }

      case 'OPEN_SEAT': {
        details = 'Under-seat storage solenoid unlatched';
        resultingState = { seatUnlocked: true };
        break;
      }

      case 'OPEN_CHARGING_PORT': {
        details = 'Charging port / flap door unlatched';
        resultingState = { chargingPortUnlocked: true };
        break;
      }

      case 'SERVICE_REQUEST': {
        details = 'Diagnostic self-test completed: All electronic subsystems nominal';
        resultingState = { diagnosticStatus: 'ALL_SYSTEMS_OK', lastServiceCheck: Date.now() };
        break;
      }

      case 'SECURE_VEHICLE': {
        const secureResult = await this.securityController.requestEmergencySecure();
        resultingState = {
          vehicleState: this.vehicleState,
          lock: this.lock,
          securityStatus: secureResult.status,
          immediateCutoff: secureResult.immediateCutoff,
        };
        details = secureResult.message;
        break;
      }

      case 'SECURITY_MODE_SET': {
        const modeResult = this.securityController.setSecurityMode(parameters.active !== false);
        resultingState = {
          securityMode: modeResult.securityMode,
          securityActive: modeResult.securityActive,
        };
        details = modeResult.securityActive ? 'Security Mode Activated' : 'Security Mode Disarmed';
        break;
      }

      case 'SET_RIDING_MODE': {
        const raw = parameters.mode ? String(parameters.mode).toUpperCase() : 'ECO';
        const mappedMode = (raw === 'SPORT' || raw === 'NORMAL' || raw === 'FUEL')
          ? 'FUEL'
          : (raw === 'EV' ? 'EV' : 'ECO');

        if (['ECO', 'FUEL', 'EV', 'NORMAL', 'SPORT', 'RAIN'].includes(raw)) {
          this.ridingMode = mappedMode;
          resultingState = { ridingMode: this.ridingMode };
          details = `Riding mode switched to ${this.ridingMode}`;
        } else {
          await this.acknowledgeCommand(commandId, 'FAILED', null, 'Invalid riding mode specified');
          return;
        }
        break;
      }

      case 'SET_SPEEDOMETER_BRIGHTNESS': {
        this.speedometerBrightness = parameters.brightness || 90;
        resultingState = { speedometerBrightness: this.speedometerBrightness };
        details = `Brightness set to ${this.speedometerBrightness}%`;
        break;
      }

      case 'SET_SPEEDOMETER_THEME': {
        this.speedometerTheme = parameters.theme || 'CYBER_NEON';
        resultingState = { speedometerTheme: this.speedometerTheme };
        details = `Cluster theme set to ${this.speedometerTheme}`;
        break;
      }

      case 'CAMERA_SNAPSHOT': {
        const facing = parameters.facing || 'FRONT';
        const snapshot = await this.camera.captureSnapshot(facing, {
          speed: this.physics.speed,
          rpm: this.physics.rpm,
          gps: this.gps.getData(),
        });
        resultingState = {
          cameraStatus: this.camera.getStatus(),
          lastSnapshot: snapshot,
        };
        details = `Snapshot captured successfully on ${facing} camera`;
        break;
      }

      case 'CAMERA_START_RECORD': {
        const facing = parameters.facing || 'FRONT';
        const recResult = await this.camera.startRecording(facing);
        resultingState = {
          cameraStatus: this.camera.getStatus(),
          recording: recResult,
        };
        details = `Video recording started on ${facing} camera`;
        break;
      }

      case 'CAMERA_STOP_RECORD': {
        const stopResult = await this.camera.stopRecording();
        resultingState = {
          cameraStatus: this.camera.getStatus(),
          lastRecording: stopResult,
        };
        details = `Video recording stopped. Saved clip duration: ${stopResult.duration || 0}s`;
        break;
      }

      case 'CAMERA_STATUS': {
        resultingState = {
          cameraStatus: this.camera.getStatus(),
        };
        details = `Camera subsystem is ${this.camera.status}`;
        break;
      }

      default:
        await this.acknowledgeCommand(commandId, 'FAILED', null, `Unknown command: ${command}`);
        return;
    }

    // Send final ACK back to server
    await this.acknowledgeCommand(commandId, 'SUCCESS', resultingState, details);
  }

  async acknowledgeCommand(commandId, status, resultingState = null, details = '') {
    if (!this.isConnected || !this.mqttClient) return;

    const ackTopic = `bike/${this.deviceId}/ack`;
    const ackPayload = {
      commandId,
      deviceId: this.deviceId,
      status,
      details,
      resultingState,
      timestamp: Date.now(),
    };

    this.mqttClient.publish(ackTopic, JSON.stringify(ackPayload), { qos: 1 });
    console.log(`[Simulator IoT] Sent ACK for ${commandId}: ${status} -> ${details}`);
  }

  flashLightsAndChirp() {
    this.hazard = true;
    setTimeout(() => {
      this.hazard = false;
      setTimeout(() => {
        this.hazard = true;
        setTimeout(() => {
          this.hazard = false;
        }, 300);
      }, 200);
    }, 300);
  }

  // Keyless programmatic vehicle controls
  startWithPin(pin) {
    const authRes = this.startController.verifyPin(pin);
    if (!authRes.success) return authRes;

    const safetyRes = this.startController.performSafetyCheck(this);
    if (!safetyRes.passed) return safetyRes;

    this.vehicleState = 'RUNNING';
    this.ignition = true;
    this.lock = false;
    this.updateOperatingMode();
    return { success: true, vehicleState: 'RUNNING' };
  }

  enterSleep() {
    this.vehicleState = 'SLEEP';
    this.ignition = false;
    this.lock = true;
    this.updateOperatingMode();
    return { success: true, vehicleState: 'SLEEP' };
  }

  async triggerTamper() {
    console.warn(`[Simulator Physical Sensor] Tamper / vibration detected! Invoking VehicleSecurityController...`);
    return this.securityController.handleSensorTrigger('TAMPER');
  }

  async disconnect() {
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.mqttClient) {
      await new Promise((r) => this.mqttClient.end(false, r));
      this.isConnected = false;
    }
  }
}
