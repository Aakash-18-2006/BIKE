import { Device } from '../models/Device.js';
import { VehicleStatus } from '../models/VehicleStatus.js';
import { Location } from '../models/Location.js';
import { SecurityEvent } from '../models/SecurityEvent.js';
import { Notification } from '../models/Notification.js';
import { Motorcycle } from '../models/Motorcycle.js';
import { broadcastBikeUpdate } from './socketService.js';
import { checkGeofenceViolation } from './geofenceService.js';

let lastDbSaveMap = new Map();

export async function processHeartbeat(deviceId, payload) {
  const now = new Date();

  // 1. Update Device record
  await Device.findOneAndUpdate(
    { deviceId },
    {
      networkStatus: 'ONLINE',
      batteryPercentage: payload.batteryPercentage || payload.battery,
      batteryVoltage: payload.batteryVoltage || 12.6,
      signalQuality: payload.signalQuality || 85,
      lastHeartbeat: now,
    },
    { upsert: true }
  );

  // 2. Update VehicleStatus with vehicleState (SLEEP / WAKE / RUNNING)
  const vehicleState = payload.vehicleState || (payload.ignition ? 'RUNNING' : 'SLEEP');
  const updateData = {
    deviceId,
    isOnline: true,
    vehicleState,
    ignition: payload.ignition !== undefined ? payload.ignition : vehicleState === 'RUNNING',
    lock: payload.lock !== undefined ? payload.lock : true,
    powerMode: payload.powerMode || (vehicleState === 'RUNNING' ? 'FULL_POWER' : 'LOW_POWER_STANDBY'),
    batteryPercentage: payload.batteryPercentage || payload.battery || 85,
    batteryVoltage: payload.batteryVoltage || 12.6,
    fuelLevel: payload.fuelLevel !== undefined ? payload.fuelLevel : 78,
    lowFuel: payload.lowFuel !== undefined ? payload.lowFuel : (payload.fuelLevel !== undefined ? payload.fuelLevel < 20 : false),
    batteryStatus: payload.batteryStatus || (payload.batteryPercentage < 20 ? 'LOW' : 'NORMAL'),
    absStatus: payload.absStatus || 'NORMAL',
    tractionControlStatus: payload.tractionControlStatus || 'ACTIVE',
    sideStandStatus: payload.sideStandStatus || (payload.sidestandDown ? 'DOWN' : 'DOWN'),
    tirePressure: payload.tirePressure || { front: 38, rear: 40, unit: 'PSI' },
    stabilityIndex: payload.stabilityIndex || 94,
    sidestandDown: payload.sideStandStatus ? payload.sideStandStatus === 'DOWN' : (payload.sidestandDown !== undefined ? payload.sidestandDown : true),
    speed: vehicleState === 'RUNNING' ? (payload.speed || 0) : 0,
    rpm: vehicleState === 'RUNNING' ? (payload.rpm || 0) : 0,
    updatedAt: now,
  };

  if (payload.gps) {
    updateData.gps = {
      latitude: payload.gps.latitude,
      longitude: payload.gps.longitude,
      speed: 0,
      heading: payload.gps.heading || 0,
      accuracy: payload.gps.accuracy || 3.0,
      satellites: payload.gps.satellites || 8,
    };
  }

  const updatedStatus = await VehicleStatus.findOneAndUpdate(
    { deviceId },
    { $set: updateData },
    { new: true, upsert: true }
  );

  // 3. Broadcast real-time update to mobile apps & speedometer
  broadcastBikeUpdate(deviceId, 'status_update', updatedStatus);
  broadcastBikeUpdate(deviceId, 'heartbeat', {
    deviceId,
    vehicleState,
    ignition: updateData.ignition,
    isOnline: true,
    powerMode: updateData.powerMode,
    batteryPercentage: updateData.batteryPercentage,
    timestamp: now,
  });

  // 4. Geofence check if GPS coordinate is present
  if (payload.gps && updatedStatus.motorcycleId) {
    await checkGeofenceViolation(
      updatedStatus.motorcycleId,
      deviceId,
      payload.gps.latitude,
      payload.gps.longitude
    );
  }
}

export async function processTelemetry(deviceId, payload) {
  const now = new Date();
  const vehicleState = payload.vehicleState || 'RUNNING';

  // 1. Broadcast immediately to connected websockets (App & Speedometer)
  broadcastBikeUpdate(deviceId, 'live_telemetry', {
    deviceId,
    vehicleState,
    ...payload,
    timestamp: now.getTime(),
  });

  // 2. Throttle database updates to once every 3-5 seconds
  const lastSave = lastDbSaveMap.get(deviceId) || 0;
  if (Date.now() - lastSave > 3000) {
    lastDbSaveMap.set(deviceId, Date.now());

    const updateFields = {
      isOnline: true,
      vehicleState,
      ignition: payload.ignition !== undefined ? payload.ignition : true,
      lock: payload.lock !== undefined ? payload.lock : false,
      speed: payload.speed || 0,
      rpm: payload.rpm || 0,
      engineTemp: payload.engineTemp || 85,
      fuelLevel: payload.fuelLevel || 75,
      batteryPercentage: payload.batteryPercentage || 85,
      ridingMode: payload.ridingMode
        ? ((payload.ridingMode === 'SPORT' || payload.ridingMode === 'NORMAL' || payload.ridingMode === 'FUEL') ? 'FUEL' : (payload.ridingMode === 'EV' ? 'EV' : 'ECO'))
        : 'ECO',
      headlight: payload.headlight || false,
      highBeam: payload.highBeam !== undefined ? payload.highBeam : false,
      lowFuel: payload.lowFuel !== undefined ? payload.lowFuel : (payload.fuelLevel !== undefined ? payload.fuelLevel < 20 : false),
      batteryStatus: payload.batteryStatus || (payload.batteryPercentage < 20 ? 'LOW' : 'NORMAL'),
      absStatus: payload.absStatus || 'NORMAL',
      tractionControlStatus: payload.tractionControlStatus || 'ACTIVE',
      sideStandStatus: payload.sideStandStatus || (payload.sidestandDown ? 'DOWN' : 'UP'),
      sidestandDown: payload.sideStandStatus ? payload.sideStandStatus === 'DOWN' : Boolean(payload.sidestandDown),
      indicators: payload.indicators || 'OFF',
      powerMode: 'FULL_POWER',
      updatedAt: now,
    };

    if (payload.gps) {
      updateFields.gps = payload.gps;
    }

    const updated = await VehicleStatus.findOneAndUpdate(
      { deviceId },
      { $set: updateFields },
      { new: true, upsert: true }
    );

    // Save location breadcrumb if moving
    if (payload.gps && (payload.speed > 3 || Math.random() < 0.2)) {
      if (updated.motorcycleId) {
        await Location.create({
          motorcycleId: updated.motorcycleId,
          deviceId,
          latitude: payload.gps.latitude,
          longitude: payload.gps.longitude,
          speed: payload.speed,
          heading: payload.gps.heading,
          accuracy: payload.gps.accuracy,
          timestamp: now,
        });

        await checkGeofenceViolation(
          updated.motorcycleId,
          deviceId,
          payload.gps.latitude,
          payload.gps.longitude
        );
      }
    }
  }
}

export async function processSecurityAlert(deviceId, payload) {
  console.warn(`[Security Alert] Device ${deviceId}: ${payload.eventType} - ${payload.message}`);

  const status = await VehicleStatus.findOne({ deviceId });
  const bike = status && status.motorcycleId ? await Motorcycle.findById(status.motorcycleId) : null;

  const eventId = payload.eventId || `SEC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const vehicleId = bike?._id || status?.motorcycleId;
  const lat = payload.latitude || payload.location?.latitude || status?.gps?.latitude;
  const lon = payload.longitude || payload.location?.longitude || status?.gps?.longitude;

  const event = await SecurityEvent.create({
    eventId,
    vehicleId,
    motorcycleId: vehicleId,
    tcuId: payload.tcuId || `TCU-${deviceId}`,
    deviceId,
    eventType: payload.eventType || 'ALARM_TRIGGERED',
    severity: payload.severity || 'HIGH',
    verificationState: payload.verificationState || 'VERIFIED',
    commandState: payload.commandState || 'NONE',
    message: payload.message || 'Security sensor triggered on motorcycle.',
    latitude: lat,
    longitude: lon,
    speed: payload.speed !== undefined ? payload.speed : (status?.speed || 0),
    ignitionState: payload.ignitionState || (status?.ignition ? 'ON' : 'OFF'),
    lockState: payload.lockState || (status?.lock ? 'LOCKED' : 'UNLOCKED'),
    cameraEventId: payload.cameraEventId || (payload.cameraCapture ? payload.cameraCapture.eventId : null),
    details: payload.details || {},
    timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
  });

  if (bike && bike.ownerId) {
    await Notification.create({
      userId: bike.ownerId,
      motorcycleId: bike._id,
      title: `Security Alert: ${payload.eventType}`,
      body: payload.message || 'Suspicious activity detected on your motorcycle.',
      type: 'SECURITY',
    });
  }

  // If camera captured an automatic snapshot during this security event
  if (payload.cameraCapture && bike) {
    const { CameraEvent } = await import('../models/CameraEvent.js');
    await CameraEvent.create({
      eventId: payload.cameraCapture.eventId || `EVT-SEC-${Date.now()}`,
      vehicleId: bike._id,
      cameraId: `CAM-${deviceId}-01`,
      eventType: 'UNAUTHORIZED_ACCESS',
      mediaType: 'IMAGE',
      mediaReference: payload.cameraCapture.filename,
      mimeType: payload.cameraCapture.mimeType || 'image/jpeg',
      fileSizeBytes: payload.cameraCapture.fileSizeBytes || 0,
      status: 'SAVED',
      metadata: {
        triggerSource: 'TCU_SECURITY_INTERRUPT',
        latitude: lat,
        longitude: lon,
      },
    });
  }

  broadcastBikeUpdate(deviceId, 'security_alert', event);
}

export async function processDeviceStatus(deviceId, payload) {
  console.log(`[Device Status] Device ${deviceId}: ${payload.networkStatus}`);
  const isOnline = payload.networkStatus === 'ONLINE';

  await Device.findOneAndUpdate(
    { deviceId },
    { networkStatus: payload.networkStatus || 'OFFLINE' },
    { upsert: true }
  );

  const updatedStatus = await VehicleStatus.findOneAndUpdate(
    { deviceId },
    { $set: { isOnline, updatedAt: new Date() } },
    { new: true }
  );

  broadcastBikeUpdate(deviceId, 'device_status', { deviceId, isOnline });
  if (updatedStatus) {
    broadcastBikeUpdate(deviceId, 'status_update', updatedStatus);
  }
}
