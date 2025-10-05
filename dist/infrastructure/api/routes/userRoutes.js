"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = require("express");
const UserController_1 = require("../controllers/UserController");
const auth_1 = require("../middleware/auth");
/**
 * User Management Routes
 *
 * Public endpoints:
 * - POST /register - Create new user
 * - POST /login - User login
 *
 * Protected endpoints (require API key):
 * - GET /me - Get current user info
 * - POST /api-keys - Generate new API key
 * - GET /api-keys - List API keys
 * - DELETE /api-keys/:keyId - Revoke API key
 */
function userRoutes(container) {
    const router = (0, express_1.Router)();
    const controller = new UserController_1.UserController(container);
    // Public routes
    router.post('/register', controller.register.bind(controller));
    router.post('/login', controller.login.bind(controller));
    // Protected routes
    router.get('/me', (0, auth_1.authMiddleware)(container), controller.getCurrentUser.bind(controller));
    router.post('/api-keys', (0, auth_1.authMiddleware)(container), controller.generateApiKey.bind(controller));
    router.get('/api-keys', (0, auth_1.authMiddleware)(container), controller.listApiKeys.bind(controller));
    router.delete('/api-keys/:keyId', (0, auth_1.authMiddleware)(container), controller.revokeApiKey.bind(controller));
    return router;
}
exports.userRoutes = userRoutes;
