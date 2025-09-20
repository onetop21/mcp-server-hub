import { ServerConfig } from '../models';

export interface IProtocolAdapterService {
  /**
   * Create a protocol adapter for a server
   */
  createAdapter(serverConfig: ServerConfig): Promise<ProtocolAdapter>;

  /**
   * Send a request through an adapter
   */
  sendRequest(adapterId: string, request: McpRequest): Promise<McpResponse>;

  /**
   * Send a streaming request through an adapter
   */
  streamRequest(adapterId: string, request: McpRequest): AsyncIterable<McpStreamResponse>;

  /**
   * Close and cleanup an adapter
   */
  closeAdapter(adapterId: string): Promise<void>;

  /**
   * Get adapter health status
   */
  getAdapterHealth(adapterId: string): Promise<AdapterHealth>;

  /**
   * Get all active adapters
   */
  getActiveAdapters(): Promise<ProtocolAdapter[]>;
}

export interface ProtocolAdapter {
  id: string;
  serverId: string;
  protocol: 'stdio' | 'sse' | 'http';
  status: 'connected' | 'disconnected' | 'error';
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface McpRequest {
  method: string;
  params?: any;
  id?: string | number;
}

export interface McpResponse {
  result?: any;
  error?: McpError;
  id?: string | number;
}

export interface McpStreamResponse {
  data: any;
  done: boolean;
}

export interface McpError {
  code: number;
  message: string;
  data?: any;
}

export interface AdapterHealth {
  adapterId: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  responseTime?: number;
  error?: string;
}