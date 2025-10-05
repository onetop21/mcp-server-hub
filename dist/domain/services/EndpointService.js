"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENDPOINT_SERVICE = exports.EndpointService = exports.EndpointError = void 0;
/**
 * Endpoint generation and validation errors
 */
class EndpointError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'EndpointError';
    }
}
exports.EndpointError = EndpointError;
/**
 * Endpoint service implementation
 */
class EndpointService {
    constructor(endpointRepository, serverGroupRepository, apiKeyRepository, tokenGenerator, baseUrl = 'https://hub.mcp.local') {
        this.endpointRepository = endpointRepository;
        this.serverGroupRepository = serverGroupRepository;
        this.apiKeyRepository = apiKeyRepository;
        this.tokenGenerator = tokenGenerator;
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    }
    /**
     * Create a new endpoint for a user (default endpoint with all servers)
     */
    async createDefaultEndpoint(userId, apiKeyId) {
        // Validate API key belongs to user
        await this.validateApiKeyOwnership(userId, apiKeyId);
        // Check if default endpoint already exists
        const existingEndpoint = await this.endpointRepository.findDefaultEndpointByUserId(userId);
        if (existingEndpoint) {
            throw new EndpointError('Default endpoint already exists for this user', 'ENDPOINT_EXISTS');
        }
        // Generate unique endpoint URLs
        const endpointId = this.tokenGenerator.generateUuid();
        const baseEndpointUrl = `${this.baseUrl}/api/v1/endpoints/${endpointId}`;
        const endpointData = {
            userId,
            groupId: undefined,
            url: baseEndpointUrl,
            sseUrl: `${baseEndpointUrl}/sse`,
            httpUrl: `${baseEndpointUrl}/http`,
            apiKeyId,
        };
        // Ensure URLs are unique
        await this.ensureUrlsAreUnique(endpointData.url, endpointData.sseUrl, endpointData.httpUrl);
        return await this.endpointRepository.createEndpoint(endpointData);
    }
    /**
     * Create an endpoint for a specific group
     */
    async createGroupEndpoint(userId, groupId, apiKeyId) {
        // Validate API key belongs to user
        await this.validateApiKeyOwnership(userId, apiKeyId);
        // Validate group exists and belongs to user
        const group = await this.serverGroupRepository.findGroupById(groupId);
        if (!group) {
            throw new EndpointError('Server group not found', 'GROUP_NOT_FOUND');
        }
        if (group.userId !== userId) {
            throw new EndpointError('Server group does not belong to user', 'GROUP_ACCESS_DENIED');
        }
        // Check if endpoint already exists for this group
        const existingEndpoints = await this.endpointRepository.findByGroupId(groupId);
        if (existingEndpoints.length > 0) {
            throw new EndpointError('Endpoint already exists for this group', 'ENDPOINT_EXISTS');
        }
        // Generate unique endpoint URLs
        const endpointId = this.tokenGenerator.generateUuid();
        const baseEndpointUrl = `${this.baseUrl}/api/v1/endpoints/${endpointId}`;
        const endpointData = {
            userId,
            groupId,
            url: baseEndpointUrl,
            sseUrl: `${baseEndpointUrl}/sse`,
            httpUrl: `${baseEndpointUrl}/http`,
            apiKeyId,
        };
        // Ensure URLs are unique
        await this.ensureUrlsAreUnique(endpointData.url, endpointData.sseUrl, endpointData.httpUrl);
        return await this.endpointRepository.createEndpoint(endpointData);
    }
    /**
     * Get endpoint by ID
     */
    async getEndpointById(endpointId) {
        return await this.endpointRepository.findEndpointById(endpointId);
    }
    /**
     * Get all endpoints for a user
     */
    async getEndpointsByUser(userId) {
        return await this.endpointRepository.findByUserId(userId);
    }
    /**
     * Delete an endpoint
     */
    async deleteEndpoint(endpointId) {
        const endpoint = await this.endpointRepository.findEndpointById(endpointId);
        if (!endpoint) {
            throw new EndpointError('Endpoint not found', 'ENDPOINT_NOT_FOUND');
        }
        await this.endpointRepository.deleteEndpoint(endpointId);
    }
    /**
     * Update endpoint last accessed time
     */
    async updateLastAccessed(endpointId) {
        const endpoint = await this.endpointRepository.findEndpointById(endpointId);
        if (!endpoint) {
            throw new EndpointError('Endpoint not found', 'ENDPOINT_NOT_FOUND');
        }
        await this.endpointRepository.updateLastAccessed(endpointId);
    }
    /**
     * Validate endpoint access with API key
     */
    async validateEndpointAccess(endpointId, apiKey) {
        try {
            // Get endpoint
            const endpoint = await this.endpointRepository.findEndpointById(endpointId);
            if (!endpoint) {
                return false;
            }
            // Get API key from repository
            const apiKeyRecord = await this.apiKeyRepository.findApiKeyById(endpoint.apiKeyId);
            if (!apiKeyRecord) {
                return false;
            }
            // Validate API key hash
            const isValidKey = await this.apiKeyRepository.validateApiKey(apiKey);
            if (!isValidKey) {
                return false;
            }
            // Check if the provided API key matches the endpoint's API key
            const providedKeyRecord = await this.apiKeyRepository.findByKey(apiKey);
            if (!providedKeyRecord || providedKeyRecord.id !== endpoint.apiKeyId) {
                return false;
            }
            // Check if API key is expired
            if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
                return false;
            }
            return true;
        }
        catch (error) {
            console.error('Error validating endpoint access:', error);
            return false;
        }
    }
    /**
     * Get endpoints with group information
     */
    async getEndpointsWithGroupInfo(userId) {
        return await this.endpointRepository.findEndpointsWithGroupInfo(userId);
    }
    /**
     * Get default endpoint for user
     */
    async getDefaultEndpoint(userId) {
        return await this.endpointRepository.findDefaultEndpointByUserId(userId);
    }
    /**
     * Regenerate endpoint URLs (useful for security purposes)
     */
    async regenerateEndpointUrls(endpointId) {
        const endpoint = await this.endpointRepository.findEndpointById(endpointId);
        if (!endpoint) {
            throw new EndpointError('Endpoint not found', 'ENDPOINT_NOT_FOUND');
        }
        // Generate new unique endpoint URLs
        const newEndpointId = this.tokenGenerator.generateUuid();
        const baseEndpointUrl = `${this.baseUrl}/api/v1/endpoints/${newEndpointId}`;
        const newUrls = {
            url: baseEndpointUrl,
            sseUrl: `${baseEndpointUrl}/sse`,
            httpUrl: `${baseEndpointUrl}/http`,
        };
        // Ensure new URLs are unique
        await this.ensureUrlsAreUnique(newUrls.url, newUrls.sseUrl, newUrls.httpUrl, endpointId);
        // Update endpoint with new URLs
        const updatedEndpoint = await this.endpointRepository.updateEndpoint(endpointId, newUrls);
        if (!updatedEndpoint) {
            throw new EndpointError('Failed to update endpoint URLs', 'UPDATE_FAILED');
        }
        return updatedEndpoint;
    }
    /**
     * Validate API key ownership
     */
    async validateApiKeyOwnership(userId, apiKeyId) {
        const apiKey = await this.apiKeyRepository.findApiKeyById(apiKeyId);
        if (!apiKey) {
            throw new EndpointError('API key not found', 'API_KEY_NOT_FOUND');
        }
        if (apiKey.userId !== userId) {
            throw new EndpointError('API key does not belong to user', 'API_KEY_ACCESS_DENIED');
        }
    }
    /**
     * Ensure URLs are unique across all endpoints
     */
    async ensureUrlsAreUnique(url, sseUrl, httpUrl, excludeEndpointId) {
        const urls = [url, sseUrl, httpUrl];
        for (const checkUrl of urls) {
            const isAvailable = await this.endpointRepository.isUrlAvailable(checkUrl, excludeEndpointId);
            if (!isAvailable) {
                throw new EndpointError(`URL ${checkUrl} is already in use`, 'URL_NOT_AVAILABLE');
            }
        }
    }
}
exports.EndpointService = EndpointService;
exports.ENDPOINT_SERVICE = Symbol.for('EndpointService');
