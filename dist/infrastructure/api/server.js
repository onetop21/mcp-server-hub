"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIServer = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const container_1 = require("../di/container");
// Routes
const userRoutes_1 = require("./routes/userRoutes");
const serverRoutes_1 = require("./routes/serverRoutes");
const groupRoutes_1 = require("./routes/groupRoutes");
const endpointRoutes_1 = require("./routes/endpointRoutes");
const marketplaceRoutes_1 = require("./routes/marketplaceRoutes");
const mcpRoutes_1 = require("./routes/mcpRoutes");
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
class APIServer {
    constructor(container, port = 3000) {
        this.app = (0, express_1.default)();
        this.container = container;
        this.port = port;
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }
    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // Security
        this.app.use((0, helmet_1.default)());
        // CORS - allow all origins for now (can be restricted later)
        this.app.use((0, cors_1.default)({
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
        }));
        // Body parsing
        this.app.use(express_1.default.json());
        this.app.use(express_1.default.urlencoded({ extended: true }));
        // Request logging (only in development)
        if (process.env.NODE_ENV !== 'production') {
            this.app.use((0, morgan_1.default)('dev'));
        }
        // Health check endpoint (no auth required)
        this.app.get('/health', (req, res) => {
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
    setupRoutes() {
        // API v1 routes
        this.app.use('/api/users', (0, userRoutes_1.userRoutes)(this.container));
        this.app.use('/api/servers', (0, serverRoutes_1.serverRoutes)(this.container));
        this.app.use('/api/groups', (0, groupRoutes_1.groupRoutes)(this.container));
        this.app.use('/api/endpoints', (0, endpointRoutes_1.endpointRoutes)(this.container));
        this.app.use('/api/marketplace', (0, marketplaceRoutes_1.marketplaceRoutes)(this.container));
        // MCP protocol endpoints
        this.app.use('/mcp', (0, mcpRoutes_1.mcpRoutes)(this.container));
        // API documentation
        this.app.get('/api', (req, res) => {
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
        this.app.use((req, res) => {
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
    setupErrorHandling() {
        this.app.use((err, req, res, next) => {
            console.error('API Error:', err);
            // Default error response
            const statusCode = err.statusCode || 500;
            const errorResponse = {
                error: Object.assign({ code: err.code || 'INTERNAL_ERROR', message: err.message || 'An unexpected error occurred' }, (process.env.NODE_ENV !== 'production' && {
                    stack: err.stack
                }))
            };
            res.status(statusCode).json(errorResponse);
        });
    }
    /**
     * Start the server
     */
    async start() {
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
    async stop() {
        await this.container.cleanup();
        console.log('Server stopped');
    }
    /**
     * Get Express app (for testing)
     */
    getApp() {
        return this.app;
    }
}
exports.APIServer = APIServer;
// Start server if this file is run directly
if (require.main === module) {
    const container = container_1.DIContainer.getInstance();
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
