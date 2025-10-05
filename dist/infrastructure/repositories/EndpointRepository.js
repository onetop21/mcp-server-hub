"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EndpointRepository = void 0;
const BaseRepository_1 = require("../database/BaseRepository");
/**
 * Endpoint repository for database operations
 */
class EndpointRepository extends BaseRepository_1.BaseRepository {
    constructor(db) {
        super(db, 'endpoints');
    }
    /**
     * Convert database row to domain model
     */
    toDomainModel(row) {
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
    toDbRow(endpoint) {
        const row = {};
        if (endpoint.userId !== undefined)
            row.user_id = endpoint.userId;
        if (endpoint.groupId !== undefined)
            row.group_id = endpoint.groupId;
        if (endpoint.url !== undefined)
            row.url = endpoint.url;
        if (endpoint.sseUrl !== undefined)
            row.sse_url = endpoint.sseUrl;
        if (endpoint.httpUrl !== undefined)
            row.http_url = endpoint.httpUrl;
        if (endpoint.apiKeyId !== undefined)
            row.api_key_id = endpoint.apiKeyId;
        if (endpoint.createdAt !== undefined)
            row.created_at = endpoint.createdAt;
        if (endpoint.lastAccessedAt !== undefined)
            row.last_accessed_at = endpoint.lastAccessedAt;
        return row;
    }
    /**
     * Create a new endpoint
     */
    async createEndpoint(endpointData) {
        const dbRow = this.toDbRow(endpointData);
        const createdRow = await super.create(dbRow);
        return this.toDomainModel(createdRow);
    }
    /**
     * Find endpoint by ID
     */
    async findEndpointById(id) {
        const row = await super.findById(id);
        return row ? this.toDomainModel(row) : null;
    }
    /**
     * Find endpoints by user ID
     */
    async findByUserId(userId) {
        const rows = await this.findAll({ user_id: userId });
        return rows.map(row => this.toDomainModel(row));
    }
    /**
     * Find endpoint by URL
     */
    async findByUrl(url) {
        const query = 'SELECT * FROM endpoints WHERE url = $1 OR sse_url = $1 OR http_url = $1';
        const row = await this.findOneByQuery(query, [url]);
        return row ? this.toDomainModel(row) : null;
    }
    /**
     * Find endpoints by group ID
     */
    async findByGroupId(groupId) {
        const rows = await this.findAll({ group_id: groupId });
        return rows.map(row => this.toDomainModel(row));
    }
    /**
     * Find endpoints by API key ID
     */
    async findByApiKeyId(apiKeyId) {
        const rows = await this.findAll({ api_key_id: apiKeyId });
        return rows.map(row => this.toDomainModel(row));
    }
    /**
     * Find default endpoint for user (no group)
     */
    async findDefaultEndpointByUserId(userId) {
        const query = 'SELECT * FROM endpoints WHERE user_id = $1 AND group_id IS NULL LIMIT 1';
        const row = await this.findOneByQuery(query, [userId]);
        return row ? this.toDomainModel(row) : null;
    }
    /**
     * Update endpoint
     */
    async updateEndpoint(id, updates) {
        const dbRow = this.toDbRow(updates);
        const updatedRow = await super.update(id, dbRow);
        return updatedRow ? this.toDomainModel(updatedRow) : null;
    }
    /**
     * Update last accessed time
     */
    async updateLastAccessed(id) {
        const query = 'UPDATE endpoints SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1';
        await this.db.query(query, [id]);
    }
    /**
     * Delete endpoint
     */
    async deleteEndpoint(id) {
        await super.delete(id);
    }
    /**
     * Delete endpoints by group ID
     */
    async deleteByGroupId(groupId) {
        const query = 'DELETE FROM endpoints WHERE group_id = $1';
        await this.db.query(query, [groupId]);
    }
    /**
     * Delete endpoints by API key ID
     */
    async deleteByApiKeyId(apiKeyId) {
        const query = 'DELETE FROM endpoints WHERE api_key_id = $1';
        await this.db.query(query, [apiKeyId]);
    }
    /**
     * Check if URL is available
     */
    async isUrlAvailable(url, excludeId) {
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
    async getStatistics() {
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
            this.db.query(typeQuery),
            this.db.query(recentQuery),
        ]);
        const typeRow = typeResult.rows[0];
        const recentRow = recentResult.rows[0];
        return {
            total,
            byType: {
                default: parseInt((typeRow === null || typeRow === void 0 ? void 0 : typeRow.default_count) || '0', 10),
                group: parseInt((typeRow === null || typeRow === void 0 ? void 0 : typeRow.group_count) || '0', 10),
            },
            recentlyAccessed: parseInt((recentRow === null || recentRow === void 0 ? void 0 : recentRow.count) || '0', 10),
        };
    }
    /**
     * Find endpoints with group information
     */
    async findEndpointsWithGroupInfo(userId) {
        const query = `
      SELECT 
        e.*,
        sg.name as group_name
      FROM endpoints e
      LEFT JOIN server_groups sg ON e.group_id = sg.id
      WHERE e.user_id = $1
      ORDER BY e.created_at DESC
    `;
        const result = await this.db.query(query, [userId]);
        return result.rows.map(row => (Object.assign(Object.assign({}, this.toDomainModel(row)), { groupName: row.group_name || undefined })));
    }
}
exports.EndpointRepository = EndpointRepository;
