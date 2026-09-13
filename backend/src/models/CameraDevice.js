import mongoose from 'mongoose';

const CameraDeviceSchema = new mongoose.Schema({
  cameraId: { type: String, required: true, unique: true, index: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Motorcycle', required: true, index: true },
  deviceStatus: {
    type: String,
    enum: ['ONLINE', 'OFFLINE', 'STANDBY', 'RECORDING', 'FAULT', 'STORAGE_FULL'],
    default: 'ONLINE',
  },
  cameraType: {
    type: String,
    enum: ['FRONT', 'REAR', 'DUAL'],
    default: 'FRONT',
  },
  firmwareVersion: { type: String, default: 'v3.2.0-CAM-HD' },
  resolution: { type: String, default: '1920x1080@30fps' },
  fov: { type: Number, default: 145 }, // Field of view in degrees
  storageCapacity: { type: Number, default: 64000 }, // 64 GB in MB
  storageUsed: { type: Number, default: 22400 }, // 22.4 GB in MB
  isLiveStreaming: { type: Boolean, default: false },
  isRecording: { type: Boolean, default: false },
  recordingStartedAt: { type: Date },
  nightVisionActive: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Storage percentage virtual
CameraDeviceSchema.virtual('storagePercentage').get(function () {
  if (!this.storageCapacity) return 0;
  return Math.min(100, Math.round((this.storageUsed / this.storageCapacity) * 100));
});

CameraDeviceSchema.set('toJSON', { virtuals: true });
CameraDeviceSchema.set('toObject', { virtuals: true });

export const CameraDevice = mongoose.model('CameraDevice', CameraDeviceSchema);
