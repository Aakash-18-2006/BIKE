import { Motorcycle } from '../models/Motorcycle.js';
import * as cameraService from '../services/cameraService.js';

export async function getStatus(req, res) {
  try {
    const { id } = req.params;
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) return res.status(404).json({ error: 'Motorcycle not found or unauthorized' });

    const status = await cameraService.getCameraStatus(bike._id);
    res.json({ camera: status, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function snapshot(req, res) {
  try {
    const { id } = req.params;
    const { facing } = req.body;
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) return res.status(404).json({ error: 'Motorcycle not found or unauthorized' });

    const result = await cameraService.captureSnapshot(bike._id, req.user._id, facing || 'FRONT');
    res.status(201).json({
      success: true,
      message: 'Snapshot captured and stored successfully',
      event: result.cameraEvent,
      mediaUrl: result.mediaUrl,
      image: result.snapshot?.base64Image,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function startRecord(req, res) {
  try {
    const { id } = req.params;
    const { facing } = req.body;
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) return res.status(404).json({ error: 'Motorcycle not found or unauthorized' });

    const result = await cameraService.startRecording(bike._id, req.user._id, facing || 'FRONT');
    res.json({
      success: true,
      message: 'Camera video recording initiated',
      status: result.cameraDevice,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function stopRecord(req, res) {
  try {
    const { id } = req.params;
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) return res.status(404).json({ error: 'Motorcycle not found or unauthorized' });

    const result = await cameraService.stopRecording(bike._id, req.user._id);
    res.json({
      success: true,
      message: 'Camera video recording stopped',
      duration: result.cameraEvent?.duration,
      event: result.cameraEvent,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function createLiveSession(req, res) {
  try {
    const { id } = req.params;
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) return res.status(404).json({ error: 'Motorcycle not found or unauthorized' });

    const session = cameraService.createLiveStreamSession(bike._id, req.user._id);
    res.json({
      success: true,
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      streamEndpoint: `/api/motorcycles/${bike._id}/camera/frame?facing=FRONT`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function listEvents(req, res) {
  try {
    const { id } = req.params;
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) return res.status(404).json({ error: 'Motorcycle not found or unauthorized' });

    const events = await cameraService.getCameraEvents(bike._id);
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getMedia(req, res) {
  try {
    const { id, mediaId } = req.params;
    // Authorized request
    const bike = await Motorcycle.findOne({ _id: id, ownerId: req.user._id });
    if (!bike) return res.status(404).json({ error: 'Motorcycle not found or unauthorized' });

    const media = await cameraService.getMediaFile(bike._id, mediaId);
    if (!media) {
      return res.status(404).json({ error: 'Media file not found' });
    }

    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${media.filename}"`);
    res.sendFile(media.filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getLiveFrame(req, res) {
  try {
    const { id } = req.params;
    const facing = req.query.facing || 'FRONT';

    // Fetch live camera frame from simulator TCU
    const frameRes = await fetch(`http://localhost:5005/api/simulator/camera/frame?facing=${facing}`);
    if (!frameRes.ok) {
      return res.status(503).json({ error: 'Camera hardware currently unavailable' });
    }

    const buffer = Buffer.from(await frameRes.arrayBuffer());
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
