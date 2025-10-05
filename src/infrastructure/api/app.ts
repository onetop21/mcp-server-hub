import express, { Express, Request, Response, NextFunction } from 'express';
import { DIContainer } from '../di/container';
import { userRoutes } from './routes/userRoutes';
import { serverRoutes } from './routes/serverRoutes';
import { marketplaceRoutes } from './routes/marketplaceRoutes';
import { groupRoutes } from './routes/groupRoutes';
import { endpointRoutes } from './routes/endpointRoutes';
import { mcpRoutes } from './routes/mcpRoutes';
import { healthRoutes } from './routes/healthRoutes';

/**
 * Create Express Application
 * 
 * Sets up all routes and middleware
 */
export function createApp(container: DIContainer): Express {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS (allow all origins for now)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    
    next();
  });

  // Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });

  // Health check routes (no /api prefix)
  app.use('/', healthRoutes(container));

  // API routes
  app.use('/api/users', userRoutes(container));
  app.use('/api/servers', serverRoutes(container));
  app.use('/api/marketplace', marketplaceRoutes(container));
  app.use('/api/groups', groupRoutes(container));
  app.use('/api/endpoints', endpointRoutes(container));
  app.use('/api/mcp', mcpRoutes(container));

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`
      }
    });
  });

  // Error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  });

  return app;
}

