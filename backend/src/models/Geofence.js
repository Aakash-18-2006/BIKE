import mongoose from 'mongoose';

const GeofenceSchema = new mongoose.Schema({
  motorcycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Motorcycle', required: true, unique: true, index: true },
  name: { type: String, default: 'Home Safezone' },
  enabled: { type: Boolean, default: true },
  latitude: { type: Number, required: true, default: 12.9716 },
  longitude: { type: Number, required: true, default: 77.5946 },
  radiusMeters: { type: Number, default: 200 },
  createdAt: { type: Date, default: Date.now },
});

export const Geofence = mongoose.model('Geofence', GeofenceSchema);
