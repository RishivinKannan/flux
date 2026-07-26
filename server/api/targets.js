import express from 'express';
import db from '../lib/database.js';
import logger from '../lib/logger.js';

const router = express.Router();

/**
 * Register target management API routes
 */

// List all targets. Reads fresh from Redis first (when enabled) so this never
// serves a stale pod-local snapshot right after another pod's write.
router.get('/api/targets', async (req, res) => {
  try {
    const targets = await db.getAllTargetsFresh();
    res.json({ targets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific target
router.get('/api/targets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const target = await db.getTargetFresh(id);

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

    const newTarget = await db.createTarget({
      id,
      nickname,
      baseUrl,
      tags: tags || [],
      metadata: metadata || {}
    });

    logger.info(`[API] Target created: "${nickname}" (${id})`);

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

    // Fresh read: a stale 404 here is not harmless — callers respond to it by
    // re-creating the target, which duplicates a row that still exists in Redis.
    const existingTarget = await db.getTargetFresh(id);
    if (!existingTarget) {
      return res.status(404).json({ error: 'Target not found' });
    }

    const updatedTarget = await db.updateTarget(id, {
      nickname: nickname || existingTarget.nickname,
      baseUrl: baseUrl || existingTarget.baseUrl,
      tags: tags !== undefined ? tags : existingTarget.tags,
      metadata: metadata !== undefined ? metadata : existingTarget.metadata
    });

    // vanished between the fresh read and the write (deleted concurrently on
    // another pod) — report it honestly rather than 200-ing with a null target
    if (!updatedTarget) {
      return res.status(404).json({ error: 'Target not found' });
    }

    logger.info(`[API] Target updated: "${updatedTarget.nickname}" (${id})`);

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

    const deleted = await db.deleteTarget(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Target not found' });
    }

    logger.info(`[API] Target deleted: "${id}"`);

    res.json({
      success: true,
      message: 'Target deleted successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
