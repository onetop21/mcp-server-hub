import { RouterService } from '../RouterService';
import { IProtocolAdapterService, McpRequest, McpResponse, AdapterHealth } from '../IProtocolAdapterService';
import { RegisteredServer, ServerStatus, ServerProtocol } from '../../models/Server';
import { Endpoint, ServerGroup, RoutingRule } from '../../models/Endpoint';

/**
 * Integration test for RouterService demonstrating complete tool routing and namespace functionality
 */
describe('RouterService Integration Tests', () => {
  let routerService: RouterService;
  let mockProtocolAdapter: IProtocolAdapterService;
  let mockServerRepo: any;
  let mockEndpointRepo: any;
  let mockGroupRepo: any;

  // Mock data
  const servers: RegisteredServer[] = [
    {
      id: 'weather-server',
      userId: 'user-1',
      name: 'weather-service',
      protocol: ServerProtocol.STDIO,
      config: { stdio: { command: 'weather-server', args: [] } },
      namespace: 'weather',
      status: ServerStatus.ACTIVE,
      lastHealthCheck: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'file-server',
      userId: 'user-1',
      name: 'file-service',
      protocol: ServerProtocol.SSE,
      config: { sse: { url: 'http://localhost:3001/sse' } },
      namespace: 'files',
      status: ServerStatus.ACTIVE,
      lastHealthCheck: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'backup-weather-server',
      userId: 'user-1',
      name: 'backup-weather',
      protocol: ServerProtocol.HTTP,
      config: { http: { baseUrl: 'http://localhost:3002' } },
      namespace: 'weather',
      status: ServerStatus.ACTIVE,
      lastHealthCheck: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const serverGroup: ServerGroup = {
    id: 'production-group',
    userId: 'user-1',
    name: 'Production Services',
    description: 'Production environment servers',
    serverIds: ['weather-server', 'file-server', 'backup-weather-server'],
    routingRules: [
      {
        id: 'weather-priority-rule',
        condition: { toolName: 'get_weather' },
        targetServerId: 'weather-server',
        priority: 10,
        enabled: true
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const endpoint: Endpoint = {
    id: 'prod-endpoint',
    userId: 'user-1',
    groupId: 'production-group',
    url: 'http://hub.example.com/prod',
    sseUrl: 'http://hub.example.com/prod/sse',
    httpUrl: 'http://hub.example.com/prod/http',
    apiKeyId: 'api-key-1',
    createdAt: new Date()
  };

  beforeEach(() => {
    // Mock protocol adapter
    mockProtocolAdapter = {
      async createAdapter() {
        return { id: 'adapter-1', serverId: 'server-1', protocol: 'stdio', status: 'connected', createdAt: new Date() };
      },

      async sendRequest(adapterId: string, request: McpRequest): Promise<McpResponse> {
        // Mock different responses based on server
        if (request.method === 'tools/list') {
          switch (adapterId) {
            case 'weather-server':
              return {
                result: {
                  tools: [
                    {
                      name: 'get_weather',
                      description: 'Get current weather for a location',
                      inputSchema: {
                        type: 'object',
                        properties: {
                          location: { type: 'string', description: 'Location to get weather for' },
                          units: { type: 'string', description: 'Temperature units', default: 'celsius' }
                        },
                        required: ['location']
                      }
                    },
                    {
                      name: 'get_forecast',
                      description: 'Get weather forecast',
                      inputSchema: {
                        type: 'object',
                        properties: {
                          location: { type: 'string', description: 'Location for forecast' },
                          days: { type: 'number', description: 'Number of days', default: 5 }
                        },
                        required: ['location']
                      }
                    }
                  ]
                }
              };

            case 'file-server':
              return {
                result: {
                  tools: [
                    {
                      name: 'read_file',
                      description: 'Read contents of a file',
                      inputSchema: {
                        type: 'object',
                        properties: {
                          path: { type: 'string', description: 'File path to read' }
                        },
                        required: ['path']
                      }
                    },
                    {
                      name: 'write_file',
                      description: 'Write contents to a file',
                      inputSchema: {
                        type: 'object',
                        properties: {
                          path: { type: 'string', description: 'File path to write' },
                          content: { type: 'string', description: 'Content to write' }
                        },
                        required: ['path', 'content']
                      }
                    }
                  ]
                }
              };

            case 'backup-weather-server':
              return {
                result: {
                  tools: [
                    {
                      name: 'get_weather',
                      description: 'Backup weather service',
                      inputSchema: {
                        type: 'object',
                        properties: {
                          location: { type: 'string', description: 'Location to get weather for' }
                        },
                        required: ['location']
                      }
                    }
                  ]
                }
              };

            default:
              return { result: { tools: [] } };
          }
        }

        if (request.method === 'tools/call') {
          // Mock tool execution responses
          const toolName = request.params?.name;
          switch (toolName) {
            case 'get_weather':
              return {
                result: {
                  temperature: '22°C',
                  condition: 'Sunny',
                  location: request.params?.arguments?.location || 'Unknown',
                  server: adapterId
                }
              };
            case 'read_file':
              return {
                result: {
                  content: 'File content from ' + request.params?.arguments?.path,
                  server: adapterId
                }
              };
            default:
              return { result: { message: 'Tool executed', server: adapterId } };
          }
        }

        return { result: null };
      },

      async *streamRequest() {
        yield { data: 'stream data', done: true };
      },

      async closeAdapter() {
        // Mock implementation
      },

      async getAdapterHealth(adapterId: string): Promise<AdapterHealth> {
        return {
          adapterId,
          status: 'healthy',
          lastCheck: new Date(),
          responseTime: 100
        };
      },

      async getActiveAdapters() {
        return [];
      }
    };

    // Mock repositories
    mockServerRepo = {
      async findServerById(id: string) {
        return servers.find(s => s.id === id) || null;
      },
      async findByUserId(userId: string) {
        return servers.filter(s => s.userId === userId);
      }
    };

    mockEndpointRepo = {
      async findEndpointById(id: string) {
        return id === 'prod-endpoint' ? endpoint : null;
      }
    };

    mockGroupRepo = {
      async findGroupById(id: string) {
        return id === 'production-group' ? serverGroup : null;
      },
      async updateRoutingRules() {
        // Mock implementation
      }
    };

    routerService = new RouterService(
      mockServerRepo,
      mockEndpointRepo,
      mockGroupRepo,
      mockProtocolAdapter
    );
  });

  describe('Complete Tool Routing Workflow', () => {
    it('should demonstrate complete namespace and routing functionality', async () => {
      // 1. Get all available tools with proper namespacing
      const tools = await routerService.getAvailableTools('prod-endpoint');

      // Verify tools are properly namespaced
      expect(tools).toHaveLength(5); // 2 weather + 2 file + 1 backup weather
      
      const weatherTools = tools.filter(t => t.namespace === 'weather');
      const fileTools = tools.filter(t => t.namespace === 'files');
      
      expect(weatherTools).toHaveLength(3); // get_weather from both servers + get_forecast
      expect(fileTools).toHaveLength(2); // read_file + write_file
      
      // Verify namespaced tool names
      expect(tools.map(t => t.name)).toContain('weather.get_weather');
      expect(tools.map(t => t.name)).toContain('weather.get_forecast');
      expect(tools.map(t => t.name)).toContain('files.read_file');
      expect(tools.map(t => t.name)).toContain('files.write_file');

      // 2. Test routing rule application (weather.get_weather should go to primary server)
      const weatherResult = await routerService.routeToolCall(
        'prod-endpoint',
        'weather.get_weather',
        { location: 'New York' }
      );

      expect(weatherResult.success).toBe(true);
      expect(weatherResult.serverId).toBe('weather-server'); // Should use primary due to routing rule
      expect(weatherResult.result.server).toBe('weather-server');

      // 3. Test tool without routing rule (should use available server)
      const forecastResult = await routerService.routeToolCall(
        'prod-endpoint',
        'weather.get_forecast',
        { location: 'London', days: 3 }
      );

      expect(forecastResult.success).toBe(true);
      expect(forecastResult.serverId).toBe('weather-server'); // Only server with this tool

      // 4. Test different namespace routing
      const fileResult = await routerService.routeToolCall(
        'prod-endpoint',
        'files.read_file',
        { path: '/tmp/test.txt' }
      );

      expect(fileResult.success).toBe(true);
      expect(fileResult.serverId).toBe('file-server');
      expect(fileResult.result.server).toBe('file-server');

      // 5. Test fallback when primary server is down
      // First, verify the primary server is being used when available
      const primaryResult = await routerService.routeToolCall(
        'prod-endpoint',
        'weather.get_weather',
        { location: 'Berlin' }
      );
      expect(primaryResult.success).toBe(true);
      expect(primaryResult.serverId).toBe('weather-server'); // Should use primary due to routing rule

      // Now simulate primary weather server going down
      servers[0].status = ServerStatus.INACTIVE;

      const fallbackResult = await routerService.routeToolCall(
        'prod-endpoint',
        'weather.get_weather',
        { location: 'Paris' }
      );

      expect(fallbackResult.success).toBe(true);
      expect(fallbackResult.serverId).toBe('backup-weather-server'); // Should fallback
      expect(fallbackResult.result.server).toBe('backup-weather-server');
    });

    it('should handle complex parameter schemas correctly', async () => {
      // Ensure all servers are active
      servers.forEach(server => server.status = ServerStatus.ACTIVE);
      
      const tools = await routerService.getAvailableTools('prod-endpoint');
      
      // Find the weather tool with detailed parameters (from primary server)
      const weatherTool = tools.find(t => t.name === 'weather.get_weather' && t.parameters.length >= 2);
      expect(weatherTool).toBeDefined();
      expect(weatherTool!.parameters).toHaveLength(2);
      
      const locationParam = weatherTool!.parameters.find(p => p.name === 'location');
      expect(locationParam).toBeDefined();
      expect(locationParam!.required).toBe(true);
      expect(locationParam!.type).toBe('string');
      
      const unitsParam = weatherTool!.parameters.find(p => p.name === 'units');
      expect(unitsParam).toBeDefined();
      expect(unitsParam!.required).toBe(false);
      expect(unitsParam!.default).toBe('celsius');
    });

    it('should maintain tool isolation between namespaces', async () => {
      // Verify that tools from different namespaces don't interfere
      const tools = await routerService.getAvailableTools('prod-endpoint');
      
      const weatherGetWeather = tools.filter(t => t.name === 'weather.get_weather');
      const filesGetWeather = tools.filter(t => t.name === 'files.get_weather');
      
      expect(weatherGetWeather.length).toBeGreaterThanOrEqual(1); // At least one weather server
      expect(filesGetWeather).toHaveLength(0); // File server doesn't have weather tools
      
      // Each weather tool should be associated with weather servers
      weatherGetWeather.forEach(tool => {
        expect(['weather-server', 'backup-weather-server']).toContain(tool.serverId);
        expect(tool.namespace).toBe('weather');
      });

      // Verify file tools are separate
      const fileTools = tools.filter(t => t.namespace === 'files');
      expect(fileTools.length).toBeGreaterThan(0);
      fileTools.forEach(tool => {
        expect(tool.serverId).toBe('file-server');
      });
    });

    it('should handle routing rules priority correctly', async () => {
      // Ensure the primary server is active
      servers[0].status = ServerStatus.ACTIVE;
      
      // Add a lower priority rule
      serverGroup.routingRules.push({
        id: 'backup-weather-rule',
        condition: { toolName: 'get_weather' },
        targetServerId: 'backup-weather-server',
        priority: 5, // Lower priority
        enabled: true
      });

      const result = await routerService.routeToolCall(
        'prod-endpoint',
        'weather.get_weather',
        { location: 'Tokyo' }
      );

      expect(result.success).toBe(true);
      expect(result.serverId).toBe('weather-server'); // Higher priority rule should win
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle namespace conflicts gracefully', async () => {
      // This test demonstrates that the system allows multiple servers to provide the same tool
      const tools = await routerService.getAvailableTools('prod-endpoint');
      
      // Both weather servers provide get_weather, and both should be available
      const weatherTools = tools.filter(t => t.name === 'weather.get_weather');
      expect(weatherTools.length).toBeGreaterThanOrEqual(1);
      
      // Each should have different server IDs if multiple exist
      const serverIds = weatherTools.map(t => t.serverId);
      expect(new Set(serverIds).size).toBe(weatherTools.length); // Should be unique
      
      // All should be in the weather namespace
      weatherTools.forEach(tool => {
        expect(tool.namespace).toBe('weather');
      });
    });

    it('should handle missing tools gracefully', async () => {
      const result = await routerService.routeToolCall(
        'prod-endpoint',
        'nonexistent.tool',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No server found for tool');
    });

    it('should handle server health monitoring', async () => {
      const health = await routerService.getServerHealth('weather-server');
      
      expect(health.serverId).toBe('weather-server');
      expect(health.status).toBe(ServerStatus.ACTIVE);
      expect(health.responseTime).toBe(100);
    });
  });
});