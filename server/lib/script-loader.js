import db from './database.js';
import { VM } from 'vm2';

class ScriptLoader {
  constructor() {
    this.scripts = new Map();
    this.scriptMetadata = new Map();
  }

  /**
   * Initialize the script loader and start polling for changes
   */
  async initialize() {
    // Load all scripts initially
    await this.loadAllScripts();

    // Start polling for changes
    this.startPolling();
  }

  /**
   * Load all scripts from the database
   */
  async loadAllScripts() {
    try {
      const scripts = db.getAllScripts();
      
      // Clear current scripts to handle deletions
      const currentScriptNames = new Set(scripts.map(s => s.name));
      
      // Remove scripts that no longer exist
      for (const name of this.scripts.keys()) {
        if (!currentScriptNames.has(name)) {
          this.scripts.delete(name);
          this.scriptMetadata.delete(name);
          console.log(`🗑️  Script removed: ${name}`);
        }
      }

      // Update/Add scripts
      for (const script of scripts) {
        await this.loadScript(script);
      }

      console.log(`Loaded ${scripts.length} transformation scripts`);
    } catch (err) {
      console.error('Error loading scripts:', err);
    }
  }

  /**
   * Load a single script
   */
  async loadScript(scriptData) {
    try {
      // Create a safe VM context to evaluate the module
      const vm = new VM({
        timeout: 1000,
        sandbox: {
          console: console,
          exports: {}
        }
      });

      // Wrap code to handle ES module export default
      // We transform "export default" to "exports.default ="
      let code = scriptData.content;
      if (code.includes('export default')) {
        code = code.replace('export default', 'exports.default =');
      }

      // Execute code
      const context = vm.run(code);
      const module = context.default || context;

      this.scripts.set(scriptData.name, module);
      
      // Store metadata
      this.scriptMetadata.set(scriptData.name, {
        tags: scriptData.tags || [],
        description: scriptData.description || '',
        pathPattern: scriptData.pathPattern || ''
      });
      
      // console.log(`✓ Loaded script: ${scriptData.name}`);
      return true;
    } catch (err) {
      console.error(`✗ Failed to load script ${scriptData.name}:`, err.message);
      return false;
    }
  }

  /**
   * Poll database for changes
   */
  startPolling() {
    console.log('👀 Polling database for script changes...');
    
    setInterval(async () => {
      await this.loadAllScripts();
    }, 5000); // Poll every 5 seconds
  }

  /**
   * Get a specific script by name
   */
  getScript(name) {
    return this.scripts.get(name);
  }

  /**
   * Get all loaded scripts
   */
  getAllScripts() {
    return Array.from(this.scripts.keys());
  }

  /**
   * Get scripts that match target tags
   * @param {Array} targetTags - Tags from the target
   * @returns {Array} Array of script names that match
   */
  getScriptsForTags(targetTags = []) {
    if (!targetTags || targetTags.length === 0) {
      // No tags specified, run all scripts
      return this.getAllScripts();
    }

    const matchingScripts = [];
    
    for (const scriptName of this.scripts.keys()) {
      const metadata = this.scriptMetadata.get(scriptName);
      
      if (!metadata || !metadata.tags || metadata.tags.length === 0) {
        // Script has no tags, run for all targets
        matchingScripts.push(scriptName);
      } else {
        // Check if any script tag matches any target tag
        const hasMatch = metadata.tags.some(tag => targetTags.includes(tag));
        if (hasMatch) {
          matchingScripts.push(scriptName);
        }
      }
    }
    
    return matchingScripts;
  }

  /**
   * Get metadata for a specific script
   */
  getScriptMetadata(name) {
    return this.scriptMetadata.get(name) || {};
  }

  /**
   * Get all script metadata
   */
  getAllScriptMetadata() {
    const result = {};
    for (const [name, metadata] of this.scriptMetadata.entries()) {
      result[name] = metadata;
    }
    return result;
  }
}

// Export singleton instance
export default new ScriptLoader();
