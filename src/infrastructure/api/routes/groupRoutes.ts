import { Router, Request, Response } from 'express';
import { DIContainer } from '../../di/container';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { TYPES } from '../../di/types';
import { IServerRegistryService, IRouterService } from '../../../domain/services';
import { RoutingRule } from '../../../domain/models/Endpoint';

/**
 * Server Group Routes (Skeleton)
 * 
 * TODO: Implement full group management
 * - POST / - Create group
 * - GET / - List groups
 * - GET /:groupId - Get group details
 * - PUT /:groupId - Update group
 * - DELETE /:groupId - Delete group
 * - GET /:groupId/health - Get group health
 * - PUT /:groupId/routing-rules - Set routing rules
 */
export function groupRoutes(container: DIContainer): Router {
  const router = Router();
  router.use(authMiddleware(container));
  console.log('groupRoutes initialized (enhanced)');

  // Create group
  router.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description, serverIds } = req.body as { name: string; description?: string; serverIds?: string[] };
      if (!name) {
        res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'name is required' } });
        return;
      }

      const service = container.get<IServerRegistryService>(TYPES.ServerRegistryService);
      const group = await service.createGroup(req.userId!, { name, description, serverIds });

      res.status(201).json({
        group: {
          id: group.id,
          name: group.name,
          description: group.description,
          serverIds: group.serverIds,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
        }
      });
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        res.status(409).json({ error: { code: 'GROUP_EXISTS', message: error.message } });
        return;
      }
      console.error('Create group error:', error);
      res.status(500).json({ error: { code: 'CREATE_FAILED', message: 'Failed to create group' } });
    }
  });

  // List groups
  router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const service = container.get<IServerRegistryService>(TYPES.ServerRegistryService);
      const groups = await service.getGroupsByUser(req.userId!);
      res.json({
        groups: groups.map(g => ({
          id: g.id,
          name: g.name,
          description: g.description,
          serverIds: g.serverIds,
          createdAt: g.createdAt,
          updatedAt: g.updatedAt,
        }))
      });
    } catch (error) {
      console.error('List groups error:', error);
      res.status(500).json({ error: { code: 'FETCH_FAILED', message: 'Failed to list groups' } });
    }
  });

  // Get group details
  router.get('/:groupId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { groupId } = req.params;
      const service = container.get<IServerRegistryService>(TYPES.ServerRegistryService);
      const group = await service.getGroupById(groupId);
      if (!group) {
        res.status(404).json({ error: { code: 'GROUP_NOT_FOUND', message: 'Group not found' } });
        return;
      }
      res.json({
        id: group.id,
        name: group.name,
        description: group.description,
        serverIds: group.serverIds,
        routingRules: group.routingRules,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      });
    } catch (error) {
      console.error('Get group error:', error);
      res.status(500).json({ error: { code: 'FETCH_FAILED', message: 'Failed to get group' } });
    }
  });

  // Update group (name/description/serverIds)
  router.put('/:groupId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { groupId } = req.params;
      const { name, description, serverIds } = req.body as { name?: string; description?: string; serverIds?: string[] };
      const service = container.get<IServerRegistryService>(TYPES.ServerRegistryService);
      const repo = container.get<any>(TYPES.GroupRepository);

      const existing = await service.getGroupById(groupId);
      if (!existing) {
        res.status(404).json({ error: { code: 'GROUP_NOT_FOUND', message: 'Group not found' } });
        return;
      }

      // Update memberships if provided
      if (Array.isArray(serverIds)) {
        const toAdd = serverIds.filter(id => !existing.serverIds.includes(id));
        const toRemove = existing.serverIds.filter(id => !serverIds.includes(id));
        if (toAdd.length > 0) await repo.addServersToGroup(groupId, toAdd);
        if (toRemove.length > 0) await repo.removeServersFromGroup(groupId, toRemove);
      }

      const updated = await repo.updateGroup(groupId, { name, description });
      res.json({
        id: updated!.id,
        name: updated!.name,
        description: updated!.description,
        serverIds: await repo.getServerIdsByGroupId(groupId),
        updatedAt: updated!.updatedAt,
      });
    } catch (error) {
      console.error('Update group error:', error);
      res.status(500).json({ error: { code: 'UPDATE_FAILED', message: 'Failed to update group' } });
    }
  });

  // Delete group
  router.delete('/:groupId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { groupId } = req.params;
      const repo = container.get<any>(TYPES.GroupRepository);
      const group = await repo.findGroupById(groupId);
      if (!group) {
        res.status(404).json({ error: { code: 'GROUP_NOT_FOUND', message: 'Group not found' } });
        return;
      }
      await repo.deleteGroup(groupId);
      res.status(204).send();
    } catch (error) {
      console.error('Delete group error:', error);
      res.status(500).json({ error: { code: 'DELETE_FAILED', message: 'Failed to delete group' } });
    }
  });

  // Group health
  router.get('/:groupId/health', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { groupId } = req.params;
      const routerService = container.get<IRouterService>(TYPES.RouterService);
      const health = await routerService.getGroupHealth(groupId);
      res.json({ health });
    } catch (error) {
      console.error('Get group health error:', error);
      res.status(500).json({ error: { code: 'HEALTH_FAILED', message: 'Failed to get group health' } });
    }
  });

  // Routing Rules - get
  router.get('/:groupId/routing-rules', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { groupId } = req.params;
      const routerService = container.get<IRouterService>(TYPES.RouterService);
      const rules = await routerService.getRoutingRules(groupId);
      res.json({ rules });
    } catch (error) {
      console.error('Get routing rules error:', error);
      res.status(500).json({ error: { code: 'FETCH_FAILED', message: 'Failed to get routing rules' } });
    }
  });

  // Routing Rules - set
  router.put('/:groupId/routing-rules', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { groupId } = req.params;
      const { rules } = req.body as { rules: RoutingRule[] };
      if (!Array.isArray(rules)) {
        res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'rules must be an array' } });
        return;
      }
      const routerService = container.get<IRouterService>(TYPES.RouterService);
      await routerService.setRoutingRules(groupId, rules);
      const updated = await routerService.getRoutingRules(groupId);
      res.status(200).json({ rules: updated });
    } catch (error) {
      console.error('Set routing rules error:', error);
      res.status(500).json({ error: { code: 'UPDATE_FAILED', message: 'Failed to set routing rules' } });
    }
  });

  return router;
}

