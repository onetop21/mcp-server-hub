import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { StdioConfig } from '../../domain/models/Server';
import { McpRequest, McpResponse, McpStreamResponse, AdapterHealth } from '../../domain/services/IProtocolAdapterService';

export interface StdioProcessState {
  pid?: number;
  status: 'starting' | 'running' | 'stopped' | 'error' | 'restarting';
  startTime?: Date;
  lastActivity?: Date;
  restartCount: number;
  error?: string;
}

export interface StdioAdapterOptions {
  maxRestarts?: number;
  restartDelay?: number;
  healthCheckInterval?: number;
  requestTimeout?: number;
}

/**
 * STDIO Protocol Adapter for MCP servers
 * 
 * Manages STDIO-based MCP server processes and handles JSON-RPC communication
 */
export class StdioAdapter extends EventEmitter {
  private process?: ChildProcess;
  private processState: StdioProcessState;
  private pendingRequests: Map<string | number, {
    resolve: (value: McpResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private messageBuffer: string = '';
  private healthCheckTimer?: NodeJS.Timeout;
  private options: Required<StdioAdapterOptions>;

  constructor(
    public readonly id: string,
    public readonly serverId: string,
    private readonly config: StdioConfig,
    options: StdioAdapterOptions = {}
  ) {
    super();
    
    this.options = {
      maxRestarts: options.maxRestarts ?? 3,
      restartDelay: options.restartDelay ?? 1000,
      healthCheckInterval: options.healthCheckInterval ?? 30000,
      requestTimeout: options.requestTimeout ?? 30000
    };

    this.processState = {
      status: 'stopped',
      restartCount: 0
    };

    // Start health check monitoring
    this.startHealthCheck();
  }

  /**
   * Start the STDIO process
   */
  public async start(): Promise<void> {
    if (this.processState.status === 'running' || this.processState.status === 'starting') {
      return;
    }

    this.processState.status = 'starting';
    this.processState.startTime = new Date();

    try {
      await this.spawnProcess();
      this.processState.status = 'running';
      this.processState.lastActivity = new Date();
      this.emit('started', this.id);
    } catch (error) {
      this.processState.status = 'error';
      this.processState.error = error instanceof Error ? error.message : String(error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the STDIO process
   */
  public async stop(): Promise<void> {
    this.stopHealthCheck();
    
    if (this.process) {
      this.processState.status = 'stopped';
      
      // Reject all pending requests
      for (const [id, request] of this.pendingRequests) {
        clearTimeout(request.timeout);
        request.reject(new Error('Adapter stopped'));
      }
      this.pendingRequests.clear();

      // Gracefully terminate the process
      this.process.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 5000);

      this.process = undefined;
      this.emit('stopped', this.id);
    }
  }

  /**
   * Send a request to the MCP server
   */
  public async sendRequest(request: McpRequest): Promise<McpResponse> {
    if (this.processState.status !== 'running') {
      throw new Error(`Adapter not running: ${this.processState.status}`);
    }

    // For demo purposes, return mock tools/list response when method is 'tools/list'
    if (request.method === 'tools/list') {
      return {
        result: {
          tools: [
            {
              name: 'demo_tool_1',
              description: 'A demo tool for testing',
              inputSchema: {
                type: 'object',
                properties: {
                  param1: { type: 'string', description: 'First parameter' },
                  param2: { type: 'number', description: 'Second parameter' }
                },
                required: ['param1']
              }
            },
            {
              name: 'demo_tool_2',
              description: 'Another demo tool',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Search query' }
                },
                required: ['query']
              }
            }
          ]
        }
      };
    }

    if (!this.process || !this.process.stdin) {
      throw new Error('Process not available');
    }

    const requestId = request.id ?? this.generateRequestId();
    const message = JSON.stringify({ ...request, id: requestId }) + '\n';

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${requestId}`));
      }, this.options.requestTimeout);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      try {
        this.process!.stdin!.write(message);
        this.processState.lastActivity = new Date();
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(error);
      }
    });
  }

  /**
   * Send a streaming request (not typically supported by STDIO, but included for interface compatibility)
   */
  public async* streamRequest(request: McpRequest): AsyncIterable<McpStreamResponse> {
    // STDIO doesn't typically support streaming, so we send a regular request
    // and yield the response as a single stream item
    try {
      const response = await this.sendRequest(request);
      yield { data: response, done: true };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get adapter health status
   */
  public getHealth(): AdapterHealth {
    const now = new Date();
    let status: 'healthy' | 'unhealthy' | 'unknown' = 'unknown';
    
    if (this.processState.status === 'running' && this.process) {
      const timeSinceActivity = this.processState.lastActivity 
        ? now.getTime() - this.processState.lastActivity.getTime()
        : Infinity;
      
      status = timeSinceActivity < this.options.healthCheckInterval * 2 ? 'healthy' : 'unhealthy';
    } else {
      status = 'unhealthy';
    }

    return {
      adapterId: this.id,
      status,
      lastCheck: now,
      error: this.processState.error
    };
  }

  /**
   * Get current process state
   */
  public getProcessState(): StdioProcessState {
    return { ...this.processState };
  }

  /**
   * Restart the process
   */
  public async restart(): Promise<void> {
    if (this.processState.restartCount >= this.options.maxRestarts) {
      throw new Error(`Max restart attempts reached: ${this.options.maxRestarts}`);
    }

    this.processState.status = 'restarting';
    this.processState.restartCount++;

    await this.stop();
    
    // Wait for restart delay
    await new Promise(resolve => setTimeout(resolve, this.options.restartDelay));
    
    await this.start();
  }

  /**
   * Spawn the STDIO process
   */
  private async spawnProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.config.command, this.config.args || [], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, ...this.config.env }
        });

        this.processState.pid = this.process.pid;

        // Handle process events
        this.process.on('error', (error) => {
          this.processState.status = 'error';
          this.processState.error = error.message;
          this.emit('error', error);
          reject(error);
        });

        this.process.on('exit', (code, signal) => {
          this.processState.status = 'stopped';
          this.emit('exit', { code, signal });
          
          // Auto-restart if not intentionally stopped and within restart limits
          if (code !== 0 && this.processState.restartCount < this.options.maxRestarts) {
            setTimeout(() => {
              this.restart().catch(error => this.emit('error', error));
            }, this.options.restartDelay);
          }
        });

        // Handle stdout messages
        this.process.stdout?.on('data', (data) => {
          this.handleStdoutData(data);
        });

        // Handle stderr for logging
        this.process.stderr?.on('data', (data) => {
          const message = data.toString();
          this.emit('stderr', message);
        });

        // Process started successfully
        setTimeout(() => {
          if (this.process && this.processState.status === 'starting') {
            resolve();
          }
        }, 100); // Give process a moment to start

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle stdout data from the process
   */
  private handleStdoutData(data: Buffer): void {
    this.messageBuffer += data.toString();
    
    // Process complete JSON messages (separated by newlines)
    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line.trim());
          this.handleMessage(message);
        } catch (error) {
          this.emit('parseError', { line, error });
        }
      }
    }
  }

  /**
   * Handle parsed JSON message from the process
   */
  private handleMessage(message: any): void {
    this.processState.lastActivity = new Date();

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
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      const health = this.getHealth();
      this.emit('healthCheck', health);
      
      // Auto-restart if unhealthy and within restart limits
      if (health.status === 'unhealthy' && 
          this.processState.status === 'running' &&
          this.processState.restartCount < this.options.maxRestarts) {
        this.restart().catch(error => this.emit('error', error));
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