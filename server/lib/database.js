import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../data/proxy.db');

class DatabaseService {
    constructor() {
        this.db = new Database(DB_PATH);
        this.db.pragma('journal_mode = WAL'); // Better concurrent performance
        this.init();
    }

    /**
     * Initialize database schema
     */
    init() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS targets (
                id TEXT PRIMARY KEY,
                nickname TEXT NOT NULL,
                base_url TEXT NOT NULL,
                tags TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS scripts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                content TEXT NOT NULL,
                description TEXT,
                tags TEXT,
                path_pattern TEXT,
                response_strategy TEXT DEFAULT 'first',
                response_target_id TEXT,
                response_mock TEXT,
                response_enabled INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_targets_tags ON targets(tags);
            CREATE INDEX IF NOT EXISTS idx_scripts_name ON scripts(name);
            CREATE INDEX IF NOT EXISTS idx_scripts_tags ON scripts(tags);
        `);

        logger.info('✓ Database initialized');
    }

    // ==================== TARGETS ====================

    /**
     * Get all targets
     */
    getAllTargets() {
        const stmt = this.db.prepare('SELECT * FROM targets ORDER BY created_at DESC');
        const rows = stmt.all();

        return rows.map(row => ({
            id: row.id,
            nickname: row.nickname,
            baseUrl: row.base_url,
            tags: JSON.parse(row.tags || '[]'),
            metadata: JSON.parse(row.metadata || '{}'),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    }

    /**
     * Get target by ID
     */
    getTarget(id) {
        const stmt = this.db.prepare('SELECT * FROM targets WHERE id = ?');
        const row = stmt.get(id);

        if (!row) return null;

        return {
            id: row.id,
            nickname: row.nickname,
            baseUrl: row.base_url,
            tags: JSON.parse(row.tags || '[]'),
            metadata: JSON.parse(row.metadata || '{}'),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    /**
     * Create new target
     */
    createTarget(data) {
        const stmt = this.db.prepare(`
            INSERT INTO targets (id, nickname, base_url, tags, metadata)
            VALUES (?, ?, ?, ?, ?)
        `);

        stmt.run(
            data.id,
            data.nickname,
            data.baseUrl,
            JSON.stringify(data.tags || []),
            JSON.stringify(data.metadata || {})
        );

        return this.getTarget(data.id);
    }

    /**
     * Update existing target
     */
    updateTarget(id, data) {
        const stmt = this.db.prepare(`
            UPDATE targets 
            SET nickname = ?, base_url = ?, tags = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        stmt.run(
            data.nickname,
            data.baseUrl,
            JSON.stringify(data.tags || []),
            JSON.stringify(data.metadata || {}),
            id
        );

        return this.getTarget(id);
    }

    /**
     * Delete target
     */
    deleteTarget(id) {
        const stmt = this.db.prepare('DELETE FROM targets WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    // ==================== SCRIPTS ====================

    /**
     * Get all scripts
     */
    getAllScripts() {
        const stmt = this.db.prepare('SELECT * FROM scripts ORDER BY name ASC');
        const rows = stmt.all();

        return rows.map(row => ({
            id: row.id,
            name: row.name,
            content: row.content,
            description: row.description || '',
            tags: JSON.parse(row.tags || '[]'),
            pathPattern: row.path_pattern || '',
            responseConfig: {
                strategy: row.response_strategy || 'all',
                targetId: row.response_target_id || null,
                mockResponse: row.response_mock ? JSON.parse(row.response_mock) : null,
                enabled: row.response_enabled === 1
            },
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    }

    /**
     * Get script by name
     */
    getScript(name) {
        const stmt = this.db.prepare('SELECT * FROM scripts WHERE name = ?');
        const row = stmt.get(name);

        if (!row) return null;

        return {
            id: row.id,
            name: row.name,
            content: row.content,
            description: row.description || '',
            tags: JSON.parse(row.tags || '[]'),
            pathPattern: row.path_pattern || '',
            responseConfig: {
                strategy: row.response_strategy || 'all',
                targetId: row.response_target_id || null,
                mockResponse: row.response_mock ? JSON.parse(row.response_mock) : null,
                enabled: row.response_enabled === 1
            },
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    /**
     * Create new script
     */
    createScript(data) {
        const stmt = this.db.prepare(`
            INSERT INTO scripts (name, content, description, tags, path_pattern, response_strategy, response_target_id, response_mock, response_enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const responseConfig = data.responseConfig || {};
        stmt.run(
            data.name,
            data.content,
            data.description || '',
            JSON.stringify(data.tags || []),
            data.pathPattern || '',
            responseConfig.strategy || 'all',
            responseConfig.targetId || null,
            responseConfig.mockResponse ? JSON.stringify(responseConfig.mockResponse) : null,
            responseConfig.enabled ? 1 : 0
        );

        return this.getScript(data.name);
    }

    /**
     * Update existing script
     */
    updateScript(name, data) {
        const stmt = this.db.prepare(`
            UPDATE scripts 
            SET content = ?, description = ?, tags = ?, path_pattern = ?, 
                response_strategy = ?, response_target_id = ?, response_mock = ?, response_enabled = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE name = ?
        `);

        const responseConfig = data.responseConfig || {};
        stmt.run(
            data.content,
            data.description || '',
            JSON.stringify(data.tags || []),
            data.pathPattern || '',
            responseConfig.strategy || 'all',
            responseConfig.targetId || null,
            responseConfig.mockResponse ? JSON.stringify(responseConfig.mockResponse) : null,
            responseConfig.enabled ? 1 : 0,
            name
        );

        return this.getScript(name);
    }

    /**
     * Delete script
     */
    deleteScript(name) {
        const stmt = this.db.prepare('DELETE FROM scripts WHERE id = ?');
        const result = stmt.run(name);
        return result.changes > 0;
    }

    /**
     * Get scripts by tags (for filtering)
     */
    getScriptsByTags(targetTags = []) {
        const allScripts = this.getAllScripts();

        if (!targetTags || targetTags.length === 0) {
            return allScripts;
        }

        return allScripts.filter(script => {
            if (!script.tags || script.tags.length === 0) {
                // Script has no tags, run for all targets
                return true;
            }

            // Check if any script tag matches any target tag
            return script.tags.some(tag => targetTags.includes(tag));
        });
    }

    // ==================== CONFIG ====================

    /**
     * Get config value
     */
    getConfig(key) {
        const stmt = this.db.prepare('SELECT value FROM config WHERE key = ?');
        const row = stmt.get(key);
        return row ? JSON.parse(row.value) : null;
    }

    /**
     * Set config value
     */
    setConfig(key, value) {
        const stmt = this.db.prepare(`
            INSERT INTO config (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
        `);

        stmt.run(key, JSON.stringify(value), JSON.stringify(value));
        return value;
    }

    /**
     * Get all config
     */
    getAllConfig() {
        const stmt = this.db.prepare('SELECT * FROM config');
        const rows = stmt.all();

        const config = {};
        for (const row of rows) {
            config[row.key] = JSON.parse(row.value);
        }
        return config;
    }

    /**
     * Close database connection
     */
    close() {
        this.db.close();
    }
}

// Export singleton instance
export default new DatabaseService();
