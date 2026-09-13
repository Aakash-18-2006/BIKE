# Smart Motorcycle Hardware Signals & Interface Specification

This document defines the electrical, logic, and bus signals required to integrate the Smart Bike Control System with motorcycle hardware (ECU, TCU, cluster, sensors, and actuators).

---

## 1. Electrical & Power Architecture

| Rail | Voltage Range | Typical | Protection / Notes |
|---|---|---|---|
| **KL30 (Permanent Battery)** | +9.0V to +16.0V DC | +12.6V DC | Direct from 12V lead-acid / LiFePO4 battery via 10A fuse. Powers TCU sleep mode & security monitoring. |
| **KL15 (Switched Ignition)** | +12.0V to +14.4V DC | +13.8V DC (running) | Controlled via Solid-State Relay (SSR) / contactor. Active only when ignition authorized. |
| **VCC_LOGIC (Digital)** | +3.3V ± 5% | +3.3V DC | Regulated buck converter output for MCU, sensors, GNSS. |
| **GND (Chassis Ground)** | 0V reference | 0V | Star-grounded to motorcycle engine case and frame. |
| **KL31_SENSE (Ground Loop)** | 0V to +3.3V | 0V (normal) | Anti-tamper continuity loop; pulls up to 3.3V if harness cut. |

---

## 2. Hardware Signal Directory

### A. CAN Bus Interface (ISO 11898-2)
- **CAN_H (Pin 1)**: Differential High (2.5V nominal, 3.5V dominant).
- **CAN_L (Pin 2)**: Differential Low (2.5V nominal, 1.5V dominant).
- **Baud Rate**: 500 kbps (120Ω termination at bus ends).
- **Signals Transmitted**:
  - `0x100`: Engine RPM (16-bit), Throttle Position (8-bit), Coolant Temp (8-bit).
  - `0x108`: Vehicle Speed Pulse (16-bit km/h * 100), Gear Position (4-bit).
  - `0x120`: Ignition Authorization Handshake (64-bit cryptographic token).
  - `0x130`: Security Status, Alarm Armed, Anti-Theft Wakeup Flag.

### B. Telematics Control Unit (TCU) & Cellular Modem
- **MODEM_PWR_EN (GPIO Output, 3.3V)**: High to enable 4G/LTE power domain.
- **MODEM_RESET_N (GPIO Output, Active Low, 3.3V)**: Modem hardware reboot.
- **TCU_WAKEUP_IN (Interrupt Input, Active High, 3.3V)**: Wake from accelerometer, tamper switch, or CAN.
- **UART_MODEM_TX / RX (115200 / 921600 baud, 3.3V LVTTL)**: AT command and data pipe.

### C. GNSS / GPS Receiver
- **GPS_TX / GPS_RX (UART 9600/115200 baud, 3.3V)**: NMEA-0183 ($GPRMC, $GPGGA, $GPVTG).
- **GPS_PPS (Pulse-Per-Second Input, 3.3V)**: 1Hz time synchronization pulse (< 20ns jitter).
- **GPS_VBACKUP (Permanent 3.0V Coin Cell / Supercap)**: Hot-start ephemeris retention.

### D. Ignition Authorization & Safety Relay
- **IGN_ENABLE_REQ (Input from Cloud/TFT, 3.3V Logic)**: Desired ignition state.
- **VEHICLE_SPEED_SENSE (Input from Wheel Encoder / CAN)**: Frequency pulse or CAN speed.
- **IGN_CUTOFF_INHIBIT (Hardware Functional Safety Interlock)**:
  - *Automotive Safety Rule (ISO 26262)*: If `SPEED > 0 km/h`, hardware gates `IGN_RELAY_DRIVE` HIGH, **prohibiting in-motion engine stalling**.
- **IGN_RELAY_DRIVE (Output to 40A Automotive Relay)**: Open-drain low-side FET driver with flyback diode.
- **IGN_RELAY_FEEDBACK (Sense Input, 12V tolerant via resistor divider)**: Confirms actual contactor closure.

### E. Steering Lock Actuator
- **LOCK_MOTOR_FWD / REV (H-Bridge Driver, 12V 2.5A peak)**: Drives bidirectional motorized deadbolt.
- **LOCK_HALL_LOCKED (Input, Active Low with pull-up)**: Hall sensor confirms lock bolt fully extended into steering stem.
- **LOCK_HALL_UNLOCKED (Input, Active Low with pull-up)**: Hall sensor confirms lock bolt retracted.

### F. Motion & Vibration Sensor (6-Axis IMU)
- **SPI / I2C Bus (SCL/SDA or SCK/MISO/MOSI/CS, 3.3V)**: Continuous 100Hz tilt/motion sampling.
- **IMU_INT1 (Hardware Wakeup Interrupt, Active High, 3.3V)**: Triggers TCU wakeup when acceleration exceeds 0.15g while parked.

### G. Anti-Tamper Sensors
- **CHASSIS_LOOP_IN (Input, 3.3V with 10k pull-up)**: Grounded through chassis loop wire; opens on harness cut.
- **SEAT_SWITCH_SENSE (Input, Active Low)**: Enclosure/seat latch microswitch.
- **BATT_VOLTAGE_ADC (Analog Input, 0-3.3V via 1:5 precision divider)**: Detects main battery disconnect.

### H. Camera Subsystem
- **CAM_PWR_EN (Output, 3.3V to load switch)**: Supplies +5V/+3.3V to MIPI CSI-2 / USB camera modules.
- **CAM_TRIGGER (Output, 3.3V pulse)**: Hardware sync pulse for instant snapshot capture upon security interrupt.
- **CAM_FRONT_DATA / CAM_REAR_DATA (USB 2.0 High-Speed / MIPI CSI-2)**: Video stream data path.
