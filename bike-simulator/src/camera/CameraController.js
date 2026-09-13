/**
 * CameraController Hardware Abstraction Interface
 * All physical motorcycle camera modules (e.g. MIPI-CSI, USB UVC, RTSP / ONVIF dashcams)
 * or simulated hardware controllers must implement this interface.
 */
export class CameraController {
  constructor(cameraId = 'CAM-FRONT-01') {
    this.cameraId = cameraId;
  }

  async connect() {
    throw new Error('connect() not implemented');
  }

  async disconnect() {
    throw new Error('disconnect() not implemented');
  }

  getStatus() {
    throw new Error('getStatus() not implemented');
  }

  async startLiveStream(options = {}) {
    throw new Error('startLiveStream() not implemented');
  }

  async stopLiveStream() {
    throw new Error('stopLiveStream() not implemented');
  }

  async captureSnapshot(options = {}) {
    throw new Error('captureSnapshot() not implemented');
  }

  async startRecording(options = {}) {
    throw new Error('startRecording() not implemented');
  }

  async stopRecording() {
    throw new Error('stopRecording() not implemented');
  }

  getStorageStatus() {
    throw new Error('getStorageStatus() not implemented');
  }
}
