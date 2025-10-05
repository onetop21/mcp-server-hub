"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = void 0;
const crypto = __importStar(require("crypto"));
/**
 * Backup Service Implementation
 * Task 19: Backup and Restore System
 *
 * In-memory implementation for MVP
 * Can be extended to use file system or S3 for storage
 */
class BackupService {
    constructor() {
        this.backups = new Map();
    }
    async createBackup(userId, options = {}) {
        const backupId = this.generateBackupId();
        // Default options
        const opts = Object.assign({ includeServers: true, includeGroups: true, includeEndpoints: true, includeApiKeys: false, compress: true, encrypt: false }, options);
        // Collect data
        const backupData = {
            version: '1.0.0',
            userId,
            createdAt: new Date(),
            servers: opts.includeServers ? await this.getServersForUser(userId) : [],
            groups: opts.includeGroups ? await this.getGroupsForUser(userId) : [],
            endpoints: opts.includeEndpoints ? await this.getEndpointsForUser(userId) : [],
            apiKeys: opts.includeApiKeys ? await this.getApiKeysForUser(userId) : []
        };
        // Serialize and calculate checksum
        const serialized = JSON.stringify(backupData);
        const checksum = this.calculateChecksum(serialized);
        const size = Buffer.byteLength(serialized);
        // Create metadata
        const metadata = {
            id: backupId,
            userId,
            size,
            compressed: opts.compress,
            encrypted: opts.encrypt,
            checksum,
            createdAt: new Date(),
            expiresAt: undefined,
            itemCount: {
                servers: backupData.servers.length,
                groups: backupData.groups.length,
                endpoints: backupData.endpoints.length,
                apiKeys: backupData.apiKeys.length
            }
        };
        // Store backup
        this.backups.set(backupId, { metadata, data: backupData });
        console.log(`Backup created: ${backupId} for user ${userId}`);
        return {
            backupId,
            userId,
            size,
            createdAt: metadata.createdAt,
            checksum
        };
    }
    async listBackups(userId) {
        const userBackups = [];
        for (const { metadata } of this.backups.values()) {
            if (metadata.userId === userId) {
                userBackups.push(metadata);
            }
        }
        return userBackups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    async getBackup(backupId, userId) {
        const backup = this.backups.get(backupId);
        if (!backup || backup.metadata.userId !== userId) {
            return null;
        }
        return backup.metadata;
    }
    async restore(backupId, userId, options = {}) {
        const backup = this.backups.get(backupId);
        if (!backup || backup.metadata.userId !== userId) {
            throw new Error('Backup not found');
        }
        const opts = Object.assign({ overwrite: false, skipExisting: true, dryRun: false }, options);
        const result = {
            success: true,
            itemsRestored: {
                servers: 0,
                groups: 0,
                endpoints: 0,
                apiKeys: 0
            },
            itemsSkipped: 0,
            errors: []
        };
        if (opts.dryRun) {
            console.log(`Dry run: Would restore ${backup.metadata.itemCount.servers} servers, ${backup.metadata.itemCount.groups} groups`);
            return result;
        }
        try {
            // Restore servers
            for (const server of backup.data.servers) {
                try {
                    await this.restoreServer(userId, server, opts);
                    result.itemsRestored.servers++;
                }
                catch (error) {
                    result.errors.push(`Server ${server.name}: ${error.message}`);
                }
            }
            // Restore groups
            for (const group of backup.data.groups) {
                try {
                    await this.restoreGroup(userId, group, opts);
                    result.itemsRestored.groups++;
                }
                catch (error) {
                    result.errors.push(`Group ${group.name}: ${error.message}`);
                }
            }
            // Restore endpoints
            for (const endpoint of backup.data.endpoints) {
                try {
                    await this.restoreEndpoint(userId, endpoint, opts);
                    result.itemsRestored.endpoints++;
                }
                catch (error) {
                    result.errors.push(`Endpoint ${endpoint.id}: ${error.message}`);
                }
            }
            console.log(`Backup restored: ${backupId} for user ${userId}`);
        }
        catch (error) {
            result.success = false;
            result.errors.push(`Restore failed: ${error.message}`);
        }
        return result;
    }
    async deleteBackup(backupId, userId) {
        const backup = this.backups.get(backupId);
        if (!backup || backup.metadata.userId !== userId) {
            throw new Error('Backup not found');
        }
        this.backups.delete(backupId);
        console.log(`Backup deleted: ${backupId}`);
    }
    async verifyBackup(backupId) {
        const backup = this.backups.get(backupId);
        const errors = [];
        if (!backup) {
            return { valid: false, errors: ['Backup not found'] };
        }
        // Verify checksum
        const serialized = JSON.stringify(backup.data);
        const calculatedChecksum = this.calculateChecksum(serialized);
        if (calculatedChecksum !== backup.metadata.checksum) {
            errors.push('Checksum mismatch - backup may be corrupted');
        }
        // Verify data structure
        if (!backup.data.version) {
            errors.push('Missing version');
        }
        if (!backup.data.userId) {
            errors.push('Missing userId');
        }
        if (!Array.isArray(backup.data.servers)) {
            errors.push('Invalid servers data');
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    // Private helper methods
    generateBackupId() {
        return `backup_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }
    calculateChecksum(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    async getServersForUser(userId) {
        // TODO: Implement actual data fetching from ServerRepository
        return [];
    }
    async getGroupsForUser(userId) {
        // TODO: Implement actual data fetching
        return [];
    }
    async getEndpointsForUser(userId) {
        // TODO: Implement actual data fetching
        return [];
    }
    async getApiKeysForUser(userId) {
        // TODO: Implement actual data fetching (with encryption)
        return [];
    }
    async restoreServer(userId, server, options) {
        // TODO: Implement actual server restoration
        console.log(`Restoring server: ${server.name}`);
    }
    async restoreGroup(userId, group, options) {
        // TODO: Implement actual group restoration
        console.log(`Restoring group: ${group.name}`);
    }
    async restoreEndpoint(userId, endpoint, options) {
        // TODO: Implement actual endpoint restoration
        console.log(`Restoring endpoint: ${endpoint.id}`);
    }
}
exports.BackupService = BackupService;
