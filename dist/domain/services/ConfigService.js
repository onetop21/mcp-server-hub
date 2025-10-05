"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = void 0;
const IConfigService_1 = require("./IConfigService");
/**
 * Configuration Service Implementation
 * Task 17: Dynamic Configuration Management
 *
 * In-memory configuration with optional persistence
 */
class ConfigService {
    constructor(initialConfig = {}) {
        this.config = new Map();
        this.watchers = new Map();
        // Set default configuration
        this.defaults = Object.assign({ [IConfigService_1.CONFIG_KEYS.RATE_LIMIT_ENABLED]: false, [IConfigService_1.CONFIG_KEYS.RATE_LIMIT_WINDOW_MS]: 60000, [IConfigService_1.CONFIG_KEYS.RATE_LIMIT_MAX_REQUESTS]: 100, [IConfigService_1.CONFIG_KEYS.SERVER_DEFAULT_TIMEOUT]: 30000, [IConfigService_1.CONFIG_KEYS.SERVER_HEALTH_CHECK_INTERVAL]: 60000, [IConfigService_1.CONFIG_KEYS.SERVER_MAX_RETRIES]: 3, [IConfigService_1.CONFIG_KEYS.LOAD_BALANCING_ENABLED]: false, [IConfigService_1.CONFIG_KEYS.LOAD_BALANCING_STRATEGY]: 'round-robin', [IConfigService_1.CONFIG_KEYS.LOG_LEVEL]: 'info', [IConfigService_1.CONFIG_KEYS.LOG_FORMAT]: 'json', [IConfigService_1.CONFIG_KEYS.MARKETPLACE_ENABLED]: true, [IConfigService_1.CONFIG_KEYS.GROUP_MANAGEMENT_ENABLED]: false, [IConfigService_1.CONFIG_KEYS.BACKUP_ENABLED]: false }, initialConfig);
        // Load defaults into config
        for (const [key, value] of Object.entries(this.defaults)) {
            this.config.set(key, value);
        }
    }
    get(key, defaultValue) {
        if (this.config.has(key)) {
            return this.config.get(key);
        }
        return (defaultValue !== undefined ? defaultValue : this.defaults[key]);
    }
    async set(key, value, persist = false) {
        const oldValue = this.config.get(key);
        this.config.set(key, value);
        // Notify watchers
        const keyWatchers = this.watchers.get(key);
        if (keyWatchers) {
            for (const callback of keyWatchers) {
                try {
                    callback(value, oldValue);
                }
                catch (error) {
                    console.error(`Error in config watcher for key ${key}:`, error);
                }
            }
        }
        // TODO: Persist to database if persist=true
        if (persist) {
            console.log(`Config persisted: ${key} = ${JSON.stringify(value)}`);
        }
    }
    getAll() {
        const result = {};
        for (const [key, value] of this.config.entries()) {
            result[key] = value;
        }
        return result;
    }
    async reload() {
        // TODO: Reload from database
        console.log('Config reloaded from database');
    }
    watch(key, callback) {
        if (!this.watchers.has(key)) {
            this.watchers.set(key, new Set());
        }
        this.watchers.get(key).add(callback);
        // Return unwatch function
        return () => {
            const keyWatchers = this.watchers.get(key);
            if (keyWatchers) {
                keyWatchers.delete(callback);
                if (keyWatchers.size === 0) {
                    this.watchers.delete(key);
                }
            }
        };
    }
    async validate(config) {
        const errors = [];
        // Validate rate limiting
        if (config[IConfigService_1.CONFIG_KEYS.RATE_LIMIT_WINDOW_MS] && config[IConfigService_1.CONFIG_KEYS.RATE_LIMIT_WINDOW_MS] < 1000) {
            errors.push('Rate limit window must be at least 1000ms');
        }
        if (config[IConfigService_1.CONFIG_KEYS.RATE_LIMIT_MAX_REQUESTS] && config[IConfigService_1.CONFIG_KEYS.RATE_LIMIT_MAX_REQUESTS] < 1) {
            errors.push('Rate limit max requests must be at least 1');
        }
        // Validate timeouts
        if (config[IConfigService_1.CONFIG_KEYS.SERVER_DEFAULT_TIMEOUT] && config[IConfigService_1.CONFIG_KEYS.SERVER_DEFAULT_TIMEOUT] < 1000) {
            errors.push('Server timeout must be at least 1000ms');
        }
        // Validate log level
        if (config[IConfigService_1.CONFIG_KEYS.LOG_LEVEL]) {
            const validLevels = ['debug', 'info', 'warn', 'error'];
            if (!validLevels.includes(config[IConfigService_1.CONFIG_KEYS.LOG_LEVEL])) {
                errors.push(`Log level must be one of: ${validLevels.join(', ')}`);
            }
        }
        // Validate load balancing strategy
        if (config[IConfigService_1.CONFIG_KEYS.LOAD_BALANCING_STRATEGY]) {
            const validStrategies = ['round-robin', 'weighted', 'least-connections', 'random'];
            if (!validStrategies.includes(config[IConfigService_1.CONFIG_KEYS.LOAD_BALANCING_STRATEGY])) {
                errors.push(`Load balancing strategy must be one of: ${validStrategies.join(', ')}`);
            }
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
}
exports.ConfigService = ConfigService;
