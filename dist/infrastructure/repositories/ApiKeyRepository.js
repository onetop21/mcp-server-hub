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
exports.ApiKeyRepository = void 0;
const BaseRepository_1 = require("../database/BaseRepository");
const crypto = __importStar(require("crypto"));
/**
 * API Key repository for database operations
 */
class ApiKeyRepository extends BaseRepository_1.BaseRepository {
    constructor(db) {
        super(db, 'api_keys');
    }
    /**
     * Convert database row to domain model
     */
    toDomainModel(row, originalKey) {
        return {
            id: row.id,
            userId: row.user_id,
            key: originalKey || row.key_hash,
            name: row.name,
            permissions: JSON.parse(row.permissions),
            rateLimit: JSON.parse(row.rate_limit),
            createdAt: row.created_at,
            expiresAt: row.expires_at,
            lastUsedAt: row.last_used_at,
        };
    }
    /**
     * Convert domain model to database row
     */
    toDbRow(apiKey, keyHash) {
        const row = {};
        if (apiKey.userId !== undefined)
            row.user_id = apiKey.userId;
        if (apiKey.key !== undefined || keyHash !== undefined)
            row.key_hash = keyHash || apiKey.key;
        if (apiKey.name !== undefined)
            row.name = apiKey.name;
        if (apiKey.permissions !== undefined)
            row.permissions = JSON.stringify(apiKey.permissions);
        if (apiKey.rateLimit !== undefined)
            row.rate_limit = JSON.stringify(apiKey.rateLimit);
        if (apiKey.createdAt !== undefined)
            row.created_at = apiKey.createdAt;
        if (apiKey.expiresAt !== undefined)
            row.expires_at = apiKey.expiresAt;
        if (apiKey.lastUsedAt !== undefined)
            row.last_used_at = apiKey.lastUsedAt;
        return row;
    }
    /**
     * Find API key by ID
     */
    async findApiKeyById(id) {
        const row = await super.findById(id);
        return row ? this.toDomainModel(row) : null;
    }
    /**
     * Find API key by key value
     */
    async findByKey(key) {
        const keyHash = this.hashKey(key);
        const query = 'SELECT * FROM api_keys WHERE key_hash = $1 AND (expires_at IS NULL OR expires_at > NOW())';
        const row = await this.findOneByQuery(query, [keyHash]);
        return row ? this.toDomainModel(row, key) : null;
    }
    /**
     * Find all API keys for a user
     */
    async findByUserId(userId) {
        const query = 'SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC';
        const rows = await this.findByQuery(query, [userId]);
        return rows.map(row => this.toDomainModel(row));
    }
    /**
     * Create a new API key
     */
    async createApiKey(apiKeyData) {
        const keyHash = this.hashKey(apiKeyData.key);
        const dbRow = this.toDbRow(apiKeyData, keyHash);
        const createdRow = await super.create(dbRow);
        return this.toDomainModel(createdRow, apiKeyData.key);
    }
    /**
     * Update API key
     */
    async updateApiKey(id, apiKeyData) {
        const dbRow = this.toDbRow(apiKeyData);
        const updatedRow = await super.update(id, dbRow);
        return updatedRow ? this.toDomainModel(updatedRow) : null;
    }
    /**
     * Update last used timestamp
     */
    async updateLastUsed(key) {
        const keyHash = this.hashKey(key);
        const query = 'UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1';
        await this.db.query(query, [keyHash]);
    }
    /**
     * Revoke API key (soft delete by setting expiry)
     */
    async revokeApiKey(id) {
        const query = 'UPDATE api_keys SET expires_at = NOW() WHERE id = $1';
        await this.db.query(query, [id]);
    }
    /**
     * Find expired API keys
     */
    async findExpiredKeys() {
        const query = 'SELECT * FROM api_keys WHERE expires_at IS NOT NULL AND expires_at <= NOW()';
        const rows = await this.findByQuery(query, []);
        return rows.map(row => this.toDomainModel(row));
    }
    /**
     * Clean up expired API keys
     */
    async cleanupExpiredKeys() {
        const query = 'DELETE FROM api_keys WHERE expires_at IS NOT NULL AND expires_at <= NOW() - INTERVAL \'30 days\'';
        const result = await this.db.query(query, []);
        return result.rowCount || 0;
    }
    /**
     * Get API key statistics for a user
     */
    async getUserApiKeyStats(userId) {
        const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN expires_at IS NULL OR expires_at > NOW() THEN 1 END) as active,
        COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at <= NOW() THEN 1 END) as expired
      FROM api_keys 
      WHERE user_id = $1
    `;
        const result = await this.db.query(query, [userId]);
        const row = result.rows[0];
        return {
            total: parseInt(row.total, 10),
            active: parseInt(row.active, 10),
            expired: parseInt(row.expired, 10),
        };
    }
    /**
     * Check if API key name exists for user
     */
    async nameExistsForUser(userId, name, excludeId) {
        let query = 'SELECT 1 FROM api_keys WHERE user_id = $1 AND name = $2';
        const params = [userId, name];
        if (excludeId) {
            query += ' AND id != $3';
            params.push(excludeId);
        }
        query += ' LIMIT 1';
        const result = await this.db.query(query, params);
        return result.rows.length > 0;
    }
    /**
     * Hash an API key for secure storage
     */
    hashKey(key) {
        return crypto.createHash('sha256').update(key).digest('hex');
    }
}
exports.ApiKeyRepository = ApiKeyRepository;
