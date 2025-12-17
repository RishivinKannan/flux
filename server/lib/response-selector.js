import logger from './logger.js';

/**
 * Response Selector Service
 * Implements different strategies for selecting which response to return to the client
 */
class ResponseSelector {
    /**
     * Select a response based on the configured strategy
     * @param {Object} results - Aggregated results from all targets
     * @param {Object} config - Response selection configuration
     * @param {Object} metadata - Additional metadata (timestamps, etc.)
     * @returns {Object} Selected response
     */
    selectResponse(results, config, metadata = {}) {
        if (!config || !config.enabled) {
            // Feature disabled, default to returning first available but with proper structure
            // If we don't pick a response, proxy-worker fails.
            // So we reuse selectFirstAvailable as a safe default.
            const defaultResponse = this.selectFirstAvailable(results);
            return {
                response: {
                    selectedTarget: defaultResponse.selectedTarget,
                    strategy: 'default',
                    ...defaultResponse
                },
                targets: results
            };
        }

        logger.info(`[Response Selector] Applying strategy: ${config.strategy}`);

        let selectedResponse;

        switch (config.strategy) {
            case 'specific':
                selectedResponse = this.selectSpecificTarget(results, config);
                break;

            case 'mock':
                selectedResponse = this.selectMockResponse(config, results);
                break;

            case 'first':
            default:
                // Default to first response strategy
                selectedResponse = this.selectFirstResponse(results, metadata);
                break;
        }

        // Always include the full results for debugging/logging
        return {
            response: selectedResponse,
            targets: results
        };
    }

    /**
     * Select response from a specific target
     */
    selectSpecificTarget(results, config) {
        if (!config.selectedTargetId) {
            logger.warn('[Response Selector] No target ID specified for "specific" strategy, returning first available');
            return this.selectFirstAvailable(results);
        }

        // Find the target by ID in results
        // The results object uses nickname or hostname as keys, so we need to find the matching one
        const targetResponse = Object.entries(results).find(([key, value]) => {
            // Check if the key matches the selected target ID or nickname
            return value.targetId === config.selectedTargetId;
        });

        if (targetResponse) {
            const [targetName, response] = targetResponse;
            logger.info(`[Response Selector] Selected response from target: ${targetName}`);
            return {
                selectedTarget: targetName,
                strategy: 'specific',
                ...response
            };
        }

        // Target not found or failed, fall back to first available
        logger.warn(`[Response Selector] Target ${config.selectedTargetId} not found or failed, returning first available`);
        return this.selectFirstAvailable(results);
    }

    /**
     * Select the first successful response based on timestamps
     */
    selectFirstResponse(results, metadata) {
        const timestamps = metadata.timestamps || {};

        // Find successful responses
        const successfulResults = Object.entries(results).filter(([_, response]) => {
            return response.status >= 200 && response.status < 300;
        });

        if (successfulResults.length === 0) {
            logger.warn('[Response Selector] No successful responses, returning first available');
            return this.selectFirstAvailable(results);
        }

        // Sort by timestamp (earliest first)
        const sortedResults = successfulResults.sort((a, b) => {
            const timeA = timestamps[a[0]] || Infinity;
            const timeB = timestamps[b[0]] || Infinity;
            return timeA - timeB;
        });

        const [targetName, response] = sortedResults[0];
        logger.info(`[Response Selector] Selected first response from: ${targetName}`);

        return {
            selectedTarget: targetName,
            strategy: 'first',
            ...response
        };
    }

    /**
     * Return user-defined mock response
     * @param {Object} config - Response config with mockResponse and mockForce
     * @param {Object} results - Aggregated target results for force logic
     */
    selectMockResponse(config, results = {}) {
        if (!config.mockResponse) {
            logger.warn('[Response Selector] No mock response configured, returning default mock');
            return {
                strategy: 'mock',
                status: 200,
                statusText: 'OK',
                body: { message: 'Mock response (not configured)' }
            };
        }

        // Check if force is enabled (default: true)
        const forceEnabled = config.mockForce !== false;

        if (forceEnabled) {
            // Force ON: Always return mock response regardless of target success/failure
            logger.info('[Response Selector] Force ON - Returning mock response');
            return {
                strategy: 'mock',
                status: config.mockResponse.status || 200,
                statusText: config.mockResponse.statusText || 'OK',
                headers: config.mockResponse.headers || {},
                body: config.mockResponse.body || {}
            };
        }

        // Force OFF: Only return mock if at least one target succeeded
        const entries = Object.entries(results);
        const hasSuccessfulResponse = entries.some(([_, response]) =>
            response.status >= 200 && response.status < 300
        );

        if (hasSuccessfulResponse) {
            // At least one target succeeded, return mock
            logger.info('[Response Selector] Force OFF - At least one target succeeded, returning mock');
            return {
                strategy: 'mock',
                status: config.mockResponse.status || 200,
                statusText: config.mockResponse.statusText || 'OK',
                headers: config.mockResponse.headers || {},
                body: config.mockResponse.body || {}
            };
        }

        // No successful responses, return last target response
        if (entries.length > 0) {
            const [lastTargetName, lastResponse] = entries[entries.length - 1];
            logger.info(`[Response Selector] Force OFF - No successful targets, returning last response from: ${lastTargetName}`);
            return {
                selectedTarget: lastTargetName,
                strategy: 'mock-fallback',
                ...lastResponse
            };
        }

        // No results at all, return error
        return {
            strategy: 'mock',
            status: 503,
            statusText: 'Service Unavailable',
            body: { error: 'No target responses available' }
        };
    }

    /**
     * Fallback: select first available response (successful or not)
     */
    selectFirstAvailable(results) {
        const entries = Object.entries(results);
        if (entries.length === 0) {
            return {
                status: 503,
                statusText: 'Service Unavailable',
                body: { error: 'No responses available' }
            };
        }

        const [targetName, response] = entries[0];
        logger.info(`[Response Selector] Fallback to first available: ${targetName}`);

        return {
            selectedTarget: targetName,
            strategy: 'fallback',
            ...response
        };
    }
}

export default new ResponseSelector();
