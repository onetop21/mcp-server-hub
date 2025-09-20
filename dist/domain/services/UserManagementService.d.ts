import { User, UserCreateRequest, LoginRequest, AuthToken } from '../models/User';
import { ApiKey, Permission, ApiKeyValidation, RateLimitStatus } from '../models/ApiKey';
export interface UserManagementService {
    createUser(userData: UserCreateRequest): Promise<User>;
    authenticateUser(credentials: LoginRequest): Promise<AuthToken>;
    generateApiKey(userId: string, permissions: Permission[]): Promise<ApiKey>;
    validateApiKey(apiKey: string): Promise<ApiKeyValidation>;
    revokeApiKey(apiKeyId: string): Promise<void>;
    checkRateLimit(apiKey: string): Promise<RateLimitStatus>;
}
export declare const USER_MANAGEMENT_SERVICE: unique symbol;
//# sourceMappingURL=UserManagementService.d.ts.map