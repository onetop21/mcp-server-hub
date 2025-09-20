import { RedisConnection } from '../../infrastructure/database/redisConnection';
import { RedisRateLimiter, UsageStats } from '../../infrastructure/utils/RedisRateLimiter';
import { RateLimitStatus } from '../models/ApiKey';
import { 
  IUsageTrackingService, 
  DetailedUsageStats, 
  UserUsageStats, 
  ServerLimitStatus 
} from './IUsageTrackingService';

export class UsageTrackingService implements IUsageTrackingService {
  private rateLimiter: RedisRateLimiter;
  private redisConnection: RedisConnection;

  constructor(redisConnection: RedisConnection) {
    this.redisConnection = redisConnection;
    this.rateLimiter = new RedisRateLimiter(redisConnection);
  }

  /**
   * Check if an API key has exceeded its rate limits
   */
  async checkRateLimit(
    apiKey: string, 
    hourlyLimit: number, 
    dailyLimit: number
  ): Promise<RateLimitStatus> {
    return await this.rateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);
  }

  /**
   * Record a request for rate limiting and usage tracking
   */
  async recordRequest(
    apiKey: string, 
    endpoint?: string, 
    toolName?: string
  ): Promise<void> {
    const client = this.redisConnection.getClient();
    const now = Date.now();
    const today = new Date(now).toISOString().split('T')[0];

    // Record for rate limiting
    await this.rateLimiter.recordRequest(apiKey);

    // Record detailed usage statistics
    const pipeline = client.multi();

    // Total requests counter
    pipeline.incr(`usage:${apiKey}:total`);
    pipeline.expire(`usage:${apiKey}:total`, 30 * 24 * 60 * 60); // 30 days

    // Daily requests counter
    pipeline.incr(`usage:${apiKey}:daily:${today}`);
    pipeline.expire(`usage:${apiKey}:daily:${today}`, 31 * 24 * 60 * 60); // 31 days

    // Endpoint-specific counter
    if (endpoint) {
      pipeline.incr(`usage:${apiKey}:endpoint:${endpoint}`);
      pipeline.expire(`usage:${apiKey}:endpoint:${endpoint}`, 30 * 24 * 60 * 60); // 30 days
    }

    // Tool-specific counter
    if (toolName) {
      pipeline.incr(`usage:${apiKey}:tool:${toolName}`);
      pipeline.expire(`usage:${apiKey}:tool:${toolName}`, 30 * 24 * 60 * 60); // 30 days
    }

    // Last request timestamp
    pipeline.set(`usage:${apiKey}:last_request`, now.toString());
    pipeline.expire(`usage:${apiKey}:last_request`, 30 * 24 * 60 * 60); // 30 days

    await pipeline.exec();
  }

  /**
   * Get usage statistics for an API key
   */
  async getUsageStats(apiKey: string): Promise<UsageStats> {
    return await this.rateLimiter.getUsageStats(apiKey);
  }

  /**
   * Get detailed usage statistics for an API key
   */
  async getDetailedUsageStats(apiKey: string): Promise<DetailedUsageStats> {
    const client = this.redisConnection.getClient();
    const basicStats = await this.rateLimiter.getUsageStats(apiKey);

    // Get additional statistics
    const pipeline = client.multi();
    pipeline.get(`usage:${apiKey}:total`);
    pipeline.get(`usage:${apiKey}:last_request`);
    
    const results = await pipeline.exec();
    
    const totalRequests = parseInt(results[0] as string || '0', 10);
    const lastRequestTimestamp = results[1] as string;
    const lastRequestAt = lastRequestTimestamp ? new Date(parseInt(lastRequestTimestamp, 10)) : undefined;

    // Get endpoint and tool statistics
    const requestsByEndpoint = await this.getCountersByPattern(`usage:${apiKey}:endpoint:*`);
    const requestsByTool = await this.getCountersByPattern(`usage:${apiKey}:tool:*`);

    return {
      ...basicStats,
      totalRequests,
      requestsByEndpoint,
      requestsByTool,
      lastRequestAt,
    };
  }

  /**
   * Reset rate limit for an API key (admin operation)
   */
  async resetRateLimit(apiKey: string): Promise<void> {
    await this.rateLimiter.resetRateLimit(apiKey);
  }

  /**
   * Get usage statistics for all API keys (admin operation)
   */
  async getAllUsageStats(): Promise<Map<string, UsageStats>> {
    return await this.rateLimiter.getAllUsageStats();
  }

  /**
   * Get usage statistics for a specific user's API keys
   */
  async getUserUsageStats(userId: string): Promise<UserUsageStats> {
    const client = this.redisConnection.getClient();
    
    // Get all API keys for the user (this would typically come from the database)
    // For now, we'll get all usage keys and filter by user pattern
    const pattern = `usage:*:user:${userId}`;
    const keys = await client.keys(pattern);
    
    const apiKeyStats = new Map<string, UsageStats>();
    let totalRequests = 0;
    
    // Extract API keys from the pattern
    const apiKeys = new Set<string>();
    for (const key of keys) {
      const parts = key.split(':');
      if (parts.length >= 2) {
        apiKeys.add(parts[1]);
      }
    }

    // Get stats for each API key
    for (const apiKey of apiKeys) {
      const stats = await this.getUsageStats(apiKey);
      apiKeyStats.set(apiKey, stats);
      totalRequests += stats.hourlyUsage + stats.dailyUsage;
    }

    // Get daily request breakdown for the last 30 days
    const requestsByDay = await this.getDailyRequestsForUser(userId, 30);
    
    // Get server count
    const totalServers = await this.getServerCount(userId);

    return {
      totalApiKeys: apiKeys.size,
      totalRequests,
      totalServers,
      apiKeyStats,
      requestsByDay,
    };
  }

  /**
   * Check if a user has exceeded their server limit
   */
  async checkServerLimit(userId: string, maxServers: number): Promise<ServerLimitStatus> {
    const currentCount = await this.getServerCount(userId);
    const exceeded = currentCount >= maxServers;
    const remaining = Math.max(0, maxServers - currentCount);

    return {
      currentCount,
      maxAllowed: maxServers,
      exceeded,
      remaining,
    };
  }

  /**
   * Record server registration for limit tracking
   */
  async recordServerRegistration(userId: string): Promise<void> {
    const client = this.redisConnection.getClient();
    await client.incr(`servers:${userId}:count`);
    await client.expire(`servers:${userId}:count`, 365 * 24 * 60 * 60); // 1 year
  }

  /**
   * Record server removal for limit tracking
   */
  async recordServerRemoval(userId: string): Promise<void> {
    const client = this.redisConnection.getClient();
    const current = await client.get(`servers:${userId}:count`);
    const count = Math.max(0, parseInt(current || '0', 10) - 1);
    
    if (count === 0) {
      await client.del(`servers:${userId}:count`);
    } else {
      await client.set(`servers:${userId}:count`, count.toString());
      await client.expire(`servers:${userId}:count`, 365 * 24 * 60 * 60); // 1 year
    }
  }

  /**
   * Get server count for a user
   */
  private async getServerCount(userId: string): Promise<number> {
    const client = this.redisConnection.getClient();
    const count = await client.get(`servers:${userId}:count`);
    return parseInt(count || '0', 10);
  }

  /**
   * Get counters by pattern and return as a Map
   */
  private async getCountersByPattern(pattern: string): Promise<Map<string, number>> {
    const client = this.redisConnection.getClient();
    const keys = await client.keys(pattern);
    const result = new Map<string, number>();

    if (keys.length === 0) {
      return result;
    }

    const values = await client.mGet(keys);
    
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = parseInt(values[i] || '0', 10);
      
      // Extract the meaningful part of the key (after the last colon)
      const keyParts = key.split(':');
      const meaningfulKey = keyParts[keyParts.length - 1];
      
      result.set(meaningfulKey, value);
    }

    return result;
  }

  /**
   * Get daily requests for a user over the specified number of days
   */
  private async getDailyRequestsForUser(userId: string, days: number): Promise<Map<string, number>> {
    const client = this.redisConnection.getClient();
    const result = new Map<string, number>();
    
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      // This is a simplified approach - in practice, you'd need to aggregate
      // across all API keys for the user
      const pattern = `usage:*:daily:${dateStr}`;
      const keys = await client.keys(pattern);
      
      let dayTotal = 0;
      if (keys.length > 0) {
        const values = await client.mGet(keys);
        dayTotal = values.reduce((sum, val) => sum + parseInt(val || '0', 10), 0);
      }
      
      result.set(dateStr, dayTotal);
    }

    return result;
  }
}