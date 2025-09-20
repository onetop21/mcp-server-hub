import { ServerRegistryService, ServerConfigValidationError } from '../ServerRegistryService';
import { ServerRepository } from '../../../infrastructure/repositories/ServerRepository';
import { 
  RegisteredServer, 
  ServerProtocol, 
  ServerStatus,
  ServerConfig,
  ServerUpdate,
  StdioConfig,
  SseConfig,
  HttpConfig
} from '../../models/Server';

// Mock ServerRepository
jest.mock('../../../infrastructure/repositories/ServerRepository');

describe('ServerRegistryService', () => {
  let serverRegistryService: ServerRegistryService;
  let mockServerRepository: jest.Mocked<ServerRepository>;

  beforeEach(() => {
    mockServerRepository = new ServerRepository({} as any) as jest.Mocked<ServerRepository>;
    serverRegistryService = new ServerRegistryService(mockServerRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerServer', () => {
    const userId = 'user-123';
    const baseServerData = {
      name: 'test-server',
      protocol: ServerProtocol.STDIO,
    };

    describe('STDIO Protocol', () => {
      it('should register STDIO server with valid configuration', async () => {
        // Arrange
        const stdioConfig: StdioConfig = {
          command: 'node',
          args: ['server.js'],
          env: { NODE_ENV: 'production' },
        };

        const serverConfig = {
          ...baseServerData,
          stdio: stdioConfig,
        };

        const expectedServer: RegisteredServer = {
          id: 'server-123',
          userId,
          name: serverConfig.name,
          protocol: ServerProtocol.STDIO,
          config: { stdio: stdioConfig },
          status: ServerStatus.INACTIVE,
          lastHealthCheck: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockServerRepository.findByUserIdAndName.mockResolvedValue(null);
        mockServerRepository.createServer.mockResolvedValue(expectedServer);

        // Act
        const result = await serverRegistryService.registerServer(userId, serverConfig);

        // Assert
        expect(result).toEqual(expectedServer);
        expect(mockServerRepository.findByUserIdAndName).toHaveBeenCalledWith(userId, serverConfig.name);
        expect(mockServerRepository.createServer).toHaveBeenCalledWith({
          userId,
          name: serverConfig.name,
          protocol: ServerProtocol.STDIO,
          config: { stdio: stdioConfig },
          namespace: undefined,
          status: ServerStatus.INACTIVE,
          lastHealthCheck: expect.any(Date),
        });
      });

      it('should throw validation error for missing STDIO command', async () => {
        // Arrange
        const serverConfig = {
          ...baseServerData,
          stdio: {
            command: '',
            args: [],
            env: {},
          },
        };

        // Act & Assert
        await expect(serverRegistryService.registerServer(userId, serverConfig))
          .rejects.toThrow(ServerConfigValidationError);
      });
    });

    describe('SSE Protocol', () => {
      it('should register SSE server with valid configuration', async () => {
        // Arrange
        const sseConfig: SseConfig = {
          url: 'https://api.example.com/sse',
          headers: { 'Authorization': 'Bearer token123' },
        };

        const serverConfig = {
          ...baseServerData,
          protocol: ServerProtocol.SSE,
          sse: sseConfig,
        };

        const expectedServer: RegisteredServer = {
          id: 'server-123',
          userId,
          name: serverConfig.name,
          protocol: ServerProtocol.SSE,
          config: { sse: sseConfig },
          status: ServerStatus.INACTIVE,
          lastHealthCheck: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockServerRepository.findByUserIdAndName.mockResolvedValue(null);
        mockServerRepository.createServer.mockResolvedValue(expectedServer);

        // Act
        const result = await serverRegistryService.registerServer(userId, serverConfig);

        // Assert
        expect(result).toEqual(expectedServer);
      });

      it('should throw validation error for invalid SSE URL', async () => {
        // Arrange
        const serverConfig = {
          ...baseServerData,
          protocol: ServerProtocol.SSE,
          sse: {
            url: 'invalid-url',
            headers: {},
          },
        };

        // Act & Assert
        await expect(serverRegistryService.registerServer(userId, serverConfig))
          .rejects.toThrow(ServerConfigValidationError);
      });
    });

    describe('HTTP Protocol', () => {
      it('should register HTTP server with valid configuration', async () => {
        // Arrange
        const httpConfig: HttpConfig = {
          baseUrl: 'https://api.example.com',
          headers: { 'Content-Type': 'application/json' },
        };

        const serverConfig = {
          ...baseServerData,
          protocol: ServerProtocol.HTTP,
          http: httpConfig,
        };

        const expectedServer: RegisteredServer = {
          id: 'server-123',
          userId,
          name: serverConfig.name,
          protocol: ServerProtocol.HTTP,
          config: { http: httpConfig },
          status: ServerStatus.INACTIVE,
          lastHealthCheck: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockServerRepository.findByUserIdAndName.mockResolvedValue(null);
        mockServerRepository.createServer.mockResolvedValue(expectedServer);

        // Act
        const result = await serverRegistryService.registerServer(userId, serverConfig);

        // Assert
        expect(result).toEqual(expectedServer);
      });

      it('should throw validation error for invalid HTTP base URL', async () => {
        // Arrange
        const serverConfig = {
          ...baseServerData,
          protocol: ServerProtocol.HTTP,
          http: {
            baseUrl: 'invalid-url',
            headers: {},
          },
        };

        // Act & Assert
        await expect(serverRegistryService.registerServer(userId, serverConfig))
          .rejects.toThrow(ServerConfigValidationError);
      });
    });

    it('should throw validation error for duplicate server name', async () => {
      // Arrange
      const existingServer: RegisteredServer = {
        id: 'existing-server',
        userId,
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        config: {},
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const serverConfig = {
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        stdio: {
          command: 'node',
          args: ['server.js'],
          env: {},
        },
      };

      mockServerRepository.findByUserIdAndName.mockResolvedValue(existingServer);

      // Act & Assert
      await expect(serverRegistryService.registerServer(userId, serverConfig))
        .rejects.toThrow(ServerConfigValidationError);
    });
  });

  describe('updateServer', () => {
    const serverId = 'server-123';
    const existingServer: RegisteredServer = {
      id: serverId,
      userId: 'user-123',
      name: 'existing-server',
      protocol: ServerProtocol.STDIO,
      config: {
        stdio: {
          command: 'node',
          args: ['old-server.js'],
          env: {},
        },
      },
      status: ServerStatus.ACTIVE,
      lastHealthCheck: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should update server configuration', async () => {
      // Arrange
      const updates: ServerUpdate = {
        name: 'updated-server',
        config: {
          stdio: {
            command: 'node',
            args: ['new-server.js'],
            env: { NODE_ENV: 'production' },
          },
        },
      };

      const updatedServer: RegisteredServer = {
        ...existingServer,
        ...updates,
        updatedAt: new Date(),
      };

      mockServerRepository.findServerById.mockResolvedValue(existingServer);
      mockServerRepository.nameExistsForUser.mockResolvedValue(false);
      mockServerRepository.updateServer.mockResolvedValue(updatedServer);

      // Act
      const result = await serverRegistryService.updateServer(serverId, updates);

      // Assert
      expect(result).toEqual(updatedServer);
      expect(mockServerRepository.findServerById).toHaveBeenCalledWith(serverId);
    });

    it('should throw error when server not found', async () => {
      // Arrange
      mockServerRepository.findServerById.mockResolvedValue(null);

      // Act & Assert
      await expect(serverRegistryService.updateServer(serverId, {}))
        .rejects.toThrow('Server with ID \'server-123\' not found');
    });
  });

  describe('deleteServer', () => {
    it('should delete existing server', async () => {
      // Arrange
      const serverId = 'server-123';
      const existingServer: RegisteredServer = {
        id: serverId,
        userId: 'user-123',
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        config: {},
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServerRepository.findServerById.mockResolvedValue(existingServer);
      mockServerRepository.delete.mockResolvedValue();

      // Act
      await serverRegistryService.deleteServer(serverId);

      // Assert
      expect(mockServerRepository.findServerById).toHaveBeenCalledWith(serverId);
      expect(mockServerRepository.delete).toHaveBeenCalledWith(serverId);
    });

    it('should throw error when server not found', async () => {
      // Arrange
      const serverId = 'non-existent-server';
      mockServerRepository.findServerById.mockResolvedValue(null);

      // Act & Assert
      await expect(serverRegistryService.deleteServer(serverId))
        .rejects.toThrow('Server with ID \'non-existent-server\' not found');
    });
  });

  describe('getServersByUser', () => {
    it('should return servers for user', async () => {
      // Arrange
      const userId = 'user-123';
      const servers: RegisteredServer[] = [
        {
          id: 'server-1',
          userId,
          name: 'server-1',
          protocol: ServerProtocol.STDIO,
          config: {},
          status: ServerStatus.ACTIVE,
          lastHealthCheck: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockServerRepository.findByUserId.mockResolvedValue(servers);

      // Act
      const result = await serverRegistryService.getServersByUser(userId);

      // Assert
      expect(result).toEqual(servers);
      expect(mockServerRepository.findByUserId).toHaveBeenCalledWith(userId);
    });
  });

  describe('getServerById', () => {
    it('should return server by ID', async () => {
      // Arrange
      const serverId = 'server-123';
      const server: RegisteredServer = {
        id: serverId,
        userId: 'user-123',
        name: 'test-server',
        protocol: ServerProtocol.HTTP,
        config: {},
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServerRepository.findServerById.mockResolvedValue(server);

      // Act
      const result = await serverRegistryService.getServerById(serverId);

      // Assert
      expect(result).toEqual(server);
      expect(mockServerRepository.findServerById).toHaveBeenCalledWith(serverId);
    });

    it('should return null when server not found', async () => {
      // Arrange
      const serverId = 'non-existent-server';
      mockServerRepository.findServerById.mockResolvedValue(null);

      // Act
      const result = await serverRegistryService.getServerById(serverId);

      // Assert
      expect(result).toBeNull();
      expect(mockServerRepository.findServerById).toHaveBeenCalledWith(serverId);
    });
  });
});