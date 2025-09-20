import { UserManagementService } from '../UserManagementService';
import { UserRepository } from '../../../infrastructure/repositories/UserRepository';
import { ApiKeyRepository } from '../../../infrastructure/repositories/ApiKeyRepository';
import { PasswordHasher } from '../../../infrastructure/utils/PasswordHasher';
import { TokenGenerator } from '../../../infrastructure/utils/TokenGenerator';
import { RateLimiter } from '../../../infrastructure/utils/RateLimiter';
import { 
  User, 
  UserCreateRequest, 
  LoginRequest, 
  SubscriptionTier 
} from '../../models/User';
import { 
  ApiKey, 
  Permission, 
  RateLimit 
} from '../../models/ApiKey';

// Mock dependencies
jest.mock('../../../infrastructure/repositories/UserRepository');
jest.mock('../../../infrastructure/repositories/ApiKeyRepository');
jest.mock('../../../infrastructure/utils/PasswordHasher');
jest.mock('../../../infrastructure/utils/TokenGenerator');
jest.mock('../../../infrastructure/utils/RateLimiter');

describe('UserManagementService', () => {
  let userManagementService: UserManagementService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockApiKeyRepository: jest.Mocked<ApiKeyRepository>;
  let mockPasswordHasher: jest.Mocked<PasswordHasher>;
  let mockTokenGenerator: jest.Mocked<TokenGenerator>;
  let mockRateLimiter: jest.Mocked<RateLimiter>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashed-password',
    subscription: SubscriptionTier.FREE,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockApiKey: ApiKey = {
    id: 'key-123',
    userId: 'user-123',
    key: 'mcp_test_key',
    name: 'Test API Key',
    permissions: [{ resource: 'servers', actions: ['read', 'write'] }],
    rateLimit: { requestsPerHour: 100, requestsPerDay: 1000, maxServers: 3 },
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    // Create mocked instances
    mockUserRepository = new UserRepository({} as any) as jest.Mocked<UserRepository>;
    mockApiKeyRepository = new ApiKeyRepository({} as any) as jest.Mocked<ApiKeyRepository>;
    mockPasswordHasher = new PasswordHasher() as jest.Mocked<PasswordHasher>;
    mockTokenGenerator = new TokenGenerator() as jest.Mocked<TokenGenerator>;
    mockRateLimiter = new RateLimiter() as jest.Mocked<RateLimiter>;

    // Create service instance
    userManagementService = new UserManagementService(
      mockUserRepository,
      mockApiKeyRepository,
      mockPasswordHasher,
      mockTokenGenerator,
      mockRateLimiter
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    const validUserRequest: UserCreateRequest = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'Password123!',
      subscription: SubscriptionTier.FREE,
    };

    it('should create a user successfully', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockPasswordHasher.hash.mockResolvedValue('hashed-password');
      mockUserRepository.createUser.mockResolvedValue(mockUser);

      // Act
      const result = await userManagementService.createUser(validUserRequest);

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('testuser');
      expect(mockPasswordHasher.hash).toHaveBeenCalledWith('Password123!');
      expect(mockUserRepository.createUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashed-password',
        subscription: SubscriptionTier.FREE,
      });
    });

    it('should throw error if email already exists', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(userManagementService.createUser(validUserRequest))
        .rejects.toThrow('Email already exists');
    });

    it('should throw error if username already exists', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(userManagementService.createUser(validUserRequest))
        .rejects.toThrow('Username already exists');
    });

    it('should throw error for invalid email format', async () => {
      // Arrange
      const invalidRequest = { ...validUserRequest, email: 'invalid-email' };

      // Act & Assert
      await expect(userManagementService.createUser(invalidRequest))
        .rejects.toThrow('Invalid email format');
    });

    it('should throw error for short username', async () => {
      // Arrange
      const invalidRequest = { ...validUserRequest, username: 'ab' };

      // Act & Assert
      await expect(userManagementService.createUser(invalidRequest))
        .rejects.toThrow('Username must be between 3 and 50 characters');
    });

    it('should throw error for invalid username characters', async () => {
      // Arrange
      const invalidRequest = { ...validUserRequest, username: 'test@user' };

      // Act & Assert
      await expect(userManagementService.createUser(invalidRequest))
        .rejects.toThrow('Username can only contain letters, numbers, underscores, and hyphens');
    });

    it('should throw error for weak password', async () => {
      // Arrange
      const invalidRequest = { ...validUserRequest, password: 'weak' };

      // Act & Assert
      await expect(userManagementService.createUser(invalidRequest))
        .rejects.toThrow('Password must be at least 8 characters long');
    });

    it('should throw error for password without complexity', async () => {
      // Arrange
      const invalidRequest = { ...validUserRequest, password: 'password123' };

      // Act & Assert
      await expect(userManagementService.createUser(invalidRequest))
        .rejects.toThrow('Password must contain at least one lowercase letter, one uppercase letter, and one number');
    });
  });

  describe('authenticateUser', () => {
    const loginRequest: LoginRequest = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should authenticate user successfully', async () => {
      // Arrange
      const expectedToken = {
        token: 'jwt-token',
        expiresAt: new Date('2024-01-02'),
        userId: 'user-123',
      };

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockPasswordHasher.verify.mockResolvedValue(true);
      mockUserRepository.updateLastLogin.mockResolvedValue();
      mockTokenGenerator.generateJwtToken.mockReturnValue('jwt-token');
      mockTokenGenerator.calculateExpirationDate.mockReturnValue(new Date('2024-01-02'));

      // Act
      const result = await userManagementService.authenticateUser(loginRequest);

      // Assert
      expect(result).toEqual(expectedToken);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockPasswordHasher.verify).toHaveBeenCalledWith('Password123!', 'hashed-password');
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith('user-123');
      expect(mockTokenGenerator.generateJwtToken).toHaveBeenCalledWith('user-123');
    });

    it('should throw error for non-existent user', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(userManagementService.authenticateUser(loginRequest))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw error for invalid password', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockPasswordHasher.verify.mockResolvedValue(false);

      // Act & Assert
      await expect(userManagementService.authenticateUser(loginRequest))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('generateApiKey', () => {
    const permissions: Permission[] = [
      { resource: 'servers', actions: ['read', 'write'] }
    ];

    it('should generate API key successfully', async () => {
      // Arrange
      mockUserRepository.findUserById.mockResolvedValue(mockUser);
      mockApiKeyRepository.nameExistsForUser.mockResolvedValue(false);
      mockTokenGenerator.generateApiKey.mockReturnValue('mcp_generated_key');
      mockApiKeyRepository.createApiKey.mockResolvedValue(mockApiKey);

      // Act
      const result = await userManagementService.generateApiKey('user-123', permissions, 'Test Key');

      // Assert
      expect(result).toEqual(mockApiKey);
      expect(mockUserRepository.findUserById).toHaveBeenCalledWith('user-123');
      expect(mockApiKeyRepository.nameExistsForUser).toHaveBeenCalledWith('user-123', 'Test Key');
      expect(mockTokenGenerator.generateApiKey).toHaveBeenCalled();
      expect(mockApiKeyRepository.createApiKey).toHaveBeenCalledWith({
        userId: 'user-123',
        key: 'mcp_generated_key',
        name: 'Test Key',
        permissions,
        rateLimit: { requestsPerHour: 100, requestsPerDay: 1000, maxServers: 3 },
        expiresAt: undefined,
      });
    });

    it('should throw error for non-existent user', async () => {
      // Arrange
      mockUserRepository.findUserById.mockResolvedValue(null);

      // Act & Assert
      await expect(userManagementService.generateApiKey('user-123', permissions))
        .rejects.toThrow('User not found');
    });

    it('should throw error for duplicate API key name', async () => {
      // Arrange
      mockUserRepository.findUserById.mockResolvedValue(mockUser);
      mockApiKeyRepository.nameExistsForUser.mockResolvedValue(true);

      // Act & Assert
      await expect(userManagementService.generateApiKey('user-123', permissions, 'Existing Key'))
        .rejects.toThrow('API key name already exists');
    });

    it('should generate API key with expiration', async () => {
      // Arrange
      const expirationDate = new Date('2024-12-31');
      mockUserRepository.findUserById.mockResolvedValue(mockUser);
      mockApiKeyRepository.nameExistsForUser.mockResolvedValue(false);
      mockTokenGenerator.generateApiKey.mockReturnValue('mcp_generated_key');
      mockTokenGenerator.calculateExpirationDate.mockReturnValue(expirationDate);
      mockApiKeyRepository.createApiKey.mockResolvedValue({
        ...mockApiKey,
        expiresAt: expirationDate,
      });

      // Act
      const result = await userManagementService.generateApiKey('user-123', permissions, 'Test Key', '30d');

      // Assert
      expect(mockTokenGenerator.calculateExpirationDate).toHaveBeenCalledWith('30d');
      expect(mockApiKeyRepository.createApiKey).toHaveBeenCalledWith({
        userId: 'user-123',
        key: 'mcp_generated_key',
        name: 'Test Key',
        permissions,
        rateLimit: { requestsPerHour: 100, requestsPerDay: 1000, maxServers: 3 },
        expiresAt: expirationDate,
      });
    });
  });

  describe('validateApiKey', () => {
    it('should validate API key successfully', async () => {
      // Arrange
      mockApiKeyRepository.findByKey.mockResolvedValue(mockApiKey);
      mockApiKeyRepository.updateLastUsed.mockResolvedValue();

      // Act
      const result = await userManagementService.validateApiKey('mcp_test_key');

      // Assert
      expect(result).toEqual({
        isValid: true,
        userId: 'user-123',
        permissions: mockApiKey.permissions,
        rateLimit: mockApiKey.rateLimit,
      });
      expect(mockApiKeyRepository.findByKey).toHaveBeenCalledWith('mcp_test_key');
      expect(mockApiKeyRepository.updateLastUsed).toHaveBeenCalledWith('mcp_test_key');
    });

    it('should return invalid for non-existent API key', async () => {
      // Arrange
      mockApiKeyRepository.findByKey.mockResolvedValue(null);

      // Act
      const result = await userManagementService.validateApiKey('invalid_key');

      // Assert
      expect(result).toEqual({
        isValid: false,
        error: 'Invalid API key',
      });
    });

    it('should return invalid for expired API key', async () => {
      // Arrange
      const expiredApiKey = {
        ...mockApiKey,
        expiresAt: new Date('2023-01-01'), // Past date
      };
      mockApiKeyRepository.findByKey.mockResolvedValue(expiredApiKey);

      // Act
      const result = await userManagementService.validateApiKey('mcp_test_key');

      // Assert
      expect(result).toEqual({
        isValid: false,
        error: 'API key expired',
      });
    });

    it('should handle validation errors gracefully', async () => {
      // Arrange
      mockApiKeyRepository.findByKey.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await userManagementService.validateApiKey('mcp_test_key');

      // Assert
      expect(result).toEqual({
        isValid: false,
        error: 'API key validation failed',
      });
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke API key successfully', async () => {
      // Arrange
      mockApiKeyRepository.findApiKeyById.mockResolvedValue(mockApiKey);
      mockApiKeyRepository.revokeApiKey.mockResolvedValue();

      // Act
      await userManagementService.revokeApiKey('key-123');

      // Assert
      expect(mockApiKeyRepository.findApiKeyById).toHaveBeenCalledWith('key-123');
      expect(mockApiKeyRepository.revokeApiKey).toHaveBeenCalledWith('key-123');
    });

    it('should throw error for non-existent API key', async () => {
      // Arrange
      mockApiKeyRepository.findApiKeyById.mockResolvedValue(null);

      // Act & Assert
      await expect(userManagementService.revokeApiKey('key-123'))
        .rejects.toThrow('API key not found');
    });
  });

  describe('checkRateLimit', () => {
    it('should check rate limit successfully', async () => {
      // Arrange
      const rateLimitStatus = {
        remaining: 95,
        resetTime: new Date('2024-01-01T01:00:00Z'),
        exceeded: false,
      };

      mockApiKeyRepository.findByKey.mockResolvedValue(mockApiKey);
      mockApiKeyRepository.updateLastUsed.mockResolvedValue();
      mockRateLimiter.checkRateLimit.mockResolvedValue(rateLimitStatus);
      mockRateLimiter.recordRequest.mockResolvedValue();

      // Act
      const result = await userManagementService.checkRateLimit('mcp_test_key');

      // Assert
      expect(result).toEqual(rateLimitStatus);
      expect(mockRateLimiter.checkRateLimit).toHaveBeenCalledWith(
        'mcp_test_key',
        100, // requestsPerHour
        1000 // requestsPerDay
      );
      expect(mockRateLimiter.recordRequest).toHaveBeenCalledWith('mcp_test_key');
    });

    it('should not record request when rate limit exceeded', async () => {
      // Arrange
      const rateLimitStatus = {
        remaining: 0,
        resetTime: new Date('2024-01-01T01:00:00Z'),
        exceeded: true,
      };

      mockApiKeyRepository.findByKey.mockResolvedValue(mockApiKey);
      mockApiKeyRepository.updateLastUsed.mockResolvedValue();
      mockRateLimiter.checkRateLimit.mockResolvedValue(rateLimitStatus);

      // Act
      const result = await userManagementService.checkRateLimit('mcp_test_key');

      // Assert
      expect(result).toEqual(rateLimitStatus);
      expect(mockRateLimiter.recordRequest).not.toHaveBeenCalled();
    });

    it('should throw error for invalid API key', async () => {
      // Arrange
      mockApiKeyRepository.findByKey.mockResolvedValue(null);

      // Act & Assert
      await expect(userManagementService.checkRateLimit('invalid_key'))
        .rejects.toThrow('Invalid API key');
    });
  });

  describe('getUserById', () => {
    it('should get user by ID successfully', async () => {
      // Arrange
      mockUserRepository.findUserById.mockResolvedValue(mockUser);

      // Act
      const result = await userManagementService.getUserById('user-123');

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findUserById).toHaveBeenCalledWith('user-123');
    });

    it('should return null for non-existent user', async () => {
      // Arrange
      mockUserRepository.findUserById.mockResolvedValue(null);

      // Act
      const result = await userManagementService.getUserById('user-123');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getUserApiKeys', () => {
    it('should get user API keys successfully', async () => {
      // Arrange
      const apiKeys = [mockApiKey];
      mockApiKeyRepository.findByUserId.mockResolvedValue(apiKeys);

      // Act
      const result = await userManagementService.getUserApiKeys('user-123');

      // Assert
      expect(result).toEqual(apiKeys);
      expect(mockApiKeyRepository.findByUserId).toHaveBeenCalledWith('user-123');
    });
  });

  describe('subscription tier rate limits', () => {
    it('should return correct rate limits for FREE tier', async () => {
      // Arrange
      const freeUser = { ...mockUser, subscription: SubscriptionTier.FREE };
      mockUserRepository.findUserById.mockResolvedValue(freeUser);
      mockApiKeyRepository.nameExistsForUser.mockResolvedValue(false);
      mockTokenGenerator.generateApiKey.mockReturnValue('mcp_generated_key');
      mockApiKeyRepository.createApiKey.mockResolvedValue(mockApiKey);

      // Act
      await userManagementService.generateApiKey('user-123', []);

      // Assert
      expect(mockApiKeyRepository.createApiKey).toHaveBeenCalledWith(
        expect.objectContaining({
          rateLimit: { requestsPerHour: 100, requestsPerDay: 1000, maxServers: 3 },
        })
      );
    });

    it('should return correct rate limits for PREMIUM tier', async () => {
      // Arrange
      const premiumUser = { ...mockUser, subscription: SubscriptionTier.PREMIUM };
      mockUserRepository.findUserById.mockResolvedValue(premiumUser);
      mockApiKeyRepository.nameExistsForUser.mockResolvedValue(false);
      mockTokenGenerator.generateApiKey.mockReturnValue('mcp_generated_key');
      mockApiKeyRepository.createApiKey.mockResolvedValue(mockApiKey);

      // Act
      await userManagementService.generateApiKey('user-123', []);

      // Assert
      expect(mockApiKeyRepository.createApiKey).toHaveBeenCalledWith(
        expect.objectContaining({
          rateLimit: { requestsPerHour: 2000, requestsPerDay: 50000, maxServers: 50 },
        })
      );
    });
  });
});