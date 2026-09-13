import mongoose from 'mongoose';

const CameraEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Motorcycle', required: true, index: true },
  cameraId: { type: String, required: true, index: true },
  eventType: {
    type: String,
    enum: [
      'MOTION_DETECTED',
      'UNAUTHORIZED_ACCESS',
      'VEHICLE_MOVEMENT',
      'IGNITION_EVENT',
      'MANUAL_SNAPSHOT',
      'MANUAL_RECORDING',
      'CAMERA_DISCONNECTED',
      'STORAGE_FULL',
    ],
    required: true,
  },
  timestamp: { type: Date, default: Date.now, index: true },
  mediaType: { type: String, enum: ['IMAGE', 'VIDEO', 'NONE'], default: 'IMAGE' },
  mediaReference: { type: String }, // Stored file path / object storage key
  mimeType: { type: String, default: 'image/jpeg' },
  fileSizeBytes: { type: Number, default: 0 },
  duration: { type: Number, default: 0 }, // In seconds (for video recordings)
  status: { type: String, enum: ['SAVED', 'PROCESSING', 'FAILED', 'PURGED'], default: 'SAVED' },
  metadata: {
    speedKmh: Number,
    rpm: Number,
    latitude: Number,
    longitude: Number,
    cameraFacing: String, // 'FRONT' or 'REAR'
    resolution: String,
    triggerSource: String, // 'USER_APP' or 'TCU_SECURITY_INTERRUPT'
  },
});

export const CameraEvent = mongoose.model('CameraEvent', CameraEventSchema);
