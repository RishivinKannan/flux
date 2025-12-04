import db from '../lib/database.js';
import scriptLoader from '../lib/script-loader.js';

/**
 * Register script management API routes
 */
export default async function scriptsRoutes(fastify, options) {

    // List all scripts
    fastify.get('/api/scripts', async (request, reply) => {
        try {
            const scripts = db.getAllScripts();
            return {
                scripts: scripts.map(s => ({
                    name: s.name,
                    filename: `${s.name}.js`, // Keep filename for UI compatibility
                    modifiedAt: s.updatedAt
                }))
            };
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    // Get specific script content
    fastify.get('/api/scripts/:name', async (request, reply) => {
        try {
            const { name } = request.params;
            const script = db.getScript(name);

            if (!script) {
                return reply.code(404).send({ error: 'Script not found' });
            }

            return {
                name: script.name,
                content: script.content,
                metadata: {
                    tags: script.tags || [],
                    description: script.description || '',
                    pathPattern: script.pathPattern || ''
                },
                exists: true
            };
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    // Update script metadata (tags, description)
    fastify.put('/api/scripts/:name/metadata', async (request, reply) => {
        try {
            const { name } = request.params;
            const { tags, description, pathPattern } = request.body;

            const script = db.getScript(name);
            if (!script) {
                return reply.code(404).send({ error: 'Script not found' });
            }

            db.updateScript(name, {
                content: script.content,
                description: description !== undefined ? description : script.description,
                tags: tags !== undefined ? tags : script.tags,
                pathPattern: pathPattern !== undefined ? pathPattern : script.pathPattern
            });

            // Force reload in script loader
            await scriptLoader.loadAllScripts();

            return {
                success: true,
                message: 'Script metadata updated successfully'
            };
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    // Create new script
    fastify.post('/api/scripts', async (request, reply) => {
        try {
            const { name, content } = request.body;

            if (!name || !content) {
                return reply.code(400).send({ error: 'Name and content are required' });
            }

            // Validate script name
            if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
                return reply.code(400).send({
                    error: 'Invalid script name. Use only alphanumeric characters, hyphens, and underscores.'
                });
            }

            // Check if already exists
            const existing = db.getScript(name);
            if (existing) {
                return reply.code(409).send({ error: 'Script already exists' });
            }

            // Validate syntax before saving
            try {
                await validateScriptSyntax(content);
            } catch (validationErr) {
                return reply.code(400).send({
                    error: 'Script syntax error',
                    details: validationErr.message
                });
            }

            // Create script in DB
            db.createScript({
                name,
                content,
                description: '',
                tags: [],
                pathPattern: ''
            });

            // Force reload in script loader
            await scriptLoader.loadAllScripts();

            return {
                success: true,
                message: 'Script created successfully',
                name
            };
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    // Update existing script
    fastify.put('/api/scripts/:name', async (request, reply) => {
        try {
            const { name } = request.params;
            const { content } = request.body;

            if (!content) {
                return reply.code(400).send({ error: 'Content is required' });
            }

            const existing = db.getScript(name);
            if (!existing) {
                return reply.code(404).send({ error: 'Script not found' });
            }

            // Validate syntax before saving
            try {
                await validateScriptSyntax(content);
            } catch (validationErr) {
                return reply.code(400).send({
                    error: 'Script syntax error',
                    details: validationErr.message
                });
            }

            // Update script in DB
            db.updateScript(name, {
                content,
                description: existing.description,
                tags: existing.tags,
                pathPattern: existing.pathPattern
            });

            // Force reload in script loader
            await scriptLoader.loadAllScripts();

            return {
                success: true,
                message: 'Script updated successfully',
                name
            };
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    // Delete script
    fastify.delete('/api/scripts/:name', async (request, reply) => {
        try {
            const { name } = request.params;

            const script = db.getScript(name);
            if (!script) {
                return reply.code(404).send({ error: 'Script not found' });
            }

            db.deleteScript(script.id);

            // Force reload in script loader
            await scriptLoader.loadAllScripts();

            return {
                success: true,
                message: 'Script deleted successfully',
                name
            };
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    // Preview transformation (sandbox test)
    fastify.post('/api/scripts/preview', async (request, reply) => {
        try {
            const { scriptName, sampleData } = request.body;

            if (!scriptName) {
                return reply.code(400).send({ error: 'scriptName is required' });
            }

            const script = scriptLoader.getScript(scriptName);
            if (!script) {
                return reply.code(404).send({ error: 'Script not found' });
            }

            // Run transformation in sandbox
            const result = await runInSandbox(script, sampleData || {});

            return result;
        } catch (err) {
            reply.code(500).send({
                error: 'Preview failed',
                details: err.message
            });
        }
    });
}

/**
 * Validate script syntax by attempting to parse it
 */
async function validateScriptSyntax(content) {
    try {
        // Use a simple syntax check
        new Function(content);
        return true;
    } catch (err) {
        // If Function constructor fails, try wrapping as module
        try {
            if (content.includes('export default')) {
                const wrappedCode = content.replace(/export\s+default\s+/, 'return ');
                new Function(wrappedCode);
                return true;
            }
            throw err;
        } catch (secondErr) {
            throw new Error(`Syntax error: ${err.message}`);
        }
    }
}

/**
 * Run transformation in sandbox for preview
 */
async function runInSandbox(script, sampleData) {
    const result = {
        headers: sampleData.headers || {},
        params: sampleData.params || {},
        body: sampleData.body || null
    };

    const transformed = {
        headers: result.headers,
        params: result.params,
        body: result.body
    };

    const applied = {
        transformHeaders: false,
        transformParams: false,
        transformBody: false
    };

    try {
        if (typeof script.transformHeaders === 'function') {
            transformed.headers = await script.transformHeaders(result.headers, sampleData.metadata || {});
            applied.transformHeaders = true;
        }

        if (typeof script.transformParams === 'function') {
            transformed.params = await script.transformParams(result.params, sampleData.metadata || {});
            applied.transformParams = true;
        }

        if (typeof script.transformBody === 'function') {
            transformed.body = await script.transformBody(result.body, sampleData.metadata || {});
            applied.transformBody = true;
        }

        return {
            original: sampleData,
            transformed,
            applied
        };
    } catch (err) {
        throw new Error(`Transformation error: ${err.message}`);
    }
}
