/**
 * E2E Integration Tests for MCP Hub Router APIs
 * Task 21: Integration & E2E Tests
 */

import request from 'supertest';
import { createApp } from '../app';
import { createContainer } from '../../di/container';

describe('MCP Hub Router E2E Tests', () => {
  let app: any;
  let apiKey: string;
  let userId: string;
  let serverId: string;

  beforeAll(async () => {
    // Initialize container and app
    const container = createContainer();
    app = createApp(container);
  });

  describe('User Management Flow', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          email: 'e2e-test@example.com',
          username: 'e2etest',
          password: 'test123456'
        })
        .expect(201);

      expect(response.body).toHaveProperty('userId');
      expect(response.body.username).toBe('e2etest');
      userId = response.body.userId;
    });

    it('should login and get API key', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'e2e-test@example.com',
          password: 'test123456'
        })
        .expect(200);

      expect(response.body).toHaveProperty('apiKey');
      apiKey = response.body.apiKey;
    });

    it('should get current user info', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response.body.username).toBe('e2etest');
    });

    it('should generate new API key', async () => {
      const response = await request(app)
        .post('/api/users/api-keys')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ name: 'Test Key' })
        .expect(201);

      expect(response.body).toHaveProperty('apiKey');
    });

    it('should list API keys', async () => {
      const response = await request(app)
        .get('/api/users/api-keys')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response.body.keys).toBeInstanceOf(Array);
    });
  });

  describe('Marketplace Flow', () => {
    it('should list marketplace servers', async () => {
      const response = await request(app)
        .get('/api/marketplace')
        .expect(200);

      expect(response.body.servers).toBeInstanceOf(Array);
      expect(response.body.servers.length).toBeGreaterThan(0);
    });

    it('should get marketplace server details', async () => {
      const response = await request(app)
        .get('/api/marketplace/github-mcp')
        .expect(200);

      expect(response.body.id).toBe('github-mcp');
      expect(response.body.name).toBe('GitHub MCP');
      expect(response.body.requiredEnv).toContain('GITHUB_TOKEN');
    });

    it('should install from marketplace', async () => {
      const response = await request(app)
        .post('/api/marketplace/github-mcp/install')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          name: 'My GitHub Server',
          namespace: 'github',
          env: {
            GITHUB_TOKEN: 'test-token-123'
          }
        })
        .expect(201);

      expect(response.body).toHaveProperty('serverId');
      expect(response.body.name).toBe('My GitHub Server');
      serverId = response.body.serverId;
    });
  });

  describe('Server Management Flow', () => {
    it('should list user servers', async () => {
      const response = await request(app)
        .get('/api/servers')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response.body.servers).toBeInstanceOf(Array);
    });

    it('should get server details', async () => {
      const response = await request(app)
        .get(`/api/servers/${serverId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response.body.serverId).toBe(serverId);
    });

    it('should update server', async () => {
      const response = await request(app)
        .put(`/api/servers/${serverId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ name: 'Updated Server Name' })
        .expect(200);

      expect(response.body.name).toBe('Updated Server Name');
    });

    it('should register custom server', async () => {
      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          name: 'Custom Server',
          protocol: 'stdio',
          namespace: 'custom',
          config: {
            stdio: {
              command: 'echo',
              args: ['hello'],
              env: {}
            }
          }
        })
        .expect(201);

      expect(response.body).toHaveProperty('serverId');
    });
  });

  describe('Health Monitoring', () => {
    it('should check system health', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
    });

    it('should check readiness', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body.status).toBe('ready');
    });

    it('should check liveness', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body.status).toBe('alive');
    });
  });

  describe('MCP Protocol Endpoints', () => {
    let endpointId: string;

    beforeAll(() => {
      // For now, use a mock endpoint ID
      // In real scenario, create endpoint first
      endpointId = 'test-endpoint-123';
    });

    it('should handle 404 for non-existent endpoint tools', async () => {
      await request(app)
        .get(`/api/mcp/${endpointId}/tools`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(404);
    });

    it('should handle 404 for non-existent endpoint call', async () => {
      await request(app)
        .post(`/api/mcp/${endpointId}/tools/call`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ name: 'test-tool', arguments: {} })
        .expect(404);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should reject requests without auth token', async () => {
      await request(app)
        .get('/api/users/me')
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should allow access to public endpoints', async () => {
      await request(app)
        .get('/api/marketplace')
        .expect(200);

      await request(app)
        .get('/health')
        .expect(200);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      await request(app)
        .get('/api/nonexistent')
        .expect(404);
    });

    it('should return 400 for invalid input', async () => {
      await request(app)
        .post('/api/users/register')
        .send({ email: 'test@example.com' }) // missing required fields
        .expect(400);
    });

    it('should return 409 for duplicate user registration', async () => {
      await request(app)
        .post('/api/users/register')
        .send({
          email: 'e2e-test@example.com', // already exists
          username: 'duplicate',
          password: 'test123456'
        })
        .expect(409);
    });
  });

  describe('Cleanup', () => {
    it('should delete server', async () => {
      await request(app)
        .delete(`/api/servers/${serverId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(204);
    });
  });
});

