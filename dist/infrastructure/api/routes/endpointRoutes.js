"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.endpointRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
/**
 * Endpoint Management Routes (Skeleton)
 *
 * TODO: Implement full endpoint management
 * - POST /default - Create default endpoint
 * - POST /group/:groupId - Create group endpoint
 * - GET / - List endpoints
 * - GET /:endpointId - Get endpoint details
 * - DELETE /:endpointId - Delete endpoint
 */
function endpointRoutes(container) {
    const router = (0, express_1.Router)();
    router.use((0, auth_1.authMiddleware)(container));
    router.post('/default', (req, res) => {
        res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint management coming soon' } });
    });
    router.get('/', (req, res) => {
        res.json({ endpoints: [] });
    });
    return router;
}
exports.endpointRoutes = endpointRoutes;
