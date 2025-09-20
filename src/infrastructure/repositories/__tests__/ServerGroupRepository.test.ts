import { ServerGroupRepository } from '../ServerGroupRepository';
import { DatabaseConnection } from '../../database/connection';
import { GroupConfig } from '../../../domain/models/Endpoint';
import { BaseRepository } from '../../database/BaseRepository';

// Mock database connection
jest.mock('../../database/connection');

describe('ServerGroupRepository', () => {
  let repository: ServerGroupRepository;
  let mockDb: jest.Mocked<DatabaseConnection>;

  const mockUserId = 'user-123';
  const mockGroupId = 'group-123';
  const mockServerId = 'server-123';

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      executeInTransaction: jest.fn()
    } as any;

    repository = new ServerGroupRepository(mockDb);
    jest.clearAllMocks();
  });

  describe('createGroup', () => {
    it('should create a group successfully', async () => {
      const groupConfig: GroupConfig = {
        name: 'Test Group',
        description: 'A test group',
        serverIds: []
      };

      const mockCreatedRow = {
        id: mockGroupId,
        user_id: mockUserId,
        name: groupConfig.name,
        description: groupConfig.description,
        routing_rules: [],
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock the create method from BaseRepository
      jest.spyOn(BaseRepository.prototype, 'create').mockResolvedValue(mockCreatedRow);

      const result = await repository.createGroup(mockUserId, groupConfig);

      expect(result).toEqual({
        id: mockGroupId,
        userId: mockUserId,
        name: groupConfig.name,
        description: groupConfig.description,
        serverIds: [],
        routingRules: [],
        createdAt: mockCreatedRow.created_at,
        updatedAt: mockCreatedRow.updated_at
      });
    });

    it('should create group with initial servers', async () => {
      const groupConfig: GroupConfig = {
        name: 'Test Group',
        description: 'A test group',
        serverIds: [mockServerId]
      };

      const mockCreatedRow = {
        id: mockGroupId,
        user_id: mockUserId,
        name: groupConfig.name,
        description: groupConfig.description,
        routing_rules: [],
        created_at: new Date(),
        updated_at: new Date()
      };

      jest.spyOn(BaseRepository.prototype, 'create').mockResolvedValue(mockCreatedRow);
      jest.spyOn(repository, 'addServersToGroup').mockResolvedValue(undefined);

      const result = await repository.createGroup(mockUserId, groupConfig);

      expect(repository.addServersToGroup).toHaveBeenCalledWith(mockGroupId, [mockServerId]);
      expect(result.serverIds).toEqual([mockServerId]);
    });
  });

  describe('addServerToGroup', () => {
    it('should add server to group', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await repository.addServerToGroup(mockServerId, mockGroupId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO server_group_members'),
        [mockServerId, mockGroupId]
      );
    });
  });

  describe('removeServerFromGroup', () => {
    it('should remove server from group', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await repository.removeServerFromGroup(mockServerId, mockGroupId);

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM server_group_members WHERE server_id = $1 AND group_id = $2',
        [mockServerId, mockGroupId]
      );
    });
  });

  describe('getServerIdsByGroupId', () => {
    it('should return server IDs for group', async () => {
      const mockRows = [
        { server_id: 'server-1' },
        { server_id: 'server-2' }
      ];

      mockDb.query.mockResolvedValue({ rows: mockRows } as any);

      const result = await repository.getServerIdsByGroupId(mockGroupId);

      expect(result).toEqual(['server-1', 'server-2']);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT server_id FROM server_group_members WHERE group_id = $1 ORDER BY created_at',
        [mockGroupId]
      );
    });
  });

  describe('nameExistsForUser', () => {
    it('should return true if name exists', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'some-id' }] } as any);

      const result = await repository.nameExistsForUser(mockUserId, 'Test Group');

      expect(result).toBe(true);
    });

    it('should return false if name does not exist', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await repository.nameExistsForUser(mockUserId, 'Test Group');

      expect(result).toBe(false);
    });

    it('should exclude specific group ID when checking', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await repository.nameExistsForUser(mockUserId, 'Test Group', mockGroupId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND id != $3'),
        [mockUserId, 'Test Group', mockGroupId]
      );
    });
  });
});