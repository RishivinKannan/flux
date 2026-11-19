import transformationEngine from './transformation-engine.js';
import { gunzip, gzip } from 'zlib';
import { promisify } from 'util';
import logger from './logger.js';
import responseSelector from './response-selector.js';
import db from './database.js';

const gunzipAsync = promisify(gunzip);
const gzipAsync = promisify(gzip);

// Module-level because proxy-worker rebuilds the Distributor on every config reload
const inFlightByTarget = new Map();

class Distributor {
    constructor(config) {
        this.targets = config.targets;
        this.timeout = config.requestTimeout || 30000;
        const cap = Number(config.maxInFlightPerTarget);
        this.maxInFlightPerTarget = Number.isFinite(cap) && cap >= 1 ? Math.floor(cap) : 200;
        const scriptTimeout = Number(config.scriptTimeout);
        this.scriptTimeout = Number.isFinite(scriptTimeout) && scriptTimeout > 0 ? scriptTimeout : 5000;
    }

    async withScriptTimeout(work, target) {
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(
                () => reject(new Error(`Transformation scripts for ${target.nickname || target.baseUrl} timed out after ${this.scriptTimeout}ms`)),
                this.scriptTimeout
            );
        });
        try {
            return await Promise.race([work, timeout]);
        } finally {
            clearTimeout(timer);
        }
    }

    acquireSlot(target) {
        const active = inFlightByTarget.get(target.id) || 0;
        if (active >= this.maxInFlightPerTarget) {
            return false;
        }
        inFlightByTarget.set(target.id, active + 1);
        return true;
    }

    releaseSlot(target) {
        const active = (inFlightByTarget.get(target.id) || 1) - 1;
        if (active > 0) {
            inFlightByTarget.set(target.id, active);
        } else {
            inFlightByTarget.delete(target.id);
        }
    }

    /**
     * Build a unique display key for a target to avoid key collisions when nicknames match
     */
    getTargetKey(target) {
        const baseName = target.nickname || new URL(target.baseUrl).hostname;
        const tagsStr = Array.isArray(target.tags) && target.tags.length > 0 ? ` [${target.tags.join(', ')}]` : '';
        return `${baseName}${tagsStr}`;
    }

    /**
     * Broadcast request to all configured targets simultaneously
     */
    async broadcast(originalRequest, originalReq) {
        const timestamps = {};
        const startTime = Date.now();
        const requestPath = originalReq?.path || "/";
        // Get matching scripts for this request to find response config
        const scriptLoader = await import('./script-loader.js');
        const matchingScriptNames = scriptLoader.default.getScriptsForPath(requestPath);

        // Find first script with enabled response config
        let activeResponseConfig = null;
        for (const scriptName of matchingScriptNames) {
            const script = db.getScript(scriptName);
            if (script && script.responseConfig && script.responseConfig.enabled) {
                activeResponseConfig = {
                    ...script.responseConfig,
                    selectedTargetId: script.responseConfig.targetId  // Alias for compatibility
                };
                logger.info(`[Distributor] Using response config from script: ${scriptName}`);
                break;
            }
        }

        const requireScriptMatch = db.getConfig('requireScriptMatch') === true;

        const settled = {};
        let responded = false;
        let resolveResponse;
        let rejectResponse;
        const responsePromise = new Promise((resolve, reject) => {
            resolveResponse = resolve;
            rejectResponse = reject;
        });

        const respond = (results) => {
            responded = true;
            try {
                resolveResponse(responseSelector.selectResponse(results, activeResponseConfig, { timestamps }).response);
            } catch (err) {
                rejectResponse(err);
            }
        };

        const respondIfDecided = () => {
            if (!responded && responseSelector.canDecide(settled, activeResponseConfig)) {
                respond({ ...settled });
            }
        };

        respondIfDecided();

        const tasks = this.targets.map((target) => {
            const key = this.getTargetKey(target);
            const record = (entry) => {
                timestamps[key] = Date.now() - startTime;
                settled[key] = entry;
                respondIfDecided();
                return { key, entry };
            };

            if (requireScriptMatch) {
                const matching = scriptLoader.default.getMatchingScriptsForTarget(requestPath, target.tags || []);
                if (!matching || matching.length === 0) {
                    logger.info(`🚫 [Distributor] Skipping target "${key}": no matching script for path "${requestPath}" (Strict Mode enabled)`);
                    return Promise.resolve(record({ status: 0, error: 'Skipped: No matching script for target', body: null, targetId: target.id, skipped: true }));
                }
            }

            if (!this.acquireSlot(target)) {
                logger.warn(`⚠️ [Distributor] Dropping target "${key}": ${this.maxInFlightPerTarget} requests already in flight`);
                return Promise.resolve(record({ status: 0, error: 'Dropped: in-flight limit reached', body: null, targetId: target.id, dropped: true }));
            }

            return this.sendToTarget(target, originalRequest, originalReq)
                .then(
                    result => ({ ...result, targetId: target.id }),
                    error => ({ status: 0, error: error.message, body: null, targetId: target.id })
                )
                .finally(() => this.releaseSlot(target))
                .then(record);
        });

        const completion = Promise.all(tasks).then((entries) => {
            const aggregated = {};
            for (const { key, entry } of entries) {
                aggregated[key] = entry;
            }
            if (!responded) {
                respond(aggregated);
            }
            return aggregated;
        });

        return { response: await responsePromise, completion };
    }

    /**
     * Send request to a single target
     */
    async sendToTarget(target, originalRequest, originalReq) {
        try {
            logger.debug(`🔄 Transforming for ${target.nickname || target.baseUrl}...`);

            // Start with original request
            let transformedRequest = {
                headers: { ...originalRequest.headers },
                params: { ...originalRequest.params },
                body: originalRequest.body,
            };

            // Get all scripts that match this target's tags
            const scriptLoader = await import('./script-loader.js');
            const matchingScripts = scriptLoader.default.getScriptsForTags(target.tags || []);

            logger.debug(`  → Running ${matchingScripts.length} script(s): ${matchingScripts.join(', ')}`);

            const appliedScripts = [];
            const skippedScripts = [];

            // Apply each matching script sequentially
            const runScripts = async () => {
                for (const scriptName of matchingScripts) {
                    // Check if script has a path pattern
                    const metadata = scriptLoader.default.getScriptMetadata(scriptName);
                    if (metadata && metadata.pathPattern) {
                        if (!scriptLoader.default.matchPathPattern(metadata.pathPattern, originalReq.path)) {
                            logger.debug(`  Skipping script ${scriptName} (Path pattern mismatch: ${metadata.pathPattern} vs ${originalReq.path})`);
                            skippedScripts.push({ name: scriptName, reason: `path pattern mismatch (${metadata.pathPattern})` });
                            continue;
                        }
                    }

                    transformedRequest = await transformationEngine.transform(
                        transformedRequest,
                        scriptName,
                        target.metadata || {}
                    );
                    appliedScripts.push(scriptName);
                }
            };
            await this.withScriptTimeout(runScripts(), target);

            if (process.env.LOG_VERBOSE === 'true' || process.env.LOG_VERBOSE?.toLowerCase() === 'true') {
                const tagsStr = Array.isArray(target.tags) ? target.tags.join(', ') : (target.tags || 'none');
                logger.verbose(`\n🔍 [LOG_VERBOSE] Transformed Request Data for Target (${target.nickname || target.baseUrl}) [Tags: ${tagsStr}]:`);
                logger.verbose('  Tags:', target.tags || []);
                logger.verbose('  Applied Scripts:', appliedScripts.length > 0 ? appliedScripts : 'None');
                if (skippedScripts.length > 0) {
                    logger.verbose('  Skipped Scripts:', skippedScripts.map(s => `${s.name} (${s.reason})`).join(', '));
                }
                logger.verbose('  Headers:', JSON.stringify(transformedRequest.headers, null, 2));
                logger.verbose('  Params:', JSON.stringify(transformedRequest.params, null, 2));
                logger.verbose('  Body:', typeof transformedRequest.body === 'object' && transformedRequest.body !== null && !Buffer.isBuffer(transformedRequest.body)
                    ? JSON.stringify(transformedRequest.body, null, 2)
                    : (Buffer.isBuffer(transformedRequest.body) ? transformedRequest.body.toString('utf-8') : transformedRequest.body));
            }

            // Build the target URL
            const url = this.buildUrl(
                target.baseUrl,
                originalReq.path,
                transformedRequest.params
            );

            // Prepare fetch options
            const options = {
                method: originalReq.method,
                headers: this.cleanHeaders(transformedRequest.headers),
                signal: AbortSignal.timeout(this.timeout)
            };

            // Add body for methods that support it
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(originalReq.method.toUpperCase()) && transformedRequest.body) {

                let jsonBody = transformedRequest.body;

                // If body is an object and NOT a buffer, stringify it
                if (typeof jsonBody === 'object' && !Buffer.isBuffer(jsonBody)) {
                    jsonBody = JSON.stringify(jsonBody);
                }

                // Send as plain JSON
                options.body = jsonBody;

                // Remove existing content-type/length to avoid duplicates
                const headerKeys = Object.keys(options.headers);
                headerKeys.forEach(key => {
                    if (key.toLowerCase() === 'content-length') {
                        delete options.headers[key];
                    }
                });
                options.headers['Content-Length'] = Buffer.byteLength(jsonBody).toString();
            }

            logger.info(`→ Broadcasting to ${url}`);
            logger.debug(`  Method: ${options.method}, Headers:`, JSON.stringify(options.headers, null, 2));



            // Send the request
            const response = await fetch(url, options);

            logger.info(`✓ Response from ${target.baseUrl}: ${response.status} ${response.statusText}`);

            // Parse response
            let body;
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                const text = await response.text();
                try {
                    body = text ? JSON.parse(text) : {}; // Handle empty body
                } catch (e) {
                    logger.warn(`Failed to parse JSON body from ${target.baseUrl}: ${e.message}`);
                    body = text; // Fallback to text
                }
            } else {
                body = await response.text();
            }

            return {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body
            };

        } catch (err) {
            logger.error(`✗ Failed request to ${target.baseUrl}:`, err.message);
            if (err.cause) {
                logger.error(`  Cause:`, err.cause);
            }
            logger.error(`  Error details:`, err.stack);
            throw err;
        }
    }

    /**
     * Build complete URL with query parameters
     */
    buildUrl(baseUrl, path, params) {
        // Remove trailing slash from baseUrl and leading slash from path to avoid double slashes
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const cleanPath = path.startsWith('/') ? path : '/' + path;

        const url = new URL(cleanPath, cleanBaseUrl);

        // Add query parameters
        if (params && typeof params === 'object') {
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.set(key, value);
            });
        }

        return url.toString();
    }

    /**
     * Clean headers for forwarding (remove problematic headers)
     */
    cleanHeaders(headers) {
        const cleaned = { ...headers };

        // Remove headers that shouldn't be forwarded
        const removeHeaders = [
            'host',
            'connection',
            'keep-alive',
            'transfer-encoding',
            'upgrade',
            'content-length',
            'content-encoding'
        ];

        removeHeaders.forEach(header => {
            delete cleaned[header];
            delete cleaned[header.toLowerCase()];
        });

        return cleaned;
    }
}

export default Distributor;
