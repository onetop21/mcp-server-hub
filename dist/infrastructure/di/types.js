"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TYPES = void 0;
// Service identifiers for dependency injection
exports.TYPES = {
    // Core Services
    UserManagementService: Symbol.for('UserManagementService'),
    ServerRegistryService: Symbol.for('ServerRegistryService'),
    ProtocolAdapterService: Symbol.for('ProtocolAdapterService'),
    RouterService: Symbol.for('RouterService'),
    EndpointService: Symbol.for('EndpointService'),
    UsageTrackingService: Symbol.for('UsageTrackingService'),
    PermissionService: Symbol.for('PermissionService'),
    // Repositories
    UserRepository: Symbol.for('UserRepository'),
    ServerRepository: Symbol.for('ServerRepository'),
    ApiKeyRepository: Symbol.for('ApiKeyRepository'),
    EndpointRepository: Symbol.for('EndpointRepository'),
    GroupRepository: Symbol.for('GroupRepository'),
    // Infrastructure
    DatabaseConnection: Symbol.for('DatabaseConnection'),
    RedisConnection: Symbol.for('RedisConnection'),
    Logger: Symbol.for('Logger'),
    ConfigService: Symbol.for('ConfigService'),
    // Protocol Adapters
    StdioAdapter: Symbol.for('StdioAdapter'),
    SseAdapter: Symbol.for('SseAdapter'),
    HttpAdapter: Symbol.for('HttpAdapter'),
    AdapterFactory: Symbol.for('AdapterFactory'),
    // Utilities
    PasswordHasher: Symbol.for('PasswordHasher'),
    TokenGenerator: Symbol.for('TokenGenerator'),
    RateLimiter: Symbol.for('RateLimiter'),
    HealthChecker: Symbol.for('HealthChecker')
};
