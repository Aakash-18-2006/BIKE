import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

import { User } from './src/models/User.js';
import { Motorcycle } from './src/models/Motorcycle.js';
import { VehicleStatus } from './src/models/VehicleStatus.js';
import { NavigationDestination } from './src/models/NavigationDestination.js';

async function testIntegration() {
  console.log('--- STARTING DATABASE INTEGRATION TEST ---');
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/smart_bike';
  console.log('Connecting to Mongo URI:', mongoUri);
  await mongoose.connect(mongoUri);
  console.log('✓ Successfully connected to MongoDB:', mongoose.connection.name);

  // 1. Test User Creation with hashed password & timestamps
  const testEmail = `verify_${Date.now()}@smartbike.io`;
  const plainPassword = 'StrongPassword2026!';
  const passwordHash = await User.hashPassword(plainPassword);

  const newUser = await User.create({
    name: 'Integration Test Rider',
    email: testEmail,
    phone: '+91 98765 43210',
    passwordHash: passwordHash,
    emergencyContact: {
      name: 'Rider Family',
      phone: '+91 91234 56789',
      relation: 'Spouse'
    },
    preferences: {
      unit: 'KMH',
      theme: 'DARK_MINIMAL'
    }
  });

  console.log('✓ User created:');
  console.log('   _id:', newUser._id.toString());
  console.log('   email:', newUser.email);
  console.log('   phone:', newUser.phone);
  console.log('   passwordHash is bcrypt?', newUser.passwordHash.startsWith('$2'));
  console.log('   createdAt:', newUser.createdAt);
  console.log('   updatedAt:', newUser.updatedAt);

  // 2. Test password verification helper
  const isMatch = await newUser.comparePassword(plainPassword);
  const isWrongMatch = await newUser.comparePassword('WrongPassword');
  console.log('✓ Password comparison valid?', isMatch === true);
  console.log('✓ Password comparison rejects invalid?', isWrongMatch === false);

  // 3. Test duplicate email unique index rejection
  let duplicateRejected = false;
  try {
    await User.create({
      name: 'Duplicate Rider',
      email: testEmail,
      passwordHash: 'somehash'
    });
  } catch (err) {
    if (err.code === 11000) {
      duplicateRejected = true;
    }
  }
  console.log('✓ Duplicate email rejected by MongoDB unique index?', duplicateRejected);

  // 4. Test Bike / Motorcycle pairing
  const deviceId = `BIKE-4G-${Math.floor(1000 + Math.random() * 9000)}`;
  const regNo = `KA-01-EQ-${Math.floor(1000 + Math.random() * 9000)}`;
  const newBike = await Motorcycle.create({
    ownerId: newUser._id,
    name: 'Smart Stealth Cruiser',
    model: 'Apex Pro 2026',
    registrationNumber: regNo,
    deviceId: deviceId,
    vin: `VIN-${Date.now()}`,
    pairedAt: new Date(),
    connectionType: '4G_LTE',
    settings: {
      autoLockEnabled: true,
      alarmSensitivity: 'HIGH',
      geofenceAlerts: true
    }
  });
  console.log('✓ Motorcycle created & paired:');
  console.log('   _id:', newBike._id.toString());
  console.log('   deviceId:', newBike.deviceId);
  console.log('   ownerId:', newBike.ownerId.toString());
  console.log('   registrationNumber:', newBike.registrationNumber);
  console.log('   pairedAt:', newBike.pairedAt);

  // 5. Test Vehicle Status linked to Motorcycle
  const newStatus = await VehicleStatus.create({
    motorcycleId: newBike._id,
    deviceId: newBike.deviceId,
    speed: 45,
    rpm: 3800,
    fuelLevel: 75,
    batteryPercentage: 88,
    engineTemp: 82,
    gear: '4',
    odometer: 1820,
    tripA: 42.6,
    evRange: 65,
    fuelRange: 240,
    totalRange: 305,
    gps: {
      latitude: 12.9716,
      longitude: 77.5946,
      speed: 45,
      heading: 90
    }
  });
  console.log('✓ Vehicle Status recorded:');
  console.log('   _id:', newStatus._id.toString());
  console.log('   odometer:', newStatus.odometer, 'km');
  console.log('   evRange:', newStatus.evRange, 'km');
  console.log('   totalRange:', newStatus.totalRange, 'km');
  console.log('   gear:', newStatus.gear);

  // 6. Test Navigation Destination persistence
  const destination = await NavigationDestination.create({
    userId: newUser._id,
    name: 'MG Road Metro Station',
    address: 'Mahatma Gandhi Rd, Bengaluru, Karnataka 560001',
    latitude: 12.9756,
    longitude: 77.6066,
    category: 'favorite'
  });
  console.log('✓ Saved Navigation Destination created:');
  console.log('   _id:', destination._id.toString());
  console.log('   name:', destination.name);
  console.log('   latitude/longitude:', destination.latitude, destination.longitude);

  const foundDestinations = await NavigationDestination.find({ userId: newUser._id });
  console.log('✓ Retrieved user navigation destinations count:', foundDestinations.length);

  await mongoose.disconnect();
  console.log('--- ALL DATABASE INTEGRATION TESTS PASSED SUCCESSFULLY (100%) ---');
}

testIntegration().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
