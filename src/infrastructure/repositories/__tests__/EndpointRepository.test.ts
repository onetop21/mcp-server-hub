import { EndpointRepository } from '../EndpointRepository';
import { DatabaseConnection } from '../../database/connection';
import { Endpoint } from '../../../domain/models/Endpoint';
import { BaseRepository } from '../../database/BaseRepository';

// Mock database connection
jest.mock('../../database/connection');

describe('EndpointRepository', () => {
  let repository: EndpointRepository;
  let mockDb: jest.Mocked<DatabaseConnection>;

  const mockUserId = 'user-123';
  const mockEndpointId = 'endpoint-123';
  const mockApiKeyId = 'api-key-123';

  beforeEach(() => {
    mockDb = {
      query: jest.fn()
    } as any;

    repository = new EndpointRepository(mockDb);
    jest.clearAllMocks();
  });

  describe('createEndpoint', () => {
    it('should create endpoint successfully', async () => {
      const endpointData: Omit<Endpoint, 'id' | 'createdAt' | 'lastAccessedAt'> = {
        userId: mockUserId,
        groupId: undefined,
        url: 'https://test.com/endpoint',
        sseUrl: 'https://test.com/endpoint/sse',
        httpUrl: 'https://test.com/endpoint/http',
        apiKeyId: mockApiKeyId
      };

      const mockCreatedRow = {
        id: mockEndpointId,
        user_id: mockUserId,
        group_id: null,
        url: endpointData.url,
        sse_url: endpointData.sseUrl,
        http_url: endpointData.httpUrl,
        api_key_id: mockApiKeyId,
        created_at: new Date(),
        last_accessed_at: null
      };

      jest.spyOn(BaseRepository.prototype, 'create').mockResolvedValue(mockCreatedRow);

      const result = await repository.createEndpoint(endpointData);

      expect(result).toEqual({
        id: mockEndpointId,
        userId: mockUserId,
        groupId: undefined,
        url: endpointData.url,
        sseUrl: endpointData.sseUrl,
        httpUrl: endpointData.httpUrl,
        apiKeyId: mockApiKeyId,
        createdAt: mockCreatedRow.created_at,
        lastAccessedAt: undefined
      });
    });
  });

  describe('findByUrl', () => {
    it('should find endpoint by any URL type', async () => {
      const mockRow = {
        id: mockEndpointId,
        user_id: mockUserId,
        group_id: null,
        url: 'https://test.com/endpoint',
        sse_url: 'https://test.com/endpoint/sse',
        http_url: 'https://test.com/endpoint/http',
        api_key_id: mockApiKeyId,
        created_at: new Date(),
        last_accessed_at: null
      };

      jest.spyOn(repository as any, 'findOneByQuery').mockResolvedValue(mockRow);

      const result = await repository.findByUrl('https://test.com/endpoint/sse');

      expect(result).toBeDefined();
      expect(result?.sseUrl).toBe('https://test.com/endpoint/sse');
    });
  });

  describe('isUrlAvailable', () => {
    it('should return true if URL is available', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await repository.isUrlAvailable('https://test.com/new-endpoint');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT 1 FROM endpoints WHERE'),
        ['https://test.com/new-endpoint']
      );
    });

    it('should return false if URL is not available', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'some-id' }] } as any);

      const result = await repository.isUrlAvailable('https://test.com/existing-endpoint');

      expect(result).toBe(false);
    });

    it('should exclude specific endpoint when checking availability', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await repository.isUrlAvailable('https://test.com/endpoint', mockEndpointId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND id != $2'),
        ['https://test.com/endpoint', mockEndpointId]
      );
    });
  });

  describe('updateLastAccessed', () => {
    it('should update last accessed time', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await repository.updateLastAccessed(mockEndpointId);

      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE endpoints SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1',
        [mockEndpointId]
      );
    });
  });

  describe('findDefaultEndpointByUserId', () => {
    it('should find default endpoint for user', async () => {
      const mockRow = {
        id: mockEndpointId,
        user_id: mockUserId,
        group_id: null,
        url: 'https://test.com/endpoint',
        sse_url: 'https://test.com/endpoint/sse',
        http_url: 'https://test.com/endpoint/http',
        api_key_id: mockApiKeyId,
        created_at: new Date(),
        last_accessed_at: null
      };

      jest.spyOn(repository as any, 'findOneByQuery').mockResolvedValue(mockRow);

      const result = await repository.findDefaultEndpointByUserId(mockUserId);

      expect(result).toBeDefined();
      expect(result?.groupId).toBeUndefined();
    });
  });

  describe('getStatistics', () => {
    it('should return endpoint statistics', async () => {
      const mockCount = 10;
      const mockTypeResult = { rows: [{ default_count: '5', group_count: '5' }] };
      const mockRecentResult = { rows: [{ count: '3' }] };

      jest.spyOn(repository as any, 'count').mockResolvedValue(mockCount);
      mockDb.query
        .mockResolvedValueOnce(mockTypeResult as any)
        .mockResolvedValueOnce(mockRecentResult as any);

      const result = await repository.getStatistics();

      expect(result).toEqual({
        total: 10,
        byType: { default: 5, group: 5 },
        recentlyAccessed: 3
      });
    });
  });
});