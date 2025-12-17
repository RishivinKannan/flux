import express from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import scriptLoader from './lib/script-loader.js';
import Distributor from './lib/distributor.js';
import db from './lib/database.js';
import logger from './lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4000;

// Middleware to parse JSON bodies (with loose content-length check)
app.use(express.json({
    limit: '50mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// Also handle text/plain
app.use(express.text({ limit: '50mb' }));

// Handle raw body for other types
app.use(express.raw({ type: '*/*', limit: '50mb' }));

let distributor;
let config;

async function loadConfig() {
    try {
        // Load targets from database
        const targets = db.getAllTargets();
        const port = db.getConfig('port') || 4000;
        const requestTimeout = db.getConfig('requestTimeout') || 30000;
        const scriptTimeout = db.getConfig('scriptTimeout') || 5000;

        config = {
            port,
            targets,
            requestTimeout,
            scriptTimeout
        };

        distributor = new Distributor(config);
        logger.info(`[Proxy Worker] Loaded configuration with ${targets.length} targets`);
    } catch (err) {
        logger.error('[Proxy Worker] Failed to load config:', err);
    }
}

async function initialize() {
    logger.info('[Proxy Worker] Initializing...');

    // Load config
    await loadConfig();

    // Initialize script loader
    await scriptLoader.initialize();

    // Proxy route handler - matches ALL paths
    app.all(/^\/.*/, async (req, res) => {
        const startTime = Date.now();
        console.log(`\n📨 [Proxy Worker] Incoming ${req.method} request to ${req.originalUrl}`);

        if (!distributor) {
            return res.status(503).json({ error: 'Proxy not initialized' });
        }

        try {
            // Extract request components
            const originalRequest = {
                method: req.method,
                path: req.originalUrl.split('?')[0], // Full path without query
                headers: req.headers,
                params: req.query || {},
                body: req.body
            };

            logger.info('📡 [Proxy Worker] Broadcasting to all targets...');
            const results = await distributor.broadcast(originalRequest, originalRequest);

            const duration = Date.now() - startTime;
            const targets = Object.keys(results.targets).join(', ');
            console.log(`✓ [Proxy Worker] Request completed in ${duration}ms (Targets: ${targets})`);

            console.log(results.response.body);
            // Clean headers that might conflict with the new body
            const responseHeaders = { ...results.response.headers };
            delete responseHeaders['content-length'];
            delete responseHeaders['content-encoding'];
            delete responseHeaders['transfer-encoding'];

            res.status(results.response.status).set(responseHeaders).json(results.response.body);

        } catch (err) {
            logger.error('✗ [Proxy Worker] Proxy error:', err);
            res.status(500).json({
                error: 'Proxy error',
                message: err.message
            });
        }
    });

    // Health check for worker
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            worker: true,
            targets: config?.targets?.length || 0
        });
    });

    app.listen(PORT, () => {
        console.log('\n✨ Proxy Worker Started ✨');
        console.log(`🚀 Listening on port ${PORT}`);
        console.log(`Proxy endpoint: http://localhost:${PORT}/track/*`);

        // Poll for configuration changes every 10 seconds
        setInterval(() => {
            loadConfig().catch(err => {
                logger.error('[Proxy Worker] Error reloading config:', err);
            });
        }, 10000);
    });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    logger.info('\n👋 Gracefully shutting down...');
    db.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('\n👋 Gracefully shutting down...');
    db.close();
    process.exit(0);
});

// Start the worker
initialize().catch(err => {
    logger.error('[Proxy Worker] Fatal error:', err);
    process.exit(1);
});
