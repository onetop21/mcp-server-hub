import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

/**
 * JWT token generation and validation utility
 */
export class TokenGenerator {
  private readonly jwtSecret: string;
  private readonly defaultExpiresIn: string = '24h';

  constructor(jwtSecret: string = process.env.JWT_SECRET || 'default-secret-key') {
    this.jwtSecret = jwtSecret;
  }

  /**
   * Generate a JWT token for a user
   */
  generateJwtToken(userId: string, expiresIn: string = this.defaultExpiresIn): string {
    const payload = {
      userId,
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn } as jwt.SignOptions);
  }

  /**
   * Verify and decode a JWT token
   */
  verifyJwtToken(token: string): { userId: string; iat: number } | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      return {
        userId: decoded.userId,
        iat: decoded.iat,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate a secure API key
   */
  generateApiKey(): string {
    // Generate a UUID-based API key with prefix
    const uuid = uuidv4().replace(/-/g, '');
    return `mcp_${uuid}`;
  }

  /**
   * Generate a UUID
   */
  generateUuid(): string {
    return uuidv4();
  }

  /**
   * Calculate expiration date from duration string
   */
  calculateExpirationDate(duration: string): Date {
    const now = new Date();
    
    // Parse duration (e.g., '24h', '7d', '30d')
    const match = duration.match(/^(\d+)([hdwmy])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'h':
        now.setHours(now.getHours() + value);
        break;
      case 'd':
        now.setDate(now.getDate() + value);
        break;
      case 'w':
        now.setDate(now.getDate() + (value * 7));
        break;
      case 'm':
        now.setMonth(now.getMonth() + value);
        break;
      case 'y':
        now.setFullYear(now.getFullYear() + value);
        break;
      default:
        throw new Error(`Unsupported duration unit: ${unit}`);
    }

    return now;
  }
}