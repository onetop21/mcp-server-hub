import { HttpAdapter, HttpAdapterOptions } from '../HttpAdapter';
import { HttpConfig } from '../../../domain/models/Server';
import { McpRequest } from '../../../domain/services/IProtocolAdapterService';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('HttpAdapter - Simple Tests', () => {
  let adapter: HttpAdapter;
  let config: HttpConfig;
  let options: HttpAdapterOptions;

  beforeEach(() => {
    config = {
      baseUrl: 'https://example.com/api',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    };

    options = {
      requestTimeout: 1000,
      healthCheckInterval: 60000, // Long interval to avoid interference
      maxConcurrentRequests: 5,
      retryAttempts: 1,
      retryDelay: 100
    };

    adapter = new HttpAdapter('test-adapter', 'test-server', config, options);
    
    // Clear and reset all mocks
    mockFetch.mockReset();
    mockFetch.mockClear();
    
    // Set default successful response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ result: 'default' })
    });
  });

  afterEach(async () => {
    await adapter.cleanup();
  });

  describe('Basic Functionality', () => {
    it('should create adapter instance', () => {
      expect(adapter.id).toBe('test-adapter');
      expect(adapter.serverId).toBe('test-server');
    });

    it('should get connection state', () => {
      const state = adapter.getConnectionState();
      expect(state).toHaveProperty('status');
      expect(state).toHaveProperty('requestCount');
      expect(state).toHaveProperty('errorCount');
    });

    it('should get connection pool stats', () => {
      const stats = adapter.getConnectionPoolStats();
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('availableConnections');
      expect(stats.totalConnections).toBe(1);
    });

    it('should get health status', () => {
      const health = adapter.getHealth();
      expect(health).toHaveProperty('adapterId');
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('lastCheck');
      expect(health.adapterId).toBe('test-adapter');
    });
  });

  describe('Request Handling Without Health Check', () => {
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
            'Authorization': 'Bearer test-token'
          }),
          body: expect.stringContaining('"method":"tools/list"')
        })
      );
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
    });

    it('should handle network errors', async () => {
      const request: McpRequest = {
        method: 'tools/list',
        params: {}
      };

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(adapter.sendRequest(request)).rejects.toThrow('Network error');
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
          ok: true,
          status: 200,
          json: async () => ({ result: { tools: [] } })
        });

      const response = await adapter.sendRequest(request);
      
      expect(response.result).toEqual({ tools: [] });
      expect(mockFetch).toHaveBeenCalledTimes(2);
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
  });

  describe('Streaming Requests', () => {
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
  });
});