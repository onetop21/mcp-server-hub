import { Router, Request, Response } from 'express';
import { DIContainer } from '../../di/container';

/**
 * Health Check Routes
 * 
 * - GET /health - System health check
 * - GET /health/ready - Readiness probe
 * - GET /health/live - Liveness probe
 */
export function healthRoutes(container: DIContainer): Router {
  const router = Router();

  /**
   * Basic health check
   */
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    });
  });

  /**
   * Kubernetes readiness probe
   */
  router.get('/health/ready', (req: Request, res: Response) => {
    // TODO: Check if all dependencies are ready (DB, Redis, etc)
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  });

  /**
   * Kubernetes liveness probe
   */
  router.get('/health/live', (req: Request, res: Response) => {
    res.json({
      status: 'alive',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}

