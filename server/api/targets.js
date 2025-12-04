import db from '../lib/database.js';

/**
 * Register target management API routes
 */
export default async function targetsRoutes(fastify, options) {

  // List all targets
  fastify.get('/api/targets', async (request, reply) => {
    try {
      const targets = db.getAllTargets();
      return { targets };
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // Get specific target
  fastify.get('/api/targets/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const target = db.getTarget(id);

      if (!target) {
        return reply.code(404).send({ error: 'Target not found' });
      }

      return target;
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // Create new target
  fastify.post('/api/targets', async (request, reply) => {
    try {
      const { nickname, baseUrl, tags, metadata } = request.body;

      if (!nickname || !baseUrl) {
        return reply.code(400).send({ error: 'Nickname and baseUrl are required' });
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

      return {
        success: true,
        message: 'Target created successfully',
        target: newTarget
      };
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // Update existing target
  fastify.put('/api/targets/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const { nickname, baseUrl, tags, metadata } = request.body;

      const existingTarget = db.getTarget(id);
      if (!existingTarget) {
        return reply.code(404).send({ error: 'Target not found' });
      }

      const updatedTarget = db.updateTarget(id, {
        nickname: nickname || existingTarget.nickname,
        baseUrl: baseUrl || existingTarget.baseUrl,
        tags: tags !== undefined ? tags : existingTarget.tags,
        metadata: metadata !== undefined ? metadata : existingTarget.metadata
      });

      return {
        success: true,
        message: 'Target updated successfully',
        target: updatedTarget
      };
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // Delete target
  fastify.delete('/api/targets/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      const deleted = db.deleteTarget(id);

      if (!deleted) {
        return reply.code(404).send({ error: 'Target not found' });
      }

      return {
        success: true,
        message: 'Target deleted successfully'
      };
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });
}
