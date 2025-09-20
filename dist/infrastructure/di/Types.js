"use strict";
// Dependency injection symbols for type-safe container bindings
Object.defineProperty(exports, "__esModule", { value: true });
exports.TYPES = void 0;
// Service Types
exports.TYPES = {
    // Core Services
    UserManagementService: Symbol.for('UserManagementService'),
    ServerRegistryService: Symbol.for('ServerRegistryService'),
    ProtocolAdapterService: Symbol.for('ProtocolAdapterService'),
    RouterService: Symbol.for('RouterService'),
    // Repository Types (to be added in future tasks)
    UserRepository: Symbol.for('UserRepository'),
    ServerRepository: Symbol.for('ServerRepository'),
    ApiKeyRepository: Symbol.for('ApiKeyRepository'),
    EndpointRepository: Symbol.for('EndpointRepository'),
    // Infrastructure Types (to be added in future tasks)
    DatabaseConnection: Symbol.for('DatabaseConnection'),
    RedisClient: Symbol.for('RedisClient'),
    Logger: Symbol.for('Logger'),
    // Configuration Types
    AppConfig: Symbol.for('AppConfig'),
    DatabaseConfig: Symbol.for('DatabaseConfig'),
    RedisConfig: Symbol.for('RedisConfig')
};
