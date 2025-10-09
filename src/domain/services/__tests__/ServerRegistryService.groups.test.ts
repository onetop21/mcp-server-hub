import { ServerRegistryService, ServerConfigValidationError } from '../ServerRegistryService';
import { ServerRepository } from '../../../infrastructure/repositories/ServerRepository';
import { ServerGroupRepository } from '../../../infrastructure/repositories/ServerGroupRepository';
import { ServerProtocol, ServerStatus } from '../../models/Server';
import { GroupConfig } from '../../models/Endpoint';

// Mock repositories
jest.mock('../../../infrastructure/repositories/ServerRepository');
jest.mock('../../../infrastructure/repositories/ServerGroupRepository');

describe('ServerRegistryService - Group Management', () => {
  let service: ServerRegistryService;
  let mockServerRepository: jest.Mocked<ServerRepository>;
  let mockServerGroupRepository: jest.Mocked<ServerGroupRepository>;

  const mockUserId = 'user-123';
  const mockServerId = 'server-123';
  const mockGroupId = 'group-123';

  beforeEach(() => {
    mockServerRepository = new ServerRepository({} as any) as jest.Mocked<ServerRepository>;
    mockServerGroupRepository = new ServerGroupRepository({} as any) as jest.Mocked<ServerGroupRepository>;
    service = new ServerRegistryService(mockServerRepository, mockServerGroupRepository);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createGroup', () => {
    const validGroupConfig: GroupConfig = {
      name: 'Test Group',
      description: 'A test group',
      serverIds: []
    };

    it('should create a group successfully', async () => {
      const expectedGroup = {
        id: mockGroupId,
        userId: mockUserId,
        name: validGroupConfig.name,
        description: validGroupConfig.description,
        serverIds: [],
        routingRules: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockServerGroupRepository.findByUserIdAndName.mockResolvedValue(null);
      mockServerGroupRepository.createGroup.mockResolvedValue(expectedGroup);

      const result = await service.createGroup(mockUserId, validGroupConfig);

      expect(result).toEqual(expectedGroup);
      expect(mockServerGroupRepository.findByUserIdAndName).toHaveBeenCalledWith(mockUserId, validGroupConfig.name);
      expect(mockServerGroupRepository.createGroup).toHaveBeenCalledWith(mockUserId, validGroupConfig);
    });

    it('should throw error if group name already exists', async () => {
      const existingGroup = { id: 'existing-group', name: validGroupConfig.name };
      mockServerGroupRepository.findByUserIdAndName.mockResolvedValue(existingGroup as any);

      await expect(service.createGroup(mockUserId, validGroupConfig))
        .rejects.toThrow(ServerConfigValidationError);
      
      expect(mockServerGroupRepository.createGroup).not.toHaveBeenCalled();
    });

    it('should validate group configuration', async () => {
      const invalidConfig: GroupConfig = {
        name: '', // Invalid: empty name
        description: 'Test'
      };

      await expect(service.createGroup(mockUserId, invalidConfig))
        .rejects.toThrow(ServerConfigValidationError);
    });
  });

  describe('assignServerToGroup', () => {
    it('should assign server to group successfully', async () => {
      const mockServer = {
        id: mockServerId,
        userId: mockUserId,
        name: 'Test Server',
        protocol: ServerProtocol.STDIO,
        status: ServerStatus.ACTIVE
      };

      const mockGroup = {
        id: mockGroupId,
        userId: mockUserId,
        name: 'Test Group',
        serverIds: []
      };

      mockServerRepository.findServerById.mockResolvedValue(mockServer as any);
      mockServerGroupRepository.findGroupById.mockResolvedValue(mockGroup as any);
      mockServerGroupRepository.addServerToGroup.mockResolvedValue(undefined);

      await service.assignServerToGroup(mockServerId, mockGroupId);

      expect(mockServerRepository.findServerById).toHaveBeenCalledWith(mockServerId);
      expect(mockServerGroupRepository.findGroupById).toHaveBeenCalledWith(mockGroupId);
      expect(mockServerGroupRepository.addServerToGroup).toHaveBeenCalledWith(mockServerId, mockGroupId);
    });

    it('should throw error if server not found', async () => {
      mockServerRepository.findServerById.mockResolvedValue(null);

      await expect(service.assignServerToGroup(mockServerId, mockGroupId))
        .rejects.toThrow(`Server with ID '${mockServerId}' not found`);
    });

    it('should throw error if group not found', async () => {
      const mockServer = { id: mockServerId, userId: mockUserId };
      mockServerRepository.findServerById.mockResolvedValue(mockServer as any);
      mockServerGroupRepository.findGroupById.mockResolvedValue(null);

      await expect(service.assignServerToGroup(mockServerId, mockGroupId))
        .rejects.toThrow(`Group with ID '${mockGroupId}' not found`);
    });

    it('should throw error if server and group belong to different users', async () => {
      const mockServer = { id: mockServerId, userId: mockUserId };
      const mockGroup = { id: mockGroupId, userId: 'different-user' };

      mockServerRepository.findServerById.mockResolvedValue(mockServer as any);
      mockServerGroupRepository.findGroupById.mockResolvedValue(mockGroup as any);

      await expect(service.assignServerToGroup(mockServerId, mockGroupId))
        .rejects.toThrow('Server and group must belong to the same user');
    });
  });

  describe('removeServerFromGroup', () => {
    it('should remove server from group successfully', async () => {
      const mockServer = { id: mockServerId, userId: mockUserId };
      const mockGroup = { id: mockGroupId, userId: mockUserId };

      mockServerRepository.findServerById.mockResolvedValue(mockServer as any);
      mockServerGroupRepository.findGroupById.mockResolvedValue(mockGroup as any);
      mockServerGroupRepository.removeServerFromGroup.mockResolvedValue(undefined);

      await service.removeServerFromGroup(mockServerId, mockGroupId);

      expect(mockServerGroupRepository.removeServerFromGroup).toHaveBeenCalledWith(mockServerId, mockGroupId);
    });
  });

  describe('getServersByGroup', () => {
    it('should return servers in group', async () => {
      const mockGroup = {
        id: mockGroupId,
        serverIds: [mockServerId, 'server-456']
      };

      const mockServers = [
        { id: mockServerId, name: 'Server 1' },
        { id: 'server-456', name: 'Server 2' }
      ];

      mockServerGroupRepository.findGroupById.mockResolvedValue(mockGroup as any);
      mockServerRepository.findServerById
        .mockResolvedValueOnce(mockServers[0] as any)
        .mockResolvedValueOnce(mockServers[1] as any);

      const result = await service.getServersByGroup(mockGroupId);

      expect(result).toEqual(mockServers);
      expect(mockServerRepository.findServerById).toHaveBeenCalledTimes(2);
    });

    it('should throw error if group not found', async () => {
      mockServerGroupRepository.findGroupById.mockResolvedValue(null);

      await expect(service.getServersByGroup(mockGroupId))
        .rejects.toThrow(`Group with ID '${mockGroupId}' not found`);
    });
  });

  describe('getGroupsByUser', () => {
    it('should return user groups', async () => {
      const mockGroups = [
        { id: 'group-1', name: 'Group 1' },
        { id: 'group-2', name: 'Group 2' }
      ];

      mockServerGroupRepository.findByUserId.mockResolvedValue(mockGroups as any);

      const result = await service.getGroupsByUser(mockUserId);

      expect(result).toEqual(mockGroups);
      expect(mockServerGroupRepository.findByUserId).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('getGroupById', () => {
    it('should return group by ID', async () => {
      const mockGroup = { id: mockGroupId, name: 'Test Group' };
      mockServerGroupRepository.findGroupById.mockResolvedValue(mockGroup as any);

      const result = await service.getGroupById(mockGroupId);

      expect(result).toEqual(mockGroup);
      expect(mockServerGroupRepository.findGroupById).toHaveBeenCalledWith(mockGroupId);
    });
  });
});