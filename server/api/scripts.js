import express from 'express';
import db from '../lib/database.js';
import scriptLoader from '../lib/script-loader.js';

const router = express.Router();

/**
 * Register script management API routes
 */

// List all scripts
router.get('/api/scripts', async (req, res) => {
    try {
        const scripts = db.getAllScripts();
        res.json({
            scripts: scripts.map(s => ({
                name: s.name,
                filename: `${s.name}.js`, // Keep filename for UI compatibility
                modifiedAt: s.updatedAt
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get specific script content
router.get('/api/scripts/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const script = db.getScript(name);

        if (!script) {
            return res.status(404).json({ error: 'Script not found' });
        }

        res.json({
            name: script.name,
            content: script.content,
            metadata: {
                tags: script.tags || [],
                description: script.description || '',
                pathPattern: script.pathPattern || ''
            },
            responseConfig: script.responseConfig || {
                strategy: 'all',
                targetId: null,
                mockResponse: null,
                enabled: false
            },
            exists: true
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update script metadata (tags, description)
router.put('/api/scripts/:name/metadata', async (req, res) => {
    try {
        const { name } = req.params;
        const { tags, description, pathPattern, responseConfig } = req.body;

        const script = db.getScript(name);
        if (!script) {
            return res.status(404).json({ error: 'Script not found' });
        }

        db.updateScript(name, {
            content: script.content,
            description: description !== undefined ? description : script.description,
            tags: tags !== undefined ? tags : script.tags,
            pathPattern: pathPattern !== undefined ? pathPattern : script.pathPattern,
            responseConfig: responseConfig !== undefined ? responseConfig : script.responseConfig
        });

        // Force reload in script loader
        await scriptLoader.loadAllScripts();

        res.json({
            success: true,
            message: 'Script metadata updated successfully'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new script
router.post('/api/scripts', async (req, res) => {
    try {
        const { name, content } = req.body;

        if (!name || !content) {
            return res.status(400).json({ error: 'Name and content are required' });
        }

        // Validate script name
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            return res.status(400).json({
                error: 'Invalid script name. Use only alphanumeric characters, hyphens, and underscores.'
            });
        }

        // Check if already exists
        const existing = db.getScript(name);
        if (existing) {
            return res.status(409).json({ error: 'Script already exists' });
        }

        // Validate syntax before saving
        try {
            await validateScriptSyntax(content);
        } catch (validationErr) {
            return res.status(400).json({
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

        res.json({
            success: true,
            message: 'Script created successfully',
            name
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update existing script
router.put('/api/scripts/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const existing = db.getScript(name);
        if (!existing) {
            return res.status(404).json({ error: 'Script not found' });
        }

        // Validate syntax before saving
        try {
            await validateScriptSyntax(content);
        } catch (validationErr) {
            return res.status(400).json({
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

        res.json({
            success: true,
            message: 'Script updated successfully',
            name
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete script
router.delete('/api/scripts/:name', async (req, res) => {
    try {
        const { name } = req.params;

        const script = db.getScript(name);
        if (!script) {
            return res.status(404).json({ error: 'Script not found' });
        }

        db.deleteScript(script.id);

        // Force reload in script loader
        await scriptLoader.loadAllScripts();

        res.json({
            success: true,
            message: 'Script deleted successfully',
            name
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Preview transformation (sandbox test)
router.post('/api/scripts/preview', async (req, res) => {
    try {
        const { scriptName, sampleData } = req.body;

        if (!scriptName) {
            return res.status(400).json({ error: 'scriptName is required' });
        }

        const script = scriptLoader.getScript(scriptName);
        if (!script) {
            return res.status(404).json({ error: 'Script not found' });
        }

        // Run transformation in sandbox
        const result = await runInSandbox(script, sampleData || {});

        res.json(result);
    } catch (err) {
        res.status(500).json({
            error: 'Preview failed',
            details: err.message
        });
    }
});

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

export default router;
