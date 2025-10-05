import { MCPController } from '../MCPController';
import { DIContainer } from '../../../di/container';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';

describe('MCPController', () => {
  let controller: MCPController;
  let mockContainer: DIContainer;
  let mockEndpointService: any;
  let mockRouterService: any;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    // Mock services
    mockEndpointService = {
      getEndpointById: jest.fn()
    };

    mockRouterService = {
      getAvailableTools: jest.fn(),
      routeToolCall: jest.fn()
    };

    // Mock container
    mockContainer = {
      get: jest.fn((type) => {
        if (type.toString().includes('EndpointService')) {
          return mockEndpointService;
        }
        if (type.toString().includes('RouterService')) {
          return mockRouterService;
        }
        return null;
      })
    } as any;

    controller = new MCPController(mockContainer);

    // Mock request and response
    mockReq = {
      params: { endpointId: 'endpoint-123' },
      userId: 'user-123',
      body: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('getTools', () => {
    it('should return tools for valid endpoint', async () => {
      const mockEndpoint = {
        id: 'endpoint-123',
        userId: 'user-123',
        groupId: 'group-123'
      };

      const mockTools = [
        {
          name: 'test-tool',
          description: 'Test tool',
          inputSchema: { type: 'object' }
        }
      ];

      mockEndpointService.getEndpointById.mockResolvedValue(mockEndpoint);
      mockRouterService.getAvailableTools.mockResolvedValue(mockTools);

      await controller.getTools(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        tools: mockTools
      });
    });

    it('should return 404 for non-existent endpoint', async () => {
      mockEndpointService.getEndpointById.mockResolvedValue(null);

      await controller.getTools(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: expect.objectContaining({
          code: 'ENDPOINT_NOT_FOUND'
        })
      });
    });

    it('should return 403 for unauthorized user', async () => {
      const mockEndpoint = {
        id: 'endpoint-123',
        userId: 'other-user',
        groupId: 'group-123'
      };

      mockEndpointService.getEndpointById.mockResolvedValue(mockEndpoint);

      await controller.getTools(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: expect.objectContaining({
          code: 'FORBIDDEN'
        })
      });
    });
  });

  describe('callTool', () => {
    it('should call tool successfully', async () => {
      const mockEndpoint = {
        id: 'endpoint-123',
        userId: 'user-123',
        groupId: 'group-123'
      };

      const mockResult = {
        content: [{ type: 'text', text: 'Result' }],
        isError: false
      };

      mockReq.body = {
        name: 'test-tool',
        arguments: { param: 'value' }
      };

      mockEndpointService.getEndpointById.mockResolvedValue(mockEndpoint);
      mockRouterService.routeToolCall.mockResolvedValue(mockResult);

      await controller.callTool(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRouterService.routeToolCall).toHaveBeenCalledWith(
        'group-123',
        'test-tool',
        { param: 'value' }
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 400 for missing tool name', async () => {
      mockReq.body = {};

      await controller.callTool(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: expect.objectContaining({
          code: 'INVALID_INPUT'
        })
      });
    });
  });
});

