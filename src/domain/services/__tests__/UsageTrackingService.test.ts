import { UsageTrackingService } from '../UsageTrackingService';
import { RedisConnection } from '../../../infrastructure/database/redisConnection';
import { RedisConfigManager } from '../../../infrastructure/config/RedisConfig';

// Mock Redis client
const mockRedisClient = {
  multi: jest.fn(),
  get: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  mGet: jest.fn(),
  set: jest.fn(),
};

const mockPipeline = {
  get: jest.fn().mockReturnThis(),
  incr: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  ttl: jest.fn().mockReturnThis(),
  exec: jest.fn(),
};

// Mock RedisConnection
jest.mock('../../../infrastructure/database/redisConnection');
const MockRedisConnection = RedisConnection as jest.MockedClass<typeof RedisConnection>;

describe('UsageTrackingService', () => {
  let usageTrackingService: UsageTrackingService;
  let mockRedisConnection: jest.Mocked<RedisConnection>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRedisConnection = new MockRedisConnection(RedisConfigManager.getConfig()) as jest.Mocked<RedisConnection>;
    mockRedisConnection.getClient = jest.fn().mockReturnValue(mockRedisClient);
    
    mockRedisClient.multi.mockReturnValue(mockPipeline);
    
    usageTrackingService = new UsageTrackingService(mockRedisConnection);
  });

  describe('checkRateLimit', () => {
    it('should check rate limits correctly', async () => {
      const apiKey = 'test-api-key';
      const hourlyLimit = 100;
      const dailyLimit = 1000;

      // Mock pipeline execution results
      mockPipeline.exec.mockResolvedValue(['50', '200']); // hourly: 50, daily: 200

      const result = await usageTrackingService.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      expect(result.remaining).toBe(50); // min(100-50, 1000-200) = 50
      expect(result.exceeded).toBe(false);
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

      const result = await usageTrackingService.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      expect(result.remaining).toBe(0);
      expect(result.exceeded).toBe(true);
    });

    it('should detect when daily limit is exceeded', async () => {
      const apiKey = 'test-api-key';
      const hourlyLimit = 100;
      const dailyLimit = 1000;

      // Mock pipeline execution results - daily limit exceeded
      mockPipeline.exec.mockResolvedValue(['50', '1000']); // hourly: 50, daily: 1000

      const result = await usageTrackingService.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      expect(result.remaining).toBe(0);
      expect(result.exceeded).toBe(true);
    });
  });

  describe('recordRequest', () => {
    it('should record a request with all parameters', async () => {
      const apiKey = 'test-api-key';
      const endpoint = 'test-endpoint';
      const toolName = 'test-tool';

      mockPipeline.exec.mockResolvedValue([]);

      await usageTrackingService.recordRequest(apiKey, endpoint, toolName);

      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(mockPipeline.incr).toHaveBeenCalledWith(`usage:${apiKey}:total`);
      expect(mockPipeline.incr).toHaveBeenCalledWith(expect.stringMatching(`usage:${apiKey}:daily:`));
      expect(mockPipeline.incr).toHaveBeenCalledWith(`usage:${apiKey}:endpoint:${endpoint}`);
      expect(mockPipeline.incr).toHaveBeenCalledWith(`usage:${apiKey}:tool:${toolName}`);
      expect(mockPipeline.set).toHaveBeenCalledWith(`usage:${apiKey}:last_request`, expect.any(String));
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should record a request without optional parameters', async () => {
      const apiKey = 'test-api-key';

      mockPipeline.exec.mockResolvedValue([]);

      await usageTrackingService.recordRequest(apiKey);

      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(mockPipeline.incr).toHaveBeenCalledWith(`usage:${apiKey}:total`);
      expect(mockPipeline.incr).toHaveBeenCalledWith(expect.stringMatching(`usage:${apiKey}:daily:`));
      expect(mockPipeline.set).toHaveBeenCalledWith(`usage:${apiKey}:last_request`, expect.any(String));
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe('getDetailedUsageStats', () => {
    it('should return detailed usage statistics', async () => {
      const apiKey = 'test-api-key';
      const now = Date.now();

      // Mock basic stats
      mockPipeline.exec.mockResolvedValueOnce(['10', '5', 3600, 86400]); // basic stats
      mockPipeline.exec.mockResolvedValueOnce(['500', now.toString()]); // detailed stats

      // Mock pattern searches
      mockRedisClient.keys.mockResolvedValueOnce([
        `usage:${apiKey}:endpoint:endpoint1`,
        `usage:${apiKey}:endpoint:endpoint2`
      ]);
      mockRedisClient.mGet.mockResolvedValueOnce(['10', '5']);

      mockRedisClient.keys.mockResolvedValueOnce([
        `usage:${apiKey}:tool:tool1`,
        `usage:${apiKey}:tool:tool2`
      ]);
      mockRedisClient.mGet.mockResolvedValueOnce(['8', '7']);

      const result = await usageTrackingService.getDetailedUsageStats(apiKey);

      expect(result.totalRequests).toBe(500);
      expect(result.lastRequestAt).toEqual(new Date(now));
      expect(result.requestsByEndpoint.get('endpoint1')).toBe(10);
      expect(result.requestsByEndpoint.get('endpoint2')).toBe(5);
      expect(result.requestsByTool.get('tool1')).toBe(8);
      expect(result.requestsByTool.get('tool2')).toBe(7);
    });
  });

  describe('checkServerLimit', () => {
    it('should check server limits correctly', async () => {
      const userId = 'test-user';
      const maxServers = 10;

      mockRedisClient.get.mockResolvedValue('5');

      const result = await usageTrackingService.checkServerLimit(userId, maxServers);

      expect(result.currentCount).toBe(5);
      expect(result.maxAllowed).toBe(10);
      expect(result.exceeded).toBe(false);
      expect(result.remaining).toBe(5);
      expect(mockRedisClient.get).toHaveBeenCalledWith(`servers:${userId}:count`);
    });

    it('should detect when server limit is exceeded', async () => {
      const userId = 'test-user';
      const maxServers = 10;

      mockRedisClient.get.mockResolvedValue('10');

      const result = await usageTrackingService.checkServerLimit(userId, maxServers);

      expect(result.currentCount).toBe(10);
      expect(result.maxAllowed).toBe(10);
      expect(result.exceeded).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should handle missing server count', async () => {
      const userId = 'test-user';
      const maxServers = 10;

      mockRedisClient.get.mockResolvedValue(null);

      const result = await usageTrackingService.checkServerLimit(userId, maxServers);

      expect(result.currentCount).toBe(0);
      expect(result.maxAllowed).toBe(10);
      expect(result.exceeded).toBe(false);
      expect(result.remaining).toBe(10);
    });
  });

  describe('recordServerRegistration', () => {
    it('should increment server count', async () => {
      const userId = 'test-user';

      await usageTrackingService.recordServerRegistration(userId);

      expect(mockRedisClient.incr).toHaveBeenCalledWith(`servers:${userId}:count`);
      expect(mockRedisClient.expire).toHaveBeenCalledWith(`servers:${userId}:count`, 365 * 24 * 60 * 60);
    });
  });

  describe('recordServerRemoval', () => {
    it('should decrement server count', async () => {
      const userId = 'test-user';

      mockRedisClient.get.mockResolvedValue('5');

      await usageTrackingService.recordServerRemoval(userId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(`servers:${userId}:count`);
      expect(mockRedisClient.set).toHaveBeenCalledWith(`servers:${userId}:count`, '4');
      expect(mockRedisClient.expire).toHaveBeenCalledWith(`servers:${userId}:count`, 365 * 24 * 60 * 60);
    });

    it('should delete key when count reaches zero', async () => {
      const userId = 'test-user';

      mockRedisClient.get.mockResolvedValue('1');

      await usageTrackingService.recordServerRemoval(userId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(`servers:${userId}:count`);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`servers:${userId}:count`);
    });

    it('should handle missing server count gracefully', async () => {
      const userId = 'test-user';

      mockRedisClient.get.mockResolvedValue(null);

      await usageTrackingService.recordServerRemoval(userId);

      expect(mockRedisClient.get).toHaveBeenCalledWith(`servers:${userId}:count`);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`servers:${userId}:count`);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for an API key', async () => {
      const apiKey = 'test-api-key';

      await usageTrackingService.resetRateLimit(apiKey);

      expect(mockRedisClient.del).toHaveBeenCalledWith([
        expect.stringMatching(`rate_limit:${apiKey}:hour:`),
        expect.stringMatching(`rate_limit:${apiKey}:day:`)
      ]);
    });
  });
});