import express from 'express';
import http from 'http';
import cors from 'cors';
import { CONFIG } from './config/env.js';
import { connectDB } from './config/db.js';
import { initMqttBrokerAndClient, registerMqttHandlers } from './config/mqtt.js';
import { initSocketService } from './services/socketService.js';
import { handleCommandAck } from './services/commandDispatcher.js';
import {
  processHeartbeat,
  processTelemetry,
  processSecurityAlert,
  processDeviceStatus,
} from './services/telemetryProcessor.js';
import apiRouter from './routes/api.js';

const app = express();
const httpServer = http.createServer(app);

// Middleware
const allowedOrigins = CONFIG.CORS_ORIGIN === '*'
  ? '*'
  : CONFIG.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Smart Motorcycle Cloud Backend',
    timestamp: new Date(),
    architecture: '4G/LTE IoT + MQTT + WebSocket',
  });
});

// Mount API routes
app.use('/api', apiRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack || err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

export async function startServer() {
  try {
    // 1. Connect Database
    await connectDB();

    // 2. Initialize Realtime WebSocket Gateway
    initSocketService(httpServer);

    // 3. Register MQTT Packet Handlers
    registerMqttHandlers({
      onHeartbeat: (deviceId, data) => processHeartbeat(deviceId, data),
      onTelemetry: (deviceId, data) => processTelemetry(deviceId, data),
      onAck: (deviceId, data) => handleCommandAck(deviceId, data),
      onStatus: (deviceId, data) => processDeviceStatus(deviceId, data),
      onSecurity: (deviceId, data) => processSecurityAlert(deviceId, data),
    });

    // 4. Initialize Embedded MQTT Broker & Backend Client
    await initMqttBrokerAndClient();

    // 5. Start HTTP Server
    return new Promise((resolve) => {
      httpServer.listen(CONFIG.PORT, () => {
        console.log(`[HTTP Server] REST API and WebSocket listening on http://localhost:${CONFIG.PORT}`);
        resolve({ app, httpServer });
      });
    });
  } catch (err) {
    console.error('[Fatal Error] Failed to start server:', err);
    process.exit(1);
  }
}

// Auto-start if run directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}

export { app, httpServer };
