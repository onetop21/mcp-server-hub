import { ProtocolAdapterFactory } from '../ProtocolAdapterFactory';
import { ServerConfig, ServerProtocol } from '../../../domain/models/Server';
import { StdioAdapter } from '../StdioAdapter';
import { SseAdapter } from '../SseAdapter';
import { HttpAdapter } from '../HttpAdapter';

// Mock the adapters
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

describe('ProtocolAdapterFactory', () => {
  let factory: ProtocolAdapterFactory;

  beforeEach(() => {
    factory = new ProtocolAdapterFactory({
      stdio: { maxRestarts: 3 },
      sse: { maxReconnects: 5 },
      http: { maxConcurrentRequests: 10 }
    });

    // Reset mocks
    MockStdioAdapter.mockClear();
    MockSseAdapter.mockClear();
    MockHttpAdapter.mockClear();

    // Setup default mock implementations
    MockStdioAdapter.prototype.start = jest.fn().mockResolvedValue(undefined);
    MockStdioAdapter.prototype.stop = jest.fn().mockResolvedValue(undefined);
    MockStdioAdapter.prototype.sendRequest = jest.fn().mockResolvedValue({ result: 'stdio' });
    MockStdioAdapter.prototype.streamRequest = jest.fn().mockImplementation(async function* () {
      yield { data: 'stdio-stream', done: true };
    });
    MockStdioAdapter.prototype.getHealth = jest.fn().mockReturnValue({
      adapterId: 'test',
      status: 'healthy',
      lastCheck: new Date()
    });

    MockSseAdapter.prototype.connect = jest.fn().mockResolvedValue(undefined);
    MockSseAdapter.prototype.disconnect = jest.fn().mockResolvedValue(undefined);
    MockSseAdapter.prototype.sendRequest = jest.fn().mockResolvedValue({ result: 'sse' });
    MockSseAdapter.prototype.streamRequest = jest.fn().mockImplementation(async function* () {
      yield { data: 'sse-stream', done: true };
    });
    MockSseAdapter.prototype.getHealth = jest.fn().mockReturnValue({
      adapterId: 'test',
      status: 'healthy',
      lastCheck: new Date()
    });

    MockHttpAdapter.prototype.initialize = jest.fn().mockResolvedValue(undefined);
    MockHttpAdapter.prototype.cleanup = jest.fn().mockResolvedValue(undefined);
    MockHttpAdapter.prototype.sendRequest = jest.fn().mockResolvedValue({ result: 'http' });
    MockHttpAdapter.prototype.streamRequest = jest.fn().mockImplementation(async function* () {
      yield { data: 'http-stream', done: true };
    });
    MockHttpAdapter.prototype.getHealth = jest.fn().mockReturnValue({
      adapterId: 'test',
      status: 'healthy',
      lastCheck: new Date()
    });
  });

  afterEach(async () => {
    await factory.cleanup();
  });

  describe('Adapter Creation', () => {
    it('should create STDIO adapter', async () => {
      const config: ServerConfig = {
        stdio: {
          command: 'node',
          args: ['server.js'],
          env: { NODE_ENV: 'test' }
        }
      };

      const instance = await factory.createAdapter('server-1', config);

      expect(instance.serverId).toBe('server-1');
      expect(instance.protocol).toBe(ServerProtocol.STDIO);
      expect(instance.id).toMatch(/^adapter_server-1_\d+_\w+$/);
      expect(MockStdioAdapter).toHaveBeenCalledWith(
        instance.id,
        'server-1',
        config.stdio,
        { maxRestarts: 3 }
      );
      expect(MockStdioAdapter.prototype.start).toHaveBeenCalled();
    });

    it('should create SSE adapter', async () => {
      const config: ServerConfig = {
        sse: {
          url: 'https://example.com/sse',
          headers: { 'Authorization': 'Bearer token' }
        }
      };

      const instance = await factory.createAdapter('server-2', config);

      expect(instance.serverId).toBe('server-2');
      expect(instance.protocol).toBe(ServerProtocol.SSE);
      expect(MockSseAdapter).toHaveBeenCalledWith(
        instance.id,
        'server-2',
        config.sse,
        { maxReconnects: 5 }
      );
      expect(MockSseAdapter.prototype.connect).toHaveBeenCalled();
    });

    it('should create HTTP adapter', async () => {
      const config: ServerConfig = {
        http: {
          baseUrl: 'https://example.com/api',
          headers: { 'Authorization': 'Bearer token' }
        }
      };

      const instance = await factory.createAdapter('server-3', config);

      expect(instance.serverId).toBe('server-3');
      expect(instance.protocol).toBe(ServerProtocol.HTTP);
      expect(MockHttpAdapter).toHaveBeenCalledWith(
        instance.id,
        'server-3',
        config.http,
        { maxConcurrentRequests: 10 }
      );
      expect(MockHttpAdapter.prototype.initialize).toHaveBeenCalled();
    });

    it('should throw error for missing STDIO config', async () => {
      const config: ServerConfig = {
        stdio: { command: '', args: [] } // Invalid empty command
      };

      await expect(factory.createAdapter('server-1', config))
        .rejects.toThrow('STDIO configuration is required for STDIO protocol');
    });

    it('should throw error for missing SSE config', async () => {
      const config: ServerConfig = {
        sse: { url: '' } // Invalid empty URL
      };

      await expect(factory.createAdapter('server-2', config))
        .rejects.toThrow('SSE configuration is required for SSE protocol');
    });

    it('should throw error for missing HTTP config', async () => {
      const config: ServerConfig = {
        http: { baseUrl: '' } // Invalid empty baseUrl
      };

      await expect(factory.createAdapter('server-3', config))
        .rejects.toThrow('HTTP configuration is required for HTTP protocol');
    });

    it('should throw error for no valid protocol config', async () => {
      const config: ServerConfig = {};

      await expect(factory.createAdapter('server-4', config))
        .rejects.toThrow('No valid protocol configuration found');
    });

    it('should prioritize STDIO over other protocols', async () => {
      const config: ServerConfig = {
        stdio: {
          command: 'node',
          args: ['server.js']
        },
        sse: {
          url: 'https://example.com/sse'
        }
      };

      const instance = await factory.createAdapter('server-1', config);
      expect(instance.protocol).toBe(ServerProtocol.STDIO);
    });
  });

  describe('Adapter Management', () => {
    let stdioInstance: any;
    let sseInstance: any;
    let httpInstance: any;

    beforeEach(async () => {
      stdioInstance = await factory.createAdapter('server-1', {
        stdio: { command: 'node', args: ['server.js'] }
      });
      sseInstance = await factory.createAdapter('server-2', {
        sse: { url: 'https://example.com/sse' }
      });
      httpInstance = await factory.createAdapter('server-3', {
        http: { baseUrl: 'https://example.com/api' }
      });
    });

    it('should get adapter by ID', () => {
      const retrieved = factory.getAdapter(stdioInstance.id);
      expect(retrieved).toBe(stdioInstance);
    });

    it('should return undefined for non-existent adapter', () => {
      const retrieved = factory.getAdapter('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should get adapters by server ID', () => {
      const serverAdapters = factory.getAdaptersByServer('server-1');
      expect(serverAdapters).toHaveLength(1);
      expect(serverAdapters[0]).toBe(stdioInstance);
    });

    it('should get all adapters', () => {
      const allAdapters = factory.getAllAdapters();
      expect(allAdapters).toHaveLength(3);
      expect(allAdapters).toContain(stdioInstance);
      expect(allAdapters).toContain(sseInstance);
      expect(allAdapters).toContain(httpInstance);
    });

    it('should remove adapter by ID', async () => {
      await factory.removeAdapter(stdioInstance.id);
      
      expect(factory.getAdapter(stdioInstance.id)).toBeUndefined();
      expect(MockStdioAdapter.prototype.stop).toHaveBeenCalled();
    });

    it('should remove adapters by server ID', async () => {
      await factory.removeAdaptersByServer('server-1');
      
      expect(factory.getAdaptersByServer('server-1')).toHaveLength(0);
      expect(MockStdioAdapter.prototype.stop).toHaveBeenCalled();
    });

    it('should cleanup all adapters', async () => {
      await factory.cleanup();
      
      expect(factory.getAllAdapters()).toHaveLength(0);
      expect(MockStdioAdapter.prototype.stop).toHaveBeenCalled();
      expect(MockSseAdapter.prototype.disconnect).toHaveBeenCalled();
      expect(MockHttpAdapter.prototype.cleanup).toHaveBeenCalled();
    });
  });

  describe('Request Handling', () => {
    let stdioInstance: any;
    let sseInstance: any;
    let httpInstance: any;

    beforeEach(async () => {
      stdioInstance = await factory.createAdapter('server-1', {
        stdio: { command: 'node', args: ['server.js'] }
      });
      sseInstance = await factory.createAdapter('server-2', {
        sse: { url: 'https://example.com/sse' }
      });
      httpInstance = await factory.createAdapter('server-3', {
        http: { baseUrl: 'https://example.com/api' }
      });
    });

    it('should send request through STDIO adapter', async () => {
      const request = { method: 'test', params: {} };
      const response = await factory.sendRequest(stdioInstance.id, request);
      
      expect(response.result).toBe('stdio');
      expect(MockStdioAdapter.prototype.sendRequest).toHaveBeenCalledWith(request);
    });

    it('should send request through SSE adapter', async () => {
      const request = { method: 'test', params: {} };
      const response = await factory.sendRequest(sseInstance.id, request);
      
      expect(response.result).toBe('sse');
      expect(MockSseAdapter.prototype.sendRequest).toHaveBeenCalledWith(request);
    });

    it('should send request through HTTP adapter', async () => {
      const request = { method: 'test', params: {} };
      const response = await factory.sendRequest(httpInstance.id, request);
      
      expect(response.result).toBe('http');
      expect(MockHttpAdapter.prototype.sendRequest).toHaveBeenCalledWith(request);
    });

    it('should throw error for non-existent adapter', async () => {
      const request = { method: 'test', params: {} };
      
      await expect(factory.sendRequest('non-existent', request))
        .rejects.toThrow('Adapter not found: non-existent');
    });
  });

  describe('Streaming Requests', () => {
    let stdioInstance: any;
    let sseInstance: any;
    let httpInstance: any;

    beforeEach(async () => {
      stdioInstance = await factory.createAdapter('server-1', {
        stdio: { command: 'node', args: ['server.js'] }
      });
      sseInstance = await factory.createAdapter('server-2', {
        sse: { url: 'https://example.com/sse' }
      });
      httpInstance = await factory.createAdapter('server-3', {
        http: { baseUrl: 'https://example.com/api' }
      });
    });

    it('should stream request through STDIO adapter', async () => {
      const request = { method: 'stream', params: {} };
      const results: any[] = [];
      
      for await (const chunk of factory.streamRequest(stdioInstance.id, request)) {
        results.push(chunk);
      }
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ data: 'stdio-stream', done: true });
    });

    it('should stream request through SSE adapter', async () => {
      const request = { method: 'stream', params: {} };
      const results: any[] = [];
      
      for await (const chunk of factory.streamRequest(sseInstance.id, request)) {
        results.push(chunk);
      }
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ data: 'sse-stream', done: true });
    });

    it('should stream request through HTTP adapter', async () => {
      const request = { method: 'stream', params: {} };
      const results: any[] = [];
      
      for await (const chunk of factory.streamRequest(httpInstance.id, request)) {
        results.push(chunk);
      }
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ data: 'http-stream', done: true });
    });

    it('should throw error for non-existent adapter in streaming', async () => {
      const request = { method: 'stream', params: {} };
      
      const streamPromise = factory.streamRequest('non-existent', request);
      const consumeStream = async () => {
        const results: any[] = [];
        for await (const chunk of streamPromise) {
          results.push(chunk);
        }
        return results;
      };

      await expect(consumeStream()).rejects.toThrow('Adapter not found: non-existent');
    });
  });

  describe('Health Monitoring', () => {
    let stdioInstance: any;

    beforeEach(async () => {
      stdioInstance = await factory.createAdapter('server-1', {
        stdio: { command: 'node', args: ['server.js'] }
      });
    });

    it('should get adapter health', () => {
      const health = factory.getAdapterHealth(stdioInstance.id);
      
      expect(health.adapterId).toBe('test');
      expect(health.status).toBe('healthy');
      expect(health.lastCheck).toBeInstanceOf(Date);
    });

    it('should return unknown health for non-existent adapter', () => {
      const health = factory.getAdapterHealth('non-existent');
      
      expect(health.adapterId).toBe('non-existent');
      expect(health.status).toBe('unknown');
      expect(health.error).toBe('Adapter not found');
    });
  });
});