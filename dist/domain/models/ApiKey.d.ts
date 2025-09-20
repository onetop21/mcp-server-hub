export interface ApiKey {
    id: string;
    userId: string;
    key: string;
    name: string;
    permissions: Permission[];
    rateLimit: RateLimit;
    createdAt: Date;
    expiresAt?: Date;
    lastUsedAt?: Date;
}
export interface Permission {
    resource: string;
    actions: string[];
}
export interface RateLimit {
    requestsPerHour: number;
    requestsPerDay: number;
    maxServers: number;
}
export interface ApiKeyValidation {
    isValid: boolean;
    userId?: string;
    permissions?: Permission[];
    rateLimit?: RateLimit;
    error?: string;
}
export interface RateLimitStatus {
    remaining: number;
    resetTime: Date;
    exceeded: boolean;
}
//# sourceMappingURL=ApiKey.d.ts.map