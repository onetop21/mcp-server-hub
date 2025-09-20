import { RoutingRule, ServerHealth } from '../models';
export interface IRouterService {
    /**
     * Route a tool call to the appropriate server
     */
    routeToolCall(endpointId: string, toolName: string, params: any): Promise<ToolCallResult>;
    /**
     * Get all available tools for an endpoint
     */
    getAvailableTools(endpointId: string): Promise<ToolDefinition[]>;
    /**
     * Set routing rules for a group
     */
    setRoutingRules(groupId: string, rules: RoutingRule[]): Promise<void>;
    /**
     * Get routing rules for a group
     */
    getRoutingRules(groupId: string): Promise<RoutingRule[]>;
    /**
     * Get server health status
     */
    getServerHealth(serverId: string): Promise<ServerHealth>;
    /**
     * Get health status for all servers in a group
     */
    getGroupHealth(groupId: string): Promise<ServerHealth[]>;
}
export interface ToolCallResult {
    success: boolean;
    result?: any;
    error?: string;
    serverId: string;
    responseTime: number;
}
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: ToolParameter[];
    serverId: string;
    namespace?: string;
}
export interface ToolParameter {
    name: string;
    type: string;
    description: string;
    required: boolean;
    default?: any;
}
//# sourceMappingURL=IRouterService.d.ts.map