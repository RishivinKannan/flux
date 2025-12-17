import transformationEngine from './transformation-engine.js';
import { gunzip, gzip } from 'zlib';
import { promisify } from 'util';
import logger from './logger.js';
import responseSelector from './response-selector.js';
import db from './database.js';

const gunzipAsync = promisify(gunzip);
const gzipAsync = promisify(gzip);

class Distributor {
    constructor(config) {
        this.targets = config.targets;
        this.timeout = config.requestTimeout || 30000;
    }

    /**
     * Broadcast request to all configured targets simultaneously
     */
    async broadcast(originalRequest, originalReq) {
        const timestamps = {};
        const startTime = Date.now();

        // Get matching scripts for this request to find response config
        const scriptLoader = await import('./script-loader.js');
        const matchingScriptNames = scriptLoader.default.getScriptsForPath(originalReq.path);

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

        const promises = this.targets.map((target, index) =>
            this.sendToTarget(target, originalRequest, originalReq).then(result => {
                // Track when this response completed
                const key = target.nickname || new URL(target.baseUrl).hostname;
                timestamps[key] = Date.now() - startTime;
                return { result, target, key };
            }).catch(error => {
                const key = target.nickname || new URL(target.baseUrl).hostname;
                timestamps[key] = Date.now() - startTime;
                return { error, target, key };
            })
        );

        // Wait for all requests to complete (or fail)
        const results = await Promise.allSettled(promises);

        // Aggregate results by nickname or hostname
        const aggregated = {};

        results.forEach((result) => {
            if (result.status === 'fulfilled') {
                const { result: targetResult, error, target, key } = result.value;

                if (error) {
                    aggregated[key] = {
                        status: 0,
                        error: error.message,
                        body: null,
                        targetId: target.id
                    };
                } else {
                    aggregated[key] = {
                        ...targetResult,
                        targetId: target.id
                    };
                }
            } else {
                // This shouldn't happen with the new structure, but handle it anyway
                logger.error('[Distributor] Unexpected promise rejection:', result.reason);
            }
        });

        // Apply response selection strategy from matching script
        return responseSelector.selectResponse(
            aggregated,
            activeResponseConfig,
            { timestamps }
        );
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
                body: originalRequest.body ? JSON.parse(JSON.stringify(originalRequest.body)) : null
            };

            // Get all scripts that match this target's tags
            const scriptLoader = await import('./script-loader.js');
            const matchingScripts = scriptLoader.default.getScriptsForTags(target.tags || []);

            logger.debug(`  → Running ${matchingScripts.length} script(s): ${matchingScripts.join(', ')}`);

            // Apply each matching script sequentially
            for (const scriptName of matchingScripts) {
                transformedRequest = await transformationEngine.transform(
                    transformedRequest,
                    scriptName,
                    target.metadata || {}
                );
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
            if (['POST', 'PUT', 'PATCH'].includes(originalReq.method.toUpperCase()) && transformedRequest.body) {
                const isGzipped = transformedRequest.headers['content-encoding'] === 'gzip';

                const jsonBody = JSON.stringify(transformedRequest.body);

                if (isGzipped) {
                    // Re-gzip the transformed body
                    const gzippedBody = await gzipAsync(Buffer.from(jsonBody));
                    options.body = gzippedBody;
                    options.headers['Content-Length'] = gzippedBody.length.toString();
                    options.headers['Content-Encoding'] = 'gzip';
                    logger.debug(`  Re-gzipped body: ${jsonBody.length} bytes → ${gzippedBody.length} bytes`);
                } else {
                    // Send as plain JSON
                    options.body = jsonBody;
                    options.headers['Content-Type'] = 'application/json';
                    options.headers['Content-Length'] = Buffer.byteLength(jsonBody).toString();
                }
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
                body = await response.json();
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
