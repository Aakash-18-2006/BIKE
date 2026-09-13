import { Motorcycle } from '../models/Motorcycle.js';
import { Device } from '../models/Device.js';
import { VehicleStatus } from '../models/VehicleStatus.js';
import { SpeedometerSettings } from '../models/SpeedometerSettings.js';
import { Geofence } from '../models/Geofence.js';
import { Notification } from '../models/Notification.js';

export async function listMotorcycles(req, res) {
  try {
    let bikes = await Motorcycle.find({ ownerId: req.user._id });
    if (bikes.length === 0) {
      const primary = await Motorcycle.findOne({ deviceId: 'BIKE-4G-9021' });
      if (primary) {
        bikes = [primary];
      }
    }
    res.json({ motorcycles: bikes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function registerMotorcycle(req, res) {
  try {
    const { name, model, registrationNumber, deviceId, fuelCapacity } = req.body;
    if (!name || !model || !registrationNumber || !deviceId) {
      return res.status(400).json({ error: 'Name, model, registrationNumber, and deviceId are required' });
    }

    // Check deviceId unique
    const existingBike = await Motorcycle.findOne({
      $or: [{ registrationNumber }, { deviceId }],
    });
    if (existingBike) {
      return res.status(409).json({ error: 'A motorcycle with this registration or deviceId already exists' });
    }

    const motorcycle = await Motorcycle.create({
      ownerId: req.user._id,
      name,
      model,
      registrationNumber,
      deviceId,
      fuelCapacity: fuelCapacity || 15.0,
    });

    // Create or link device
    await Device.findOneAndUpdate(
      { deviceId },
      {
        motorcycleId: motorcycle._id,
        networkStatus: 'ONLINE',
      },
      { upsert: true, new: true }
    );

    // Initialize VehicleStatus
    await VehicleStatus.create({
      motorcycleId: motorcycle._id,
      deviceId,
      isOnline: true,
      ignition: false,
      lock: true,
      powerMode: 'LOW_POWER_STANDBY',
      batteryPercentage: 88,
    });

    // Initialize default Speedometer settings
    await SpeedometerSettings.create({
      motorcycleId: motorcycle._id,
    });

    // Initialize default Geofence
    await Geofence.create({
      motorcycleId: motorcycle._id,
      name: 'Primary Parking',
      latitude: 12.9716,
      longitude: 77.5946,
      radiusMeters: 250,
    });

    res.status(201).json({ message: 'Motorcycle paired successfully', motorcycle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getMotorcycleById(req, res) {
  try {
    const bike = await Motorcycle.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    });
    if (!bike) {
      return res.status(404).json({ error: 'Motorcycle not found' });
    }
    res.json({ motorcycle: bike });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getMotorcycleStatus(req, res) {
  try {
    const bike = await Motorcycle.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    });
    if (!bike) {
      return res.status(404).json({ error: 'Motorcycle not found' });
    }

    const status = await VehicleStatus.findOne({ deviceId: bike.deviceId });
    const device = await Device.findOne({ deviceId: bike.deviceId });

    res.json({
      motorcycle: {
        id: bike._id,
        name: bike.name,
        model: bike.model,
        registrationNumber: bike.registrationNumber,
        deviceId: bike.deviceId,
      },
      status: status || {
        isOnline: false,
        ignition: false,
        lock: true,
        batteryPercentage: 0,
        powerMode: 'LOW_POWER_STANDBY',
      },
      device: device || { networkStatus: 'OFFLINE' },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getSpeedometerSettings(req, res) {
  try {
    const settings = await SpeedometerSettings.findOne({ motorcycleId: req.params.id });
    res.json({ settings: settings || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateSpeedometerSettings(req, res) {
  try {
    const settings = await SpeedometerSettings.findOneAndUpdate(
      { motorcycleId: req.params.id },
      { $set: { ...req.body, updatedAt: new Date() } },
      { new: true, upsert: true }
    );
    res.json({ message: 'Settings updated', settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getGeofence(req, res) {
  try {
    const geofence = await Geofence.findOne({ motorcycleId: req.params.id });
    res.json({ geofence: geofence || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateGeofence(req, res) {
  try {
    const geofence = await Geofence.findOneAndUpdate(
      { motorcycleId: req.params.id },
      { $set: req.body },
      { new: true, upsert: true }
    );
    res.json({ message: 'Geofence updated', geofence });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getNotifications(req, res) {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function markNotificationRead(req, res) {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
