import { ApiKeyRepository } from '../ApiKeyRepository';
import { DatabaseConnection } from '../../database/connection';
import { ApiKey, Permission, RateLimit } from '../../../domain/models/ApiKey';

// Mock the database connection
jest.mock('../../database/connection');

describe('ApiKeyRepository', () => {
  let apiKeyRepository: ApiKeyRepository;
  let mockDb: jest.Mocked<DatabaseConnection>;

  const mockApiKeyRow = {
    id: 'key-123',
    user_id: 'user-123',
    key_hash: 'hashed-key',
    name: 'Test API Key',
    permissions: JSON.stringify([{ resource: 'servers', actions: ['read', 'write'] }]),
    rate_limit: JSON.stringify({ requestsPerHour: 100, requestsPerDay: 1000, maxServers: 3 }),
    created_at: new Date('2024-01-01'),
    expires_at: undefined,
    last_used_at: undefined,
  };

  const mockApiKey: ApiKey = {
    id: 'key-123',
    userId: 'user-123',
    key: 'original-key',
    name: 'Test API Key',
    permissions: [{ resource: 'servers', actions: ['read', 'write'] }],
    rateLimit: { requestsPerHour: 100, requestsPerDay: 1000, maxServers: 3 },
    createdAt: new Date('2024-01-01'),
    expiresAt: undefined,
    lastUsedAt: undefined,
  };

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      connect: jest.fn(),
      close: jest.fn(),
    } as any;

    apiKeyRepository = new ApiKeyRepository(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findApiKeyById', () => {
    it('should find API key by ID', async () => {
      // Arrange
      const findByIdSpy = jest.spyOn(apiKeyRepository as any, 'findById')
        .mockResolvedValue(mockApiKeyRow);

      // Act
      const result = await apiKeyRepository.findApiKeyById('key-123');

      // Assert
      expect(result).toEqual({
        ...mockApiKey,
        key: 'hashed-key', // Should return hash since no original key provided
      });
      expect(findByIdSpy).toHaveBeenCalledWith('key-123');
    });

    it('should return null when API key not found', async () => {
      // Arrange
      const findByIdSpy = jest.spyOn(apiKeyRepository as any, 'findById')
        .mockResolvedValue(null);

      // Act
      const result = await apiKeyRepository.findApiKeyById('key-123');

      // Assert
      expect(result).toBeNull();
      expect(findByIdSpy).toHaveBeenCalledWith('key-123');
    });
  });

  describe('findByKey', () => {
    it('should find API key by key value', async () => {
      // Arrange
      const findOneByQuerySpy = jest.spyOn(apiKeyRepository as any, 'findOneByQuery')
        .mockResolvedValue(mockApiKeyRow);

      // Act
      const result = await apiKeyRepository.findByKey('original-key');

      // Assert
      expect(result).toEqual(mockApiKey);
      expect(findOneByQuerySpy).toHaveBeenCalledWith(
        'SELECT * FROM api_keys WHERE key_hash = $1 AND (expires_at IS NULL OR expires_at > NOW())',
        [expect.any(String)] // The hashed key
      );
    });

    it('should return null when API key not found', async () => {
      // Arrange
      const findOneByQuerySpy = jest.spyOn(apiKeyRepository as any, 'findOneByQuery')
        .mockResolvedValue(null);

      // Act
      const result = await apiKeyRepository.findByKey('original-key');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find all API keys for a user', async () => {
      // Arrange
      const findByQuerySpy = jest.spyOn(apiKeyRepository as any, 'findByQuery')
        .mockResolvedValue([mockApiKeyRow]);

      // Act
      const result = await apiKeyRepository.findByUserId('user-123');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ...mockApiKey,
        key: 'hashed-key', // Should return hash since no original key provided
      });
      expect(findByQuerySpy).toHaveBeenCalledWith(
        'SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
        ['user-123']
      );
    });

    it('should return empty array when no API keys found', async () => {
      // Arrange
      const findByQuerySpy = jest.spyOn(apiKeyRepository as any, 'findByQuery')
        .mockResolvedValue([]);

      // Act
      const result = await apiKeyRepository.findByUserId('user-123');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('createApiKey', () => {
    it('should create a new API key', async () => {
      // Arrange
      const createSpy = jest.spyOn(apiKeyRepository as any, 'create')
        .mockResolvedValue(mockApiKeyRow);

      const apiKeyData = {
        userId: 'user-123',
        key: 'original-key',
        name: 'Test API Key',
        permissions: [{ resource: 'servers', actions: ['read', 'write'] }],
        rateLimit: { requestsPerHour: 100, requestsPerDay: 1000, maxServers: 3 },
        expiresAt: undefined,
        lastUsedAt: undefined,
      };

      // Act
      const result = await apiKeyRepository.createApiKey(apiKeyData);

      // Assert
      expect(result).toEqual(mockApiKey);
      expect(createSpy).toHaveBeenCalledWith({
        user_id: 'user-123',
        key_hash: expect.any(String), // Should be hashed
        name: 'Test API Key',
        permissions: JSON.stringify(apiKeyData.permissions),
        rate_limit: JSON.stringify(apiKeyData.rateLimit),
        expires_at: undefined,
        last_used_at: undefined,
      });
    });
  });

  describe('updateApiKey', () => {
    it('should update an API key', async () => {
      // Arrange
      const updateSpy = jest.spyOn(apiKeyRepository as any, 'update')
        .mockResolvedValue({ ...mockApiKeyRow, name: 'Updated API Key' });

      const updates = { name: 'Updated API Key' };

      // Act
      const result = await apiKeyRepository.updateApiKey('key-123', updates);

      // Assert
      expect(result).toEqual({
        ...mockApiKey,
        key: 'hashed-key',
        name: 'Updated API Key',
      });
      expect(updateSpy).toHaveBeenCalledWith('key-123', { name: 'Updated API Key' });
    });

    it('should return null when API key not found', async () => {
      // Arrange
      const updateSpy = jest.spyOn(apiKeyRepository as any, 'update')
        .mockResolvedValue(null);

      // Act
      const result = await apiKeyRepository.updateApiKey('key-123', { name: 'Updated' });

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateLastUsed', () => {
    it('should update last used timestamp', async () => {
      // Arrange
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      // Act
      await apiKeyRepository.updateLastUsed('original-key');

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1',
        [expect.any(String)] // The hashed key
      );
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an API key', async () => {
      // Arrange
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      // Act
      await apiKeyRepository.revokeApiKey('key-123');

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE api_keys SET expires_at = NOW() WHERE id = $1',
        ['key-123']
      );
    });
  });

  describe('findExpiredKeys', () => {
    it('should find expired API keys', async () => {
      // Arrange
      const expiredRow = { ...mockApiKeyRow, expires_at: new Date('2023-01-01') };
      const findByQuerySpy = jest.spyOn(apiKeyRepository as any, 'findByQuery')
        .mockResolvedValue([expiredRow]);

      // Act
      const result = await apiKeyRepository.findExpiredKeys();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].expiresAt).toEqual(new Date('2023-01-01'));
      expect(findByQuerySpy).toHaveBeenCalledWith(
        'SELECT * FROM api_keys WHERE expires_at IS NOT NULL AND expires_at <= NOW()',
        []
      );
    });
  });

  describe('cleanupExpiredKeys', () => {
    it('should cleanup expired API keys', async () => {
      // Arrange
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 5 } as any);

      // Act
      const result = await apiKeyRepository.cleanupExpiredKeys();

      // Assert
      expect(result).toBe(5);
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM api_keys WHERE expires_at IS NOT NULL AND expires_at <= NOW() - INTERVAL \'30 days\'',
        []
      );
    });
  });

  describe('getUserApiKeyStats', () => {
    it('should get API key statistics for a user', async () => {
      // Arrange
      mockDb.query.mockResolvedValue({
        rows: [{ total: '10', active: '8', expired: '2' }]
      } as any);

      // Act
      const result = await apiKeyRepository.getUserApiKeyStats('user-123');

      // Assert
      expect(result).toEqual({
        total: 10,
        active: 8,
        expired: 2,
      });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) as total'),
        ['user-123']
      );
    });
  });

  describe('nameExistsForUser', () => {
    it('should check if API key name exists for user', async () => {
      // Arrange
      mockDb.query.mockResolvedValue({ rows: [{}] } as any);

      // Act
      const result = await apiKeyRepository.nameExistsForUser('user-123', 'Test Key');

      // Assert
      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT 1 FROM api_keys WHERE user_id = $1 AND name = $2 LIMIT 1',
        ['user-123', 'Test Key']
      );
    });

    it('should return false when name does not exist', async () => {
      // Arrange
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      // Act
      const result = await apiKeyRepository.nameExistsForUser('user-123', 'Test Key');

      // Assert
      expect(result).toBe(false);
    });

    it('should exclude specific ID when checking name existence', async () => {
      // Arrange
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      // Act
      const result = await apiKeyRepository.nameExistsForUser('user-123', 'Test Key', 'key-456');

      // Assert
      expect(result).toBe(false);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT 1 FROM api_keys WHERE user_id = $1 AND name = $2 AND id != $3 LIMIT 1',
        ['user-123', 'Test Key', 'key-456']
      );
    });
  });

  describe('key hashing', () => {
    it('should hash keys consistently', () => {
      // This tests the private hashKey method indirectly
      const repo1 = new ApiKeyRepository(mockDb);
      const repo2 = new ApiKeyRepository(mockDb);

      // We can't directly test the private method, but we can verify
      // that the same key produces the same hash by checking the query parameters
      const findOneByQuerySpy1 = jest.spyOn(repo1 as any, 'findOneByQuery')
        .mockResolvedValue(null);
      const findOneByQuerySpy2 = jest.spyOn(repo2 as any, 'findOneByQuery')
        .mockResolvedValue(null);

      // Act
      repo1.findByKey('test-key');
      repo2.findByKey('test-key');

      // Assert - Both should use the same hashed key
      const call1 = findOneByQuerySpy1.mock.calls[0];
      const call2 = findOneByQuerySpy2.mock.calls[0];
      expect(call1[1][0]).toBe(call2[1][0]); // Same hash
    });
  });
});