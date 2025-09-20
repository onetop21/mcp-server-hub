"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.container = exports.DIContainer = void 0;
require("reflect-metadata");
const types_1 = require("./types");
const connection_1 = require("../database/connection");
const redisConnection_1 = require("../database/redisConnection");
const DatabaseConfig_1 = require("../config/DatabaseConfig");
const RedisConfig_1 = require("../config/RedisConfig");
const repositories_1 = require("../repositories");
const utils_1 = require("../utils");
const UserManagementService_1 = require("../../domain/services/UserManagementService");
const UsageTrackingService_1 = require("../../domain/services/UsageTrackingService");
const PermissionService_1 = require("../../domain/services/PermissionService");
/**
 * Simple DI Container for MCP Hub Router
 *
 * This is a basic implementation that will be enhanced in future tasks.
 * For now, it provides the basic structure without external dependencies.
 */
class DIContainer {
    constructor() {
        this.services = new Map();
        this.initialized = false;
    }
    /**
     * Get the singleton container instance
     */
    static getInstance() {
        if (!DIContainer.instance) {
            DIContainer.instance = new DIContainer();
        }
        return DIContainer.instance;
    }
    /**
     * Initialize the container with all services
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            // Initialize database connection
            const dbConfig = DatabaseConfig_1.DatabaseConfigManager.getConfig();
            const dbConnection = new connection_1.DatabaseConnection(dbConfig);
            await dbConnection.connect();
            this.bind(types_1.TYPES.DatabaseConnection, dbConnection);
            // Initialize Redis connection (optional - gracefully handle failures)
            let redisConnection;
            let usageTrackingService;
            try {
                const redisConfig = RedisConfig_1.RedisConfigManager.getConfig();
                redisConnection = new redisConnection_1.RedisConnection(redisConfig);
                await redisConnection.connect();
                this.bind(types_1.TYPES.RedisConnection, redisConnection);
                // Initialize usage tracking service with Redis
                usageTrackingService = new UsageTrackingService_1.UsageTrackingService(redisConnection);
                this.bind(types_1.TYPES.UsageTrackingService, usageTrackingService);
                console.log('Redis connection established - usage tracking enabled');
            }
            catch (redisError) {
                console.warn('Redis connection failed - falling back to in-memory rate limiting:', redisError);
                // Continue without Redis - the system will use in-memory rate limiting
            }
            // Initialize repositories
            const userRepository = new repositories_1.UserRepository(dbConnection);
            const apiKeyRepository = new repositories_1.ApiKeyRepository(dbConnection);
            this.bind(types_1.TYPES.UserRepository, userRepository);
            this.bind(types_1.TYPES.ApiKeyRepository, apiKeyRepository);
            // Initialize utilities
            const passwordHasher = new utils_1.PasswordHasher();
            const tokenGenerator = new utils_1.TokenGenerator();
            const rateLimiter = new utils_1.RateLimiter();
            this.bind(types_1.TYPES.PasswordHasher, passwordHasher);
            this.bind(types_1.TYPES.TokenGenerator, tokenGenerator);
            this.bind(types_1.TYPES.RateLimiter, rateLimiter);
            // Initialize permission service
            const permissionService = new PermissionService_1.PermissionService();
            this.bind(types_1.TYPES.PermissionService, permissionService);
            // Initialize services
            const userManagementService = new UserManagementService_1.UserManagementService(userRepository, apiKeyRepository, passwordHasher, tokenGenerator, rateLimiter, usageTrackingService, permissionService);
            this.bind(types_1.TYPES.UserManagementService, userManagementService);
            this.initialized = true;
            console.log('DI Container initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize DI Container:', error);
            throw error;
        }
    }
    /**
     * Register a service
     */
    bind(serviceIdentifier, implementation) {
        this.services.set(serviceIdentifier, implementation);
    }
    /**
     * Get a service from the container
     */
    get(serviceIdentifier) {
        const service = this.services.get(serviceIdentifier);
        if (!service) {
            throw new Error(`Service not found: ${serviceIdentifier.toString()}`);
        }
        return service;
    }
    /**
     * Check if a service is bound
     */
    isBound(serviceIdentifier) {
        return this.services.has(serviceIdentifier);
    }
    /**
     * Reset the container (useful for testing)
     */
    static reset() {
        if (DIContainer.instance) {
            DIContainer.instance.services.clear();
            DIContainer.instance.initialized = false;
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            // Cleanup rate limiter
            if (this.isBound(types_1.TYPES.RateLimiter)) {
                const rateLimiter = this.get(types_1.TYPES.RateLimiter);
                rateLimiter.destroy();
            }
            // Close Redis connection
            if (this.isBound(types_1.TYPES.RedisConnection)) {
                const redisConnection = this.get(types_1.TYPES.RedisConnection);
                await redisConnection.disconnect();
            }
            // Close database connection
            if (this.isBound(types_1.TYPES.DatabaseConnection)) {
                const dbConnection = this.get(types_1.TYPES.DatabaseConnection);
                await dbConnection.disconnect();
            }
            this.services.clear();
            this.initialized = false;
        }
        catch (error) {
            console.error('Error during container cleanup:', error);
        }
    }
}
exports.DIContainer = DIContainer;
// Export the container instance for direct access if needed
exports.container = DIContainer.getInstance();
