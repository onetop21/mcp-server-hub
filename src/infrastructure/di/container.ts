import 'reflect-metadata';
import { TYPES } from './types';
import { DatabaseConnection } from '../database/connection';
import { DatabaseConfigManager } from '../config/DatabaseConfig';
import { UserRepository, ApiKeyRepository, ServerRepository, ServerGroupRepository, EndpointRepository } from '../repositories';
import { PasswordHasher, TokenGenerator, RateLimiter } from '../utils';
import { UserManagementService } from '../../domain/services/UserManagementService';
import { PermissionService } from '../../domain/services/PermissionService';
import { ServerRegistryService } from '../../domain/services/ServerRegistryService';
import { EndpointService } from '../../domain/services/EndpointService';
import { ProtocolAdapterService } from '../../domain/services/ProtocolAdapterService';

/**
 * Simple DI Container for MCP Hub Router
 * 
 * This is a basic implementation that will be enhanced in future tasks.
 * For now, it provides the basic structure without external dependencies.
 */
export class DIContainer {
  private static instance: DIContainer;
  private services: Map<symbol, any> = new Map();
  private initialized: boolean = false;

  /**
   * Get the singleton container instance
   */
  public static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  /**
   * Initialize the container with all services
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize database connection
      const dbConfig = DatabaseConfigManager.getConfig();
      const dbConnection = new DatabaseConnection(dbConfig);
      await dbConnection.connect();
      this.bind(TYPES.DatabaseConnection, dbConnection);

      // Initialize Redis connection (optional - gracefully handle failures)
      let redisConnection: any | undefined;
      let usageTrackingService: any | undefined;
      
      // Check if Redis is enabled via environment variable
      const redisEnabled = process.env.REDIS_ENABLED !== 'false';
      
      if (redisEnabled) {
        try {
          // Dynamic import to avoid loading Redis when not needed
          const { RedisConnection } = await import('../database/redisConnection');
          const { RedisConfigManager } = await import('../config/RedisConfig');
          const { UsageTrackingService } = await import('../../domain/services/UsageTrackingService');
          
          const redisConfig = RedisConfigManager.getConfig();
          redisConnection = new RedisConnection(redisConfig);
          await redisConnection.connect();
          this.bind(TYPES.RedisConnection, redisConnection);
          
          // Initialize usage tracking service with Redis
          usageTrackingService = new UsageTrackingService(redisConnection);
          this.bind(TYPES.UsageTrackingService, usageTrackingService);
          
          console.log('Redis connection established - usage tracking enabled');
        } catch (redisError) {
          console.warn('Redis connection failed - falling back to in-memory rate limiting:', redisError);
          // Continue without Redis - the system will use in-memory rate limiting
        }
      } else {
        console.log('Redis disabled via configuration - using in-memory rate limiting');
      }

      // Initialize repositories
      const userRepository = new UserRepository(dbConnection);
      const apiKeyRepository = new ApiKeyRepository(dbConnection);
      const serverRepository = new ServerRepository(dbConnection);
      const serverGroupRepository = new ServerGroupRepository(dbConnection);
      const endpointRepository = new EndpointRepository(dbConnection);
      this.bind(TYPES.UserRepository, userRepository);
      this.bind(TYPES.ApiKeyRepository, apiKeyRepository);
      this.bind(TYPES.ServerRepository, serverRepository);
      this.bind(TYPES.GroupRepository, serverGroupRepository);
      this.bind(TYPES.EndpointRepository, endpointRepository);

      // Initialize utilities
      const passwordHasher = new PasswordHasher();
      const tokenGenerator = new TokenGenerator();
      const rateLimiter = new RateLimiter();
      this.bind(TYPES.PasswordHasher, passwordHasher);
      this.bind(TYPES.TokenGenerator, tokenGenerator);
      this.bind(TYPES.RateLimiter, rateLimiter);

      // Initialize permission service
      const permissionService = new PermissionService();
      this.bind(TYPES.PermissionService, permissionService);

      // Initialize services
      const userManagementService = new UserManagementService(
        userRepository,
        apiKeyRepository,
        passwordHasher,
        tokenGenerator,
        rateLimiter,
        usageTrackingService,
        permissionService
      );
      this.bind(TYPES.UserManagementService, userManagementService);

      const serverRegistryService = new ServerRegistryService(serverRepository, serverGroupRepository);
      this.bind(TYPES.ServerRegistryService, serverRegistryService);

      const endpointService = new EndpointService(
        endpointRepository,
        serverGroupRepository,
        apiKeyRepository,
        tokenGenerator
      );
      this.bind(TYPES.EndpointService, endpointService);

      const protocolAdapterService = new ProtocolAdapterService();
      this.bind(TYPES.ProtocolAdapterService, protocolAdapterService);

      this.initialized = true;
      console.log('DI Container initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DI Container:', error);
      throw error;
    }
  }

  /**
   * Register a service
   */
  public bind<T>(serviceIdentifier: symbol, implementation: T): void {
    this.services.set(serviceIdentifier, implementation);
  }

  /**
   * Get a service from the container
   */
  public get<T>(serviceIdentifier: symbol): T {
    const service = this.services.get(serviceIdentifier);
    if (!service) {
      throw new Error(`Service not found: ${serviceIdentifier.toString()}`);
    }
    return service;
  }

  /**
   * Check if a service is bound
   */
  public isBound(serviceIdentifier: symbol): boolean {
    return this.services.has(serviceIdentifier);
  }

  /**
   * Reset the container (useful for testing)
   */
  public static reset(): void {
    if (DIContainer.instance) {
      DIContainer.instance.services.clear();
      DIContainer.instance.initialized = false;
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    try {
      // Cleanup rate limiter
      if (this.isBound(TYPES.RateLimiter)) {
        const rateLimiter = this.get<RateLimiter>(TYPES.RateLimiter);
        rateLimiter.destroy();
      }

      // Close Redis connection
      if (this.isBound(TYPES.RedisConnection)) {
        const redisConnection = this.get<any>(TYPES.RedisConnection);
        await redisConnection.disconnect();
      }

      // Shutdown protocol adapter service
      if (this.isBound(TYPES.ProtocolAdapterService)) {
        const protocolAdapterService = this.get<ProtocolAdapterService>(TYPES.ProtocolAdapterService);
        await protocolAdapterService.shutdown();
      }

      // Close database connection
      if (this.isBound(TYPES.DatabaseConnection)) {
        const dbConnection = this.get<DatabaseConnection>(TYPES.DatabaseConnection);
        await dbConnection.disconnect();
      }

      this.services.clear();
      this.initialized = false;
    } catch (error) {
      console.error('Error during container cleanup:', error);
    }
  }
}

// Export the container instance for direct access if needed
export const container = DIContainer.getInstance();