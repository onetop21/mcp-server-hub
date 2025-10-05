"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketplaceRoutes = void 0;
const express_1 = require("express");
const MarketplaceController_1 = require("../controllers/MarketplaceController");
const auth_1 = require("../middleware/auth");
/**
 * Marketplace Routes
 *
 * Public endpoints:
 * - GET / - List marketplace servers
 * - GET /:marketplaceId - Get marketplace server details
 *
 * User endpoints (require auth):
 * - POST /:marketplaceId/install - Install from marketplace
 *
 * Admin endpoints (require auth):
 * - POST / - Register marketplace server
 * - PUT /:marketplaceId - Update marketplace server
 * - DELETE /:marketplaceId - Delete marketplace server
 */
function marketplaceRoutes(container) {
    const router = (0, express_1.Router)();
    const controller = new MarketplaceController_1.MarketplaceController(container);
    // Public routes
    router.get('/', controller.listMarketplace.bind(controller));
    router.get('/:marketplaceId', controller.getMarketplaceServer.bind(controller));
    // User routes (authenticated)
    router.post('/:marketplaceId/install', (0, auth_1.authMiddleware)(container), controller.installFromMarketplace.bind(controller));
    // Admin routes (authenticated)
    router.post('/', (0, auth_1.authMiddleware)(container), controller.registerMarketplace.bind(controller));
    router.put('/:marketplaceId', (0, auth_1.authMiddleware)(container), controller.updateMarketplace.bind(controller));
    router.delete('/:marketplaceId', (0, auth_1.authMiddleware)(container), controller.deleteMarketplace.bind(controller));
    return router;
}
exports.marketplaceRoutes = marketplaceRoutes;
