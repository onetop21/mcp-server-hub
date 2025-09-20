import { RedisRateLimiter } from '../RedisRateLimiter';
import { RedisConnection } from '../../database/redisConnection';
import { RedisConfigManager } from '../../config/RedisConfig';

// Mock Redis client
const mockRedisClient = {
  multi: jest.fn(),
  get: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  mGet: jest.fn(),
};

const mockPipeline = {
  get: jest.fn().mockReturnThis(),
  incr: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  ttl: jest.fn().mockReturnThis(),
  exec: jest.fn(),
};

// Mock RedisConnection
jest.mock('../../database/redisConnection');
const MockRedisConnection = RedisConnection as jest.MockedClass<typeof RedisConnection>;

describe('RedisRateLimiter', () => {
  let redisRateLimiter: RedisRateLimiter;
  let mockRedisConnection: jest.Mocked<RedisConnection>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRedisConnection = new MockRedisConnection(RedisConfigManager.getConfig()) as jest.Mocked<RedisConnection>;
    mockRedisConnection.getClient = jest.fn().mockReturnValue(mockRedisClient);
    
    mockRedisClient.multi.mockReturnValue(mockPipeline);
    
    redisRateLimiter = new RedisRateLimiter(mockRedisConnection);
  });

  describe('checkRateLimit', () => {
    it('should return correct rate limit status when under limits', async () => {
      const apiKey = 'test-api-key';
      const hourlyLimit = 100;
      const dailyLimit = 1000;

      // Mock pipeline execution results
      mockPipeline.exec.mockResolvedValue(['50', '200']); // hourly: 50, daily: 200

      const result = await redisRateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      expect(result.remaining).toBe(50); // min(100-50, 1000-200) = 50
      expect(result.exceeded).toBe(false);
      expect(result.resetTime).toBeInstanceOf(Date);
      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(mockPipeline.get).toHaveBeenCalledTimes(2);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should detect when hourly limit is exceeded', async () => {
      const apiKey = 'test-api-key';
      const hourlyLimit = 100;
      const dailyLimit = 1000;

      // Mock pipeline execution results - hourly limit exceeded
      mockPipeline.exec.mockResolvedValue(['100', '200']); // hourly: 100, daily: 200

      const result = await redisRateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      expect(result.remaining).toBe(0);
      expect(result.exceeded).toBe(true);
    });

    it('should detect when daily limit is exceeded', async () => {
      const apiKey = 'test-api-key';
      const hourlyLimit = 100;
      const dailyLimit = 1000;

      // Mock pipeline execution results - daily limit exceeded
      mockPipeline.exec.mockResolvedValue(['50', '1000']); // hourly: 50, daily: 1000

      const result = await redisRateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      expect(result.remaining).toBe(0);
      expect(result.exceeded).toBe(true);
    });

    it('should handle missing values gracefully', async () => {
      const apiKey = 'test-api-key';
      const hourlyLimit = 100;
      const dailyLimit = 1000;

      // Mock pipeline execution results - no previous data
      mockPipeline.exec.mockResolvedValue([null, null]);

      const result = await redisRateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      expect(result.remaining).toBe(100); // min(100-0, 1000-0) = 100
      expect(result.exceeded).toBe(false);
    });
  });

  describe('recordRequest', () => {
    it('should record a request and set appropriate TTLs', async () => {
      const apiKey = 'test-api-key';

      mockPipeline.exec.mockResolvedValue([]);

      await redisRateLimiter.recordRequest(apiKey);

      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(mockPipeline.incr).toHaveBeenCalledTimes(2); // hourly and daily
      expect(mockPipeline.expire).toHaveBeenCalledTimes(2); // TTL for both keys
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics', async () => {
      const apiKey = 'test-api-key';

      mockPipeline.exec.mockResolvedValue(['25', '150', 1800, 43200]); // usage and TTLs

      const result = await redisRateLimiter.getUsageStats(apiKey);

      expect(result.hourlyUsage).toBe(25);
      expect(result.dailyUsage).toBe(150);
      expect(result.hourlyResetIn).toBe(1800);
      expect(result.dailyResetIn).toBe(43200);
      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(mockPipeline.get).toHaveBeenCalledTimes(2);
      expect(mockPipeline.ttl).toHaveBeenCalledTimes(2);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should handle missing data gracefully', async () => {
      const apiKey = 'test-api-key';

      mockPipeline.exec.mockResolvedValue([null, null, -1, -1]); // no data

      const result = await redisRateLimiter.getUsageStats(apiKey);

      expect(result.hourlyUsage).toBe(0);
      expect(result.dailyUsage).toBe(0);
      expect(result.hourlyResetIn).toBe(0);
      expect(result.dailyResetIn).toBe(0);
    });
  });

  describe('resetRateLimit', () => {
    it('should delete rate limit keys', async () => {
      const apiKey = 'test-api-key';

      await redisRateLimiter.resetRateLimit(apiKey);

      expect(mockRedisClient.del).toHaveBeenCalledWith([
        expect.stringMatching(`rate_limit:${apiKey}:hour:`),
        expect.stringMatching(`rate_limit:${apiKey}:day:`)
      ]);
    });
  });

  describe('getAllUsageStats', () => {
    it('should return usage stats for all API keys', async () => {
      const keys = [
        'rate_limit:api1:hour:123',
        'rate_limit:api1:day:456',
        'rate_limit:api2:hour:123',
        'rate_limit:api2:day:456'
      ];

      mockRedisClient.keys.mockResolvedValue(keys);
      
      // Mock pipeline results for each API key
      mockPipeline.exec
        .mockResolvedValueOnce(['10', 1800, '50', 43200]) // api1
        .mockResolvedValueOnce(['5', 1800, '25', 43200]); // api2

      const result = await redisRateLimiter.getAllUsageStats();

      expect(result.size).toBe(2);
      expect(result.get('api1')).toEqual({
        hourlyUsage: 10,
        dailyUsage: 50,
        hourlyResetIn: 1800,
        dailyResetIn: 43200
      });
      expect(result.get('api2')).toEqual({
        hourlyUsage: 5,
        dailyUsage: 25,
        hourlyResetIn: 1800,
        dailyResetIn: 43200
      });
    });

    it('should handle empty keys gracefully', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      const result = await redisRateLimiter.getAllUsageStats();

      expect(result.size).toBe(0);
    });
  });

  describe('key generation', () => {
    it('should generate consistent hourly keys', () => {
      const apiKey = 'test-key';
      const timestamp1 = new Date('2023-01-01T10:30:00Z').getTime();
      const timestamp2 = new Date('2023-01-01T10:45:00Z').getTime();
      const timestamp3 = new Date('2023-01-01T11:15:00Z').getTime();

      // Access private method through any cast for testing
      const limiter = redisRateLimiter as any;
      
      const key1 = limiter.getHourlyKey(apiKey, timestamp1);
      const key2 = limiter.getHourlyKey(apiKey, timestamp2);
      const key3 = limiter.getHourlyKey(apiKey, timestamp3);

      // Same hour should generate same key
      expect(key1).toBe(key2);
      // Different hour should generate different key
      expect(key1).not.toBe(key3);
    });

    it('should generate consistent daily keys', () => {
      const apiKey = 'test-key';
      const timestamp1 = new Date('2023-01-01T10:30:00Z').getTime();
      const timestamp2 = new Date('2023-01-01T23:45:00Z').getTime();
      const timestamp3 = new Date('2023-01-02T01:15:00Z').getTime();

      // Access private method through any cast for testing
      const limiter = redisRateLimiter as any;
      
      const key1 = limiter.getDailyKey(apiKey, timestamp1);
      const key2 = limiter.getDailyKey(apiKey, timestamp2);
      const key3 = limiter.getDailyKey(apiKey, timestamp3);

      // Same day should generate same key
      expect(key1).toBe(key2);
      // Different day should generate different key
      expect(key1).not.toBe(key3);
    });
  });

  describe('timestamp calculations', () => {
    it('should calculate next hour timestamp correctly', () => {
      const timestamp = new Date('2023-01-01T10:30:00Z').getTime();
      const expectedNext = new Date('2023-01-01T11:00:00Z').getTime();

      // Access private method through any cast for testing
      const limiter = redisRateLimiter as any;
      const nextHour = limiter.getNextHourTimestamp(timestamp);

      expect(nextHour).toBe(expectedNext);
    });

    it('should calculate next day timestamp correctly', () => {
      const timestamp = new Date('2023-01-01T10:30:00Z').getTime();
      const expectedNext = new Date('2023-01-02T00:00:00Z').getTime();

      // Access private method through any cast for testing
      const limiter = redisRateLimiter as any;
      const nextDay = limiter.getNextDayTimestamp(timestamp);

      expect(nextDay).toBe(expectedNext);
    });
  });
});