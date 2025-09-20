import { RateLimitStatus } from '../models/ApiKey';
import { UsageStats } from '../../infrastructure/utils/RedisRateLimiter';

export interface IUsageTrackingService {
  /**
   * Check if an API key has exceeded its rate limits
   */
  checkRateLimit(apiKey: string, hourlyLimit: number, dailyLimit: number): Promise<RateLimitStatus>;

  /**
   * Record a request for rate limiting and usage tracking
   */
  recordRequest(apiKey: string, endpoint?: string, toolName?: string): Promise<void>;

  /**
   * Get usage statistics for an API key
   */
  getUsageStats(apiKey: string): Promise<UsageStats>;

  /**
   * Get detailed usage statistics for an API key
   */
  getDetailedUsageStats(apiKey: string): Promise<DetailedUsageStats>;

  /**
   * Reset rate limit for an API key (admin operation)
   */
  resetRateLimit(apiKey: string): Promise<void>;

  /**
   * Get usage statistics for all API keys (admin operation)
   */
  getAllUsageStats(): Promise<Map<string, UsageStats>>;

  /**
   * Get usage statistics for a specific user's API keys
   */
  getUserUsageStats(userId: string): Promise<UserUsageStats>;

  /**
   * Check if a user has exceeded their server limit
   */
  checkServerLimit(userId: string, maxServers: number): Promise<ServerLimitStatus>;

  /**
   * Record server registration for limit tracking
   */
  recordServerRegistration(userId: string): Promise<void>;

  /**
   * Record server removal for limit tracking
   */
  recordServerRemoval(userId: string): Promise<void>;
}

export interface DetailedUsageStats extends UsageStats {
  totalRequests: number;
  requestsByEndpoint: Map<string, number>;
  requestsByTool: Map<string, number>;
  averageResponseTime?: number;
  errorRate?: number;
  lastRequestAt?: Date;
}

export interface UserUsageStats {
  totalApiKeys: number;
  totalRequests: number;
  totalServers: number;
  apiKeyStats: Map<string, UsageStats>;
  requestsByDay: Map<string, number>; // ISO date string -> count
}

export interface ServerLimitStatus {
  currentCount: number;
  maxAllowed: number;
  exceeded: boolean;
  remaining: number;
}