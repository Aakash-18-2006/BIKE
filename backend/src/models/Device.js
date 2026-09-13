import mongoose from 'mongoose';

const DeviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, index: true },
  motorcycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Motorcycle' },
  authKey: { type: String, default: 'secret-device-key-4g' },
  firmwareVersion: { type: String, default: 'v2.4.0-LTE' },
  networkStatus: { 
    type: String, 
    enum: ['ONLINE', 'OFFLINE', 'SLEEP'], 
    default: 'OFFLINE' 
  },
  signalQuality: { type: Number, default: 85 }, // 0 - 100%
  batteryVoltage: { type: Number, default: 12.6 },
  batteryPercentage: { type: Number, default: 88 },
  lastHeartbeat: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

export const Device = mongoose.model('Device', DeviceSchema);
