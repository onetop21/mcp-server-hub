import { RouterService } from '../RouterService';
import { IProtocolAdapterService, McpRequest, McpResponse, AdapterHealth } from '../IProtocolAdapterService';
import { ServerRepository } from '../../../infrastructure/repositories/ServerRepository';
import { EndpointRepository } from '../../../infrastructure/repositories/EndpointRepository';
import { ServerGroupRepository } from '../../../infrastructure/repositories/ServerGroupRepository';
import { RegisteredServer, ServerStatus, ServerProtocol } from '../../models/Server';
import { Endpoint, ServerGroup, RoutingRule } from '../../models/Endpoint';

// Mock implementations
class MockProtocolAdapterService implements IProtocolAdapterService {
  private mockResponses = new Map<string, any>();
  private mockHealth = new Map<string, AdapterHealth>();

  setMockResponse(serverId: string, method: string, response: any) {
    this.mockResponses.set(`${serverId}:${method}`, response);
  }

  setMockHealth(adapterId: string, health: AdapterHealth) {
    this.mockHealth.set(adapterId, health);
  }

  async createAdapter(): Promise<any> {
    return { id: 'adapter-1', serverId: 'server-1', protocol: 'stdio', status: 'connected', createdAt: new Date() };
  }

  async sendRequest(adapterId: string, request: McpRequest): Promise<McpResponse> {
    const key = `${adapterId}:${request.method}`;
    const mockResponse = this.mockResponses.get(key);
    
    if (mockResponse) {
      if (mockResponse.error) {
        throw new Error(mockResponse.error);
      }
      return { result: mockResponse };
    }

    // Default responses
    if (request.method === 'tools/list') {
      return {
        result: {
          tools: [
            { name: 'test_tool', description: 'A test tool', inputSchema: { properties: {} } },
            { name: 'another_tool', description: 'Another test tool', inputSchema: { properties: {} } }
          ]
        }
      };
    }

    if (request.method === 'tools/call') {
      return { result: { output: 'Tool executed successfully' } };
    }

    return { result: null };
  }

  async *streamRequest(): AsyncIterable<any> {
    yield { data: 'stream data', done: true };
  }

  async closeAdapter(): Promise<void> {
    // Mock implementation
  }

  async getAdapterHealth(adapterId: string): Promise<AdapterHealth> {
    const health = this.mockHealth.get(adapterId);
    if (health) {
      return health;
    }

    return {
      adapterId,
      status: 'healthy',
      lastCheck: new Date(),
      responseTime: 100
    };
  }

  async getActiveAdapters(): Promise<any[]> {
    return [];
  }
}

class MockServerRepository {
  private servers = new Map<string, RegisteredServer>();

  addServer(server: RegisteredServer) {
    this.servers.set(server.id, server);
  }

  async findServerById(id: string): Promise<RegisteredServer | null> {
    return this.servers.get(id) || null;
  }

  async findByUserId(userId: string): Promise<RegisteredServer[]> {
    return Array.from(this.servers.values()).filter(server => server.userId === userId);
  }
}

class MockEndpointRepository {
  private endpoints = new Map<string, Endpoint>();

  addEndpoint(endpoint: Endpoint) {
    this.endpoints.set(endpoint.id, endpoint);
  }

  async findEndpointById(id: string): Promise<Endpoint | null> {
    return this.endpoints.get(id) || null;
  }
}

class MockServerGroupRepository {
  private groups = new Map<string, ServerGroup>();

  addGroup(group: ServerGroup) {
    this.groups.set(group.id, group);
  }

  async findGroupById(id: string): Promise<ServerGroup | null> {
    return this.groups.get(id) || null;
  }

  async updateRoutingRules(groupId: string, rules: RoutingRule[]): Promise<void> {
    const group = this.groups.get(groupId);
    if (group) {
      group.routingRules = rules;
    }
  }
}

describe('RouterService', () => {
  let routerService: RouterService;
  let mockProtocolAdapter: MockProtocolAdapterService;
  let mockServerRepo: MockServerRepository;
  let mockEndpointRepo: MockEndpointRepository;
  let mockGroupRepo: MockServerGroupRepository;

  beforeEach(() => {
    mockProtocolAdapter = new MockProtocolAdapterService();
    mockServerRepo = new MockServerRepository();
    mockEndpointRepo = new MockEndpointRepository();
    mockGroupRepo = new MockServerGroupRepository();

    routerService = new RouterService(
      mockServerRepo as any,
      mockEndpointRepo as any,
      mockGroupRepo as any,
      mockProtocolAdapter
    );
  });

  describe('Tool Routing', () => {
    it('should route tool call to correct server', async () => {
      // Setup test data
      const server: RegisteredServer = {
        id: 'server-1',
        userId: 'user-1',
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const endpoint: Endpoint = {
        id: 'endpoint-1',
        userId: 'user-1',
        url: 'http://test.com/endpoint',
        sseUrl: 'http://test.com/sse',
        httpUrl: 'http://test.com/http',
        apiKeyId: 'key-1',
        createdAt: new Date()
      };

      mockServerRepo.addServer(server);
      mockEndpointRepo.addEndpoint(endpoint);

      // Execute tool call
      const result = await routerService.routeToolCall('endpoint-1', 'test_tool', { param: 'value' });

      expect(result.success).toBe(true);
      expect(result.serverId).toBe('server-1');
      expect(result.result).toEqual({ output: 'Tool executed successfully' });
    });

    it('should handle server not found error', async () => {
      const endpoint: Endpoint = {
        id: 'endpoint-1',
        userId: 'user-1',
        url: 'http://test.com/endpoint',
        sseUrl: 'http://test.com/sse',
        httpUrl: 'http://test.com/http',
        apiKeyId: 'key-1',
        createdAt: new Date()
      };

      mockEndpointRepo.addEndpoint(endpoint);

      const result = await routerService.routeToolCall('endpoint-1', 'test_tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('No servers available for this endpoint');
    });

    it('should handle endpoint not found error', async () => {
      const result = await routerService.routeToolCall('nonexistent-endpoint', 'test_tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Endpoint not found');
    });
  });

  describe('Namespace System', () => {
    it('should apply namespace to tool names', async () => {
      const server: RegisteredServer = {
        id: 'server-1',
        userId: 'user-1',
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        namespace: 'custom-namespace',
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const endpoint: Endpoint = {
        id: 'endpoint-1',
        userId: 'user-1',
        url: 'http://test.com/endpoint',
        sseUrl: 'http://test.com/sse',
        httpUrl: 'http://test.com/http',
        apiKeyId: 'key-1',
        createdAt: new Date()
      };

      mockServerRepo.addServer(server);
      mockEndpointRepo.addEndpoint(endpoint);

      const tools = await routerService.getAvailableTools('endpoint-1');

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('custom-namespace.test_tool');
      expect(tools[0].namespace).toBe('custom-namespace');
      expect(tools[1].name).toBe('custom-namespace.another_tool');
      expect(tools[1].namespace).toBe('custom-namespace');
    });

    it('should use server name as default namespace', async () => {
      const server: RegisteredServer = {
        id: 'server-1',
        userId: 'user-1',
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const endpoint: Endpoint = {
        id: 'endpoint-1',
        userId: 'user-1',
        url: 'http://test.com/endpoint',
        sseUrl: 'http://test.com/sse',
        httpUrl: 'http://test.com/http',
        apiKeyId: 'key-1',
        createdAt: new Date()
      };

      mockServerRepo.addServer(server);
      mockEndpointRepo.addEndpoint(endpoint);

      const tools = await routerService.getAvailableTools('endpoint-1');

      expect(tools[0].name).toBe('test-server.test_tool');
      expect(tools[0].namespace).toBe('test-server');
    });

    it('should route namespaced tool calls correctly', async () => {
      const server: RegisteredServer = {
        id: 'server-1',
        userId: 'user-1',
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        namespace: 'custom-namespace',
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const endpoint: Endpoint = {
        id: 'endpoint-1',
        userId: 'user-1',
        url: 'http://test.com/endpoint',
        sseUrl: 'http://test.com/sse',
        httpUrl: 'http://test.com/http',
        apiKeyId: 'key-1',
        createdAt: new Date()
      };

      mockServerRepo.addServer(server);
      mockEndpointRepo.addEndpoint(endpoint);

      // Mock the protocol adapter to verify the correct tool name is sent
      let capturedRequest: McpRequest | null = null;
      mockProtocolAdapter.sendRequest = async (adapterId: string, request: McpRequest) => {
        capturedRequest = request;
        return { result: { output: 'Success' } };
      };

      const result = await routerService.routeToolCall('endpoint-1', 'custom-namespace.test_tool', {});

      expect(result.success).toBe(true);
      expect(capturedRequest?.params?.name).toBe('test_tool'); // Namespace should be stripped
    });

    it('should prevent tool name conflicts', async () => {
      const server1: RegisteredServer = {
        id: 'server-1',
        userId: 'user-1',
        name: 'server-one',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const server2: RegisteredServer = {
        id: 'server-2',
        userId: 'user-1',
        name: 'server-two',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const endpoint: Endpoint = {
        id: 'endpoint-1',
        userId: 'user-1',
        url: 'http://test.com/endpoint',
        sseUrl: 'http://test.com/sse',
        httpUrl: 'http://test.com/http',
        apiKeyId: 'key-1',
        createdAt: new Date()
      };

      mockServerRepo.addServer(server1);
      mockServerRepo.addServer(server2);
      mockEndpointRepo.addEndpoint(endpoint);

      const tools = await routerService.getAvailableTools('endpoint-1');

      // Should have tools from both servers with different namespaces
      const server1Tools = tools.filter(t => t.namespace === 'server-one');
      const server2Tools = tools.filter(t => t.namespace === 'server-two');

      expect(server1Tools).toHaveLength(2);
      expect(server2Tools).toHaveLength(2);
      expect(server1Tools[0].name).toBe('server-one.test_tool');
      expect(server2Tools[0].name).toBe('server-two.test_tool');
    });
  });

  describe('Routing Rules', () => {
    it('should apply routing rules correctly', async () => {
      const server1: RegisteredServer = {
        id: 'server-1',
        userId: 'user-1',
        name: 'server-one',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const server2: RegisteredServer = {
        id: 'server-2',
        userId: 'user-1',
        name: 'server-two',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const group: ServerGroup = {
        id: 'group-1',
        userId: 'user-1',
        name: 'test-group',
        description: 'Test group',
        serverIds: ['server-1', 'server-2'],
        routingRules: [
          {
            id: 'rule-1',
            condition: { toolName: 'test_tool' },
            targetServerId: 'server-2',
            priority: 10,
            enabled: true
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const endpoint: Endpoint = {
        id: 'endpoint-1',
        userId: 'user-1',
        groupId: 'group-1',
        url: 'http://test.com/endpoint',
        sseUrl: 'http://test.com/sse',
        httpUrl: 'http://test.com/http',
        apiKeyId: 'key-1',
        createdAt: new Date()
      };

      mockServerRepo.addServer(server1);
      mockServerRepo.addServer(server2);
      mockGroupRepo.addGroup(group);
      mockEndpointRepo.addEndpoint(endpoint);

      const result = await routerService.routeToolCall('endpoint-1', 'test_tool', {});

      expect(result.success).toBe(true);
      expect(result.serverId).toBe('server-2'); // Should route to server-2 based on rule
    });

    it('should set and get routing rules', async () => {
      const rules: RoutingRule[] = [
        {
          id: 'rule-1',
          condition: { toolName: 'test_tool' },
          targetServerId: 'server-1',
          priority: 10,
          enabled: true
        }
      ];

      await routerService.setRoutingRules('group-1', rules);

      const group: ServerGroup = {
        id: 'group-1',
        userId: 'user-1',
        name: 'test-group',
        description: 'Test group',
        serverIds: [],
        routingRules: rules,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGroupRepo.addGroup(group);

      const retrievedRules = await routerService.getRoutingRules('group-1');
      expect(retrievedRules).toEqual(rules);
    });
  });

  describe('Load Balancing and Fallback', () => {
    it('should fallback to another server when primary is unavailable', async () => {
      const server1: RegisteredServer = {
        id: 'server-1',
        userId: 'user-1',
        name: 'server-one',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.INACTIVE, // Primary server is down
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const server2: RegisteredServer = {
        id: 'server-2',
        userId: 'user-1',
        name: 'server-one', // Same namespace
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE, // Fallback server is active
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const endpoint: Endpoint = {
        id: 'endpoint-1',
        userId: 'user-1',
        url: 'http://test.com/endpoint',
        sseUrl: 'http://test.com/sse',
        httpUrl: 'http://test.com/http',
        apiKeyId: 'key-1',
        createdAt: new Date()
      };

      mockServerRepo.addServer(server1);
      mockServerRepo.addServer(server2);
      mockEndpointRepo.addEndpoint(endpoint);

      const result = await routerService.routeToolCall('endpoint-1', 'server-one.test_tool', {});

      expect(result.success).toBe(true);
      expect(result.serverId).toBe('server-2'); // Should fallback to server-2
    });

    it('should handle no available servers', async () => {
      const server: RegisteredServer = {
        id: 'server-1',
        userId: 'user-1',
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.INACTIVE, // Server is down
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const endpoint: Endpoint = {
        id: 'endpoint-1',
        userId: 'user-1',
        url: 'http://test.com/endpoint',
        sseUrl: 'http://test.com/sse',
        httpUrl: 'http://test.com/http',
        apiKeyId: 'key-1',
        createdAt: new Date()
      };

      mockServerRepo.addServer(server);
      mockEndpointRepo.addEndpoint(endpoint);

      const result = await routerService.routeToolCall('endpoint-1', 'test_tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('No server found for tool: test_tool');
    });
  });

  describe('Health Monitoring', () => {
    it('should get server health status', async () => {
      const server: RegisteredServer = {
        id: 'server-1',
        userId: 'user-1',
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockServerRepo.addServer(server);
      mockProtocolAdapter.setMockHealth('server-1', {
        adapterId: 'server-1',
        status: 'healthy',
        lastCheck: new Date(),
        responseTime: 150
      });

      const health = await routerService.getServerHealth('server-1');

      expect(health.serverId).toBe('server-1');
      expect(health.status).toBe(ServerStatus.ACTIVE);
      expect(health.responseTime).toBe(150);
    });

    it('should get group health status', async () => {
      const group: ServerGroup = {
        id: 'group-1',
        userId: 'user-1',
        name: 'test-group',
        description: 'Test group',
        serverIds: ['server-1', 'server-2'],
        routingRules: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const server1: RegisteredServer = {
        id: 'server-1',
        userId: 'user-1',
        name: 'server-one',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const server2: RegisteredServer = {
        id: 'server-2',
        userId: 'user-1',
        name: 'server-two',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGroupRepo.addGroup(group);
      mockServerRepo.addServer(server1);
      mockServerRepo.addServer(server2);

      const groupHealth = await routerService.getGroupHealth('group-1');

      expect(groupHealth).toHaveLength(2);
      expect(groupHealth[0].serverId).toBe('server-1');
      expect(groupHealth[1].serverId).toBe('server-2');
    });
  });

  describe('Advanced Namespace and Routing Edge Cases', () => {
    it('should handle deeply nested namespaces', async () => {
      const server: RegisteredServer = {
        id: 'server-1',
        userId: 'user-1',
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        namespace: 'company.team.project',
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const endpoint: Endpoint = {
        id: 'endpoint-1',
        userId: 'user-1',
        url: 'http://test.com/endpoint',
        sseUrl: 'http://test.com/sse',
        httpUrl: 'http://test.com/http',
        apiKeyId: 'key-1',
        createdAt: new Date()
      };

      mockServerRepo.addServer(server);
      mockEndpointRepo.addEndpoint(endpoint);

      const tools = await routerService.getAvailableTools('endpoint-1');

      expect(tools[0].name).toBe('company.team.project.test_tool');
      expect(tools[0].namespace).toBe('company.team.project');
    });

    it('should handle tools with existing dots in names', async () => {
      const server: RegisteredServer = {
        id: 'server-1',
        userId: 'user-1',
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        namespace: 'custom',
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const endpoint: Endpoint = {
        id: 'endpoint-1',
        userId: 'user-1',
        url: 'http://test.com/endpoint',
        sseUrl: 'http://test.com/sse',
        httpUrl: 'http://test.com/http',
        apiKeyId: 'key-1',
        createdAt: new Date()
      };

      mockServerRepo.addServer(server);
      mockEndpointRepo.addEndpoint(endpoint);

      // Mock a tool that already has dots in its name
      mockProtocolAdapter.setMockResponse('server-1', 'tools/list', {
        tools: [
          { name: 'already.namespaced.tool', description: 'A tool with dots', inputSchema: { properties: {} } }
        ]
      });

      const tools = await routerService.getAvailableTools('endpoint-1');

      // Should not add namespace to already namespaced tools
      expect(tools[0].name).toBe('already.namespaced.tool');
      expect(tools[0].namespace).toBe('custom');
    });

    it('should handle routing rules with priority correctly', async () => {
      const server1: RegisteredServer = {
        id: 'server-1',
        userId: 'user-1',
        name: 'server-one',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const server2: RegisteredServer = {
        id: 'server-2',
        userId: 'user-1',
        name: 'server-two',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const group: ServerGroup = {
        id: 'group-1',
        userId: 'user-1',
        name: 'test-group',
        description: 'Test group',
        serverIds: ['server-1', 'server-2'],
        routingRules: [
          {
            id: 'rule-1',
            condition: { toolName: 'test_tool' },
            targetServerId: 'server-1',
            priority: 5,
            enabled: true
          },
          {
            id: 'rule-2',
            condition: { toolName: 'test_tool' },
            targetServerId: 'server-2',
            priority: 10, // Higher priority
            enabled: true
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const endpoint: Endpoint = {
        id: 'endpoint-1',
        userId: 'user-1',
        groupId: 'group-1',
        url: 'http://test.com/endpoint',
        sseUrl: 'http://test.com/sse',
        httpUrl: 'http://test.com/http',
        apiKeyId: 'key-1',
        createdAt: new Date()
      };

      mockServerRepo.addServer(server1);
      mockServerRepo.addServer(server2);
      mockGroupRepo.addGroup(group);
      mockEndpointRepo.addEndpoint(endpoint);

      const result = await routerService.routeToolCall('endpoint-1', 'test_tool', {});

      expect(result.success).toBe(true);
      expect(result.serverId).toBe('server-2'); // Should route to higher priority server
    });

    it('should handle disabled routing rules', async () => {
      const server1: RegisteredServer = {
        id: 'server-1',
        userId: 'user-1',
        name: 'server-one',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const server2: RegisteredServer = {
        id: 'server-2',
        userId: 'user-1',
        name: 'server-two',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const group: ServerGroup = {
        id: 'group-1',
        userId: 'user-1',
        name: 'test-group',
        description: 'Test group',
        serverIds: ['server-1', 'server-2'],
        routingRules: [
          {
            id: 'rule-1',
            condition: { toolName: 'test_tool' },
            targetServerId: 'server-2',
            priority: 10,
            enabled: false // Disabled rule
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const endpoint: Endpoint = {
        id: 'endpoint-1',
        userId: 'user-1',
        groupId: 'group-1',
        url: 'http://test.com/endpoint',
        sseUrl: 'http://test.com/sse',
        httpUrl: 'http://test.com/http',
        apiKeyId: 'key-1',
        createdAt: new Date()
      };

      mockServerRepo.addServer(server1);
      mockServerRepo.addServer(server2);
      mockGroupRepo.addGroup(group);
      mockEndpointRepo.addEndpoint(endpoint);

      const result = await routerService.routeToolCall('endpoint-1', 'test_tool', {});

      expect(result.success).toBe(true);
      // Should use random selection since the rule is disabled
      expect(['server-1', 'server-2']).toContain(result.serverId);
    });

    it('should handle server errors gracefully during tool listing', async () => {
      const server1: RegisteredServer = {
        id: 'server-1',
        userId: 'user-1',
        name: 'working-server',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const server2: RegisteredServer = {
        id: 'server-2',
        userId: 'user-1',
        name: 'failing-server',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const endpoint: Endpoint = {
        id: 'endpoint-1',
        userId: 'user-1',
        url: 'http://test.com/endpoint',
        sseUrl: 'http://test.com/sse',
        httpUrl: 'http://test.com/http',
        apiKeyId: 'key-1',
        createdAt: new Date()
      };

      mockServerRepo.addServer(server1);
      mockServerRepo.addServer(server2);
      mockEndpointRepo.addEndpoint(endpoint);

      // Make server-2 fail when listing tools
      mockProtocolAdapter.setMockResponse('server-2', 'tools/list', { error: 'Server error' });

      const tools = await routerService.getAvailableTools('endpoint-1');

      // Should still get tools from working server
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every(tool => tool.namespace === 'working-server')).toBe(true);
    });

    it('should properly convert tool metadata with parameters', async () => {
      const server: RegisteredServer = {
        id: 'server-1',
        userId: 'user-1',
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const endpoint: Endpoint = {
        id: 'endpoint-1',
        userId: 'user-1',
        url: 'http://test.com/endpoint',
        sseUrl: 'http://test.com/sse',
        httpUrl: 'http://test.com/http',
        apiKeyId: 'key-1',
        createdAt: new Date()
      };

      mockServerRepo.addServer(server);
      mockEndpointRepo.addEndpoint(endpoint);

      // Mock a tool with detailed parameter schema
      mockProtocolAdapter.setMockResponse('server-1', 'tools/list', {
        tools: [
          {
            name: 'complex_tool',
            description: 'A tool with complex parameters',
            inputSchema: {
              type: 'object',
              properties: {
                required_param: {
                  type: 'string',
                  description: 'A required parameter'
                },
                optional_param: {
                  type: 'number',
                  description: 'An optional parameter',
                  default: 42
                },
                boolean_param: {
                  type: 'boolean',
                  description: 'A boolean parameter'
                }
              },
              required: ['required_param']
            }
          }
        ]
      });

      const tools = await routerService.getAvailableTools('endpoint-1');

      expect(tools).toHaveLength(1);
      const tool = tools[0];
      
      expect(tool.name).toBe('test-server.complex_tool');
      expect(tool.description).toBe('A tool with complex parameters');
      expect(tool.parameters).toHaveLength(3);
      
      const requiredParam = tool.parameters.find(p => p.name === 'required_param');
      expect(requiredParam).toBeDefined();
      expect(requiredParam?.required).toBe(true);
      expect(requiredParam?.type).toBe('string');
      
      const optionalParam = tool.parameters.find(p => p.name === 'optional_param');
      expect(optionalParam).toBeDefined();
      expect(optionalParam?.required).toBe(false);
      expect(optionalParam?.default).toBe(42);
      
      const booleanParam = tool.parameters.find(p => p.name === 'boolean_param');
      expect(booleanParam).toBeDefined();
      expect(booleanParam?.type).toBe('boolean');
    });
  });
});