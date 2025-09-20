"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseConfigManager = void 0;
/**
 * Database configuration from environment variables
 */
class DatabaseConfigManager {
    /**
     * Get database configuration from environment variables
     */
    static getConfig() {
        return {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432', 10),
            database: process.env.DB_NAME || 'mcp_hub_router',
            username: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
            ssl: process.env.DB_SSL === 'true',
            maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
            connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
            idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
        };
    }
    /**
     * Get test database configuration
     */
    static getTestConfig() {
        return {
            host: process.env.TEST_DB_HOST || 'localhost',
            port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
            database: process.env.TEST_DB_NAME || 'mcp_hub_router_test',
            username: process.env.TEST_DB_USER || 'postgres',
            password: process.env.TEST_DB_PASSWORD || 'password',
            ssl: false,
            maxConnections: 5,
            connectionTimeoutMillis: 3000,
            idleTimeoutMillis: 10000,
        };
    }
    /**
     * Validate database configuration
     */
    static validateConfig(config) {
        const required = ['host', 'port', 'database', 'username', 'password'];
        for (const field of required) {
            if (!config[field]) {
                throw new Error(`Database configuration missing required field: ${field}`);
            }
        }
        if (config.port < 1 || config.port > 65535) {
            throw new Error('Database port must be between 1 and 65535');
        }
        if (config.maxConnections && config.maxConnections < 1) {
            throw new Error('Max connections must be at least 1');
        }
    }
    /**
     * Get connection string for logging (without password)
     */
    static getConnectionString(config, hidePassword = true) {
        const password = hidePassword ? '***' : config.password;
        return `postgresql://${config.username}:${password}@${config.host}:${config.port}/${config.database}`;
    }
}
exports.DatabaseConfigManager = DatabaseConfigManager;
