import { Motorcycle } from '../models/Motorcycle.js';
import { Command } from '../models/Command.js';
import { CommandAck } from '../models/CommandAck.js';
import { dispatchCommand } from '../services/commandDispatcher.js';

export async function sendCommand(req, res) {
  try {
    const { id } = req.params; // motorcycleId
    const { command, parameters } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command name is required' });
    }

    // Verify user owns bike
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) {
      return res.status(404).json({ error: 'Motorcycle not found or unauthorized' });
    }

    // Dispatch command and wait for acknowledgement from device
    const result = await dispatchCommand({
      motorcycleId: bike._id,
      deviceId: bike.deviceId,
      userId: req.user._id,
      command,
      parameters: parameters || {},
    });

    res.json({
      success: true,
      message: `Command ${command} executed successfully by motorcycle controller`,
      result,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message,
      command: err.command || null,
    });
  }
}

export async function getCommandHistory(req, res) {
  try {
    const { id } = req.params;
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) {
      return res.status(404).json({ error: 'Motorcycle not found' });
    }

    const commands = await Command.find({ motorcycleId: bike._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ commands });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getCommandDetails(req, res) {
  try {
    const { commandId } = req.params;
    const command = await Command.findOne({ commandId });
    if (!command) {
      return res.status(404).json({ error: 'Command record not found' });
    }

    const ack = await CommandAck.findOne({ commandId });

    res.json({ command, ack });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
