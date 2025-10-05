import { Router } from 'express';
import { DIContainer } from '../../di/container';
import { ServerController } from '../controllers/ServerController';
import { authMiddleware } from '../middleware/auth';

/**
 * Server Management Routes
 * 
 * All endpoints require authentication
 * 
 * - POST / - Register new server
 * - GET / - List my servers
 * - GET /:serverId - Get server details
 * - PUT /:serverId - Update server
 * - DELETE /:serverId - Delete server
 * - GET /:serverId/health - Get server health
 * - GET /:serverId/tools - Get server tools
 * - POST /from-marketplace - Register from marketplace template
 */
export function serverRoutes(container: DIContainer): Router {
  const router = Router();
  const controller = new ServerController(container);
  
  // All routes require authentication
  router.use(authMiddleware(container));

  // CRUD operations
  router.post('/', controller.registerServer.bind(controller));
  router.get('/', controller.listServers.bind(controller));
  router.get('/:serverId', controller.getServer.bind(controller));
  router.put('/:serverId', controller.updateServer.bind(controller));
  router.delete('/:serverId', controller.deleteServer.bind(controller));

  // Health and tools
  router.get('/:serverId/health', controller.getServerHealth.bind(controller));
  router.get('/:serverId/tools', controller.getServerTools.bind(controller));

  // Marketplace integration
  router.post('/from-marketplace', controller.registerFromMarketplace.bind(controller));

  return router;
}
