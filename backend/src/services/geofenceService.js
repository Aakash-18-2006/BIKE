import { Geofence } from '../models/Geofence.js';
import { SecurityEvent } from '../models/SecurityEvent.js';
import { Notification } from '../models/Notification.js';
import { Motorcycle } from '../models/Motorcycle.js';
import { broadcastBikeUpdate } from './socketService.js';

// Haversine formula to compute distance in meters between two coordinates
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function checkGeofenceViolation(motorcycleId, deviceId, currentLat, currentLon) {
  try {
    const geofence = await Geofence.findOne({ motorcycleId, enabled: true });
    if (!geofence) return false;

    const distance = calculateDistanceMeters(
      geofence.latitude,
      geofence.longitude,
      currentLat,
      currentLon
    );

    if (distance > geofence.radiusMeters) {
      console.warn(`[Geofence] VIOLATION: Bike ${motorcycleId} is ${distance.toFixed(1)}m away (limit: ${geofence.radiusMeters}m)`);

      // Check if alert was recently created in last 5 minutes to avoid spamming
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      const existing = await SecurityEvent.findOne({
        motorcycleId,
        eventType: 'GEOFENCE_EXIT',
        timestamp: { $gte: fiveMinsAgo },
      });

      if (!existing) {
        const bike = await Motorcycle.findById(motorcycleId);
        const event = await SecurityEvent.create({
          eventId: `EVT-GEO-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          vehicleId: deviceId,
          tcuId: `TCU-${deviceId}`,
          motorcycleId,
          deviceId,
          eventType: 'GEOFENCE_EXIT',
          severity: 'CRITICAL',
          speed: 0,
          ignitionState: 'OFF',
          lockState: 'LOCKED',
          message: `Motorcycle moved outside the geofence boundary (${distance.toFixed(0)}m away).`,
          location: { latitude: currentLat, longitude: currentLon },
        });

        if (bike && bike.ownerId) {
          await Notification.create({
            userId: bike.ownerId,
            motorcycleId,
            title: 'Geofence Breach Alert!',
            body: `Your motorcycle has moved outside its safezone boundary.`,
            type: 'SECURITY',
          });
        }

        broadcastBikeUpdate(deviceId, 'security_alert', event);
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error('[Geofence] Error checking geofence:', err.message);
    return false;
  }
}
