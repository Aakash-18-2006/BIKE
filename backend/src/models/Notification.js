import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  motorcycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Motorcycle', index: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  type: { type: String, default: 'INFO' }, // 'SECURITY', 'RIDE', 'SYSTEM', 'WARNING'
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: true },
});

export const Notification = mongoose.model('Notification', NotificationSchema);
