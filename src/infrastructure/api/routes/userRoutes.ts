import { Router } from 'express';
import { DIContainer } from '../../di/container';
import { UserController } from '../controllers/UserController';
import { authMiddleware } from '../middleware/auth';

/**
 * User Management Routes
 * 
 * Public endpoints:
 * - POST /register - Create new user
 * - POST /login - User login
 * 
 * Protected endpoints (require API key):
 * - GET /me - Get current user info
 * - POST /api-keys - Generate new API key
 * - GET /api-keys - List API keys
 * - DELETE /api-keys/:keyId - Revoke API key
 */
export function userRoutes(container: DIContainer): Router {
  const router = Router();
  const controller = new UserController(container);

  // Public routes
  router.post('/register', controller.register.bind(controller));
  router.post('/login', controller.login.bind(controller));

  // Protected routes
  router.get('/me', authMiddleware(container), controller.getCurrentUser.bind(controller));
  router.post('/api-keys', authMiddleware(container), controller.generateApiKey.bind(controller));
  router.get('/api-keys', authMiddleware(container), controller.listApiKeys.bind(controller));
  router.delete('/api-keys/:keyId', authMiddleware(container), controller.revokeApiKey.bind(controller));

  return router;
}

