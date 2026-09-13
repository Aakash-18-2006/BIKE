import mongoose from 'mongoose';

const CommandAckSchema = new mongoose.Schema({
  commandId: { type: String, required: true, index: true },
  deviceId: { type: String, required: true, index: true },
  status: { type: String, enum: ['DEVICE_RECEIVED', 'EXECUTING', 'SUCCESS', 'FAILED'], required: true },
  executedAt: { type: Date, default: Date.now },
  durationMs: { type: Number, default: 0 },
  resultingState: { type: mongoose.Schema.Types.Mixed },
  error: { type: String },
  rawPacket: { type: mongoose.Schema.Types.Mixed },
});

export const CommandAck = mongoose.model('CommandAck', CommandAckSchema);
