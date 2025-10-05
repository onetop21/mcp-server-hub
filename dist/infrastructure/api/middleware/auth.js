"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const types_1 = require("../../di/types");
/**
 * Authentication Middleware
 * Verifies API key in Authorization header
 */
function authMiddleware(container) {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).json({
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Missing or invalid Authorization header'
                    }
                });
                return;
            }
            const apiKey = authHeader.substring(7); // Remove "Bearer "
            const userService = container.get(types_1.TYPES.UserManagementService);
            const result = await userService.validateApiKey(apiKey);
            if (!result.isValid || !result.userId) {
                res.status(401).json({
                    error: {
                        code: 'INVALID_API_KEY',
                        message: 'Invalid or expired API key'
                    }
                });
                return;
            }
            // Attach user info to request
            req.userId = result.userId;
            req.apiKey = apiKey;
            next();
        }
        catch (error) {
            console.error('Auth middleware error:', error);
            res.status(500).json({
                error: {
                    code: 'AUTH_ERROR',
                    message: 'Authentication failed'
                }
            });
        }
    };
}
exports.authMiddleware = authMiddleware;
