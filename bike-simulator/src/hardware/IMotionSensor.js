/**
 * IMotionSensor - Hardware Abstraction Interface for 6-Axis IMU (Inertial Measurement Unit)
 * Detects unauthorized vehicle movement, tilt, roll, and fall detection.
 */
export class IMotionSensor {
  /**
   * Sets low-power motion interrupt threshold (e.g. 0.15g tilt/shock threshold) for sleep mode.
   * @param {number} thresholdG
   */
  async configureWakeInterrupt(thresholdG = 0.15) {
    throw new Error('IMotionSensor.configureWakeInterrupt() must be implemented');
  }

  /**
   * @returns {{
   *   accelX: number,
   *   accelY: number,
   *   accelZ: number,
   *   gyroX: number,
   *   gyroY: number,
   *   gyroZ: number,
   *   pitchDeg: number,
   *   rollDeg: number,
   *   motionDetected: boolean,
   *   fallDetected: boolean
   * }}
   */
  getMotionData() {
    throw new Error('IMotionSensor.getMotionData() must be implemented');
  }
}
