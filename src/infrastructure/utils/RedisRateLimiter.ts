import { RateLimitStatus } from '../../domain/models/ApiKey';
import { RedisConnection } from '../database/redisConnection';

/**
 * Redis-based rate limiter for distributed rate limiting
 */
export class RedisRateLimiter {
  private redisConnection: RedisConnection;

  constructor(redisConnection: RedisConnection) {
    this.redisConnection = redisConnection;
  }

  /**
   * Check rate limit for an API key
   */
  async checkRateLimit(
    apiKey: string,
    hourlyLimit: number,
    dailyLimit: number
  ): Promise<RateLimitStatus> {
    const client = this.redisConnection.getClient();
    const now = Date.now();
    const hourKey = this.getHourlyKey(apiKey, now);
    const dayKey = this.getDailyKey(apiKey, now);

    // Use Redis pipeline for atomic operations
    const pipeline = client.multi();
    
    // Get current counts
    pipeline.get(hourKey);
    pipeline.get(dayKey);
    
    const results = await pipeline.exec();
    
    const hourlyCount = parseInt(results[0] as string || '0', 10);
    const dailyCount = parseInt(results[1] as string || '0', 10);

    const hourlyExceeded = hourlyCount >= hourlyLimit;
    const dailyExceeded = dailyCount >= dailyLimit;
    const exceeded = hourlyExceeded || dailyExceeded;

    // Calculate reset times
    const nextHour = this.getNextHourTimestamp(now);
    const nextDay = this.getNextDayTimestamp(now);
    const resetTime = hourlyExceeded ? new Date(nextHour) : new Date(nextDay);

    // Calculate remaining requests
    const hourlyRemaining = Math.max(0, hourlyLimit - hourlyCount);
    const dailyRemaining = Math.max(0, dailyLimit - dailyCount);
    const remaining = Math.min(hourlyRemaining, dailyRemaining);

    return {
      remaining,
      resetTime,
      exceeded,
    };
  }

  /**
   * Record a request for rate limiting
   */
  async recordRequest(apiKey: string): Promise<void> {
    const client = this.redisConnection.getClient();
    const now = Date.now();
    const hourKey = this.getHourlyKey(apiKey, now);
    const dayKey = this.getDailyKey(apiKey, now);

    // Use Redis pipeline for atomic operations
    const pipeline = client.multi();
    
    // Increment counters
    pipeline.incr(hourKey);
    pipeline.incr(dayKey);
    
    // Set expiration times
    const hourTTL = Math.ceil((this.getNextHourTimestamp(now) - now) / 1000);
    const dayTTL = Math.ceil((this.getNextDayTimestamp(now) - now) / 1000);
    
    pipeline.expire(hourKey, hourTTL);
    pipeline.expire(dayKey, dayTTL);
    
    await pipeline.exec();
  }

  /**
   * Get usage statistics for an API key
   */
  async getUsageStats(apiKey: string): Promise<UsageStats> {
    const client = this.redisConnection.getClient();
    const now = Date.now();
    const hourKey = this.getHourlyKey(apiKey, now);
    const dayKey = this.getDailyKey(apiKey, now);

    const pipeline = client.multi();
    pipeline.get(hourKey);
    pipeline.get(dayKey);
    pipeline.ttl(hourKey);
    pipeline.ttl(dayKey);
    
    const results = await pipeline.exec();
    
    const hourlyUsage = parseInt(results[0] as string || '0', 10);
    const dailyUsage = parseInt(results[1] as string || '0', 10);
    const hourlyTTL = results[2] as number;
    const dailyTTL = results[3] as number;

    return {
      hourlyUsage,
      dailyUsage,
      hourlyResetIn: hourlyTTL > 0 ? hourlyTTL : 0,
      dailyResetIn: dailyTTL > 0 ? dailyTTL : 0,
    };
  }

  /**
   * Reset rate limit for an API key (useful for testing or admin operations)
   */
  async resetRateLimit(apiKey: string): Promise<void> {
    const client = this.redisConnection.getClient();
    const now = Date.now();
    const hourKey = this.getHourlyKey(apiKey, now);
    const dayKey = this.getDailyKey(apiKey, now);

    await client.del([hourKey, dayKey]);
  }

  /**
   * Get all API keys with their usage stats (for admin purposes)
   */
  async getAllUsageStats(): Promise<Map<string, UsageStats>> {
    const client = this.redisConnection.getClient();
    const pattern = 'rate_limit:*';
    const keys = await client.keys(pattern);
    
    const stats = new Map<string, UsageStats>();
    
    if (keys.length === 0) {
      return stats;
    }

    // Group keys by API key
    const apiKeyGroups = new Map<string, { hourKey?: string; dayKey?: string }>();
    
    for (const key of keys) {
      const parts = key.split(':');
      if (parts.length >= 4) {
        const apiKey = parts[2];
        const type = parts[3];
        
        if (!apiKeyGroups.has(apiKey)) {
          apiKeyGroups.set(apiKey, {});
        }
        
        const group = apiKeyGroups.get(apiKey)!;
        if (type.startsWith('hour')) {
          group.hourKey = key;
        } else if (type.startsWith('day')) {
          group.dayKey = key;
        }
      }
    }

    // Get stats for each API key
    for (const [apiKey, { hourKey, dayKey }] of apiKeyGroups) {
      const pipeline = client.multi();
      
      if (hourKey) {
        pipeline.get(hourKey);
        pipeline.ttl(hourKey);
      } else {
        pipeline.get('nonexistent');
        pipeline.ttl('nonexistent');
      }
      
      if (dayKey) {
        pipeline.get(dayKey);
        pipeline.ttl(dayKey);
      } else {
        pipeline.get('nonexistent');
        pipeline.ttl('nonexistent');
      }
      
      const results = await pipeline.exec();
      
      const hourlyUsage = parseInt(results[0] as string || '0', 10);
      const hourlyTTL = results[1] as number;
      const dailyUsage = parseInt(results[2] as string || '0', 10);
      const dailyTTL = results[3] as number;

      stats.set(apiKey, {
        hourlyUsage,
        dailyUsage,
        hourlyResetIn: hourlyTTL > 0 ? hourlyTTL : 0,
        dailyResetIn: dailyTTL > 0 ? dailyTTL : 0,
      });
    }

    return stats;
  }

  /**
   * Generate Redis key for hourly rate limiting
   */
  private getHourlyKey(apiKey: string, timestamp: number): string {
    const hour = Math.floor(timestamp / (60 * 60 * 1000));
    return `rate_limit:${apiKey}:hour:${hour}`;
  }

  /**
   * Generate Redis key for daily rate limiting
   */
  private getDailyKey(apiKey: string, timestamp: number): string {
    const day = Math.floor(timestamp / (24 * 60 * 60 * 1000));
    return `rate_limit:${apiKey}:day:${day}`;
  }

  /**
   * Get timestamp for the next hour boundary
   */
  private getNextHourTimestamp(timestamp: number): number {
    const hour = Math.floor(timestamp / (60 * 60 * 1000));
    return (hour + 1) * 60 * 60 * 1000;
  }

  /**
   * Get timestamp for the next day boundary
   */
  private getNextDayTimestamp(timestamp: number): number {
    const day = Math.floor(timestamp / (24 * 60 * 60 * 1000));
    return (day + 1) * 24 * 60 * 60 * 1000;
  }
}

export interface UsageStats {
  hourlyUsage: number;
  dailyUsage: number;
  hourlyResetIn: number; // seconds until reset
  dailyResetIn: number;  // seconds until reset
}