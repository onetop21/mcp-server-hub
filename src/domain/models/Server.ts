export interface RegisteredServer {
  id: string;
  userId: string;
  name: string;
  protocol: ServerProtocol;
  config: ServerConfig;
  namespace?: string;
  status: ServerStatus;
  lastHealthCheck: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum ServerProtocol {
  STDIO = 'stdio',
  SSE = 'sse',
  HTTP = 'http'
}

export enum ServerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error'
}

export interface ServerConfig {
  stdio?: StdioConfig;
  sse?: SseConfig;
  http?: HttpConfig;
}

export interface StdioConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface SseConfig {
  url: string;
  headers?: Record<string, string>;
}

export interface HttpConfig {
  url: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

export interface ServerUpdate {
  name?: string;
  config?: {
    stdio?: Partial<StdioConfig>;
    sse?: Partial<SseConfig>;
    http?: Partial<HttpConfig>;
  };
  namespace?: string;
  status?: ServerStatus;
}

export interface ServerHealth {
  serverId: string;
  status: ServerStatus;
  lastCheck: Date;
  responseTime?: number;
  error?: string;
}