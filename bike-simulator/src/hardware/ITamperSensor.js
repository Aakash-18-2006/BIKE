/**
 * ITamperSensor - Hardware Abstraction Interface for Chassis and Enclosure Anti-Tamper
 * Detects battery disconnection, harness severing, and enclosure intrusion.
 */
export class ITamperSensor {
  /**
   * @returns {{
   *   chassisLoopContinuous: boolean,
   *   enclosureClosed: boolean,
   *   mainBatteryConnected: boolean,
   *   backupBatteryHealthy: boolean,
   *   tamperTriggered: boolean,
   *   lastTamperTimestamp: Date | null
   * }}
   */
  getTamperStatus() {
    throw new Error('ITamperSensor.getTamperStatus() must be implemented');
  }

  /**
   * Registers a hardware interrupt handler for immediate tamper detection.
   * @param {() => void} onTamperInterrupt
   */
  onTamper(onTamperInterrupt) {
    throw new Error('ITamperSensor.onTamper() must be implemented');
  }
}
