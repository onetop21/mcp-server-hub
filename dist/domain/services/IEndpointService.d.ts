import { Endpoint } from '../models';
export interface IEndpointService {
    /**
     * Create a new endpoint for a user (default endpoint with all servers)
     */
    createDefaultEndpoint(userId: string, apiKeyId: string): Promise<Endpoint>;
    /**
     * Create an endpoint for a specific group
     */
    createGroupEndpoint(userId: string, groupId: string, apiKeyId: string): Promise<Endpoint>;
    /**
     * Get endpoint by ID
     */
    getEndpointById(endpointId: string): Promise<Endpoint | null>;
    /**
     * Get all endpoints for a user
     */
    getEndpointsByUser(userId: string): Promise<Endpoint[]>;
    /**
     * Delete an endpoint
     */
    deleteEndpoint(endpointId: string): Promise<void>;
    /**
     * Update endpoint last accessed time
     */
    updateLastAccessed(endpointId: string): Promise<void>;
    /**
     * Validate endpoint access with API key
     */
    validateEndpointAccess(endpointId: string, apiKey: string): Promise<boolean>;
}
//# sourceMappingURL=IEndpointService.d.ts.map