import mongoose from 'mongoose';

const MotorcycleSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    model: { type: String, required: true },
    registrationNumber: { type: String, required: true, unique: true },
    deviceId: { type: String, required: true, unique: true, index: true },
    vin: { type: String, default: '' },
    odometer: { type: Number, default: 0 }, // in km
    fuelCapacity: { type: Number, default: 15.0 }, // in liters
    color: { type: String, default: '#00F0FF' },
    pairedAt: { type: Date, default: Date.now },
    connectionType: { type: String, enum: ['4G_LTE', 'BLUETOOTH', 'OFFLINE'], default: '4G_LTE' },
    settings: {
      autoLockEnabled: { type: Boolean, default: true },
      alarmSensitivity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'HIGH' },
      geofenceAlerts: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export const Motorcycle = mongoose.model('Motorcycle', MotorcycleSchema);
