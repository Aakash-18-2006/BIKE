import { Ride } from '../models/Ride.js';
import { Location } from '../models/Location.js';
import { Motorcycle } from '../models/Motorcycle.js';

export async function listRides(req, res) {
  try {
    const { id } = req.params;
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) {
      return res.status(404).json({ error: 'Motorcycle not found' });
    }

    const rides = await Ride.find({ motorcycleId: bike._id }).sort({ startTime: -1 });
    res.json({ rides });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getRideDetails(req, res) {
  try {
    const { id, rideId } = req.params;
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) {
      return res.status(404).json({ error: 'Motorcycle not found' });
    }

    const ride = await Ride.findOne({ _id: rideId, motorcycleId: bike._id });
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const routePoints = await Location.find({ rideId: ride._id }).sort({ timestamp: 1 });

    res.json({ ride, routePoints });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getRideStatistics(req, res) {
  try {
    const { id } = req.params;
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) {
      return res.status(404).json({ error: 'Motorcycle not found' });
    }

    const rides = await Ride.find({ motorcycleId: bike._id });

    const totalRides = rides.length;
    const totalDistance = rides.reduce((acc, r) => acc + (r.distanceKm || 0), 0);
    const totalDurationMinutes = rides.reduce((acc, r) => acc + (r.durationMinutes || 0), 0);
    const maxSpeed = rides.reduce((acc, r) => Math.max(acc, r.maxSpeedKmh || 0), 0);
    const avgSpeed = totalRides > 0 
      ? (rides.reduce((acc, r) => acc + (r.averageSpeedKmh || 0), 0) / totalRides) 
      : 0;
    const longestRideKm = rides.reduce((acc, r) => Math.max(acc, r.distanceKm || 0), 0);

    res.json({
      statistics: {
        totalRides,
        totalDistanceKm: Number(totalDistance.toFixed(1)),
        totalDurationMinutes: Number(totalDurationMinutes.toFixed(0)),
        maxSpeedKmh: Number(maxSpeed.toFixed(1)),
        averageSpeedKmh: Number(avgSpeed.toFixed(1)),
        longestRideKm: Number(longestRideKm.toFixed(1)),
        odometer: bike.odometer || totalDistance,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getLocationHistory(req, res) {
  try {
    const { id } = req.params;
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) {
      return res.status(404).json({ error: 'Motorcycle not found' });
    }

    const limit = parseInt(req.query.limit || '100', 10);
    const locations = await Location.find({ motorcycleId: bike._id })
      .sort({ timestamp: -1 })
      .limit(limit);

    res.json({ locations: locations.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
