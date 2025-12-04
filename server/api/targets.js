import express from 'express';
import db from '../lib/database.js';

const router = express.Router();

/**
 * Register target management API routes
 */

// List all targets
router.get('/api/targets', async (req, res) => {
  try {
    const targets = db.getAllTargets();
    res.json({ targets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific target
router.get('/api/targets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const target = db.getTarget(id);

    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }

    res.json(target);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new target
router.post('/api/targets', async (req, res) => {
  try {
    const { nickname, baseUrl, tags, metadata } = req.body;

    if (!nickname || !baseUrl) {
      return res.status(400).json({ error: 'Nickname and baseUrl are required' });
    }

    // Generate unique ID
    const id = `target-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newTarget = db.createTarget({
      id,
      nickname,
      baseUrl,
      tags: tags || [],
      metadata: metadata || {}
    });

    res.json({
      success: true,
      message: 'Target created successfully',
      target: newTarget
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update existing target
router.put('/api/targets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, baseUrl, tags, metadata } = req.body;

    const existingTarget = db.getTarget(id);
    if (!existingTarget) {
      return res.status(404).json({ error: 'Target not found' });
    }

    const updatedTarget = db.updateTarget(id, {
      nickname: nickname || existingTarget.nickname,
      baseUrl: baseUrl || existingTarget.baseUrl,
      tags: tags !== undefined ? tags : existingTarget.tags,
      metadata: metadata !== undefined ? metadata : existingTarget.metadata
    });

    res.json({
      success: true,
      message: 'Target updated successfully',
      target: updatedTarget
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete target
router.delete('/api/targets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = db.deleteTarget(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Target not found' });
    }

    res.json({
      success: true,
      message: 'Target deleted successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
