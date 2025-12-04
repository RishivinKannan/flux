import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Import our modules
import scriptLoader from './lib/script-loader.js';
// import transformationEngine from './lib/transformation-engine.js'; // Not needed in main process anymore
// import Distributor from './lib/distributor.js'; // Moved to worker
import scriptsRoutes from './api/scripts.js';
import targetsRoutes from './api/targets.js';
import { Worker } from 'worker_threads';
import logger from './lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import db from './lib/database.js';

// Initialize Fastify
const fastify = Fastify({
    logger: false // Disable default fastify logger to use our own if needed, or keep it true but it might be noisy
});

// Enable CORS
await fastify.register(fastifyCors, {
    origin: true,
    credentials: true
});

// Custom content type parser to ignore Content-Length mismatch
// This is needed because some clients might send incorrect Content-Length headers
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
    try {
        var json = JSON.parse(body);
        done(null, json);
    } catch (err) {
        err.statusCode = 400;
        done(err, undefined);
    }
});



// Register scripts API routes
await fastify.register(scriptsRoutes);

// Register targets API routes
await fastify.register(targetsRoutes);

// Initialize script loader
await scriptLoader.initialize();

// Health check endpoint
fastify.get('/health', async (request, reply) => {
    const targets = db.getAllTargets();
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        targets: targets.length,
        scripts: scriptLoader.getAllScripts().length
    };
});

// Info endpoint
fastify.get('/api/info', async (request, reply) => {
    const targets = db.getAllTargets();
    const port = db.getConfig('port') || 4000;
    const timeout = db.getConfig('requestTimeout') || 30000;

    return {
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
    };
});

// Serve static files (for UI in production)
// Moved to the end to avoid conflict with /track/* wildcard route
await fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../ui/dist'),
    prefix: '/'
});

// Start server
// Start server
const start = async () => {
    try {
        // Main API/UI server runs on 4001
        const port = 4001;
        await fastify.listen({ port, host: '0.0.0.0' });

        console.log('\n✨ Management Server Started ✨');
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🚀 Management API: http://localhost:${port}`);
        console.log(`📝 Scripts loaded: ${scriptLoader.getAllScripts().length}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

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
process.on('SIGINT', async () => {
    logger.info('\n\n👋 Gracefully shutting down...');
    await fastify.close();
    process.exit(0);
});

start();
