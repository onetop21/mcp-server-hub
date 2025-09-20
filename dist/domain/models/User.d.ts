export interface User {
    id: string;
    email: string;
    username: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
    subscription: SubscriptionTier;
}
export declare enum SubscriptionTier {
    FREE = "free",
    BASIC = "basic",
    PREMIUM = "premium",
    ENTERPRISE = "enterprise"
}
export interface UserCreateRequest {
    email: string;
    username: string;
    password: string;
    subscription?: SubscriptionTier;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface AuthToken {
    token: string;
    expiresAt: Date;
    userId: string;
}
//# sourceMappingURL=User.d.ts.map