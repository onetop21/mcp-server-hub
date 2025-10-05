/**
 * Backup Service Interface
 * Task 19: Backup and Restore System
 */

export interface IBackupService {
  /**
   * Create a backup for a user
   */
  createBackup(userId: string, options?: BackupOptions): Promise<BackupResult>;

  /**
   * List backups for a user
   */
  listBackups(userId: string): Promise<BackupMetadata[]>;

  /**
   * Get backup details
   */
  getBackup(backupId: string, userId: string): Promise<BackupMetadata | null>;

  /**
   * Restore from backup
   */
  restore(backupId: string, userId: string, options?: RestoreOptions): Promise<RestoreResult>;

  /**
   * Delete a backup
   */
  deleteBackup(backupId: string, userId: string): Promise<void>;

  /**
   * Verify backup integrity
   */
  verifyBackup(backupId: string): Promise<{ valid: boolean; errors: string[] }>;
}

export interface BackupOptions {
  includeServers?: boolean;
  includeGroups?: boolean;
  includeEndpoints?: boolean;
  includeApiKeys?: boolean;
  compress?: boolean;
  encrypt?: boolean;
}

export interface BackupResult {
  backupId: string;
  userId: string;
  size: number;
  createdAt: Date;
  checksum: string;
}

export interface BackupMetadata {
  id: string;
  userId: string;
  size: number;
  compressed: boolean;
  encrypted: boolean;
  checksum: string;
  createdAt: Date;
  expiresAt?: Date;
  itemCount: {
    servers: number;
    groups: number;
    endpoints: number;
    apiKeys: number;
  };
}

export interface RestoreOptions {
  overwrite?: boolean;
  skipExisting?: boolean;
  dryRun?: boolean;
}

export interface RestoreResult {
  success: boolean;
  itemsRestored: {
    servers: number;
    groups: number;
    endpoints: number;
    apiKeys: number;
  };
  itemsSkipped: number;
  errors: string[];
}

export interface BackupData {
  version: string;
  userId: string;
  createdAt: Date;
  servers: any[];
  groups: any[];
  endpoints: any[];
  apiKeys: any[];
}

