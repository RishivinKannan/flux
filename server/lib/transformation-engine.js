import scriptLoader from './script-loader.js';
import logger from './logger.js';

class TransformationEngine {
    /**
     * Apply all transformations to the request
     * @param {Object} request - Original request
     * @param {string} scriptName - Optional script name
     * @param {Object} targetMetadata - Target-specific metadata (e.g., licenseKey)
     */
    async transform(request, scriptName = null, targetMetadata = {}) {
        const result = {
            headers: { ...request.headers },
            params: { ...request.params },
            body: (request.headers['content-type'] && request.headers['content-type'].includes('application/json')) ? JSON.parse(JSON.stringify(request.body)) : request.body
        };

        // If no script specified, try to use first available or skip
        let script;
        if (scriptName) {
            script = scriptLoader.getScript(scriptName);
            if (!script) {
                logger.warn(`Script "${scriptName}" not found, skipping transformations`);
                return result;
            }
        } else {
            const scripts = scriptLoader.getAllScripts();

            for (const name of scripts) {
                script = scriptLoader.getScript(name);
                logger.debug(`Using script: ${name}`);
                break;
            }

            if (!script) {
                logger.debug('No matching transformation script found for this path');
                return result;
            }
        }

        // Apply transformations safely
        try {
            if (typeof script.transformHeaders === 'function') {
                result.headers = await this.safeExecute(
                    script.transformHeaders,
                    result.headers,
                    'transformHeaders',
                    targetMetadata
                );
            }

            if (typeof script.transformParams === 'function') {
                result.params = await this.safeExecute(
                    script.transformParams,
                    result.params,
                    'transformParams',
                    targetMetadata
                );
            }

            if (typeof script.transformBody === 'function' && result.body !== null) {
                result.body = await this.safeExecute(
                    script.transformBody,
                    result.body,
                    'transformBody',
                    targetMetadata
                );
            }
        } catch (err) {
            logger.error('Transformation error:', err);
            throw err;
        }

        return result;
    }

    /**
     * Safely execute a transformation function
     */
    async safeExecute(fn, data, fnName, metadata = {}) {
        try {
            return await fn(data, metadata);
        } catch (err) {
            logger.error(`Error in ${fnName}:`, err.message);
            // Return original data on error
            return data;
        }
    }

    /**
     * Test transformation with sample data (for preview)
     */
    async preview(scriptName, sampleData) {
        const script = scriptLoader.getScript(scriptName);
        if (!script) {
            throw new Error(`Script "${scriptName}" not found`);
        }

        const result = {
            headers: sampleData.headers || {},
            params: sampleData.params || {},
            body: sampleData.body || null
        };

        const transformations = {
            headers: { applied: false, result: result.headers },
            params: { applied: false, result: result.params },
            body: { applied: false, result: result.body }
        };

        // Apply each transformation
        if (typeof script.transformHeaders === 'function') {
            transformations.headers.result = await this.safeExecute(
                script.transformHeaders,
                result.headers,
                'transformHeaders'
            );
            transformations.headers.applied = true;
        }

        if (typeof script.transformParams === 'function') {
            transformations.params.result = await this.safeExecute(
                script.transformParams,
                result.params,
                'transformParams'
            );
            transformations.params.applied = true;
        }

        if (typeof script.transformBody === 'function') {
            transformations.body.result = await this.safeExecute(
                script.transformBody,
                result.body,
                'transformBody'
            );
            transformations.body.applied = true;
        }

        return {
            original: sampleData,
            transformed: {
                headers: transformations.headers.result,
                params: transformations.params.result,
                body: transformations.body.result
            },
            applied: {
                transformHeaders: transformations.headers.applied,
                transformParams: transformations.params.applied,
                transformBody: transformations.body.applied
            }
        };
    }
}

export default new TransformationEngine();
