import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Motorcycle } from './models/Motorcycle.js';
import { Device } from './models/Device.js';
import { VehicleStatus } from './models/VehicleStatus.js';
import { SpeedometerSettings } from './models/SpeedometerSettings.js';
import { Geofence } from './models/Geofence.js';
import { Ride } from './models/Ride.js';
import { SecurityEvent } from './models/SecurityEvent.js';
import { Notification } from './models/Notification.js';

export async function seedData() {
  console.log('[Seeder] Seeding database with initial connected bike data...');
  await connectDB();

  // Clear existing collections
  await Promise.all([
    User.deleteMany({}),
    Motorcycle.deleteMany({}),
    Device.deleteMany({}),
    VehicleStatus.deleteMany({}),
    SpeedometerSettings.deleteMany({}),
    Geofence.deleteMany({}),
    Ride.deleteMany({}),
    SecurityEvent.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  // 1. Create Demo User
  const passwordHash = await User.hashPassword('Password123!');
  const user = await User.create({
    name: 'Alex Mercer',
    email: 'demo@smartbike.io',
    passwordHash,
    phone: '+1 (555) 382-9012',
    role: 'user',
  });
  console.log(`[Seeder] Created demo user: ${user.email} (Password: Password123!)`);

  // 2. Create Motorcycle
  const deviceId = 'BIKE-4G-9021';
  const motorcycle = await Motorcycle.create({
    ownerId: user._id,
    name: 'Apex Dark Stealth 900',
    model: 'Apex R-900 HyperTwin',
    registrationNumber: 'KA-04-EQ-9921',
    deviceId,
    odometer: 1420.5,
    fuelCapacity: 16.5,
    color: '#00F0FF',
  });
  console.log(`[Seeder] Created motorcycle: ${motorcycle.name} [${motorcycle.registrationNumber}]`);

  // 3. Create Device
  await Device.create({
    deviceId,
    motorcycleId: motorcycle._id,
    networkStatus: 'ONLINE',
    firmwareVersion: 'v2.4.1-LTE',
    batteryVoltage: 12.58,
    batteryPercentage: 84,
    signalQuality: 92,
    lastHeartbeat: new Date(),
  });

  // 4. Create Initial Vehicle Status (Ignition OFF, but IoT controller is ONLINE!)
  await VehicleStatus.create({
    motorcycleId: motorcycle._id,
    deviceId,
    isOnline: true,
    ignition: false, // OFF by default
    lock: true,      // Locked
    alarmArmed: true,
    alarmTriggered: false,
    ridingMode: 'NORMAL',
    headlight: false,
    highBeam: false,
    indicators: 'OFF',
    hazard: false,
    horn: false,
    speed: 0,
    rpm: 0,
    fuelLevel: 78,
    engineTemp: 24,
    batteryPercentage: 84,
    batteryVoltage: 12.58,
    powerMode: 'LOW_POWER_STANDBY',
    gps: {
      latitude: 12.9716,
      longitude: 77.5946,
      speed: 0,
      heading: 42,
      accuracy: 2.8,
      satellites: 11,
    },
    updatedAt: new Date(),
  });

  // 5. Create Speedometer Settings
  await SpeedometerSettings.create({
    motorcycleId: motorcycle._id,
    unit: 'KMH',
    theme: 'CYBER_NEON',
    brightness: 92,
    gearAssist: true,
    shiftRpmLimit: 9500,
    ambientAutoDim: true,
  });

  // 6. Create Geofence
  await Geofence.create({
    motorcycleId: motorcycle._id,
    name: 'Home Garage Safezone',
    enabled: true,
    latitude: 12.9716,
    longitude: 77.5946,
    radiusMeters: 200,
  });

  // 7. Seed Past Rides
  const now = Date.now();
  await Ride.create([
    {
      motorcycleId: motorcycle._id,
      startTime: new Date(now - 86400000 * 2),
      endTime: new Date(now - 86400000 * 2 + 45 * 60000),
      distanceKm: 34.2,
      durationMinutes: 45,
      averageSpeedKmh: 45.6,
      maxSpeedKmh: 118.4,
      ridingMode: 'SPORT',
      fuelConsumedLitres: 1.8,
      startLocation: { latitude: 12.9716, longitude: 77.5946, address: 'Downtown Pavilion' },
      endLocation: { latitude: 13.0358, longitude: 77.5970, address: 'North Ridge Highway' },
    },
    {
      motorcycleId: motorcycle._id,
      startTime: new Date(now - 86400000),
      endTime: new Date(now - 86400000 + 32 * 60000),
      distanceKm: 21.8,
      durationMinutes: 32,
      averageSpeedKmh: 40.8,
      maxSpeedKmh: 94.2,
      ridingMode: 'NORMAL',
      fuelConsumedLitres: 1.1,
      startLocation: { latitude: 13.0358, longitude: 77.5970, address: 'North Ridge Highway' },
      endLocation: { latitude: 12.9716, longitude: 77.5946, address: 'Downtown Pavilion' },
    },
  ]);

  // 8. Seed Security Events & Notifications
  await SecurityEvent.create({
    motorcycleId: motorcycle._id,
    deviceId,
    eventType: 'BIKE_MOVED_WHILE_LOCKED',
    severity: 'MEDIUM',
    message: 'Minor movement detected while anti-theft lock was active.',
    location: { latitude: 12.9716, longitude: 77.5946 },
    resolved: true,
    resolvedAt: new Date(now - 3600000),
    timestamp: new Date(now - 7200000),
  });

  await Notification.create([
    {
      userId: user._id,
      motorcycleId: motorcycle._id,
      title: 'Anti-Theft System Armed',
      body: 'Your motorcycle is locked and low-power 4G standby monitoring is active.',
      type: 'SECURITY',
      read: false,
    },
  ]);

  console.log('[Seeder] Database seeding finished successfully!');
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedData().then(() => process.exit(0)).catch((err) => {
    console.error('[Seeder] Error:', err);
    process.exit(1);
  });
}
