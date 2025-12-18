import express from 'express';
import db from '../lib/database.js';
import scriptLoader from '../lib/script-loader.js';
import logger from '../lib/logger.js';

const router = express.Router();

/**
 * Data Transfer API - Export/Import scripts, targets, and config
 */

// Export all data
router.get('/api/export', async (req, res) => {
    try {
        const scripts = db.getAllScripts();
        const targets = db.getAllTargets();
        const config = db.getAllConfig();

        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            data: {
                scripts: scripts.map(s => ({
                    name: s.name,
                    content: s.content,
                    description: s.description,
                    tags: s.tags,
                    pathPattern: s.pathPattern,
                    responseConfig: s.responseConfig
                })),
                targets: targets.map(t => ({
                    id: t.id,
                    nickname: t.nickname,
                    baseUrl: t.baseUrl,
                    tags: t.tags,
                    metadata: t.metadata
                })),
                config: config
            }
        };

        res.json(exportData);
    } catch (err) {
        logger.error(`Export failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Import data
router.post('/api/import', async (req, res) => {
    try {
        const { data, mode = 'merge' } = req.body;

        if (!data) {
            return res.status(400).json({ error: 'No data provided' });
        }

        const results = {
            scripts: { imported: 0, skipped: 0 },
            targets: { imported: 0, skipped: 0 },
            config: { imported: 0, skipped: 0 }
        };

        // Import scripts
        if (data.scripts && Array.isArray(data.scripts)) {
            for (const script of data.scripts) {
                if (!script.name || !script.content) continue;

                const existing = db.getScript(script.name);

                if (existing) {
                    if (mode === 'replace') {
                        db.updateScript(script.name, {
                            content: script.content,
                            description: script.description || '',
                            tags: script.tags || [],
                            pathPattern: script.pathPattern || '',
                            responseConfig: script.responseConfig || {}
                        });
                        results.scripts.imported++;
                    } else {
                        results.scripts.skipped++;
                    }
                } else {
                    db.createScript({
                        name: script.name,
                        content: script.content,
                        description: script.description || '',
                        tags: script.tags || [],
                        pathPattern: script.pathPattern || '',
                        responseConfig: script.responseConfig || {}
                    });
                    results.scripts.imported++;
                }
            }
        }

        // Import targets
        if (data.targets && Array.isArray(data.targets)) {
            for (const target of data.targets) {
                if (!target.nickname || !target.baseUrl) continue;

                const existing = target.id ? db.getTarget(target.id) : null;

                if (existing) {
                    if (mode === 'replace') {
                        db.updateTarget(target.id, {
                            nickname: target.nickname,
                            baseUrl: target.baseUrl,
                            tags: target.tags || [],
                            metadata: target.metadata || {}
                        });
                        results.targets.imported++;
                    } else {
                        results.targets.skipped++;
                    }
                } else {
                    const newId = target.id || `target-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    db.createTarget({
                        id: newId,
                        nickname: target.nickname,
                        baseUrl: target.baseUrl,
                        tags: target.tags || [],
                        metadata: target.metadata || {}
                    });
                    results.targets.imported++;
                }
            }
        }

        // Import config
        if (data.config && typeof data.config === 'object') {
            for (const [key, value] of Object.entries(data.config)) {
                const existing = db.getConfig(key);

                if (existing !== null) {
                    if (mode === 'replace') {
                        db.setConfig(key, value);
                        results.config.imported++;
                    } else {
                        results.config.skipped++;
                    }
                } else {
                    db.setConfig(key, value);
                    results.config.imported++;
                }
            }
        }

        // Reload scripts to apply changes
        await scriptLoader.loadAllScripts();

        logger.info(`Import completed: ${JSON.stringify(results)}`);

        res.json({
            success: true,
            message: 'Import completed successfully',
            results
        });
    } catch (err) {
        logger.error(`Import failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

export default router;
