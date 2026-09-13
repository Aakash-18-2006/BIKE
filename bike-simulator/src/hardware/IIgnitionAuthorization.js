/**
 * IIgnitionAuthorization - Hardware Abstraction Interface for Ignition & Drivetrain Enable
 * Controls the physical power-relay / contactor and cryptographically enables the ECU starter circuit.
 *
 * CRITICAL SAFETY ENFORCEMENT:
 * The hardware controller will REJECT any command to disable ignition authorization while
 * the vehicle speed is greater than 0 km/h to prevent dangerous engine cut-offs during riding.
 */
export class IIgnitionAuthorization {
  /**
   * Cryptographically grants ignition authorization to the ECU.
   * @param {string} authToken
   * @returns {Promise<boolean>}
   */
  async grantAuthorization(authToken) {
    throw new Error('IIgnitionAuthorization.grantAuthorization() must be implemented');
  }

  /**
   * Disables ignition authorization and prevents starting/restarting.
   * IMPORTANT: If vehicle speed > 0 km/h, the hardware controller will return false
   * and flag IGNITION_CUTOFF_REQUESTED instead of cutting power.
   * @param {number} currentSpeedKmh
   * @returns {Promise<{ executed: boolean, deferredUntilStop: boolean, reason: string }>}
   */
  async revokeAuthorization(currentSpeedKmh) {
    throw new Error('IIgnitionAuthorization.revokeAuthorization() must be implemented');
  }

  /**
   * Returns authorization and hardware relay state.
   * @returns {{
   *   isAuthorized: boolean,
   *   relayClosed: boolean,
   *   cutoffPendingStop: boolean
   * }}
   */
  getAuthorizationState() {
    throw new Error('IIgnitionAuthorization.getAuthorizationState() must be implemented');
  }
}
