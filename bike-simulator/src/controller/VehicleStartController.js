/**
 * VehicleStartController
 * Enforces safety interlocks, authentication, and state machine transitions
 * for keyless vehicle startup from the digital TFT cluster or cloud command.
 */
export class VehicleStartController {
  constructor(options = {}) {
    this.pin = options.pin || '1234';
    this.sideStandDown = false; // Interlock simulation
    this.criticalFault = false;
    this.maxFailedAttempts = 5;
    this.failedAttempts = 0;
    this.lockoutUntil = 0;
  }

  setPin(newPin) {
    if (newPin && newPin.length === 4) {
      this.pin = newPin;
      return true;
    }
    return false;
  }

  verifyPin(inputPin) {
    if (Date.now() < this.lockoutUntil) {
      const waitSec = Math.ceil((this.lockoutUntil - Date.now()) / 1000);
      return { success: false, reason: `Too many attempts. Locked out for ${waitSec}s.`, lockedOut: true };
    }

    if (inputPin === this.pin) {
      this.failedAttempts = 0;
      return { success: true };
    }

    this.failedAttempts++;
    if (this.failedAttempts >= this.maxFailedAttempts) {
      this.lockoutUntil = Date.now() + 30000; // 30 second lockout
      return { success: false, reason: 'PIN incorrect. 5 failed attempts: 30s lockout engaged.', lockedOut: true };
    }

    return {
      success: false,
      reason: `Incorrect PIN. ${this.maxFailedAttempts - this.failedAttempts} attempts remaining.`,
      lockedOut: false,
    };
  }

  performSafetyCheck(bikeState) {
    const checks = [];

    // 1. Stationary Check
    const speed = bikeState.physics?.speed || 0;
    if (speed > 1) {
      checks.push({ name: 'Stationary Check', passed: false, error: 'Vehicle is currently in motion' });
    } else {
      checks.push({ name: 'Stationary Check', passed: true });
    }

    // 2. Battery Voltage / Health Check
    const battery = bikeState.physics?.batteryPercentage || 85;
    if (battery < 10) {
      checks.push({ name: 'Battery Health', passed: false, error: 'Battery too low to initiate drive system (<10%)' });
    } else {
      checks.push({ name: 'Battery Health', passed: true });
    }

    // 3. Safety Interlocks & Side Stand Check
    if (this.sideStandDown) {
      checks.push({ name: 'Side-Stand Sensor', passed: false, error: 'Side stand is deployed' });
    } else {
      checks.push({ name: 'Side-Stand Sensor', passed: true });
    }

    // 4. Critical Diagnostic System Fault Check
    if (this.criticalFault) {
      checks.push({ name: 'Diagnostic Health', passed: false, error: 'Critical system diagnostic code active' });
    } else {
      checks.push({ name: 'Diagnostic Health', passed: true });
    }

    const allPassed = checks.every((c) => c.passed);
    return {
      passed: allPassed,
      checks,
      reason: allPassed ? 'All vehicle safety interlocks verified' : checks.find((c) => !c.passed)?.error,
    };
  }
}
