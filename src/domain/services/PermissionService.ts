import { Permission } from '../models/ApiKey';
import { IPermissionService, ResourceType, ActionType } from './IPermissionService';

export class PermissionService implements IPermissionService {
  /**
   * Check if an API key has permission to perform an action on a resource
   */
  hasPermission(permissions: Permission[], resource: string, action: string): boolean {
    for (const permission of permissions) {
      if (this.matchesResource(permission.resource, resource) && 
          this.matchesAction(permission.actions, action)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if an API key has permission to access a specific server
   */
  canAccessServer(permissions: Permission[], serverId: string): boolean {
    return this.hasPermission(permissions, `${ResourceType.SERVER}:${serverId}`, ActionType.READ) ||
           this.hasPermission(permissions, ResourceType.SERVER, ActionType.ALL) ||
           this.hasPermission(permissions, '*', ActionType.ALL);
  }

  /**
   * Check if an API key has permission to access a specific group
   */
  canAccessGroup(permissions: Permission[], groupId: string): boolean {
    return this.hasPermission(permissions, `${ResourceType.GROUP}:${groupId}`, ActionType.READ) ||
           this.hasPermission(permissions, ResourceType.GROUP, ActionType.ALL) ||
           this.hasPermission(permissions, '*', ActionType.ALL);
  }

  /**
   * Check if an API key has permission to call a specific tool
   */
  canCallTool(permissions: Permission[], toolName: string): boolean {
    return this.hasPermission(permissions, `${ResourceType.TOOL}:${toolName}`, ActionType.EXECUTE) ||
           this.hasPermission(permissions, ResourceType.TOOL, ActionType.ALL) ||
           this.hasPermission(permissions, '*', ActionType.ALL);
  }

  /**
   * Get all allowed resources for a set of permissions
   */
  getAllowedResources(permissions: Permission[]): string[] {
    const resources = new Set<string>();
    
    for (const permission of permissions) {
      resources.add(permission.resource);
    }
    
    return Array.from(resources);
  }

  /**
   * Get all allowed actions for a resource
   */
  getAllowedActions(permissions: Permission[], resource: string): string[] {
    const actions = new Set<string>();
    
    for (const permission of permissions) {
      if (this.matchesResource(permission.resource, resource)) {
        permission.actions.forEach(action => actions.add(action));
      }
    }
    
    return Array.from(actions);
  }

  /**
   * Validate permission format
   */
  validatePermission(permission: Permission): boolean {
    if (!permission.resource || typeof permission.resource !== 'string') {
      return false;
    }
    
    if (!Array.isArray(permission.actions) || permission.actions.length === 0) {
      return false;
    }
    
    // Check if all actions are valid strings
    for (const action of permission.actions) {
      if (typeof action !== 'string' || action.trim() === '') {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Create default permissions for a new API key
   */
  createDefaultPermissions(userId: string): Permission[] {
    return [
      {
        resource: `${ResourceType.USER}:${userId}`,
        actions: [ActionType.READ, ActionType.WRITE],
      },
      {
        resource: `${ResourceType.SERVER}:${userId}:*`,
        actions: [ActionType.READ, ActionType.WRITE, ActionType.DELETE, ActionType.MANAGE],
      },
      {
        resource: `${ResourceType.GROUP}:${userId}:*`,
        actions: [ActionType.READ, ActionType.WRITE, ActionType.DELETE, ActionType.MANAGE],
      },
      {
        resource: `${ResourceType.TOOL}:${userId}:*`,
        actions: [ActionType.EXECUTE],
      },
      {
        resource: `${ResourceType.ENDPOINT}:${userId}:*`,
        actions: [ActionType.READ, ActionType.EXECUTE],
      },
    ];
  }

  /**
   * Create admin permissions
   */
  createAdminPermissions(): Permission[] {
    return [
      {
        resource: '*',
        actions: [ActionType.ALL],
      },
    ];
  }

  /**
   * Merge multiple permission sets
   */
  mergePermissions(permissionSets: Permission[][]): Permission[] {
    const mergedMap = new Map<string, Set<string>>();
    
    // Collect all permissions by resource
    for (const permissionSet of permissionSets) {
      for (const permission of permissionSet) {
        if (!mergedMap.has(permission.resource)) {
          mergedMap.set(permission.resource, new Set());
        }
        
        const actions = mergedMap.get(permission.resource)!;
        permission.actions.forEach(action => actions.add(action));
      }
    }
    
    // Convert back to Permission array
    const merged: Permission[] = [];
    for (const [resource, actions] of mergedMap) {
      merged.push({
        resource,
        actions: Array.from(actions),
      });
    }
    
    return merged;
  }

  /**
   * Check if a permission resource matches a target resource
   */
  private matchesResource(permissionResource: string, targetResource: string): boolean {
    // Exact match
    if (permissionResource === targetResource) {
      return true;
    }
    
    // Wildcard match
    if (permissionResource === '*') {
      return true;
    }
    
    // Pattern match with wildcards
    if (permissionResource.includes('*')) {
      const pattern = permissionResource.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(targetResource);
    }
    
    return false;
  }

  /**
   * Check if permission actions include the target action
   */
  private matchesAction(permissionActions: string[], targetAction: string): boolean {
    return permissionActions.includes(targetAction) || 
           permissionActions.includes(ActionType.ALL);
  }
}