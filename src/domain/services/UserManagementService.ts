import { IUserManagementService } from './IUserManagementService';
import { 
  User, 
  UserCreateRequest, 
  LoginRequest, 
  AuthToken, 
  SubscriptionTier 
} from '../models/User';
import { 
  ApiKey, 
  Permission, 
  ApiKeyValidation, 
  RateLimitStatus, 
  RateLimit 
} from '../models/ApiKey';
import { UserRepository } from '../../infrastructure/repositories/UserRepository';
import { ApiKeyRepository } from '../../infrastructure/repositories/ApiKeyRepository';
import { PasswordHasher } from '../../infrastructure/utils/PasswordHasher';
import { TokenGenerator } from '../../infrastructure/utils/TokenGenerator';
import { RateLimiter } from '../../infrastructure/utils/RateLimiter';
import { IUsageTrackingService } from './IUsageTrackingService';
import { IPermissionService } from './IPermissionService';
import { v4 as uuidv4 } from 'uuid';

/**
 * User Management Service Implementation
 * Handles user registration, authentication, and API key management
 */
export class UserManagementService implements IUserManagementService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenGenerator: TokenGenerator,
    private readonly rateLimiter: RateLimiter,
    private readonly usageTrackingService?: IUsageTrackingService,
    private readonly permissionService?: IPermissionService
  ) {}

  /**
   * Create a new user account
   */
  async createUser(userData: UserCreateRequest): Promise<User> {
    // Validate input
    await this.validateUserCreateRequest(userData);

    // Check if email or username already exists
    const existingEmail = await this.userRepository.findByEmail(userData.email);
    if (existingEmail) {
      throw new Error('Email already exists');
    }

    const existingUsername = await this.userRepository.findByUsername(userData.username);
    if (existingUsername) {
      throw new Error('Username already exists');
    }

    // Hash password
    const passwordHash = await this.passwordHasher.hash(userData.password);

    // Create user
    const user = await this.userRepository.createUser({
      email: userData.email,
      username: userData.username,
      passwordHash,
      subscription: userData.subscription || SubscriptionTier.FREE,
    });

    return user;
  }

  /**
   * Authenticate user with credentials
   */
  async authenticateUser(credentials: LoginRequest): Promise<AuthToken> {
    // Find user by email
    const user = await this.userRepository.findByEmail(credentials.email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await this.passwordHasher.verify(
      credentials.password,
      user.passwordHash
    );
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    // Generate JWT token
    const token = this.tokenGenerator.generateJwtToken(user.id);
    const expiresAt = this.tokenGenerator.calculateExpirationDate('24h');

    return {
      token,
      expiresAt,
      userId: user.id,
    };
  }

  /**
   * Generate a new API key for a user
   */
  async generateApiKey(
    userId: string, 
    permissions: Permission[], 
    name?: string,
    expiresIn?: string
  ): Promise<ApiKey> {
    // Verify user exists
    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if name is unique for this user
    const keyName = name || `API Key ${new Date().toISOString()}`;
    const nameExists = await this.apiKeyRepository.nameExistsForUser(userId, keyName);
    if (nameExists) {
      throw new Error('API key name already exists');
    }

    // Get default rate limits based on subscription
    const rateLimit = this.getDefaultRateLimit(user.subscription);

    // Use default permissions if none provided and permission service is available
    let finalPermissions = permissions;
    if ((!permissions || permissions.length === 0) && this.permissionService) {
      finalPermissions = this.permissionService.createDefaultPermissions(userId);
    }

    // Validate permissions if permission service is available
    if (this.permissionService) {
      for (const permission of finalPermissions) {
        if (!this.permissionService.validatePermission(permission)) {
          throw new Error(`Invalid permission: ${JSON.stringify(permission)}`);
        }
      }
    }

    // Generate API key
    const key = this.tokenGenerator.generateApiKey();
    
    // Calculate expiration date if provided
    const expiresAt = expiresIn ? 
      this.tokenGenerator.calculateExpirationDate(expiresIn) : 
      undefined;

    // Create API key
    const apiKey = await this.apiKeyRepository.createApiKey({
      userId,
      key,
      name: keyName,
      permissions: finalPermissions,
      rateLimit,
      expiresAt,
    });

    return apiKey;
  }

  /**
   * Validate an API key and return user information
   */
  async validateApiKey(apiKey: string): Promise<ApiKeyValidation> {
    try {
      // Find API key
      const keyData = await this.apiKeyRepository.findByKey(apiKey);
      if (!keyData) {
        return {
          isValid: false,
          error: 'Invalid API key',
        };
      }

      // Check if key is expired
      if (keyData.expiresAt && keyData.expiresAt <= new Date()) {
        return {
          isValid: false,
          error: 'API key expired',
        };
      }

      // Update last used timestamp
      await this.apiKeyRepository.updateLastUsed(apiKey);

      return {
        isValid: true,
        userId: keyData.userId,
        permissions: keyData.permissions,
        rateLimit: keyData.rateLimit,
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'API key validation failed',
      };
    }
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(apiKeyId: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findApiKeyById(apiKeyId);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    await this.apiKeyRepository.revokeApiKey(apiKeyId);
  }

  /**
   * Check rate limit status for an API key
   */
  async checkRateLimit(apiKey: string): Promise<RateLimitStatus> {
    // Validate API key first
    const validation = await this.validateApiKey(apiKey);
    if (!validation.isValid || !validation.rateLimit) {
      throw new Error('Invalid API key');
    }

    // Use usage tracking service if available, otherwise fall back to basic rate limiter
    if (this.usageTrackingService) {
      return await this.usageTrackingService.checkRateLimit(
        apiKey,
        validation.rateLimit.requestsPerHour,
        validation.rateLimit.requestsPerDay
      );
    } else {
      // Check rate limit with basic rate limiter
      const status = await this.rateLimiter.checkRateLimit(
        apiKey,
        validation.rateLimit.requestsPerHour,
        validation.rateLimit.requestsPerDay
      );

      // Record the request if not exceeded
      if (!status.exceeded) {
        await this.rateLimiter.recordRequest(apiKey);
      }

      return status;
    }
  }

  /**
   * Record a request for usage tracking
   */
  async recordRequest(apiKey: string, endpoint?: string, toolName?: string): Promise<void> {
    if (this.usageTrackingService) {
      await this.usageTrackingService.recordRequest(apiKey, endpoint, toolName);
    } else {
      // Fall back to basic rate limiter
      await this.rateLimiter.recordRequest(apiKey);
    }
  }

  /**
   * Check if user has permission to perform an action
   */
  async checkPermission(
    apiKey: string, 
    resource: string, 
    action: string
  ): Promise<boolean> {
    if (!this.permissionService) {
      return true; // Allow all if no permission service
    }

    const validation = await this.validateApiKey(apiKey);
    if (!validation.isValid || !validation.permissions) {
      return false;
    }

    return this.permissionService.hasPermission(validation.permissions, resource, action);
  }

  /**
   * Check server limit for a user
   */
  async checkServerLimit(userId: string): Promise<boolean> {
    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const rateLimit = this.getDefaultRateLimit(user.subscription);
    
    if (this.usageTrackingService) {
      const status = await this.usageTrackingService.checkServerLimit(userId, rateLimit.maxServers);
      return !status.exceeded;
    }

    // If no usage tracking service, we can't check server limits
    return true;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.userRepository.findUserById(userId);
  }

  /**
   * Get user's API keys
   */
  async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    return this.apiKeyRepository.findByUserId(userId);
  }

  /**
   * Validate user creation request
   */
  private async validateUserCreateRequest(userData: UserCreateRequest): Promise<void> {
    // Email validation
    if (!userData.email || !this.isValidEmail(userData.email)) {
      throw new Error('Invalid email format');
    }

    // Username validation
    if (!userData.username || userData.username.length < 3 || userData.username.length > 50) {
      throw new Error('Username must be between 3 and 50 characters');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(userData.username)) {
      throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
    }

    // Password validation
    if (!userData.password || userData.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(userData.password)) {
      throw new Error('Password must contain at least one lowercase letter, one uppercase letter, and one number');
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get default rate limits based on subscription tier
   */
  private getDefaultRateLimit(subscription: SubscriptionTier): RateLimit {
    switch (subscription) {
      case SubscriptionTier.FREE:
        return {
          requestsPerHour: 100,
          requestsPerDay: 1000,
          maxServers: 3,
        };
      case SubscriptionTier.BASIC:
        return {
          requestsPerHour: 500,
          requestsPerDay: 10000,
          maxServers: 10,
        };
      case SubscriptionTier.PREMIUM:
        return {
          requestsPerHour: 2000,
          requestsPerDay: 50000,
          maxServers: 50,
        };
      case SubscriptionTier.ENTERPRISE:
        return {
          requestsPerHour: 10000,
          requestsPerDay: 500000,
          maxServers: 1000,
        };
      default:
        return {
          requestsPerHour: 100,
          requestsPerDay: 1000,
          maxServers: 3,
        };
    }
  }
}

export const USER_MANAGEMENT_SERVICE = Symbol.for('UserManagementService');