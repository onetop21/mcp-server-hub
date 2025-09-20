import { EventEmitter } from 'events';
import { ServerConfig, ServerProtocol } from '../../domain/models/Server';
import { StdioAdapter, StdioAdapterOptions } from './StdioAdapter';
import { SseAdapter, SseAdapterOptions } from './SseAdapter';
import { HttpAdapter, HttpAdapterOptions } from './HttpAdapter';
import { AdapterHealth } from '../../domain/services/IProtocolAdapterService';

export interface AdapterInstance {
  id: string;
  serverId: string;
  protocol: ServerProtocol;
  adapter: StdioAdapter | SseAdapter | HttpAdapter;
  status: AdapterStatus;
  createdAt: Date;
  lastUsedAt?: Date;
  metadata: AdapterMetadata;
}

export interface AdapterMetadata {
  requestCount: number;
  errorCount: number;
  lastError?: string;
  uptime: number;
  restartCount: number;
}

export enum AdapterStatus {
  INITIALIZING = 'initializing',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting'
}

export interface ProtocolAdapterFactoryOptions {
  stdio?: StdioAdapterOptions;
  sse?: SseAdapterOptions;
  http?: HttpAdapterOptions;
  healthCheckInterval?: number;
  maxConcurrentAdapters?: number;
  enableAutoRestart?: boolean;
}

export interface AdapterLifecycleEvent {
  adapterId: string;
  serverId: string;
  protocol: ServerProtocol;
  status: AdapterStatus;
  timestamp: Date;
  error?: string;
}

/**
 * Enhanced Factory for creating and managing protocol adapters with lifecycle management
 */
export class ProtocolAdapterFactory extends EventEmitter {
  private adapters: Map<string, AdapterInstance> = new Map();
  private options: Required<ProtocolAdapterFactoryOptions>;
  private healthCheckTimer?: NodeJS.Timeout;
  private isShuttingDown: boolean = false;

  constructor(options: ProtocolAdapterFactoryOptions = {}) {
    super();
    
    this.options = {
      stdio: options.stdio || {},
      sse: options.sse || {},
      http: options.http || {},
      healthCheckInterval: options.healthCheckInterval || 30000,
      maxConcurrentAdapters: options.maxConcurrentAdapters || 100,
      enableAutoRestart: options.enableAutoRestart !== false
    };

    // Start health monitoring
    this.startHealthMonitoring();

    // Handle process shutdown gracefully (only in production)
    if (process.env.NODE_ENV !== 'test') {
      process.on('SIGTERM', () => this.gracefulShutdown());
      process.on('SIGINT', () => this.gracefulShutdown());
    }
  }

  /**
   * Create a protocol adapter for a server with enhanced lifecycle management
   */
  public async createAdapter(
    serverId: string,
    serverConfig: ServerConfig
  ): Promise<AdapterInstance> {
    if (this.isShuttingDown) {
      throw new Error('Factory is shutting down, cannot create new adapters');
    }

    if (this.adapters.size >= this.options.maxConcurrentAdapters) {
      throw new Error(`Maximum concurrent adapters limit reached: ${this.options.maxConcurrentAdapters}`);
    }

    const adapterId = this.generateAdapterId(serverId);
    const protocol = this.determineProtocol(serverConfig);
    
    // Create adapter instance with initial metadata
    const adapterInstance: AdapterInstance = {
      id: adapterId,
      serverId,
      protocol,
      adapter: null as any, // Will be set below
      status: AdapterStatus.INITIALIZING,
      createdAt: new Date(),
      metadata: {
        requestCount: 0,
        errorCount: 0,
        uptime: 0,
        restartCount: 0
      }
    };

    this.adapters.set(adapterId, adapterInstance);
    this.emitLifecycleEvent(adapterInstance, AdapterStatus.INITIALIZING);

    try {
      let adapter: StdioAdapter | SseAdapter | HttpAdapter;

      switch (protocol) {
        case ServerProtocol.STDIO:
          if (!serverConfig.stdio || !serverConfig.stdio.command || serverConfig.stdio.command.trim() === '') {
            throw new Error('STDIO configuration is required for STDIO protocol');
          }
          adapter = new StdioAdapter(
            adapterId,
            serverId,
            serverConfig.stdio,
            this.options.stdio
          );
          this.setupAdapterEventListeners(adapter, adapterInstance);
          await adapter.start();
          break;

        case ServerProtocol.SSE:
          if (!serverConfig.sse || !serverConfig.sse.url || serverConfig.sse.url.trim() === '') {
            throw new Error('SSE configuration is required for SSE protocol');
          }
          adapter = new SseAdapter(
            adapterId,
            serverId,
            serverConfig.sse,
            this.options.sse
          );
          this.setupAdapterEventListeners(adapter, adapterInstance);
          await adapter.connect();
          break;

        case ServerProtocol.HTTP:
          if (!serverConfig.http || !serverConfig.http.baseUrl || serverConfig.http.baseUrl.trim() === '') {
            throw new Error('HTTP configuration is required for HTTP protocol');
          }
          adapter = new HttpAdapter(
            adapterId,
            serverId,
            serverConfig.http,
            this.options.http
          );
          this.setupAdapterEventListeners(adapter, adapterInstance);
          await adapter.initialize();
          break;

        default:
          throw new Error(`Unsupported protocol: ${protocol}`);
      }

      adapterInstance.adapter = adapter;
      adapterInstance.status = AdapterStatus.CONNECTED;
      this.emitLifecycleEvent(adapterInstance, AdapterStatus.CONNECTED);

      return adapterInstance;
    } catch (error) {
      adapterInstance.status = AdapterStatus.ERROR;
      adapterInstance.metadata.lastError = error instanceof Error ? error.message : String(error);
      this.emitLifecycleEvent(adapterInstance, AdapterStatus.ERROR, error instanceof Error ? error.message : String(error));
      
      // Remove failed adapter from registry
      this.adapters.delete(adapterId);
      throw error;
    }
  }

  /**
   * Get an existing adapter by ID
   */
  public getAdapter(adapterId: string): AdapterInstance | undefined {
    return this.adapters.get(adapterId);
  }

  /**
   * Get all adapters for a server
   */
  public getAdaptersByServer(serverId: string): AdapterInstance[] {
    return Array.from(this.adapters.values())
      .filter(instance => instance.serverId === serverId);
  }

  /**
   * Get all active adapters
   */
  public getAllAdapters(): AdapterInstance[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Remove and cleanup an adapter
   */
  public async removeAdapter(adapterId: string): Promise<void> {
    const instance = this.adapters.get(adapterId);
    if (!instance) {
      return;
    }

    // Cleanup based on adapter type
    switch (instance.protocol) {
      case ServerProtocol.STDIO:
        await (instance.adapter as StdioAdapter).stop();
        break;
      case ServerProtocol.SSE:
        await (instance.adapter as SseAdapter).disconnect();
        break;
      case ServerProtocol.HTTP:
        await (instance.adapter as HttpAdapter).cleanup();
        break;
    }

    this.adapters.delete(adapterId);
  }

  /**
   * Remove all adapters for a server
   */
  public async removeAdaptersByServer(serverId: string): Promise<void> {
    const serverAdapters = this.getAdaptersByServer(serverId);
    
    await Promise.all(
      serverAdapters.map(instance => this.removeAdapter(instance.id))
    );
  }

  /**
   * Cleanup all adapters
   */
  public async cleanup(): Promise<void> {
    const adapterIds = Array.from(this.adapters.keys());
    
    await Promise.all(
      adapterIds.map(id => this.removeAdapter(id))
    );
  }

  /**
   * Get enhanced adapter health status with metadata
   */
  public getAdapterHealth(adapterId: string): AdapterHealth & { metadata?: AdapterMetadata } {
    const instance = this.adapters.get(adapterId);
    if (!instance) {
      return {
        adapterId,
        status: 'unknown',
        lastCheck: new Date(),
        error: 'Adapter not found'
      };
    }

    let baseHealth: AdapterHealth;
    
    try {
      switch (instance.protocol) {
        case ServerProtocol.STDIO:
          baseHealth = (instance.adapter as StdioAdapter).getHealth();
          break;
        case ServerProtocol.SSE:
          baseHealth = (instance.adapter as SseAdapter).getHealth();
          break;
        case ServerProtocol.HTTP:
          baseHealth = (instance.adapter as HttpAdapter).getHealth();
          break;
        default:
          baseHealth = {
            adapterId,
            status: 'unknown',
            lastCheck: new Date(),
            error: 'Unknown protocol'
          };
      }
    } catch (error) {
      baseHealth = {
        adapterId,
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : String(error)
      };
    }

    // Enhance with factory-level metadata
    return {
      ...baseHealth,
      metadata: {
        ...instance.metadata,
        uptime: Date.now() - instance.createdAt.getTime()
      }
    };
  }

  /**
   * Send a request through an adapter with usage tracking
   */
  public async sendRequest(adapterId: string, request: any): Promise<any> {
    const instance = this.adapters.get(adapterId);
    if (!instance) {
      throw new Error(`Adapter not found: ${adapterId}`);
    }

    if (instance.status !== AdapterStatus.CONNECTED) {
      throw new Error(`Adapter not connected: ${instance.status}`);
    }

    try {
      instance.metadata.requestCount++;
      instance.lastUsedAt = new Date();

      let result: any;
      switch (instance.protocol) {
        case ServerProtocol.STDIO:
          result = await (instance.adapter as StdioAdapter).sendRequest(request);
          break;
        case ServerProtocol.SSE:
          result = await (instance.adapter as SseAdapter).sendRequest(request);
          break;
        case ServerProtocol.HTTP:
          result = await (instance.adapter as HttpAdapter).sendRequest(request);
          break;
        default:
          throw new Error(`Unsupported protocol: ${instance.protocol}`);
      }

      return result;
    } catch (error) {
      instance.metadata.errorCount++;
      instance.metadata.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Send a streaming request through an adapter with usage tracking
   */
  public async* streamRequest(adapterId: string, request: any): AsyncIterable<any> {
    const instance = this.adapters.get(adapterId);
    if (!instance) {
      throw new Error(`Adapter not found: ${adapterId}`);
    }

    if (instance.status !== AdapterStatus.CONNECTED) {
      throw new Error(`Adapter not connected: ${instance.status}`);
    }

    try {
      instance.metadata.requestCount++;
      instance.lastUsedAt = new Date();

      switch (instance.protocol) {
        case ServerProtocol.STDIO:
          yield* (instance.adapter as StdioAdapter).streamRequest(request);
          break;
        case ServerProtocol.SSE:
          yield* (instance.adapter as SseAdapter).streamRequest(request);
          break;
        case ServerProtocol.HTTP:
          yield* (instance.adapter as HttpAdapter).streamRequest(request);
          break;
        default:
          throw new Error(`Unsupported protocol: ${instance.protocol}`);
      }
    } catch (error) {
      instance.metadata.errorCount++;
      instance.metadata.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Determine protocol from server configuration
   */
  private determineProtocol(config: ServerConfig): ServerProtocol {
    if (config.stdio !== undefined) {
      return ServerProtocol.STDIO;
    } else if (config.sse !== undefined) {
      return ServerProtocol.SSE;
    } else if (config.http !== undefined) {
      return ServerProtocol.HTTP;
    } else {
      throw new Error('No valid protocol configuration found');
    }
  }

  /**
   * Get comprehensive adapter statistics
   */
  public getAdapterStatistics(): {
    totalAdapters: number;
    adaptersByProtocol: Record<string, number>;
    adaptersByStatus: Record<string, number>;
    totalRequests: number;
    totalErrors: number;
    averageUptime: number;
  } {
    const stats = {
      totalAdapters: this.adapters.size,
      adaptersByProtocol: {} as Record<string, number>,
      adaptersByStatus: {} as Record<string, number>,
      totalRequests: 0,
      totalErrors: 0,
      averageUptime: 0
    };

    let totalUptime = 0;

    for (const instance of this.adapters.values()) {
      // Count by protocol
      stats.adaptersByProtocol[instance.protocol] = (stats.adaptersByProtocol[instance.protocol] || 0) + 1;
      
      // Count by status
      stats.adaptersByStatus[instance.status] = (stats.adaptersByStatus[instance.status] || 0) + 1;
      
      // Aggregate metrics
      stats.totalRequests += instance.metadata.requestCount;
      stats.totalErrors += instance.metadata.errorCount;
      
      // Calculate uptime
      const uptime = Date.now() - instance.createdAt.getTime();
      totalUptime += uptime;
    }

    stats.averageUptime = this.adapters.size > 0 ? totalUptime / this.adapters.size : 0;

    return stats;
  }

  /**
   * Restart an adapter
   */
  public async restartAdapter(adapterId: string): Promise<void> {
    const instance = this.adapters.get(adapterId);
    if (!instance) {
      throw new Error(`Adapter not found: ${adapterId}`);
    }

    instance.status = AdapterStatus.RECONNECTING;
    instance.metadata.restartCount++;
    this.emitLifecycleEvent(instance, AdapterStatus.RECONNECTING);

    try {
      // Stop the current adapter
      await this.stopAdapter(instance);

      // Restart based on protocol
      switch (instance.protocol) {
        case ServerProtocol.STDIO:
          await (instance.adapter as StdioAdapter).start();
          break;
        case ServerProtocol.SSE:
          await (instance.adapter as SseAdapter).connect();
          break;
        case ServerProtocol.HTTP:
          await (instance.adapter as HttpAdapter).initialize();
          break;
      }

      instance.status = AdapterStatus.CONNECTED;
      this.emitLifecycleEvent(instance, AdapterStatus.CONNECTED);
    } catch (error) {
      instance.status = AdapterStatus.ERROR;
      instance.metadata.lastError = error instanceof Error ? error.message : String(error);
      this.emitLifecycleEvent(instance, AdapterStatus.ERROR, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Graceful shutdown of all adapters
   */
  public async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.stopHealthMonitoring();

    const shutdownPromises = Array.from(this.adapters.values()).map(async (instance) => {
      try {
        await this.stopAdapter(instance);
      } catch (error) {
        // Log error but don't throw to allow other adapters to shutdown
        this.emit('error', { adapterId: instance.id, error });
      }
    });

    await Promise.allSettled(shutdownPromises);
    this.adapters.clear();
    this.emit('shutdown');
  }

  /**
   * Setup event listeners for an adapter
   */
  private setupAdapterEventListeners(
    adapter: StdioAdapter | SseAdapter | HttpAdapter, 
    instance: AdapterInstance
  ): void {
    // Common event handlers for all adapter types
    adapter.on('error', (error) => {
      instance.status = AdapterStatus.ERROR;
      instance.metadata.errorCount++;
      instance.metadata.lastError = error.message;
      this.emitLifecycleEvent(instance, AdapterStatus.ERROR, error.message);

      // Auto-restart if enabled
      if (this.options.enableAutoRestart && instance.metadata.restartCount < 3) {
        setTimeout(() => {
          this.restartAdapter(instance.id).catch(err => 
            this.emit('error', { adapterId: instance.id, error: err })
          );
        }, 5000);
      }
    });

    // Protocol-specific event handlers
    if (adapter instanceof StdioAdapter) {
      adapter.on('started', () => {
        instance.status = AdapterStatus.CONNECTED;
        this.emitLifecycleEvent(instance, AdapterStatus.CONNECTED);
      });

      adapter.on('stopped', () => {
        instance.status = AdapterStatus.DISCONNECTED;
        this.emitLifecycleEvent(instance, AdapterStatus.DISCONNECTED);
      });
    } else if (adapter instanceof SseAdapter) {
      adapter.on('connected', () => {
        instance.status = AdapterStatus.CONNECTED;
        this.emitLifecycleEvent(instance, AdapterStatus.CONNECTED);
      });

      adapter.on('disconnected', () => {
        instance.status = AdapterStatus.DISCONNECTED;
        this.emitLifecycleEvent(instance, AdapterStatus.DISCONNECTED);
      });
    } else if (adapter instanceof HttpAdapter) {
      adapter.on('initialized', () => {
        instance.status = AdapterStatus.CONNECTED;
        this.emitLifecycleEvent(instance, AdapterStatus.CONNECTED);
      });
    }
  }

  /**
   * Stop an individual adapter
   */
  private async stopAdapter(instance: AdapterInstance): Promise<void> {
    switch (instance.protocol) {
      case ServerProtocol.STDIO:
        await (instance.adapter as StdioAdapter).stop();
        break;
      case ServerProtocol.SSE:
        await (instance.adapter as SseAdapter).disconnect();
        break;
      case ServerProtocol.HTTP:
        await (instance.adapter as HttpAdapter).cleanup();
        break;
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.options.healthCheckInterval);
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Perform health checks on all adapters
   */
  private performHealthChecks(): void {
    for (const instance of this.adapters.values()) {
      try {
        const health = this.getAdapterHealth(instance.id);
        
        // Update metadata based on health
        instance.metadata.uptime = Date.now() - instance.createdAt.getTime();
        
        // Emit health check event
        this.emit('healthCheck', {
          adapterId: instance.id,
          serverId: instance.serverId,
          health
        });

        // Handle unhealthy adapters
        if (health.status === 'unhealthy' && 
            instance.status === AdapterStatus.CONNECTED &&
            this.options.enableAutoRestart) {
          this.restartAdapter(instance.id).catch(error => 
            this.emit('error', { adapterId: instance.id, error })
          );
        }
      } catch (error) {
        this.emit('error', { adapterId: instance.id, error });
      }
    }
  }

  /**
   * Emit lifecycle event
   */
  private emitLifecycleEvent(
    instance: AdapterInstance, 
    status: AdapterStatus, 
    error?: string
  ): void {
    const event: AdapterLifecycleEvent = {
      adapterId: instance.id,
      serverId: instance.serverId,
      protocol: instance.protocol,
      status,
      timestamp: new Date(),
      error
    };

    this.emit('lifecycleEvent', event);
  }

  /**
   * Generate a unique adapter ID
   */
  private generateAdapterId(serverId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `adapter_${serverId}_${timestamp}_${random}`;
  }
}