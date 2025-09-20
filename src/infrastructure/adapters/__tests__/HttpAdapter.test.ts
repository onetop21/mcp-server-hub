import { HttpAdapter, HttpAdapterOptions } from '../HttpAdapter';
import { HttpConfig } from '../../../domain/models/Server';
import { McpRequest } from '../../../domain/services/IProtocolAdapterService';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('HttpAdapter', () => {
  let adapter: HttpAdapter;
  let config: HttpConfig;
  let options: HttpAdapterOptions;

  beforeEach(() => {
    config = {
      baseUrl: 'https://example.com/api',
      headers: {
        'Authorization': 'Bearer test-token',
        'X-Custom-Header': 'test-value'
      }
    };

    options = {
      requestTimeout: 5000,
      healthCheckInterval: 1000,
      maxConcurrentRequests: 5,
      retryAttempts: 2,
      retryDelay: 100
    };

    adapter = new HttpAdapter('test-adapter', 'test-server', config, options);

    // Reset fetch mock
    mockFetch.mockReset();
    
    // Clear all timers
    jest.clearAllTimers();
  });

  afterEach(async () => {
    await adapter.cleanup();
    jest.clearAllTimers();
  });

  describe('Initialization', () => {
    it('should initialize successfully with health check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ result: 'pong' })
      });

      await expect(adapter.initialize()).resolves.toBeUndefined();
      
      const state = adapter.getConnectionState();
      expect(state.status).toBe('ready');
      expect(state.lastActivity).toBeInstanceOf(Date);
    });

    it('should handle initialization failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(adapter.initialize()).rejects.toThrow('Network error');
      
      const state = adapter.getConnectionState();
      expect(state.status).toBe('error');
      expect(state.error).toBe('Network error');
    });

    it('should fallback to tools/list if ping fails', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Ping failed'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ result: { tools: [] } })
        });

      await expect(adapter.initialize()).resolves.toBeUndefined();
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(1, 
        'https://example.com/api/request',
        expect.objectContaining({
          body: expect.stringContaining('"method":"ping"')
        })
      );
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'https://example.com/api/request',
        expect.objectContaining({
          body: expect.stringContaining('"method":"tools/list"')
        })
      );
    });
  });

  describe('Request Handling', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: 'pong' })
      });
      await adapter.initialize();
      mockFetch.mockReset();
    });

    it('should send request successfully', async () => {
      const request: McpRequest = {
        method: 'tools/list',
        params: {}
      };

      const mockResponse = {
        result: { tools: [{ name: 'test-tool' }] }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      });

      const response = await adapter.sendRequest(request);
      
      expect(response).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/api/request',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
            'X-Custom-Header': 'test-value'
          }),
          body: expect.stringContaining('"method":"tools/list"')
        })
      );

      const state = adapter.getConnectionState();
      expect(state.requestCount).toBe(1);
      expect(state.lastActivity).toBeInstanceOf(Date);
    });

    it('should handle HTTP error responses', async () => {
      const request: McpRequest = {
        method: 'tools/list',
        params: {}
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(adapter.sendRequest(request)).rejects.toThrow(
        'HTTP request failed: 500 Internal Server Error'
      );

      const state = adapter.getConnectionState();
      expect(state.errorCount).toBe(1);
    });

    it('should handle network errors', async () => {
      const request: McpRequest = {
        method: 'tools/list',
        params: {}
      };

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(adapter.sendRequest(request)).rejects.toThrow('Network error');

      const state = adapter.getConnectionState();
      expect(state.errorCount).toBe(1);
    });

    it('should handle request timeout', async () => {
      const request: McpRequest = {
        method: 'tools/list',
        params: {}
      };

      // Mock a request that never resolves to trigger timeout
      mockFetch.mockImplementationOnce(() => new Promise(() => {}));

      await expect(adapter.sendRequest(request)).rejects.toThrow();
    });

    it('should respect max concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        method: 'test',
        params: { index: i }
      }));

      // Mock slow responses
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          status: 200,
          json: async () => ({ result: 'ok' })
        }), 100))
      );

      const promises = requests.map(req => adapter.sendRequest(req));
      
      // Some requests should be rejected due to concurrency limit
      const results = await Promise.allSettled(promises);
      const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
      
      expect(rejected.length).toBeGreaterThan(0);
      expect(rejected[0].reason.message).toContain('Max concurrent requests reached');
    });

    it('should generate unique request IDs', async () => {
      const request: McpRequest = {
        method: 'tools/list',
        params: {}
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ result: 'ok' })
      });

      const promise1 = adapter.sendRequest(request);
      const promise2 = adapter.sendRequest(request);

      await Promise.all([promise1, promise2]);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      const call1Body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const call2Body = JSON.parse(mockFetch.mock.calls[1][1].body);
      
      expect(call1Body.id).toBeDefined();
      expect(call2Body.id).toBeDefined();
      expect(call1Body.id).not.toBe(call2Body.id);
    });
  });

  describe('Retry Logic', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: 'pong' })
      });
      await adapter.initialize();
      mockFetch.mockReset();
    });

    it('should retry on server errors', async () => {
      const request: McpRequest = {
        method: 'tools/list',
        params: {}
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway'
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ result: { tools: [] } })
        });

      const response = await adapter.sendRequest(request);
      
      expect(response.result).toEqual({ tools: [] });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on client errors', async () => {
      const request: McpRequest = {
        method: 'tools/list',
        params: {}
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(adapter.sendRequest(request)).rejects.toThrow(
        'HTTP request failed: 404 Not Found'
      );
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should respect max retry attempts', async () => {
      const request: McpRequest = {
        method: 'tools/list',
        params: {}
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(adapter.sendRequest(request)).rejects.toThrow(
        'HTTP request failed: 500 Internal Server Error'
      );
      
      // Should try initial + 2 retries = 3 total
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Streaming Requests', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: 'pong' })
      });
      await adapter.initialize();
      mockFetch.mockReset();
    });

    it('should handle streaming request successfully', async () => {
      const request: McpRequest = {
        method: 'tools/stream',
        params: { query: 'test' }
      };

      // Mock streaming response using Node.js Readable
      const { Readable } = require('stream');
      const mockBody = new Readable({
        read() {
          this.push('data: {"result": "chunk1", "done": false}\n');
          this.push('data: {"result": "chunk2", "done": true}\n');
          this.push(null); // End stream
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: mockBody
      });

      const results: any[] = [];
      for await (const chunk of adapter.streamRequest(request)) {
        results.push(chunk);
        if (chunk.done) break;
      }

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ data: 'chunk1', done: false });
      expect(results[1]).toEqual({ data: 'chunk2', done: true });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/api/stream',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
          })
        })
      );
    });

    it('should handle streaming error response', async () => {
      const request: McpRequest = {
        method: 'tools/stream',
        params: { query: 'test' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const streamPromise = adapter.streamRequest(request);
      const consumeStream = async () => {
        const results: any[] = [];
        for await (const chunk of streamPromise) {
          results.push(chunk);
        }
        return results;
      };

      await expect(consumeStream()).rejects.toThrow(
        'HTTP request failed: 500 Internal Server Error'
      );
    });

    it('should handle streaming with no response body', async () => {
      const request: McpRequest = {
        method: 'tools/stream',
        params: { query: 'test' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: null
      });

      const streamPromise = adapter.streamRequest(request);
      const consumeStream = async () => {
        const results: any[] = [];
        for await (const chunk of streamPromise) {
          results.push(chunk);
        }
        return results;
      };

      await expect(consumeStream()).rejects.toThrow(
        'No response body for streaming request'
      );
    });

    it('should parse plain JSON streaming data', async () => {
      const request: McpRequest = {
        method: 'tools/stream',
        params: { query: 'test' }
      };

      const { Readable } = require('stream');
      const mockBody = new Readable({
        read() {
          this.push('{"result": "chunk1", "done": false}\n');
          this.push('{"result": "chunk2", "done": true}\n');
          this.push(null); // End stream
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: mockBody
      });

      const results: any[] = [];
      for await (const chunk of adapter.streamRequest(request)) {
        results.push(chunk);
        if (chunk.done) break;
      }

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ data: 'chunk1', done: false });
      expect(results[1]).toEqual({ data: 'chunk2', done: true });
    });
  });

  describe('Health Monitoring', () => {
    it('should report healthy status when ready with low error rate', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ result: 'pong' })
      });
      
      await adapter.initialize();

      // Simulate some successful requests
      await adapter.sendRequest({ method: 'test1' });
      await adapter.sendRequest({ method: 'test2' });

      const health = adapter.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.adapterId).toBe('test-adapter');
      expect(health.lastCheck).toBeInstanceOf(Date);
    });

    it('should report unhealthy status with high error rate', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: 'pong' })
      });
      
      await adapter.initialize();
      mockFetch.mockReset();

      // Simulate high error rate
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      try {
        await adapter.sendRequest({ method: 'test1' });
      } catch {}
      try {
        await adapter.sendRequest({ method: 'test2' });
      } catch {}

      const health = adapter.getHealth();
      expect(health.status).toBe('unhealthy');
    });

    it('should report unhealthy status when in error state', () => {
      const health = adapter.getHealth();
      expect(health.status).toBe('unhealthy');
    });
  });

  describe('Connection Pool', () => {
    it('should initialize connection pool', () => {
      const stats = adapter.getConnectionPoolStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.activeConnections).toBe(0);
      expect(stats.availableConnections).toBe(1);
    });

    it('should track connection pool statistics', () => {
      const stats = adapter.getConnectionPoolStats();
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('availableConnections');
      expect(typeof stats.totalConnections).toBe('number');
      expect(typeof stats.activeConnections).toBe('number');
      expect(typeof stats.availableConnections).toBe('number');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup properly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ result: 'pong' })
      });
      
      await adapter.initialize();
      await adapter.cleanup();

      const stats = adapter.getConnectionPoolStats();
      expect(stats.totalConnections).toBe(0);
    });

    it('should wait for active requests during cleanup', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: 'pong' })
      });
      
      await adapter.initialize();
      mockFetch.mockReset();

      // Start a slow request
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          status: 200,
          json: async () => ({ result: 'ok' })
        }), 200))
      );

      const requestPromise = adapter.sendRequest({ method: 'slow' });
      
      // Start cleanup while request is active
      const cleanupPromise = adapter.cleanup();
      
      // Both should complete
      await Promise.all([requestPromise, cleanupPromise]);
      
      const stats = adapter.getConnectionPoolStats();
      expect(stats.totalConnections).toBe(0);
    });
  });
});