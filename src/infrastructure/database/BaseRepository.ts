import { PoolClient, QueryResult } from 'pg';
import { DatabaseConnection } from './connection';

/**
 * Base repository class providing common database operations
 */
export abstract class BaseRepository<T> {
  protected db: DatabaseConnection;
  protected tableName: string;

  constructor(db: DatabaseConnection, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  /**
   * Find a record by ID
   */
  async findById(id: string): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const result = await this.db.query<T>(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find all records with optional conditions
   */
  async findAll(conditions?: Record<string, any>): Promise<T[]> {
    let query = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];

    if (conditions && Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
      params.push(...Object.values(conditions));
    }

    const result = await this.db.query<T>(query, params);
    return result.rows;
  }

  /**
   * Find records with custom query
   */
  async findByQuery(query: string, params?: any[]): Promise<T[]> {
    const result = await this.db.query<T>(query, params);
    return result.rows;
  }

  /**
   * Find a single record with custom query
   */
  async findOneByQuery(query: string, params?: any[]): Promise<T | null> {
    const result = await this.db.query<T>(query, params);
    return result.rows[0] || null;
  }

  /**
   * Create a new record
   */
  async create(data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    const columns = keys.join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.db.query<T>(query, values);
    return result.rows[0];
  }

  /**
   * Update a record by ID
   */
  async update(id: string, data: Partial<T>): Promise<T | null> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    if (keys.length === 0) {
      return this.findById(id);
    }

    const setClause = keys
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query<T>(query, [id, ...values]);
    return result.rows[0] || null;
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Count records with optional conditions
   */
  async count(conditions?: Record<string, any>): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params: any[] = [];

    if (conditions && Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
      params.push(...Object.values(conditions));
    }

    const result = await this.db.query<{ count: string }>(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Check if a record exists
   */
  async exists(id: string): Promise<boolean> {
    const query = `SELECT 1 FROM ${this.tableName} WHERE id = $1 LIMIT 1`;
    const result = await this.db.query(query, [id]);
    return result.rows.length > 0;
  }

  /**
   * Execute a custom query within a transaction
   */
  async executeInTransaction<R>(
    callback: (client: PoolClient) => Promise<R>
  ): Promise<R> {
    return await this.db.transaction(callback);
  }

  /**
   * Batch insert records
   */
  async batchInsert(records: Partial<T>[]): Promise<T[]> {
    if (records.length === 0) {
      return [];
    }

    return await this.executeInTransaction(async (client) => {
      const results: T[] = [];
      
      for (const record of records) {
        const keys = Object.keys(record);
        const values = Object.values(record);
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
        const columns = keys.join(', ');

        const query = `
          INSERT INTO ${this.tableName} (${columns})
          VALUES (${placeholders})
          RETURNING *
        `;

        const result = await client.query<T>(query, values);
        results.push(result.rows[0]);
      }

      return results;
    });
  }
}