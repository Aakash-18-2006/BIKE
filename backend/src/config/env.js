import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  PORT: process.env.PORT || 5000,
  MQTT_PORT: process.env.MQTT_PORT || 1883,
  MQTT_WS_PORT: process.env.MQTT_WS_PORT || 8883,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/smart_bike',
  USE_MEMORY_DB: process.env.USE_MEMORY_DB !== 'false',
  JWT_SECRET: process.env.JWT_SECRET || 'smart_bike_hyper_secure_jwt_secret_9981',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  COMMAND_TIMEOUT_MS: parseInt(process.env.COMMAND_TIMEOUT_MS || '15000', 10),
  HEARTBEAT_TIMEOUT_MS: parseInt(process.env.HEARTBEAT_TIMEOUT_MS || '90000', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  MAPPLS_API_KEY: process.env.MAPPLS_API_KEY || process.env.VITE_MAPPLS_API_KEY || 'anpvcfbczpjtvdnswzxfquhxdguacpzejgbg',
};
