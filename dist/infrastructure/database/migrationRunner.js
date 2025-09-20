"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationRunner = void 0;
const _001_initial_schema_1 = require("./migrations/001_initial_schema");
/**
 * Database migration runner
 */
class MigrationRunner {
    constructor(db) {
        this.db = db;
        this.migrations = [
            {
                name: '001_initial_schema',
                migration: _001_initial_schema_1.InitialSchemaMigration,
            },
        ];
    }
    /**
     * Run all pending migrations
     */
    async runMigrations() {
        console.log('🔄 Starting database migrations...');
        // Ensure migrations table exists
        await this.ensureMigrationsTable();
        for (const { name, migration: MigrationClass } of this.migrations) {
            const migrationInstance = new MigrationClass(this.db);
            // Check if migration has already been applied
            const isApplied = await this.isMigrationApplied(name);
            if (!isApplied) {
                console.log(`📦 Running migration: ${name}`);
                try {
                    await migrationInstance.up();
                    await this.recordMigration(name);
                    console.log(`✅ Migration ${name} completed`);
                }
                catch (error) {
                    console.error(`❌ Migration ${name} failed:`, error);
                    throw error;
                }
            }
            else {
                console.log(`⏭️  Migration ${name} already applied`);
            }
        }
        console.log('🎉 All migrations completed successfully');
    }
    /**
     * Rollback the last migration
     */
    async rollbackLastMigration() {
        const lastMigration = await this.getLastAppliedMigration();
        if (!lastMigration) {
            console.log('No migrations to rollback');
            return;
        }
        console.log(`🔄 Rolling back migration: ${lastMigration}`);
        const migrationConfig = this.migrations.find(m => m.name === lastMigration);
        if (!migrationConfig) {
            throw new Error(`Migration ${lastMigration} not found`);
        }
        const migrationInstance = new migrationConfig.migration(this.db);
        try {
            await migrationInstance.down();
            await this.removeMigrationRecord(lastMigration);
            console.log(`✅ Migration ${lastMigration} rolled back successfully`);
        }
        catch (error) {
            console.error(`❌ Rollback of ${lastMigration} failed:`, error);
            throw error;
        }
    }
    /**
     * Get migration status
     */
    async getMigrationStatus() {
        await this.ensureMigrationsTable();
        const appliedMigrations = await this.db.query(`
      SELECT name, applied_at FROM migrations ORDER BY applied_at
    `);
        const appliedMap = new Map(appliedMigrations.rows.map(row => [row.name, row.applied_at]));
        return this.migrations.map(({ name }) => ({
            name,
            applied: appliedMap.has(name),
            appliedAt: appliedMap.get(name),
        }));
    }
    /**
     * Ensure migrations tracking table exists
     */
    async ensureMigrationsTable() {
        const createMigrationsTable = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
        await this.db.query(createMigrationsTable);
    }
    /**
     * Check if a migration has been applied
     */
    async isMigrationApplied(name) {
        const result = await this.db.query('SELECT 1 FROM migrations WHERE name = $1', [name]);
        return result.rows.length > 0;
    }
    /**
     * Record that a migration has been applied
     */
    async recordMigration(name) {
        await this.db.query('INSERT INTO migrations (name) VALUES ($1)', [name]);
    }
    /**
     * Remove migration record
     */
    async removeMigrationRecord(name) {
        await this.db.query('DELETE FROM migrations WHERE name = $1', [name]);
    }
    /**
     * Get the last applied migration
     */
    async getLastAppliedMigration() {
        var _a;
        const result = await this.db.query(`
      SELECT name FROM migrations 
      ORDER BY applied_at DESC 
      LIMIT 1
    `);
        return ((_a = result.rows[0]) === null || _a === void 0 ? void 0 : _a.name) || null;
    }
}
exports.MigrationRunner = MigrationRunner;
