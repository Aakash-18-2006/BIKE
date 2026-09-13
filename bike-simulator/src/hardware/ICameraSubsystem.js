/**
 * ICameraSubsystem - Hardware Abstraction Interface for Motorcycle Camera Subsystem
 * Handles front/rear cameras, snapshot triggers, video recording, and low-power wakeups.
 */
export class ICameraSubsystem {
  async connect() {
    throw new Error('ICameraSubsystem.connect() must be implemented');
  }

  async disconnect() {
    throw new Error('ICameraSubsystem.disconnect() must be implemented');
  }

  getStatus() {
    throw new Error('ICameraSubsystem.getStatus() must be implemented');
  }

  async startLiveStream(facing) {
    throw new Error('ICameraSubsystem.startLiveStream() must be implemented');
  }

  stopLiveStream() {
    throw new Error('ICameraSubsystem.stopLiveStream() must be implemented');
  }

  async captureSnapshot(facing, metadata) {
    throw new Error('ICameraSubsystem.captureSnapshot() must be implemented');
  }

  async startRecording(facing) {
    throw new Error('ICameraSubsystem.startRecording() must be implemented');
  }

  async stopRecording() {
    throw new Error('ICameraSubsystem.stopRecording() must be implemented');
  }

  getStorageStatus() {
    throw new Error('ICameraSubsystem.getStorageStatus() must be implemented');
  }
}
