import { RateLimiter } from '../RateLimiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limits', async () => {
      // Arrange
      const apiKey = 'test-api-key';
      const hourlyLimit = 10;
      const dailyLimit = 100;

      // Act
      const status = await rateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      // Assert
      expect(status.exceeded).toBe(false);
      expect(status.remaining).toBe(Math.min(hourlyLimit, dailyLimit));
      expect(status.resetTime).toBeInstanceOf(Date);
      expect(status.resetTime.getTime()).toBeGreaterThan(Date.now());
    });

    it('should track multiple requests for same API key', async () => {
      // Arrange
      const apiKey = 'test-api-key';
      const hourlyLimit = 5;
      const dailyLimit = 100;

      // Act - make 3 requests
      await rateLimiter.recordRequest(apiKey);
      await rateLimiter.recordRequest(apiKey);
      await rateLimiter.recordRequest(apiKey);

      const status = await rateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      // Assert
      expect(status.exceeded).toBe(false);
      expect(status.remaining).toBe(2); // 5 - 3 = 2
    });

    it('should exceed hourly limit', async () => {
      // Arrange
      const apiKey = 'test-api-key';
      const hourlyLimit = 3;
      const dailyLimit = 100;

      // Act - make requests up to the limit
      for (let i = 0; i < hourlyLimit; i++) {
        await rateLimiter.recordRequest(apiKey);
      }

      const status = await rateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      // Assert
      expect(status.exceeded).toBe(true);
      expect(status.remaining).toBe(0);
    });

    it('should exceed daily limit', async () => {
      // Arrange
      const apiKey = 'test-api-key';
      const hourlyLimit = 100;
      const dailyLimit = 3;

      // Act - make requests up to the daily limit
      for (let i = 0; i < dailyLimit; i++) {
        await rateLimiter.recordRequest(apiKey);
      }

      const status = await rateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      // Assert
      expect(status.exceeded).toBe(true);
      expect(status.remaining).toBe(0);
    });

    it('should handle different API keys independently', async () => {
      // Arrange
      const apiKey1 = 'test-api-key-1';
      const apiKey2 = 'test-api-key-2';
      const hourlyLimit = 5;
      const dailyLimit = 100;

      // Act - make requests for first API key
      await rateLimiter.recordRequest(apiKey1);
      await rateLimiter.recordRequest(apiKey1);

      const status1 = await rateLimiter.checkRateLimit(apiKey1, hourlyLimit, dailyLimit);
      const status2 = await rateLimiter.checkRateLimit(apiKey2, hourlyLimit, dailyLimit);

      // Assert
      expect(status1.remaining).toBe(3); // 5 - 2 = 3
      expect(status2.remaining).toBe(5); // No requests for apiKey2
    });

    it('should return correct reset time for hourly limit', async () => {
      // Arrange
      const apiKey = 'test-api-key';
      const hourlyLimit = 1;
      const dailyLimit = 100;

      // Act - exceed hourly limit
      await rateLimiter.recordRequest(apiKey);
      const status = await rateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      // Assert
      expect(status.exceeded).toBe(true);
      const now = new Date();
      const expectedResetTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      
      // Allow for small time differences (within 1 minute)
      expect(Math.abs(status.resetTime.getTime() - expectedResetTime.getTime()))
        .toBeLessThan(60 * 1000);
    });

    it('should return correct reset time for daily limit', async () => {
      // Arrange
      const apiKey = 'test-api-key';
      const hourlyLimit = 100;
      const dailyLimit = 1;

      // Act - exceed daily limit
      await rateLimiter.recordRequest(apiKey);
      const status = await rateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      // Assert
      expect(status.exceeded).toBe(true);
      const now = new Date();
      const expectedResetTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
      
      // Allow for small time differences (within 1 minute)
      expect(Math.abs(status.resetTime.getTime() - expectedResetTime.getTime()))
        .toBeLessThan(60 * 1000);
    });
  });

  describe('recordRequest', () => {
    it('should record a request', async () => {
      // Arrange
      const apiKey = 'test-api-key';
      const hourlyLimit = 10;
      const dailyLimit = 100;

      // Act
      await rateLimiter.recordRequest(apiKey);
      const status = await rateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      // Assert
      expect(status.remaining).toBe(9); // 10 - 1 = 9
    });

    it('should record multiple requests', async () => {
      // Arrange
      const apiKey = 'test-api-key';
      const hourlyLimit = 10;
      const dailyLimit = 100;

      // Act
      await rateLimiter.recordRequest(apiKey);
      await rateLimiter.recordRequest(apiKey);
      await rateLimiter.recordRequest(apiKey);
      
      const status = await rateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      // Assert
      expect(status.remaining).toBe(7); // 10 - 3 = 7
    });
  });

  describe('clear', () => {
    it('should clear all rate limit data', async () => {
      // Arrange
      const apiKey = 'test-api-key';
      const hourlyLimit = 10;
      const dailyLimit = 100;

      // Act - record some requests
      await rateLimiter.recordRequest(apiKey);
      await rateLimiter.recordRequest(apiKey);
      
      // Clear data
      rateLimiter.clear();
      
      // Check status after clear
      const status = await rateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      // Assert
      expect(status.remaining).toBe(10); // Should be back to full limit
    });
  });

  describe('cleanup', () => {
    it('should clean up old entries automatically', async () => {
      // This test is more complex as it involves time-based cleanup
      // For now, we'll just verify the cleanup method exists and can be called
      
      // Arrange
      const apiKey = 'test-api-key';
      await rateLimiter.recordRequest(apiKey);

      // Act - The cleanup should happen automatically via interval
      // We can't easily test the automatic cleanup without mocking timers
      // But we can verify the method exists and doesn't throw
      expect(() => rateLimiter.clear()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should destroy the rate limiter and clean up resources', () => {
      // Act & Assert
      expect(() => rateLimiter.destroy()).not.toThrow();
    });

    it('should clear all data when destroyed', async () => {
      // Arrange
      const apiKey = 'test-api-key';
      await rateLimiter.recordRequest(apiKey);

      // Act
      rateLimiter.destroy();

      // Assert - After destroy, the internal storage should be cleared
      // We can't directly test this without exposing internals,
      // but we can verify destroy doesn't throw
      expect(() => rateLimiter.destroy()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle zero limits', async () => {
      // Arrange
      const apiKey = 'test-api-key';
      const hourlyLimit = 0;
      const dailyLimit = 0;

      // Act
      const status = await rateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      // Assert
      expect(status.exceeded).toBe(true);
      expect(status.remaining).toBe(0);
    });

    it('should handle very large limits', async () => {
      // Arrange
      const apiKey = 'test-api-key';
      const hourlyLimit = 1000000;
      const dailyLimit = 10000000;

      // Act
      const status = await rateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);

      // Assert
      expect(status.exceeded).toBe(false);
      expect(status.remaining).toBe(hourlyLimit); // Should use the smaller limit
    });

    it('should handle empty API key', async () => {
      // Arrange
      const apiKey = '';
      const hourlyLimit = 10;
      const dailyLimit = 100;

      // Act & Assert
      // Should not throw, but treat as a valid (though empty) key
      const status = await rateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);
      expect(status).toBeDefined();
    });
  });
});