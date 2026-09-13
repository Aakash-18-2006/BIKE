import mongoose from 'mongoose';

const SecurityEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Motorcycle', required: true, index: true },
    motorcycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Motorcycle' }, // Legacy alias
    tcuId: { type: String, required: true },
    deviceId: { type: String }, // Legacy alias
    eventType: {
      type: String,
      enum: [
        'UNAUTHORIZED_MOVEMENT',
        'UNAUTHORIZED_IGNITION',
        'TAMPER_DETECTED',
        'GPS_ANOMALY',
        'TCU_TAMPER',
        'CAMERA_SECURITY_EVENT',
        'VEHICLE_MOVEMENT_WHILE_LOCKED',
        'SECURITY_MODE_TRIGGERED',
        'IGNITION_CUTOFF_REQUESTED',
        'IGNITION_AUTHORIZATION_DISABLED',
        // Backward-compatibility legacy types
        'BIKE_MOVED_WHILE_LOCKED',
        'IGNITION_TAMPER',
        'GEOFENCE_EXIT',
        'LOW_BATTERY',
        'DEVICE_OFFLINE',
        'ALARM_TRIGGERED',
        'FALL_DETECTED',
      ],
      required: true,
      index: true,
    },
    timestamp: { type: Date, default: Date.now, index: true },
    latitude: { type: Number },
    longitude: { type: Number },
    speed: { type: Number, default: 0 },
    ignitionState: { type: String, default: 'OFF' },
    lockState: { type: String, default: 'LOCKED' },
    cameraEventId: { type: String },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'HIGH',
    },
    verificationState: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'FALSE_POSITIVE'],
      default: 'VERIFIED',
    },
    commandState: {
      type: String,
      enum: ['NONE', 'CUTOFF_PENDING_STOP', 'LOCKED_OUT', 'RESOLVED'],
      default: 'NONE',
    },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    message: { type: String },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

// Virtual for legacy location object
SecurityEventSchema.virtual('location').get(function () {
  return {
    latitude: this.latitude,
    longitude: this.longitude,
  };
});

export const SecurityEvent = mongoose.model('SecurityEvent', SecurityEventSchema);
