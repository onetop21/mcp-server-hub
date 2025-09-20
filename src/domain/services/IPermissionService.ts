import { Permission } from '../models/ApiKey';

export interface IPermissionService {
  /**
   * Check if an API key has permission to perform an action on a resource
   */
  hasPermission(permissions: Permission[], resource: string, action: string): boolean;

  /**
   * Check if an API key has permission to access a specific server
   */
  canAccessServer(permissions: Permission[], serverId: string): boolean;

  /**
   * Check if an API key has permission to access a specific group
   */
  canAccessGroup(permissions: Permission[], groupId: string): boolean;

  /**
   * Check if an API key has permission to call a specific tool
   */
  canCallTool(permissions: Permission[], toolName: string): boolean;

  /**
   * Get all allowed resources for a set of permissions
   */
  getAllowedResources(permissions: Permission[]): string[];

  /**
   * Get all allowed actions for a resource
   */
  getAllowedActions(permissions: Permission[], resource: string): string[];

  /**
   * Validate permission format
   */
  validatePermission(permission: Permission): boolean;

  /**
   * Create default permissions for a new API key
   */
  createDefaultPermissions(userId: string): Permission[];

  /**
   * Create admin permissions
   */
  createAdminPermissions(): Permission[];

  /**
   * Merge multiple permission sets
   */
  mergePermissions(permissionSets: Permission[][]): Permission[];
}

export enum ResourceType {
  SERVER = 'server',
  GROUP = 'group',
  TOOL = 'tool',
  ENDPOINT = 'endpoint',
  USER = 'user',
  ADMIN = 'admin',
}

export enum ActionType {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  EXECUTE = 'execute',
  MANAGE = 'manage',
  ALL = '*',
}