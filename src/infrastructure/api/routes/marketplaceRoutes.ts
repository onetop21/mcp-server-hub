import { Router } from 'express';
import { DIContainer } from '../../di/container';
import { MarketplaceController } from '../controllers/MarketplaceController';
import { authMiddleware } from '../middleware/auth';

/**
 * Marketplace Routes
 * 
 * Public endpoints:
 * - GET / - List marketplace servers
 * - GET /:marketplaceId - Get marketplace server details
 * 
 * User endpoints (require auth):
 * - POST /:marketplaceId/install - Install from marketplace
 * 
 * Admin endpoints (require auth):
 * - POST / - Register marketplace server
 * - PUT /:marketplaceId - Update marketplace server
 * - DELETE /:marketplaceId - Delete marketplace server
 */
export function marketplaceRoutes(container: DIContainer): Router {
  const router = Router();
  const controller = new MarketplaceController(container);

  // Public routes
  router.get('/', controller.listMarketplace.bind(controller));
  router.get('/:marketplaceId', controller.getMarketplaceServer.bind(controller));

  // User routes (authenticated)
  router.post('/:marketplaceId/install', authMiddleware(container), controller.installFromMarketplace.bind(controller));

  // Admin routes (authenticated)
  router.post('/', authMiddleware(container), controller.registerMarketplace.bind(controller));
  router.put('/:marketplaceId', authMiddleware(container), controller.updateMarketplace.bind(controller));
  router.delete('/:marketplaceId', authMiddleware(container), controller.deleteMarketplace.bind(controller));

  return router;
}

