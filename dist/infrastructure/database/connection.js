"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseConnection = void 0;
const pg_1 = require("pg");
/**
 * Database connection manager
 *
 * Manages PostgreSQL connections using connection pooling
 */
class DatabaseConnection {
    constructor(config) {
        this.pool = null;
        this.config = config;
    }
    /**
     * Initialize the database connection pool
     */
    async connect() {
        if (this.pool) {
            console.log('Database connection already exists');
            return;
        }
        console.log('Creating database connection pool...');
        console.log('Connection config:', {
            host: this.config.host,
            port: this.config.port,
            database: this.config.database,
            user: this.config.username,
            ssl: this.config.ssl
        });
        this.pool = new pg_1.Pool({
            host: this.config.host,
            port: this.config.port,
            database: this.config.database,
            user: this.config.username,
            password: this.config.password,
            ssl: this.config.ssl,
            max: this.config.maxConnections || 20,
            connectionTimeoutMillis: this.config.connectionTimeoutMillis || 5000,
            idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
        });
        // Test the connection
        try {
            console.log('Testing database connection...');
            const client = await this.pool.connect();
            await client.query('SELECT 1');
            client.release();
            console.log('Database connection established successfully');
        }
        catch (error) {
            console.error('Failed to connect to database:', error);
            throw error;
        }
    }
    /**
     * Close the database connection pool
     */
    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            console.log('Database connection closed');
        }
    }
    /**
     * Execute a query
     */
    async query(text, params) {
        if (!this.pool) {
            throw new Error('Database not connected');
        }
        try {
            const result = await this.pool.query(text, params);
            return result;
        }
        catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }
    /**
     * Get a client from the pool for transactions
     */
    async getClient() {
        if (!this.pool) {
            throw new Error('Database not connected');
        }
        return await this.pool.connect();
    }
    /**
     * Execute multiple queries in a transaction
     */
    async transaction(callback) {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Check if the database is connected
     */
    isConnected() {
        return this.pool !== null;
    }
    /**
     * Get connection pool statistics
     */
    getPoolStats() {
        if (!this.pool) {
            return null;
        }
        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount,
        };
    }
}
exports.DatabaseConnection = DatabaseConnection;
