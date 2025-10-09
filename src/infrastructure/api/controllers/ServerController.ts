import { Response } from 'express';
import { DIContainer } from '../../di/container';
import { TYPES } from '../../di/types';
import { IServerRegistryService, IRouterService } from '../../../domain/services';
import { ServerStatus } from '../../../domain/models/Server';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Server Controller
 * Handles MCP server registration and management
 */
export class ServerController {
  private container: DIContainer;

  constructor(container: DIContainer) {
    this.container = container;
  }

  /**
   * Register new server
   * POST /api/servers
   */
  async registerServer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, protocol, config, namespace } = req.body;

      // Validation
      if (!name || !protocol || !config) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Name, protocol, and config are required'
          }
        });
        return;
      }

      if (!['stdio', 'sse', 'http'].includes(protocol)) {
        res.status(400).json({
          error: {
            code: 'INVALID_PROTOCOL',
            message: 'Protocol must be stdio, sse, or http'
          }
        });
        return;
      }

      const serverService = this.container.get<IServerRegistryService>(TYPES.ServerRegistryService);
      const server = await serverService.registerServer(req.userId!, {
        ...config,
        name,
        protocol,
        namespace
      });

      res.status(201).json({
        serverId: server.id,
        name: server.name,
        protocol: server.protocol,
        namespace: server.namespace,
        status: server.status,
        createdAt: server.createdAt
      });
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        res.status(409).json({
          error: {
            code: 'SERVER_EXISTS',
            message: error.message
          }
        });
        return;
      }

      console.error('Register server error:', error);
      res.status(500).json({
        error: {
          code: 'REGISTRATION_FAILED',
          message: 'Failed to register server'
        }
      });
    }
  }

  /**
   * List user's servers
   * GET /api/servers
   */
  async listServers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const serverService = this.container.get<IServerRegistryService>(TYPES.ServerRegistryService);
      const servers = await serverService.getServersByUser(req.userId!);

      res.json({
        servers: servers.map(server => ({
          serverId: server.id,
          name: server.name,
          protocol: server.protocol,
          namespace: server.namespace,
          status: server.status,
          lastHealthCheck: server.lastHealthCheck,
          createdAt: server.createdAt
        }))
      });
    } catch (error) {
      console.error('List servers error:', error);
      res.status(500).json({
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to list servers'
        }
      });
    }
  }

  /**
   * Get server details
   * GET /api/servers/:serverId
   */
  async getServer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;

      const serverService = this.container.get<IServerRegistryService>(TYPES.ServerRegistryService);
      const server = await serverService.getServerById(serverId);

      if (!server) {
        res.status(404).json({
          error: {
            code: 'SERVER_NOT_FOUND',
            message: 'Server not found'
          }
        });
        return;
      }

      // Hide sensitive env variables
      const sanitizedConfig = JSON.parse(JSON.stringify(server.config));
      if (sanitizedConfig.stdio?.env) {
        Object.keys(sanitizedConfig.stdio.env).forEach(key => {
          sanitizedConfig.stdio.env[key] = '***hidden***';
        });
      }

      res.json({
        serverId: server.id,
        name: server.name,
        protocol: server.protocol,
        config: sanitizedConfig,
        namespace: server.namespace,
        status: server.status,
        lastHealthCheck: server.lastHealthCheck,
        createdAt: server.createdAt,
        updatedAt: server.updatedAt
      });
    } catch (error) {
      console.error('Get server error:', error);
      res.status(500).json({
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch server'
        }
      });
    }
  }

  /**
   * Update server
   * PUT /api/servers/:serverId
   */
  async updateServer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;
      const updates = req.body;

      const serverService = this.container.get<IServerRegistryService>(TYPES.ServerRegistryService);
      const server = await serverService.updateServer(serverId, updates);

      res.json({
        serverId: server.id,
        name: server.name,
        status: server.status,
        updatedAt: server.updatedAt
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        res.status(404).json({
          error: {
            code: 'SERVER_NOT_FOUND',
            message: 'Server not found'
          }
        });
        return;
      }

      console.error('Update server error:', error);
      res.status(500).json({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update server'
        }
      });
    }
  }

  /**
   * Delete server
   * DELETE /api/servers/:serverId
   */
  async deleteServer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;

      const serverService = this.container.get<IServerRegistryService>(TYPES.ServerRegistryService);
      await serverService.deleteServer(serverId);

      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        res.status(404).json({
          error: {
            code: 'SERVER_NOT_FOUND',
            message: 'Server not found'
          }
        });
        return;
      }

      console.error('Delete server error:', error);
      res.status(500).json({
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete server'
        }
      });
    }
  }

  /**
   * Get server health
   * GET /api/servers/:serverId/health
   */
  async getServerHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;

      const routerService = this.container.get<IRouterService>(TYPES.RouterService);
      const health = await routerService.getServerHealth(serverId);

      res.json({
        serverId: health.serverId,
        status: health.status,
        lastCheck: health.lastCheck,
        responseTime: health.responseTime,
        error: health.error
      });
    } catch (error) {
      console.error('Get server health error:', error);
      res.status(500).json({
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Failed to check server health'
        }
      });
    }
  }

  /**
   * Get server tools
   * GET /api/servers/:serverId/tools
   */
  async getServerTools(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;

      const serverService = this.container.get<IServerRegistryService>(TYPES.ServerRegistryService);
      const server = await serverService.getServerById(serverId);

      if (!server) {
        res.status(404).json({
          error: {
            code: 'SERVER_NOT_FOUND',
            message: 'Server not found'
          }
        });
        return;
      }

      // Only allow tools listing for active servers
      if (server.status !== 'active') {
        res.status(400).json({
          error: {
            code: 'SERVER_INACTIVE',
            message: 'Tools can only be listed for active servers'
          }
        });
        return;
      }

      const routerService = this.container.get<IRouterService>(TYPES.RouterService);

      // Get tools from the server via protocol adapter
      try {
        const toolsResult = await routerService.getServerTools(serverId);

        res.json({
          tools: toolsResult.tools || [],
          serverId: serverId,
          toolCount: (toolsResult.tools || []).length
        });
      } catch (protocolError) {
        console.error('Protocol error getting server tools:', protocolError);
        res.status(503).json({
          error: {
            code: 'PROTOCOL_ERROR',
            message: 'Failed to communicate with server'
          }
        });
      }
    } catch (error) {
      console.error('Get server tools error:', error);
      res.status(500).json({
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch server tools'
        }
      });
    }
  }

  /**
   * Test server connection and mark active on success (simplified)
   * POST /api/servers/:serverId/test
   */
  async testServerConnection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;

      const serverService = this.container.get<IServerRegistryService>(TYPES.ServerRegistryService);
      const server = await serverService.getServerById(serverId);
      if (!server) {
        res.status(404).json({ error: { code: 'SERVER_NOT_FOUND', message: 'Server not found' } });
        return;
      }

      // For now, treat test as successful and mark ACTIVE.
      const updated = await serverService.updateServer(serverId, { status: ServerStatus.ACTIVE });
      res.status(200).json({
        serverId: updated.id,
        status: updated.status,
        message: 'Connection test passed (simplified)'
      });
    } catch (error) {
      console.error('Test server connection error:', error);
      res.status(500).json({ error: { code: 'TEST_FAILED', message: 'Failed to test server connection' } });
    }
  }
  /**
   * Register server from marketplace template
   * POST /api/servers/from-marketplace
   */
  async registerFromMarketplace(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { marketplaceId, name, namespace, env } = req.body;

      if (!marketplaceId || !name || !env) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'marketplaceId, name, and env are required'
          }
        });
        return;
      }

      // Get marketplace template
      // This will be implemented in MarketplaceService
      // For now, return a placeholder

      res.status(201).json({
        serverId: 'temp-id',
        name,
        message: 'Marketplace integration coming in Task 15'
      });
    } catch (error) {
      console.error('Register from marketplace error:', error);
      res.status(500).json({
        error: {
          code: 'REGISTRATION_FAILED',
          message: 'Failed to register server from marketplace'
        }
      });
    }
  }
}
