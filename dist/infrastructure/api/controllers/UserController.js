"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const types_1 = require("../../di/types");
/**
 * User Controller
 * Handles user registration, authentication, and API key management
 */
class UserController {
    constructor(container) {
        this.container = container;
    }
    /**
     * Register new user
     * POST /api/users/register
     */
    async register(req, res) {
        var _a;
        try {
            const { email, username, password } = req.body;
            // Validation
            if (!email || !username || !password) {
                res.status(400).json({
                    error: {
                        code: 'INVALID_INPUT',
                        message: 'Email, username, and password are required'
                    }
                });
                return;
            }
            if (password.length < 8) {
                res.status(400).json({
                    error: {
                        code: 'WEAK_PASSWORD',
                        message: 'Password must be at least 8 characters'
                    }
                });
                return;
            }
            const userService = this.container.get(types_1.TYPES.UserManagementService);
            const user = await userService.createUser({ email, username, password });
            res.status(201).json({
                userId: user.id,
                username: user.username,
                email: user.email,
                createdAt: user.createdAt
            });
        }
        catch (error) {
            if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('already exists')) {
                res.status(409).json({
                    error: {
                        code: 'USER_EXISTS',
                        message: error.message
                    }
                });
                return;
            }
            console.error('Register error:', error);
            res.status(500).json({
                error: {
                    code: 'REGISTRATION_FAILED',
                    message: 'Failed to create user'
                }
            });
        }
    }
    /**
     * User login
     * POST /api/users/login
     */
    async login(req, res) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                res.status(400).json({
                    error: {
                        code: 'INVALID_INPUT',
                        message: 'Email and password are required'
                    }
                });
                return;
            }
            const userService = this.container.get(types_1.TYPES.UserManagementService);
            const token = await userService.authenticateUser({ email, password });
            if (!token || !token.token) {
                res.status(401).json({
                    error: {
                        code: 'INVALID_CREDENTIALS',
                        message: 'Invalid email or password'
                    }
                });
                return;
            }
            const user = await userService.getUserById(token.userId);
            res.json({
                userId: token.userId,
                username: (user === null || user === void 0 ? void 0 : user.username) || '',
                apiKey: token.token,
                expiresAt: token.expiresAt
            });
        }
        catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                error: {
                    code: 'LOGIN_FAILED',
                    message: 'Login failed'
                }
            });
        }
    }
    /**
     * Get current user info
     * GET /api/users/me
     */
    async getCurrentUser(req, res) {
        try {
            const userService = this.container.get(types_1.TYPES.UserManagementService);
            const user = await userService.getUserById(req.userId);
            if (!user) {
                res.status(404).json({
                    error: {
                        code: 'USER_NOT_FOUND',
                        message: 'User not found'
                    }
                });
                return;
            }
            res.json({
                userId: user.id,
                username: user.username,
                email: user.email,
                createdAt: user.createdAt
            });
        }
        catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({
                error: {
                    code: 'FETCH_FAILED',
                    message: 'Failed to fetch user info'
                }
            });
        }
    }
    /**
     * Generate new API key
     * POST /api/users/api-keys
     */
    async generateApiKey(req, res) {
        try {
            const { name, expiresInDays } = req.body;
            const userService = this.container.get(types_1.TYPES.UserManagementService);
            const apiKey = await userService.generateApiKey(req.userId, name || 'Default Key');
            res.status(201).json({
                keyId: apiKey.id,
                apiKey: apiKey.key,
                name: apiKey.name,
                expiresAt: apiKey.expiresAt,
                createdAt: apiKey.createdAt
            });
        }
        catch (error) {
            console.error('Generate API key error:', error);
            res.status(500).json({
                error: {
                    code: 'KEY_GENERATION_FAILED',
                    message: 'Failed to generate API key'
                }
            });
        }
    }
    /**
     * List user's API keys
     * GET /api/users/api-keys
     */
    async listApiKeys(req, res) {
        try {
            const userService = this.container.get(types_1.TYPES.UserManagementService);
            const keys = await userService.getUserApiKeys(req.userId);
            res.json({
                keys: keys.map(key => ({
                    keyId: key.id,
                    name: key.name,
                    createdAt: key.createdAt,
                    expiresAt: key.expiresAt,
                    lastUsedAt: key.lastUsedAt
                }))
            });
        }
        catch (error) {
            console.error('List API keys error:', error);
            res.status(500).json({
                error: {
                    code: 'FETCH_FAILED',
                    message: 'Failed to list API keys'
                }
            });
        }
    }
    /**
     * Revoke API key
     * DELETE /api/users/api-keys/:keyId
     */
    async revokeApiKey(req, res) {
        var _a;
        try {
            const { keyId } = req.params;
            const userService = this.container.get(types_1.TYPES.UserManagementService);
            await userService.revokeApiKey(keyId);
            res.status(204).send();
        }
        catch (error) {
            if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('not found')) {
                res.status(404).json({
                    error: {
                        code: 'KEY_NOT_FOUND',
                        message: 'API key not found'
                    }
                });
                return;
            }
            console.error('Revoke API key error:', error);
            res.status(500).json({
                error: {
                    code: 'REVOKE_FAILED',
                    message: 'Failed to revoke API key'
                }
            });
        }
    }
}
exports.UserController = UserController;
