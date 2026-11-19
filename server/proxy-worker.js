import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parentPort } from 'worker_threads';
import { setTimeout as sleep } from 'timers/promises';
import scriptLoader from './lib/script-loader.js';
import Distributor from './lib/distributor.js';
import db from './lib/database.js';
import logger from './lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4000;

app.use((_req, res, next) => {
    trackPending(new Promise(resolve => res.on('close', resolve)));
    next();
});

// Browser agents (RUM) call this from the app's own origin, never flux's own —
// same CORS config as server.js's admin API, needed here too since this is the
// process that actually handles /v1/browser/* and every other ingest path.
app.use(cors({
    origin: true,
    credentials: true
}));

// Middleware to parse JSON bodies (with loose content-length check)
app.use(express.json({
    limit: '50mb'
}));

// Also handle text/plain
app.use(express.text({ type: ['application/x-ndjson', 'application/logplex-1', 'text/plain'], limit: '50mb' }));

// Handle raw body for other types
app.use(express.raw({ type: '*/*', limit: '50mb' }));

let distributor;
let config;
let server;
let shuttingDown = false;
const pendingWork = new Map();

function trackPending(promise) {
    // Errors surface through the request handler; this copy only tracks settlement for the shutdown drain
    const settled = promise.then(() => {}, () => {});
    pendingWork.set(settled, Date.now() + (distributor ? distributor.timeout + distributor.scriptTimeout : 35000));
    settled.then(() => pendingWork.delete(settled));
}

function logForwardOutcome(allResults, duration, respondedIn) {
    const targetsWhere = (predicate) => Object.entries(allResults)
        .filter(([_, res]) => res && predicate(res))
        .map(([name]) => name);

    const processedTargets = targetsWhere(res => !res.skipped && !res.dropped);
    const ignoredTargets = targetsWhere(res => res.skipped);
    const droppedTargets = targetsWhere(res => res.dropped);

    if (processedTargets.length === 0 && droppedTargets.length === 0) {
        console.log(`🚫 [Proxy Worker] Request ignored in ${duration}ms (No matching script for target: ${formatTargetsForLogs(ignoredTargets)})`);
        return;
    }

    if (processedTargets.length > 0) {
        console.log(`✓ [Proxy Worker] Request completed in ${duration}ms, responded in ${respondedIn}ms (Targets: ${formatTargetsForLogs(processedTargets)})`);
    }
    if (ignoredTargets.length > 0) {
        console.log(`ℹ️ [Proxy Worker] Ignored targets (Strict Mode): ${formatTargetsForLogs(ignoredTargets)}`);
    }
    if (droppedTargets.length > 0) {
        console.log(`⚠️ [Proxy Worker] Dropped targets (in-flight limit reached): ${formatTargetsForLogs(droppedTargets)}`);
    }
}

function formatTargetsForLogs(targetNames) {
    if (!Array.isArray(targetNames) || targetNames.length === 0) {
        return '';
    }

    const groups = new Map();

    for (const item of targetNames) {
        if (typeof item !== 'string') continue;

        const match = item.match(/^(.*?)(?:\s*\[([^\]]+)\])$/);
        const baseName = match && match[1] ? match[1].trim() : item.trim();
        const tagStr = match && match[2] ? match[2].trim() : null;

        if (!groups.has(baseName)) {
            groups.set(baseName, new Set());
        }

        if (tagStr) {
            const tags = tagStr.split(',').map(t => t.trim()).filter(Boolean);
            const tagSet = groups.get(baseName);
            tags.forEach(t => tagSet.add(t));
        }
    }

    const formatted = [];
    for (const [baseName, tagSet] of groups.entries()) {
        if (tagSet.size > 0) {
            formatted.push(`${baseName} [${Array.from(tagSet).join(', ')}]`);
        } else {
            formatted.push(baseName);
        }
    }

    return formatted.join(', ');
}

async function loadConfig() {
    try {
        // Load targets from database
        const targets = db.getAllTargets();
        const port = db.getConfig('port') || 4000;
        const requestTimeout = db.getConfig('requestTimeout') || 30000;
        const scriptTimeout = db.getConfig('scriptTimeout') || 5000;
        const maxInFlightPerTarget = db.getConfig('maxInFlightPerTarget');

        config = {
            port,
            targets,
            requestTimeout,
            scriptTimeout,
            maxInFlightPerTarget
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

    // Health check for worker
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            worker: true,
            targets: config?.targets?.length || 0
        });
    });

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
            const forwarding = distributor.broadcast(originalRequest, originalRequest);
            trackPending(forwarding.then(({ completion }) => completion));

            const { response, completion } = await forwarding;
            const respondedIn = Date.now() - startTime;

            completion
                .then(allResults => logForwardOutcome(allResults, Date.now() - startTime, respondedIn))
                .catch(err => logger.error('✗ [Proxy Worker] Forwarding error:', err));

            // Clean headers that might conflict with the new body
            const responseHeaders = { ...(response?.headers || {}) };
            delete responseHeaders['content-length'];
            delete responseHeaders['content-encoding'];
            delete responseHeaders['transfer-encoding'];
            delete responseHeaders['access-control-allow-origin'];
            delete responseHeaders['access-control-allow-credentials'];
            delete responseHeaders['access-control-allow-methods'];
            delete responseHeaders['access-control-allow-headers'];
            delete responseHeaders['access-control-expose-headers'];
            delete responseHeaders['access-control-max-age'];

            const status = response?.status;
            const validStatus = (typeof status === 'number' && status >= 100 && status < 600) ? status : 200;

            res.status(validStatus).set(responseHeaders).json(response?.body ?? {});

        } catch (err) {
            logger.error('✗ [Proxy Worker] Proxy error:', err);
            res.status(500).json({
                error: 'Proxy error',
                message: err.message
            });
        }
    });

    server = app.listen(PORT, () => {
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

async function shutdown() {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;
    logger.info('\n👋 Gracefully shutting down...');
    server?.close();

    const deadline = Math.max(Date.now(), ...pendingWork.values());
    while (pendingWork.size > 0 && Date.now() < deadline) {
        logger.info(`[Proxy Worker] Waiting for ${pendingWork.size} in-flight request(s) and forward(s) to finish...`);
        await Promise.race([Promise.allSettled(pendingWork.keys()), sleep(deadline - Date.now())]);
    }

    db.close();
    process.exit(0);
}

// Signals never reach a worker thread, so server.js relays shutdown as a message
parentPort?.on('message', (msg) => {
    if (msg?.type === 'shutdown') {
        shutdown();
    }
});

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the worker
initialize().catch(err => {
    logger.error('[Proxy Worker] Fatal error:', err);
    process.exit(1);
});
