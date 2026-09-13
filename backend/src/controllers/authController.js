import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { CONFIG } from '../config/env.js';

export async function register(req, res) {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Rider full name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      phone: phone ? String(phone).trim() : '',
      preferences: {
        unit: 'KMH',
        theme: 'MONOCHROME_LUXURY',
        notificationsEnabled: true,
      },
    });

    // Auto-pair or create motorcycle for the new rider
    try {
      const { Motorcycle } = await import('../models/Motorcycle.js');
      const { VehicleStatus } = await import('../models/VehicleStatus.js');
      const { SpeedometerSettings } = await import('../models/SpeedometerSettings.js');
      const { Geofence } = await import('../models/Geofence.js');
      const { Device } = await import('../models/Device.js');

      // Check if primary motorcycle exists in DB
      let bike = await Motorcycle.findOne({ deviceId: 'BIKE-4G-9021' });
      if (bike) {
        // Assign ownership to the newly registered rider so they can control telemetry
        bike.ownerId = user._id;
        await bike.save();
      } else {
        // Create new motorcycle
        bike = await Motorcycle.create({
          ownerId: user._id,
          name: `${name.trim()}'s Apex 900`,
          model: 'Apex R-900 HyperTwin',
          registrationNumber: `KA-04-EQ-${Math.floor(1000 + Math.random() * 9000)}`,
          deviceId: 'BIKE-4G-9021',
          odometer: 12458.0,
          fuelCapacity: 16.5,
          color: '#00F0FF',
          pairedAt: new Date(),
          connectionType: '4G_LTE',
        });

        await Device.findOneAndUpdate(
          { deviceId: 'BIKE-4G-9021' },
          { motorcycleId: bike._id, networkStatus: 'ONLINE' },
          { upsert: true }
        );

        await VehicleStatus.findOneAndUpdate(
          { deviceId: 'BIKE-4G-9021' },
          {
            motorcycleId: bike._id,
            deviceId: 'BIKE-4G-9021',
            isOnline: true,
            vehicleState: 'SLEEP',
            lock: true,
            batteryPercentage: 85,
            fuelLevel: 78,
          },
          { upsert: true }
        );

        await SpeedometerSettings.findOneAndUpdate(
          { motorcycleId: bike._id },
          { motorcycleId: bike._id, unit: 'KMH', theme: 'MONOCHROME_LUXURY' },
          { upsert: true }
        );

        await Geofence.findOneAndUpdate(
          { motorcycleId: bike._id },
          {
            motorcycleId: bike._id,
            name: 'Primary Safezone',
            latitude: 12.9716,
            longitude: 77.5946,
            radiusMeters: 250,
          },
          { upsert: true }
        );
      }
    } catch (pairErr) {
      console.warn('[Auth Register] Notice pairing bike for user:', pairErr.message);
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, CONFIG.JWT_SECRET, {
      expiresIn: CONFIG.JWT_EXPIRES_IN,
    });

    res.status(201).json({
      message: 'User registered and motorcycle paired successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        preferences: user.preferences,
      },
    });
  } catch (err) {
    console.error('[Auth Register] Error:', err);
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Both email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, CONFIG.JWT_SECRET, {
      expiresIn: CONFIG.JWT_EXPIRES_IN,
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        preferences: user.preferences,
      },
    });
  } catch (err) {
    console.error('[Auth Login] Error:', err);
    res.status(500).json({ error: err.message || 'Login failed' });
  }
}

export async function getMe(req, res) {
  res.json({ user: req.user });
}
