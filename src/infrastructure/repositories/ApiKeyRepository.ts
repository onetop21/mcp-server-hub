import { ApiKey, Permission, RateLimit } from '../../domain/models/ApiKey';
import { BaseRepository } from '../database/BaseRepository';
import { DatabaseConnection } from '../database/connection';
import * as crypto from 'crypto';

/**
 * Database representation of ApiKey
 */
interface ApiKeyRow {
  id: string;
  user_id: string;
  key_hash: string;
  name: string;
  permissions: string; // JSON string
  rate_limit: string; // JSON string
  created_at: Date;
  expires_at?: Date;
  last_used_at?: Date;
}

/**
 * API Key repository for database operations
 */
export class ApiKeyRepository extends BaseRepository<ApiKeyRow> {
  constructor(db: DatabaseConnection) {
    super(db, 'api_keys');
  }

  /**
   * Convert database row to domain model
   */
  private toDomainModel(row: ApiKeyRow, originalKey?: string): ApiKey {
    return {
      id: row.id,
      userId: row.user_id,
      key: originalKey || row.key_hash, // Use original key if provided, otherwise hash
      name: row.name,
      permissions: JSON.parse(row.permissions) as Permission[],
      rateLimit: JSON.parse(row.rate_limit) as RateLimit,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
    };
  }

  /**
   * Convert domain model to database row
   */
  private toDbRow(apiKey: Partial<ApiKey>, keyHash?: string): Partial<ApiKeyRow> {
    const row: Partial<ApiKeyRow> = {};
    
    if (apiKey.userId !== undefined) row.user_id = apiKey.userId;
    if (apiKey.key !== undefined || keyHash !== undefined) row.key_hash = keyHash || apiKey.key!;
    if (apiKey.name !== undefined) row.name = apiKey.name;
    if (apiKey.permissions !== undefined) row.permissions = JSON.stringify(apiKey.permissions);
    if (apiKey.rateLimit !== undefined) row.rate_limit = JSON.stringify(apiKey.rateLimit);
    if (apiKey.createdAt !== undefined) row.created_at = apiKey.createdAt;
    if (apiKey.expiresAt !== undefined) row.expires_at = apiKey.expiresAt;
    if (apiKey.lastUsedAt !== undefined) row.last_used_at = apiKey.lastUsedAt;

    return row;
  }

  /**
   * Find API key by ID
   */
  async findApiKeyById(id: string): Promise<ApiKey | null> {
    const row = await super.findById(id);
    return row ? this.toDomainModel(row) : null;
  }

  /**
   * Find API key by key value
   */
  async findByKey(key: string): Promise<ApiKey | null> {
    const keyHash = this.hashKey(key);
    const query = 'SELECT * FROM api_keys WHERE key_hash = $1 AND (expires_at IS NULL OR expires_at > NOW())';
    const row = await this.findOneByQuery(query, [keyHash]);
    return row ? this.toDomainModel(row, key) : null;
  }

  /**
   * Find all API keys for a user
   */
  async findByUserId(userId: string): Promise<ApiKey[]> {
    const query = 'SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC';
    const rows = await this.findByQuery(query, [userId]);
    return rows.map(row => this.toDomainModel(row));
  }

  /**
   * Create a new API key
   */
  async createApiKey(apiKeyData: Omit<ApiKey, 'id' | 'createdAt'>): Promise<ApiKey> {
    const keyHash = this.hashKey(apiKeyData.key);
    const dbRow = this.toDbRow(apiKeyData, keyHash);
    const createdRow = await super.create(dbRow);
    return this.toDomainModel(createdRow, apiKeyData.key);
  }

  /**
   * Update API key
   */
  async updateApiKey(id: string, apiKeyData: Partial<ApiKey>): Promise<ApiKey | null> {
    const dbRow = this.toDbRow(apiKeyData);
    const updatedRow = await super.update(id, dbRow);
    return updatedRow ? this.toDomainModel(updatedRow) : null;
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(key: string): Promise<void> {
    const keyHash = this.hashKey(key);
    const query = 'UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1';
    await this.db.query(query, [keyHash]);
  }

  /**
   * Revoke API key (soft delete by setting expiry)
   */
  async revokeApiKey(id: string): Promise<void> {
    const query = 'UPDATE api_keys SET expires_at = NOW() WHERE id = $1';
    await this.db.query(query, [id]);
  }

  /**
   * Find expired API keys
   */
  async findExpiredKeys(): Promise<ApiKey[]> {
    const query = 'SELECT * FROM api_keys WHERE expires_at IS NOT NULL AND expires_at <= NOW()';
    const rows = await this.findByQuery(query, []);
    return rows.map(row => this.toDomainModel(row));
  }

  /**
   * Clean up expired API keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    const query = 'DELETE FROM api_keys WHERE expires_at IS NOT NULL AND expires_at <= NOW() - INTERVAL \'30 days\'';
    const result = await this.db.query(query, []);
    return result.rowCount || 0;
  }

  /**
   * Get API key statistics for a user
   */
  async getUserApiKeyStats(userId: string): Promise<{
    total: number;
    active: number;
    expired: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN expires_at IS NULL OR expires_at > NOW() THEN 1 END) as active,
        COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at <= NOW() THEN 1 END) as expired
      FROM api_keys 
      WHERE user_id = $1
    `;
    
    const result = await this.db.query<{
      total: string;
      active: string;
      expired: string;
    }>(query, [userId]);
    
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
  async nameExistsForUser(userId: string, name: string, excludeId?: string): Promise<boolean> {
    let query = 'SELECT 1 FROM api_keys WHERE user_id = $1 AND name = $2';
    const params: any[] = [userId, name];
    
    if (excludeId) {
      query += ' AND id != $3';
      params.push(excludeId);
    }
    
    query += ' LIMIT 1';
    
    const result = await this.db.query(query, params);
    return result.rows.length > 0;
  }

  /**
   * Validate an API key
   */
  async validateApiKey(key: string): Promise<boolean> {
    const apiKey = await this.findByKey(key);
    return apiKey !== null;
  }

  /**
   * Hash an API key for secure storage
   */
  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}