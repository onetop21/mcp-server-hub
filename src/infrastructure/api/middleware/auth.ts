import { Request, Response, NextFunction } from 'express';
import { DIContainer } from '../../di/container';
import { TYPES } from '../../di/types';
import { IUserManagementService } from '../../../domain/services';
import { TokenGenerator } from '../../utils/TokenGenerator';

const tokenGenerator = new TokenGenerator();

/**
 * Extended Request with user info
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;
  apiKey?: string;
}

/**
 * Authentication Middleware
 * Verifies JWT token in Authorization header
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

      const token = authHeader.substring(7); // Remove "Bearer "

      // Verify JWT token
      const payload = tokenGenerator.verifyJwtToken(token);
      if (!payload || !payload.userId) {
        res.status(401).json({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token'
          }
        });
        return;
      }

      // Ensure user still exists
      const userService = container.get<IUserManagementService>(TYPES.UserManagementService);
      const user = await userService.getUserById(payload.userId);
      if (!user) {
        res.status(401).json({
          error: {
            code: 'INVALID_TOKEN',
            message: 'User not found'
          }
        });
        return;
      }

      // Attach user info to request for downstream handlers
      req.userId = payload.userId;
      req.apiKey = token;

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
