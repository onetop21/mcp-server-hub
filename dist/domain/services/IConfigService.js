"use strict";
/**
 * Configuration Service Interface
 * Task 17: Dynamic Configuration Management
 *
 * Provides runtime configuration management without restart
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG_KEYS = void 0;
exports.CONFIG_KEYS = {
    // Rate Limiting
    RATE_LIMIT_ENABLED: 'rate_limit.enabled',
    RATE_LIMIT_WINDOW_MS: 'rate_limit.window_ms',
    RATE_LIMIT_MAX_REQUESTS: 'rate_limit.max_requests',
    // Server Defaults
    SERVER_DEFAULT_TIMEOUT: 'server.default_timeout',
    SERVER_HEALTH_CHECK_INTERVAL: 'server.health_check_interval',
    SERVER_MAX_RETRIES: 'server.max_retries',
    // Load Balancing
    LOAD_BALANCING_ENABLED: 'load_balancing.enabled',
    LOAD_BALANCING_STRATEGY: 'load_balancing.strategy',
    // Logging
    LOG_LEVEL: 'logging.level',
    LOG_FORMAT: 'logging.format',
    // Features
    MARKETPLACE_ENABLED: 'features.marketplace_enabled',
    GROUP_MANAGEMENT_ENABLED: 'features.group_management_enabled',
    BACKUP_ENABLED: 'features.backup_enabled',
};
