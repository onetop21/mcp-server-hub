import { Router } from 'express';
import { DIContainer } from '../../di/container';
import { MCPController } from '../controllers/MCPController';
import { authMiddleware } from '../middleware/auth';

/**
 * MCP Protocol Routes
 * 
 * Endpoints:
 * - GET /:endpointId/tools - Get available tools
 * - POST /:endpointId/tools/call - Call a tool
 * - GET /:endpointId/sse - SSE connection (real-time)
 * - POST /:endpointId/stream - HTTP streaming
 */
export function mcpRoutes(container: DIContainer): Router {
  const router = Router();
  const controller = new MCPController(container);

  // Tool management (requires auth)
  router.get('/:endpointId/tools', authMiddleware(container), controller.getTools.bind(controller));
  router.post('/:endpointId/tools/call', authMiddleware(container), controller.callTool.bind(controller));

  // Streaming endpoints (SSE doesn't use standard auth, uses query param or custom header)
  router.get('/:endpointId/sse', controller.handleSSE.bind(controller));
  router.post('/:endpointId/stream', controller.handleStream.bind(controller));

  return router;
}

