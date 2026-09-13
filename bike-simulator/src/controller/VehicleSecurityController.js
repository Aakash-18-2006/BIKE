// VehicleSecurityController.js - Vehicle-side Security Controller with Functional Safety
import crypto from 'crypto';

export const SECURITY_MODES = {
  DISARMED: 'DISARMED',
  ARMED: 'ARMED',
  SECURITY_MODE_ACTIVE: 'SECURITY_MODE_ACTIVE',
  THEFT_DETECTED: 'THEFT_DETECTED',
};

export const THEFT_EVENT_TYPES = {
  UNAUTHORIZED_MOVEMENT: 'UNAUTHORIZED_MOVEMENT',
  UNAUTHORIZED_IGNITION: 'UNAUTHORIZED_IGNITION',
  TAMPER_DETECTED: 'TAMPER_DETECTED',
  GPS_ANOMALY: 'GPS_ANOMALY',
  TCU_TAMPER: 'TCU_TAMPER',
  CAMERA_SECURITY_EVENT: 'CAMERA_SECURITY_EVENT',
  VEHICLE_MOVEMENT_WHILE_LOCKED: 'VEHICLE_MOVEMENT_WHILE_LOCKED',
  SECURITY_MODE_TRIGGERED: 'SECURITY_MODE_TRIGGERED',
  IGNITION_CUTOFF_REQUESTED: 'IGNITION_CUTOFF_REQUESTED',
  IGNITION_AUTHORIZATION_DISABLED: 'IGNITION_AUTHORIZATION_DISABLED',
};

export class VehicleSecurityController {
  constructor(bikeController) {
    this.bike = bikeController;
    this.securityMode = SECURITY_MODES.ARMED;
    this.securityActive = true;
    this.theftDetected = false;
    this.ignitionCutoffRequested = false;
    this.ignitionAuthorizationGranted = false;
    this.lastSecurityEvent = null;

    // Start background speed monitor for safe deferred ignition cutoff
    setInterval(() => this.evaluateSafeCutoff(), 250);
  }

  setSecurityMode(active) {
    this.securityActive = !!active;
    this.securityMode = active ? SECURITY_MODES.SECURITY_MODE_ACTIVE : SECURITY_MODES.DISARMED;
    console.log(`[Security Controller] Security Mode updated: ${this.securityMode}`);

    const event = this.createSecurityEvent({
      eventType: THEFT_EVENT_TYPES.SECURITY_MODE_TRIGGERED,
      severity: 'LOW',
      verificationState: 'VERIFIED',
      message: active ? 'Security Mode Activated by Owner' : 'Security Mode Disarmed',
    });
    this.dispatchSecurityEvent(event);
    return { securityMode: this.securityMode, securityActive: this.securityActive };
  }

  /**
   * Evaluates theft detection triggers from multiple sensor sources
   */
  async handleSensorTrigger(triggerType, details = {}) {
    console.log(`[Security Controller] ⚠ Sensor trigger received: ${triggerType}`);

    // If bike is running legitimately and security is not violated, ignore minor vibration
    const isLocked = this.bike.vehicleState === 'SLEEP' || this.bike.lock;
    const isMoving = this.bike.physics.speed > 0.5;

    let eventType = THEFT_EVENT_TYPES.TAMPER_DETECTED;
    let severity = 'MEDIUM';
    let verified = true;

    switch (triggerType) {
      case 'MOVEMENT_WHILE_LOCKED':
        eventType = THEFT_EVENT_TYPES.VEHICLE_MOVEMENT_WHILE_LOCKED;
        severity = 'CRITICAL';
        this.theftDetected = true;
        break;

      case 'UNAUTHORIZED_IGNITION':
        eventType = THEFT_EVENT_TYPES.UNAUTHORIZED_IGNITION;
        severity = 'CRITICAL';
        this.theftDetected = true;
        break;

      case 'UNAUTHORIZED_MOVEMENT':
        eventType = THEFT_EVENT_TYPES.UNAUTHORIZED_MOVEMENT;
        severity = 'CRITICAL';
        this.theftDetected = true;
        break;

      case 'TAMPER':
      case 'VIBRATION':
        eventType = isLocked ? THEFT_EVENT_TYPES.TAMPER_DETECTED : THEFT_EVENT_TYPES.TCU_TAMPER;
        severity = isLocked ? 'HIGH' : 'LOW';
        if (isLocked) this.theftDetected = true;
        break;

      case 'GPS_GEOFENCE_EXIT':
        eventType = THEFT_EVENT_TYPES.GPS_ANOMALY;
        severity = 'CRITICAL';
        this.theftDetected = true;
        break;

      default:
        eventType = THEFT_EVENT_TYPES.TAMPER_DETECTED;
    }

    // Wake camera subsystem if available and capture evidence
    let cameraEventId = null;
    let cameraCapture = null;
    if (this.bike.camera) {
      try {
        console.log('[Security Controller] Waking camera to capture security evidence snapshot...');
        cameraCapture = await this.bike.camera.captureSnapshot('FRONT', {
          speed: this.bike.physics.speed,
          rpm: this.bike.physics.rpm,
          gps: this.bike.gps.getData(),
          trigger: eventType,
        });
        cameraEventId = cameraCapture.eventId;
      } catch (err) {
        console.error('[Security Controller] Camera snapshot error:', err.message);
      }
    }

    const event = this.createSecurityEvent({
      eventType,
      severity,
      verificationState: verified ? 'VERIFIED' : 'PENDING',
      cameraEventId,
      cameraCapture,
      details,
      message: `Security Alert: ${eventType.replace(/_/g, ' ')} detected while bike was ${isLocked ? 'locked' : 'parked'}.`,
    });

    this.lastSecurityEvent = event;
    this.dispatchSecurityEvent(event);

    return event;
  }

  /**
   * CRITICAL AUTOMOTIVE FUNCTIONAL SAFETY IMPLEMENTATION
   * The system will NEVER abruptly cut engine power while the vehicle is moving.
   */
  async requestEmergencySecure() {
    console.log('[Security Controller] 🔒 Emergency [SECURE VEHICLE] action initiated by owner');
    const currentSpeed = this.bike.physics.speed;

    if (currentSpeed > 0.5) {
      // VEHICLE IN MOTION: Safe deferred cutoff
      this.ignitionCutoffRequested = true;
      console.warn(
        `[Security Controller] ⚠ SAFE-STATE INTERLOCK: Vehicle in motion (${currentSpeed.toFixed(1)} km/h). ` +
        `Engine cut-off DEFERRED until stationary to preserve rider safety. Restart lockout armed.`
      );

      const event = this.createSecurityEvent({
        eventType: THEFT_EVENT_TYPES.IGNITION_CUTOFF_REQUESTED,
        severity: 'CRITICAL',
        verificationState: 'VERIFIED',
        commandState: 'CUTOFF_PENDING_STOP',
        message: 'Engine cutoff requested. Deferring ignition cut until vehicle is stationary to maintain rider control.',
      });
      this.dispatchSecurityEvent(event);

      return {
        success: true,
        immediateCutoff: false,
        status: 'CUTOFF_PENDING_STOP',
        message: 'Vehicle is currently moving. Drivetrain cutoff safely deferred until motorcycle comes to a complete stop. Restart lockout is armed.',
        speed: currentSpeed,
      };
    } else {
      // VEHICLE STATIONARY: Execute immediate lockdown safely
      return this.executeSafeLockdown();
    }
  }

  /**
   * Executes safe vehicle lockdown once stationary
   */
  executeSafeLockdown() {
    console.log('[Security Controller] 🛑 Executing Safe Vehicle Lockdown (Stationary verified)');
    this.ignitionCutoffRequested = false;
    this.theftDetected = true;
    this.ignitionAuthorizationGranted = false;

    // Disarm vehicle drive system and lock actuators
    this.bike.vehicleState = 'SLEEP';
    this.bike.lock = true;
    this.bike.physics.speed = 0;
    this.bike.physics.targetSpeed = 0;
    this.bike.physics.rpm = 0;

    const event = this.createSecurityEvent({
      eventType: THEFT_EVENT_TYPES.IGNITION_AUTHORIZATION_DISABLED,
      severity: 'CRITICAL',
      verificationState: 'VERIFIED',
      commandState: 'LOCKED_OUT',
      message: 'Vehicle immobilized. Ignition authorization disabled and steering lock engaged.',
    });
    this.dispatchSecurityEvent(event);

    return {
      success: true,
      immediateCutoff: true,
      status: 'LOCKED_OUT',
      message: 'Motorcycle securely immobilized. Ignition authorization disabled and steering lock engaged.',
      speed: 0,
    };
  }

  /**
   * Periodic check: If an in-motion cutoff was requested, execute it as soon as speed drops to 0
   */
  evaluateSafeCutoff() {
    if (this.ignitionCutoffRequested && this.bike.physics.speed <= 0.5) {
      console.log('[Security Controller] Vehicle has come to a stop. Executing deferred ignition disable now.');
      this.executeSafeLockdown();
    }
  }

  createSecurityEvent({
    eventType,
    severity = 'HIGH',
    verificationState = 'VERIFIED',
    commandState = 'NONE',
    cameraEventId = null,
    cameraCapture = null,
    details = {},
    message = '',
  }) {
    const gpsData = this.bike.gps.getData();
    return {
      eventId: `SEC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      vehicleId: this.bike.deviceId,
      tcuId: `TCU-${this.bike.deviceId}`,
      eventType,
      timestamp: new Date().toISOString(),
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      speed: Number(this.bike.physics.speed.toFixed(1)),
      ignitionState: this.bike.vehicleState === 'RUNNING' ? 'ON' : 'OFF',
      lockState: this.bike.lock ? 'LOCKED' : 'UNLOCKED',
      cameraEventId,
      cameraCapture,
      severity,
      verificationState,
      commandState,
      resolvedAt: null,
      message,
      details,
    };
  }

  dispatchSecurityEvent(event) {
    if (this.bike.mqttClient && this.bike.mqttClient.connected) {
      const topic = `bike/${this.bike.deviceId}/security`;
      this.bike.mqttClient.publish(topic, JSON.stringify(event), { qos: 1 });
      console.log(`[Security Controller] Security event dispatched to ${topic}: ${event.eventType}`);
    }
  }

  getStatus() {
    return {
      securityMode: this.securityMode,
      securityActive: this.securityActive,
      theftDetected: this.theftDetected,
      ignitionCutoffRequested: this.ignitionCutoffRequested,
      ignitionAuthorized: this.ignitionAuthorizationGranted,
      lockState: this.bike.lock ? 'LOCKED' : 'UNLOCKED',
      vehicleState: this.bike.vehicleState,
      lastEvent: this.lastSecurityEvent,
    };
  }
}
