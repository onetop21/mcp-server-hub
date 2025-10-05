import { Request, Response, NextFunction } from 'express';
import { DIContainer } from '../../di/container';
import { TYPES } from '../../di/types';
import { IUserManagementService } from '../../../domain/services';

/**
 * Extended Request with user info
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;
  apiKey?: string;
}

/**
 * Authentication Middleware
 * Verifies API key in Authorization header
 */
export function authMiddleware(container: DIContainer) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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

      const userService = container.get<IUserManagementService>(TYPES.UserManagementService);
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
    } catch (error) {
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
