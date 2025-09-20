import { PermissionService } from '../PermissionService';
import { Permission } from '../../models/ApiKey';
import { ResourceType, ActionType } from '../IPermissionService';

describe('PermissionService', () => {
  let permissionService: PermissionService;

  beforeEach(() => {
    permissionService = new PermissionService();
  });

  describe('hasPermission', () => {
    it('should return true for exact resource and action match', () => {
      const permissions: Permission[] = [
        {
          resource: 'server:123',
          actions: ['read', 'write']
        }
      ];

      const result = permissionService.hasPermission(permissions, 'server:123', 'read');
      expect(result).toBe(true);
    });

    it('should return true for wildcard resource', () => {
      const permissions: Permission[] = [
        {
          resource: '*',
          actions: ['read']
        }
      ];

      const result = permissionService.hasPermission(permissions, 'server:123', 'read');
      expect(result).toBe(true);
    });

    it('should return true for wildcard action', () => {
      const permissions: Permission[] = [
        {
          resource: 'server:123',
          actions: ['*']
        }
      ];

      const result = permissionService.hasPermission(permissions, 'server:123', 'read');
      expect(result).toBe(true);
    });

    it('should return true for pattern match with wildcards', () => {
      const permissions: Permission[] = [
        {
          resource: 'server:user123:*',
          actions: ['read']
        }
      ];

      const result = permissionService.hasPermission(permissions, 'server:user123:abc', 'read');
      expect(result).toBe(true);
    });

    it('should return false for no matching resource', () => {
      const permissions: Permission[] = [
        {
          resource: 'server:123',
          actions: ['read']
        }
      ];

      const result = permissionService.hasPermission(permissions, 'server:456', 'read');
      expect(result).toBe(false);
    });

    it('should return false for no matching action', () => {
      const permissions: Permission[] = [
        {
          resource: 'server:123',
          actions: ['read']
        }
      ];

      const result = permissionService.hasPermission(permissions, 'server:123', 'write');
      expect(result).toBe(false);
    });
  });

  describe('canAccessServer', () => {
    it('should return true for specific server permission', () => {
      const permissions: Permission[] = [
        {
          resource: 'server:123',
          actions: ['read']
        }
      ];

      const result = permissionService.canAccessServer(permissions, '123');
      expect(result).toBe(true);
    });

    it('should return true for all servers permission', () => {
      const permissions: Permission[] = [
        {
          resource: 'server',
          actions: ['*']
        }
      ];

      const result = permissionService.canAccessServer(permissions, '123');
      expect(result).toBe(true);
    });

    it('should return true for global permission', () => {
      const permissions: Permission[] = [
        {
          resource: '*',
          actions: ['*']
        }
      ];

      const result = permissionService.canAccessServer(permissions, '123');
      expect(result).toBe(true);
    });

    it('should return false for no server permission', () => {
      const permissions: Permission[] = [
        {
          resource: 'group:123',
          actions: ['read']
        }
      ];

      const result = permissionService.canAccessServer(permissions, '123');
      expect(result).toBe(false);
    });
  });

  describe('canAccessGroup', () => {
    it('should return true for specific group permission', () => {
      const permissions: Permission[] = [
        {
          resource: 'group:123',
          actions: ['read']
        }
      ];

      const result = permissionService.canAccessGroup(permissions, '123');
      expect(result).toBe(true);
    });

    it('should return false for no group permission', () => {
      const permissions: Permission[] = [
        {
          resource: 'server:123',
          actions: ['read']
        }
      ];

      const result = permissionService.canAccessGroup(permissions, '123');
      expect(result).toBe(false);
    });
  });

  describe('canCallTool', () => {
    it('should return true for specific tool permission', () => {
      const permissions: Permission[] = [
        {
          resource: 'tool:test-tool',
          actions: ['execute']
        }
      ];

      const result = permissionService.canCallTool(permissions, 'test-tool');
      expect(result).toBe(true);
    });

    it('should return true for all tools permission', () => {
      const permissions: Permission[] = [
        {
          resource: 'tool',
          actions: ['*']
        }
      ];

      const result = permissionService.canCallTool(permissions, 'test-tool');
      expect(result).toBe(true);
    });

    it('should return false for no tool permission', () => {
      const permissions: Permission[] = [
        {
          resource: 'server:123',
          actions: ['read']
        }
      ];

      const result = permissionService.canCallTool(permissions, 'test-tool');
      expect(result).toBe(false);
    });
  });

  describe('getAllowedResources', () => {
    it('should return all unique resources', () => {
      const permissions: Permission[] = [
        {
          resource: 'server:123',
          actions: ['read']
        },
        {
          resource: 'group:456',
          actions: ['write']
        },
        {
          resource: 'server:123',
          actions: ['delete']
        }
      ];

      const result = permissionService.getAllowedResources(permissions);
      expect(result).toEqual(['server:123', 'group:456']);
    });
  });

  describe('getAllowedActions', () => {
    it('should return all actions for matching resources', () => {
      const permissions: Permission[] = [
        {
          resource: 'server:123',
          actions: ['read', 'write']
        },
        {
          resource: 'server:*',
          actions: ['delete']
        },
        {
          resource: 'group:456',
          actions: ['manage']
        }
      ];

      const result = permissionService.getAllowedActions(permissions, 'server:123');
      expect(result).toEqual(['read', 'write', 'delete']);
    });
  });

  describe('validatePermission', () => {
    it('should return true for valid permission', () => {
      const permission: Permission = {
        resource: 'server:123',
        actions: ['read', 'write']
      };

      const result = permissionService.validatePermission(permission);
      expect(result).toBe(true);
    });

    it('should return false for missing resource', () => {
      const permission: Permission = {
        resource: '',
        actions: ['read']
      };

      const result = permissionService.validatePermission(permission);
      expect(result).toBe(false);
    });

    it('should return false for empty actions array', () => {
      const permission: Permission = {
        resource: 'server:123',
        actions: []
      };

      const result = permissionService.validatePermission(permission);
      expect(result).toBe(false);
    });

    it('should return false for invalid action', () => {
      const permission: Permission = {
        resource: 'server:123',
        actions: ['read', '']
      };

      const result = permissionService.validatePermission(permission);
      expect(result).toBe(false);
    });
  });

  describe('createDefaultPermissions', () => {
    it('should create default permissions for a user', () => {
      const userId = 'user123';
      const permissions = permissionService.createDefaultPermissions(userId);

      expect(permissions).toHaveLength(5);
      expect(permissions[0].resource).toBe(`user:${userId}`);
      expect(permissions[1].resource).toBe(`server:${userId}:*`);
      expect(permissions[2].resource).toBe(`group:${userId}:*`);
      expect(permissions[3].resource).toBe(`tool:${userId}:*`);
      expect(permissions[4].resource).toBe(`endpoint:${userId}:*`);
    });
  });

  describe('createAdminPermissions', () => {
    it('should create admin permissions', () => {
      const permissions = permissionService.createAdminPermissions();

      expect(permissions).toHaveLength(1);
      expect(permissions[0].resource).toBe('*');
      expect(permissions[0].actions).toEqual(['*']);
    });
  });

  describe('mergePermissions', () => {
    it('should merge multiple permission sets', () => {
      const permissionSets: Permission[][] = [
        [
          {
            resource: 'server:123',
            actions: ['read']
          },
          {
            resource: 'group:456',
            actions: ['write']
          }
        ],
        [
          {
            resource: 'server:123',
            actions: ['write', 'delete']
          },
          {
            resource: 'tool:789',
            actions: ['execute']
          }
        ]
      ];

      const merged = permissionService.mergePermissions(permissionSets);

      expect(merged).toHaveLength(3);
      
      const serverPermission = merged.find(p => p.resource === 'server:123');
      expect(serverPermission?.actions).toEqual(expect.arrayContaining(['read', 'write', 'delete']));
      
      const groupPermission = merged.find(p => p.resource === 'group:456');
      expect(groupPermission?.actions).toEqual(['write']);
      
      const toolPermission = merged.find(p => p.resource === 'tool:789');
      expect(toolPermission?.actions).toEqual(['execute']);
    });

    it('should handle empty permission sets', () => {
      const permissionSets: Permission[][] = [[], []];
      const merged = permissionService.mergePermissions(permissionSets);
      expect(merged).toHaveLength(0);
    });
  });
});