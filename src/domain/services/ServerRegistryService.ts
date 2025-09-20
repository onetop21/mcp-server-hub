import { 
  RegisteredServer, 
  ServerConfig, 
  ServerUpdate, 
  ServerProtocol, 
  ServerStatus,
  StdioConfig,
  SseConfig,
  HttpConfig
} from '../models/Server';
import { ServerGroup, GroupConfig } from '../models/Endpoint';
import { IServerRegistryService } from './IServerRegistryService';
import { ServerRepository } from '../../infrastructure/repositories/ServerRepository';
import { ServerGroupRepository } from '../../infrastructure/repositories/ServerGroupRepository';

/**
 * Server configuration validation errors
 */
export class ServerConfigValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ServerConfigValidationError';
  }
}

/**
 * Server registration service implementation
 */
export class ServerRegistryService implements IServerRegistryService {
  constructor(
    private serverRepository: ServerRepository,
    private serverGroupRepository: ServerGroupRepository
  ) {}

  /**
   * Register a new MCP server for a user
   */
  async registerServer(
    userId: string, 
    serverConfig: ServerConfig & { name: string; namespace?: string; protocol: ServerProtocol }
  ): Promise<RegisteredServer> {
    // Validate server configuration
    this.validateServerConfig(serverConfig);

    // Check if server name already exists for this user
    const existingServer = await this.serverRepository.findByUserIdAndName(userId, serverConfig.name);
    if (existingServer) {
      throw new ServerConfigValidationError(`Server with name '${serverConfig.name}' already exists for this user`, 'name');
    }

    // Create server data
    const serverData: Omit<RegisteredServer, 'id' | 'createdAt' | 'updatedAt'> = {
      userId,
      name: serverConfig.name,
      protocol: serverConfig.protocol,
      config: {
        stdio: serverConfig.stdio,
        sse: serverConfig.sse,
        http: serverConfig.http,
      },
      namespace: serverConfig.namespace,
      status: ServerStatus.INACTIVE, // Start as inactive until health check passes
      lastHealthCheck: new Date(),
    };

    return await this.serverRepository.createServer(serverData);
  }

  /**
   * Update an existing server configuration
   */
  async updateServer(serverId: string, updates: ServerUpdate): Promise<RegisteredServer> {
    // Get existing server
    const existingServer = await this.serverRepository.findServerById(serverId);
    if (!existingServer) {
      throw new Error(`Server with ID '${serverId}' not found`);
    }

    // Validate name uniqueness if name is being updated
    if (updates.name && updates.name !== existingServer.name) {
      const nameExists = await this.serverRepository.nameExistsForUser(
        existingServer.userId, 
        updates.name, 
        serverId
      );
      if (nameExists) {
        throw new ServerConfigValidationError(`Server with name '${updates.name}' already exists for this user`, 'name');
      }
    }

    // Validate config if being updated
    if (updates.config) {
      // Merge the configs properly
      const mergedConfig: ServerConfig = {
        stdio: updates.config.stdio ? { ...existingServer.config.stdio, ...updates.config.stdio } : existingServer.config.stdio,
        sse: updates.config.sse ? { ...existingServer.config.sse, ...updates.config.sse } : existingServer.config.sse,
        http: updates.config.http ? { ...existingServer.config.http, ...updates.config.http } : existingServer.config.http,
      };
      
      this.validateServerConfig({ 
        ...mergedConfig, 
        name: updates.name || existingServer.name,
        protocol: existingServer.protocol 
      });
    }

    // Prepare update data with proper config merging
    const updateData: Partial<RegisteredServer> = {
      name: updates.name,
      namespace: updates.namespace,
      status: updates.status,
      updatedAt: new Date(),
    };

    // Handle config updates properly
    if (updates.config) {
      const mergedConfig: ServerConfig = {
        stdio: updates.config.stdio ? { ...existingServer.config.stdio, ...updates.config.stdio } : existingServer.config.stdio,
        sse: updates.config.sse ? { ...existingServer.config.sse, ...updates.config.sse } : existingServer.config.sse,
        http: updates.config.http ? { ...existingServer.config.http, ...updates.config.http } : existingServer.config.http,
      };
      updateData.config = mergedConfig;
    }

    // Update server
    const updatedServer = await this.serverRepository.updateServer(serverId, updateData);

    if (!updatedServer) {
      throw new Error(`Failed to update server with ID '${serverId}'`);
    }

    return updatedServer;
  }

  /**
   * Delete a server
   */
  async deleteServer(serverId: string): Promise<void> {
    const server = await this.serverRepository.findServerById(serverId);
    if (!server) {
      throw new Error(`Server with ID '${serverId}' not found`);
    }

    await this.serverRepository.delete(serverId);
  }

  /**
   * Create a new server group
   */
  async createGroup(userId: string, groupConfig: GroupConfig): Promise<ServerGroup> {
    // Validate group configuration
    this.validateGroupConfig(groupConfig);

    // Check if group name already exists for this user
    const existingGroup = await this.serverGroupRepository.findByUserIdAndName(userId, groupConfig.name);
    if (existingGroup) {
      throw new ServerConfigValidationError(`Group with name '${groupConfig.name}' already exists for this user`, 'name');
    }

    // Validate server IDs if provided
    if (groupConfig.serverIds && groupConfig.serverIds.length > 0) {
      await this.validateServerIds(userId, groupConfig.serverIds);
    }

    return await this.serverGroupRepository.createGroup(userId, groupConfig);
  }

  /**
   * Assign a server to a group
   */
  async assignServerToGroup(serverId: string, groupId: string): Promise<void> {
    // Validate server exists
    const server = await this.serverRepository.findServerById(serverId);
    if (!server) {
      throw new Error(`Server with ID '${serverId}' not found`);
    }

    // Validate group exists and belongs to same user
    const group = await this.serverGroupRepository.findGroupById(groupId);
    if (!group) {
      throw new Error(`Group with ID '${groupId}' not found`);
    }

    if (server.userId !== group.userId) {
      throw new Error('Server and group must belong to the same user');
    }

    await this.serverGroupRepository.addServerToGroup(serverId, groupId);
  }

  /**
   * Remove a server from a group
   */
  async removeServerFromGroup(serverId: string, groupId: string): Promise<void> {
    // Validate server exists
    const server = await this.serverRepository.findServerById(serverId);
    if (!server) {
      throw new Error(`Server with ID '${serverId}' not found`);
    }

    // Validate group exists
    const group = await this.serverGroupRepository.findGroupById(groupId);
    if (!group) {
      throw new Error(`Group with ID '${groupId}' not found`);
    }

    await this.serverGroupRepository.removeServerFromGroup(serverId, groupId);
  }

  /**
   * Get all servers for a user
   */
  async getServersByUser(userId: string): Promise<RegisteredServer[]> {
    return await this.serverRepository.findByUserId(userId);
  }

  /**
   * Get all servers in a group
   */
  async getServersByGroup(groupId: string): Promise<RegisteredServer[]> {
    const group = await this.serverGroupRepository.findGroupById(groupId);
    if (!group) {
      throw new Error(`Group with ID '${groupId}' not found`);
    }

    const servers: RegisteredServer[] = [];
    for (const serverId of group.serverIds) {
      const server = await this.serverRepository.findServerById(serverId);
      if (server) {
        servers.push(server);
      }
    }

    return servers;
  }

  /**
   * Get server by ID
   */
  async getServerById(serverId: string): Promise<RegisteredServer | null> {
    return await this.serverRepository.findServerById(serverId);
  }

  /**
   * Get all groups for a user
   */
  async getGroupsByUser(userId: string): Promise<ServerGroup[]> {
    return await this.serverGroupRepository.findByUserId(userId);
  }

  /**
   * Get group by ID
   */
  async getGroupById(groupId: string): Promise<ServerGroup | null> {
    return await this.serverGroupRepository.findGroupById(groupId);
  }

  /**
   * Validate server configuration based on protocol
   */
  private validateServerConfig(config: ServerConfig & { name: string; protocol: ServerProtocol }): void {
    // Validate name
    if (!config.name || config.name.trim().length === 0) {
      throw new ServerConfigValidationError('Server name is required', 'name');
    }

    if (config.name.length > 100) {
      throw new ServerConfigValidationError('Server name must be 100 characters or less', 'name');
    }

    // Validate protocol-specific configuration
    switch (config.protocol) {
      case ServerProtocol.STDIO:
        this.validateStdioConfig(config.stdio);
        break;
      case ServerProtocol.SSE:
        this.validateSseConfig(config.sse);
        break;
      case ServerProtocol.HTTP:
        this.validateHttpConfig(config.http);
        break;
      default:
        throw new ServerConfigValidationError(`Unsupported protocol: ${config.protocol}`, 'protocol');
    }
  }

  /**
   * Validate STDIO configuration
   */
  private validateStdioConfig(config?: StdioConfig): void {
    if (!config) {
      throw new ServerConfigValidationError('STDIO configuration is required for STDIO protocol', 'config.stdio');
    }

    if (!config.command || config.command.trim().length === 0) {
      throw new ServerConfigValidationError('STDIO command is required', 'config.stdio.command');
    }

    if (!Array.isArray(config.args)) {
      throw new ServerConfigValidationError('STDIO args must be an array', 'config.stdio.args');
    }

    if (config.env !== undefined && typeof config.env !== 'object') {
      throw new ServerConfigValidationError('STDIO env must be an object', 'config.stdio.env');
    }
  }

  /**
   * Validate SSE configuration
   */
  private validateSseConfig(config?: SseConfig): void {
    if (!config) {
      throw new ServerConfigValidationError('SSE configuration is required for SSE protocol', 'config.sse');
    }

    if (!config.url || config.url.trim().length === 0) {
      throw new ServerConfigValidationError('SSE URL is required', 'config.sse.url');
    }

    // Validate URL format
    try {
      new URL(config.url);
    } catch (error) {
      throw new ServerConfigValidationError('SSE URL must be a valid URL', 'config.sse.url');
    }

    if (config.headers !== undefined && typeof config.headers !== 'object') {
      throw new ServerConfigValidationError('SSE headers must be an object', 'config.sse.headers');
    }
  }

  /**
   * Validate HTTP configuration
   */
  private validateHttpConfig(config?: HttpConfig): void {
    if (!config) {
      throw new ServerConfigValidationError('HTTP configuration is required for HTTP protocol', 'config.http');
    }

    if (!config.baseUrl || config.baseUrl.trim().length === 0) {
      throw new ServerConfigValidationError('HTTP base URL is required', 'config.http.baseUrl');
    }

    // Validate URL format
    try {
      new URL(config.baseUrl);
    } catch (error) {
      throw new ServerConfigValidationError('HTTP base URL must be a valid URL', 'config.http.baseUrl');
    }

    if (config.headers !== undefined && typeof config.headers !== 'object') {
      throw new ServerConfigValidationError('HTTP headers must be an object', 'config.http.headers');
    }
  }

  /**
   * Validate group configuration
   */
  private validateGroupConfig(config: GroupConfig): void {
    if (!config.name || config.name.trim().length === 0) {
      throw new ServerConfigValidationError('Group name is required', 'name');
    }

    if (config.name.length > 100) {
      throw new ServerConfigValidationError('Group name must be 100 characters or less', 'name');
    }

    if (config.description && config.description.length > 500) {
      throw new ServerConfigValidationError('Group description must be 500 characters or less', 'description');
    }

    if (config.serverIds && !Array.isArray(config.serverIds)) {
      throw new ServerConfigValidationError('Server IDs must be an array', 'serverIds');
    }
  }

  /**
   * Validate server IDs belong to user
   */
  private async validateServerIds(userId: string, serverIds: string[]): Promise<void> {
    for (const serverId of serverIds) {
      const server = await this.serverRepository.findServerById(serverId);
      if (!server) {
        throw new ServerConfigValidationError(`Server with ID '${serverId}' not found`, 'serverIds');
      }
      if (server.userId !== userId) {
        throw new ServerConfigValidationError(`Server with ID '${serverId}' does not belong to user`, 'serverIds');
      }
    }
  }
}

export const SERVER_REGISTRY_SERVICE = Symbol.for('ServerRegistryService');