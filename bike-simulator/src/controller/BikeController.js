/**
 * Base BikeController interface abstraction.
 * Real ESP32 / STM32 hardware modules or simulated controllers must implement this interface.
 */
export class BikeController {
  constructor(deviceId) {
    this.deviceId = deviceId;
  }

  async connect() {
    throw new Error('Not implemented');
  }

  async disconnect() {
    throw new Error('Not implemented');
  }

  async sendTelemetry(data) {
    throw new Error('Not implemented');
  }

  async sendHeartbeat(data) {
    throw new Error('Not implemented');
  }

  async receiveCommand(commandPacket) {
    throw new Error('Not implemented');
  }

  async acknowledgeCommand(commandId, status, resultingState, details) {
    throw new Error('Not implemented');
  }

  getBattery() {
    throw new Error('Not implemented');
  }

  getGPS() {
    throw new Error('Not implemented');
  }

  getSpeed() {
    throw new Error('Not implemented');
  }

  getRPM() {
    throw new Error('Not implemented');
  }

  getFuel() {
    throw new Error('Not implemented');
  }

  getTemperature() {
    throw new Error('Not implemented');
  }

  getIgnitionState() {
    throw new Error('Not implemented');
  }

  async lock() {
    throw new Error('Not implemented');
  }

  async unlock() {
    throw new Error('Not implemented');
  }

  async triggerAlarm() {
    throw new Error('Not implemented');
  }

  async controlLights(options) {
    throw new Error('Not implemented');
  }

  async controlIndicators(state) {
    throw new Error('Not implemented');
  }

  async setRidingMode(mode) {
    throw new Error('Not implemented');
  }
}
