/**
 * IGpsSensor - Hardware Abstraction Interface for GNSS / GPS Receiver
 * Typically connected via UART (e.g., NMEA-0183 9600/115200 baud) or I2C.
 */
export class IGpsSensor {
  /**
   * Initializes hardware communication with GNSS module.
   * @returns {Promise<boolean>}
   */
  async init() {
    throw new Error('IGpsSensor.init() must be implemented');
  }

  /**
   * Returns current positioning telemetry.
   * @returns {{
   *   latitude: number,
   *   longitude: number,
   *   altitude: number,
   *   speedKmh: number,
   *   heading: number,
   *   satellites: number,
   *   fixType: 'NO_FIX' | '2D_FIX' | '3D_FIX' | 'DGPS',
   *   hdop: number,
   *   timestamp: Date
   * }}
   */
  getData() {
    throw new Error('IGpsSensor.getData() must be implemented');
  }

  /**
   * Hardware health / lock status.
   * @returns {boolean}
   */
  hasFix() {
    throw new Error('IGpsSensor.hasFix() must be implemented');
  }
}
