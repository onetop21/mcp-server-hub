import { SseAdapter, SseAdapterOptions } from '../SseAdapter';
import { SseConfig } from '../../../domain/models/Server';
import { McpRequest } from '../../../domain/services/IProtocolAdapterService';

// Mock DOM types for Node.js environment
interface MockMessageEvent {
  data: string;
  type: string;
}

interface MockEvent {
  type: string;
}

// Mock EventSource
class MockEventSource {
  public onopen: ((event: MockEvent) => void) | null = null;
  public onerror: ((event: MockEvent) => void) | null = null;
  public onmessage: ((event: MockMessageEvent) => void) | null = null;
  private listeners: Map<string, ((event: MockMessageEvent) => void)[]> = new Map();
  
  constructor(public url: string) {}
  
  addEventListener(type: string, listener: (event: MockMessageEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }
  
  close() {
    // Mock close
  }
  
  // Test helpers
  simulateOpen() {
    if (this.onopen) {
      this.onopen({ type: 'open' });
    }
  }
  
  simulateMessage(data: string) {
    if (this.onmessage) {
      this.onmessage({ data, type: 'message' });
    }
  }
  
  simulateStreamMessage(data: string) {
    const listeners = this.listeners.get('stream') || [];
    listeners.forEach(listener => {
      listener({ data, type: 'stream' });
    });
  }
  
  simulateError() {
    if (this.onerror) {
      this.onerror({ type: 'error' });
    }
  }
}

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock EventSource globally
(global as any).EventSource = MockEventSource;

describe('SseAdapter', () => {
  let adapter: SseAdapter;
  let mockEventSource: MockEventSource;
  let config: SseConfig;
  let options: SseAdapterOptions;

  beforeEach(() => {
    config = {
      url: 'https://example.com/sse',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    };

    options = {
      maxReconnects: 3,
      reconnectDelay: 100,
      healthCheckInterval: 1000,
      requestTimeout: 5000,
      connectionTimeout: 2000
    };

    adapter = new SseAdapter('test-adapter', 'test-server', config, options);
    
    // Get reference to the mock EventSource instance
    mockEventSource = new MockEventSource(config.url);
    
    // Reset fetch mock
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK'
    });

    // Clear all timers
    jest.clearAllTimers();
  });

  afterEach(async () => {
    await adapter.disconnect();
    jest.clearAllTimers();
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      const connectPromise = adapter.connect();
      
      // Simulate successful connection
      setTimeout(() => mockEventSource.simulateOpen(), 10);
      
      await expect(connectPromise).resolves.toBeUndefined();
      
      const state = adapter.getConnectionState();
      expect(state.status).toBe('connected');
      expect(state.connectedAt).toBeInstanceOf(Date);
    });

    it('should handle connection timeout', async () => {
      const connectPromise = adapter.connect();
      
      // Don't simulate open event to trigger timeout
      
      await expect(connectPromise).rejects.toThrow('Connection timeout');
      
      const state = adapter.getConnectionState();
      expect(state.status).toBe('error');
    });

    it('should disconnect properly', async () => {
      // First connect
      const connectPromise = adapter.connect();
      setTimeout(() => mockEventSource.simulateOpen(), 10);
      await connectPromise;

      // Then disconnect
      await adapter.disconnect();
      
      const state = adapter.getConnectionState();
      expect(state.status).toBe('disconnected');
    });

    it('should not connect if already connected', async () => {
      // First connection
      const connectPromise1 = adapter.connect();
      setTimeout(() => mockEventSource.simulateOpen(), 10);
      await connectPromise1;

      // Second connection attempt should return immediately
      const connectPromise2 = adapter.connect();
      await expect(connectPromise2).resolves.toBeUndefined();
      
      const state = adapter.getConnectionState();
      expect(state.status).toBe('connected');
    });
  });

  describe('Request Handling', () => {
    beforeEach(async () => {
      const connectPromise = adapter.connect();
      setTimeout(() => mockEventSource.simulateOpen(), 10);
      await connectPromise;
    });

    it('should send request successfully', async () => {
      const request: McpRequest = {
        method: 'tools/list',
        params: {}
      };

      const responsePromise = adapter.sendRequest(request);
      
      // Simulate response
      setTimeout(() => {
        mockEventSource.simulateMessage(JSON.stringify({
          id: expect.any(String),
          result: { tools: [] }
        }));
      }, 10);

      const response = await responsePromise;
      expect(response.result).toEqual({ tools: [] });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/request',
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

    it('should handle request timeout', async () => {
      const request: McpRequest = {
        method: 'tools/list',
        params: {}
      };

      const responsePromise = adapter.sendRequest(request);
      
      // Don't simulate response to trigger timeout
      
      await expect(responsePromise).rejects.toThrow('Request timeout');
    });

    it('should handle request with custom ID', async () => {
      const request: McpRequest = {
        method: 'tools/list',
        params: {},
        id: 'custom-id'
      };

      const responsePromise = adapter.sendRequest(request);
      
      // Simulate response with matching ID
      setTimeout(() => {
        mockEventSource.simulateMessage(JSON.stringify({
          id: 'custom-id',
          result: { tools: [] }
        }));
      }, 10);

      const response = await responsePromise;
      expect(response.result).toEqual({ tools: [] });
    });

    it('should reject request when not connected', async () => {
      await adapter.disconnect();
      
      const request: McpRequest = {
        method: 'tools/list',
        params: {}
      };

      await expect(adapter.sendRequest(request)).rejects.toThrow('Adapter not connected');
    });
  });

  describe('Streaming Requests', () => {
    beforeEach(async () => {
      const connectPromise = adapter.connect();
      setTimeout(() => mockEventSource.simulateOpen(), 10);
      await connectPromise;
    });

    it('should handle streaming request successfully', async () => {
      const request: McpRequest = {
        method: 'tools/stream',
        params: { query: 'test' }
      };

      const streamPromise = adapter.streamRequest(request);
      const results: any[] = [];

      // Start consuming the stream
      const consumeStream = async () => {
        for await (const chunk of streamPromise) {
          results.push(chunk);
          if (chunk.done) break;
        }
      };

      const consumePromise = consumeStream();

      // Simulate streaming responses
      setTimeout(() => {
        mockEventSource.simulateStreamMessage(JSON.stringify({
          id: expect.any(String),
          result: { data: 'chunk1' },
          done: false
        }));
      }, 10);

      setTimeout(() => {
        mockEventSource.simulateStreamMessage(JSON.stringify({
          id: expect.any(String),
          result: { data: 'chunk2' },
          done: true
        }));
      }, 20);

      await consumePromise;

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ data: { data: 'chunk1' }, done: false });
      expect(results[1]).toEqual({ data: { data: 'chunk2' }, done: true });
    });

    it('should handle streaming error', async () => {
      const request: McpRequest = {
        method: 'tools/stream',
        params: { query: 'test' }
      };

      const streamPromise = adapter.streamRequest(request);

      // Start consuming the stream
      const consumeStream = async () => {
        const results: any[] = [];
        for await (const chunk of streamPromise) {
          results.push(chunk);
        }
        return results;
      };

      const consumePromise = consumeStream();

      // Simulate error response
      setTimeout(() => {
        mockEventSource.simulateStreamMessage(JSON.stringify({
          id: expect.any(String),
          error: { message: 'Stream error' }
        }));
      }, 10);

      await expect(consumePromise).rejects.toThrow('Stream error');
    });
  });

  describe('Health Monitoring', () => {
    it('should report healthy status when connected and active', async () => {
      const connectPromise = adapter.connect();
      setTimeout(() => mockEventSource.simulateOpen(), 10);
      await connectPromise;

      const health = adapter.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.adapterId).toBe('test-adapter');
      expect(health.lastCheck).toBeInstanceOf(Date);
    });

    it('should report unhealthy status when disconnected', () => {
      const health = adapter.getHealth();
      expect(health.status).toBe('unhealthy');
    });

    it('should report unhealthy status when inactive for too long', async () => {
      const connectPromise = adapter.connect();
      setTimeout(() => mockEventSource.simulateOpen(), 10);
      await connectPromise;

      // Simulate old last activity
      const state = adapter.getConnectionState();
      (adapter as any).connectionState.lastActivity = new Date(Date.now() - 70000); // 70 seconds ago

      const health = adapter.getHealth();
      expect(health.status).toBe('unhealthy');
    });
  });

  describe('Reconnection Logic', () => {
    it('should reconnect automatically on error', async () => {
      const connectPromise = adapter.connect();
      setTimeout(() => mockEventSource.simulateOpen(), 10);
      await connectPromise;

      const reconnectSpy = jest.spyOn(adapter, 'reconnect');

      // Simulate connection error
      mockEventSource.simulateError();

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(reconnectSpy).toHaveBeenCalled();
    });

    it('should not exceed max reconnect attempts', async () => {
      const connectPromise = adapter.connect();
      setTimeout(() => mockEventSource.simulateOpen(), 10);
      await connectPromise;

      // Simulate multiple errors to exceed max reconnects
      for (let i = 0; i < 5; i++) {
        try {
          await adapter.reconnect();
        } catch (error) {
          // Expected to fail after max attempts
        }
      }

      await expect(adapter.reconnect()).rejects.toThrow('Max reconnect attempts reached');
    });
  });

  describe('Message Parsing', () => {
    beforeEach(async () => {
      const connectPromise = adapter.connect();
      setTimeout(() => mockEventSource.simulateOpen(), 10);
      await connectPromise;
    });

    it('should handle malformed JSON messages', (done) => {
      adapter.on('parseError', (error) => {
        expect(error.data).toBe('invalid json');
        expect(error.error).toBeInstanceOf(Error);
        done();
      });

      mockEventSource.simulateMessage('invalid json');
    });

    it('should emit notifications for non-request messages', (done) => {
      adapter.on('message', (message) => {
        expect(message.method).toBe('notification');
        expect(message.params).toEqual({ event: 'test' });
        done();
      });

      mockEventSource.simulateMessage(JSON.stringify({
        method: 'notification',
        params: { event: 'test' }
      }));
    });
  });
});