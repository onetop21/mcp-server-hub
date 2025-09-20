import { ProtocolAdapterFactory, AdapterStatus } from '../ProtocolAdapterFactory';
import { ServerConfig, ServerProtocol } from '../../../domain/models/Server';

// Mock the individual adapters
jest.mock('../StdioAdapter');
jest.mock('../SseAdapter');
jest.mock('../HttpAdapter');

import { StdioAdapter } from '../StdioAdapter';
import { SseAdapter } from '../SseAdapter';
import { HttpAdapter } from '../HttpAdapter';

const MockStdioAdapter = StdioAdapter as jest.MockedClass<typeof StdioAdapter>;
const MockSseAdapter = SseAdapter as jest.MockedClass<typeof SseAdapter>;
const MockHttpAdapter = HttpAdapter as jest.MockedClass<typeof HttpAdapter>;

describe('ProtocolAdapterFactory - Core Functionality', () => {
  let factory: ProtocolAdapterFactory;

  beforeEach(() => {
    // Setup mock implementations
    MockStdioAdapter.prototype.start = jest.fn().mockResolvedValue(undefined);
    MockStdioAdapter.prototype.stop = jest.fn().mockResolvedValue(undefined);
    MockStdioAdapter.prototype.sendRequest = jest.fn().mockResolvedValue({ result: 'stdio' });
    MockStdioAdapter.prototype.streamRequest = jest.fn().mockImplementation(async function* () {
      yield { data: 'stdio-stream', done: true };
    });
    MockStdioAdapter.prototype.getHealth = jest.fn().mockReturnValue({
      adapterId: 'test-id',
      status: 'healthy',
      lastCheck: new Date()
    });
    MockStdioAdapter.prototype.on = jest.fn();
    MockStdioAdapter.prototype.emit = jest.fn();

    MockSseAdapter.prototype.connect = jest.fn().mockResolvedValue(undefined);
    MockSseAdapter.prototype.disconnect = jest.fn().mockResolvedValue(undefined);
    MockSseAdapter.prototype.sendRequest = jest.fn().mockResolvedValue({ result: 'sse' });
    MockSseAdapter.prototype.streamRequest = jest.fn().mockImplementation(async function* () {
      yield { data: 'sse-stream', done: true };
    });
    MockSseAdapter.prototype.getHealth = jest.fn().mockReturnValue({
      adapterId: 'test-id',
      status: 'healthy',
      lastCheck: new Date()
    });
    MockSseAdapter.prototype.on = jest.fn();
    MockSseAdapter.prototype.emit = jest.fn();

    MockHttpAdapter.prototype.initialize = jest.fn().mockResolvedValue(undefined);
    MockHttpAdapter.prototype.cleanup = jest.fn().mockResolvedValue(undefined);
    MockHttpAdapter.prototype.sendRequest = jest.fn().mockResolvedValue({ result: 'http' });
    MockHttpAdapter.prototype.streamRequest = jest.fn().mockImplementation(async function* () {
      yield { data: 'http-stream', done: true };
    });
    MockHttpAdapter.prototype.getHealth = jest.fn().mockReturnValue({
      adapterId: 'test-id',
      status: 'healthy',
      lastCheck: new Date()
    });
    MockHttpAdapter.prototype.on = jest.fn();
    MockHttpAdapter.prototype.emit = jest.fn();

    factory = new ProtocolAdapterFactory({
      healthCheckInterval: 60000, // Long interval to avoid timing issues
      maxConcurrentAdapters: 10,
      enableAutoRestart: false // Disable auto-restart for predictable tests
    });
  });

  afterEach(async () => {
    await factory.gracefulShutdown();
  });

  describe('Factory Pattern Implementation', () => {
    it('should create adapters for different protocols', async () => {
      const stdioConfig: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      const sseConfig: ServerConfig = {
        sse: { url: 'https://example.com/sse' }
      };

      const httpConfig: ServerConfig = {
        http: { baseUrl: 'https://example.com/api' }
      };

      const stdioInstance = await factory.createAdapter('stdio-server', stdioConfig);
      const sseInstance = await factory.createAdapter('sse-server', sseConfig);
      const httpInstance = await factory.createAdapter('http-server', httpConfig);

      expect(stdioInstance.protocol).toBe(ServerProtocol.STDIO);
      expect(sseInstance.protocol).toBe(ServerProtocol.SSE);
      expect(httpInstance.protocol).toBe(ServerProtocol.HTTP);

      expect(stdioInstance.status).toBe(AdapterStatus.CONNECTED);
      expect(sseInstance.status).toBe(AdapterStatus.CONNECTED);
      expect(httpInstance.status).toBe(AdapterStatus.CONNECTED);
    });

    it('should validate protocol configurations', async () => {
      const invalidStdioConfig: ServerConfig = {
        stdio: { command: '', args: [] }
      };

      const invalidSseConfig: ServerConfig = {
        sse: { url: '' }
      };

      const invalidHttpConfig: ServerConfig = {
        http: { baseUrl: '' }
      };

      await expect(factory.createAdapter('invalid-stdio', invalidStdioConfig))
        .rejects.toThrow('STDIO configuration is required');

      await expect(factory.createAdapter('invalid-sse', invalidSseConfig))
        .rejects.toThrow('SSE configuration is required');

      await expect(factory.createAdapter('invalid-http', invalidHttpConfig))
        .rejects.toThrow('HTTP configuration is required');
    });

    it('should enforce concurrent adapter limits', async () => {
      const smallFactory = new ProtocolAdapterFactory({
        maxConcurrentAdapters: 1
      });

      const config: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      await smallFactory.createAdapter('server-1', config);

      await expect(smallFactory.createAdapter('server-2', config))
        .rejects.toThrow('Maximum concurrent adapters limit reached: 1');

      await smallFactory.gracefulShutdown();
    });
  });

  describe('Lifecycle Management', () => {
    it('should track adapter metadata', async () => {
      const config: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      const instance = await factory.createAdapter('server-1', config);

      expect(instance.metadata).toMatchObject({
        requestCount: 0,
        errorCount: 0,
        uptime: expect.any(Number),
        restartCount: 0
      });

      expect(instance.createdAt).toBeInstanceOf(Date);
      expect(instance.id).toMatch(/^adapter_server-1_\d+_\w+$/);
    });

    it('should manage adapter registry', async () => {
      const config: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      const instance = await factory.createAdapter('server-1', config);

      // Should be able to retrieve the adapter
      const retrieved = factory.getAdapter(instance.id);
      expect(retrieved).toBe(instance);

      // Should be able to get adapters by server
      const serverAdapters = factory.getAdaptersByServer('server-1');
      expect(serverAdapters).toContain(instance);

      // Should be in all adapters list
      const allAdapters = factory.getAllAdapters();
      expect(allAdapters).toContain(instance);

      // Should be able to remove the adapter
      await factory.removeAdapter(instance.id);
      expect(factory.getAdapter(instance.id)).toBeUndefined();
    });

    it('should provide comprehensive statistics', async () => {
      const configs = [
        { stdio: { command: 'node', args: ['server1.js'] } },
        { sse: { url: 'https://example.com/sse1' } },
        { http: { baseUrl: 'https://example.com/api1' } }
      ];

      for (let i = 0; i < configs.length; i++) {
        await factory.createAdapter(`server-${i + 1}`, configs[i]);
      }

      const stats = factory.getAdapterStatistics();

      expect(stats.totalAdapters).toBe(3);
      expect(stats.adaptersByProtocol).toMatchObject({
        [ServerProtocol.STDIO]: 1,
        [ServerProtocol.SSE]: 1,
        [ServerProtocol.HTTP]: 1
      });
      expect(stats.adaptersByStatus).toMatchObject({
        [AdapterStatus.CONNECTED]: 3
      });
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalErrors).toBe(0);
      expect(stats.averageUptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Health Monitoring', () => {
    it('should provide health information for adapters', async () => {
      const config: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      const instance = await factory.createAdapter('server-1', config);
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
    });

    it('should handle health checks for non-existent adapters', () => {
      const health = factory.getAdapterHealth('non-existent');

      expect(health).toMatchObject({
        adapterId: 'non-existent',
        status: 'unknown',
        lastCheck: expect.any(Date),
        error: 'Adapter not found'
      });
    });
  });

  describe('Request Handling', () => {
    it('should track request metrics', async () => {
      const config: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      const instance = await factory.createAdapter('server-1', config);

      // Send a request
      await factory.sendRequest(instance.id, { method: 'test' });

      expect(instance.metadata.requestCount).toBe(1);
      expect(instance.lastUsedAt).toBeInstanceOf(Date);

      // Send another request
      await factory.sendRequest(instance.id, { method: 'test2' });

      expect(instance.metadata.requestCount).toBe(2);
    });

    it('should handle requests to non-existent adapters', async () => {
      await expect(factory.sendRequest('non-existent', { method: 'test' }))
        .rejects.toThrow('Adapter not found: non-existent');
    });

    it('should handle streaming requests', async () => {
      const config: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      const instance = await factory.createAdapter('server-1', config);

      const results: any[] = [];
      for await (const chunk of factory.streamRequest(instance.id, { method: 'stream' })) {
        results.push(chunk);
      }

      expect(results.length).toBeGreaterThan(0);
      expect(instance.metadata.requestCount).toBe(1);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should shutdown all adapters', async () => {
      const config: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      await factory.createAdapter('server-1', config);
      await factory.createAdapter('server-2', config);

      expect(factory.getAllAdapters()).toHaveLength(2);

      await factory.gracefulShutdown();

      expect(factory.getAllAdapters()).toHaveLength(0);
    });

    it('should prevent new adapter creation during shutdown', async () => {
      const config: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      const shutdownPromise = factory.gracefulShutdown();

      await expect(factory.createAdapter('server-1', config))
        .rejects.toThrow('Factory is shutting down');

      await shutdownPromise;
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid protocol configurations', async () => {
      const emptyConfig: ServerConfig = {};

      await expect(factory.createAdapter('server-1', emptyConfig))
        .rejects.toThrow('No valid protocol configuration found');
    });

    it('should handle adapter status checks for disconnected adapters', async () => {
      const config: ServerConfig = {
        stdio: { command: 'node', args: ['server.js'] }
      };

      const instance = await factory.createAdapter('server-1', config);
      
      // Simulate disconnection
      instance.status = AdapterStatus.DISCONNECTED;

      await expect(factory.sendRequest(instance.id, { method: 'test' }))
        .rejects.toThrow('Adapter not connected: disconnected');
    });
  });
});