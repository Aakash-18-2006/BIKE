import mongoose from 'mongoose';

const VehicleStatusSchema = new mongoose.Schema({
  motorcycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Motorcycle', unique: true, index: true },
  deviceId: { type: String, required: true, index: true },
  isOnline: { type: Boolean, default: false },
  vehicleState: {
    type: String,
    enum: [
      'SLEEP',
      'WAKE',
      'AUTHENTICATION_REQUIRED',
      'AUTHENTICATING',
      'SAFETY_CHECK',
      'STARTING',
      'RUNNING',
      'AUTH_FAILED',
      'SAFETY_CHECK_FAILED',
      'START_FAILED',
      'DEVICE_OFFLINE',
      'LOW_BATTERY',
      'SYSTEM_FAULT',
    ],
    default: 'SLEEP',
  },
  ignition: { type: Boolean, default: false }, // Maintained for backward compatibility (true when RUNNING)
  lock: { type: Boolean, default: true },
  alarmArmed: { type: Boolean, default: true },
  alarmTriggered: { type: Boolean, default: false },
  ridingMode: { type: String, enum: ['ECO', 'FUEL', 'EV', 'NORMAL', 'SPORT', 'RAIN'], default: 'ECO' },
  headlight: { type: Boolean, default: false },
  highBeam: { type: Boolean, default: false },
  lowFuel: { type: Boolean, default: false },
  batteryStatus: { type: String, enum: ['NORMAL', 'LOW', 'CRITICAL', 'CHARGING'], default: 'NORMAL' },
  absStatus: { type: String, enum: ['NORMAL', 'FAULT', 'ACTIVE', 'OFF'], default: 'NORMAL' },
  tractionControlStatus: { type: String, enum: ['ACTIVE', 'NORMAL', 'OFF', 'INTERVENING'], default: 'ACTIVE' },
  sideStandStatus: { type: String, enum: ['UP', 'DOWN'], default: 'UP' },
  sidestandDown: { type: Boolean, default: false },
  indicators: { type: String, enum: ['OFF', 'LEFT', 'RIGHT', 'HAZARD'], default: 'OFF' },
  hazard: { type: Boolean, default: false },
  horn: { type: Boolean, default: false },
  speed: { type: Number, default: 0 },
  rpm: { type: Number, default: 0 },
  gear: { type: String, default: 'N' },
  fuelLevel: { type: Number, default: 80 }, // %
  engineTemp: { type: Number, default: 28 }, // °C
  batteryPercentage: { type: Number, default: 85 }, // %
  batteryVoltage: { type: Number, default: 12.6 }, // Volts
  odometer: { type: Number, default: 12458.0 }, // km
  tripA: { type: Number, default: 124.6 }, // km
  evRange: { type: Number, default: 68 }, // km
  fuelRange: { type: Number, default: 215 }, // km
  totalRange: { type: Number, default: 283 }, // km
  gps: {
    latitude: { type: Number, default: 12.9716 },
    longitude: { type: Number, default: 77.5946 },
    speed: { type: Number, default: 0 },
    heading: { type: Number, default: 0 },
    accuracy: { type: Number, default: 3.5 },
    satellites: { type: Number, default: 10 },
  },
  powerMode: { 
    type: String, 
    enum: ['FULL_POWER', 'LOW_POWER_STANDBY'], 
    default: 'LOW_POWER_STANDBY' 
  },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const VehicleStatus = mongoose.model('VehicleStatus', VehicleStatusSchema);
