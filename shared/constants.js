// Commands supported by the motorcycle IoT controller
export const COMMANDS = {
  LOCK: 'LOCK',
  UNLOCK: 'UNLOCK',
  START_VEHICLE: 'START_VEHICLE',
  SLEEP_VEHICLE: 'SLEEP_VEHICLE',
  WAKE_TFT: 'WAKE_TFT',
  FIND_MY_BIKE: 'FIND_MY_BIKE',
  ALARM_ARM: 'ALARM_ARM',
  ALARM_DISARM: 'ALARM_DISARM',
  TRIGGER_ALARM: 'TRIGGER_ALARM',
  HEADLIGHT_TOGGLE: 'HEADLIGHT_TOGGLE',
  HIGH_BEAM_TOGGLE: 'HIGH_BEAM_TOGGLE',
  HAZARD_TOGGLE: 'HAZARD_TOGGLE',
  INDICATOR_LEFT: 'INDICATOR_LEFT',
  INDICATOR_RIGHT: 'INDICATOR_RIGHT',
  HORN_PULSE: 'HORN_PULSE',
  SET_RIDING_MODE: 'SET_RIDING_MODE',
  SET_SPEEDOMETER_BRIGHTNESS: 'SET_SPEEDOMETER_BRIGHTNESS',
  SET_SPEEDOMETER_THEME: 'SET_SPEEDOMETER_THEME',
};

// Strict remote command state machine
export const COMMAND_STATES = {
  IDLE: 'IDLE',
  SENDING: 'SENDING',
  SERVER_RECEIVED: 'SERVER_RECEIVED',
  DEVICE_RECEIVED: 'DEVICE_RECEIVED',
  EXECUTING: 'EXECUTING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  TIMEOUT: 'TIMEOUT',
  BIKE_OFFLINE: 'BIKE_OFFLINE',
};

// Complete Automotive Vehicle State Machine (No simple boolean ignition!)
export const VEHICLE_STATES = {
  SLEEP: 'SLEEP',                                 // TFT asleep, IoT controller in low-power standby on battery
  WAKE: 'WAKE',                                   // TFT woke up on touch, showing minimal standby screen
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED', // Prompting rider for PIN
  AUTHENTICATING: 'AUTHENTICATING',               // Verifying cryptographic / stored PIN
  SAFETY_CHECK: 'SAFETY_CHECK',                   // Validating side-stand, brake interlocks, stationary state, battery
  STARTING: 'STARTING',                           // Boot sweep animation, contactors closing
  RUNNING: 'RUNNING',                             // Full operational instrument cluster & drivetrain ready
  
  // Failure / Rejection States
  AUTH_FAILED: 'AUTH_FAILED',
  SAFETY_CHECK_FAILED: 'SAFETY_CHECK_FAILED',
  START_FAILED: 'START_FAILED',
  DEVICE_OFFLINE: 'DEVICE_OFFLINE',
  LOW_BATTERY: 'LOW_BATTERY',
  SYSTEM_FAULT: 'SYSTEM_FAULT',
};

export const RIDING_MODES = {
  ECO: 'ECO',
  NORMAL: 'NORMAL',
  SPORT: 'SPORT',
  RAIN: 'RAIN',
};

export const POWER_MODES = {
  FULL_POWER: 'FULL_POWER', // Active drivetrain & cluster
  LOW_POWER_STANDBY: 'LOW_POWER_STANDBY', // Minimal quiescent battery draw, 4G MQTT active
};

export const SECURITY_EVENT_TYPES = {
  BIKE_MOVED_WHILE_LOCKED: 'BIKE_MOVED_WHILE_LOCKED',
  IGNITION_TAMPER: 'IGNITION_TAMPER',
  GEOFENCE_EXIT: 'GEOFENCE_EXIT',
  LOW_BATTERY: 'LOW_BATTERY',
  DEVICE_OFFLINE: 'DEVICE_OFFLINE',
  ALARM_TRIGGERED: 'ALARM_TRIGGERED',
  FALL_DETECTED: 'FALL_DETECTED',
};

export const MQTT_TOPICS = {
  commands: (deviceId) => `bike/${deviceId}/commands`,
  ack: (deviceId) => `bike/${deviceId}/ack`,
  telemetry: (deviceId) => `bike/${deviceId}/telemetry`,
  heartbeat: (deviceId) => `bike/${deviceId}/heartbeat`,
  status: (deviceId) => `bike/${deviceId}/status`,
  security: (deviceId) => `bike/${deviceId}/security`,
};
