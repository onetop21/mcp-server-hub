# MCP Hub Router - Complete REST API Design

## API Philosophy

- **Simple**: Easy to understand and use
- **RESTful**: Standard HTTP methods and status codes
- **Secure**: API key authentication for all endpoints
- **Complete**: All features accessible via API (for web dashboard)

## Authentication

All API requests require authentication via API key in header:

```
Authorization: Bearer <api_key>
```

or

```
X-API-Key: <api_key>
```

## Base URL

```
http://localhost:3000/api
```

---

## 1. User Management

### 1.1 Register User
```http
POST /api/users/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "john_doe",
  "password": "secure_password"
}

Response 201:
{
  "userId": "user_123",
  "username": "john_doe",
  "email": "user@example.com"
}
```

### 1.2 Login
```http
POST /api/users/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}

Response 200:
{
  "userId": "user_123",
  "apiKey": "key_xxxxxxxxxx",
  "expiresAt": "2025-01-01T00:00:00Z"
}
```

### 1.3 Get Current User Info
```http
GET /api/users/me
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "userId": "user_123",
  "username": "john_doe",
  "email": "user@example.com",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### 1.4 Generate New API Key
```http
POST /api/users/api-keys
Authorization: Bearer key_xxxxxxxxxx
Content-Type: application/json

{
  "name": "My Project Key",
  "expiresInDays": 90
}

Response 201:
{
  "keyId": "key_123",
  "apiKey": "key_yyyyyyyyyy",
  "name": "My Project Key",
  "expiresAt": "2025-04-01T00:00:00Z"
}
```

### 1.5 List API Keys
```http
GET /api/users/api-keys
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "keys": [
    {
      "keyId": "key_123",
      "name": "My Project Key",
      "createdAt": "2024-01-01T00:00:00Z",
      "expiresAt": "2025-04-01T00:00:00Z",
      "lastUsedAt": "2024-10-05T12:00:00Z"
    }
  ]
}
```

### 1.6 Revoke API Key
```http
DELETE /api/users/api-keys/:keyId
Authorization: Bearer key_xxxxxxxxxx

Response 204 No Content
```

---

## 2. Server Management

### 2.1 Register Server
```http
POST /api/servers
Authorization: Bearer key_xxxxxxxxxx
Content-Type: application/json

{
  "name": "My GitHub Server",
  "protocol": "stdio",
  "config": {
    "stdio": {
      "command": "mcp-server-github",
      "args": [],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxx"
      }
    }
  },
  "namespace": "github"
}

Response 201:
{
  "serverId": "server_123",
  "name": "My GitHub Server",
  "protocol": "stdio",
  "namespace": "github",
  "status": "active",
  "createdAt": "2024-10-05T00:00:00Z"
}
```

### 2.2 List My Servers
```http
GET /api/servers
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "servers": [
    {
      "serverId": "server_123",
      "name": "My GitHub Server",
      "protocol": "stdio",
      "namespace": "github",
      "status": "active",
      "lastHealthCheck": "2024-10-05T12:00:00Z",
      "createdAt": "2024-10-05T00:00:00Z"
    }
  ]
}
```

### 2.3 Get Server Details
```http
GET /api/servers/:serverId
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "serverId": "server_123",
  "name": "My GitHub Server",
  "protocol": "stdio",
  "config": {
    "stdio": {
      "command": "mcp-server-github",
      "args": [],
      "env": {
        "GITHUB_TOKEN": "***hidden***"
      }
    }
  },
  "namespace": "github",
  "status": "active",
  "lastHealthCheck": "2024-10-05T12:00:00Z",
  "createdAt": "2024-10-05T00:00:00Z",
  "updatedAt": "2024-10-05T00:00:00Z"
}
```

### 2.4 Update Server
```http
PUT /api/servers/:serverId
Authorization: Bearer key_xxxxxxxxxx
Content-Type: application/json

{
  "name": "My Updated GitHub Server",
  "config": {
    "stdio": {
      "env": {
        "GITHUB_TOKEN": "ghp_new_token"
      }
    }
  }
}

Response 200:
{
  "serverId": "server_123",
  "name": "My Updated GitHub Server",
  "status": "active",
  "updatedAt": "2024-10-05T12:30:00Z"
}
```

### 2.5 Delete Server
```http
DELETE /api/servers/:serverId
Authorization: Bearer key_xxxxxxxxxx

Response 204 No Content
```

### 2.6 Get Server Health
```http
GET /api/servers/:serverId/health
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "serverId": "server_123",
  "status": "active",
  "lastCheck": "2024-10-05T12:00:00Z",
  "responseTime": 45,
  "toolCount": 12
}
```

### 2.7 Get Server Tools
```http
GET /api/servers/:serverId/tools
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "tools": [
    {
      "name": "create_issue",
      "description": "Create a GitHub issue",
      "parameters": [
        {
          "name": "title",
          "type": "string",
          "required": true
        },
        {
          "name": "body",
          "type": "string",
          "required": false
        }
      ]
    }
  ]
}
```

---

## 3. Server Groups

### 3.1 Create Group
```http
POST /api/groups
Authorization: Bearer key_xxxxxxxxxx
Content-Type: application/json

{
  "name": "Development Tools",
  "description": "GitHub, Slack, and other dev tools",
  "serverIds": ["server_123", "server_456"]
}

Response 201:
{
  "groupId": "group_123",
  "name": "Development Tools",
  "description": "GitHub, Slack, and other dev tools",
  "serverIds": ["server_123", "server_456"],
  "createdAt": "2024-10-05T00:00:00Z"
}
```

### 3.2 List My Groups
```http
GET /api/groups
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "groups": [
    {
      "groupId": "group_123",
      "name": "Development Tools",
      "serverCount": 2,
      "createdAt": "2024-10-05T00:00:00Z"
    }
  ]
}
```

### 3.3 Get Group Details
```http
GET /api/groups/:groupId
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "groupId": "group_123",
  "name": "Development Tools",
  "description": "GitHub, Slack, and other dev tools",
  "serverIds": ["server_123", "server_456"],
  "servers": [
    {
      "serverId": "server_123",
      "name": "My GitHub Server",
      "status": "active"
    }
  ],
  "routingRules": [],
  "createdAt": "2024-10-05T00:00:00Z"
}
```

### 3.4 Update Group
```http
PUT /api/groups/:groupId
Authorization: Bearer key_xxxxxxxxxx
Content-Type: application/json

{
  "name": "Updated Dev Tools",
  "serverIds": ["server_123", "server_456", "server_789"]
}

Response 200:
{
  "groupId": "group_123",
  "name": "Updated Dev Tools",
  "serverCount": 3,
  "updatedAt": "2024-10-05T12:00:00Z"
}
```

### 3.5 Delete Group
```http
DELETE /api/groups/:groupId
Authorization: Bearer key_xxxxxxxxxx

Response 204 No Content
```

### 3.6 Get Group Health
```http
GET /api/groups/:groupId/health
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "groupId": "group_123",
  "servers": [
    {
      "serverId": "server_123",
      "name": "My GitHub Server",
      "status": "active",
      "responseTime": 45
    },
    {
      "serverId": "server_456",
      "name": "My Slack Server",
      "status": "inactive",
      "error": "Connection timeout"
    }
  ],
  "summary": {
    "total": 2,
    "active": 1,
    "inactive": 1,
    "error": 0
  }
}
```

---

## 4. Endpoints

### 4.1 Create Default Endpoint
```http
POST /api/endpoints/default
Authorization: Bearer key_xxxxxxxxxx

Response 201:
{
  "endpointId": "endpoint_123",
  "url": "http://localhost:3000/mcp/endpoint_123",
  "sseUrl": "http://localhost:3000/mcp/endpoint_123/sse",
  "httpUrl": "http://localhost:3000/mcp/endpoint_123/http",
  "type": "default",
  "serverCount": 5,
  "createdAt": "2024-10-05T00:00:00Z"
}
```

### 4.2 Create Group Endpoint
```http
POST /api/endpoints/group/:groupId
Authorization: Bearer key_xxxxxxxxxx

Response 201:
{
  "endpointId": "endpoint_456",
  "url": "http://localhost:3000/mcp/endpoint_456",
  "sseUrl": "http://localhost:3000/mcp/endpoint_456/sse",
  "httpUrl": "http://localhost:3000/mcp/endpoint_456/http",
  "type": "group",
  "groupId": "group_123",
  "serverCount": 2,
  "createdAt": "2024-10-05T00:00:00Z"
}
```

### 4.3 List My Endpoints
```http
GET /api/endpoints
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "endpoints": [
    {
      "endpointId": "endpoint_123",
      "type": "default",
      "url": "http://localhost:3000/mcp/endpoint_123",
      "serverCount": 5,
      "lastAccessedAt": "2024-10-05T11:00:00Z",
      "createdAt": "2024-10-05T00:00:00Z"
    },
    {
      "endpointId": "endpoint_456",
      "type": "group",
      "groupId": "group_123",
      "groupName": "Development Tools",
      "url": "http://localhost:3000/mcp/endpoint_456",
      "serverCount": 2,
      "createdAt": "2024-10-05T00:00:00Z"
    }
  ]
}
```

### 4.4 Get Endpoint Details
```http
GET /api/endpoints/:endpointId
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "endpointId": "endpoint_123",
  "type": "default",
  "url": "http://localhost:3000/mcp/endpoint_123",
  "sseUrl": "http://localhost:3000/mcp/endpoint_123/sse",
  "httpUrl": "http://localhost:3000/mcp/endpoint_123/http",
  "servers": [
    {
      "serverId": "server_123",
      "name": "My GitHub Server",
      "namespace": "github",
      "status": "active"
    }
  ],
  "createdAt": "2024-10-05T00:00:00Z",
  "lastAccessedAt": "2024-10-05T11:00:00Z"
}
```

### 4.5 Delete Endpoint
```http
DELETE /api/endpoints/:endpointId
Authorization: Bearer key_xxxxxxxxxx

Response 204 No Content
```

### 4.6 Regenerate Endpoint
```http
POST /api/endpoints/:endpointId/regenerate
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "endpointId": "endpoint_789_new",
  "url": "http://localhost:3000/mcp/endpoint_789_new",
  "message": "Old endpoint invalidated"
}
```

---

## 5. Marketplace

### 5.1 List Marketplace Servers (Public)
```http
GET /api/marketplace/servers
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "servers": [
    {
      "marketplaceId": "github-mcp",
      "name": "GitHub MCP",
      "description": "GitHub integration server",
      "protocol": "stdio",
      "command": "mcp-server-github",
      "requiredEnv": ["GITHUB_TOKEN"],
      "envDescriptions": {
        "GITHUB_TOKEN": "GitHub Personal Access Token"
      },
      "tags": ["github", "development"],
      "installCount": 1234,
      "rating": 4.8,
      "createdBy": "admin",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 5.2 Get Marketplace Server Details
```http
GET /api/marketplace/servers/:marketplaceId
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "marketplaceId": "github-mcp",
  "name": "GitHub MCP",
  "description": "Complete GitHub integration",
  "longDescription": "This server provides comprehensive GitHub integration...",
  "protocol": "stdio",
  "command": "mcp-server-github",
  "args": [],
  "requiredEnv": ["GITHUB_TOKEN"],
  "optionalEnv": ["GITHUB_ORG"],
  "envDescriptions": {
    "GITHUB_TOKEN": "Your GitHub Personal Access Token",
    "GITHUB_ORG": "Optional: Default organization"
  },
  "tools": [
    {
      "name": "create_issue",
      "description": "Create a GitHub issue"
    }
  ],
  "tags": ["github", "development"],
  "installInstructions": "npm install -g @modelcontextprotocol/server-github",
  "documentation": "https://github.com/...",
  "installCount": 1234,
  "rating": 4.8
}
```

### 5.3 Register Server from Marketplace
```http
POST /api/servers/from-marketplace
Authorization: Bearer key_xxxxxxxxxx
Content-Type: application/json

{
  "marketplaceId": "github-mcp",
  "name": "My GitHub Server",
  "namespace": "github",
  "env": {
    "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxx"
  }
}

Response 201:
{
  "serverId": "server_123",
  "name": "My GitHub Server",
  "protocol": "stdio",
  "namespace": "github",
  "status": "active",
  "message": "Server registered successfully from marketplace"
}
```

### 5.4 Register Marketplace Server (Admin Only)
```http
POST /api/admin/marketplace/servers
Authorization: Bearer admin_key_xxxxxxxxxx
Content-Type: application/json

{
  "marketplaceId": "github-mcp",
  "name": "GitHub MCP",
  "description": "GitHub integration server",
  "longDescription": "Complete GitHub integration...",
  "protocol": "stdio",
  "command": "mcp-server-github",
  "args": [],
  "requiredEnv": ["GITHUB_TOKEN"],
  "optionalEnv": ["GITHUB_ORG"],
  "envDescriptions": {
    "GITHUB_TOKEN": "Your GitHub Personal Access Token",
    "GITHUB_ORG": "Optional: Default organization"
  },
  "tags": ["github", "development"],
  "installInstructions": "npm install -g @modelcontextprotocol/server-github",
  "documentation": "https://github.com/..."
}

Response 201:
{
  "marketplaceId": "github-mcp",
  "name": "GitHub MCP",
  "createdAt": "2024-10-05T00:00:00Z"
}
```

### 5.5 Update Marketplace Server (Admin Only)
```http
PUT /api/admin/marketplace/servers/:marketplaceId
Authorization: Bearer admin_key_xxxxxxxxxx
Content-Type: application/json

{
  "description": "Updated description",
  "tags": ["github", "development", "new-tag"]
}

Response 200:
{
  "marketplaceId": "github-mcp",
  "message": "Updated successfully"
}
```

### 5.6 Delete Marketplace Server (Admin Only)
```http
DELETE /api/admin/marketplace/servers/:marketplaceId
Authorization: Bearer admin_key_xxxxxxxxxx

Response 204 No Content
```

---

## 6. Usage & Statistics

### 6.1 Get My Usage Stats
```http
GET /api/usage/stats
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "period": "last_30_days",
  "totalRequests": 1234,
  "requestsByServer": {
    "server_123": 567,
    "server_456": 667
  },
  "requestsByDay": [
    {
      "date": "2024-10-05",
      "count": 45
    }
  ],
  "topTools": [
    {
      "name": "github.create_issue",
      "count": 123
    }
  ]
}
```

### 6.2 Get Rate Limit Info
```http
GET /api/usage/rate-limit
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "limit": {
    "requestsPerHour": 1000,
    "requestsPerDay": 10000
  },
  "current": {
    "requestsThisHour": 45,
    "requestsToday": 567
  },
  "remaining": {
    "thisHour": 955,
    "today": 9433
  },
  "resetAt": {
    "hour": "2024-10-05T13:00:00Z",
    "day": "2024-10-06T00:00:00Z"
  }
}
```

---

## 7. MCP Protocol Endpoints (For Agents)

### 7.1 Get Available Tools
```http
GET /mcp/:endpointId/tools
Authorization: Bearer key_xxxxxxxxxx

Response 200:
{
  "tools": [
    {
      "name": "github.create_issue",
      "description": "Create a GitHub issue",
      "inputSchema": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "body": { "type": "string" }
        },
        "required": ["title"]
      }
    }
  ]
}
```

### 7.2 Call Tool
```http
POST /mcp/:endpointId/tools/call
Authorization: Bearer key_xxxxxxxxxx
Content-Type: application/json

{
  "name": "github.create_issue",
  "arguments": {
    "title": "Bug report",
    "body": "Found a bug..."
  }
}

Response 200:
{
  "result": {
    "issueUrl": "https://github.com/user/repo/issues/123",
    "issueNumber": 123
  }
}
```

### 7.3 SSE Connection
```http
GET /mcp/:endpointId/sse
Authorization: Bearer key_xxxxxxxxxx
Accept: text/event-stream

Response: Server-Sent Events stream
```

### 7.4 HTTP Streaming
```http
POST /mcp/:endpointId/http
Authorization: Bearer key_xxxxxxxxxx
Content-Type: application/json

(MCP protocol messages)
```

---

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid API key",
    "details": "The provided API key is expired or invalid"
  }
}
```

### Common Error Codes
- `400` Bad Request - Invalid input
- `401` Unauthorized - Missing or invalid API key
- `403` Forbidden - Insufficient permissions
- `404` Not Found - Resource not found
- `429` Too Many Requests - Rate limit exceeded
- `500` Internal Server Error - Server error

---

## Rate Limits

Default limits:
- **1000 requests per hour** per API key
- **10000 requests per day** per API key

Headers in response:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 955
X-RateLimit-Reset: 1696518000
```

---

## Pagination

For list endpoints, use query parameters:

```http
GET /api/servers?page=1&limit=20
```

Response includes pagination metadata:
```json
{
  "servers": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

## Filtering & Sorting

```http
GET /api/servers?status=active&sort=createdAt&order=desc
GET /api/marketplace/servers?tags=github&search=issue
```

