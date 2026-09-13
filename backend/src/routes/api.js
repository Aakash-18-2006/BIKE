import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as authCtrl from '../controllers/authController.js';
import * as bikeCtrl from '../controllers/bikeController.js';
import * as cmdCtrl from '../controllers/commandController.js';
import * as rideCtrl from '../controllers/rideController.js';
import * as secCtrl from '../controllers/securityController.js';
import * as camCtrl from '../controllers/cameraController.js';
import * as navCtrl from '../controllers/navigationController.js';

const router = Router();

// Public Auth Routes
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', authenticate, authCtrl.getMe);

// Protected Motorcycle Routes
router.get('/motorcycles', authenticate, bikeCtrl.listMotorcycles);
router.post('/motorcycles', authenticate, bikeCtrl.registerMotorcycle);
router.get('/motorcycles/:id', authenticate, bikeCtrl.getMotorcycleById);
router.get('/motorcycles/:id/status', authenticate, bikeCtrl.getMotorcycleStatus);

// Remote Command Routes (Strict ACK verification)
router.post('/motorcycles/:id/commands', authenticate, cmdCtrl.sendCommand);
router.get('/motorcycles/:id/commands/history', authenticate, cmdCtrl.getCommandHistory);
router.get('/commands/:commandId', authenticate, cmdCtrl.getCommandDetails);

// Camera Subsystem Endpoints
router.get('/motorcycles/:id/camera/status', authenticate, camCtrl.getStatus);
router.post('/motorcycles/:id/camera/snapshot', authenticate, camCtrl.snapshot);
router.post('/motorcycles/:id/camera/record/start', authenticate, camCtrl.startRecord);
router.post('/motorcycles/:id/camera/record/stop', authenticate, camCtrl.stopRecord);
router.post('/motorcycles/:id/camera/live/session', authenticate, camCtrl.createLiveSession);
router.get('/motorcycles/:id/camera/events', authenticate, camCtrl.listEvents);
router.get('/motorcycles/:id/camera/media/:mediaId', authenticate, camCtrl.getMedia);
router.get('/motorcycles/:id/camera/frame', authenticate, camCtrl.getLiveFrame);

// Aliases for /vehicles/:id/camera/...
router.get('/vehicles/:id/camera/status', authenticate, camCtrl.getStatus);
router.post('/vehicles/:id/camera/snapshot', authenticate, camCtrl.snapshot);
router.post('/vehicles/:id/camera/record/start', authenticate, camCtrl.startRecord);
router.post('/vehicles/:id/camera/record/stop', authenticate, camCtrl.stopRecord);
router.post('/vehicles/:id/camera/live/session', authenticate, camCtrl.createLiveSession);
router.get('/vehicles/:id/camera/events', authenticate, camCtrl.listEvents);
router.get('/vehicles/:id/camera/media/:mediaId', authenticate, camCtrl.getMedia);
router.get('/vehicles/:id/camera/frame', authenticate, camCtrl.getLiveFrame);

// Speedometer Settings
router.get('/motorcycles/:id/speedometer-settings', authenticate, bikeCtrl.getSpeedometerSettings);
router.put('/motorcycles/:id/speedometer-settings', authenticate, bikeCtrl.updateSpeedometerSettings);

// Geofence Routes
router.get('/motorcycles/:id/geofence', authenticate, bikeCtrl.getGeofence);
router.put('/motorcycles/:id/geofence', authenticate, bikeCtrl.updateGeofence);

// Rides & Statistics
router.get('/motorcycles/:id/rides', authenticate, rideCtrl.listRides);
router.get('/motorcycles/:id/rides/:rideId', authenticate, rideCtrl.getRideDetails);
router.get('/motorcycles/:id/statistics', authenticate, rideCtrl.getRideStatistics);
router.get('/motorcycles/:id/location', authenticate, rideCtrl.getLocationHistory);

// Security & Notifications
router.get('/motorcycles/:id/security/events', authenticate, secCtrl.listSecurityEvents);
router.post('/motorcycles/:id/security/mode', authenticate, secCtrl.setSecurityMode);
router.post('/motorcycles/:id/security/secure', authenticate, secCtrl.secureVehicle);
router.post('/security/events/:eventId/resolve', authenticate, secCtrl.resolveSecurityEvent);

// Vehicles aliases for security
router.get('/vehicles/:id/security/events', authenticate, secCtrl.listSecurityEvents);
router.post('/vehicles/:id/security/mode', authenticate, secCtrl.setSecurityMode);
router.post('/vehicles/:id/security/secure', authenticate, secCtrl.secureVehicle);

// Navigation Routes
router.get('/motorcycles/:id/navigation/route', authenticate, secCtrl.getNavigationRoute);
router.get('/vehicles/:id/navigation/route', authenticate, secCtrl.getNavigationRoute);
router.get('/navigation/destinations', authenticate, navCtrl.getDestinations);
router.post('/navigation/destinations', authenticate, navCtrl.saveDestination);
router.delete('/navigation/destinations/:id', authenticate, navCtrl.deleteDestination);
router.get('/navigation/search', navCtrl.searchPlaces);
router.get('/navigation/coordinates', navCtrl.resolveCoordinates);
router.get('/navigation/route', navCtrl.calculateRoute);

router.get('/notifications', authenticate, bikeCtrl.getNotifications);
router.patch('/notifications/:id/read', authenticate, bikeCtrl.markNotificationRead);

export default router;
