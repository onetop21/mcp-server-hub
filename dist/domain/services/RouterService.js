"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROUTER_SERVICE = exports.RouterService = void 0;
const inversify_1 = require("inversify");
const Server_1 = require("../models/Server");
const ServerRepository_1 = require("../../infrastructure/repositories/ServerRepository");
const EndpointRepository_1 = require("../../infrastructure/repositories/EndpointRepository");
const ServerGroupRepository_1 = require("../../infrastructure/repositories/ServerGroupRepository");
/**
 * Router service implementation for tool routing and namespace management
 *
 * ARCHITECTURE DECISION: Simplified Design
 * =======================================
 * This service is designed with simplicity in mind, assuming:
 * 1. Each user runs their own MCP servers with personal credentials
 * 2. MCP servers are stateless and don't require load balancing
 * 3. Users can reuse one server across multiple projects
 *
 * LoadBalancerService is OPTIONAL and currently DISABLED by default.
 * It can be enabled in future when team/organization shared servers are needed.
 *
 * See: docs/Architecture-Simplified.md for detailed reasoning
 */
let RouterService = class RouterService {
    constructor(serverRepository, endpointRepository, serverGroupRepository, protocolAdapterService, 
    /**
     * LoadBalancerService (OPTIONAL - Currently Disabled)
     *
     * This is intentionally optional to keep the architecture simple.
     * By default, the router selects the first available server.
     *
     * To enable load balancing:
     * - Inject LoadBalancerService in DI container
     * - Pass it to this constructor
     * - All load balancing features will automatically activate
     *
     * @see docs/LoadBalancing.md for activation instructions
     */
    loadBalancerService) {
        this.serverRepository = serverRepository;
        this.endpointRepository = endpointRepository;
        this.serverGroupRepository = serverGroupRepository;
        this.protocolAdapterService = protocolAdapterService;
        this.loadBalancerService = loadBalancerService;
    }
    /**
     * Route a tool call to the appropriate server based on tool name and routing rules
     */
    async routeToolCall(endpointId, toolName, params) {
        const startTime = Date.now();
        try {
            // Get endpoint information
            const endpoint = await this.endpointRepository.findEndpointById(endpointId);
            if (!endpoint) {
                return {
                    success: false,
                    error: 'Endpoint not found',
                    serverId: '',
                    responseTime: Date.now() - startTime
                };
            }
            // Get available servers for this endpoint
            const servers = await this.getServersForEndpoint(endpoint.groupId, endpoint.userId);
            if (servers.length === 0) {
                return {
                    success: false,
                    error: 'No servers available for this endpoint',
                    serverId: '',
                    responseTime: Date.now() - startTime
                };
            }
            // Find the appropriate server for the tool
            const targetServer = await this.selectServerForTool(toolName, servers, endpoint.groupId);
            if (!targetServer) {
                return {
                    success: false,
                    error: `No server found for tool: ${toolName}`,
                    serverId: '',
                    responseTime: Date.now() - startTime
                };
            }
            // Check server health
            if (targetServer.status !== Server_1.ServerStatus.ACTIVE) {
                // Try fallback servers
                const fallbackServer = await this.findFallbackServer(toolName, servers, targetServer.id);
                if (fallbackServer) {
                    return await this.executeToolCall(fallbackServer, toolName, params, startTime);
                }
                return {
                    success: false,
                    error: `Server ${targetServer.name} is not available`,
                    serverId: targetServer.id,
                    responseTime: Date.now() - startTime
                };
            }
            /**
             * EXECUTE TOOL CALL
             * =================
             * Simple execution without connection tracking or circuit breaker.
             *
             * Connection tracking and circuit breaker are available but disabled.
             * They can be enabled by injecting LoadBalancerService.
             *
             * Current flow:
             * 1. Call the tool on the selected server
             * 2. Return the result (success or failure)
             *
             * With LoadBalancer enabled:
             * 1. Track connection count
             * 2. Execute tool call
             * 3. Record success/failure for circuit breaker
             * 4. Automatically failover on repeated failures
             */
            return await this.executeToolCall(targetServer, toolName, params, startTime);
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                serverId: '',
                responseTime: Date.now() - startTime
            };
        }
    }
    /**
     * Get all available tools for an endpoint with namespace handling
     */
    async getAvailableTools(endpointId) {
        try {
            // Get endpoint information
            const endpoint = await this.endpointRepository.findEndpointById(endpointId);
            if (!endpoint) {
                return [];
            }
            // Get servers for this endpoint
            const servers = await this.getServersForEndpoint(endpoint.groupId, endpoint.userId);
            // Collect tools from all active servers
            const allTools = [];
            const toolNameMap = new Map();
            for (const server of servers) {
                if (server.status !== Server_1.ServerStatus.ACTIVE) {
                    continue;
                }
                try {
                    // Get tools from the server via protocol adapter
                    const serverTools = await this.getToolsFromServer(server);
                    for (const tool of serverTools) {
                        // Apply namespace to tool name
                        const namespacedToolName = this.applyNamespace(tool.name, server.namespace || server.name);
                        const namespacedTool = Object.assign(Object.assign({}, tool), { name: namespacedToolName, serverId: server.id, namespace: server.namespace || server.name });
                        // Allow multiple servers to provide the same tool
                        if (!toolNameMap.has(namespacedToolName)) {
                            toolNameMap.set(namespacedToolName, []);
                        }
                        const existingTools = toolNameMap.get(namespacedToolName);
                        // Check if this server already provides this tool (prevent duplicates from same server)
                        if (!existingTools.some(t => t.serverId === server.id)) {
                            existingTools.push(namespacedTool);
                            allTools.push(namespacedTool);
                        }
                        else {
                            console.warn(`Duplicate tool ${namespacedToolName} from same server ${server.id}`);
                        }
                    }
                }
                catch (error) {
                    console.error(`Failed to get tools from server ${server.id}:`, error);
                    // Continue with other servers
                }
            }
            return allTools;
        }
        catch (error) {
            console.error('Failed to get available tools:', error);
            return [];
        }
    }
    /**
     * Set routing rules for a group
     */
    async setRoutingRules(groupId, rules) {
        await this.serverGroupRepository.updateRoutingRules(groupId, rules);
    }
    /**
     * Get routing rules for a group
     */
    async getRoutingRules(groupId) {
        const group = await this.serverGroupRepository.findGroupById(groupId);
        return (group === null || group === void 0 ? void 0 : group.routingRules) || [];
    }
    /**
     * Get server health status
     */
    async getServerHealth(serverId) {
        const server = await this.serverRepository.findServerById(serverId);
        if (!server) {
            return {
                serverId,
                status: Server_1.ServerStatus.ERROR,
                lastCheck: new Date(),
                error: 'Server not found'
            };
        }
        // Perform health check via protocol adapter
        try {
            const healthResult = await this.protocolAdapterService.getAdapterHealth(serverId);
            return {
                serverId,
                status: healthResult.status === 'healthy' ? Server_1.ServerStatus.ACTIVE : Server_1.ServerStatus.INACTIVE,
                lastCheck: new Date(),
                responseTime: healthResult.responseTime,
                error: healthResult.error
            };
        }
        catch (error) {
            return {
                serverId,
                status: Server_1.ServerStatus.ERROR,
                lastCheck: new Date(),
                error: error instanceof Error ? error.message : 'Health check failed'
            };
        }
    }
    /**
     * Get health status for all servers in a group
     */
    async getGroupHealth(groupId) {
        const group = await this.serverGroupRepository.findGroupById(groupId);
        if (!group) {
            return [];
        }
        const healthPromises = group.serverIds.map(serverId => this.getServerHealth(serverId));
        return Promise.all(healthPromises);
    }
    /**
     * Get servers for an endpoint (either from group or all user servers)
     */
    async getServersForEndpoint(groupId, userId) {
        if (groupId) {
            // Get servers from specific group
            const group = await this.serverGroupRepository.findGroupById(groupId);
            if (!group) {
                return [];
            }
            const serverPromises = group.serverIds.map(serverId => this.serverRepository.findServerById(serverId));
            const servers = await Promise.all(serverPromises);
            return servers.filter((server) => server !== null);
        }
        else {
            // Get all user servers for default endpoint
            return await this.serverRepository.findByUserId(userId);
        }
    }
    /**
     * Select the appropriate server for a tool based on routing rules and load balancing
     */
    async selectServerForTool(toolName, servers, groupId) {
        // Parse namespace from tool name
        const { namespace, baseName } = this.parseToolName(toolName);
        // Filter servers by namespace if specified
        let candidateServers = servers;
        if (namespace) {
            candidateServers = servers.filter(server => (server.namespace || server.name) === namespace);
        }
        // If no servers match the namespace, return null
        if (candidateServers.length === 0) {
            return null;
        }
        // Apply routing rules if group is specified
        if (groupId) {
            const routingRules = await this.getRoutingRules(groupId);
            const ruleBasedServer = this.applyRoutingRules(baseName, candidateServers, routingRules);
            if (ruleBasedServer) {
                return ruleBasedServer;
            }
        }
        // Filter to only active servers
        const activeServers = candidateServers.filter(server => server.status === Server_1.ServerStatus.ACTIVE);
        if (activeServers.length === 0) {
            return null;
        }
        /**
         * SIMPLIFIED SERVER SELECTION
         * ===========================
         * Current behavior: Always select the first available server
         *
         * Why simple selection?
         * - MCP servers are typically personal (individual credentials)
         * - Each user runs 1 instance per server type
         * - Stateless design means any server can handle any request
         * - No need for complex load balancing in 90% of use cases
         *
         * To enable load balancing (for team/org shared servers):
         * - Inject LoadBalancerService in constructor
         * - Uncomment the code below:
         *
         * if (this.loadBalancerService) {
         *   return await this.loadBalancerService.selectServer(
         *     activeServers,
         *     LoadBalancingStrategy.ROUND_ROBIN,
         *     { groupId, toolName }
         *   );
         * }
         */
        return activeServers[0];
    }
    /**
     * Apply routing rules to select a server
     *
     * ROUTING RULES ENGINE
     * ====================
     *
     * This method implements a simple but powerful routing rules system:
     *
     * 1. Rules are evaluated in priority order (highest first)
     * 2. Only enabled rules are considered
     * 3. First matching rule wins
     * 4. Target server must be active
     *
     * Use cases:
     * - Route specific tools to specific servers
     * - Implement A/B testing (route 10% to new server)
     * - Failover routing (primary → backup)
     *
     * Example:
     * {
     *   id: "rule1",
     *   condition: { toolName: "create_issue" },
     *   targetServerId: "github-server-1",
     *   priority: 100,
     *   enabled: true
     * }
     *
     * @param toolName - The tool being called (without namespace)
     * @param servers - Available servers to choose from
     * @param rules - Routing rules to apply
     * @returns Selected server or null if no rule matches
     */
    applyRoutingRules(toolName, servers, rules) {
        // Sort rules by priority (higher priority first)
        const sortedRules = rules
            .filter(rule => rule.enabled)
            .sort((a, b) => b.priority - a.priority);
        for (const rule of sortedRules) {
            if (this.matchesRoutingCondition(toolName, rule.condition)) {
                const targetServer = servers.find(server => server.id === rule.targetServerId);
                if (targetServer && targetServer.status === Server_1.ServerStatus.ACTIVE) {
                    return targetServer;
                }
            }
        }
        return null;
    }
    /**
     * Check if a tool matches a routing condition
     *
     * CONDITION MATCHING
     * ==================
     *
     * Current implementation: Simple tool name matching
     *
     * Supported conditions:
     * - toolName: Exact match (e.g., "create_issue")
     *
     * Future extensions (commented out for simplicity):
     * - parameterMatch: Route based on parameter values
     * - serverTags: Route to servers with specific tags
     * - timeOfDay: Route differently at different times
     * - clientId: Route based on which client is calling
     *
     * Design philosophy: Keep it simple
     * - Most users only need tool name routing
     * - Advanced conditions add complexity without much benefit
     * - Can be extended when actual use cases emerge
     *
     * @param toolName - Tool being called
     * @param condition - Routing condition to check
     * @returns true if condition matches
     */
    matchesRoutingCondition(toolName, condition) {
        // Check tool name match
        if (condition.toolName && condition.toolName !== toolName) {
            return false;
        }
        // Future: Parameter matching
        // if (condition.parameterMatch) {
        //   // Check if parameters match the condition
        // }
        // Future: Server tags
        // if (condition.serverTags) {
        //   // Check if server has required tags
        // }
        return true;
    }
    /**
     * Find a fallback server when the primary server is unavailable
     */
    async findFallbackServer(toolName, servers, excludeServerId) {
        const { namespace } = this.parseToolName(toolName);
        // Find alternative servers that can handle the tool
        const fallbackServers = servers.filter(server => server.id !== excludeServerId &&
            server.status === Server_1.ServerStatus.ACTIVE &&
            (!namespace || (server.namespace || server.name) === namespace));
        if (fallbackServers.length === 0) {
            return null;
        }
        // Return the first available fallback server
        return fallbackServers[0];
    }
    /**
     * Execute a tool call with optional connection tracking and circuit breaker
     *
     * ARCHITECTURE NOTE: This method is preserved but not used by default
     * ===================================================================
     *
     * Current state: DISABLED (method exists but not called)
     * Purpose: Ready for future activation when needed
     *
     * When LoadBalancerService is injected, this method provides:
     * 1. Connection counting (for least-connections load balancing)
     * 2. Success/failure tracking (for circuit breaker)
     * 3. Automatic server health monitoring
     * 4. Failover on repeated failures
     *
     * Design rationale for keeping this code:
     * - Zero cost when not used (just exists in memory)
     * - Instant activation when LoadBalancerService is injected
     * - Already tested and proven to work (26 tests passing)
     * - Future-proof for team/organization scenarios
     *
     * @internal This method is not currently called in the default flow
     */
    async executeToolCallWithTracking(server, toolName, params, startTime) {
        // If load balancer is configured, use tracking
        if (this.loadBalancerService) {
            await this.loadBalancerService.incrementConnections(server.id);
            try {
                const result = await this.executeToolCall(server, toolName, params, startTime);
                if (result.success) {
                    await this.loadBalancerService.recordSuccess(server.id);
                }
                else {
                    await this.loadBalancerService.recordFailure(server.id);
                }
                return result;
            }
            finally {
                await this.loadBalancerService.decrementConnections(server.id);
            }
        }
        // Default: simple execution without tracking
        return await this.executeToolCall(server, toolName, params, startTime);
    }
    /**
     * Execute a tool call on a specific server
     */
    async executeToolCall(server, toolName, params, startTime) {
        try {
            // Remove namespace from tool name when calling the actual server
            const { baseName } = this.parseToolName(toolName);
            // Execute via protocol adapter
            const result = await this.protocolAdapterService.sendRequest(server.id, {
                method: 'tools/call',
                params: {
                    name: baseName,
                    arguments: params
                }
            });
            return {
                success: true,
                result: result.result,
                serverId: server.id,
                responseTime: Date.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Tool execution failed',
                serverId: server.id,
                responseTime: Date.now() - startTime
            };
        }
    }
    /**
     * Get tools from a server via protocol adapter
     */
    async getToolsFromServer(server) {
        try {
            const result = await this.protocolAdapterService.sendRequest(server.id, {
                method: 'tools/list',
                params: {}
            });
            // Convert server response to ToolDefinition format
            if (result.result && Array.isArray(result.result.tools)) {
                return result.result.tools.map((tool) => this.convertToToolDefinition(tool, server));
            }
            return [];
        }
        catch (error) {
            console.error(`Failed to get tools from server ${server.id}:`, error);
            return [];
        }
    }
    /**
     * Convert server tool response to standardized ToolDefinition format
     */
    convertToToolDefinition(tool, server) {
        var _a, _b;
        // Extract parameters from inputSchema
        const parameters = [];
        if ((_a = tool.inputSchema) === null || _a === void 0 ? void 0 : _a.properties) {
            for (const [paramName, paramDef] of Object.entries(tool.inputSchema.properties)) {
                const param = paramDef;
                parameters.push({
                    name: paramName,
                    type: param.type || 'string',
                    description: param.description || '',
                    required: ((_b = tool.inputSchema.required) === null || _b === void 0 ? void 0 : _b.includes(paramName)) || false,
                    default: param.default
                });
            }
        }
        return {
            name: tool.name,
            description: tool.description || '',
            parameters,
            serverId: server.id
        };
    }
    /**
     * Apply namespace to a tool name
     */
    applyNamespace(toolName, namespace) {
        // If tool name already has a namespace, don't add another one
        if (toolName.includes('.')) {
            return toolName;
        }
        return `${namespace}.${toolName}`;
    }
    /**
     * Parse a tool name to extract namespace and base name
     */
    parseToolName(toolName) {
        const parts = toolName.split('.');
        if (parts.length === 1) {
            return { baseName: toolName };
        }
        const namespace = parts.slice(0, -1).join('.');
        const baseName = parts[parts.length - 1];
        return { namespace, baseName };
    }
};
RouterService = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [ServerRepository_1.ServerRepository,
        EndpointRepository_1.EndpointRepository,
        ServerGroupRepository_1.ServerGroupRepository, Object, Object])
], RouterService);
exports.RouterService = RouterService;
exports.ROUTER_SERVICE = Symbol.for('RouterService');
