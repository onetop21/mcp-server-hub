"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const userRoutes_1 = require("./routes/userRoutes");
const serverRoutes_1 = require("./routes/serverRoutes");
const marketplaceRoutes_1 = require("./routes/marketplaceRoutes");
const groupRoutes_1 = require("./routes/groupRoutes");
const endpointRoutes_1 = require("./routes/endpointRoutes");
const mcpRoutes_1 = require("./routes/mcpRoutes");
const healthRoutes_1 = require("./routes/healthRoutes");
/**
 * Create Express Application
 *
 * Sets up all routes and middleware
 */
function createApp(container) {
    const app = (0, express_1.default)();
    // Middleware
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    // CORS (allow all origins for now)
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
            return;
        }
        next();
    });
    // Request logging
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
        next();
    });
    // Health check routes (no /api prefix)
    app.use('/', (0, healthRoutes_1.healthRoutes)(container));
    // API routes
    app.use('/api/users', (0, userRoutes_1.userRoutes)(container));
    app.use('/api/servers', (0, serverRoutes_1.serverRoutes)(container));
    app.use('/api/marketplace', (0, marketplaceRoutes_1.marketplaceRoutes)(container));
    app.use('/api/groups', (0, groupRoutes_1.groupRoutes)(container));
    app.use('/api/endpoints', (0, endpointRoutes_1.endpointRoutes)(container));
    app.use('/api/mcp', (0, mcpRoutes_1.mcpRoutes)(container));
    // 404 handler
    app.use((req, res) => {
        res.status(404).json({
            error: {
                code: 'NOT_FOUND',
                message: `Route ${req.method} ${req.path} not found`
            }
        });
    });
    // Error handler
    app.use((err, req, res, next) => {
        console.error('Unhandled error:', err);
        res.status(500).json({
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Internal server error'
            }
        });
    });
    return app;
}
exports.createApp = createApp;
