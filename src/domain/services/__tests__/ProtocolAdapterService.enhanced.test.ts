import { ProtocolAdapterService } from '../ProtocolAdapterService';
import { ServerConfig, ServerProtocol } from '../../models/Server';
import { ProtocolAdapterFactory } from '../../../infrastructure/adapters/ProtocolAdapterFactory';

// Mock the factory
jest.mock('../../../infrastructure/adapters/ProtocolAdapterFactory');

const MockProtocolAdapterFactory = ProtocolAdapterFactory as jest.MockedClass<typeof ProtocolAdapterFactory>;

describe('Enhanced ProtocolAdapterService', () => {
  let service: ProtocolAdapterService;
  let mockFactory: jest.Mocked<ProtocolAdapterFactory>;

  beforeEach(() => {
    // Reset the mock
    MockProtocolAdapterFactory.mockClear();

    // Create mock factory instance
    mockFactory = {
      createAdapter: jest.fn(),
      removeAdapter: jest.fn(),
      sendRequest: jest.fn(),
      streamRequest: jest.fn(),
      getAdapterHealth: jest.fn(),
      getAllAdapters: jest.fn(),
      getAdapter: jest.fn(),
      restartAdapter: jest.fn(),
      gracefulShutdown: jest.fn(),
      getAdapterStatistics: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      removeAllListeners: jest.fn()
    } as any;

    // Mock the constructor to return our mock instance
    MockProtocolAdapterFactory.mockImplementation(() => mockFactory);

    service = new ProtocolAdapterService();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('Adapter Creation', () => {
    it('should create adapter using factory and return service interface', async () => {
      const serverConfig: ServerConfig & { id: string; protocol: ServerProtocol } = {
        id: 'server-1',
        protocol: ServerProtocol.STDIO,
        stdio: {
          command: 'node',
          args: ['server.js'],
          env: { NODE_ENV: 'test' }
        }
      };

      const mockAdapterInstance = {
        id: 'adapter-123',
        serverId: 'server-1',
        protocol: ServerProtocol.STDIO,
        status: 'connected' as any,
        createdAt: new Date(),
        lastUsedAt: undefined,
        adapter: {} as any, // Mock adapter instance
        metadata: {
          requestCount: 0,
          errorCount: 0,
          uptime: 0,
          restartCount: 0
        }
      };

      mockFactory.createAdapter.mockResolvedValue(mockAdapterInstance);

      const result = await service.createAdapter(serverConfig);

      expect(mockFactory.createAdapter).toHaveBeenCalledWith('server-1', serverConfig);
      expect(result).toMatchObject({
        id: 'adapter-123',
        serverId: 'server-1',
        protocol: ServerProtocol.STDIO,
        status: 'connected',
        createdAt: expect.any(Date)
      });
    });

    it('should handle adapter creation failure', async () => {
      const serverConfig: ServerConfig & { id: string; protocol: ServerProtocol } = {
        id: 'server-1',
        protocol: ServerProtocol.STDIO,
        stdio: { command: 'node', args: ['server.js'] }
      };

      mockFactory.createAdapter.mockRejectedValue(new Error('Creation failed'));

      await expect(service.createAdapter(serverConfig))
        .rejects.toThrow('Failed to create adapter for server server-1: Creation failed');
    });
  });

  describe('Request Handling', () => {
    it('should send request through factory', async () => {
      const request = { method: 'test', params: {} };
      const expectedResponse = { result: 'success' };

      mockFactory.sendRequest.mockResolvedValue(expectedResponse);

      const result = await service.sendRequest('adapter-123', request);

      expect(mockFactory.sendRequest).toHaveBeenCalledWith('adapter-123', request);
      expect(result).toBe(expectedResponse);
    });

    it('should handle request failure', async () => {
      const request = { method: 'test', params: {} };

      mockFactory.sendRequest.mockRejectedValue(new Error('Request failed'));

      await expect(service.sendRequest('adapter-123', request))
        .rejects.toThrow('Failed to send request through adapter adapter-123: Request failed');
    });

    it('should stream request through factory', async () => {
      const request = { method: 'stream', params: {} };
      const mockStream = [
        { data: 'chunk1', done: false },
        { data: 'chunk2', done: true }
      ];

      mockFactory.streamRequest.mockImplementation(async function* () {
        for (const chunk of mockStream) {
          yield chunk;
        }
      });

      const results: any[] = [];
      for await (const chunk of service.streamRequest('adapter-123', request)) {
        results.push(chunk);
      }

      expect(mockFactory.streamRequest).toHaveBeenCalledWith('adapter-123', request);
      expect(results).toEqual(mockStream);
    });

    it('should handle streaming failure', async () => {
      const request = { method: 'stream', params: {} };

      mockFactory.streamRequest.mockImplementation(async function* () {
        throw new Error('Stream failed');
      });

      const consumeStream = async () => {
        const results: any[] = [];
        for await (const chunk of service.streamRequest('adapter-123', request)) {
          results.push(chunk);
        }
        return results;
      };

      await expect(consumeStream())
        .rejects.toThrow('Failed to stream request through adapter adapter-123: Stream failed');
    });
  });

  describe('Adapter Management', () => {
    it('should close adapter through factory', async () => {
      mockFactory.removeAdapter.mockResolvedValue();

      await service.closeAdapter('adapter-123');

      expect(mockFactory.removeAdapter).toHaveBeenCalledWith('adapter-123');
    });

    it('should handle close adapter failure', async () => {
      mockFactory.removeAdapter.mockRejectedValue(new Error('Close failed'));

      await expect(service.closeAdapter('adapter-123'))
        .rejects.toThrow('Failed to close adapter adapter-123: Close failed');
    });

    it('should restart adapter through factory', async () => {
      mockFactory.restartAdapter.mockResolvedValue();

      await service.restartAdapter('adapter-123');

      expect(mockFactory.restartAdapter).toHaveBeenCalledWith('adapter-123');
    });

    it('should handle restart failure', async () => {
      mockFactory.restartAdapter.mockRejectedValue(new Error('Restart failed'));

      await expect(service.restartAdapter('adapter-123'))
        .rejects.toThrow('Failed to restart adapter adapter-123: Restart failed');
    });
  });

  describe('Health Monitoring', () => {
    it('should get adapter health through factory', async () => {
      const mockHealth = {
        adapterId: 'adapter-123',
        status: 'healthy' as const,
        lastCheck: new Date(),
        metadata: {
          requestCount: 5,
          errorCount: 0,
          uptime: 60000,
          restartCount: 0
        }
      };

      mockFactory.getAdapterHealth.mockReturnValue(mockHealth);

      const result = await service.getAdapterHealth('adapter-123');

      expect(mockFactory.getAdapterHealth).toHaveBeenCalledWith('adapter-123');
      expect(result).toMatchObject({
        adapterId: 'adapter-123',
        status: 'healthy',
        lastCheck: expect.any(Date)
      });
      // Metadata should be filtered out
      expect(result).not.toHaveProperty('metadata');
    });

    it('should handle health check failure', async () => {
      mockFactory.getAdapterHealth.mockImplementation(() => {
        throw new Error('Health check failed');
      });

      await expect(service.getAdapterHealth('adapter-123'))
        .rejects.toThrow('Failed to get adapter health for adapter-123: Health check failed');
    });
  });

  describe('Adapter Listing', () => {
    it('should get all active adapters from factory', async () => {
      const mockAdapters = [
        {
          id: 'adapter-1',
          serverId: 'server-1',
          protocol: ServerProtocol.STDIO,
          status: 'connected' as any,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          adapter: {} as any,
          metadata: { requestCount: 0, errorCount: 0, uptime: 0, restartCount: 0 }
        },
        {
          id: 'adapter-2',
          serverId: 'server-2',
          protocol: ServerProtocol.SSE,
          status: 'connected' as any,
          createdAt: new Date(),
          lastUsedAt: undefined,
          adapter: {} as any,
          metadata: { requestCount: 0, errorCount: 0, uptime: 0, restartCount: 0 }
        }
      ];

      mockFactory.getAllAdapters.mockReturnValue(mockAdapters);

      const result = await service.getActiveAdapters();

      expect(mockFactory.getAllAdapters).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'adapter-1',
        serverId: 'server-1',
        protocol: ServerProtocol.STDIO,
        status: 'connected'
      });
      expect(result[1]).toMatchObject({
        id: 'adapter-2',
        serverId: 'server-2',
        protocol: ServerProtocol.SSE,
        status: 'connected'
      });
    });

    it('should get adapter by server ID', () => {
      const mockAdapter = {
        id: 'adapter-123',
        serverId: 'server-1',
        protocol: ServerProtocol.STDIO,
        status: 'connected' as any,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        adapter: {} as any,
        metadata: { requestCount: 0, errorCount: 0, uptime: 0, restartCount: 0 }
      };

      mockFactory.getAdapter.mockReturnValue(mockAdapter);

      // First create an adapter to establish the mapping
      service['adapterMapping'].set('server-1', 'adapter-123');

      const result = service.getAdapterByServerId('server-1');

      expect(mockFactory.getAdapter).toHaveBeenCalledWith('adapter-123');
      expect(result).toMatchObject({
        id: 'adapter-123',
        serverId: 'server-1',
        protocol: ServerProtocol.STDIO,
        status: 'connected'
      });
    });

    it('should return undefined for non-existent server ID', () => {
      const result = service.getAdapterByServerId('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('Statistics', () => {
    it('should get factory statistics', () => {
      const mockStats = {
        totalAdapters: 3,
        adaptersByProtocol: {
          [ServerProtocol.STDIO]: 2,
          [ServerProtocol.SSE]: 1
        },
        adaptersByStatus: {
          connected: 3
        },
        totalRequests: 150,
        totalErrors: 5,
        averageUptime: 120000
      };

      mockFactory.getAdapterStatistics.mockReturnValue(mockStats);

      const result = service.getStatistics();

      expect(mockFactory.getAdapterStatistics).toHaveBeenCalled();
      expect(result).toBe(mockStats);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown factory gracefully', async () => {
      mockFactory.gracefulShutdown.mockResolvedValue();

      await service.shutdown();

      expect(mockFactory.gracefulShutdown).toHaveBeenCalled();
    });
  });

  describe('Status Mapping', () => {
    it('should map factory statuses to service statuses correctly', async () => {
      const testCases = [
        { factoryStatus: 'connected', expectedStatus: 'connected' },
        { factoryStatus: 'disconnected', expectedStatus: 'disconnected' },
        { factoryStatus: 'initializing', expectedStatus: 'disconnected' },
        { factoryStatus: 'error', expectedStatus: 'error' },
        { factoryStatus: 'reconnecting', expectedStatus: 'error' }
      ];

      for (const testCase of testCases) {
        const mockAdapter = {
          id: 'adapter-test',
          serverId: 'server-test',
          protocol: ServerProtocol.STDIO,
          status: testCase.factoryStatus as any,
          createdAt: new Date(),
          adapter: {} as any,
          metadata: { requestCount: 0, errorCount: 0, uptime: 0, restartCount: 0 }
        };

        mockFactory.getAllAdapters.mockReturnValue([mockAdapter]);

        const result = await service.getActiveAdapters();
        expect(result[0].status).toBe(testCase.expectedStatus);
      }
    });
  });
});