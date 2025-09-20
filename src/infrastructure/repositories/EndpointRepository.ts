import { Endpoint } from '../../domain/models/Endpoint';
import { BaseRepository } from '../database/BaseRepository';
import { DatabaseConnection } from '../database/connection';

/**
 * Database representation of Endpoint
 */
interface EndpointRow {
  id: string;
  user_id: string;
  group_id: string | null;
  url: string;
  sse_url: string;
  http_url: string;
  api_key_id: string;
  created_at: Date;
  last_accessed_at: Date | null;
}

/**
 * Endpoint repository for database operations
 */
export class EndpointRepository extends BaseRepository<EndpointRow> {
  constructor(db: DatabaseConnection) {
    super(db, 'endpoints');
  }

  /**
   * Convert database row to domain model
   */
  private toDomainModel(row: EndpointRow): Endpoint {
    return {
      id: row.id,
      userId: row.user_id,
      groupId: row.group_id || undefined,
      url: row.url,
      sseUrl: row.sse_url,
      httpUrl: row.http_url,
      apiKeyId: row.api_key_id,
      createdAt: row.created_at,
      lastAccessedAt: row.last_accessed_at || undefined,
    };
  }

  /**
   * Convert domain model to database row
   */
  private toDbRow(endpoint: Partial<Endpoint>): Partial<EndpointRow> {
    const row: Partial<EndpointRow> = {};
    
    if (endpoint.userId !== undefined) row.user_id = endpoint.userId;
    if (endpoint.groupId !== undefined) row.group_id = endpoint.groupId;
    if (endpoint.url !== undefined) row.url = endpoint.url;
    if (endpoint.sseUrl !== undefined) row.sse_url = endpoint.sseUrl;
    if (endpoint.httpUrl !== undefined) row.http_url = endpoint.httpUrl;
    if (endpoint.apiKeyId !== undefined) row.api_key_id = endpoint.apiKeyId;
    if (endpoint.createdAt !== undefined) row.created_at = endpoint.createdAt;
    if (endpoint.lastAccessedAt !== undefined) row.last_accessed_at = endpoint.lastAccessedAt;

    return row;
  }

  /**
   * Create a new endpoint
   */
  async createEndpoint(endpointData: Omit<Endpoint, 'id' | 'createdAt' | 'lastAccessedAt'>): Promise<Endpoint> {
    const dbRow = this.toDbRow(endpointData);
    const createdRow = await super.create(dbRow);
    return this.toDomainModel(createdRow);
  }

  /**
   * Find endpoint by ID
   */
  async findEndpointById(id: string): Promise<Endpoint | null> {
    const row = await super.findById(id);
    return row ? this.toDomainModel(row) : null;
  }

  /**
   * Find endpoints by user ID
   */
  async findByUserId(userId: string): Promise<Endpoint[]> {
    const rows = await this.findAll({ user_id: userId });
    return rows.map(row => this.toDomainModel(row));
  }

  /**
   * Find endpoint by URL
   */
  async findByUrl(url: string): Promise<Endpoint | null> {
    const query = 'SELECT * FROM endpoints WHERE url = $1 OR sse_url = $1 OR http_url = $1';
    const row = await this.findOneByQuery(query, [url]);
    return row ? this.toDomainModel(row) : null;
  }

  /**
   * Find endpoints by group ID
   */
  async findByGroupId(groupId: string): Promise<Endpoint[]> {
    const rows = await this.findAll({ group_id: groupId });
    return rows.map(row => this.toDomainModel(row));
  }

  /**
   * Find endpoints by API key ID
   */
  async findByApiKeyId(apiKeyId: string): Promise<Endpoint[]> {
    const rows = await this.findAll({ api_key_id: apiKeyId });
    return rows.map(row => this.toDomainModel(row));
  }

  /**
   * Find default endpoint for user (no group)
   */
  async findDefaultEndpointByUserId(userId: string): Promise<Endpoint | null> {
    const query = 'SELECT * FROM endpoints WHERE user_id = $1 AND group_id IS NULL LIMIT 1';
    const row = await this.findOneByQuery(query, [userId]);
    return row ? this.toDomainModel(row) : null;
  }

  /**
   * Update endpoint
   */
  async updateEndpoint(id: string, updates: Partial<Endpoint>): Promise<Endpoint | null> {
    const dbRow = this.toDbRow(updates);
    const updatedRow = await super.update(id, dbRow);
    return updatedRow ? this.toDomainModel(updatedRow) : null;
  }

  /**
   * Update last accessed time
   */
  async updateLastAccessed(id: string): Promise<void> {
    const query = 'UPDATE endpoints SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1';
    await this.db.query(query, [id]);
  }

  /**
   * Delete endpoint
   */
  async deleteEndpoint(id: string): Promise<void> {
    await super.delete(id);
  }

  /**
   * Delete endpoints by group ID
   */
  async deleteByGroupId(groupId: string): Promise<void> {
    const query = 'DELETE FROM endpoints WHERE group_id = $1';
    await this.db.query(query, [groupId]);
  }

  /**
   * Delete endpoints by API key ID
   */
  async deleteByApiKeyId(apiKeyId: string): Promise<void> {
    const query = 'DELETE FROM endpoints WHERE api_key_id = $1';
    await this.db.query(query, [apiKeyId]);
  }

  /**
   * Check if URL is available
   */
  async isUrlAvailable(url: string, excludeId?: string): Promise<boolean> {
    let query = 'SELECT 1 FROM endpoints WHERE (url = $1 OR sse_url = $1 OR http_url = $1)';
    const params = [url];
    
    if (excludeId) {
      query += ' AND id != $2';
      params.push(excludeId);
    }
    
    query += ' LIMIT 1';
    
    const result = await this.db.query(query, params);
    return result.rows.length === 0;
  }

  /**
   * Get endpoint statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byType: { default: number; group: number };
    recentlyAccessed: number;
  }> {
    const total = await this.count();
    
    const typeQuery = `
      SELECT 
        COUNT(CASE WHEN group_id IS NULL THEN 1 END) as default_count,
        COUNT(CASE WHEN group_id IS NOT NULL THEN 1 END) as group_count
      FROM endpoints
    `;
    
    const recentQuery = `
      SELECT COUNT(*) as count 
      FROM endpoints 
      WHERE last_accessed_at > NOW() - INTERVAL '24 hours'
    `;
    
    const [typeResult, recentResult] = await Promise.all([
      this.db.query<{ default_count: string; group_count: string }>(typeQuery),
      this.db.query<{ count: string }>(recentQuery),
    ]);
    
    const typeRow = typeResult.rows[0];
    const recentRow = recentResult.rows[0];
    
    return {
      total,
      byType: {
        default: parseInt(typeRow?.default_count || '0', 10),
        group: parseInt(typeRow?.group_count || '0', 10),
      },
      recentlyAccessed: parseInt(recentRow?.count || '0', 10),
    };
  }

  /**
   * Find endpoints with group information
   */
  async findEndpointsWithGroupInfo(userId: string): Promise<Array<Endpoint & { groupName?: string }>> {
    const query = `
      SELECT 
        e.*,
        sg.name as group_name
      FROM endpoints e
      LEFT JOIN server_groups sg ON e.group_id = sg.id
      WHERE e.user_id = $1
      ORDER BY e.created_at DESC
    `;
    
    const result = await this.db.query<EndpointRow & { group_name?: string }>(query, [userId]);
    
    return result.rows.map(row => ({
      ...this.toDomainModel(row),
      groupName: row.group_name || undefined,
    }));
  }
}