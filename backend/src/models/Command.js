import mongoose from 'mongoose';

const CommandSchema = new mongoose.Schema({
  commandId: { type: String, required: true, unique: true, index: true },
  motorcycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Motorcycle', required: true, index: true },
  deviceId: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  command: { 
    type: String, 
    required: true,
    enum: [
      'LOCK', 'UNLOCK', 'START_VEHICLE', 'SLEEP_VEHICLE', 'WAKE_TFT',
      'FIND_MY_BIKE', 'ALARM_ARM', 'ALARM_DISARM', 'TRIGGER_ALARM',
      'HEADLIGHT_TOGGLE', 'HIGH_BEAM_TOGGLE', 'HAZARD_TOGGLE', 'INDICATOR_LEFT',
      'INDICATOR_RIGHT', 'HORN_PULSE', 'SET_RIDING_MODE', 'SET_SPEEDOMETER_BRIGHTNESS',
      'SET_SPEEDOMETER_THEME',
    ]
  },
  parameters: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { 
    type: String, 
    enum: ['IDLE', 'SENDING', 'SERVER_RECEIVED', 'DEVICE_RECEIVED', 'EXECUTING', 'SUCCESS', 'FAILED', 'TIMEOUT', 'BIKE_OFFLINE'],
    default: 'SERVER_RECEIVED',
    index: true,
  },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  acknowledgedAt: { type: Date },
  completedAt: { type: Date },
  errorReason: { type: String },
});

export const Command = mongoose.model('Command', CommandSchema);
