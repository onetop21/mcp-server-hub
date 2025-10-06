import swaggerJsdoc from 'swagger-jsdoc';

/**
 * Swagger/OpenAPI Configuration
 * Task 21: API Documentation
 */

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MCP Hub Router API',
      version: '1.0.0',
      description: `
# MCP Hub Router API Documentation

Multi-tenant MCP server hub with protocol adapters and routing capabilities.

## Features
- 🔐 User authentication and API key management
- 🖥️ MCP server registration and management
- 🏪 Marketplace for pre-configured MCP servers
- 📊 Health monitoring and metrics
- 🔧 Dynamic configuration management
- 💾 Backup and restore

## Authentication

Most endpoints require authentication via API key in the header:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

Get your API key by:
1. Register a user account
2. Login to get a token
3. Generate an API key

## Architecture

MCP Hub Router follows a simplified architecture:
- **Individual Server Management**: Each user runs their own MCP servers
- **Personal Credentials**: Servers use user's own API keys/tokens
- **Stateless Design**: No server-side caching for predictability
- **Multi-Protocol**: Support for STDIO, SSE, and HTTP protocols

See [Architecture Documentation](https://github.com/your-org/mcp-hub-router) for details.
      `,
      contact: {
        name: 'MCP Hub Router',
        url: 'https://github.com/your-org/mcp-hub-router'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.mcphub.example.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your API key or JWT token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            username: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Server: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            name: { type: 'string' },
            protocol: {
              type: 'string',
              enum: ['stdio', 'sse', 'http']
            },
            namespace: { type: 'string' },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'error']
            },
            config: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        MarketplaceServer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            protocol: {
              type: 'string',
              enum: ['stdio', 'sse', 'http']
            },
            command: { type: 'string' },
            args: {
              type: 'array',
              items: { type: 'string' }
            },
            envVars: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  description: { type: 'string' },
                  required: { type: 'boolean' }
                }
              }
            },
            tags: {
              type: 'array',
              items: { type: 'string' }
            },
            installCount: { type: 'number' }
          }
        },
        ApiKey: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            key: { type: 'string' },
            userId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time' },
            lastUsedAt: { type: 'string', format: 'date-time' }
          }
        },
        Tool: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            parameters: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  description: { type: 'string' },
                  required: { type: 'boolean' }
                }
              }
            },
            serverId: { type: 'string' },
            namespace: { type: 'string' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object' }
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Users',
        description: 'User management and authentication'
      },
      {
        name: 'Servers',
        description: 'MCP server registration and management'
      },
      {
        name: 'Marketplace',
        description: 'Browse and install pre-configured MCP servers'
      },
      {
        name: 'MCP Protocol',
        description: 'MCP tool listing and execution endpoints'
      },
      {
        name: 'Health',
        description: 'System health and monitoring'
      }
    ]
  },
  apis: [
    './src/infrastructure/api/routes/*.ts',
    './src/infrastructure/api/controllers/*.ts'
  ]
};

export const swaggerSpec = swaggerJsdoc(options);

