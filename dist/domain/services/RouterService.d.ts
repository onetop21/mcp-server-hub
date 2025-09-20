import { RoutingRule } from '../models/Endpoint';
import { ServerHealth } from '../models/Server';
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: any;
    namespace?: string;
}
export interface ToolCallResult {
    success: boolean;
    result?: any;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    serverId: string;
    responseTime: number;
}
export interface RouterService {
    routeToolCall(endpointId: string, toolName: string, params: any): Promise<ToolCallResult>;
    getAvailableTools(endpointId: string): Promise<ToolDefinition[]>;
    setRoutingRules(groupId: string, rules: RoutingRule[]): Promise<void>;
    getServerHealth(serverId: string): Promise<ServerHealth>;
}
export declare const ROUTER_SERVICE: unique symbol;
//# sourceMappingURL=RouterService.d.ts.map