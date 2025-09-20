import { ServerRegistryService } from '../ServerRegistryService';
import { EndpointService } from '../EndpointService';
import { ServerRepository } from '../../../infrastructure/repositories/ServerRepository';
import { ServerGroupRepository } from '../../../infrastructure/repositories/ServerGroupRepository';
import { EndpointRepository } from '../../../infrastructure/repositories/EndpointRepository';
import { ApiKeyRepository } from '../../../infrastructure/repositories/ApiKeyRepository';
import { TokenGenerator } from '../../../infrastructure/utils/TokenGenerator';
import { ServerProtocol } from '../../models/Server';

// Mock all repositories and utilities
jest.mock('../../../infrastructure/repositories/ServerRepository');
jest.mock('../../../infrastructure/repositories/ServerGroupRepository');
jest.mock('../../../infrastructure/repositories/EndpointRepository');
jest.mock('../../../infrastructure/repositories/ApiKeyRepository');
jest.mock('../../../infrastructure/utils/TokenGenerator');

describe('Group and Endpoint Integration', () => {
  let serverRegistryService: ServerRegistryService;
  let endpointService: EndpointService;
  let mockServerRepository: jest.Mocked<ServerRepository>;
  let mockServerGroupRepository: jest.Mocked<ServerGroupRepository>;
  let mockEndpointRepository: jest.Mocked<EndpointRepository>;
  let mockApiKeyRepository: jest.Mocked<ApiKeyRepository>;
  let mockTokenGenerator: jest.Mocked<TokenGenerator>;

  const mockUserId = 'user-123';
  const mockApiKeyId = 'api-key-123';
  const mockServerId = 'server-123';
  const mockGroupId = 'group-123';
  const mockEndpointId = 'endpoint-123';

  beforeEach(() => {
    mockServerRepository = new ServerRepository({} as any) as jest.Mocked<ServerRepository>;
    mockServerGroupRepository = new ServerGroupRepository({} as any) as jest.Mocked<ServerGroupRepository>;
    mockEndpointRepository = new EndpointRepository({} as any) as jest.Mocked<EndpointRepository>;
    mockApiKeyRepository = new ApiKeyRepository({} as any) as jest.Mocked<ApiKeyRepository>;
    mockTokenGenerator = new TokenGenerator() as jest.Mocked<TokenGenerator>;

    serverRegistryService = new ServerRegistryService(mockServerRepository, mockServerGroupRepository);
    endpointService = new EndpointService(
      mockEndpointRepository,
      mockServerGroupRepository,
      mockApiKeyRepository,
      mockTokenGenerator,
      'https://test.mcp.local'
    );

    jest.clearAllMocks();
  });

  it('should complete full workflow: register server -> create group -> assign server -> create endpoint', async () => {
    // Step 1: Register a server
    const mockServer = {
      id: mockServerId,
      userId: mockUserId,
      name: 'Test Server',
      protocol: ServerProtocol.STDIO,
      config: { stdio: { command: 'node', args: ['server.js'] } },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockServerRepository.findByUserIdAndName.mockResolvedValue(null);
    mockServerRepository.createServer.mockResolvedValue(mockServer as any);

    const registeredServer = await serverRegistryService.registerServer(mockUserId, {
      name: 'Test Server',
      protocol: ServerProtocol.STDIO,
      stdio: { command: 'node', args: ['server.js'] }
    });

    expect(registeredServer.id).toBe(mockServerId);

    // Step 2: Create a group
    const mockGroup = {
      id: mockGroupId,
      userId: mockUserId,
      name: 'Test Group',
      description: 'A test group',
      serverIds: [],
      routingRules: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockServerGroupRepository.findByUserIdAndName.mockResolvedValue(null);
    mockServerGroupRepository.createGroup.mockResolvedValue(mockGroup);

    const createdGroup = await serverRegistryService.createGroup(mockUserId, {
      name: 'Test Group',
      description: 'A test group'
    });

    expect(createdGroup.id).toBe(mockGroupId);

    // Step 3: Assign server to group
    mockServerRepository.findServerById.mockResolvedValue(mockServer as any);
    mockServerGroupRepository.findGroupById.mockResolvedValue(mockGroup as any);
    mockServerGroupRepository.addServerToGroup.mockResolvedValue(undefined);

    await serverRegistryService.assignServerToGroup(mockServerId, mockGroupId);

    expect(mockServerGroupRepository.addServerToGroup).toHaveBeenCalledWith(mockServerId, mockGroupId);

    // Step 4: Create endpoint for the group
    const mockApiKey = { id: mockApiKeyId, userId: mockUserId };
    const mockEndpoint = {
      id: mockEndpointId,
      userId: mockUserId,
      groupId: mockGroupId,
      url: 'https://test.mcp.local/api/v1/endpoints/endpoint-123',
      sseUrl: 'https://test.mcp.local/api/v1/endpoints/endpoint-123/sse',
      httpUrl: 'https://test.mcp.local/api/v1/endpoints/endpoint-123/http',
      apiKeyId: mockApiKeyId,
      createdAt: new Date()
    };

    mockApiKeyRepository.findApiKeyById.mockResolvedValue(mockApiKey as any);
    mockServerGroupRepository.findGroupById.mockResolvedValue(mockGroup as any);
    mockEndpointRepository.findByGroupId.mockResolvedValue([]);
    mockTokenGenerator.generateUuid.mockReturnValue(mockEndpointId);
    mockEndpointRepository.isUrlAvailable.mockResolvedValue(true);
    mockEndpointRepository.createEndpoint.mockResolvedValue(mockEndpoint as any);

    const createdEndpoint = await endpointService.createGroupEndpoint(mockUserId, mockGroupId, mockApiKeyId);

    expect(createdEndpoint.id).toBe(mockEndpointId);
    expect(createdEndpoint.groupId).toBe(mockGroupId);
    expect(createdEndpoint.url).toContain('/endpoints/');
    expect(createdEndpoint.sseUrl).toContain('/sse');
    expect(createdEndpoint.httpUrl).toContain('/http');

    // Verify all services were called correctly
    expect(mockServerRepository.createServer).toHaveBeenCalled();
    expect(mockServerGroupRepository.createGroup).toHaveBeenCalled();
    expect(mockServerGroupRepository.addServerToGroup).toHaveBeenCalled();
    expect(mockEndpointRepository.createEndpoint).toHaveBeenCalled();
  });

  it('should create default endpoint for user with all servers', async () => {
    const mockApiKey = { id: mockApiKeyId, userId: mockUserId };
    const mockEndpoint = {
      id: mockEndpointId,
      userId: mockUserId,
      groupId: undefined, // Default endpoint has no group
      url: 'https://test.mcp.local/api/v1/endpoints/endpoint-123',
      sseUrl: 'https://test.mcp.local/api/v1/endpoints/endpoint-123/sse',
      httpUrl: 'https://test.mcp.local/api/v1/endpoints/endpoint-123/http',
      apiKeyId: mockApiKeyId,
      createdAt: new Date()
    };

    mockApiKeyRepository.findApiKeyById.mockResolvedValue(mockApiKey as any);
    mockEndpointRepository.findDefaultEndpointByUserId.mockResolvedValue(null);
    mockTokenGenerator.generateUuid.mockReturnValue(mockEndpointId);
    mockEndpointRepository.isUrlAvailable.mockResolvedValue(true);
    mockEndpointRepository.createEndpoint.mockResolvedValue(mockEndpoint as any);

    const createdEndpoint = await endpointService.createDefaultEndpoint(mockUserId, mockApiKeyId);

    expect(createdEndpoint.groupId).toBeUndefined();
    expect(createdEndpoint.url).toContain('/endpoints/');
    expect(mockEndpointRepository.createEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUserId,
        groupId: undefined,
        apiKeyId: mockApiKeyId
      })
    );
  });
});