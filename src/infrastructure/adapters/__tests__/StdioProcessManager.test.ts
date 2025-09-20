import { StdioProcessManager } from '../StdioProcessManager';
import { StdioAdapter } from '../StdioAdapter';
import { StdioConfig } from '../../../domain/models/Server';

// Mock StdioAdapter
jest.mock('../StdioAdapter');
const MockStdioAdapter = StdioAdapter as jest.MockedClass<typeof StdioAdapter>;

describe('StdioProcessManager', () => {
  let manager: StdioProcessManager;
  let mockAdapter: jest.Mocked<StdioAdapter>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock adapter instance
    mockAdapter = {
      id: 'test-adapter-id',
      serverId: 'test-server',
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      restart: jest.fn().mockResolvedValue(undefined),
      sendRequest: jest.fn(),
      streamRequest: jest.fn(),
      getHealth: jest.fn(),
      getProcessState: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      removeAllListeners: jest.fn()
    } as any;

    MockStdioAdapter.mockImplementation(() => mockAdapter);

    manager = new StdioProcessManager({
      maxProcesses: 5,
      cleanupInterval: 1000
    });
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  describe('createAdapter', () => {
    const config: StdioConfig = {
      command: 'node',
      args: ['test-server.js']
    };

    it('should create and start a new adapter', async () => {
      const adapter = await manager.createAdapter('test-server', config);

      expect(MockStdioAdapter).toHaveBeenCalledWith(
        expect.stringMatching(/^stdio_test-server_\d+_[a-z0-9]+$/),
        'test-server',
        config,
        expect.any(Object)
      );
      expect(mockAdapter.start).toHaveBeenCalled();
      expect(adapter).toBe(mockAdapter);
    });

    it('should set up event listeners on the adapter', async () => {
      await manager.createAdapter('test-server', config);

      expect(mockAdapter.on).toHaveBeenCalledWith('started', expect.any(Function));
      expect(mockAdapter.on).toHaveBeenCalledWith('stopped', expect.any(Function));
      expect(mockAdapter.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockAdapter.on).toHaveBeenCalledWith('exit', expect.any(Function));
      expect(mockAdapter.on).toHaveBeenCalledWith('healthCheck', expect.any(Function));
      expect(mockAdapter.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockAdapter.on).toHaveBeenCalledWith('stderr', expect.any(Function));
      expect(mockAdapter.on).toHaveBeenCalledWith('parseError', expect.any(Function));
    });

    it('should throw error if max processes reached', async () => {
      // Create adapters up to the limit
      for (let i = 0; i < 5; i++) {
        MockStdioAdapter.mockImplementation(() => ({
          ...mockAdapter,
          id: `adapter-${i}`,
          serverId: `server-${i}`
        } as any));
        await manager.createAdapter(`server-${i}`, config);
      }

      // Try to create one more
      await expect(manager.createAdapter('server-6', config))
        .rejects.toThrow('Maximum number of processes reached: 5');
    });

    it('should emit adapterCreated event', async () => {
      const eventSpy = jest.fn();
      manager.on('adapterCreated', eventSpy);

      const adapter = await manager.createAdapter('test-server', config);

      expect(eventSpy).toHaveBeenCalledWith({
        adapterId: adapter.id,
        serverId: 'test-server'
      });
    });
  });

  describe('getAdapter', () => {
    it('should return existing adapter', async () => {
      const config: StdioConfig = { command: 'node', args: [] };
      const adapter = await manager.createAdapter('test-server', config);

      const retrieved = manager.getAdapter(adapter.id);
      expect(retrieved).toBe(mockAdapter);
    });

    it('should return undefined for non-existent adapter', () => {
      const retrieved = manager.getAdapter('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAdaptersByServer', () => {
    it('should return all adapters for a server', async () => {
      const config: StdioConfig = { command: 'node', args: [] };
      
      // Create multiple adapters for the same server
      MockStdioAdapter
        .mockImplementationOnce(() => ({ ...mockAdapter, id: 'adapter-1', serverId: 'test-server' } as any))
        .mockImplementationOnce(() => ({ ...mockAdapter, id: 'adapter-2', serverId: 'test-server' } as any))
        .mockImplementationOnce(() => ({ ...mockAdapter, id: 'adapter-3', serverId: 'other-server' } as any));

      await manager.createAdapter('test-server', config);
      await manager.createAdapter('test-server', config);
      await manager.createAdapter('other-server', config);

      const adapters = manager.getAdaptersByServer('test-server');
      expect(adapters).toHaveLength(2);
      expect(adapters.map(a => a.id)).toEqual(['adapter-1', 'adapter-2']);
    });

    it('should return empty array for server with no adapters', () => {
      const adapters = manager.getAdaptersByServer('non-existent');
      expect(adapters).toEqual([]);
    });
  });

  describe('getAllAdapters', () => {
    it('should return all adapters', async () => {
      const config: StdioConfig = { command: 'node', args: [] };
      
      MockStdioAdapter
        .mockImplementationOnce(() => ({ ...mockAdapter, id: 'adapter-1' } as any))
        .mockImplementationOnce(() => ({ ...mockAdapter, id: 'adapter-2' } as any));

      await manager.createAdapter('server-1', config);
      await manager.createAdapter('server-2', config);

      const adapters = manager.getAllAdapters();
      expect(adapters).toHaveLength(2);
    });
  });

  describe('removeAdapter', () => {
    it('should stop and remove adapter', async () => {
      const config: StdioConfig = { command: 'node', args: [] };
      const adapter = await manager.createAdapter('test-server', config);

      await manager.removeAdapter(adapter.id);

      expect(mockAdapter.stop).toHaveBeenCalled();
      expect(manager.getAdapter(adapter.id)).toBeUndefined();
    });

    it('should emit adapterRemoved event', async () => {
      const config: StdioConfig = { command: 'node', args: [] };
      const adapter = await manager.createAdapter('test-server', config);

      const eventSpy = jest.fn();
      manager.on('adapterRemoved', eventSpy);

      await manager.removeAdapter(adapter.id);

      expect(eventSpy).toHaveBeenCalledWith({
        adapterId: adapter.id,
        serverId: 'test-server'
      });
    });

    it('should handle removal of non-existent adapter gracefully', async () => {
      await expect(manager.removeAdapter('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('removeAdaptersByServer', () => {
    it('should remove all adapters for a server', async () => {
      const config: StdioConfig = { command: 'node', args: [] };
      
      MockStdioAdapter
        .mockImplementationOnce(() => ({ ...mockAdapter, id: 'adapter-1', serverId: 'test-server' } as any))
        .mockImplementationOnce(() => ({ ...mockAdapter, id: 'adapter-2', serverId: 'test-server' } as any));

      await manager.createAdapter('test-server', config);
      await manager.createAdapter('test-server', config);

      await manager.removeAdaptersByServer('test-server');

      expect(manager.getAdaptersByServer('test-server')).toHaveLength(0);
    });
  });

  describe('restartAdapter', () => {
    it('should restart existing adapter', async () => {
      const config: StdioConfig = { command: 'node', args: [] };
      const adapter = await manager.createAdapter('test-server', config);

      await manager.restartAdapter(adapter.id);

      expect(mockAdapter.restart).toHaveBeenCalled();
    });

    it('should emit adapterRestarted event', async () => {
      const config: StdioConfig = { command: 'node', args: [] };
      const adapter = await manager.createAdapter('test-server', config);

      const eventSpy = jest.fn();
      manager.on('adapterRestarted', eventSpy);

      await manager.restartAdapter(adapter.id);

      expect(eventSpy).toHaveBeenCalledWith({
        adapterId: adapter.id,
        serverId: 'test-server'
      });
    });

    it('should throw error for non-existent adapter', async () => {
      await expect(manager.restartAdapter('non-existent'))
        .rejects.toThrow('Adapter not found: non-existent');
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status for all adapters', async () => {
      const config: StdioConfig = { command: 'node', args: [] };
      
      const adapter = await manager.createAdapter('test-server', config);
      
      const mockHealth = {
        adapterId: adapter.id,
        status: 'healthy' as const,
        lastCheck: new Date()
      };
      
      mockAdapter.getHealth.mockReturnValue(mockHealth);
      
      const healthMap = manager.getHealthStatus();
      
      expect(healthMap.size).toBe(1);
      expect(healthMap.get(adapter.id)).toEqual(mockHealth);
    });
  });

  describe('getAdapterHealth', () => {
    it('should return health for specific adapter', async () => {
      const config: StdioConfig = { command: 'node', args: [] };
      
      const adapter = await manager.createAdapter('test-server', config);
      
      const mockHealth = {
        adapterId: adapter.id,
        status: 'healthy' as const,
        lastCheck: new Date()
      };
      
      mockAdapter.getHealth.mockReturnValue(mockHealth);
      
      const health = manager.getAdapterHealth(adapter.id);
      
      expect(health).toEqual(mockHealth);
    });

    it('should return undefined for non-existent adapter', () => {
      const health = manager.getAdapterHealth('non-existent');
      expect(health).toBeUndefined();
    });
  });

  describe('getStatistics', () => {
    it('should return process statistics', async () => {
      const config: StdioConfig = { command: 'node', args: [] };
      
      // Mock different process states
      MockStdioAdapter
        .mockImplementationOnce(() => ({
          ...mockAdapter,
          id: 'adapter-1',
          getProcessState: () => ({ status: 'running', restartCount: 0 })
        } as any))
        .mockImplementationOnce(() => ({
          ...mockAdapter,
          id: 'adapter-2',
          getProcessState: () => ({ status: 'error', restartCount: 1 })
        } as any))
        .mockImplementationOnce(() => ({
          ...mockAdapter,
          id: 'adapter-3',
          getProcessState: () => ({ status: 'stopped', restartCount: 0 })
        } as any));

      await manager.createAdapter('server-1', config);
      await manager.createAdapter('server-2', config);
      await manager.createAdapter('server-3', config);

      const stats = manager.getStatistics();

      expect(stats.totalAdapters).toBe(3);
      expect(stats.runningAdapters).toBe(1);
      expect(stats.errorAdapters).toBe(1);
      expect(stats.stoppedAdapters).toBe(1);
      expect(stats.memoryUsage).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should remove inactive adapters', async () => {
      const config: StdioConfig = { command: 'node', args: [] };
      
      // Create adapter with old last activity
      const oldDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      
      MockStdioAdapter.mockImplementationOnce(() => ({
        ...mockAdapter,
        id: 'old-adapter',
        getProcessState: () => ({
          status: 'stopped',
          restartCount: 0,
          lastActivity: oldDate
        }),
        getHealth: () => ({
          adapterId: 'old-adapter',
          status: 'unhealthy',
          lastCheck: new Date()
        })
      } as any));

      const adapter = await manager.createAdapter('test-server', config);
      
      expect(manager.getAllAdapters()).toHaveLength(1);
      
      await manager.cleanup();
      
      expect(manager.getAllAdapters()).toHaveLength(0);
    });

    it('should emit cleanup event', async () => {
      const config: StdioConfig = { command: 'node', args: [] };
      
      const oldDate = new Date(Date.now() - 10 * 60 * 1000);
      
      MockStdioAdapter.mockImplementationOnce(() => ({
        ...mockAdapter,
        getProcessState: () => ({
          status: 'stopped',
          restartCount: 0,
          lastActivity: oldDate
        }),
        getHealth: () => ({
          adapterId: mockAdapter.id,
          status: 'unhealthy',
          lastCheck: new Date()
        })
      } as any));

      const adapter = await manager.createAdapter('test-server', config);

      const eventSpy = jest.fn();
      manager.on('cleanup', eventSpy);

      await manager.cleanup();

      expect(eventSpy).toHaveBeenCalledWith({
        removedAdapters: [adapter.id]
      });
    });
  });

  describe('shutdown', () => {
    it('should stop all adapters and cleanup', async () => {
      const config: StdioConfig = { command: 'node', args: [] };
      
      MockStdioAdapter
        .mockImplementationOnce(() => ({ ...mockAdapter, id: 'adapter-1' } as any))
        .mockImplementationOnce(() => ({ ...mockAdapter, id: 'adapter-2' } as any));

      await manager.createAdapter('server-1', config);
      await manager.createAdapter('server-2', config);

      expect(manager.getAllAdapters()).toHaveLength(2);

      await manager.shutdown();

      expect(manager.getAllAdapters()).toHaveLength(0);
    });

    it('should emit shutdown event', async () => {
      const eventSpy = jest.fn();
      manager.on('shutdown', eventSpy);

      await manager.shutdown();

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('event forwarding', () => {
    it('should forward adapter events', async () => {
      const config: StdioConfig = { command: 'node', args: [] };
      
      // Set up event spies
      const startedSpy = jest.fn();
      const stoppedSpy = jest.fn();
      const errorSpy = jest.fn();
      
      manager.on('adapterStarted', startedSpy);
      manager.on('adapterStopped', stoppedSpy);
      manager.on('adapterError', errorSpy);

      await manager.createAdapter('test-server', config);

      // Get the event handler that was registered
      const onCalls = (mockAdapter.on as jest.Mock).mock.calls;
      const startedHandler = onCalls.find(call => call[0] === 'started')[1];
      const stoppedHandler = onCalls.find(call => call[0] === 'stopped')[1];
      const errorHandler = onCalls.find(call => call[0] === 'error')[1];

      // Simulate events
      startedHandler('test-adapter-id');
      stoppedHandler('test-adapter-id');
      errorHandler(new Error('Test error'));

      expect(startedSpy).toHaveBeenCalledWith({
        adapterId: 'test-adapter-id',
        serverId: 'test-server'
      });
      expect(stoppedSpy).toHaveBeenCalledWith({
        adapterId: 'test-adapter-id',
        serverId: 'test-server'
      });
      expect(errorSpy).toHaveBeenCalledWith({
        adapterId: 'test-adapter-id',
        serverId: 'test-server',
        error: expect.any(Error)
      });
    });
  });
});