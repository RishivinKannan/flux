import transformationEngine from './transformation-engine.js';
import { gunzip, gzip } from 'zlib';
import { promisify } from 'util';

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
        const promises = this.targets.map(target =>
            this.sendToTarget(target, originalRequest, originalReq)
        );

        // Wait for all requests to complete (or fail)
        const results = await Promise.allSettled(promises);

        // Aggregate results by nickname or hostname
        const aggregated = {};

        results.forEach((result, index) => {
            const target = this.targets[index];
            const key = target.nickname || new URL(target.baseUrl).hostname;

            if (result.status === 'fulfilled') {
                aggregated[key] = result.value;
            } else {
                aggregated[key] = {
                    status: 0,
                    error: result.reason.message,
                    body: null
                };
            }
        });

        return { results: aggregated };
    }

    /**
     * Send request to a single target
     */
    async sendToTarget(target, originalRequest, originalReq) {
        try {
            console.log(`🔄 Transforming for ${target.nickname || target.baseUrl}...`);

            // Start with original request
            let transformedRequest = {
                headers: { ...originalRequest.headers },
                params: { ...originalRequest.params },
                body: originalRequest.body ? JSON.parse(JSON.stringify(originalRequest.body)) : null
            };

            // Get all scripts that match this target's tags
            const scriptLoader = await import('./script-loader.js');
            const matchingScripts = scriptLoader.default.getScriptsForTags(target.tags || []);

            console.log(`  → Running ${matchingScripts.length} script(s): ${matchingScripts.join(', ')}`);

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
            if (['POST', 'PUT', 'PATCH'].includes(originalReq.method.toUpperCase())) {
                if (transformedRequest.body) {
                    // Check if we need to gzip the body
                    const isGzipped = transformedRequest.headers['content-encoding'] === 'gzip';

                    const jsonBody = JSON.stringify(transformedRequest.body);

                    if (isGzipped) {
                        // Re-gzip the transformed body
                        const gzippedBody = await gzipAsync(Buffer.from(jsonBody));
                        options.body = gzippedBody;
                        options.headers['Content-Length'] = gzippedBody.length.toString();
                        options.headers['Content-Encoding'] = 'gzip';
                        console.log(`  Re-gzipped body: ${jsonBody.length} bytes → ${gzippedBody.length} bytes`);
                    } else {
                        // Send as plain JSON
                        options.body = jsonBody;
                        options.headers['Content-Type'] = 'application/json';
                        options.headers['Content-Length'] = Buffer.byteLength(jsonBody).toString();
                    }
                }
            }

            console.log(`→ Broadcasting to ${url}`);
            console.log(`  Method: ${options.method}, Headers:`, JSON.stringify(options.headers, null, 2));

            // Send the request
            const response = await fetch(url, options);

            console.log(`✓ Response from ${target.baseUrl}: ${response.status} ${response.statusText}`);

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
            console.error(`✗ Failed request to ${target.baseUrl}:`, err.message);
            if (err.cause) {
                console.error(`  Cause:`, err.cause);
            }
            console.error(`  Error details:`, err.stack);
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
