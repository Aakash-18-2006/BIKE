/**
 * ILockActuator - Hardware Abstraction Interface for Motorized / Solenoid Steering Lock Actuator
 * Drives high-current H-bridge actuator with position feedback.
 */
export class ILockActuator {
  async engageLock() {
    throw new Error('ILockActuator.engageLock() must be implemented');
  }

  async disengageLock() {
    throw new Error('ILockActuator.disengageLock() must be implemented');
  }

  /**
   * @returns {{
   *   isLocked: boolean,
   *   hallSensorFeedback: 'LOCKED' | 'UNLOCKED' | 'FAULT',
   *   actuatorCurrentMa: number
   * }}
   */
  getLockStatus() {
    throw new Error('ILockActuator.getLockStatus() must be implemented');
  }
}
