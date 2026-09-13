import mongoose from 'mongoose';

const RideSchema = new mongoose.Schema({
  motorcycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Motorcycle', required: true, index: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  distanceKm: { type: Number, default: 0 },
  durationMinutes: { type: Number, default: 0 },
  averageSpeedKmh: { type: Number, default: 0 },
  maxSpeedKmh: { type: Number, default: 0 },
  startLocation: {
    latitude: Number,
    longitude: Number,
    address: String,
  },
  endLocation: {
    latitude: Number,
    longitude: Number,
    address: String,
  },
  ridingMode: { type: String, default: 'NORMAL' },
  fuelConsumedLitres: { type: Number, default: 0 },
  isActive: { type: Boolean, default: false },
});

export const Ride = mongoose.model('Ride', RideSchema);
