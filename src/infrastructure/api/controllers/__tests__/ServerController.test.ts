import { Request, Response } from 'express';
import { ServerController } from '../ServerController';
import { ServerRegistryService, ServerConfigValidationError } from '../../../../domain/services/ServerRegistryService';
import { ServerProtocol, ServerStatus, RegisteredServer } from '../../../../domain/models/Server';
import { AuthenticatedRequest } from '../../types';
import { container } from '../../../di/container';

// Mock dependencies
jest.mock('../../../../domain/services/ServerRegistryService');
jest.mock('../../../di/container');

describe('ServerController', () => {
  let serverController: ServerController;
  let mockServerRegistryService: jest.Mocked<ServerRegistryService>;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;

  const mockRegisteredServer: RegisteredServer = {
    id: 'server-123',
    userId: 'user-123',
    name: 'test-server',
    protocol: ServerProtocol.STDIO,
    config: {
      stdio: {
        command: 'node',
        args: ['server.js'],
        env: {},
      },
    },
    status: ServerStatus.INACTIVE,
    lastHealthCheck: new Date('2024-01-01T00:00:00Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    mockServerRegistryService = {
      registerServer: jest.fn(),
      updateServer: jest.fn(),
      deleteServer: jest.fn(),
      getServersByUser: jest.fn(),
      getServerById: jest.fn(),
      createGroup: jest.fn(),
      assignServerToGroup: jest.fn(),
      removeServerFromGroup: jest.fn(),
      getServersByGroup: jest.fn(),
      getGroupsByUser: jest.fn(),
      getGroupById: jest.fn(),
    } as unknown as jest.Mocked<ServerRegistryService>;

    (container.get as jest.Mock).mockReturnValue(mockServerRegistryService);

    serverController = new ServerController();

    mockRequest = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      },
      body: {},
      params: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerServer', () => {

    it('should register STDIO server successfully', async () => {
      // Arrange
      mockRequest.body = {
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        config: {
          stdio: {
            command: 'node',
            args: ['server.js'],
            env: {},
          },
        },
      };

      mockServerRegistryService.registerServer.mockResolvedValue(mockRegisteredServer);

      // Act
      await serverController.registerServer(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Assert
      expect(mockServerRegistryService.registerServer).toHaveBeenCalledWith('user-123', {
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        stdio: {
          command: 'node',
          args: ['server.js'],
          env: {},
        },
        namespace: undefined,
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        id: 'server-123',
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        config: mockRegisteredServer.config,
        namespace: undefined,
        status: ServerStatus.INACTIVE,
        lastHealthCheck: '2024-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });
    });

    it('should register SSE server successfully', async () => {
      // Arrange
      const sseServer = {
        ...mockRegisteredServer,
        protocol: ServerProtocol.SSE,
        config: {
          sse: {
            url: 'https://api.example.com/sse',
            headers: { 'Authorization': 'Bearer token' },
          },
        },
      };

      mockRequest.body = {
        name: 'sse-server',
        protocol: ServerProtocol.SSE,
        config: {
          sse: {
            url: 'https://api.example.com/sse',
            headers: { 'Authorization': 'Bearer token' },
          },
        },
        namespace: 'sse-tools',
      };

      mockServerRegistryService.registerServer.mockResolvedValue(sseServer);

      // Act
      await serverController.registerServer(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Assert
      expect(mockServerRegistryService.registerServer).toHaveBeenCalledWith('user-123', {
        name: 'sse-server',
        protocol: ServerProtocol.SSE,
        sse: {
          url: 'https://api.example.com/sse',
          headers: { 'Authorization': 'Bearer token' },
        },
        namespace: 'sse-tools',
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('should register HTTP server successfully', async () => {
      // Arrange
      const httpServer = {
        ...mockRegisteredServer,
        protocol: ServerProtocol.HTTP,
        config: {
          http: {
            baseUrl: 'https://api.example.com',
            headers: { 'Content-Type': 'application/json' },
          },
        },
      };

      mockRequest.body = {
        name: 'http-server',
        protocol: ServerProtocol.HTTP,
        config: {
          http: {
            baseUrl: 'https://api.example.com',
            headers: { 'Content-Type': 'application/json' },
          },
        },
      };

      mockServerRegistryService.registerServer.mockResolvedValue(httpServer);

      // Act
      await serverController.registerServer(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Assert
      expect(mockServerRegistryService.registerServer).toHaveBeenCalledWith('user-123', {
        name: 'http-server',
        protocol: ServerProtocol.HTTP,
        http: {
          baseUrl: 'https://api.example.com',
          headers: { 'Content-Type': 'application/json' },
        },
        namespace: undefined,
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('should return 401 when user not authenticated', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await serverController.registerServer(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('should return 400 when required fields are missing', async () => {
      // Arrange
      mockRequest.body = {
        name: 'test-server',
        // Missing protocol and config
      };

      // Act
      await serverController.registerServer(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Missing required fields: name, protocol, and config are required',
      });
    });

    it('should return 400 when validation error occurs', async () => {
      // Arrange
      mockRequest.body = {
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        config: {
          stdio: {
            command: '', // Invalid empty command
            args: [],
            env: {},
          },
        },
      };

      const validationError = new ServerConfigValidationError('STDIO command is required', 'config.stdio.command');
      mockServerRegistryService.registerServer.mockRejectedValue(validationError);

      // Act
      await serverController.registerServer(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });

    it('should return 500 when unexpected error occurs', async () => {
      // Arrange
      mockRequest.body = {
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        config: {
          stdio: {
            command: 'node',
            args: ['server.js'],
            env: {},
          },
        },
      };

      mockServerRegistryService.registerServer.mockRejectedValue(new Error('Database connection failed'));

      // Act
      await serverController.registerServer(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('updateServer', () => {
    it('should update server successfully', async () => {
      // Arrange
      const updatedServer = {
        ...mockRegisteredServer,
        name: 'updated-server',
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      };

      mockRequest.params = { id: 'server-123' };
      mockRequest.body = {
        name: 'updated-server',
        status: ServerStatus.ACTIVE,
      };

      mockServerRegistryService.updateServer.mockResolvedValue(updatedServer);

      // Act
      await serverController.updateServer(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Assert
      expect(mockServerRegistryService.updateServer).toHaveBeenCalledWith('server-123', {
        name: 'updated-server',
        status: ServerStatus.ACTIVE,
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        id: 'server-123',
        name: 'updated-server',
        protocol: ServerProtocol.STDIO,
        config: updatedServer.config,
        namespace: undefined,
        status: ServerStatus.INACTIVE,
        lastHealthCheck: '2024-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      });
    });

    it('should return 404 when server not found', async () => {
      // Arrange
      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = { name: 'updated-name' };

      mockServerRegistryService.updateServer.mockRejectedValue(new Error('Server with ID \'non-existent\' not found'));

      // Act
      await serverController.updateServer(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Server with ID \'non-existent\' not found',
      });
    });

    it('should return 400 when validation error occurs', async () => {
      // Arrange
      mockRequest.params = { id: 'server-123' };
      mockRequest.body = { name: 'duplicate-name' };

      const validationError = new ServerConfigValidationError('Server name already exists', 'name');
      mockServerRegistryService.updateServer.mockRejectedValue(validationError);

      // Act
      await serverController.updateServer(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });
  });

  describe('deleteServer', () => {
    it('should delete server successfully', async () => {
      // Arrange
      mockRequest.params = { id: 'server-123' };
      mockServerRegistryService.deleteServer.mockResolvedValue();

      // Act
      await serverController.deleteServer(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Assert
      expect(mockServerRegistryService.deleteServer).toHaveBeenCalledWith('server-123');
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should return 404 when server not found', async () => {
      // Arrange
      mockRequest.params = { id: 'non-existent' };
      mockServerRegistryService.deleteServer.mockRejectedValue(new Error('Server with ID \'non-existent\' not found'));

      // Act
      await serverController.deleteServer(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Server with ID \'non-existent\' not found',
      });
    });
  });

  describe('getServers', () => {
    it('should get servers for authenticated user', async () => {
      // Arrange
      const servers = [
        mockRegisteredServer,
        {
          ...mockRegisteredServer,
          id: 'server-456',
          name: 'another-server',
          protocol: ServerProtocol.SSE,
        },
      ];

      mockServerRegistryService.getServersByUser.mockResolvedValue(servers);

      // Act
      await serverController.getServers(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Assert
      expect(mockServerRegistryService.getServersByUser).toHaveBeenCalledWith('user-123');
      expect(mockResponse.json).toHaveBeenCalledWith([
        {
          id: 'server-123',
          name: 'test-server',
          protocol: ServerProtocol.STDIO,
          config: mockRegisteredServer.config,
          namespace: undefined,
          status: ServerStatus.INACTIVE,
          lastHealthCheck: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'server-456',
          name: 'another-server',
          protocol: ServerProtocol.SSE,
          config: mockRegisteredServer.config,
          namespace: undefined,
          status: ServerStatus.INACTIVE,
          lastHealthCheck: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]);
    });

    it('should return 401 when user not authenticated', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await serverController.getServers(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });
  });

  describe('getServer', () => {
    it('should get server by ID', async () => {
      // Arrange
      mockRequest.params = { id: 'server-123' };
      mockServerRegistryService.getServerById.mockResolvedValue(mockRegisteredServer);

      // Act
      await serverController.getServer(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Assert
      expect(mockServerRegistryService.getServerById).toHaveBeenCalledWith('server-123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        id: 'server-123',
        name: 'test-server',
        protocol: ServerProtocol.STDIO,
        config: mockRegisteredServer.config,
        namespace: undefined,
        status: ServerStatus.INACTIVE,
        lastHealthCheck: '2024-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });
    });

    it('should return 404 when server not found', async () => {
      // Arrange
      mockRequest.params = { id: 'non-existent' };
      mockServerRegistryService.getServerById.mockResolvedValue(null);

      // Act
      await serverController.getServer(mockRequest as AuthenticatedRequest, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Server not found' });
    });
  });
});