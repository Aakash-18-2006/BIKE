/**
 * IVehicleEcu - Hardware Abstraction Interface for Engine/Vehicle Control Unit (ECU/VCU)
 * Reports real-time powertrain telemetry and safety interlocks.
 */
export class IVehicleEcu {
  /**
   * @returns {{
   *   engineRunning: boolean,
   *   engineRpm: number,
   *   vehicleSpeedKmh: number,
   *   throttlePositionPct: number,
   *   coolantTempC: number,
   *   gear: 'N' | '1' | '2' | '3' | '4' | '5' | '6',
   *   sideStandDown: boolean,
   *   clutchEngaged: boolean,
   *   killSwitchEngaged: boolean
   * }}
   */
  getPowertrainState() {
    throw new Error('IVehicleEcu.getPowertrainState() must be implemented');
  }

  /**
   * Evaluates whether the motorcycle is safely stationary for safety interlocks.
   * @returns {boolean}
   */
  isSafelyStationary() {
    throw new Error('IVehicleEcu.isSafelyStationary() must be implemented');
  }
}
