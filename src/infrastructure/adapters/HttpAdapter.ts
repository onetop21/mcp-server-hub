import { EventEmitter } from 'events';
import fetch from 'node-fetch';
import { HttpConfig } from '../../domain/models/Server';
import { McpRequest, McpResponse, McpStreamResponse, AdapterHealth } from '../../domain/services/IProtocolAdapterService';

export interface HttpConnectionState {
  status: 'ready' | 'error' | 'busy';
  lastActivity?: Date;
  requestCount: number;
  errorCount: number;
  error?: string;
}

export interface HttpAdapterOptions {
  requestTimeout?: number;
  healthCheckInterval?: number;
  maxConcurrentRequests?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ConnectionPoolEntry {
  id: string;
  inUse: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  requestCount: number;
}

/**
 * HTTP Protocol Adapter for MCP servers
 * 
 * Manages HTTP connections to MCP servers with connection pooling and retry logic
 */
export class HttpAdapter extends EventEmitter {
  private connectionState: HttpConnectionState;
  private connectionPool: Map<string, ConnectionPoolEntry> = new Map();
  private activeRequests: Set<string> = new Set();
  private healthCheckTimer?: NodeJS.Timeout;
  private options: Required<HttpAdapterOptions>;

  constructor(
    public readonly id: string,
    public readonly serverId: string,
    private readonly config: HttpConfig,
    options: HttpAdapterOptions = {}
  ) {
    super();
    
    this.options = {
      requestTimeout: options.requestTimeout ?? 30000,
      healthCheckInterval: options.healthCheckInterval ?? 30000,
      maxConcurrentRequests: options.maxConcurrentRequests ?? 10,
      retryAttempts: options.retryAttempts ?? 3,
      retryDelay: options.retryDelay ?? 1000
    };

    this.connectionState = {
      status: 'ready',
      requestCount: 0,
      errorCount: 0
    };

    // Initialize connection pool
    this.initializeConnectionPool();

    // Start health check monitoring
    this.startHealthCheck();
  }

  /**
   * Initialize the adapter (HTTP adapters are typically stateless)
   */
  public async initialize(): Promise<void> {
    try {
      // Perform a health check to verify the server is reachable
      await this.performHealthCheck();
      this.connectionState.status = 'ready';
      this.connectionState.lastActivity = new Date();
      this.emit('initialized', this.id);
    } catch (error) {
      this.connectionState.status = 'error';
      this.connectionState.error = error instanceof Error ? error.message : String(error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Cleanup the adapter
   */
  public async cleanup(): Promise<void> {
    this.stopHealthCheck();
    
    // Wait for active requests to complete
    const maxWaitTime = 5000; // 5 seconds
    const startTime = Date.now();
    
    while (this.activeRequests.size > 0 && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Clear connection pool
    this.connectionPool.clear();
    this.activeRequests.clear();
    
    this.emit('cleanup', this.id);
  }

  /**
   * Send a request to the MCP server via HTTP
   */
  public async sendRequest(request: McpRequest): Promise<McpResponse> {
    if (this.connectionState.status === 'error') {
      throw new Error(`Adapter in error state: ${this.connectionState.error}`);
    }

    if (this.activeRequests.size >= this.options.maxConcurrentRequests) {
      throw new Error('Max concurrent requests reached');
    }

    const requestId = String(request.id ?? this.generateRequestId());
    this.activeRequests.add(requestId);

    try {
      const response = await this.executeRequestWithRetry({ ...request, id: requestId });
      this.connectionState.requestCount++;
      this.connectionState.lastActivity = new Date();
      return response;
    } catch (error) {
      this.connectionState.errorCount++;
      this.connectionState.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Send a streaming request to the MCP server
   */
  public async* streamRequest(request: McpRequest): AsyncIterable<McpStreamResponse> {
    if (this.connectionState.status === 'error') {
      throw new Error(`Adapter in error state: ${this.connectionState.error}`);
    }

    const requestId = String(request.id ?? this.generateRequestId());
    this.activeRequests.add(requestId);

    try {
      const url = new URL('/stream', this.config.baseUrl);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...this.config.headers
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.requestTimeout);

      try {
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...request, id: requestId }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body for streaming request');
        }

        let buffer = '';

        // Handle Node.js readable stream
        for await (const chunk of response.body as any) {
          buffer += chunk.toString();
          
          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine) {
              const data = this.parseStreamData(trimmedLine);
              if (data) {
                yield data;
                if (data.done) {
                  return;
                }
              }
            }
          }
        }

        // Process any remaining data in buffer
        if (buffer.trim()) {
          const data = this.parseStreamData(buffer.trim());
          if (data) {
            yield data;
          }
        }

        this.connectionState.requestCount++;
        this.connectionState.lastActivity = new Date();

      } catch (error) {
        clearTimeout(timeoutId);
        this.connectionState.errorCount++;
        this.connectionState.error = error instanceof Error ? error.message : String(error);
        throw error;
      }
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Get adapter health status
   */
  public getHealth(): AdapterHealth {
    const now = new Date();
    let status: 'healthy' | 'unhealthy' | 'unknown' = 'unknown';
    
    if (this.connectionState.status === 'ready') {
      const errorRate = this.connectionState.requestCount > 0 
        ? this.connectionState.errorCount / this.connectionState.requestCount 
        : 0;
      
      status = errorRate < 0.1 ? 'healthy' : 'unhealthy'; // Less than 10% error rate
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
  public getConnectionState(): HttpConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Get connection pool statistics
   */
  public getConnectionPoolStats(): {
    totalConnections: number;
    activeConnections: number;
    availableConnections: number;
  } {
    const totalConnections = this.connectionPool.size;
    const activeConnections = Array.from(this.connectionPool.values())
      .filter(entry => entry.inUse).length;
    
    return {
      totalConnections,
      activeConnections,
      availableConnections: totalConnections - activeConnections
    };
  }

  /**
   * Execute request with retry logic
   */
  private async executeRequestWithRetry(request: McpRequest): Promise<McpResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.options.retryAttempts; attempt++) {
      try {
        return await this.executeHttpRequest(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on the last attempt
        if (attempt === this.options.retryAttempts) {
          break;
        }
        
        // Don't retry on client errors (4xx)
        if (lastError.message.includes('4')) {
          break;
        }
        
        // Wait before retrying
        await new Promise(resolve => 
          setTimeout(resolve, this.options.retryDelay * Math.pow(2, attempt))
        );
      }
    }
    
    throw lastError;
  }

  /**
   * Execute a single HTTP request
   */
  private async executeHttpRequest(request: McpRequest): Promise<McpResponse> {
    const url = new URL('/request', this.config.baseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.requestTimeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      return responseData as McpResponse;

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Parse streaming data from SSE format
   */
  private parseStreamData(line: string): McpStreamResponse | null {
    try {
      // Handle SSE format: "data: {...}"
      if (line.startsWith('data: ')) {
        const jsonData = line.substring(6);
        const parsed = JSON.parse(jsonData);
        
        return {
          data: parsed.result || parsed,
          done: parsed.done || false
        };
      }
      
      // Handle plain JSON
      const parsed = JSON.parse(line);
      return {
        data: parsed.result || parsed,
        done: parsed.done || false
      };
    } catch (error) {
      this.emit('parseError', { line, error });
      return null;
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    const healthRequest: McpRequest = {
      method: 'ping',
      id: 'health_check'
    };

    try {
      await this.executeHttpRequest(healthRequest);
    } catch (error) {
      // If ping fails, try a basic request to see if server is responsive
      const basicRequest: McpRequest = {
        method: 'tools/list',
        id: 'health_check_tools'
      };
      
      await this.executeHttpRequest(basicRequest);
    }
  }

  /**
   * Initialize connection pool
   */
  private initializeConnectionPool(): void {
    // HTTP adapters typically don't need persistent connections
    // but we can track connection metadata for monitoring
    const poolEntry: ConnectionPoolEntry = {
      id: this.generateConnectionId(),
      inUse: false,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      requestCount: 0
    };
    
    this.connectionPool.set(poolEntry.id, poolEntry);
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `http_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
        this.connectionState.status = 'ready';
        this.connectionState.error = undefined;
        
        const health = this.getHealth();
        this.emit('healthCheck', health);
      } catch (error) {
        this.connectionState.status = 'error';
        this.connectionState.error = error instanceof Error ? error.message : String(error);
        
        const health = this.getHealth();
        this.emit('healthCheck', health);
        // Don't emit error for health check failures to avoid unhandled errors
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