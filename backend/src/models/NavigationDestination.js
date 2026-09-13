import mongoose from 'mongoose';

const NavigationDestinationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: '', trim: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    category: {
      type: String,
      enum: ['saved', 'recent', 'favorite', 'home', 'work'],
      default: 'saved',
    },
    lastNavigatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

NavigationDestinationSchema.index({ userId: 1, category: 1 });

export const NavigationDestination = mongoose.model('NavigationDestination', NavigationDestinationSchema);
