import { Response } from 'express';
import { DIContainer } from '../../di/container';
import { TYPES } from '../../di/types';
import { IMarketplaceService } from '../../../domain/services/IMarketplaceService';
import { IServerRegistryService } from '../../../domain/services';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Marketplace Controller
 * Handles marketplace server browsing and installation
 */
export class MarketplaceController {
  private container: DIContainer;

  constructor(container: DIContainer) {
    this.container = container;
  }

  /**
   * List marketplace servers
   * GET /api/marketplace
   */
  async listMarketplace(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;
      const search = req.query.search as string | undefined;

      const marketplaceService = this.container.get<IMarketplaceService>(TYPES.MarketplaceService);
      const servers = await marketplaceService.listMarketplaceServers(tags, search);

      res.json({
        servers: servers.map(server => ({
          id: server.id,
          name: server.name,
          description: server.description,
          protocol: server.protocol,
          tags: server.tags,
          installCount: server.installCount,
          rating: server.rating
        }))
      });
    } catch (error) {
      console.error('List marketplace error:', error);
      res.status(500).json({
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to list marketplace servers'
        }
      });
    }
  }

  /**
   * Get marketplace server details
   * GET /api/marketplace/:marketplaceId
   */
  async getMarketplaceServer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { marketplaceId } = req.params;

      const marketplaceService = this.container.get<IMarketplaceService>(TYPES.MarketplaceService);
      const server = await marketplaceService.getMarketplaceServer(marketplaceId);

      if (!server) {
        res.status(404).json({
          error: {
            code: 'SERVER_NOT_FOUND',
            message: 'Marketplace server not found'
          }
        });
        return;
      }

      res.json({
        id: server.id,
        name: server.name,
        description: server.description,
        longDescription: server.longDescription,
        protocol: server.protocol,
        command: server.command,
        args: server.args,
        requiredEnv: server.requiredEnv,
        optionalEnv: server.optionalEnv,
        envDescriptions: server.envDescriptions,
        tags: server.tags,
        installInstructions: server.installInstructions,
        documentation: server.documentation,
        installCount: server.installCount,
        rating: server.rating
      });
    } catch (error) {
      console.error('Get marketplace server error:', error);
      res.status(500).json({
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch marketplace server'
        }
      });
    }
  }

  /**
   * Install from marketplace
   * POST /api/marketplace/:marketplaceId/install
   */
  async installFromMarketplace(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { marketplaceId } = req.params;
      const { name, namespace, env } = req.body;

      if (!name || !env) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'name and env are required'
          }
        });
        return;
      }

      // Get marketplace template
      const marketplaceService = this.container.get<IMarketplaceService>(TYPES.MarketplaceService);
      const template = await marketplaceService.getMarketplaceServer(marketplaceId);

      if (!template) {
        res.status(404).json({
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: 'Marketplace server not found'
          }
        });
        return;
      }

      // Validate required env variables
      const missingEnv = template.requiredEnv.filter(key => !env[key]);
      if (missingEnv.length > 0) {
        res.status(400).json({
          error: {
            code: 'MISSING_ENV',
            message: `Missing required environment variables: ${missingEnv.join(', ')}`,
            missingEnv
          }
        });
        return;
      }

      // Create server from template
      const serverService = this.container.get<IServerRegistryService>(TYPES.ServerRegistryService);
      const server = await serverService.registerServer(req.userId!, {
        name,
        protocol: template.protocol,
        namespace,
        stdio: {
          command: template.command,
          args: template.args || [],
          env
        }
      });

      // Increment install count
      await marketplaceService.incrementInstallCount(marketplaceId);

      res.status(201).json({
        serverId: server.id,
        name: server.name,
        protocol: server.protocol,
        namespace: server.namespace,
        status: server.status,
        installedFrom: marketplaceId
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

      console.error('Install from marketplace error:', error);
      res.status(500).json({
        error: {
          code: 'INSTALL_FAILED',
          message: 'Failed to install server from marketplace'
        }
      });
    }
  }

  /**
   * Register marketplace server (admin only)
   * POST /api/marketplace
   */
  async registerMarketplace(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data = req.body;

      // Validation
      if (!data.id || !data.name || !data.protocol || !data.command) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'id, name, protocol, and command are required'
          }
        });
        return;
      }

      const marketplaceService = this.container.get<IMarketplaceService>(TYPES.MarketplaceService);
      const server = await marketplaceService.registerMarketplaceServer(req.userId!, data);

      res.status(201).json({
        id: server.id,
        name: server.name,
        description: server.description,
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

      console.error('Register marketplace error:', error);
      res.status(500).json({
        error: {
          code: 'REGISTRATION_FAILED',
          message: 'Failed to register marketplace server'
        }
      });
    }
  }

  /**
   * Update marketplace server (admin only)
   * PUT /api/marketplace/:marketplaceId
   */
  async updateMarketplace(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { marketplaceId } = req.params;
      const updates = req.body;

      const marketplaceService = this.container.get<IMarketplaceService>(TYPES.MarketplaceService);
      const server = await marketplaceService.updateMarketplaceServer(marketplaceId, req.userId!, updates);

      res.json({
        id: server.id,
        name: server.name,
        updatedAt: server.updatedAt
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        res.status(404).json({
          error: {
            code: 'SERVER_NOT_FOUND',
            message: error.message
          }
        });
        return;
      }

      console.error('Update marketplace error:', error);
      res.status(500).json({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update marketplace server'
        }
      });
    }
  }

  /**
   * Delete marketplace server (admin only)
   * DELETE /api/marketplace/:marketplaceId
   */
  async deleteMarketplace(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { marketplaceId } = req.params;

      const marketplaceService = this.container.get<IMarketplaceService>(TYPES.MarketplaceService);
      await marketplaceService.deleteMarketplaceServer(marketplaceId, req.userId!);

      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        res.status(404).json({
          error: {
            code: 'SERVER_NOT_FOUND',
            message: error.message
          }
        });
        return;
      }

      console.error('Delete marketplace error:', error);
      res.status(500).json({
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete marketplace server'
        }
      });
    }
  }
}

