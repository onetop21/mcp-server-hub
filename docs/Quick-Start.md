# Quick Start Guide

## 빠른 시작

MCP Hub Router를 5분 안에 시작해보세요!

## Prerequisites

- Node.js 16+ 
- PostgreSQL 13+ (optional, mock DB 지원)
- npm or yarn

## Installation

```bash
# Clone repository
git clone https://github.com/your-org/mcp-hub-router.git
cd mcp-hub-router

# Install dependencies
npm install

# Build
npm run build
```

## Start Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

서버가 시작되면 `http://localhost:3000`에서 접속 가능합니다.

## 1. Register User

```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "myuser",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "userId": "uuid-here",
  "username": "myuser",
  "email": "user@example.com",
  "createdAt": "2025-10-05T..."
}
```

## 2. Login & Get API Key

```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "userId": "uuid-here",
  "username": "myuser",
  "apiKey": "your-api-key-here",
  "expiresAt": "2026-01-05T..."
}
```

**API 키를 복사하세요!** 이후 모든 요청에 사용됩니다.

## 3. Browse Marketplace

```bash
curl http://localhost:3000/api/marketplace
```

**Response:**
```json
{
  "servers": [
    {
      "id": "github-mcp",
      "name": "GitHub MCP",
      "description": "GitHub integration server",
      "protocol": "stdio",
      "tags": ["github", "development"],
      "installCount": 0
    },
    {
      "id": "slack-mcp",
      "name": "Slack MCP",
      "description": "Slack integration",
      "protocol": "stdio",
      "tags": ["slack", "communication"],
      "installCount": 0
    }
  ]
}
```

## 4. Get Template Details

```bash
curl http://localhost:3000/api/marketplace/github-mcp
```

**Response:**
```json
{
  "id": "github-mcp",
  "name": "GitHub MCP",
  "description": "GitHub integration server for issues, PRs, and repositories",
  "protocol": "stdio",
  "command": "mcp-server-github",
  "requiredEnv": ["GITHUB_TOKEN"],
  "optionalEnv": ["GITHUB_ORG"],
  "envDescriptions": {
    "GITHUB_TOKEN": "GitHub Personal Access Token (generate at github.com/settings/tokens)",
    "GITHUB_ORG": "Default organization name (optional)"
  },
  "installInstructions": "npm install -g @modelcontextprotocol/server-github",
  "documentation": "https://github.com/modelcontextprotocol/servers/tree/main/src/github"
}
```

## 5. Install MCP Server Binary

마켓플레이스 템플릿의 `installInstructions`를 따라 MCP 서버 바이너리를 설치하세요:

```bash
npm install -g @modelcontextprotocol/server-github
```

## 6. Install from Marketplace

```bash
curl -X POST http://localhost:3000/api/marketplace/github-mcp/install \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{
    "name": "My GitHub Server",
    "namespace": "my-workspace",
    "env": {
      "GITHUB_TOKEN": "ghp_your_token_here"
    }
  }'
```

**Response:**
```json
{
  "serverId": "server-uuid",
  "name": "My GitHub Server",
  "protocol": "stdio",
  "namespace": "my-workspace",
  "status": "active",
  "installedFrom": "github-mcp"
}
```

## 7. List My Servers

```bash
curl http://localhost:3000/api/servers \
  -H "Authorization: Bearer your-api-key-here"
```

**Response:**
```json
{
  "servers": [
    {
      "serverId": "server-uuid",
      "name": "My GitHub Server",
      "protocol": "stdio",
      "namespace": "my-workspace",
      "status": "active",
      "createdAt": "2025-10-05T..."
    }
  ]
}
```

## 8. Register Custom Server

마켓플레이스를 사용하지 않고 직접 서버를 등록할 수도 있습니다:

```bash
curl -X POST http://localhost:3000/api/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{
    "name": "Custom Server",
    "protocol": "stdio",
    "namespace": "custom",
    "config": {
      "stdio": {
        "command": "my-mcp-server",
        "args": ["--port", "8080"],
        "env": {
          "API_KEY": "my-api-key"
        }
      }
    }
  }'
```

## 9. Check Server Health

```bash
curl http://localhost:3000/api/servers/server-uuid/health \
  -H "Authorization: Bearer your-api-key-here"
```

**Response:**
```json
{
  "serverId": "server-uuid",
  "status": "active",
  "lastCheck": "2025-10-05T...",
  "responseTime": 45,
  "error": null
}
```

## 10. Update Server

```bash
curl -X PUT http://localhost:3000/api/servers/server-uuid \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{
    "name": "Updated Server Name"
  }'
```

## 11. Delete Server

```bash
curl -X DELETE http://localhost:3000/api/servers/server-uuid \
  -H "Authorization: Bearer your-api-key-here"
```

---

## Next Steps

- [API Reference](./API-Reference.md) - 전체 API 문서
- [Architecture](./Architecture-Simplified.md) - 아키텍처 설명
- [Marketplace Guide](./Marketplace-Guide.md) - 마켓플레이스 사용 가이드

---

## Troubleshooting

### Server won't start

- PostgreSQL이 실행 중인지 확인하세요 (현재는 mock DB 사용)
- 포트 3000이 이미 사용 중인지 확인하세요

### Authentication fails

- API 키가 올바른지 확인하세요
- `Authorization: Bearer <key>` 형식이 맞는지 확인하세요

### Server installation fails

- `installInstructions`를 따라 MCP 서버 바이너리를 먼저 설치했는지 확인하세요
- 필수 환경변수가 모두 제공되었는지 확인하세요

---

## Support

- GitHub Issues: [링크]
- Documentation: [링크]

