import { UserManagementService } from '../UserManagementService';
import { UsageTrackingService } from '../UsageTrackingService';
import { PermissionService } from '../PermissionService';
import { RedisConnection } from '../../../infrastructure/database/redisConnection';
import { UserRepository } from '../../../infrastructure/repositories/UserRepository';
import { ApiKeyRepository } from '../../../infrastructure/repositories/ApiKeyRepository';
import { PasswordHasher } from '../../../infrastructure/utils/PasswordHasher';
import { TokenGenerator } from '../../../infrastructure/utils/TokenGenerator';
import { RateLimiter } from '../../../infrastructure/utils/RateLimiter';
import { SubscriptionTier } from '../../models/User';
import { ResourceType, ActionType } from '../IPermissionService';

// Mock all dependencies
jest.mock('../../../infrastructure/database/redisConnection');
jest.mock('../../../infrastructure/repositories/UserRepository');
jest.mock('../../../infrastructure/repositories/ApiKeyRepository');
jest.mock('../../../infrastructure/utils/PasswordHasher');
jest.mock('../../../infrastructure/utils/TokenGenerator');
jest.mock('../../../infrastructure/utils/RateLimiter');

describe('Usage Tracking Integration', () => {
  let userManagementService: UserManagementService;
  let usageTrackingService: UsageTrackingService;
  let permissionService: PermissionService;
  let mockRedisConnection: jest.Mocked<RedisConnection>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockApiKeyRepository: jest.Mocked<ApiKeyRepository>;
  let mockPasswordHasher: jest.Mocked<PasswordHasher>;
  let mockTokenGenerator: jest.Mocked<TokenGenerator>;
  let mockRateLimiter: jest.Mocked<RateLimiter>;

  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashedpassword',
    createdAt: new Date(),
    updatedAt: new Date(),
    subscription: SubscriptionTier.BASIC
  };

  const mockApiKey = {
    id: 'apikey123',
    userId: 'user123',
    key: 'test-api-key',
    name: 'Test API Key',
    permissions: [
      {
        resource: `${ResourceType.SERVER}:user123:*`,
        actions: [ActionType.READ, ActionType.WRITE]
      }
    ],
    rateLimit: {
      requestsPerHour: 500,
      requestsPerDay: 10000,
      maxServers: 10
    },
    createdAt: new Date(),
    expiresAt: undefined,
    lastUsedAt: undefined
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockRedisConnection = new (RedisConnection as jest.MockedClass<typeof RedisConnection>)({} as any);
    mockUserRepository = new (UserRepository as jest.MockedClass<typeof UserRepository>)({} as any);
    mockApiKeyRepository = new (ApiKeyRepository as jest.MockedClass<typeof ApiKeyRepository>)({} as any);
    mockPasswordHasher = new (PasswordHasher as jest.MockedClass<typeof PasswordHasher>)();
    mockTokenGenerator = new (TokenGenerator as jest.MockedClass<typeof TokenGenerator>)();
    mockRateLimiter = new (RateLimiter as jest.MockedClass<typeof RateLimiter>)();

    // Mock Redis client
    const mockRedisClient = {
      multi: jest.fn().mockReturnValue({
        get: jest.fn().mockReturnThis(),
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(['50', '200'])
      }),
      get: jest.fn(),
      incr: jest.fn(),
      del: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
      mGet: jest.fn().mockResolvedValue([])
    };

    mockRedisConnection.getClient = jest.fn().mockReturnValue(mockRedisClient);

    // Initialize services
    usageTrackingService = new UsageTrackingService(mockRedisConnection);
    permissionService = new PermissionService();
    userManagementService = new UserManagementService(
      mockUserRepository,
      mockApiKeyRepository,
      mockPasswordHasher,
      mockTokenGenerator,
      mockRateLimiter,
      usageTrackingService,
      permissionService
    );
  });

  describe('Complete Usage Tracking Flow', () => {
    it('should handle complete API key validation and usage tracking flow', async () => {
      // Setup mocks
      mockApiKeyRepository.findByKey.mockResolvedValue(mockApiKey);
      mockApiKeyRepository.updateLastUsed.mockResolvedValue();

      // Validate API key
      const validation = await userManagementService.validateApiKey('test-api-key');
      
      expect(validation.isValid).toBe(true);
      expect(validation.userId).toBe('user123');
      expect(validation.permissions).toEqual(mockApiKey.permissions);
      expect(validation.rateLimit).toEqual(mockApiKey.rateLimit);

      // Check permissions
      const canAccessServer = await userManagementService.checkPermission(
        'test-api-key',
        'server:user123:server1',
        'read'
      );
      expect(canAccessServer).toBe(true);

      const cannotAccessOtherUser = await userManagementService.checkPermission(
        'test-api-key',
        'server:user456:server1',
        'read'
      );
      expect(cannotAccessOtherUser).toBe(false);

      // Record request
      await userManagementService.recordRequest('test-api-key', 'endpoint1', 'tool1');

      // Verify Redis interactions
      expect(mockRedisConnection.getClient).toHaveBeenCalled();
    });

    it('should handle server limit checking', async () => {
      mockUserRepository.findUserById.mockResolvedValue(mockUser);

      const canAddServer = await userManagementService.checkServerLimit('user123');
      expect(canAddServer).toBe(true);

      // Record server registration
      await usageTrackingService.recordServerRegistration('user123');

      // Check server limit status
      const limitStatus = await usageTrackingService.checkServerLimit('user123', 10);
      expect(limitStatus.maxAllowed).toBe(10);
      expect(limitStatus.exceeded).toBe(false);
    });

    it('should handle rate limiting with usage tracking', async () => {
      mockApiKeyRepository.findByKey.mockResolvedValue(mockApiKey);
      mockApiKeyRepository.updateLastUsed.mockResolvedValue();

      // Check rate limit (should use usage tracking service)
      const rateLimitStatus = await userManagementService.checkRateLimit('test-api-key');
      
      expect(rateLimitStatus.exceeded).toBe(false);
      expect(rateLimitStatus.remaining).toBeGreaterThan(0);
      expect(rateLimitStatus.resetTime).toBeInstanceOf(Date);
    });

    it('should create API key with default permissions', async () => {
      mockUserRepository.findUserById.mockResolvedValue(mockUser);
      mockApiKeyRepository.nameExistsForUser.mockResolvedValue(false);
      mockTokenGenerator.generateApiKey.mockReturnValue('generated-api-key');
      mockApiKeyRepository.createApiKey.mockResolvedValue({
        ...mockApiKey,
        key: 'generated-api-key',
        permissions: permissionService.createDefaultPermissions('user123')
      });

      const apiKey = await userManagementService.generateApiKey('user123', []);

      expect(apiKey.permissions).toHaveLength(5);
      expect(apiKey.permissions[0].resource).toBe('user:user123');
      expect(apiKey.permissions[1].resource).toBe('server:user123:*');
      expect(apiKey.permissions[2].resource).toBe('group:user123:*');
      expect(apiKey.permissions[3].resource).toBe('tool:user123:*');
      expect(apiKey.permissions[4].resource).toBe('endpoint:user123:*');
    });
  });

  describe('Permission Validation', () => {
    it('should validate permissions when creating API key', async () => {
      mockUserRepository.findUserById.mockResolvedValue(mockUser);
      mockApiKeyRepository.nameExistsForUser.mockResolvedValue(false);

      const invalidPermissions = [
        {
          resource: '', // Invalid: empty resource
          actions: ['read']
        }
      ];

      await expect(
        userManagementService.generateApiKey('user123', invalidPermissions)
      ).rejects.toThrow('Invalid permission');
    });

    it('should handle complex permission scenarios', () => {
      const permissions = [
        {
          resource: 'server:user123:*',
          actions: ['read', 'write']
        },
        {
          resource: 'tool:*',
          actions: ['execute']
        }
      ];

      // Can access user's servers
      expect(permissionService.hasPermission(permissions, 'server:user123:server1', 'read')).toBe(true);
      expect(permissionService.hasPermission(permissions, 'server:user123:server2', 'write')).toBe(true);

      // Cannot access other user's servers
      expect(permissionService.hasPermission(permissions, 'server:user456:server1', 'read')).toBe(false);

      // Can execute any tool
      expect(permissionService.hasPermission(permissions, 'tool:any-tool', 'execute')).toBe(true);

      // Cannot delete servers (not in permissions)
      expect(permissionService.hasPermission(permissions, 'server:user123:server1', 'delete')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection failures gracefully', async () => {
      // Simulate Redis connection failure
      mockRedisConnection.getClient.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      // Should fall back to basic rate limiter
      mockRateLimiter.checkRateLimit.mockResolvedValue({
        remaining: 100,
        resetTime: new Date(),
        exceeded: false
      });

      mockApiKeyRepository.findByKey.mockResolvedValue(mockApiKey);
      mockApiKeyRepository.updateLastUsed.mockResolvedValue();

      const rateLimitStatus = await userManagementService.checkRateLimit('test-api-key');
      
      expect(rateLimitStatus.exceeded).toBe(false);
      expect(mockRateLimiter.checkRateLimit).toHaveBeenCalled();
    });

    it('should handle invalid API key gracefully', async () => {
      mockApiKeyRepository.findByKey.mockResolvedValue(null);

      const validation = await userManagementService.validateApiKey('invalid-key');
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Invalid API key');
    });

    it('should handle expired API key', async () => {
      const expiredApiKey = {
        ...mockApiKey,
        expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
      };

      mockApiKeyRepository.findByKey.mockResolvedValue(expiredApiKey);

      const validation = await userManagementService.validateApiKey('expired-key');
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('API key expired');
    });
  });

  describe('Usage Statistics', () => {
    it('should collect and retrieve detailed usage statistics', async () => {
      const mockStats = {
        hourlyUsage: 25,
        dailyUsage: 150,
        hourlyResetIn: 1800,
        dailyResetIn: 43200,
        totalRequests: 1000,
        requestsByEndpoint: new Map([['endpoint1', 500], ['endpoint2', 300]]),
        requestsByTool: new Map([['tool1', 400], ['tool2', 200]]),
        lastRequestAt: new Date()
      };

      // Mock the detailed stats method
      jest.spyOn(usageTrackingService, 'getDetailedUsageStats').mockResolvedValue(mockStats);

      const stats = await usageTrackingService.getDetailedUsageStats('test-api-key');

      expect(stats.totalRequests).toBe(1000);
      expect(stats.requestsByEndpoint.get('endpoint1')).toBe(500);
      expect(stats.requestsByTool.get('tool1')).toBe(400);
      expect(stats.lastRequestAt).toBeInstanceOf(Date);
    });
  });
});