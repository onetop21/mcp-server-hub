"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPController = void 0;
const types_1 = require("../../di/types");
/**
 * MCP Protocol Controller
 * Handles MCP protocol endpoints for tool listing and calling
 */
class MCPController {
    constructor(container) {
        this.container = container;
    }
    /**
     * Get available tools from an endpoint
     * GET /api/mcp/:endpointId/tools
     */
    async getTools(req, res) {
        try {
            const { endpointId } = req.params;
            // Verify endpoint belongs to user
            const endpointService = this.container.get(types_1.TYPES.EndpointService);
            const endpoint = await endpointService.getEndpointById(endpointId);
            if (!endpoint) {
                res.status(404).json({
                    error: {
                        code: 'ENDPOINT_NOT_FOUND',
                        message: 'Endpoint not found'
                    }
                });
                return;
            }
            if (endpoint.userId !== req.userId) {
                res.status(403).json({
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Access denied to this endpoint'
                    }
                });
                return;
            }
            // Get tools from router service
            const routerService = this.container.get(types_1.TYPES.RouterService);
            const tools = await routerService.getAvailableTools(endpoint.groupId || endpoint.userId);
            res.json({
                tools: tools.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                    serverId: tool.serverId,
                    namespace: tool.namespace
                }))
            });
        }
        catch (error) {
            console.error('Get tools error:', error);
            res.status(500).json({
                error: {
                    code: 'FETCH_FAILED',
                    message: 'Failed to fetch tools',
                    details: error.message
                }
            });
        }
    }
    /**
     * Call a tool through an endpoint
     * POST /api/mcp/:endpointId/tools/call
     */
    async callTool(req, res) {
        try {
            const { endpointId } = req.params;
            const { name, arguments: args } = req.body;
            if (!name) {
                res.status(400).json({
                    error: {
                        code: 'INVALID_INPUT',
                        message: 'Tool name is required'
                    }
                });
                return;
            }
            // Verify endpoint belongs to user
            const endpointService = this.container.get(types_1.TYPES.EndpointService);
            const endpoint = await endpointService.getEndpointById(endpointId);
            if (!endpoint) {
                res.status(404).json({
                    error: {
                        code: 'ENDPOINT_NOT_FOUND',
                        message: 'Endpoint not found'
                    }
                });
                return;
            }
            if (endpoint.userId !== req.userId) {
                res.status(403).json({
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Access denied to this endpoint'
                    }
                });
                return;
            }
            // Route tool call
            const routerService = this.container.get(types_1.TYPES.RouterService);
            const result = await routerService.routeToolCall(endpoint.groupId || endpoint.userId, name, args || {});
            res.json({
                result: result.result,
                error: result.error
            });
        }
        catch (error) {
            console.error('Call tool error:', error);
            res.status(500).json({
                error: {
                    code: 'CALL_FAILED',
                    message: 'Failed to call tool',
                    details: error.message
                }
            });
        }
    }
    /**
     * SSE endpoint for real-time tool calls
     * GET /api/mcp/:endpointId/sse
     */
    async handleSSE(req, res) {
        const { endpointId } = req.params;
        try {
            // Set SSE headers
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no'); // Nginx
            // Send initial connection event
            res.write(`event: connected\n`);
            res.write(`data: ${JSON.stringify({ endpointId, timestamp: new Date().toISOString() })}\n\n`);
            // Keep-alive ping every 30 seconds
            const keepAlive = setInterval(() => {
                res.write(`:ping\n\n`);
            }, 30000);
            // Handle client disconnect
            req.on('close', () => {
                clearInterval(keepAlive);
                console.log(`SSE connection closed for endpoint ${endpointId}`);
            });
            // TODO: Implement actual MCP protocol message handling
            // For now, just keep the connection alive
        }
        catch (error) {
            console.error('SSE error:', error);
            res.status(500).json({
                error: {
                    code: 'SSE_FAILED',
                    message: 'Failed to establish SSE connection'
                }
            });
        }
    }
    /**
     * HTTP streaming endpoint
     * POST /api/mcp/:endpointId/stream
     */
    async handleStream(req, res) {
        try {
            const { endpointId } = req.params;
            const { method, params } = req.body;
            if (!method) {
                res.status(400).json({
                    error: {
                        code: 'INVALID_INPUT',
                        message: 'Method is required'
                    }
                });
                return;
            }
            // Set streaming headers
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Transfer-Encoding', 'chunked');
            // TODO: Implement actual MCP protocol streaming
            // For now, just return a simple response
            res.write(JSON.stringify({
                jsonrpc: '2.0',
                id: (params === null || params === void 0 ? void 0 : params.id) || 1,
                result: {
                    message: 'Streaming not yet implemented',
                    endpointId,
                    method
                }
            }));
            res.end();
        }
        catch (error) {
            console.error('Stream error:', error);
            res.status(500).json({
                error: {
                    code: 'STREAM_FAILED',
                    message: 'Failed to handle stream'
                }
            });
        }
    }
}
exports.MCPController = MCPController;
