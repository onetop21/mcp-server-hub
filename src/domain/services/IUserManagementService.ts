import { 
  User, 
  UserCreateRequest, 
  LoginRequest, 
  AuthToken, 
  ApiKey, 
  Permission, 
  ApiKeyValidation, 
  RateLimitStatus 
} from '../models';

export interface IUserManagementService {
  /**
   * Create a new user account
   */
  createUser(userData: UserCreateRequest): Promise<User>;

  /**
   * Authenticate user with credentials
   */
  authenticateUser(credentials: LoginRequest): Promise<AuthToken>;

  /**
   * Generate a new API key for a user
   */
  generateApiKey(userId: string, permissions: Permission[]): Promise<ApiKey>;

  /**
   * Validate an API key and return user information
   */
  validateApiKey(apiKey: string): Promise<ApiKeyValidation>;

  /**
   * Revoke an API key
   */
  revokeApiKey(apiKeyId: string): Promise<void>;

  /**
   * Check rate limit status for an API key
   */
  checkRateLimit(apiKey: string): Promise<RateLimitStatus>;

  /**
   * Get user by ID
   */
  getUserById(userId: string): Promise<User | null>;

  /**
   * Get user's API keys
   */
  getUserApiKeys(userId: string): Promise<ApiKey[]>;
}