"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerGroupRepository = void 0;
const BaseRepository_1 = require("../database/BaseRepository");
/**
 * Server group repository for database operations
 */
class ServerGroupRepository extends BaseRepository_1.BaseRepository {
    constructor(db) {
        super(db, 'server_groups');
    }
    /**
     * Convert database row to domain model
     */
    toDomainModel(row, serverIds = []) {
        return {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            description: row.description || '',
            serverIds,
            routingRules: row.routing_rules || [],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    /**
     * Convert domain model to database row
     */
    toDbRow(group) {
        const row = {};
        if (group.userId !== undefined)
            row.user_id = group.userId;
        if (group.name !== undefined)
            row.name = group.name;
        if (group.description !== undefined)
            row.description = group.description;
        if (group.routingRules !== undefined)
            row.routing_rules = group.routingRules;
        if (group.createdAt !== undefined)
            row.created_at = group.createdAt;
        if (group.updatedAt !== undefined)
            row.updated_at = group.updatedAt;
        return row;
    }
    /**
     * Create a new server group
     */
    async createGroup(userId, groupConfig) {
        const groupData = {
            userId,
            name: groupConfig.name,
            description: groupConfig.description,
            routingRules: [],
        };
        const dbRow = this.toDbRow(groupData);
        const createdRow = await super.create(dbRow);
        // If initial servers are provided, add them to the group
        let serverIds = [];
        if (groupConfig.serverIds && groupConfig.serverIds.length > 0) {
            await this.addServersToGroup(createdRow.id, groupConfig.serverIds);
            serverIds = groupConfig.serverIds;
        }
        return this.toDomainModel(createdRow, serverIds);
    }
    /**
     * Find group by ID with server IDs
     */
    async findGroupById(id) {
        const row = await super.findById(id);
        if (!row)
            return null;
        const serverIds = await this.getServerIdsByGroupId(id);
        return this.toDomainModel(row, serverIds);
    }
    /**
     * Find groups by user ID
     */
    async findByUserId(userId) {
        const rows = await this.findAll({ user_id: userId });
        // Get server IDs for each group
        const groups = await Promise.all(rows.map(async (row) => {
            const serverIds = await this.getServerIdsByGroupId(row.id);
            return this.toDomainModel(row, serverIds);
        }));
        return groups;
    }
    /**
     * Find group by user ID and name
     */
    async findByUserIdAndName(userId, name) {
        const query = 'SELECT * FROM server_groups WHERE user_id = $1 AND name = $2';
        const row = await this.findOneByQuery(query, [userId, name]);
        if (!row)
            return null;
        const serverIds = await this.getServerIdsByGroupId(row.id);
        return this.toDomainModel(row, serverIds);
    }
    /**
     * Update group
     */
    async updateGroup(id, updates) {
        const dbRow = this.toDbRow(updates);
        const updatedRow = await super.update(id, dbRow);
        if (!updatedRow)
            return null;
        const serverIds = await this.getServerIdsByGroupId(id);
        return this.toDomainModel(updatedRow, serverIds);
    }
    /**
     * Delete group and its memberships
     */
    async deleteGroup(id) {
        await this.executeInTransaction(async (client) => {
            // Delete group memberships first
            await client.query('DELETE FROM server_group_members WHERE group_id = $1', [id]);
            // Delete the group
            await client.query('DELETE FROM server_groups WHERE id = $1', [id]);
        });
    }
    /**
     * Add servers to group
     */
    async addServersToGroup(groupId, serverIds) {
        if (serverIds.length === 0)
            return;
        await this.executeInTransaction(async (client) => {
            for (const serverId of serverIds) {
                // Use INSERT ... ON CONFLICT to avoid duplicate entries
                const query = `
          INSERT INTO server_group_members (server_id, group_id) 
          VALUES ($1, $2) 
          ON CONFLICT (server_id, group_id) DO NOTHING
        `;
                await client.query(query, [serverId, groupId]);
            }
        });
    }
    /**
     * Remove servers from group
     */
    async removeServersFromGroup(groupId, serverIds) {
        if (serverIds.length === 0)
            return;
        const placeholders = serverIds.map((_, index) => `$${index + 2}`).join(', ');
        const query = `DELETE FROM server_group_members WHERE group_id = $1 AND server_id IN (${placeholders})`;
        await this.db.query(query, [groupId, ...serverIds]);
    }
    /**
     * Add single server to group
     */
    async addServerToGroup(serverId, groupId) {
        const query = `
      INSERT INTO server_group_members (server_id, group_id) 
      VALUES ($1, $2) 
      ON CONFLICT (server_id, group_id) DO NOTHING
    `;
        await this.db.query(query, [serverId, groupId]);
    }
    /**
     * Remove single server from group
     */
    async removeServerFromGroup(serverId, groupId) {
        const query = 'DELETE FROM server_group_members WHERE server_id = $1 AND group_id = $2';
        await this.db.query(query, [serverId, groupId]);
    }
    /**
     * Get server IDs by group ID
     */
    async getServerIdsByGroupId(groupId) {
        const query = 'SELECT server_id FROM server_group_members WHERE group_id = $1 ORDER BY created_at';
        const result = await this.db.query(query, [groupId]);
        return result.rows.map(row => row.server_id);
    }
    /**
     * Get groups by server ID
     */
    async getGroupsByServerId(serverId) {
        const query = `
      SELECT sg.* 
      FROM server_groups sg
      JOIN server_group_members sgm ON sg.id = sgm.group_id
      WHERE sgm.server_id = $1
      ORDER BY sg.created_at
    `;
        const result = await this.db.query(query, [serverId]);
        // Get server IDs for each group
        const groups = await Promise.all(result.rows.map(async (row) => {
            const serverIds = await this.getServerIdsByGroupId(row.id);
            return this.toDomainModel(row, serverIds);
        }));
        return groups;
    }
    /**
     * Check if group name exists for user
     */
    async nameExistsForUser(userId, name, excludeId) {
        let query = 'SELECT 1 FROM server_groups WHERE user_id = $1 AND name = $2';
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
     * Update routing rules for a group
     */
    async updateRoutingRules(groupId, routingRules) {
        const query = `
      UPDATE server_groups 
      SET routing_rules = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `;
        await this.db.query(query, [JSON.stringify(routingRules), groupId]);
    }
    /**
     * Get group statistics
     */
    async getStatistics() {
        var _a;
        const totalGroups = await this.count();
        const membershipQuery = 'SELECT COUNT(*) as count FROM server_group_members';
        const membershipResult = await this.db.query(membershipQuery);
        const totalMemberships = parseInt(((_a = membershipResult.rows[0]) === null || _a === void 0 ? void 0 : _a.count) || '0', 10);
        const averageServersPerGroup = totalGroups > 0 ? totalMemberships / totalGroups : 0;
        return {
            total: totalGroups,
            totalMemberships,
            averageServersPerGroup: Math.round(averageServersPerGroup * 100) / 100,
        };
    }
}
exports.ServerGroupRepository = ServerGroupRepository;
