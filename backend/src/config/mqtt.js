import Aedes from 'aedes';
import { createServer } from 'net';
import mqtt from 'mqtt';
import { CONFIG } from './env.js';

let aedesBroker = null;
let netServer = null;
let mqttClient = null;

// Callbacks registered by services
const subscribers = {
  onHeartbeat: null,
  onTelemetry: null,
  onAck: null,
  onStatus: null,
  onSecurity: null,
};

export function registerMqttHandlers(handlers) {
  Object.assign(subscribers, handlers);
}

export async function initMqttBrokerAndClient() {
  return new Promise((resolve, reject) => {
    // 1. Start embedded Aedes broker
    aedesBroker = new Aedes();
    netServer = createServer(aedesBroker.handle);

    const port = CONFIG.MQTT_PORT;
    netServer.listen(port, () => {
      console.log(`[MQTT Broker] Embedded Aedes broker listening on TCP port ${port}`);

      // 2. Connect backend client to broker
      mqttClient = mqtt.connect(`mqtt://localhost:${port}`, {
        clientId: 'smart_bike_cloud_backend',
        clean: true,
        reconnectPeriod: 2000,
      });

      mqttClient.on('connect', () => {
        console.log('[MQTT Backend Client] Connected to MQTT broker');
        // Subscribe to all bike device topics
        mqttClient.subscribe([
          'bike/+/status',
          'bike/+/heartbeat',
          'bike/+/telemetry',
          'bike/+/ack',
          'bike/+/security',
        ], (err) => {
          if (err) {
            console.error('[MQTT Backend Client] Subscribe error:', err);
          } else {
            console.log('[MQTT Backend Client] Subscribed to device topics: bike/+/+');
            resolve({ aedesBroker, mqttClient });
          }
        });
      });

      mqttClient.on('message', (topic, payload) => {
        try {
          const data = JSON.parse(payload.toString());
          const parts = topic.split('/');
          const deviceId = parts[1];
          const type = parts[2];

          if (type === 'heartbeat' && subscribers.onHeartbeat) {
            subscribers.onHeartbeat(deviceId, data);
          } else if (type === 'telemetry' && subscribers.onTelemetry) {
            subscribers.onTelemetry(deviceId, data);
          } else if (type === 'ack' && subscribers.onAck) {
            subscribers.onAck(deviceId, data);
          } else if (type === 'status' && subscribers.onStatus) {
            subscribers.onStatus(deviceId, data);
          } else if (type === 'security' && subscribers.onSecurity) {
            subscribers.onSecurity(deviceId, data);
          }
        } catch (err) {
          console.error(`[MQTT] Failed to parse message on ${topic}:`, err.message);
        }
      });

      mqttClient.on('error', (err) => {
        console.error('[MQTT Backend Client] Error:', err.message);
      });
    });

    netServer.on('error', (err) => {
      console.error('[MQTT Broker] Server error:', err.message);
      reject(err);
    });
  });
}

export function publishDeviceCommand(deviceId, commandPayload) {
  if (!mqttClient || !mqttClient.connected) {
    throw new Error('MQTT client not connected to broker');
  }
  const topic = `bike/${deviceId}/commands`;
  const message = JSON.stringify(commandPayload);
  return new Promise((resolve, reject) => {
    mqttClient.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

export function getMqttClient() {
  return mqttClient;
}

export async function shutdownMqtt() {
  if (mqttClient) mqttClient.end();
  if (netServer) netServer.close();
  if (aedesBroker) aedesBroker.close();
}
