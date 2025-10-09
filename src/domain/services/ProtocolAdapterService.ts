import { injectable } from 'inversify';
import { ServerConfig, ServerProtocol } from '../models/Server';
import { ProtocolAdapterFactory, AdapterInstance, AdapterStatus } from '../../infrastructure/adapters/ProtocolAdapterFactory';
import { 
  IProtocolAdapterService, 
  ProtocolAdapter, 
  McpRequest, 
  McpResponse, 
  McpStreamResponse, 
  AdapterHealth 
} from './IProtocolAdapterService';

/**
 * Enhanced Protocol Adapter Service Implementation
 * 
 * Manages different protocol adapters (STDIO, SSE, HTTP) for MCP servers using the factory pattern
 */
@injectable()
export class ProtocolAdapterService implements IProtocolAdapterService {
  private factory: ProtocolAdapterFactory;
  private adapterMapping: Map<string, string> = new Map(); // serverId -> adapterId

  constructor() {
    this.factory = new ProtocolAdapterFactory({
      stdio: {
        maxRestarts: 3,
        restartDelay: 2000,
        healthCheckInterval: 30000,
        requestTimeout: 30000
      },
      sse: {
        maxReconnects: 5,
        reconnectDelay: 2000,
        healthCheckInterval: 30000,
        requestTimeout: 30000
      },
      http: {
        maxConcurrentRequests: 10,
        requestTimeout: 30000,
        healthCheckInterval: 30000
      },
      healthCheckInterval: 30000,
      maxConcurrentAdapters: 100,
      enableAutoRestart: true
    });

    // Set up event listeners for the factory
    this.setupFactoryEventListeners();
  }

  /**
   * Create a protocol adapter for a server using the enhanced factory
   */
  public async createAdapter(serverConfig: ServerConfig & { id: string; protocol: ServerProtocol }): Promise<ProtocolAdapter> {
    const { id: serverId } = serverConfig;

    try {
      const adapterInstance = await this.factory.createAdapter(serverId, serverConfig);
      
      // Store mapping for easy lookup
      this.adapterMapping.set(serverId, adapterInstance.id);

      // Convert factory instance to service interface
      const protocolAdapter: ProtocolAdapter = {
        id: adapterInstance.id,
        serverId: adapterInstance.serverId,
        protocol: adapterInstance.protocol,
        status: this.mapAdapterStatus(adapterInstance.status),
        createdAt: adapterInstance.createdAt,
        lastUsedAt: adapterInstance.lastUsedAt
      };

      return protocolAdapter;
    } catch (error) {
      throw new Error(`Failed to create adapter for server ${serverId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send a request through an adapter using the factory
   */
  public async sendRequest(adapterId: string, request: McpRequest): Promise<McpResponse> {
    try {
      return await this.factory.sendRequest(adapterId, request);
    } catch (error) {
      throw new Error(`Failed to send request through adapter ${adapterId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send a streaming request through an adapter using the factory
   */
  public async* streamRequest(adapterId: string, request: McpRequest): AsyncIterable<McpStreamResponse> {
    try {
      yield* this.factory.streamRequest(adapterId, request);
    } catch (error) {
      throw new Error(`Failed to stream request through adapter ${adapterId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Close and cleanup an adapter using the factory
   */
  public async closeAdapter(adapterId: string): Promise<void> {
    try {
      await this.factory.removeAdapter(adapterId);
      
      // Remove from mapping
      for (const [serverId, mappedAdapterId] of this.adapterMapping.entries()) {
        if (mappedAdapterId === adapterId) {
          this.adapterMapping.delete(serverId);
          break;
        }
      }
    } catch (error) {
      throw new Error(`Failed to close adapter ${adapterId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get adapter health status using the factory
   */
  public async getAdapterHealth(adapterId: string): Promise<AdapterHealth> {
    try {
      const health = this.factory.getAdapterHealth(adapterId);
      
      // Remove metadata from the response to match interface
      const { metadata, ...baseHealth } = health as any;
      return baseHealth;
    } catch (error) {
      throw new Error(`Failed to get adapter health for ${adapterId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all active adapters using the factory
   */
  public async getActiveAdapters(): Promise<ProtocolAdapter[]> {
    const factoryAdapters = this.factory.getAllAdapters();
    
    return factoryAdapters.map(instance => ({
      id: instance.id,
      serverId: instance.serverId,
      protocol: instance.protocol,
      status: this.mapAdapterStatus(instance.status),
      createdAt: instance.createdAt,
      lastUsedAt: instance.lastUsedAt
    }));
  }

  /**
   * Shutdown all adapters using the factory
   */
  public async shutdown(): Promise<void> {
    await this.factory.gracefulShutdown();
    this.adapterMapping.clear();
  }

  /**
   * Get adapter by server ID
   */
  public getAdapterByServerId(serverId: string): ProtocolAdapter | undefined {
    const adapterId = this.adapterMapping.get(serverId);
    if (!adapterId) {
      return undefined;
    }

    const instance = this.factory.getAdapter(adapterId);
    if (!instance) {
      return undefined;
    }

    return {
      id: instance.id,
      serverId: instance.serverId,
      protocol: instance.protocol,
      status: this.mapAdapterStatus(instance.status),
      createdAt: instance.createdAt,
      lastUsedAt: instance.lastUsedAt
    };
  }

  /**
   * Restart an adapter
   */
  public async restartAdapter(adapterId: string): Promise<void> {
    try {
      await this.factory.restartAdapter(adapterId);
    } catch (error) {
      throw new Error(`Failed to restart adapter ${adapterId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get factory statistics
   */
  public getStatistics(): any {
    return this.factory.getAdapterStatistics();
  }

  /**
   * Get tools from a specific adapter
   */
  public async getToolsFromAdapter(adapterId: string): Promise<{ tools: ToolDefinition[] }> {
    try {
      const adapter = this.factory.getAdapter(adapterId);
      if (!adapter) {
        throw new Error(`Adapter '${adapterId}' not found`);
      }

      // Send tools/list request to the MCP server
      const request: McpRequest = {
        method: 'tools/list',
        params: {},
        id: Date.now().toString()
      };

      const response = await this.sendRequest(adapterId, request);

      if (response.error) {
        throw new Error(`MCP server error: ${response.error.message}`);
      }

      const tools = response.result?.tools || [];

      return { tools };
    } catch (error) {
      throw new Error(`Failed to get tools from adapter: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Map factory adapter status to service interface status
   */
  private mapAdapterStatus(factoryStatus: AdapterStatus): 'connected' | 'disconnected' | 'error' {
    switch (factoryStatus) {
      case AdapterStatus.CONNECTED:
        return 'connected';
      case AdapterStatus.DISCONNECTED:
      case AdapterStatus.INITIALIZING:
        return 'disconnected';
      case AdapterStatus.ERROR:
      case AdapterStatus.RECONNECTING:
        return 'error';
      default:
        return 'error';
    }
  }

  /**
   * Set up event listeners for the factory
   */
  private setupFactoryEventListeners(): void {
    this.factory.on('lifecycleEvent', (event) => {
      // Emit service-level events based on factory events
      // This allows the service to maintain its own event interface
      // while leveraging the factory's enhanced capabilities
    });

    this.factory.on('healthCheck', (event) => {
      // Handle health check events from factory
      // Could be used for service-level monitoring and alerting
    });

    this.factory.on('error', (event) => {
      // Handle factory-level errors
      // Could be logged or forwarded to service consumers
    });

    this.factory.on('shutdown', () => {
      // Handle factory shutdown
      // Clean up service-level resources if needed
    });
  }
}

export const PROTOCOL_ADAPTER_SERVICE = Symbol.for('ProtocolAdapterService');