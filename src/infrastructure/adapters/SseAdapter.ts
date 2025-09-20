import { EventEmitter } from 'events';
import fetch from 'node-fetch';
import { SseConfig } from '../../domain/models/Server';
import { McpRequest, McpResponse, McpStreamResponse, AdapterHealth } from '../../domain/services/IProtocolAdapterService';

// Define EventSource interface for Node.js compatibility
interface EventSource {
  onopen: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onmessage: ((event: any) => void) | null;
  addEventListener(type: string, listener: (event: any) => void): void;
  close(): void;
}

// EventSource constructor type
interface EventSourceConstructor {
  new (url: string): EventSource;
}

// Declare global EventSource for browser compatibility
declare const EventSource: EventSourceConstructor;

export interface SseConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';
  connectedAt?: Date;
  lastActivity?: Date;
  reconnectCount: number;
  error?: string;
}

export interface SseAdapterOptions {
  maxReconnects?: number;
  reconnectDelay?: number;
  healthCheckInterval?: number;
  requestTimeout?: number;
  connectionTimeout?: number;
}

/**
 * SSE (Server-Sent Events) Protocol Adapter for MCP servers
 * 
 * Manages SSE connections to MCP servers and handles streaming communication
 */
export class SseAdapter extends EventEmitter {
  private eventSource?: EventSource;
  private connectionState: SseConnectionState;
  private pendingRequests: Map<string | number, {
    resolve: (value: McpResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private healthCheckTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private options: Required<SseAdapterOptions>;

  constructor(
    public readonly id: string,
    public readonly serverId: string,
    private readonly config: SseConfig,
    options: SseAdapterOptions = {}
  ) {
    super();
    
    this.options = {
      maxReconnects: options.maxReconnects ?? 5,
      reconnectDelay: options.reconnectDelay ?? 2000,
      healthCheckInterval: options.healthCheckInterval ?? 30000,
      requestTimeout: options.requestTimeout ?? 30000,
      connectionTimeout: options.connectionTimeout ?? 10000
    };

    this.connectionState = {
      status: 'disconnected',
      reconnectCount: 0
    };

    // Start health check monitoring
    this.startHealthCheck();
  }

  /**
   * Connect to the SSE endpoint
   */
  public async connect(): Promise<void> {
    if (this.connectionState.status === 'connected' || this.connectionState.status === 'connecting') {
      return;
    }

    this.connectionState.status = 'connecting';

    try {
      await this.createConnection();
      this.connectionState.status = 'connected';
      this.connectionState.connectedAt = new Date();
      this.connectionState.lastActivity = new Date();
      this.emit('connected', this.id);
    } catch (error) {
      this.connectionState.status = 'error';
      this.connectionState.error = error instanceof Error ? error.message : String(error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Disconnect from the SSE endpoint
   */
  public async disconnect(): Promise<void> {
    this.stopHealthCheck();
    this.stopReconnectTimer();
    
    if (this.eventSource) {
      this.connectionState.status = 'disconnected';
      
      // Reject all pending requests
      for (const [id, request] of this.pendingRequests) {
        clearTimeout(request.timeout);
        request.reject(new Error('Adapter disconnected'));
      }
      this.pendingRequests.clear();

      this.eventSource.close();
      this.eventSource = undefined;
      this.emit('disconnected', this.id);
    }
  }

  /**
   * Send a request to the MCP server via SSE
   */
  public async sendRequest(request: McpRequest): Promise<McpResponse> {
    if (this.connectionState.status !== 'connected') {
      throw new Error(`Adapter not connected: ${this.connectionState.status}`);
    }

    const requestId = request.id ?? this.generateRequestId();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${requestId}`));
      }, this.options.requestTimeout);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      try {
        // For SSE, we typically send requests via a separate HTTP endpoint
        // or through a WebSocket-like mechanism. Here we'll use fetch to send the request
        this.sendHttpRequest({ ...request, id: requestId })
          .then(() => {
            this.connectionState.lastActivity = new Date();
          })
          .catch((error) => {
            clearTimeout(timeout);
            this.pendingRequests.delete(requestId);
            reject(error);
          });
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(error);
      }
    });
  }

  /**
   * Send a streaming request to the MCP server
   */
  public async* streamRequest(request: McpRequest): AsyncIterable<McpStreamResponse> {
    if (this.connectionState.status !== 'connected') {
      throw new Error(`Adapter not connected: ${this.connectionState.status}`);
    }

    const requestId = request.id ?? this.generateRequestId();
    let streamEnded = false;
    const streamData: McpStreamResponse[] = [];
    let streamError: Error | null = null;

    // Set up a temporary listener for this stream
    const streamListener = (data: any) => {
      if (data.id === requestId) {
        if (data.error) {
          streamError = new Error(data.error.message || 'Stream error');
          streamEnded = true;
        } else if (data.done) {
          streamData.push({ data: data.result, done: true });
          streamEnded = true;
        } else {
          streamData.push({ data: data.result, done: false });
        }
      }
    };

    this.on('streamData', streamListener);

    try {
      // Send the streaming request
      await this.sendHttpRequest({ ...request, id: requestId });
      this.connectionState.lastActivity = new Date();

      // Yield stream data as it arrives
      while (!streamEnded) {
        if (streamError) {
          throw streamError;
        }
        
        while (streamData.length > 0) {
          const data = streamData.shift()!;
          yield data;
          if (data.done) {
            streamEnded = true;
            break;
          }
        }
        
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } finally {
      this.off('streamData', streamListener);
    }
  }

  /**
   * Get adapter health status
   */
  public getHealth(): AdapterHealth {
    const now = new Date();
    let status: 'healthy' | 'unhealthy' | 'unknown' = 'unknown';
    
    if (this.connectionState.status === 'connected' && this.eventSource) {
      const timeSinceActivity = this.connectionState.lastActivity 
        ? now.getTime() - this.connectionState.lastActivity.getTime()
        : Infinity;
      
      status = timeSinceActivity < this.options.healthCheckInterval * 2 ? 'healthy' : 'unhealthy';
    } else {
      status = 'unhealthy';
    }

    return {
      adapterId: this.id,
      status,
      lastCheck: now,
      error: this.connectionState.error
    };
  }

  /**
   * Get current connection state
   */
  public getConnectionState(): SseConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Reconnect to the SSE endpoint
   */
  public async reconnect(): Promise<void> {
    if (this.connectionState.reconnectCount >= this.options.maxReconnects) {
      throw new Error(`Max reconnect attempts reached: ${this.options.maxReconnects}`);
    }

    this.connectionState.status = 'reconnecting';
    this.connectionState.reconnectCount++;

    await this.disconnect();
    
    // Wait for reconnect delay
    await new Promise(resolve => setTimeout(resolve, this.options.reconnectDelay));
    
    await this.connect();
  }

  /**
   * Create the SSE connection
   */
  private async createConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create EventSource with headers if supported
        const url = new URL(this.config.url);
        
        // Note: EventSource doesn't support custom headers in browsers
        // For Node.js, we might need to use a different SSE client library
        this.eventSource = new EventSource(url.toString());

        // Set up connection timeout
        const connectionTimeout = setTimeout(() => {
          if (this.connectionState.status === 'connecting') {
            this.eventSource?.close();
            reject(new Error('Connection timeout'));
          }
        }, this.options.connectionTimeout);

        // Handle connection events
        this.eventSource.onopen = () => {
          clearTimeout(connectionTimeout);
          resolve();
        };

        this.eventSource.onerror = (error) => {
          clearTimeout(connectionTimeout);
          this.connectionState.status = 'error';
          this.connectionState.error = 'SSE connection error';
          this.emit('error', error);
          
          // Auto-reconnect if within limits
          if (this.connectionState.reconnectCount < this.options.maxReconnects) {
            this.scheduleReconnect();
          }
        };

        // Handle incoming messages
        this.eventSource.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        // Handle custom event types for streaming
        this.eventSource.addEventListener('stream', (event) => {
          this.handleStreamMessage(event.data);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send HTTP request for SSE communication
   */
  private async sendHttpRequest(request: McpRequest): Promise<void> {
    const url = new URL(this.config.url);
    // Typically, SSE servers have a companion HTTP endpoint for sending requests
    url.pathname = url.pathname.replace('/sse', '/request') || '/request';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers
    };

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Handle regular SSE message
   */
  private handleMessage(data: string): void {
    this.connectionState.lastActivity = new Date();

    try {
      const message = JSON.parse(data);
      
      // Handle response to a pending request
      if (message.id !== undefined && this.pendingRequests.has(message.id)) {
        const request = this.pendingRequests.get(message.id)!;
        clearTimeout(request.timeout);
        this.pendingRequests.delete(message.id);
        
        request.resolve(message as McpResponse);
        return;
      }

      // Handle notifications or other messages
      this.emit('message', message);
    } catch (error) {
      this.emit('parseError', { data, error });
    }
  }

  /**
   * Handle streaming SSE message
   */
  private handleStreamMessage(data: string): void {
    this.connectionState.lastActivity = new Date();

    try {
      const message = JSON.parse(data);
      this.emit('streamData', message);
    } catch (error) {
      this.emit('parseError', { data, error });
    }
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    this.stopReconnectTimer();
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnect().catch(error => this.emit('error', error));
    }, this.options.reconnectDelay);
  }

  /**
   * Stop the reconnect timer
   */
  private stopReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      const health = this.getHealth();
      this.emit('healthCheck', health);
      
      // Auto-reconnect if unhealthy and within reconnect limits
      if (health.status === 'unhealthy' && 
          this.connectionState.status === 'connected' &&
          this.connectionState.reconnectCount < this.options.maxReconnects) {
        this.reconnect().catch(error => this.emit('error', error));
      }
    }, this.options.healthCheckInterval);
  }

  /**
   * Stop health check monitoring
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }
}