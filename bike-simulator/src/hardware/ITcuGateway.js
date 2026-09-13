/**
 * ITcuGateway - Hardware Abstraction Interface for Telematics Control Unit (TCU)
 * Manages 4G/LTE cellular modem, SIM interface, cloud connectivity, and vehicle power management.
 */
export class ITcuGateway {
  async connectNetwork() {
    throw new Error('ITcuGateway.connectNetwork() must be implemented');
  }

  async disconnectNetwork() {
    throw new Error('ITcuGateway.disconnectNetwork() must be implemented');
  }

  /**
   * Puts TCU into ultra-low-power standby mode (< 5mA current draw).
   * Wake sources: Motion sensor interrupt, CAN activity, SMS, or periodic RTC alarm.
   */
  async enterLowPowerStandby() {
    throw new Error('ITcuGateway.enterLowPowerStandby() must be implemented');
  }

  /**
   * Wakes TCU to active high-throughput state.
   */
  async wakeFromStandby(reason) {
    throw new Error('ITcuGateway.wakeFromStandby() must be implemented');
  }

  /**
   * @returns {{
   *   networkState: 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'SEARCHING',
   *   signalDbm: number,
   *   rat: 'LTE-M' | 'NB-IoT' | '4G-LTE' | '2G',
   *   imei: string,
   *   iccid: string,
   *   batteryVoltage: number
   * }}
   */
  getStatus() {
    throw new Error('ITcuGateway.getStatus() must be implemented');
  }
}
