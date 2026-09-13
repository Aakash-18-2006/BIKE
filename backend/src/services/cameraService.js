import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CameraDevice } from '../models/CameraDevice.js';
import { CameraEvent } from '../models/CameraEvent.js';
import { Motorcycle } from '../models/Motorcycle.js';
import { dispatchCommand } from './commandDispatcher.js';
import { broadcastBikeUpdate } from './socketService.js';

const SIMULATOR_URL = 'http://localhost:5005';
const MEDIA_DIR = path.resolve(process.cwd(), 'uploads/media');
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

// Map of active live session tokens: token -> { vehicleId, expiresAt }
const activeLiveSessions = new Map();

export async function getCameraStatus(motorcycleId) {
  const bike = await Motorcycle.findById(motorcycleId);
  if (!bike) throw new Error('Motorcycle not found');

  // Find or initialize CameraDevice in MongoDB
  let cameraDevice = await CameraDevice.findOne({ vehicleId: bike._id });
  if (!cameraDevice) {
    cameraDevice = await CameraDevice.create({
      cameraId: `CAM-${bike.deviceId}-01`,
      vehicleId: bike._id,
      deviceStatus: 'ONLINE',
      cameraType: 'DUAL',
      storageCapacity: 64000,
      storageUsed: 21450,
      firmwareVersion: 'v3.4.2-CAM-LTE',
      resolution: '1920x1080@30fps',
    });
  }

  // Query live TCU hardware status if available
  try {
    const res = await fetch(`${SIMULATOR_URL}/api/simulator/camera/status`);
    if (res.ok) {
      const liveStatus = await res.json();
      cameraDevice.deviceStatus = liveStatus.deviceStatus;
      cameraDevice.storageUsed = liveStatus.storageUsed;
      cameraDevice.isRecording = liveStatus.isRecording;
      cameraDevice.isLiveStreaming = liveStatus.isLiveStreaming;
      cameraDevice.lastSeen = new Date();
      await cameraDevice.save();
    }
  } catch (e) {
    // Simulator bridge offline
  }

  return cameraDevice;
}

export async function captureSnapshot(motorcycleId, userId, facing = 'FRONT') {
  const bike = await Motorcycle.findById(motorcycleId);
  if (!bike) throw new Error('Motorcycle not found');

  let cameraDevice = await getCameraStatus(motorcycleId);

  // Dispatch SNAPSHOT command over TCU gateway
  let snapshotResult = null;
  try {
    const res = await fetch(`${SIMULATOR_URL}/api/simulator/camera/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facing }),
    });
    if (res.ok) {
      snapshotResult = await res.json();
    }
  } catch (err) {
    // Or dispatch via MQTT
    const cmdResult = await dispatchCommand({
      motorcycleId: bike._id,
      deviceId: bike.deviceId,
      userId,
      command: 'CAMERA_SNAPSHOT',
      parameters: { facing },
    });
    snapshotResult = cmdResult.resultingState?.lastSnapshot;
  }

  if (!snapshotResult) {
    throw new Error('Failed to obtain snapshot from motorcycle camera hardware');
  }

  // Create CameraEvent audit record in MongoDB
  const eventId = snapshotResult.eventId || `EVT-SNAP-${Date.now()}`;
  const cameraEvent = await CameraEvent.create({
    eventId,
    vehicleId: bike._id,
    cameraId: cameraDevice.cameraId,
    eventType: 'MANUAL_SNAPSHOT',
    timestamp: new Date(),
    mediaType: 'IMAGE',
    mediaReference: snapshotResult.filename,
    mimeType: snapshotResult.mimeType || 'image/jpeg',
    fileSizeBytes: snapshotResult.fileSizeBytes || 0,
    status: 'SAVED',
    metadata: {
      ...snapshotResult.metadata,
      cameraFacing: facing,
      triggerSource: 'USER_APP',
    },
  });

  // Broadcast event to connected mobile app
  broadcastBikeUpdate(bike.deviceId, 'camera_event', cameraEvent);

  return {
    cameraEvent,
    mediaUrl: `/api/motorcycles/${bike._id}/camera/media/${cameraEvent._id}`,
    snapshot: snapshotResult,
  };
}

export async function startRecording(motorcycleId, userId, facing = 'FRONT') {
  const bike = await Motorcycle.findById(motorcycleId);
  if (!bike) throw new Error('Motorcycle not found');

  const cameraDevice = await getCameraStatus(motorcycleId);

  // Send record command
  try {
    await fetch(`${SIMULATOR_URL}/api/simulator/camera/record/start`, { method: 'POST' });
  } catch (e) {
    await dispatchCommand({
      motorcycleId: bike._id,
      deviceId: bike.deviceId,
      userId,
      command: 'CAMERA_START_RECORD',
      parameters: { facing },
    });
  }

  cameraDevice.deviceStatus = 'RECORDING';
  cameraDevice.isRecording = true;
  cameraDevice.recordingStartedAt = new Date();
  await cameraDevice.save();

  // Log recording event
  const cameraEvent = await CameraEvent.create({
    eventId: `EVT-REC-START-${Date.now()}`,
    vehicleId: bike._id,
    cameraId: cameraDevice.cameraId,
    eventType: 'MANUAL_RECORDING',
    mediaType: 'VIDEO',
    status: 'PROCESSING',
    metadata: { cameraFacing: facing, triggerSource: 'USER_APP' },
  });

  broadcastBikeUpdate(bike.deviceId, 'camera_status_update', cameraDevice);

  return { cameraDevice, cameraEvent };
}

export async function stopRecording(motorcycleId, userId) {
  const bike = await Motorcycle.findById(motorcycleId);
  if (!bike) throw new Error('Motorcycle not found');

  const cameraDevice = await getCameraStatus(motorcycleId);

  let stopResult = null;
  try {
    const res = await fetch(`${SIMULATOR_URL}/api/simulator/camera/record/stop`, { method: 'POST' });
    stopResult = await res.json();
  } catch (e) {
    const cmdResult = await dispatchCommand({
      motorcycleId: bike._id,
      deviceId: bike.deviceId,
      userId,
      command: 'CAMERA_STOP_RECORD',
    });
    stopResult = cmdResult.resultingState?.lastRecording;
  }

  cameraDevice.deviceStatus = 'ONLINE';
  cameraDevice.isRecording = false;
  cameraDevice.recordingStartedAt = null;
  if (stopResult?.duration) {
    cameraDevice.storageUsed = Number((cameraDevice.storageUsed + stopResult.duration * 1.5).toFixed(1));
  }
  await cameraDevice.save();

  // Create completed video event in MongoDB
  const cameraEvent = await CameraEvent.create({
    eventId: `EVT-REC-DONE-${Date.now()}`,
    vehicleId: bike._id,
    cameraId: cameraDevice.cameraId,
    eventType: 'MANUAL_RECORDING',
    mediaType: 'VIDEO',
    mediaReference: stopResult?.filename,
    mimeType: 'video/mp4',
    fileSizeBytes: stopResult?.fileSizeBytes || 2048000,
    duration: stopResult?.duration || 10,
    status: 'SAVED',
    metadata: { triggerSource: 'USER_APP' },
  });

  broadcastBikeUpdate(bike.deviceId, 'camera_status_update', cameraDevice);
  broadcastBikeUpdate(bike.deviceId, 'camera_event', cameraEvent);

  return { cameraDevice, cameraEvent, stopResult };
}

export function createLiveStreamSession(motorcycleId, userId) {
  const sessionToken = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minute expiring session

  activeLiveSessions.set(sessionToken, {
    vehicleId: motorcycleId.toString(),
    userId: userId.toString(),
    expiresAt,
  });

  return {
    sessionToken,
    expiresAt,
    streamUrl: `/api/motorcycles/${motorcycleId}/camera/stream?token=${sessionToken}`,
    websocketTopic: `camera_stream_${motorcycleId}`,
  };
}

export function validateLiveSession(token, motorcycleId) {
  const session = activeLiveSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    activeLiveSessions.delete(token);
    return false;
  }
  return session.vehicleId === motorcycleId.toString();
}

export async function getCameraEvents(motorcycleId, limit = 50) {
  return CameraEvent.find({ vehicleId: motorcycleId })
    .sort({ timestamp: -1 })
    .limit(limit);
}

export async function getMediaFile(motorcycleId, mediaId) {
  const query = { vehicleId: motorcycleId };
  if (mediaId && (mediaId.startsWith('EVT-') || mediaId.includes('-'))) {
    query.$or = [{ eventId: mediaId }, { mediaReference: mediaId }];
  } else {
    query._id = mediaId;
  }
  const event = await CameraEvent.findOne(query);
  if (!event || !event.mediaReference) return null;

  const filePath = path.join(MEDIA_DIR, event.mediaReference);
  if (!fs.existsSync(filePath)) return null;

  return {
    filePath,
    mimeType: event.mimeType || 'image/jpeg',
    filename: event.mediaReference,
  };
}
