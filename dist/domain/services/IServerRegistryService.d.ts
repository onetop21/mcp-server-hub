import { RegisteredServer, ServerConfig, ServerUpdate, ServerGroup, GroupConfig } from '../models';
export interface IServerRegistryService {
    /**
     * Register a new MCP server for a user
     */
    registerServer(userId: string, serverConfig: ServerConfig & {
        name: string;
        namespace?: string;
    }): Promise<RegisteredServer>;
    /**
     * Update an existing server configuration
     */
    updateServer(serverId: string, updates: ServerUpdate): Promise<RegisteredServer>;
    /**
     * Delete a server
     */
    deleteServer(serverId: string): Promise<void>;
    /**
     * Create a new server group
     */
    createGroup(userId: string, groupConfig: GroupConfig): Promise<ServerGroup>;
    /**
     * Assign a server to a group
     */
    assignServerToGroup(serverId: string, groupId: string): Promise<void>;
    /**
     * Remove a server from a group
     */
    removeServerFromGroup(serverId: string, groupId: string): Promise<void>;
    /**
     * Get all servers for a user
     */
    getServersByUser(userId: string): Promise<RegisteredServer[]>;
    /**
     * Get all servers in a group
     */
    getServersByGroup(groupId: string): Promise<RegisteredServer[]>;
    /**
     * Get server by ID
     */
    getServerById(serverId: string): Promise<RegisteredServer | null>;
    /**
     * Get all groups for a user
     */
    getGroupsByUser(userId: string): Promise<ServerGroup[]>;
    /**
     * Get group by ID
     */
    getGroupById(groupId: string): Promise<ServerGroup | null>;
}
//# sourceMappingURL=IServerRegistryService.d.ts.map