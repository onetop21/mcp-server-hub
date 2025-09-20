import { ServerConfig } from '../models/Server';
export interface McpRequest {
    method: string;
    params?: any;
    id?: string | number;
}
export interface McpResponse {
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
    id?: string | number;
}
export interface McpStreamResponse {
    data: any;
    done: boolean;
}
export interface ProtocolAdapter {
    id: string;
    protocol: string;
    status: 'connected' | 'disconnected' | 'error';
}
export interface AdapterHealth {
    adapterId: string;
    status: 'healthy' | 'unhealthy' | 'unknown';
    lastCheck: Date;
    responseTime?: number;
    errorMessage?: string;
}
export interface ProtocolAdapterService {
    createAdapter(serverConfig: ServerConfig & {
        id: string;
        protocol: string;
    }): Promise<ProtocolAdapter>;
    sendRequest(adapterId: string, request: McpRequest): Promise<McpResponse>;
    streamRequest(adapterId: string, request: McpRequest): AsyncIterable<McpStreamResponse>;
    closeAdapter(adapterId: string): Promise<void>;
    getAdapterHealth(adapterId: string): Promise<AdapterHealth>;
}
export declare const PROTOCOL_ADAPTER_SERVICE: unique symbol;
//# sourceMappingURL=ProtocolAdapterService.d.ts.map