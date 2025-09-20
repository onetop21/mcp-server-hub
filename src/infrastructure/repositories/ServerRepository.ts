import { RegisteredServer, ServerProtocol, ServerStatus, ServerConfig } from '../../domain/models/Server';
import { BaseRepository } from '../database/BaseRepository';
import { DatabaseConnection } from '../database/connection';

/**
 * Database representation of Server
 */
interface ServerRow {
  id: string;
  user_id: string;
  name: string;
  protocol: string;
  config: any; // JSONB
  namespace: string | null;
  status: string;
  last_health_check: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Server repository for database operations
 */
export class ServerRepository extends BaseRepository<ServerRow> {
  constructor(db: DatabaseConnection) {
    super(db, 'servers');
  }

  /**
   * Convert database row to domain model
   */
  private toDomainModel(row: ServerRow): RegisteredServer {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      protocol: row.protocol as ServerProtocol,
      config: row.config as ServerConfig,
      namespace: row.namespace || undefined,
      status: row.status as ServerStatus,
      lastHealthCheck: row.last_health_check || new Date(),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert domain model to database row
   */
  private toDbRow(server: Partial<RegisteredServer>): Partial<ServerRow> {
    const row: Partial<ServerRow> = {};
    
    if (server.userId !== undefined) row.user_id = server.userId;
    if (server.name !== undefined) row.name = server.name;
    if (server.protocol !== undefined) row.protocol = server.protocol;
    if (server.config !== undefined) row.config = server.config;
    if (server.namespace !== undefined) row.namespace = server.namespace;
    if (server.status !== undefined) row.status = server.status;
    if (server.lastHealthCheck !== undefined) row.last_health_check = server.lastHealthCheck;
    if (server.createdAt !== undefined) row.created_at = server.createdAt;
    if (server.updatedAt !== undefined) row.updated_at = server.updatedAt;

    return row;
  }

  /**
   * Find server by ID
   */
  async findServerById(id: string): Promise<RegisteredServer | null> {
    const row = await super.findById(id);
    return row ? this.toDomainModel(row) : null;
  }

  /**
   * Find servers by user ID
   */
  async findByUserId(userId: string): Promise<RegisteredServer[]> {
    const rows = await this.findAll({ user_id: userId });
    return rows.map(row => this.toDomainModel(row));
  }

  /**
   * Find server by user ID and name
   */
  async findByUserIdAndName(userId: string, name: string): Promise<RegisteredServer | null> {
    const query = 'SELECT * FROM servers WHERE user_id = $1 AND name = $2';
    const row = await this.findOneByQuery(query, [userId, name]);
    return row ? this.toDomainModel(row) : null;
  }

  /**
   * Find servers by protocol
   */
  async findByProtocol(protocol: ServerProtocol): Promise<RegisteredServer[]> {
    const rows = await this.findAll({ protocol });
    return rows.map(row => this.toDomainModel(row));
  }

  /**
   * Find servers by status
   */
  async findByStatus(status: ServerStatus): Promise<RegisteredServer[]> {
    const rows = await this.findAll({ status });
    return rows.map(row => this.toDomainModel(row));
  }

  /**
   * Find servers by user ID and status
   */
  async findByUserIdAndStatus(userId: string, status: ServerStatus): Promise<RegisteredServer[]> {
    const rows = await this.findAll({ user_id: userId, status });
    return rows.map(row => this.toDomainModel(row));
  }

  /**
   * Create a new server
   */
  async createServer(serverData: Omit<RegisteredServer, 'id' | 'createdAt' | 'updatedAt'>): Promise<RegisteredServer> {
    const dbRow = this.toDbRow(serverData);
    const createdRow = await super.create(dbRow);
    return this.toDomainModel(createdRow);
  }

  /**
   * Update server
   */
  async updateServer(id: string, serverData: Partial<RegisteredServer>): Promise<RegisteredServer | null> {
    const dbRow = this.toDbRow(serverData);
    const updatedRow = await super.update(id, dbRow);
    return updatedRow ? this.toDomainModel(updatedRow) : null;
  }

  /**
   * Update server status
   */
  async updateStatus(id: string, status: ServerStatus): Promise<void> {
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
  async updateMultipleStatuses(updates: Array<{ id: string; status: ServerStatus }>): Promise<void> {
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
  async findServersNeedingHealthCheck(olderThanMinutes: number = 5): Promise<RegisteredServer[]> {
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
  async getStatistics(): Promise<{
    total: number;
    byProtocol: Record<ServerProtocol, number>;
    byStatus: Record<ServerStatus, number>;
  }> {
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
      this.db.query<{ protocol: string; count: string }>(protocolQuery),
      this.db.query<{ status: string; count: string }>(statusQuery),
    ]);
    
    const byProtocol = {} as Record<ServerProtocol, number>;
    const byStatus = {} as Record<ServerStatus, number>;
    
    // Initialize all protocols and statuses with 0
    Object.values(ServerProtocol).forEach(protocol => {
      byProtocol[protocol] = 0;
    });
    
    Object.values(ServerStatus).forEach(status => {
      byStatus[status] = 0;
    });
    
    // Fill in actual counts
    protocolResult.rows.forEach(row => {
      byProtocol[row.protocol as ServerProtocol] = parseInt(row.count, 10);
    });
    
    statusResult.rows.forEach(row => {
      byStatus[row.status as ServerStatus] = parseInt(row.count, 10);
    });
    
    return { total, byProtocol, byStatus };
  }

  /**
   * Check if server name exists for user
   */
  async nameExistsForUser(userId: string, name: string, excludeId?: string): Promise<boolean> {
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
  async findServersWithGroups(userId: string): Promise<Array<RegisteredServer & { groupIds: string[] }>> {
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
    
    const result = await this.db.query<ServerRow & { group_ids: string[] }>(query, [userId]);
    
    return result.rows.map(row => ({
      ...this.toDomainModel(row),
      groupIds: row.group_ids || [],
    }));
  }
}