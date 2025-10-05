"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerController = void 0;
const types_1 = require("../../di/types");
/**
 * Server Controller
 * Handles MCP server registration and management
 */
class ServerController {
    constructor(container) {
        this.container = container;
    }
    /**
     * Register new server
     * POST /api/servers
     */
    async registerServer(req, res) {
        var _a;
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
            const serverService = this.container.get(types_1.TYPES.ServerRegistryService);
            const server = await serverService.registerServer(req.userId, Object.assign(Object.assign({}, config), { name,
                protocol,
                namespace }));
            res.status(201).json({
                serverId: server.id,
                name: server.name,
                protocol: server.protocol,
                namespace: server.namespace,
                status: server.status,
                createdAt: server.createdAt
            });
        }
        catch (error) {
            if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('already exists')) {
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
    async listServers(req, res) {
        try {
            const serverService = this.container.get(types_1.TYPES.ServerRegistryService);
            const servers = await serverService.getServersByUser(req.userId);
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
        }
        catch (error) {
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
    async getServer(req, res) {
        var _a;
        try {
            const { serverId } = req.params;
            const serverService = this.container.get(types_1.TYPES.ServerRegistryService);
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
            if ((_a = sanitizedConfig.stdio) === null || _a === void 0 ? void 0 : _a.env) {
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
        }
        catch (error) {
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
    async updateServer(req, res) {
        var _a;
        try {
            const { serverId } = req.params;
            const updates = req.body;
            const serverService = this.container.get(types_1.TYPES.ServerRegistryService);
            const server = await serverService.updateServer(serverId, updates);
            res.json({
                serverId: server.id,
                name: server.name,
                status: server.status,
                updatedAt: server.updatedAt
            });
        }
        catch (error) {
            if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('not found')) {
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
    async deleteServer(req, res) {
        var _a;
        try {
            const { serverId } = req.params;
            const serverService = this.container.get(types_1.TYPES.ServerRegistryService);
            await serverService.deleteServer(serverId);
            res.status(204).send();
        }
        catch (error) {
            if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('not found')) {
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
    async getServerHealth(req, res) {
        try {
            const { serverId } = req.params;
            const routerService = this.container.get(types_1.TYPES.RouterService);
            const health = await routerService.getServerHealth(serverId);
            res.json({
                serverId: health.serverId,
                status: health.status,
                lastCheck: health.lastCheck,
                responseTime: health.responseTime,
                error: health.error
            });
        }
        catch (error) {
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
    async getServerTools(req, res) {
        try {
            const { serverId } = req.params;
            // TODO: Implement get tools from server
            // This would use RouterService to get tools from the server
            res.json({
                tools: [],
                message: 'Tool listing not yet implemented'
            });
        }
        catch (error) {
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
     * Register server from marketplace template
     * POST /api/servers/from-marketplace
     */
    async registerFromMarketplace(req, res) {
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
        }
        catch (error) {
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
exports.ServerController = ServerController;
