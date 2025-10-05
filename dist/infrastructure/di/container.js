"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.container = exports.createContainer = exports.DIContainer = void 0;
require("reflect-metadata");
const types_1 = require("./types");
const connection_1 = require("../database/connection");
const DatabaseConfig_1 = require("../config/DatabaseConfig");
const repositories_1 = require("../repositories");
const utils_1 = require("../utils");
const UserManagementService_1 = require("../../domain/services/UserManagementService");
const PermissionService_1 = require("../../domain/services/PermissionService");
const ServerRegistryService_1 = require("../../domain/services/ServerRegistryService");
const EndpointService_1 = require("../../domain/services/EndpointService");
const ProtocolAdapterService_1 = require("../../domain/services/ProtocolAdapterService");
const RouterService_1 = require("../../domain/services/RouterService");
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
            // Check if Redis is enabled via environment variable
            const redisEnabled = process.env.REDIS_ENABLED !== 'false';
            if (redisEnabled) {
                try {
                    // Dynamic import to avoid loading Redis when not needed
                    const { RedisConnection } = await Promise.resolve().then(() => __importStar(require('../database/redisConnection')));
                    const { RedisConfigManager } = await Promise.resolve().then(() => __importStar(require('../config/RedisConfig')));
                    const { UsageTrackingService } = await Promise.resolve().then(() => __importStar(require('../../domain/services/UsageTrackingService')));
                    const redisConfig = RedisConfigManager.getConfig();
                    redisConnection = new RedisConnection(redisConfig);
                    await redisConnection.connect();
                    this.bind(types_1.TYPES.RedisConnection, redisConnection);
                    // Initialize usage tracking service with Redis
                    usageTrackingService = new UsageTrackingService(redisConnection);
                    this.bind(types_1.TYPES.UsageTrackingService, usageTrackingService);
                    console.log('Redis connection established - usage tracking enabled');
                }
                catch (redisError) {
                    console.warn('Redis connection failed - falling back to in-memory rate limiting:', redisError);
                    // Continue without Redis - the system will use in-memory rate limiting
                }
            }
            else {
                console.log('Redis disabled via configuration - using in-memory rate limiting');
            }
            // Initialize repositories
            const userRepository = new repositories_1.UserRepository(dbConnection);
            const apiKeyRepository = new repositories_1.ApiKeyRepository(dbConnection);
            const serverRepository = new repositories_1.ServerRepository(dbConnection);
            const serverGroupRepository = new repositories_1.ServerGroupRepository(dbConnection);
            const endpointRepository = new repositories_1.EndpointRepository(dbConnection);
            this.bind(types_1.TYPES.UserRepository, userRepository);
            this.bind(types_1.TYPES.ApiKeyRepository, apiKeyRepository);
            this.bind(types_1.TYPES.ServerRepository, serverRepository);
            this.bind(types_1.TYPES.GroupRepository, serverGroupRepository);
            this.bind(types_1.TYPES.EndpointRepository, endpointRepository);
            // Initialize MarketplaceRepository
            const { MarketplaceRepository } = await Promise.resolve().then(() => __importStar(require('../repositories/MarketplaceRepository')));
            const marketplaceRepository = new MarketplaceRepository(dbConnection);
            this.bind(types_1.TYPES.MarketplaceRepository, marketplaceRepository);
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
            const serverRegistryService = new ServerRegistryService_1.ServerRegistryService(serverRepository, serverGroupRepository);
            this.bind(types_1.TYPES.ServerRegistryService, serverRegistryService);
            // Initialize MarketplaceService
            const { MarketplaceService } = await Promise.resolve().then(() => __importStar(require('../../domain/services/MarketplaceService')));
            const marketplaceService = new MarketplaceService(marketplaceRepository, userManagementService);
            this.bind(types_1.TYPES.MarketplaceService, marketplaceService);
            const endpointService = new EndpointService_1.EndpointService(endpointRepository, serverGroupRepository, apiKeyRepository, tokenGenerator);
            this.bind(types_1.TYPES.EndpointService, endpointService);
            const protocolAdapterService = new ProtocolAdapterService_1.ProtocolAdapterService();
            this.bind(types_1.TYPES.ProtocolAdapterService, protocolAdapterService);
            /**
             * ROUTER SERVICE INITIALIZATION
             * ==============================
             *
             * ARCHITECTURE DECISION: Simplified Design (No Load Balancing)
             *
             * Why LoadBalancerService is NOT initialized:
             * -------------------------------------------
             * 1. MCP servers require personal credentials (API keys, tokens)
             *    → Each user runs their own server instances
             *    → Cannot be shared between users
             *
             * 2. Typical usage: 1 server per user per tool type
             *    → No need for load balancing
             *    → No need for circuit breakers
             *
             * 3. MCP servers are stateless
             *    → Simple first-server selection works fine
             *    → Predictable and easy to debug
             *
             * 4. Users can reuse servers across multiple projects
             *    → One setup, use everywhere
             *    → No performance issues with this approach
             *
             * When to enable LoadBalancerService:
             * -----------------------------------
             * Only when team/organization shared servers are needed:
             * - Shared API keys (company license)
             * - High concurrent usage (100+ users)
             * - Need for high availability
             *
             * How to enable:
             * -------------
             * Uncomment these 3 lines:
             *
             * const loadBalancerService = new LoadBalancerService();
             * this.bind(TYPES.LoadBalancerService, loadBalancerService);
             * // Then pass loadBalancerService as 5th parameter below
             *
             * All load balancing features will automatically activate!
             * See: docs/LoadBalancing.md for details
             */
            const routerService = new RouterService_1.RouterService(serverRepository, endpointRepository, serverGroupRepository, protocolAdapterService
            // loadBalancerService intentionally omitted - see comment above
            );
            this.bind(types_1.TYPES.RouterService, routerService);
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
            // Shutdown protocol adapter service
            if (this.isBound(types_1.TYPES.ProtocolAdapterService)) {
                const protocolAdapterService = this.get(types_1.TYPES.ProtocolAdapterService);
                await protocolAdapterService.shutdown();
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
/**
 * Create and initialize DI container (non-async version for sync usage)
 */
function createContainer() {
    const container = DIContainer.getInstance();
    // Create mock instances for now
    const dbConnection = new connection_1.DatabaseConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'mcp_hub',
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        maxConnections: 10
    });
    const userRepository = new repositories_1.UserRepository(dbConnection);
    const apiKeyRepository = new repositories_1.ApiKeyRepository(dbConnection);
    const serverRepository = new repositories_1.ServerRepository(dbConnection);
    const serverGroupRepository = new repositories_1.ServerGroupRepository(dbConnection);
    const endpointRepository = new repositories_1.EndpointRepository(dbConnection);
    const passwordHasher = new utils_1.PasswordHasher();
    const tokenGenerator = new utils_1.TokenGenerator();
    const rateLimiter = new utils_1.RateLimiter();
    const permissionService = new PermissionService_1.PermissionService();
    const userManagementService = new UserManagementService_1.UserManagementService(userRepository, apiKeyRepository, passwordHasher, tokenGenerator, rateLimiter, undefined, // No usage tracking for now
    permissionService);
    const serverRegistryService = new ServerRegistryService_1.ServerRegistryService(serverRepository, serverGroupRepository);
    const endpointService = new EndpointService_1.EndpointService(endpointRepository, serverGroupRepository, apiKeyRepository, tokenGenerator);
    const protocolAdapterService = new ProtocolAdapterService_1.ProtocolAdapterService();
    const routerService = new RouterService_1.RouterService(serverRepository, endpointRepository, serverGroupRepository, protocolAdapterService);
    // Initialize MarketplaceRepository and MarketplaceService
    const { MarketplaceRepository } = require('../repositories/MarketplaceRepository');
    const marketplaceRepository = new MarketplaceRepository(dbConnection);
    const { MarketplaceService } = require('../../domain/services/MarketplaceService');
    const marketplaceService = new MarketplaceService(marketplaceRepository, userManagementService);
    // Bind services
    container.bind(types_1.TYPES.DatabaseConnection, dbConnection);
    container.bind(types_1.TYPES.UserRepository, userRepository);
    container.bind(types_1.TYPES.ApiKeyRepository, apiKeyRepository);
    container.bind(types_1.TYPES.ServerRepository, serverRepository);
    container.bind(types_1.TYPES.GroupRepository, serverGroupRepository);
    container.bind(types_1.TYPES.EndpointRepository, endpointRepository);
    container.bind(types_1.TYPES.MarketplaceRepository, marketplaceRepository);
    container.bind(types_1.TYPES.PasswordHasher, passwordHasher);
    container.bind(types_1.TYPES.TokenGenerator, tokenGenerator);
    container.bind(types_1.TYPES.RateLimiter, rateLimiter);
    container.bind(types_1.TYPES.PermissionService, permissionService);
    container.bind(types_1.TYPES.UserManagementService, userManagementService);
    container.bind(types_1.TYPES.ServerRegistryService, serverRegistryService);
    container.bind(types_1.TYPES.EndpointService, endpointService);
    container.bind(types_1.TYPES.ProtocolAdapterService, protocolAdapterService);
    container.bind(types_1.TYPES.RouterService, routerService);
    container.bind(types_1.TYPES.MarketplaceService, marketplaceService);
    return container;
}
exports.createContainer = createContainer;
// Export the container instance for direct access if needed
exports.container = DIContainer.getInstance();
