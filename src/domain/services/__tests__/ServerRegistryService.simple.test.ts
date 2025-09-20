import { ServerRegistryService, ServerConfigValidationError } from '../ServerRegistryService';
import { ServerRepository } from '../../../infrastructure/repositories/ServerRepository';
import { ServerProtocol, ServerStatus } from '../../models/Server';

// Mock ServerRepository
jest.mock('../../../infrastructure/repositories/ServerRepository');

describe('ServerRegistryService - Basic Tests', () => {
  let serverRegistryService: ServerRegistryService;
  let mockServerRepository: jest.Mocked<ServerRepository>;

  beforeEach(() => {
    mockServerRepository = new ServerRepository({} as any) as jest.Mocked<ServerRepository>;
    serverRegistryService = new ServerRegistryService(mockServerRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('STDIO Protocol Registration', () => {
    it('should register STDIO server with valid configuration', async () => {
      // Arrange
      const userId = 'user-123';
      const serverConfig = {
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        stdio: {
          command: 'node',
          args: ['server.js'],
          env: { NODE_ENV: 'production' },
        },
      };

      const expectedServer = {
        id: 'server-123',
        userId,
        name: serverConfig.name,
        protocol: ServerProtocol.STDIO,
        config: { stdio: serverConfig.stdio },
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
    });

    it('should throw validation error for missing STDIO command', async () => {
      // Arrange
      const userId = 'user-123';
      const serverConfig = {
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
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

  describe('SSE Protocol Registration', () => {
    it('should register SSE server with valid configuration', async () => {
      // Arrange
      const userId = 'user-123';
      const serverConfig = {
        name: 'sse-server',
        protocol: ServerProtocol.SSE,
        sse: {
          url: 'https://api.example.com/sse',
          headers: { 'Authorization': 'Bearer token123' },
        },
      };

      const expectedServer = {
        id: 'server-123',
        userId,
        name: serverConfig.name,
        protocol: ServerProtocol.SSE,
        config: { sse: serverConfig.sse },
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
      const userId = 'user-123';
      const serverConfig = {
        name: 'sse-server',
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

  describe('HTTP Protocol Registration', () => {
    it('should register HTTP server with valid configuration', async () => {
      // Arrange
      const userId = 'user-123';
      const serverConfig = {
        name: 'http-server',
        protocol: ServerProtocol.HTTP,
        http: {
          baseUrl: 'https://api.example.com',
          headers: { 'Content-Type': 'application/json' },
        },
      };

      const expectedServer = {
        id: 'server-123',
        userId,
        name: serverConfig.name,
        protocol: ServerProtocol.HTTP,
        config: { http: serverConfig.http },
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
      const userId = 'user-123';
      const serverConfig = {
        name: 'http-server',
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
});