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
            // Feature disabled, return all results (backward compatibility)
            return { results };
        }

        logger.info(`[Response Selector] Applying strategy: ${config.strategy}`);

        switch (config.strategy) {
            case 'specific':
                return this.selectSpecificTarget(results, config);

            case 'mock':
                return this.selectMockResponse(config);

            case 'first':
            default:
                // Default to first response strategy
                return this.selectFirstResponse(results, metadata);
        }
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
     */
    selectMockResponse(config) {
        if (!config.mockResponse) {
            logger.warn('[Response Selector] No mock response configured, returning default mock');
            return {
                strategy: 'mock',
                status: 200,
                statusText: 'OK',
                body: { message: 'Mock response (not configured)' }
            };
        }

        logger.info('[Response Selector] Returning mock response');

        return {
            strategy: 'mock',
            status: config.mockResponse.status || 200,
            statusText: config.mockResponse.statusText || 'OK',
            headers: config.mockResponse.headers || {},
            body: config.mockResponse.body || {}
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
