import mongoose from 'mongoose';

const SpeedometerSettingsSchema = new mongoose.Schema({
  motorcycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Motorcycle', required: true, unique: true, index: true },
  unit: { type: String, enum: ['KMH', 'MPH'], default: 'KMH' },
  theme: { type: String, enum: ['CYBER_NEON', 'RACING_AMBER', 'STEALTH_DARK', 'ICE_BLUE'], default: 'CYBER_NEON' },
  brightness: { type: Number, min: 10, max: 100, default: 90 }, // %
  gearAssist: { type: Boolean, default: true },
  shiftRpmLimit: { type: Number, default: 9500 },
  ambientAutoDim: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now },
});

export const SpeedometerSettings = mongoose.model('SpeedometerSettings', SpeedometerSettingsSchema);
