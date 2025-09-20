import { ServerRepository } from '../ServerRepository';
import { DatabaseConnection } from '../../database/connection';
import { 
  RegisteredServer, 
  ServerProtocol, 
  ServerStatus,
  ServerConfig 
} from '../../../domain/models/Server';

// Mock DatabaseConnection
const mockDb = {
  query: jest.fn(),
  transaction: jest.fn(),
  getClient: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  isConnected: jest.fn(),
  getPoolStats: jest.fn(),
} as unknown as jest.Mocked<DatabaseConnection>;

describe('ServerRepository', () => {
  let serverRepository: ServerRepository;

  beforeEach(() => {
    serverRepository = new ServerRepository(mockDb);
    jest.clearAllMocks();
  });

  describe('findServerById', () => {
    it('should find server by ID', async () => {
      // Arrange
      const serverId = 'server-123';
      const mockServerRow = {
        id: serverId,
        user_id: 'user-123',
        name: 'test-server',
        protocol: 'stdio',
        config: {
          stdio: {
            command: 'node',
            args: ['server.js'],
            env: {},
          },
        },
        namespace: null,
        status: 'active',
        last_health_check: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({
        rows: [mockServerRow],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await serverRepository.findServerById(serverId);

      // Assert
      expect(result).toEqual({
        id: mockServerRow.id,
        userId: mockServerRow.user_id,
        name: mockServerRow.name,
        protocol: ServerProtocol.STDIO,
        config: mockServerRow.config,
        namespace: undefined,
        status: ServerStatus.ACTIVE,
        lastHealthCheck: mockServerRow.last_health_check,
        createdAt: mockServerRow.created_at,
        updatedAt: mockServerRow.updated_at,
      });
    });

    it('should return null when server not found', async () => {
      // Arrange
      mockDb.query.mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await serverRepository.findServerById('non-existent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find servers by user ID', async () => {
      // Arrange
      const userId = 'user-123';
      const mockServerRows = [
        {
          id: 'server-1',
          user_id: userId,
          name: 'server-1',
          protocol: 'stdio',
          config: { stdio: { command: 'node', args: [], env: {} } },
          namespace: null,
          status: 'active',
          last_health_check: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'server-2',
          user_id: userId,
          name: 'server-2',
          protocol: 'sse',
          config: { sse: { url: 'https://example.com', headers: {} } },
          namespace: 'tools',
          status: 'inactive',
          last_health_check: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({
        rows: mockServerRows,
        command: 'SELECT',
        rowCount: 2,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await serverRepository.findByUserId(userId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe(userId);
      expect(result[1].userId).toBe(userId);
      expect(result[0].protocol).toBe(ServerProtocol.STDIO);
      expect(result[1].protocol).toBe(ServerProtocol.SSE);
    });
  });

  describe('findByUserIdAndName', () => {
    it('should find server by user ID and name', async () => {
      // Arrange
      const userId = 'user-123';
      const serverName = 'test-server';
      const mockServerRow = {
        id: 'server-123',
        user_id: userId,
        name: serverName,
        protocol: 'http',
        config: { http: { baseUrl: 'https://api.example.com', headers: {} } },
        namespace: null,
        status: 'active',
        last_health_check: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({
        rows: [mockServerRow],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await serverRepository.findByUserIdAndName(userId, serverName);

      // Assert
      expect(result).toBeDefined();
      expect(result?.name).toBe(serverName);
      expect(result?.userId).toBe(userId);
      expect(result?.protocol).toBe(ServerProtocol.HTTP);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM servers WHERE user_id = $1 AND name = $2',
        [userId, serverName]
      );
    });
  });

  describe('createServer', () => {
    it('should create a new server', async () => {
      // Arrange
      const serverData: Omit<RegisteredServer, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: 'user-123',
        name: 'new-server',
        protocol: ServerProtocol.STDIO,
        config: {
          stdio: {
            command: 'python',
            args: ['-m', 'server'],
            env: { PYTHONPATH: '/app' },
          },
        },
        namespace: 'python-tools',
        status: ServerStatus.INACTIVE,
        lastHealthCheck: new Date(),
      };

      const createdServerRow = {
        id: 'server-123',
        user_id: serverData.userId,
        name: serverData.name,
        protocol: serverData.protocol,
        config: serverData.config,
        namespace: serverData.namespace,
        status: serverData.status,
        last_health_check: serverData.lastHealthCheck,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({
        rows: [createdServerRow],
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await serverRepository.createServer(serverData);

      // Assert
      expect(result).toEqual({
        id: createdServerRow.id,
        userId: createdServerRow.user_id,
        name: createdServerRow.name,
        protocol: ServerProtocol.STDIO,
        config: createdServerRow.config,
        namespace: createdServerRow.namespace,
        status: ServerStatus.INACTIVE,
        lastHealthCheck: createdServerRow.last_health_check,
        createdAt: createdServerRow.created_at,
        updatedAt: createdServerRow.updated_at,
      });
    });
  });

  describe('updateServer', () => {
    it('should update server', async () => {
      // Arrange
      const serverId = 'server-123';
      const updates = {
        name: 'updated-server',
        status: ServerStatus.ACTIVE,
      };

      const updatedServerRow = {
        id: serverId,
        user_id: 'user-123',
        name: updates.name,
        protocol: 'stdio',
        config: { stdio: { command: 'node', args: [], env: {} } },
        namespace: null,
        status: updates.status,
        last_health_check: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({
        rows: [updatedServerRow],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await serverRepository.updateServer(serverId, updates);

      // Assert
      expect(result).toBeDefined();
      expect(result?.name).toBe(updates.name);
      expect(result?.status).toBe(updates.status);
    });
  });

  describe('updateStatus', () => {
    it('should update server status', async () => {
      // Arrange
      const serverId = 'server-123';
      const newStatus = ServerStatus.ERROR;

      mockDb.query.mockResolvedValue({
        rows: [],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // Act
      await serverRepository.updateStatus(serverId, newStatus);

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE servers'),
        [newStatus, serverId]
      );
    });
  });

  describe('findByProtocol', () => {
    it('should find servers by protocol', async () => {
      // Arrange
      const protocol = ServerProtocol.SSE;
      const mockServerRows = [
        {
          id: 'server-1',
          user_id: 'user-1',
          name: 'sse-server-1',
          protocol: 'sse',
          config: { sse: { url: 'https://api1.example.com', headers: {} } },
          namespace: null,
          status: 'active',
          last_health_check: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'server-2',
          user_id: 'user-2',
          name: 'sse-server-2',
          protocol: 'sse',
          config: { sse: { url: 'https://api2.example.com', headers: {} } },
          namespace: null,
          status: 'active',
          last_health_check: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({
        rows: mockServerRows,
        command: 'SELECT',
        rowCount: 2,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await serverRepository.findByProtocol(protocol);

      // Assert
      expect(result).toHaveLength(2);
      expect(result.every(server => server.protocol === ServerProtocol.SSE)).toBe(true);
    });
  });

  describe('findByStatus', () => {
    it('should find servers by status', async () => {
      // Arrange
      const status = ServerStatus.ACTIVE;
      const mockServerRows = [
        {
          id: 'server-1',
          user_id: 'user-1',
          name: 'active-server-1',
          protocol: 'stdio',
          config: {},
          namespace: null,
          status: 'active',
          last_health_check: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({
        rows: mockServerRows,
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await serverRepository.findByStatus(status);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(ServerStatus.ACTIVE);
    });
  });

  describe('nameExistsForUser', () => {
    it('should return true when name exists for user', async () => {
      // Arrange
      const userId = 'user-123';
      const serverName = 'existing-server';

      mockDb.query.mockResolvedValue({
        rows: [{ exists: true }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await serverRepository.nameExistsForUser(userId, serverName);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when name does not exist for user', async () => {
      // Arrange
      const userId = 'user-123';
      const serverName = 'non-existing-server';

      mockDb.query.mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await serverRepository.nameExistsForUser(userId, serverName);

      // Assert
      expect(result).toBe(false);
    });

    it('should exclude specific server ID when checking name existence', async () => {
      // Arrange
      const userId = 'user-123';
      const serverName = 'server-name';
      const excludeId = 'server-to-exclude';

      mockDb.query.mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await serverRepository.nameExistsForUser(userId, serverName, excludeId);

      // Assert
      expect(result).toBe(false);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT 1 FROM servers WHERE user_id = $1 AND name = $2 AND id != $3 LIMIT 1',
        [userId, serverName, excludeId]
      );
    });
  });

  describe('getStatistics', () => {
    it('should return server statistics', async () => {
      // Arrange
      // Mock the count method call first
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ count: '100' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            { protocol: 'stdio', count: '50' },
            { protocol: 'sse', count: '30' },
            { protocol: 'http', count: '20' },
          ],
          command: 'SELECT',
          rowCount: 3,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            { status: 'active', count: '80' },
            { status: 'inactive', count: '15' },
            { status: 'error', count: '5' },
          ],
          command: 'SELECT',
          rowCount: 3,
          oid: 0,
          fields: [],
        });

      // Act
      const result = await serverRepository.getStatistics();

      // Assert
      expect(result).toEqual({
        total: 100,
        byProtocol: {
          [ServerProtocol.STDIO]: 50,
          [ServerProtocol.SSE]: 30,
          [ServerProtocol.HTTP]: 20,
        },
        byStatus: {
          [ServerStatus.ACTIVE]: 80,
          [ServerStatus.INACTIVE]: 15,
          [ServerStatus.ERROR]: 5,
        },
      });
    });
  });

  describe('findServersNeedingHealthCheck', () => {
    it('should find servers needing health check', async () => {
      // Arrange
      const olderThanMinutes = 10;
      const mockServerRows = [
        {
          id: 'server-1',
          user_id: 'user-1',
          name: 'stale-server',
          protocol: 'stdio',
          config: {},
          namespace: null,
          status: 'active',
          last_health_check: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({
        rows: mockServerRows,
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await serverRepository.findServersNeedingHealthCheck(olderThanMinutes);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('server-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining(`INTERVAL '${olderThanMinutes} minutes'`),
        undefined
      );
    });
  });
});