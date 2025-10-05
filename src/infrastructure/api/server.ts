import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { DIContainer } from '../di/container';

// Routes
import { userRoutes } from './routes/userRoutes';
import { serverRoutes } from './routes/serverRoutes';
import { groupRoutes } from './routes/groupRoutes';
import { endpointRoutes } from './routes/endpointRoutes';
import { marketplaceRoutes } from './routes/marketplaceRoutes';
import { mcpRoutes } from './routes/mcpRoutes';

/**
 * MCP Hub Router REST API Server
 * 
 * ARCHITECTURE: Simple Express Server
 * ====================================
 * 
 * Design principles:
 * - Keep it simple - no complex middleware stacks
 * - Stateless - no sessions, API key only
 * - RESTful - standard HTTP methods and status codes
 * - Secure - helmet, cors, API key authentication
 * 
 * Routes:
 * - /api/users       - User management
 * - /api/servers     - Server registry
 * - /api/groups      - Server groups
 * - /api/endpoints   - Endpoint management
 * - /api/marketplace - Marketplace
 * - /mcp/:endpointId - MCP protocol endpoints
 */
export class APIServer {
  private app: Express;
  private container: DIContainer;
  private port: number;

  constructor(container: DIContainer, port: number = 3000) {
    this.app = express();
    this.container = container;
    this.port = port;

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security
    this.app.use(helmet());
    
    // CORS - allow all origins for now (can be restricted later)
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    }));

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging (only in development)
    if (process.env.NODE_ENV !== 'production') {
      this.app.use(morgan('dev'));
    }

    // Health check endpoint (no auth required)
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // API v1 routes
    this.app.use('/api/users', userRoutes(this.container));
    this.app.use('/api/servers', serverRoutes(this.container));
    this.app.use('/api/groups', groupRoutes(this.container));
    this.app.use('/api/endpoints', endpointRoutes(this.container));
    this.app.use('/api/marketplace', marketplaceRoutes(this.container));
    
    // MCP protocol endpoints
    this.app.use('/mcp', mcpRoutes(this.container));

    // API documentation
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        name: 'MCP Hub Router API',
        version: '1.0.0',
        documentation: '/docs/API-Design.md',
        endpoints: {
          users: '/api/users',
          servers: '/api/servers',
          groups: '/api/groups',
          endpoints: '/api/endpoints',
          marketplace: '/api/marketplace',
          mcp: '/mcp/:endpointId'
        }
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
          path: req.path
        }
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('API Error:', err);

      // Default error response
      const statusCode = (err as any).statusCode || 500;
      const errorResponse = {
        error: {
          code: (err as any).code || 'INTERNAL_ERROR',
          message: err.message || 'An unexpected error occurred',
          ...(process.env.NODE_ENV !== 'production' && {
            stack: err.stack
          })
        }
      };

      res.status(statusCode).json(errorResponse);
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Initialize DI container
    await this.container.initialize();

    // Start Express server
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        console.log(`✅ MCP Hub Router API running on http://localhost:${this.port}`);
        console.log(`📖 API docs: http://localhost:${this.port}/api`);
        console.log(`❤️  Health check: http://localhost:${this.port}/health`);
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    await this.container.cleanup();
    console.log('Server stopped');
  }

  /**
   * Get Express app (for testing)
   */
  getApp(): Express {
    return this.app;
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const container = DIContainer.getInstance();
  const port = parseInt(process.env.PORT || '3000', 10);
  const server = new APIServer(container, port);

  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });
}

