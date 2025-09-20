import { Router } from 'express';
import { ServerController } from '../controllers/ServerController';

/**
 * Server management routes
 */
export function createServerRoutes(): Router {
  const router = Router();
  const serverController = new ServerController();

  // Server CRUD operations
  router.post('/', serverController.registerServer);
  router.get('/', serverController.getServers);
  router.get('/:id', serverController.getServer);
  router.put('/:id', serverController.updateServer);
  router.delete('/:id', serverController.deleteServer);

  return router;
}