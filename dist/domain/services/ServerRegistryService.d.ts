import { RegisteredServer, ServerConfig, ServerUpdate } from '../models/Server';
import { ServerGroup, GroupConfig } from '../models/Endpoint';
export interface ServerRegistryService {
    registerServer(userId: string, serverConfig: ServerConfig & {
        name: string;
        protocol: string;
    }): Promise<RegisteredServer>;
    updateServer(serverId: string, updates: ServerUpdate): Promise<RegisteredServer>;
    deleteServer(serverId: string): Promise<void>;
    createGroup(userId: string, groupConfig: GroupConfig): Promise<ServerGroup>;
    assignServerToGroup(serverId: string, groupId: string): Promise<void>;
    getServersByUser(userId: string): Promise<RegisteredServer[]>;
    getServersByGroup(groupId: string): Promise<RegisteredServer[]>;
}
export declare const SERVER_REGISTRY_SERVICE: unique symbol;
//# sourceMappingURL=ServerRegistryService.d.ts.map