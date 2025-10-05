"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpRoutes = void 0;
const express_1 = require("express");
const MCPController_1 = require("../controllers/MCPController");
const auth_1 = require("../middleware/auth");
/**
 * MCP Protocol Routes
 *
 * Endpoints:
 * - GET /:endpointId/tools - Get available tools
 * - POST /:endpointId/tools/call - Call a tool
 * - GET /:endpointId/sse - SSE connection (real-time)
 * - POST /:endpointId/stream - HTTP streaming
 */
function mcpRoutes(container) {
    const router = (0, express_1.Router)();
    const controller = new MCPController_1.MCPController(container);
    // Tool management (requires auth)
    router.get('/:endpointId/tools', (0, auth_1.authMiddleware)(container), controller.getTools.bind(controller));
    router.post('/:endpointId/tools/call', (0, auth_1.authMiddleware)(container), controller.callTool.bind(controller));
    // Streaming endpoints (SSE doesn't use standard auth, uses query param or custom header)
    router.get('/:endpointId/sse', controller.handleSSE.bind(controller));
    router.post('/:endpointId/stream', controller.handleStream.bind(controller));
    return router;
}
exports.mcpRoutes = mcpRoutes;
