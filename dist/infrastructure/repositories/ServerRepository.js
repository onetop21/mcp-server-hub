"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerRepository = void 0;
const Server_1 = require("../../domain/models/Server");
const BaseRepository_1 = require("../database/BaseRepository");
/**
 * Server repository for database operations
 */
class ServerRepository extends BaseRepository_1.BaseRepository {
    constructor(db) {
        super(db, 'servers');
    }
    /**
     * Convert database row to domain model
     */
    toDomainModel(row) {
        return {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            protocol: row.protocol,
            config: row.config,
            namespace: row.namespace || undefined,
            status: row.status,
            lastHealthCheck: row.last_health_check || new Date(),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    /**
     * Convert domain model to database row
     */
    toDbRow(server) {
        const row = {};
        if (server.userId !== undefined)
            row.user_id = server.userId;
        if (server.name !== undefined)
            row.name = server.name;
        if (server.protocol !== undefined)
            row.protocol = server.protocol;
        if (server.config !== undefined)
            row.config = server.config;
        if (server.namespace !== undefined)
            row.namespace = server.namespace;
        if (server.status !== undefined)
            row.status = server.status;
        if (server.lastHealthCheck !== undefined)
            row.last_health_check = server.lastHealthCheck;
        if (server.createdAt !== undefined)
            row.created_at = server.createdAt;
        if (server.updatedAt !== undefined)
            row.updated_at = server.updatedAt;
        return row;
    }
    /**
     * Find server by ID
     */
    async findServerById(id) {
        const row = await super.findById(id);
        return row ? this.toDomainModel(row) : null;
    }
    /**
     * Find servers by user ID
     */
    async findByUserId(userId) {
        const rows = await this.findAll({ user_id: userId });
        return rows.map(row => this.toDomainModel(row));
    }
    /**
     * Find server by user ID and name
     */
    async findByUserIdAndName(userId, name) {
        const query = 'SELECT * FROM servers WHERE user_id = $1 AND name = $2';
        const row = await this.findOneByQuery(query, [userId, name]);
        return row ? this.toDomainModel(row) : null;
    }
    /**
     * Find servers by protocol
     */
    async findByProtocol(protocol) {
        const rows = await this.findAll({ protocol });
        return rows.map(row => this.toDomainModel(row));
    }
    /**
     * Find servers by status
     */
    async findByStatus(status) {
        const rows = await this.findAll({ status });
        return rows.map(row => this.toDomainModel(row));
    }
    /**
     * Find servers by user ID and status
     */
    async findByUserIdAndStatus(userId, status) {
        const rows = await this.findAll({ user_id: userId, status });
        return rows.map(row => this.toDomainModel(row));
    }
    /**
     * Create a new server
     */
    async createServer(serverData) {
        const dbRow = this.toDbRow(serverData);
        const createdRow = await super.create(dbRow);
        return this.toDomainModel(createdRow);
    }
    /**
     * Update server
     */
    async updateServer(id, serverData) {
        const dbRow = this.toDbRow(serverData);
        const updatedRow = await super.update(id, dbRow);
        return updatedRow ? this.toDomainModel(updatedRow) : null;
    }
    /**
     * Update server status
     */
    async updateStatus(id, status) {
        const query = `
      UPDATE servers 
      SET status = $1, last_health_check = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `;
        await this.db.query(query, [status, id]);
    }
    /**
     * Update multiple server statuses
     */
    async updateMultipleStatuses(updates) {
        await this.executeInTransaction(async (client) => {
            for (const update of updates) {
                const query = `
          UPDATE servers 
          SET status = $1, last_health_check = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
          WHERE id = $2
        `;
                await client.query(query, [update.status, update.id]);
            }
        });
    }
    /**
     * Find servers that need health check
     */
    async findServersNeedingHealthCheck(olderThanMinutes = 5) {
        const query = `
      SELECT * FROM servers 
      WHERE status = 'active' 
      AND (last_health_check IS NULL OR last_health_check < NOW() - INTERVAL '${olderThanMinutes} minutes')
      ORDER BY last_health_check ASC NULLS FIRST
    `;
        const rows = await this.findByQuery(query);
        return rows.map(row => this.toDomainModel(row));
    }
    /**
     * Get server statistics
     */
    async getStatistics() {
        const total = await this.count();
        const protocolQuery = `
      SELECT protocol, COUNT(*) as count 
      FROM servers 
      GROUP BY protocol
    `;
        const statusQuery = `
      SELECT status, COUNT(*) as count 
      FROM servers 
      GROUP BY status
    `;
        const [protocolResult, statusResult] = await Promise.all([
            this.db.query(protocolQuery),
            this.db.query(statusQuery),
        ]);
        const byProtocol = {};
        const byStatus = {};
        // Initialize all protocols and statuses with 0
        Object.values(Server_1.ServerProtocol).forEach(protocol => {
            byProtocol[protocol] = 0;
        });
        Object.values(Server_1.ServerStatus).forEach(status => {
            byStatus[status] = 0;
        });
        // Fill in actual counts
        protocolResult.rows.forEach(row => {
            byProtocol[row.protocol] = parseInt(row.count, 10);
        });
        statusResult.rows.forEach(row => {
            byStatus[row.status] = parseInt(row.count, 10);
        });
        return { total, byProtocol, byStatus };
    }
    /**
     * Check if server name exists for user
     */
    async nameExistsForUser(userId, name, excludeId) {
        let query = 'SELECT 1 FROM servers WHERE user_id = $1 AND name = $2';
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
     * Get servers with their group memberships
     */
    async findServersWithGroups(userId) {
        const query = `
      SELECT 
        s.*,
        COALESCE(
          json_agg(sgm.group_id) FILTER (WHERE sgm.group_id IS NOT NULL), 
          '[]'::json
        ) as group_ids
      FROM servers s
      LEFT JOIN server_group_members sgm ON s.id = sgm.server_id
      WHERE s.user_id = $1
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;
        const result = await this.db.query(query, [userId]);
        return result.rows.map(row => (Object.assign(Object.assign({}, this.toDomainModel(row)), { groupIds: row.group_ids || [] })));
    }
}
exports.ServerRepository = ServerRepository;
