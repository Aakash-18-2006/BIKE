import { SecurityEvent } from '../models/SecurityEvent.js';
import { Motorcycle } from '../models/Motorcycle.js';
import { VehicleStatus } from '../models/VehicleStatus.js';
import { dispatchCommand } from '../services/commandDispatcher.js';

export async function listSecurityEvents(req, res) {
  try {
    const { id } = req.params;
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) {
      return res.status(404).json({ error: 'Motorcycle not found' });
    }

    const events = await SecurityEvent.find({
      $or: [{ vehicleId: bike._id }, { motorcycleId: bike._id }],
    })
      .sort({ timestamp: -1 })
      .limit(50);

    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function resolveSecurityEvent(req, res) {
  try {
    const { eventId } = req.params;
    const event = await SecurityEvent.findOneAndUpdate(
      { $or: [{ _id: eventId }, { eventId }] },
      { resolved: true, resolvedAt: new Date() },
      { new: true }
    );
    if (!event) {
      return res.status(404).json({ error: 'Security event not found' });
    }
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Emergency Vehicle Security Action: [ SECURE VEHICLE ]
 * Routes through Backend -> TCU -> Vehicle-side Security Controller for safety validation.
 */
export async function secureVehicle(req, res) {
  try {
    const { id } = req.params;
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) {
      return res.status(404).json({ error: 'Motorcycle not found or unauthorized' });
    }

    // Try direct simulator bridge first, or dispatch via MQTT command engine
    let commandResult = null;
    try {
      const simRes = await fetch('http://localhost:5005/api/simulator/security/secure-vehicle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (simRes.ok) {
        commandResult = await simRes.json();
      }
    } catch (e) {
      // Simulator bridge fallback: MQTT command dispatch
    }

    if (!commandResult) {
      const cmd = await dispatchCommand({
        motorcycleId: bike._id,
        deviceId: bike.deviceId,
        userId: req.user._id,
        command: 'SECURE_VEHICLE',
        parameters: {},
      });
      commandResult = cmd.resultingState;
    }

    res.json({
      success: true,
      message: commandResult?.message || 'Emergency secure vehicle instruction dispatched',
      result: commandResult,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Toggle Vehicle Security Mode (Active / Disarmed)
 */
export async function setSecurityMode(req, res) {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) {
      return res.status(404).json({ error: 'Motorcycle not found or unauthorized' });
    }

    let modeResult = null;
    try {
      const simRes = await fetch('http://localhost:5005/api/simulator/security/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: active !== false }),
      });
      if (simRes.ok) {
        modeResult = await simRes.json();
      }
    } catch (e) {
      // Fallback to command dispatch
    }

    if (!modeResult) {
      const cmd = await dispatchCommand({
        motorcycleId: bike._id,
        deviceId: bike.deviceId,
        userId: req.user._id,
        command: 'SECURITY_MODE_SET',
        parameters: { active: active !== false },
      });
      modeResult = cmd.resultingState;
    }

    res.json({
      success: true,
      securityMode: modeResult?.securityMode || (active ? 'SECURITY_MODE_ACTIVE' : 'DISARMED'),
      securityActive: active !== false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get active turn-by-turn navigation data
 */
export async function getNavigationRoute(req, res) {
  try {
    const { id } = req.params;
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) {
      return res.status(404).json({ error: 'Motorcycle not found' });
    }

    const status = await VehicleStatus.findOne({ deviceId: bike.deviceId });
    let navData = status?.gps?.navigation;

    if (!navData) {
      // Fetch live navigation from simulator
      try {
        const simRes = await fetch('http://localhost:5005/api/simulator/navigation/route');
        if (simRes.ok) {
          navData = await simRes.json();
        }
      } catch (e) {}
    }

    res.json({ navigation: navData || { active: false } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
