/**
 * ICanBus - Hardware Abstraction Interface for CAN (Controller Area Network) Bus
 * Standard ISO 11898-2 differential physical layer (CAN-H, CAN-L) at 250 kbps or 500 kbps.
 */
export class ICanBus {
  async open(baudRate = 500000) {
    throw new Error('ICanBus.open() must be implemented');
  }

  async close() {
    throw new Error('ICanBus.close() must be implemented');
  }

  /**
   * Transmits a CAN frame.
   * @param {number} canId - 11-bit standard or 29-bit extended ID
   * @param {Uint8Array|Buffer} data - Up to 8 bytes (or 64 for CAN-FD)
   * @param {boolean} isExtended
   */
  async sendFrame(canId, data, isExtended = false) {
    throw new Error('ICanBus.sendFrame() must be implemented');
  }

  /**
   * Registers a callback for incoming CAN frames.
   * @param {number|null} filterId
   * @param {(frame: { canId: number, data: Buffer, timestamp: number }) => void} callback
   */
  onFrame(filterId, callback) {
    throw new Error('ICanBus.onFrame() must be implemented');
  }
}
