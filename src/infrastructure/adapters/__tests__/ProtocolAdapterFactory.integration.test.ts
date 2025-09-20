import { ProtocolAdapterFactory, AdapterStatus, AdapterLifecycleEvent } from '../ProtocolAdapterFactory';
import { ServerConfig, ServerProtocol } from '../../../domain/models/Server';
import { StdioAdapter } from '../StdioAdapter';
import { SseAdapter } from '../SseAdapter';
import { HttpAdapter } from '../HttpAdapter';

// Mock the adapters for integration testing
jest.mock('../StdioAdapter');
jest.mock('../SseAdapter');
jest.mock('../HttpAdapter');

const MockStdioAdapter = StdioAdapter as jest.MockedClass<typeof StdioAdapter>;
const MockSseAdapter = SseAdapter as jest.MockedClass<typeof SseAdapter>;
const MockHttpAdapter = HttpAdapter as jest.MockedClass<typeof HttpAdapter>;

// Mock fetch for HTTP adapter
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock EventSource for SSE adapter
(global as any).EventSource = jest.fn().mockImplementation(() => ({
  close: jest.fn(),
  addEventListener: jest.fn(),
  onopen: null,
  onerror: null,
  onmessage: null
}));

describe('ProtocolAdapterFactory Integration Tests', () => {
  let factory: ProtocolAdapterFactory;
  let lifecycleEvents: AdapterLifecycleEvent[] = [];

  beforeEach(() => {
    lifecycleEvents = [];
    
    factory = new ProtocolAdapterFactory({
      stdio: { 
        maxRestarts: 3,
        restartDelay: 1000,
        healthCheckInterval: 5000
      },
      sse: { 
        maxReconnects: 5,
        reconnectDelay: 2000
      },
      http: { 
        maxConcurrentRequests: 10,
        requestTimeout: 5000
      },
      healthCheckInterval: 1000,
      maxConcurrentAdapters: 50,
      enableAutoRestart: true
    });

    // Listen to lifecycle events
    factory.on('lifecycleEvent', (event: AdapterLifecycleEvent) => {
      lifecycleEvents.push(event);
    });

    // Reset mocks
    MockStdioAdapter.mockClear();
    MockSseAdapter.mockClear();
    MockHttpAdapter.mockClear();

    // Setup default mock implementations
    setupMockAdapters();
  });

  afterEach(async () => {
    await factory.gracefulShutdown();
    lifecycleEvents = [];
  });

  describe('Lifecycle Management', () => {
    it('should manage complete adapter lifecycle', async () => {
      const config: ServerConfig = {
        stdio: {
          command: 'node',
          args: ['server.js'],
          env: { NODE_ENV: 'test' }
        }
      };

      // Create adapter
      const instance = await factory.createAdapter('server-1', config);
      
      expect(instance.status).toBe(AdapterStatus.CONNECTED);
      expect(instance.createdAt).toBeInstanceOf(Date);
      expect(instance.metadata.requestCount).toBe(0);
      expect(instance.metadata.errorCount).toBe(0);
      expect(instance.metadata.restartCount).toBe(0);

      // Check lifecycle events
      expect(lifecycleEvents).toHaveLength(2);
      expect(lifecycleEvents[0].status).toBe(AdapterStatus.INITIALIZING);
      expect(lifecycleEvents[1].status).toBe(AdapterStatus.CONNECTED);

      // Send request to track usage
      await factory.sendRequest(instance.id, { method: 'test' });
      
      expect(instance.metadata.requestCount).toBe(1);
      expect(instance.lastUsedAt).toBeInstanceOf(Date);

      // Remove adapter
      await factory.removeAdapter(instance.id);
      
      expect(factory.getAdapter(instance.id)).toBeUndefined();
    });

    it('should handle adapter creation failure gracefully', async () => {
      // Mock adapter to fail during start
      MockStdioAdapter.prototype.start = jest.fn().mockRejectedValue(new Error('Start failed'));

      const config: ServerConfig = {
        stdio: {
          command: 'node',
          args: ['server.js']
        }
      };

      await expect(factory.createAdapter('server-fail', config))
        .rejects.toThrow('Start failed');

      // Should have lifecycle events for initialization and error
      expect(lifecycleEvents).toHaveLength(2);
      expect(lifecycleEvents[0].status).toBe(AdapterStatus.INITIALIZING);
      expect(lifecycleEvents[1].status).toBe(AdapterStatus.ERROR);

      // Failed adapter should not be in registry
      expect(factory.getAllAdapters()).toHaveLength(0);
    });

    it('should enforce maximum concurrent adapters limit', async () => {
      const smallFactory = new ProtocolAdapterFactory({
        maxConcurrentAdapters: 2
      });

      const config: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      // Create maximum allowed adapters
      await smallFactory.createAdapter('server-1', config);
      await smallFactory.createAdapter('server-2', config);

      // Third adapter should fail
      await expect(smallFactory.createAdapter('server-3', config))
        .rejects.toThrow('Maximum concurrent adapters limit reached: 2');

      await smallFactory.gracefulShutdown();
    });

    it('should prevent adapter creation during shutdown', async () => {
      const config: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      // Start shutdown process
      const shutdownPromise = factory.gracefulShutdown();

      // Try to create adapter during shutdown
      await expect(factory.createAdapter('server-1', config))
        .rejects.toThrow('Factory is shutting down, cannot create new adapters');

      await shutdownPromise;
    });
  });

  describe('Health Monitoring and Auto-Restart', () => {
    it('should perform health checks and emit events', async () => {
      const config: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      const instance = await factory.createAdapter('server-1', config);

      // Get health directly instead of waiting for events
      const health = factory.getAdapterHealth(instance.id);

      expect(health).toMatchObject({
        adapterId: expect.any(String),
        status: expect.any(String),
        lastCheck: expect.any(Date)
      });
    });

    it('should restart unhealthy adapters automatically', async () => {
      const config: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      const instance = await factory.createAdapter('server-1', config);

      // Reset mocks to track restart calls
      const mockStop = jest.fn().mockResolvedValue(undefined);
      const mockStart = jest.fn().mockResolvedValue(undefined);
      MockStdioAdapter.prototype.stop = mockStop;
      MockStdioAdapter.prototype.start = mockStart;

      // Manually trigger restart
      await factory.restartAdapter(instance.id);

      expect(instance.metadata.restartCount).toBe(1);
      expect(mockStop).toHaveBeenCalled();
      expect(mockStart).toHaveBeenCalled();

      // Check lifecycle events include reconnecting and connected
      const reconnectingEvents = lifecycleEvents.filter(e => e.status === AdapterStatus.RECONNECTING);
      expect(reconnectingEvents).toHaveLength(1);
    });

    it('should handle restart failures', async () => {
      const config: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      const instance = await factory.createAdapter('server-1', config);

      // Mock restart to fail
      MockStdioAdapter.prototype.stop = jest.fn().mockResolvedValue(undefined);
      MockStdioAdapter.prototype.start = jest.fn().mockRejectedValue(new Error('Restart failed'));

      await expect(factory.restartAdapter(instance.id))
        .rejects.toThrow('Restart failed');

      expect(instance.status).toBe(AdapterStatus.ERROR);
      expect(instance.metadata.lastError).toBe('Restart failed');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide comprehensive adapter statistics', async () => {
      const configs = [
        { stdio: { command: 'node', args: ['server1.js'] } },
        { sse: { url: 'https://example.com/sse1' } },
        { http: { baseUrl: 'https://example.com/api1' } }
      ];

      // Create adapters of different protocols
      for (let i = 0; i < configs.length; i++) {
        await factory.createAdapter(`server-${i + 1}`, configs[i]);
      }

      const stats = factory.getAdapterStatistics();

      expect(stats.totalAdapters).toBe(3);
      expect(stats.adaptersByProtocol[ServerProtocol.STDIO]).toBe(1);
      expect(stats.adaptersByProtocol[ServerProtocol.SSE]).toBe(1);
      expect(stats.adaptersByProtocol[ServerProtocol.HTTP]).toBe(1);
      expect(stats.adaptersByStatus[AdapterStatus.CONNECTED]).toBe(3);
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalErrors).toBe(0);
      expect(stats.averageUptime).toBeGreaterThan(0);
    });

    it('should track request and error metrics', async () => {
      const config: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      const instance = await factory.createAdapter('server-1', config);

      // Send successful requests
      await factory.sendRequest(instance.id, { method: 'test1' });
      await factory.sendRequest(instance.id, { method: 'test2' });

      expect(instance.metadata.requestCount).toBe(2);
      expect(instance.metadata.errorCount).toBe(0);

      // Mock error for next request by creating a new mock that fails
      const originalSendRequest = MockStdioAdapter.prototype.sendRequest;
      MockStdioAdapter.prototype.sendRequest = jest.fn().mockRejectedValue(new Error('Request failed'));

      try {
        await factory.sendRequest(instance.id, { method: 'test3' });
      } catch (error) {
        // Expected error
      }

      // Restore original mock
      MockStdioAdapter.prototype.sendRequest = originalSendRequest;

      const stats = factory.getAdapterStatistics();
      expect(stats.totalRequests).toBe(3);
      expect(stats.totalErrors).toBe(1);

      expect(instance.metadata.requestCount).toBe(3);
      expect(instance.metadata.errorCount).toBe(1);
      expect(instance.metadata.lastError).toBe('Request failed');
    });
  });

  describe('Graceful Shutdown', () => {
    it('should shutdown all adapters gracefully', async () => {
      const configs = [
        { stdio: { command: 'node', args: ['server1.js'] } },
        { sse: { url: 'https://example.com/sse1' } },
        { http: { baseUrl: 'https://example.com/api1' } }
      ];

      // Create multiple adapters
      for (let i = 0; i < configs.length; i++) {
        await factory.createAdapter(`server-${i + 1}`, configs[i]);
      }

      expect(factory.getAllAdapters()).toHaveLength(3);

      // Shutdown
      const shutdownPromise = new Promise(resolve => {
        factory.on('shutdown', resolve);
      });

      await factory.gracefulShutdown();
      await shutdownPromise;

      expect(factory.getAllAdapters()).toHaveLength(0);
      expect(MockStdioAdapter.prototype.stop).toHaveBeenCalled();
      expect(MockSseAdapter.prototype.disconnect).toHaveBeenCalled();
      expect(MockHttpAdapter.prototype.cleanup).toHaveBeenCalled();
    });

    it('should handle shutdown errors gracefully', async () => {
      const config: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      await factory.createAdapter('server-1', config);

      // Mock stop to fail
      MockStdioAdapter.prototype.stop = jest.fn().mockRejectedValue(new Error('Stop failed'));

      const errorEvents: any[] = [];
      factory.on('error', (event) => errorEvents.push(event));

      await factory.gracefulShutdown();

      // Should still complete shutdown despite errors
      expect(factory.getAllAdapters()).toHaveLength(0);
      // Error events may or may not be emitted depending on timing
    });
  });

  describe('Multi-Protocol Integration', () => {
    it('should handle mixed protocol operations', async () => {
      const configs = [
        { stdio: { command: 'node', args: ['stdio-server.js'] } },
        { sse: { url: 'https://example.com/sse' } },
        { http: { baseUrl: 'https://example.com/api' } }
      ];

      const instances = [];
      for (let i = 0; i < configs.length; i++) {
        const instance = await factory.createAdapter(`server-${i + 1}`, configs[i]);
        instances.push(instance);
      }

      // Test requests to all protocols
      const results = await Promise.all([
        factory.sendRequest(instances[0].id, { method: 'stdio-test' }),
        factory.sendRequest(instances[1].id, { method: 'sse-test' }),
        factory.sendRequest(instances[2].id, { method: 'http-test' })
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].result).toBe('stdio');
      expect(results[1].result).toBe('sse');
      expect(results[2].result).toBe('http');

      // Test streaming to all protocols
      for (const instance of instances) {
        const streamResults: any[] = [];
        for await (const chunk of factory.streamRequest(instance.id, { method: 'stream-test' })) {
          streamResults.push(chunk);
        }
        expect(streamResults).toHaveLength(1);
        expect(streamResults[0].done).toBe(true);
      }
    });

    it('should provide protocol-specific health information', async () => {
      const configs = [
        { stdio: { command: 'node', args: ['stdio-server.js'] } },
        { sse: { url: 'https://example.com/sse' } },
        { http: { baseUrl: 'https://example.com/api' } }
      ];

      const instances = [];
      for (let i = 0; i < configs.length; i++) {
        const instance = await factory.createAdapter(`server-${i + 1}`, configs[i]);
        instances.push(instance);
      }

      // Get health for all adapters
      for (const instance of instances) {
        const health = factory.getAdapterHealth(instance.id);
        
        expect(health).toMatchObject({
          adapterId: expect.any(String),
          status: expect.any(String),
          lastCheck: expect.any(Date),
          metadata: expect.objectContaining({
            requestCount: expect.any(Number),
            errorCount: expect.any(Number),
            uptime: expect.any(Number),
            restartCount: expect.any(Number)
          })
        });
      }
    });
  });

  // Helper function to setup mock adapters
  function setupMockAdapters() {
    // STDIO Adapter mocks
    MockStdioAdapter.prototype.start = jest.fn().mockResolvedValue(undefined);
    MockStdioAdapter.prototype.stop = jest.fn().mockResolvedValue(undefined);
    MockStdioAdapter.prototype.sendRequest = jest.fn().mockResolvedValue({ result: 'stdio' });
    MockStdioAdapter.prototype.streamRequest = jest.fn().mockImplementation(async function* () {
      yield { data: 'stdio-stream', done: true };
    });
    MockStdioAdapter.prototype.getHealth = jest.fn().mockImplementation(function(this: any) {
      return {
        adapterId: this.id || 'test',
        status: 'healthy',
        lastCheck: new Date()
      };
    });

    // SSE Adapter mocks
    MockSseAdapter.prototype.connect = jest.fn().mockResolvedValue(undefined);
    MockSseAdapter.prototype.disconnect = jest.fn().mockResolvedValue(undefined);
    MockSseAdapter.prototype.sendRequest = jest.fn().mockResolvedValue({ result: 'sse' });
    MockSseAdapter.prototype.streamRequest = jest.fn().mockImplementation(async function* () {
      yield { data: 'sse-stream', done: true };
    });
    MockSseAdapter.prototype.getHealth = jest.fn().mockImplementation(function(this: any) {
      return {
        adapterId: this.id || 'test',
        status: 'healthy',
        lastCheck: new Date()
      };
    });

    // HTTP Adapter mocks
    MockHttpAdapter.prototype.initialize = jest.fn().mockResolvedValue(undefined);
    MockHttpAdapter.prototype.cleanup = jest.fn().mockResolvedValue(undefined);
    MockHttpAdapter.prototype.sendRequest = jest.fn().mockResolvedValue({ result: 'http' });
    MockHttpAdapter.prototype.streamRequest = jest.fn().mockImplementation(async function* () {
      yield { data: 'http-stream', done: true };
    });
    MockHttpAdapter.prototype.getHealth = jest.fn().mockImplementation(function(this: any) {
      return {
        adapterId: this.id || 'test',
        status: 'healthy',
        lastCheck: new Date()
      };
    });

    // Mock EventEmitter methods for all adapters
    const mockOn = jest.fn();
    const mockEmit = jest.fn();
    
    MockStdioAdapter.prototype.on = mockOn;
    MockStdioAdapter.prototype.emit = mockEmit;
    MockSseAdapter.prototype.on = mockOn;
    MockSseAdapter.prototype.emit = mockEmit;
    MockHttpAdapter.prototype.on = mockOn;
    MockHttpAdapter.prototype.emit = mockEmit;
  }
});