import { Command } from '../models/Command.js';
import { CommandAck } from '../models/CommandAck.js';
import { VehicleStatus } from '../models/VehicleStatus.js';
import { Device } from '../models/Device.js';
import { publishDeviceCommand } from '../config/mqtt.js';
import { broadcastBikeUpdate } from './socketService.js';
import { CONFIG } from '../config/env.js';

// Map of commandId -> { resolve, reject, timer, commandRecord }
const pendingCommands = new Map();

export async function dispatchCommand({ motorcycleId, deviceId, userId, command, parameters = {} }) {
  // 1. Check device existence & online state
  const device = await Device.findOne({ deviceId });
  const status = await VehicleStatus.findOne({ deviceId });

  // Note: Ignition OFF does NOT mean offline. But if networkStatus is OFFLINE, bike cannot receive commands.
  if (!device || device.networkStatus === 'OFFLINE') {
    const offlineCmd = await Command.create({
      commandId: `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      motorcycleId,
      deviceId,
      userId,
      command,
      parameters,
      status: 'BIKE_OFFLINE',
      expiresAt: new Date(Date.now() + 5000),
      errorReason: 'Bike IoT Controller is currently offline or unreachable.',
    });
    broadcastBikeUpdate(deviceId, 'command_update', offlineCmd);
    const err = new Error('Bike is currently offline');
    err.command = offlineCmd;
    err.statusCode = 503;
    throw err;
  }

  // 2. Create command record
  const commandId = `CMD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const expiresAt = new Date(Date.now() + CONFIG.COMMAND_TIMEOUT_MS);

  const commandRecord = await Command.create({
    commandId,
    motorcycleId,
    deviceId,
    userId,
    command,
    parameters,
    status: 'SERVER_RECEIVED',
    createdAt: new Date(),
    expiresAt,
  });

  // Notify WebSocket client that server received command
  broadcastBikeUpdate(deviceId, 'command_update', commandRecord);

  // 3. Return a promise that resolves when bike ACK arrives or rejects on timeout
  return new Promise(async (resolve, reject) => {
    const timer = setTimeout(async () => {
      pendingCommands.delete(commandId);
      commandRecord.status = 'TIMEOUT';
      commandRecord.errorReason = 'Command timed out waiting for bike controller acknowledgement';
      commandRecord.completedAt = new Date();
      await commandRecord.save();
      broadcastBikeUpdate(deviceId, 'command_update', commandRecord);
      const timeoutErr = new Error('Command timed out waiting for motorcycle acknowledgement');
      timeoutErr.command = commandRecord;
      timeoutErr.statusCode = 504;
      reject(timeoutErr);
    }, CONFIG.COMMAND_TIMEOUT_MS);

    pendingCommands.set(commandId, {
      resolve,
      reject,
      timer,
      commandRecord,
      startTime: Date.now(),
    });

    // 4. Publish via MQTT
    const mqttPayload = {
      commandId,
      deviceId,
      command,
      parameters,
      timestamp: Date.now(),
      expiresAt: expiresAt.getTime(),
    };

    try {
      await publishDeviceCommand(deviceId, mqttPayload);
    } catch (pubErr) {
      clearTimeout(timer);
      pendingCommands.delete(commandId);
      commandRecord.status = 'FAILED';
      commandRecord.errorReason = `Failed to publish to MQTT: ${pubErr.message}`;
      await commandRecord.save();
      broadcastBikeUpdate(deviceId, 'command_update', commandRecord);
      reject(pubErr);
    }
  });
}

export async function handleCommandAck(deviceId, ackPayload) {
  const { commandId, status, details, resultingState, error } = ackPayload;
  console.log(`[Command Engine] Received ACK for ${commandId}: ${status}`);

  const pending = pendingCommands.get(commandId);

  // If intermediate status like DEVICE_RECEIVED or EXECUTING
  if (status === 'DEVICE_RECEIVED' || status === 'EXECUTING') {
    await Command.findOneAndUpdate({ commandId }, { status });
    broadcastBikeUpdate(deviceId, 'command_update', { commandId, status, details });
    return;
  }

  // Final status: SUCCESS or FAILED
  const now = new Date();
  const command = await Command.findOne({ commandId });

  if (command) {
    command.status = status;
    command.acknowledgedAt = now;
    command.completedAt = now;
    if (error) command.errorReason = error;
    await command.save();
  }

  // Create audit record
  await CommandAck.create({
    commandId,
    deviceId,
    status,
    executedAt: now,
    durationMs: pending ? Date.now() - pending.startTime : 0,
    resultingState,
    error,
    rawPacket: ackPayload,
  });

  // If resulting state was reported, update VehicleStatus in database
  if (resultingState) {
    const updatedStatus = await VehicleStatus.findOneAndUpdate(
      { deviceId },
      { $set: { ...resultingState, updatedAt: now } },
      { new: true }
    );
    broadcastBikeUpdate(deviceId, 'status_update', updatedStatus);
  }

  broadcastBikeUpdate(deviceId, 'command_update', command || { commandId, status });

  if (pending) {
    clearTimeout(pending.timer);
    pendingCommands.delete(commandId);

    if (status === 'SUCCESS') {
      pending.resolve({
        commandId,
        status: 'SUCCESS',
        details,
        resultingState,
        durationMs: Date.now() - pending.startTime,
      });
    } else {
      const err = new Error(error || 'Command failed on motorcycle hardware');
      err.command = command;
      pending.reject(err);
    }
  }
}
