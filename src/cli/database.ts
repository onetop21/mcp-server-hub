#!/usr/bin/env node

import { DatabaseConnection } from '../infrastructure/database/connection';
import { MigrationRunner } from '../infrastructure/database/migrationRunner';
import { DatabaseConfigManager } from '../infrastructure/config/DatabaseConfig';

/**
 * Database CLI tool for migrations and management
 */
class DatabaseCLI {
  private db: DatabaseConnection;
  private migrationRunner: MigrationRunner;

  constructor() {
    const config = DatabaseConfigManager.getConfig();
    this.db = new DatabaseConnection(config);
    this.migrationRunner = new MigrationRunner(this.db);
  }

  /**
   * Run migrations
   */
  async migrate(): Promise<void> {
    try {
      await this.db.connect();
      await this.migrationRunner.runMigrations();
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    } finally {
      await this.db.disconnect();
    }
  }

  /**
   * Rollback last migration
   */
  async rollback(): Promise<void> {
    try {
      await this.db.connect();
      await this.migrationRunner.rollbackLastMigration();
    } catch (error) {
      console.error('Rollback failed:', error);
      process.exit(1);
    } finally {
      await this.db.disconnect();
    }
  }

  /**
   * Show migration status
   */
  async status(): Promise<void> {
    try {
      await this.db.connect();
      const status = await this.migrationRunner.getMigrationStatus();
      
      console.log('\n📊 Migration Status:');
      console.log('==================');
      
      status.forEach(({ name, applied, appliedAt }) => {
        const statusIcon = applied ? '✅' : '⏳';
        const appliedText = applied ? `(applied: ${appliedAt?.toISOString()})` : '(pending)';
        console.log(`${statusIcon} ${name} ${appliedText}`);
      });
      
      console.log('');
    } catch (error) {
      console.error('Status check failed:', error);
      process.exit(1);
    } finally {
      await this.db.disconnect();
    }
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<void> {
    try {
      const config = DatabaseConfigManager.getConfig();
      console.log('🔗 Testing database connection...');
      console.log(`📍 Connection: ${DatabaseConfigManager.getConnectionString(config)}`);
      
      await this.db.connect();
      
      const result = await this.db.query('SELECT version()');
      console.log('✅ Database connection successful!');
      console.log(`📊 PostgreSQL version: ${result.rows[0].version}`);
      
      const stats = this.db.getPoolStats();
      if (stats) {
        console.log(`🏊 Pool stats: ${stats.totalCount} total, ${stats.idleCount} idle, ${stats.waitingCount} waiting`);
      }
      
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      process.exit(1);
    } finally {
      await this.db.disconnect();
    }
  }

  /**
   * Show help
   */
  showHelp(): void {
    console.log(`
🗄️  MCP Hub Router Database CLI

Usage: npm run db <command>

Commands:
  migrate     Run pending database migrations
  rollback    Rollback the last migration
  status      Show migration status
  test        Test database connection
  help        Show this help message

Examples:
  npm run db migrate
  npm run db status
  npm run db test

Environment Variables:
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
  See .env.example for full configuration options
    `);
  }
}

// CLI entry point
async function main() {
  const cli = new DatabaseCLI();
  const command = process.argv[2];

  switch (command) {
    case 'migrate':
      await cli.migrate();
      break;
    case 'rollback':
      await cli.rollback();
      break;
    case 'status':
      await cli.status();
      break;
    case 'test':
      await cli.testConnection();
      break;
    case 'help':
    case '--help':
    case '-h':
      cli.showHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      cli.showHelp();
      process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('CLI error:', error);
    process.exit(1);
  });
}

export { DatabaseCLI };