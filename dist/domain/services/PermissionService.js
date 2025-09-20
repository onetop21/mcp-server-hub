"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionService = void 0;
const IPermissionService_1 = require("./IPermissionService");
class PermissionService {
    /**
     * Check if an API key has permission to perform an action on a resource
     */
    hasPermission(permissions, resource, action) {
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
    canAccessServer(permissions, serverId) {
        return this.hasPermission(permissions, `${IPermissionService_1.ResourceType.SERVER}:${serverId}`, IPermissionService_1.ActionType.READ) ||
            this.hasPermission(permissions, IPermissionService_1.ResourceType.SERVER, IPermissionService_1.ActionType.ALL) ||
            this.hasPermission(permissions, '*', IPermissionService_1.ActionType.ALL);
    }
    /**
     * Check if an API key has permission to access a specific group
     */
    canAccessGroup(permissions, groupId) {
        return this.hasPermission(permissions, `${IPermissionService_1.ResourceType.GROUP}:${groupId}`, IPermissionService_1.ActionType.READ) ||
            this.hasPermission(permissions, IPermissionService_1.ResourceType.GROUP, IPermissionService_1.ActionType.ALL) ||
            this.hasPermission(permissions, '*', IPermissionService_1.ActionType.ALL);
    }
    /**
     * Check if an API key has permission to call a specific tool
     */
    canCallTool(permissions, toolName) {
        return this.hasPermission(permissions, `${IPermissionService_1.ResourceType.TOOL}:${toolName}`, IPermissionService_1.ActionType.EXECUTE) ||
            this.hasPermission(permissions, IPermissionService_1.ResourceType.TOOL, IPermissionService_1.ActionType.ALL) ||
            this.hasPermission(permissions, '*', IPermissionService_1.ActionType.ALL);
    }
    /**
     * Get all allowed resources for a set of permissions
     */
    getAllowedResources(permissions) {
        const resources = new Set();
        for (const permission of permissions) {
            resources.add(permission.resource);
        }
        return Array.from(resources);
    }
    /**
     * Get all allowed actions for a resource
     */
    getAllowedActions(permissions, resource) {
        const actions = new Set();
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
    validatePermission(permission) {
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
    createDefaultPermissions(userId) {
        return [
            {
                resource: `${IPermissionService_1.ResourceType.USER}:${userId}`,
                actions: [IPermissionService_1.ActionType.READ, IPermissionService_1.ActionType.WRITE],
            },
            {
                resource: `${IPermissionService_1.ResourceType.SERVER}:${userId}:*`,
                actions: [IPermissionService_1.ActionType.READ, IPermissionService_1.ActionType.WRITE, IPermissionService_1.ActionType.DELETE, IPermissionService_1.ActionType.MANAGE],
            },
            {
                resource: `${IPermissionService_1.ResourceType.GROUP}:${userId}:*`,
                actions: [IPermissionService_1.ActionType.READ, IPermissionService_1.ActionType.WRITE, IPermissionService_1.ActionType.DELETE, IPermissionService_1.ActionType.MANAGE],
            },
            {
                resource: `${IPermissionService_1.ResourceType.TOOL}:${userId}:*`,
                actions: [IPermissionService_1.ActionType.EXECUTE],
            },
            {
                resource: `${IPermissionService_1.ResourceType.ENDPOINT}:${userId}:*`,
                actions: [IPermissionService_1.ActionType.READ, IPermissionService_1.ActionType.EXECUTE],
            },
        ];
    }
    /**
     * Create admin permissions
     */
    createAdminPermissions() {
        return [
            {
                resource: '*',
                actions: [IPermissionService_1.ActionType.ALL],
            },
        ];
    }
    /**
     * Merge multiple permission sets
     */
    mergePermissions(permissionSets) {
        const mergedMap = new Map();
        // Collect all permissions by resource
        for (const permissionSet of permissionSets) {
            for (const permission of permissionSet) {
                if (!mergedMap.has(permission.resource)) {
                    mergedMap.set(permission.resource, new Set());
                }
                const actions = mergedMap.get(permission.resource);
                permission.actions.forEach(action => actions.add(action));
            }
        }
        // Convert back to Permission array
        const merged = [];
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
    matchesResource(permissionResource, targetResource) {
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
    matchesAction(permissionActions, targetAction) {
        return permissionActions.includes(targetAction) ||
            permissionActions.includes(IPermissionService_1.ActionType.ALL);
    }
}
exports.PermissionService = PermissionService;
