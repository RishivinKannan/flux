import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Import our modules
import scriptLoader from './lib/script-loader.js';
// import transformationEngine from './lib/transformation-engine.js'; // Not needed in main process anymore
// import Distributor from './lib/distributor.js'; // Moved to worker
import scriptsRoutes from './api/scripts.js';
import targetsRoutes from './api/targets.js';
import dataTransferRoutes from './api/data-transfer.js';
import { Worker } from 'worker_threads';
import logger from './lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import db from './lib/database.js';

// Initialize Express
const app = express();

// Enable CORS
app.use(cors({
    origin: true,
    credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Register scripts API routes
app.use(scriptsRoutes);

// Register targets API routes
app.use(targetsRoutes);

// Register data transfer API routes (export/import)
app.use(dataTransferRoutes);

// Initialize script loader
await scriptLoader.initialize();

// Health check endpoint
app.get('/health', async (req, res) => {
    const targets = db.getAllTargets();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        targets: targets.length,
        scripts: scriptLoader.getAllScripts().length
    });
});

// Info endpoint
app.get('/api/info', async (req, res) => {
    const targets = db.getAllTargets();
    const port = db.getConfig('port') || 4000;
    const timeout = db.getConfig('requestTimeout') || 30000;

    res.json({
        version: '2.0.0',
        targets: targets.map(t => ({
            baseUrl: t.baseUrl,
            hasLicenseKey: !!(t.metadata && t.metadata.licenseKey)
        })),
        scripts: scriptLoader.getAllScripts(),
        config: {
            port,
            timeout
        }
    });
});

// Serve static files (for UI in production)
// Moved to the end to avoid conflict with API routes
app.use(express.static(path.join(__dirname, '../ui/dist')));

// SPA Catch-all route: For any request that isn't an API call or static file,
// serve index.html so client-side routing works
app.get(/.*/, (req, res) => {
    // Don't intercept API calls that slipped through (shouldn't happen if API routes are registered first)
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.sendFile(path.join(__dirname, '../ui/dist/index.html'));
});

// Start server
const start = async () => {
    try {
        // Main API/UI server runs on 4001
        const port = 4001;
        serverInstance = app.listen(port, '0.0.0.0', () => {
            console.log('\\n✨ Management Server Started ✨');
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`🚀 Management API: http://localhost:${port}`);
            console.log(`📝 Scripts loaded: ${scriptLoader.getAllScripts().length}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n`);
        });

        // Start Proxy Worker
        console.log('Starting Proxy Worker...');
        const worker = new Worker(path.join(__dirname, 'proxy-worker.js'));

        worker.on('message', (msg) => {
            logger.info('[Worker]', msg);
        });

        worker.on('error', (err) => {
            logger.error('[Worker Error]', err);
        });

        worker.on('exit', (code) => {
            if (code !== 0)
                logger.error(new Error(`Worker stopped with exit code ${code}`));
        });

    } catch (err) {
        logger.error('Failed to start server:', err);
        process.exit(1);
    }
};

// Handle shutdown gracefully
let serverInstance;
process.on('SIGINT', async () => {
    logger.info('\n\n👋 Gracefully shutting down...');
    if (serverInstance) {
        serverInstance.close(() => {
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

start();
