"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
/**
 * Base repository class providing common database operations
 */
class BaseRepository {
    constructor(db, tableName) {
        this.db = db;
        this.tableName = tableName;
    }
    /**
     * Find a record by ID
     */
    async findById(id) {
        const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
        const result = await this.db.query(query, [id]);
        return result.rows[0] || null;
    }
    /**
     * Find all records with optional conditions
     */
    async findAll(conditions) {
        let query = `SELECT * FROM ${this.tableName}`;
        const params = [];
        if (conditions && Object.keys(conditions).length > 0) {
            const whereClause = Object.keys(conditions)
                .map((key, index) => `${key} = $${index + 1}`)
                .join(' AND ');
            query += ` WHERE ${whereClause}`;
            params.push(...Object.values(conditions));
        }
        const result = await this.db.query(query, params);
        return result.rows;
    }
    /**
     * Find records with custom query
     */
    async findByQuery(query, params) {
        const result = await this.db.query(query, params);
        return result.rows;
    }
    /**
     * Find a single record with custom query
     */
    async findOneByQuery(query, params) {
        const result = await this.db.query(query, params);
        return result.rows[0] || null;
    }
    /**
     * Create a new record
     */
    async create(data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
        const columns = keys.join(', ');
        const query = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${placeholders})
      RETURNING *
    `;
        const result = await this.db.query(query, values);
        return result.rows[0];
    }
    /**
     * Update a record by ID
     */
    async update(id, data) {
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
        const result = await this.db.query(query, [id, ...values]);
        return result.rows[0] || null;
    }
    /**
     * Delete a record by ID
     */
    async delete(id) {
        const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
        const result = await this.db.query(query, [id]);
        return result.rowCount > 0;
    }
    /**
     * Count records with optional conditions
     */
    async count(conditions) {
        let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
        const params = [];
        if (conditions && Object.keys(conditions).length > 0) {
            const whereClause = Object.keys(conditions)
                .map((key, index) => `${key} = $${index + 1}`)
                .join(' AND ');
            query += ` WHERE ${whereClause}`;
            params.push(...Object.values(conditions));
        }
        const result = await this.db.query(query, params);
        return parseInt(result.rows[0].count, 10);
    }
    /**
     * Check if a record exists
     */
    async exists(id) {
        const query = `SELECT 1 FROM ${this.tableName} WHERE id = $1 LIMIT 1`;
        const result = await this.db.query(query, [id]);
        return result.rows.length > 0;
    }
    /**
     * Execute a custom query within a transaction
     */
    async executeInTransaction(callback) {
        return await this.db.transaction(callback);
    }
    /**
     * Batch insert records
     */
    async batchInsert(records) {
        if (records.length === 0) {
            return [];
        }
        return await this.executeInTransaction(async (client) => {
            const results = [];
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
                const result = await client.query(query, values);
                results.push(result.rows[0]);
            }
            return results;
        });
    }
}
exports.BaseRepository = BaseRepository;
