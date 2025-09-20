"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitialSchemaMigration = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * Initial database schema migration
 */
class InitialSchemaMigration {
    constructor(db) {
        this.db = db;
    }
    /**
     * Apply the migration
     */
    async up() {
        console.log('Running initial schema migration...');
        try {
            // Read the schema SQL file
            const schemaPath = (0, path_1.join)(__dirname, '..', 'schema.sql');
            const schemaSql = (0, fs_1.readFileSync)(schemaPath, 'utf8');
            // Execute the schema
            await this.db.query(schemaSql);
            console.log('✅ Initial schema migration completed successfully');
        }
        catch (error) {
            console.error('❌ Initial schema migration failed:', error);
            throw error;
        }
    }
    /**
     * Rollback the migration
     */
    async down() {
        console.log('Rolling back initial schema migration...');
        const dropTables = `
      DROP TABLE IF EXISTS endpoints CASCADE;
      DROP TABLE IF EXISTS server_group_members CASCADE;
      DROP TABLE IF EXISTS server_groups CASCADE;
      DROP TABLE IF EXISTS servers CASCADE;
      DROP TABLE IF EXISTS api_keys CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at_column();
    `;
        try {
            await this.db.query(dropTables);
            console.log('✅ Initial schema rollback completed successfully');
        }
        catch (error) {
            console.error('❌ Initial schema rollback failed:', error);
            throw error;
        }
    }
    /**
     * Check if migration has been applied
     */
    async isApplied() {
        try {
            const result = await this.db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
            return result.rows[0].exists;
        }
        catch (error) {
            return false;
        }
    }
}
exports.InitialSchemaMigration = InitialSchemaMigration;
