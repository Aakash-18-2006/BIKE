import mongoose from 'mongoose';

const LocationSchema = new mongoose.Schema({
  motorcycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Motorcycle', required: true, index: true },
  deviceId: { type: String, required: true },
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  speed: { type: Number, default: 0 },
  heading: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now, index: true },
});

export const Location = mongoose.model('Location', LocationSchema);
