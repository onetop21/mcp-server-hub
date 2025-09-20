import { Response } from 'express';
import { ServerRegistryService, ServerConfigValidationError } from '../../../domain/services/ServerRegistryService';
import { ServerProtocol, ServerStatus } from '../../../domain/models/Server';
import { container } from '../../di/container';
import { TYPES } from '../../di/types';
import { AuthenticatedRequest } from '../types';

/**
 * Request/Response types for server API
 */
export interface RegisterServerRequest {
  name: string;
  protocol: ServerProtocol;
  config: {
    stdio?: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    };
    sse?: {
      url: string;
      headers?: Record<string, string>;
    };
    http?: {
      baseUrl: string;
      headers?: Record<string, string>;
    };
  };
  namespace?: string;
}

export interface UpdateServerRequest {
  name?: string;
  config?: {
    stdio?: {
      command?: string;
      args?: string[];
      env?: Record<string, string>;
    };
    sse?: {
      url?: string;
      headers?: Record<string, string>;
    };
    http?: {
      baseUrl?: string;
      headers?: Record<string, string>;
    };
  };
  namespace?: string;
  status?: ServerStatus;
}

export interface ServerResponse {
  id: string;
  name: string;
  protocol: ServerProtocol;
  config: any;
  namespace?: string;
  status: ServerStatus;
  lastHealthCheck: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Server management REST API controller
 */
export class ServerController {
  private serverRegistryService: ServerRegistryService;

  constructor() {
    this.serverRegistryService = container.get<ServerRegistryService>(TYPES.ServerRegistryService);
  }

  /**
   * Register a new MCP server
   * POST /api/servers
   */
  public registerServer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id; // Assuming auth middleware sets req.user
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const serverData: RegisterServerRequest = req.body;

      // Validate required fields
      if (!serverData.name || !serverData.protocol || !serverData.config) {
        res.status(400).json({ 
          error: 'Missing required fields: name, protocol, and config are required' 
        });
        return;
      }

      const registeredServer = await this.serverRegistryService.registerServer(userId, {
        name: serverData.name,
        protocol: serverData.protocol,
        stdio: serverData.config.stdio,
        sse: serverData.config.sse,
        http: serverData.config.http,
        namespace: serverData.namespace,
      });

      const response: ServerResponse = {
        id: registeredServer.id,
        name: registeredServer.name,
        protocol: registeredServer.protocol,
        config: registeredServer.config,
        namespace: registeredServer.namespace,
        status: registeredServer.status,
        lastHealthCheck: registeredServer.lastHealthCheck.toISOString(),
        createdAt: registeredServer.createdAt.toISOString(),
        updatedAt: registeredServer.updatedAt.toISOString(),
      };

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof ServerConfigValidationError) {
        res.status(400).json({ 
          error: error.message,
          field: error.field 
        });
      } else {
        console.error('Error registering server:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };

  /**
   * Update an existing server
   * PUT /api/servers/:id
   */
  public updateServer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const serverId = req.params.id;
      const updates: UpdateServerRequest = req.body;

      const updatedServer = await this.serverRegistryService.updateServer(serverId, updates);

      const response: ServerResponse = {
        id: updatedServer.id,
        name: updatedServer.name,
        protocol: updatedServer.protocol,
        config: updatedServer.config,
        namespace: updatedServer.namespace,
        status: updatedServer.status,
        lastHealthCheck: updatedServer.lastHealthCheck.toISOString(),
        createdAt: updatedServer.createdAt.toISOString(),
        updatedAt: updatedServer.updatedAt.toISOString(),
      };

      res.json(response);
    } catch (error) {
      if (error instanceof ServerConfigValidationError) {
        res.status(400).json({ 
          error: error.message,
          field: error.field 
        });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        console.error('Error updating server:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };

  /**
   * Delete a server
   * DELETE /api/servers/:id
   */
  public deleteServer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const serverId = req.params.id;

      await this.serverRegistryService.deleteServer(serverId);

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        console.error('Error deleting server:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };

  /**
   * Get all servers for the authenticated user
   * GET /api/servers
   */
  public getServers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const servers = await this.serverRegistryService.getServersByUser(userId);

      const response: ServerResponse[] = servers.map(server => ({
        id: server.id,
        name: server.name,
        protocol: server.protocol,
        config: server.config,
        namespace: server.namespace,
        status: server.status,
        lastHealthCheck: server.lastHealthCheck.toISOString(),
        createdAt: server.createdAt.toISOString(),
        updatedAt: server.updatedAt.toISOString(),
      }));

      res.json(response);
    } catch (error) {
      console.error('Error getting servers:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Get a specific server by ID
   * GET /api/servers/:id
   */
  public getServer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const serverId = req.params.id;

      const server = await this.serverRegistryService.getServerById(serverId);

      if (!server) {
        res.status(404).json({ error: 'Server not found' });
        return;
      }

      const response: ServerResponse = {
        id: server.id,
        name: server.name,
        protocol: server.protocol,
        config: server.config,
        namespace: server.namespace,
        status: server.status,
        lastHealthCheck: server.lastHealthCheck.toISOString(),
        createdAt: server.createdAt.toISOString(),
        updatedAt: server.updatedAt.toISOString(),
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting server:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}