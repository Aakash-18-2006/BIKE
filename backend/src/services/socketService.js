import { Server } from 'socket.io';
import { CONFIG } from '../config/env.js';

let ioInstance = null;
const latestNavStateByDevice = {};

export function initSocketService(httpServer) {
  const allowedOrigins = CONFIG?.CORS_ORIGIN === '*'
    ? '*'
    : (CONFIG?.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean) || '*');

  ioInstance = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
    },
  });

  ioInstance.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    socket.on('join_bike', (bikeId) => {
      socket.join(`bike:${bikeId}`);
      console.log(`[WebSocket] Client ${socket.id} joined bike room: bike:${bikeId}`);
    });

    socket.on('join_device', (deviceId) => {
      socket.join(`device:${deviceId}`);
      console.log(`[WebSocket] Client ${socket.id} joined device room: device:${deviceId}`);

      // Replay active navigation state to reconnecting TFT / client
      if (latestNavStateByDevice[deviceId]) {
        socket.emit('navigation_update', latestNavStateByDevice[deviceId]);
        console.log(`[WebSocket] Replayed active navigation state to ${socket.id} for device:${deviceId}`);
      }
    });

    // Handle lightweight TFT hardware ping for health watchdog & latency measurement
    socket.on('tft_ping', (data) => {
      socket.emit('tft_pong', { ...data, serverTimestamp: Date.now() });
    });

    // Handle explicit navigation snapshot request upon device reboot
    socket.on('request_navigation_snapshot', (data) => {
      const devId = (typeof data === 'string' ? data : data?.deviceId) || 'BIKE-4G-9021';
      if (latestNavStateByDevice[devId]) {
        socket.emit('navigation_update', latestNavStateByDevice[devId]);
        console.log(`[WebSocket] Explicit snapshot replayed to ${socket.id} for device:${devId}`);
      }
    });

    // Handle destination selection from TFT or Mobile
    socket.on('tft_destination_select', (data) => {
      const devId = data?.deviceId || 'BIKE-4G-9021';
      console.log(`[SERVER NAV] Received destination select from TFT for ${devId}:`, data?.destination);
      ioInstance.to(`device:${devId}`).emit('destination_selected', data);
      if (data?.bikeId) {
        ioInstance.to(`bike:${data.bikeId}`).emit('destination_selected', data);
      }
      ioInstance.emit('destination_selected', data);
    });

    socket.on('select_destination', (data) => {
      const devId = data?.deviceId || 'BIKE-4G-9021';
      console.log(`[SERVER NAV] Received select_destination for ${devId}:`, data?.destination);
      ioInstance.to(`device:${devId}`).emit('destination_selected', data);
      if (data?.bikeId) {
        ioInstance.to(`bike:${data.bikeId}`).emit('destination_selected', data);
      }
      ioInstance.emit('destination_selected', data);
    });

    // Handle incoming navigation updates from mobile app and relay to paired TFT
    socket.on('navigation_update', (data) => {
      const devId = data?.deviceId || 'BIKE-4G-9021';
      console.log(`[SERVER NAV] Navigation update for ${devId}: ${data?.maneuver || ''} | ${data?.instruction || ''} (${data?.distanceToTurn ?? ''}m, remaining: ${data?.remainingDistance ?? ''}m, isNavigating: ${data?.isNavigating})`);

      if (data?.isNavigating === false && !data?.isDestinationReached) {
        // Navigation stopped: clear active cached turn so stale data isn't replayed
        delete latestNavStateByDevice[devId];
      } else {
        latestNavStateByDevice[devId] = data;
      }

      // Broadcast to paired device room, bike room, and global listener
      ioInstance.to(`device:${devId}`).emit('navigation_update', data);
      if (data?.bikeId) {
        ioInstance.to(`bike:${data.bikeId}`).emit('navigation_update', data);
      }
      ioInstance.emit('navigation_update', data);
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
}

export function broadcastBikeUpdate(deviceId, event, data) {
  if (ioInstance) {
    ioInstance.to(`device:${deviceId}`).emit(event, data);
    ioInstance.emit(`device_global:${deviceId}`, { event, data });
  }
}

export function getIO() {
  return ioInstance;
}
