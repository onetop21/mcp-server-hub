"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenGenerator = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const uuid_1 = require("uuid");
/**
 * JWT token generation and validation utility
 */
class TokenGenerator {
    constructor(jwtSecret = process.env.JWT_SECRET || 'default-secret-key') {
        this.defaultExpiresIn = '24h';
        this.jwtSecret = jwtSecret;
    }
    /**
     * Generate a JWT token for a user
     */
    generateJwtToken(userId, expiresIn = this.defaultExpiresIn) {
        const payload = {
            userId,
            iat: Math.floor(Date.now() / 1000),
        };
        return jwt.sign(payload, this.jwtSecret, { expiresIn });
    }
    /**
     * Verify and decode a JWT token
     */
    verifyJwtToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            return {
                userId: decoded.userId,
                iat: decoded.iat,
            };
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Generate a secure API key
     */
    generateApiKey() {
        // Generate a UUID-based API key with prefix
        const uuid = (0, uuid_1.v4)().replace(/-/g, '');
        return `mcp_${uuid}`;
    }
    /**
     * Calculate expiration date from duration string
     */
    calculateExpirationDate(duration) {
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
exports.TokenGenerator = TokenGenerator;
