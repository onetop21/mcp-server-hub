import { EndpointService, EndpointError } from '../EndpointService';
import { EndpointRepository } from '../../../infrastructure/repositories/EndpointRepository';
import { ServerGroupRepository } from '../../../infrastructure/repositories/ServerGroupRepository';
import { ApiKeyRepository } from '../../../infrastructure/repositories/ApiKeyRepository';
import { TokenGenerator } from '../../../infrastructure/utils/TokenGenerator';

// Mock repositories and utilities
jest.mock('../../../infrastructure/repositories/EndpointRepository');
jest.mock('../../../infrastructure/repositories/ServerGroupRepository');
jest.mock('../../../infrastructure/repositories/ApiKeyRepository');
jest.mock('../../../infrastructure/utils/TokenGenerator');

describe('EndpointService', () => {
  let service: EndpointService;
  let mockEndpointRepository: jest.Mocked<EndpointRepository>;
  let mockServerGroupRepository: jest.Mocked<ServerGroupRepository>;
  let mockApiKeyRepository: jest.Mocked<ApiKeyRepository>;
  let mockTokenGenerator: jest.Mocked<TokenGenerator>;

  const mockUserId = 'user-123';
  const mockApiKeyId = 'api-key-123';
  const mockGroupId = 'group-123';
  const mockEndpointId = 'endpoint-123';
  const baseUrl = 'https://test.mcp.local';

  beforeEach(() => {
    mockEndpointRepository = new EndpointRepository({} as any) as jest.Mocked<EndpointRepository>;
    mockServerGroupRepository = new ServerGroupRepository({} as any) as jest.Mocked<ServerGroupRepository>;
    mockApiKeyRepository = new ApiKeyRepository({} as any) as jest.Mocked<ApiKeyRepository>;
    mockTokenGenerator = new TokenGenerator() as jest.Mocked<TokenGenerator>;

    service = new EndpointService(
      mockEndpointRepository,
      mockServerGroupRepository,
      mockApiKeyRepository,
      mockTokenGenerator,
      baseUrl
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createDefaultEndpoint', () => {
    it('should create default endpoint successfully', async () => {
      const mockApiKey = { id: mockApiKeyId, userId: mockUserId };
      const expectedEndpoint = {
        id: mockEndpointId,
        userId: mockUserId,
        groupId: undefined,
        url: `${baseUrl}/api/v1/endpoints/${mockEndpointId}`,
        sseUrl: `${baseUrl}/api/v1/endpoints/${mockEndpointId}/sse`,
        httpUrl: `${baseUrl}/api/v1/endpoints/${mockEndpointId}/http`,
        apiKeyId: mockApiKeyId,
        createdAt: new Date()
      };

      mockApiKeyRepository.findApiKeyById.mockResolvedValue(mockApiKey as any);
      mockEndpointRepository.findDefaultEndpointByUserId.mockResolvedValue(null);
      mockTokenGenerator.generateUuid.mockReturnValue(mockEndpointId);
      mockEndpointRepository.isUrlAvailable.mockResolvedValue(true);
      mockEndpointRepository.createEndpoint.mockResolvedValue(expectedEndpoint as any);

      const result = await service.createDefaultEndpoint(mockUserId, mockApiKeyId);

      expect(result).toEqual(expectedEndpoint);
      expect(mockEndpointRepository.findDefaultEndpointByUserId).toHaveBeenCalledWith(mockUserId);
      expect(mockEndpointRepository.createEndpoint).toHaveBeenCalled();
    });

    it('should throw error if API key not found', async () => {
      mockApiKeyRepository.findApiKeyById.mockResolvedValue(null);

      await expect(service.createDefaultEndpoint(mockUserId, mockApiKeyId))
        .rejects.toThrow(EndpointError);
    });

    it('should throw error if default endpoint already exists', async () => {
      const mockApiKey = { id: mockApiKeyId, userId: mockUserId };
      const existingEndpoint = { id: 'existing-endpoint' };

      mockApiKeyRepository.findApiKeyById.mockResolvedValue(mockApiKey as any);
      mockEndpointRepository.findDefaultEndpointByUserId.mockResolvedValue(existingEndpoint as any);

      await expect(service.createDefaultEndpoint(mockUserId, mockApiKeyId))
        .rejects.toThrow(EndpointError);
    });
  });

  describe('createGroupEndpoint', () => {
    it('should create group endpoint successfully', async () => {
      const mockApiKey = { id: mockApiKeyId, userId: mockUserId };
      const mockGroup = { id: mockGroupId, userId: mockUserId, name: 'Test Group' };
      const expectedEndpoint = {
        id: mockEndpointId,
        userId: mockUserId,
        groupId: mockGroupId,
        url: `${baseUrl}/api/v1/endpoints/${mockEndpointId}`,
        sseUrl: `${baseUrl}/api/v1/endpoints/${mockEndpointId}/sse`,
        httpUrl: `${baseUrl}/api/v1/endpoints/${mockEndpointId}/http`,
        apiKeyId: mockApiKeyId,
        createdAt: new Date()
      };

      mockApiKeyRepository.findApiKeyById.mockResolvedValue(mockApiKey as any);
      mockServerGroupRepository.findGroupById.mockResolvedValue(mockGroup as any);
      mockEndpointRepository.findByGroupId.mockResolvedValue([]);
      mockTokenGenerator.generateUuid.mockReturnValue(mockEndpointId);
      mockEndpointRepository.isUrlAvailable.mockResolvedValue(true);
      mockEndpointRepository.createEndpoint.mockResolvedValue(expectedEndpoint as any);

      const result = await service.createGroupEndpoint(mockUserId, mockGroupId, mockApiKeyId);

      expect(result).toEqual(expectedEndpoint);
      expect(mockServerGroupRepository.findGroupById).toHaveBeenCalledWith(mockGroupId);
      expect(mockEndpointRepository.createEndpoint).toHaveBeenCalled();
    });

    it('should throw error if group not found', async () => {
      const mockApiKey = { id: mockApiKeyId, userId: mockUserId };
      
      mockApiKeyRepository.findApiKeyById.mockResolvedValue(mockApiKey as any);
      mockServerGroupRepository.findGroupById.mockResolvedValue(null);

      await expect(service.createGroupEndpoint(mockUserId, mockGroupId, mockApiKeyId))
        .rejects.toThrow(EndpointError);
    });

    it('should throw error if group belongs to different user', async () => {
      const mockApiKey = { id: mockApiKeyId, userId: mockUserId };
      const mockGroup = { id: mockGroupId, userId: 'different-user' };

      mockApiKeyRepository.findApiKeyById.mockResolvedValue(mockApiKey as any);
      mockServerGroupRepository.findGroupById.mockResolvedValue(mockGroup as any);

      await expect(service.createGroupEndpoint(mockUserId, mockGroupId, mockApiKeyId))
        .rejects.toThrow(EndpointError);
    });

    it('should throw error if endpoint already exists for group', async () => {
      const mockApiKey = { id: mockApiKeyId, userId: mockUserId };
      const mockGroup = { id: mockGroupId, userId: mockUserId };
      const existingEndpoint = { id: 'existing-endpoint' };

      mockApiKeyRepository.findApiKeyById.mockResolvedValue(mockApiKey as any);
      mockServerGroupRepository.findGroupById.mockResolvedValue(mockGroup as any);
      mockEndpointRepository.findByGroupId.mockResolvedValue([existingEndpoint as any]);

      await expect(service.createGroupEndpoint(mockUserId, mockGroupId, mockApiKeyId))
        .rejects.toThrow(EndpointError);
    });
  });

  describe('validateEndpointAccess', () => {
    it('should validate endpoint access successfully', async () => {
      const mockEndpoint = { id: mockEndpointId, apiKeyId: mockApiKeyId };
      const mockApiKey = { id: mockApiKeyId, expiresAt: null };
      const apiKeyString = 'test-api-key';

      mockEndpointRepository.findEndpointById.mockResolvedValue(mockEndpoint as any);
      mockApiKeyRepository.findApiKeyById.mockResolvedValue(mockApiKey as any);
      mockApiKeyRepository.validateApiKey.mockResolvedValue(true);
      mockApiKeyRepository.findByKey.mockResolvedValue(mockApiKey as any);

      const result = await service.validateEndpointAccess(mockEndpointId, apiKeyString);

      expect(result).toBe(true);
      expect(mockEndpointRepository.findEndpointById).toHaveBeenCalledWith(mockEndpointId);
      expect(mockApiKeyRepository.validateApiKey).toHaveBeenCalledWith(apiKeyString);
    });

    it('should return false if endpoint not found', async () => {
      mockEndpointRepository.findEndpointById.mockResolvedValue(null);

      const result = await service.validateEndpointAccess(mockEndpointId, 'test-key');

      expect(result).toBe(false);
    });

    it('should return false if API key is expired', async () => {
      const mockEndpoint = { id: mockEndpointId, apiKeyId: mockApiKeyId };
      const expiredApiKey = { 
        id: mockApiKeyId, 
        expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
      };

      mockEndpointRepository.findEndpointById.mockResolvedValue(mockEndpoint as any);
      mockApiKeyRepository.findApiKeyById.mockResolvedValue(expiredApiKey as any);

      const result = await service.validateEndpointAccess(mockEndpointId, 'test-key');

      expect(result).toBe(false);
    });
  });

  describe('deleteEndpoint', () => {
    it('should delete endpoint successfully', async () => {
      const mockEndpoint = { id: mockEndpointId };
      
      mockEndpointRepository.findEndpointById.mockResolvedValue(mockEndpoint as any);
      mockEndpointRepository.deleteEndpoint.mockResolvedValue(undefined);

      await service.deleteEndpoint(mockEndpointId);

      expect(mockEndpointRepository.deleteEndpoint).toHaveBeenCalledWith(mockEndpointId);
    });

    it('should throw error if endpoint not found', async () => {
      mockEndpointRepository.findEndpointById.mockResolvedValue(null);

      await expect(service.deleteEndpoint(mockEndpointId))
        .rejects.toThrow(EndpointError);
    });
  });
});