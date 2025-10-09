import { Response } from 'express';
import { DIContainer } from '../../di/container';
import { TYPES } from '../../di/types';
import { IUserManagementService } from '../../../domain/services';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * User Controller
 * Handles user registration, authentication, and API key management
 */
export class UserController {
  private container: DIContainer;

  constructor(container: DIContainer) {
    this.container = container;
  }

  /**
   * Register new user
   * POST /api/users/register
   */
  async register(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const userService = this.container.get<IUserManagementService>(TYPES.UserManagementService);
      const user = await userService.createUser({ email, username, password });

      res.status(201).json({
        userId: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      });
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
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
  async login(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const userService = this.container.get<IUserManagementService>(TYPES.UserManagementService);
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
        username: user?.username || '',
        token: token.token,
        apiKey: token.token, // Backwards compatibility for clients expecting apiKey
        expiresAt: token.expiresAt
      });
    } catch (error) {
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
  async getCurrentUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userService = this.container.get<IUserManagementService>(TYPES.UserManagementService);
      const user = await userService.getUserById(req.userId!);

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
    } catch (error) {
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
  async generateApiKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, expiresInDays, permissions } = req.body as {
        name?: string;
        expiresInDays?: number;
        permissions?: Array<{ resource: string; actions: string[] }>;
      };

      const userService = this.container.get<IUserManagementService>(TYPES.UserManagementService);
      const finalPermissions = Array.isArray(permissions) && permissions.length > 0
        ? permissions
        : [{ resource: '*', actions: ['*'] }];
      const expiresIn = typeof expiresInDays === 'number' && expiresInDays > 0
        ? `${expiresInDays}d`
        : undefined;

      const apiKey = await userService.generateApiKey(
        req.userId!,
        finalPermissions as any,
        name || 'Default Key',
        expiresIn
      );

      res.status(201).json({
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          key: apiKey.key,
          createdAt: apiKey.createdAt,
          lastUsed: apiKey.lastUsedAt || null,
        }
      });
    } catch (error: any) {
      console.error('Generate API key error:', error);
      const msg = (error?.message || '').toString().toLowerCase();
      if (msg.includes('already exists')) {
        res.status(409).json({
          error: {
            code: 'DUPLICATE_KEY_NAME',
            message: 'API key name already exists',
            details: error?.message || String(error)
          }
        });
        return;
      }
      res.status(500).json({
        error: {
          code: 'KEY_GENERATION_FAILED',
          message: 'Failed to generate API key',
          details: error?.message || String(error)
        }
      });
    }
  }

  /**
   * List user's API keys
   * GET /api/users/api-keys
   */
  async listApiKeys(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userService = this.container.get<IUserManagementService>(TYPES.UserManagementService);
      const keys = await userService.getUserApiKeys(req.userId!);

      res.json({
        apiKeys: keys.map(k => ({
          id: k.id,
          name: k.name,
          key: (k.key || '').toString().substring(0, 12),
          createdAt: k.createdAt,
          lastUsed: k.lastUsedAt || null,
        }))
      });
    } catch (error) {
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
  async revokeApiKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { keyId } = req.params;

      const userService = this.container.get<IUserManagementService>(TYPES.UserManagementService);
      await userService.revokeApiKey(keyId);

      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes('not found')) {
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

