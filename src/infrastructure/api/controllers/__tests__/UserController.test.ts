import { UserController } from '../UserController';
import { DIContainer } from '../../../di/container';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';

describe('UserController', () => {
  let controller: UserController;
  let mockContainer: DIContainer;
  let mockUserService: any;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    // Mock UserManagementService
    mockUserService = {
      createUser: jest.fn(),
      authenticateUser: jest.fn(),
      getUserById: jest.fn(),
      generateApiKey: jest.fn(),
      getUserApiKeys: jest.fn(),
      revokeApiKey: jest.fn()
    };

    // Mock container
    mockContainer = {
      get: jest.fn().mockReturnValue(mockUserService)
    } as any;

    controller = new UserController(mockContainer);

    // Mock request and response
    mockReq = {
      body: {},
      params: {},
      userId: 'user-123'
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123'
      };

      mockReq.body = userData;

      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: new Date()
      };

      mockUserService.createUser.mockResolvedValue(mockUser);

      await controller.register(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockUserService.createUser).toHaveBeenCalledWith(userData);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        userId: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        createdAt: mockUser.createdAt
      });
    });

    it('should return 400 for missing fields', async () => {
      mockReq.body = { email: 'test@example.com' }; // missing username and password

      await controller.register(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INVALID_INPUT'
          })
        })
      );
    });

    it('should return 400 for weak password', async () => {
      mockReq.body = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'short'
      };

      await controller.register(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'WEAK_PASSWORD'
          })
        })
      );
    });

    it('should return 409 for duplicate user', async () => {
      mockReq.body = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123'
      };

      mockUserService.createUser.mockRejectedValue(new Error('User already exists'));

      await controller.register(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'USER_EXISTS'
          })
        })
      );
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockToken = {
        userId: 'user-123',
        token: 'api-key-123',
        expiresAt: new Date()
      };

      const mockUser = {
        id: 'user-123',
        username: 'testuser'
      };

      mockUserService.authenticateUser.mockResolvedValue(mockToken);
      mockUserService.getUserById.mockResolvedValue(mockUser);

      await controller.login(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockUserService.authenticateUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        userId: mockToken.userId,
        username: mockUser.username,
        apiKey: mockToken.token,
        expiresAt: mockToken.expiresAt
      });
    });

    it('should return 400 for missing credentials', async () => {
      mockReq.body = { email: 'test@example.com' }; // missing password

      await controller.login(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 for invalid credentials', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      mockUserService.authenticateUser.mockResolvedValue(null);

      await controller.login(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user info', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: new Date()
      };

      mockUserService.getUserById.mockResolvedValue(mockUser);

      await controller.getCurrentUser(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockUserService.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        userId: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        createdAt: mockUser.createdAt
      });
    });

    it('should return 404 if user not found', async () => {
      mockUserService.getUserById.mockResolvedValue(null);

      await controller.getCurrentUser(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('generateApiKey', () => {
    it('should generate API key successfully', async () => {
      mockReq.body = {
        name: 'My API Key'
      };

      const mockApiKey = {
        id: 'key-123',
        key: 'api-key-value',
        name: 'My API Key',
        expiresAt: new Date(),
        createdAt: new Date()
      };

      mockUserService.generateApiKey.mockResolvedValue(mockApiKey);

      await controller.generateApiKey(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockUserService.generateApiKey).toHaveBeenCalledWith('user-123', 'My API Key');
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        keyId: mockApiKey.id,
        apiKey: mockApiKey.key,
        name: mockApiKey.name,
        expiresAt: mockApiKey.expiresAt,
        createdAt: mockApiKey.createdAt
      });
    });
  });

  describe('listApiKeys', () => {
    it('should list user API keys', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          name: 'Key 1',
          createdAt: new Date(),
          expiresAt: new Date(),
          lastUsedAt: new Date()
        }
      ];

      mockUserService.getUserApiKeys.mockResolvedValue(mockKeys);

      await controller.listApiKeys(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockUserService.getUserApiKeys).toHaveBeenCalledWith('user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        keys: expect.arrayContaining([
          expect.objectContaining({
            keyId: 'key-1',
            name: 'Key 1'
          })
        ])
      });
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke API key successfully', async () => {
      mockReq.params = { keyId: 'key-123' };

      mockUserService.revokeApiKey.mockResolvedValue(undefined);

      await controller.revokeApiKey(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockUserService.revokeApiKey).toHaveBeenCalledWith('key-123');
      expect(mockRes.status).toHaveBeenCalledWith(204);
    });

    it('should return 404 if key not found', async () => {
      mockReq.params = { keyId: 'key-123' };

      mockUserService.revokeApiKey.mockRejectedValue(new Error('API key not found'));

      await controller.revokeApiKey(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});

