export class PhysicsEngine {
  constructor() {
    this.speed = 0;
    this.targetSpeed = 0;
    this.rpm = 0;
    this.gear = 'N';
    this.engineTemp = 25; // ambient °C
    this.fuelLevel = 78; // %
    this.batteryPercentage = 85; // %
    this.batteryVoltage = 12.6; // Volts
    this.cycleCount = 0;
  }

  update(ignitionOn, ridingMode = 'ECO') {
    this.cycleCount++;

    if (!ignitionOn) {
      // Ignition OFF: engine stopped, cooling down, quiescent low power draw
      this.speed = 0;
      this.rpm = 0;
      this.gear = 'N';
      if (this.engineTemp > 25) {
        this.engineTemp = Math.max(25, this.engineTemp - 0.2);
      }
      this.batteryVoltage = 12.55;
      // Very slow parasitic drain over long periods
      if (this.cycleCount % 500 === 0 && this.batteryPercentage > 20) {
        this.batteryPercentage -= 0.1;
      }
      return this.getState();
    }

    // Ignition ON: engine physics active (ECO ~85 km/h, EV ~105 km/h, FUEL ~145 km/h full power)
    const upperMode = String(ridingMode).toUpperCase();
    const maxSpeedForMode = (upperMode === 'FUEL' || upperMode === 'SPORT') 
      ? 145 
      : (upperMode === 'EV' ? 105 : 85);
    
    // Simulate dynamic riding acceleration and braking wave
    const wave = Math.sin(this.cycleCount * 0.08);
    const wave2 = Math.cos(this.cycleCount * 0.03);
    this.targetSpeed = Math.max(0, (wave * 0.5 + 0.5) * maxSpeedForMode * (0.6 + wave2 * 0.4));

    // Smooth speed transition
    this.speed += (this.targetSpeed - this.speed) * 0.12;
    if (this.speed < 1) this.speed = 0;

    // Calculate realistic gear and RPM
    if (this.speed === 0) {
      this.gear = 'N';
      this.rpm = 1400 + Math.sin(this.cycleCount) * 80; // Idle RPM
    } else if (this.speed < 25) {
      this.gear = '1';
      this.rpm = 1500 + (this.speed / 25) * 5500;
    } else if (this.speed < 45) {
      this.gear = '2';
      this.rpm = 3000 + ((this.speed - 25) / 20) * 5000;
    } else if (this.speed < 70) {
      this.gear = '3';
      this.rpm = 3500 + ((this.speed - 45) / 25) * 4800;
    } else if (this.speed < 95) {
      this.gear = '4';
      this.rpm = 4000 + ((this.speed - 70) / 25) * 4500;
    } else if (this.speed < 120) {
      this.gear = '5';
      this.rpm = 4500 + ((this.speed - 95) / 25) * 4200;
    } else {
      this.gear = '6';
      this.rpm = 5000 + ((this.speed - 120) / 30) * 4500;
    }

    // Engine temperature reaches operating temp (88-92°C)
    if (this.engineTemp < 90) {
      this.engineTemp += 0.3;
    } else {
      this.engineTemp = 89 + Math.sin(this.cycleCount * 0.05) * 2;
    }

    // Alternator charges battery when engine runs
    this.batteryVoltage = 14.1 + Math.random() * 0.15;
    if (this.batteryPercentage < 98 && this.cycleCount % 100 === 0) {
      this.batteryPercentage = Math.min(100, this.batteryPercentage + 0.1);
    }

    // Micro fuel consumption
    if (this.cycleCount % 200 === 0 && this.fuelLevel > 5) {
      this.fuelLevel = Math.max(0, this.fuelLevel - 0.05);
    }

    return this.getState();
  }

  getState() {
    return {
      speed: Number(this.speed.toFixed(1)),
      rpm: Math.round(this.rpm),
      gear: this.gear,
      engineTemp: Math.round(this.engineTemp),
      fuelLevel: Math.round(this.fuelLevel),
      lowFuel: this.fuelLevel < 20,
      batteryPercentage: Math.round(this.batteryPercentage),
      batteryVoltage: Number(this.batteryVoltage.toFixed(2)),
      batteryStatus: this.batteryPercentage < 20 ? 'LOW' : 'NORMAL',
      absStatus: 'NORMAL',
      tractionControlStatus: 'ACTIVE',
      sideStandStatus: this.speed === 0 ? 'DOWN' : 'UP',
      tirePressure: {
        front: 38,
        rear: 40,
        unit: 'PSI',
        status: 'OPTIMAL',
      },
      stabilityIndex: 94,
      sidestandDown: this.speed === 0,
    };
  }
}
