import { TokenGenerator } from '../TokenGenerator';

describe('TokenGenerator', () => {
  let tokenGenerator: TokenGenerator;

  beforeEach(() => {
    tokenGenerator = new TokenGenerator('test-secret-key');
  });

  describe('generateJwtToken', () => {
    it('should generate a JWT token', () => {
      // Arrange
      const userId = 'user-123';

      // Act
      const token = tokenGenerator.generateJwtToken(userId);

      // Assert
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts separated by dots
    });

    it('should generate different tokens for different users', () => {
      // Arrange
      const userId1 = 'user-123';
      const userId2 = 'user-456';

      // Act
      const token1 = tokenGenerator.generateJwtToken(userId1);
      const token2 = tokenGenerator.generateJwtToken(userId2);

      // Assert
      expect(token1).not.toBe(token2);
    });

    it('should generate token with custom expiration', () => {
      // Arrange
      const userId = 'user-123';
      const expiresIn = '1h';

      // Act
      const token = tokenGenerator.generateJwtToken(userId, expiresIn);

      // Assert
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });

  describe('verifyJwtToken', () => {
    it('should verify a valid JWT token', () => {
      // Arrange
      const userId = 'user-123';
      const token = tokenGenerator.generateJwtToken(userId);

      // Act
      const decoded = tokenGenerator.verifyJwtToken(token);

      // Assert
      expect(decoded).toBeDefined();
      expect(decoded!.userId).toBe(userId);
      expect(decoded!.iat).toBeDefined();
      expect(typeof decoded!.iat).toBe('number');
    });

    it('should return null for invalid token', () => {
      // Arrange
      const invalidToken = 'invalid.token.here';

      // Act
      const decoded = tokenGenerator.verifyJwtToken(invalidToken);

      // Assert
      expect(decoded).toBeNull();
    });

    it('should return null for token with wrong secret', () => {
      // Arrange
      const userId = 'user-123';
      const wrongSecretGenerator = new TokenGenerator('wrong-secret');
      const token = wrongSecretGenerator.generateJwtToken(userId);

      // Act
      const decoded = tokenGenerator.verifyJwtToken(token);

      // Assert
      expect(decoded).toBeNull();
    });

    it('should return null for expired token', () => {
      // Arrange
      const userId = 'user-123';
      const token = tokenGenerator.generateJwtToken(userId, '1ms'); // Very short expiration
      
      // Act - wait for token to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          const decoded = tokenGenerator.verifyJwtToken(token);
          expect(decoded).toBeNull();
          resolve(undefined);
        }, 10);
      });
    });
  });

  describe('generateApiKey', () => {
    it('should generate an API key', () => {
      // Act
      const apiKey = tokenGenerator.generateApiKey();

      // Assert
      expect(apiKey).toBeDefined();
      expect(typeof apiKey).toBe('string');
      expect(apiKey).toMatch(/^mcp_[a-f0-9]{32}$/); // Should match pattern
    });

    it('should generate unique API keys', () => {
      // Act
      const apiKey1 = tokenGenerator.generateApiKey();
      const apiKey2 = tokenGenerator.generateApiKey();

      // Assert
      expect(apiKey1).not.toBe(apiKey2);
    });

    it('should generate API keys with correct prefix', () => {
      // Act
      const apiKey = tokenGenerator.generateApiKey();

      // Assert
      expect(apiKey).toMatch(/^mcp_/);
    });
  });

  describe('calculateExpirationDate', () => {
    it('should calculate expiration date for hours', () => {
      // Arrange
      const duration = '24h';
      const now = new Date();

      // Act
      const expirationDate = tokenGenerator.calculateExpirationDate(duration);

      // Assert
      expect(expirationDate).toBeInstanceOf(Date);
      expect(expirationDate.getTime()).toBeGreaterThan(now.getTime());
      
      // Should be approximately 24 hours from now (within 1 minute tolerance)
      const expectedTime = now.getTime() + (24 * 60 * 60 * 1000);
      expect(Math.abs(expirationDate.getTime() - expectedTime)).toBeLessThan(60 * 1000);
    });

    it('should calculate expiration date for days', () => {
      // Arrange
      const duration = '7d';
      const now = new Date();

      // Act
      const expirationDate = tokenGenerator.calculateExpirationDate(duration);

      // Assert
      expect(expirationDate).toBeInstanceOf(Date);
      expect(expirationDate.getTime()).toBeGreaterThan(now.getTime());
      
      // Should be approximately 7 days from now
      const expectedTime = now.getTime() + (7 * 24 * 60 * 60 * 1000);
      expect(Math.abs(expirationDate.getTime() - expectedTime)).toBeLessThan(60 * 1000);
    });

    it('should calculate expiration date for weeks', () => {
      // Arrange
      const duration = '2w';
      const now = new Date();

      // Act
      const expirationDate = tokenGenerator.calculateExpirationDate(duration);

      // Assert
      expect(expirationDate).toBeInstanceOf(Date);
      expect(expirationDate.getTime()).toBeGreaterThan(now.getTime());
      
      // Should be approximately 14 days from now
      const expectedTime = now.getTime() + (14 * 24 * 60 * 60 * 1000);
      expect(Math.abs(expirationDate.getTime() - expectedTime)).toBeLessThan(60 * 1000);
    });

    it('should calculate expiration date for months', () => {
      // Arrange
      const duration = '1m';
      const now = new Date();

      // Act
      const expirationDate = tokenGenerator.calculateExpirationDate(duration);

      // Assert
      expect(expirationDate).toBeInstanceOf(Date);
      expect(expirationDate.getTime()).toBeGreaterThan(now.getTime());
      
      // Should be approximately 1 month from now (allowing for month length variation)
      const expectedMinTime = now.getTime() + (28 * 24 * 60 * 60 * 1000);
      const expectedMaxTime = now.getTime() + (31 * 24 * 60 * 60 * 1000);
      expect(expirationDate.getTime()).toBeGreaterThanOrEqual(expectedMinTime);
      expect(expirationDate.getTime()).toBeLessThanOrEqual(expectedMaxTime);
    });

    it('should calculate expiration date for years', () => {
      // Arrange
      const duration = '1y';
      const now = new Date();

      // Act
      const expirationDate = tokenGenerator.calculateExpirationDate(duration);

      // Assert
      expect(expirationDate).toBeInstanceOf(Date);
      expect(expirationDate.getTime()).toBeGreaterThan(now.getTime());
      
      // Should be approximately 1 year from now
      const expectedYear = now.getFullYear() + 1;
      expect(expirationDate.getFullYear()).toBe(expectedYear);
    });

    it('should throw error for invalid duration format', () => {
      // Arrange
      const invalidDuration = 'invalid';

      // Act & Assert
      expect(() => tokenGenerator.calculateExpirationDate(invalidDuration))
        .toThrow('Invalid duration format: invalid');
    });

    it('should throw error for unsupported duration unit', () => {
      // Arrange
      const invalidDuration = '1x';

      // Act & Assert
      expect(() => tokenGenerator.calculateExpirationDate(invalidDuration))
        .toThrow('Unsupported duration unit: x');
    });
  });
});