# API Reference

## 개요

MCP Hub Router는 다음과 같은 REST API를 제공합니다:

- **User Management**: 사용자 등록, 로그인, API 키 관리
- **Server Management**: MCP 서버 등록, 조회, 수정, 삭제
- **Marketplace**: 서버 템플릿 카탈로그 및 설치
- **Health**: 시스템 및 서버 상태 확인

## Base URL

```
http://localhost:3000
```

## Authentication

대부분의 API는 Bearer 토큰 인증이 필요합니다:

```
Authorization: Bearer <your-api-key>
```

---

## User Management

### POST /api/users/register

새 사용자를 등록합니다.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "myusername",
  "password": "securepassword123"
}
```

**Response (201):**
```json
{
  "userId": "uuid",
  "username": "myusername",
  "email": "user@example.com",
  "createdAt": "2025-10-05T..."
}
```

### POST /api/users/login

사용자 로그인 및 API 키 발급.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "userId": "uuid",
  "username": "myusername",
  "apiKey": "generated-api-key",
  "expiresAt": "2026-01-05T..."
}
```

### GET /api/users/me

현재 사용자 정보를 조회합니다.

**Headers:**
```
Authorization: Bearer <api-key>
```

**Response (200):**
```json
{
  "userId": "uuid",
  "username": "myusername",
  "email": "user@example.com",
  "createdAt": "2025-10-05T..."
}
```

### POST /api/users/api-keys

새 API 키를 생성합니다.

**Headers:**
```
Authorization: Bearer <api-key>
```

**Request Body:**
```json
{
  "name": "My Key",
  "expiresInDays": 90
}
```

**Response (201):**
```json
{
  "keyId": "uuid",
  "apiKey": "new-api-key",
  "name": "My Key",
  "expiresAt": "2026-01-05T...",
  "createdAt": "2025-10-05T..."
}
```

### GET /api/users/api-keys

API 키 목록을 조회합니다.

**Response (200):**
```json
{
  "keys": [
    {
      "keyId": "uuid",
      "name": "My Key",
      "createdAt": "2025-10-05T...",
      "expiresAt": "2026-01-05T...",
      "lastUsedAt": "2025-10-05T..."
    }
  ]
}
```

### DELETE /api/users/api-keys/:keyId

API 키를 취소합니다.

**Response (204):** No Content

---

## Server Management

### POST /api/servers

새 MCP 서버를 등록합니다.

**Request Body:**
```json
{
  "name": "My GitHub Server",
  "protocol": "stdio",
  "namespace": "my-workspace",
  "config": {
    "stdio": {
      "command": "mcp-server-github",
      "args": [],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxx"
      }
    }
  }
}
```

**Response (201):**
```json
{
  "serverId": "uuid",
  "name": "My GitHub Server",
  "protocol": "stdio",
  "namespace": "my-workspace",
  "status": "active",
  "createdAt": "2025-10-05T..."
}
```

### GET /api/servers

사용자의 서버 목록을 조회합니다.

**Response (200):**
```json
{
  "servers": [
    {
      "serverId": "uuid",
      "name": "My GitHub Server",
      "protocol": "stdio",
      "namespace": "my-workspace",
      "status": "active",
      "lastHealthCheck": "2025-10-05T...",
      "createdAt": "2025-10-05T..."
    }
  ]
}
```

### GET /api/servers/:serverId

특정 서버의 상세 정보를 조회합니다.

**Response (200):**
```json
{
  "serverId": "uuid",
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
  "namespace": "my-workspace",
  "status": "active",
  "lastHealthCheck": "2025-10-05T...",
  "createdAt": "2025-10-05T...",
  "updatedAt": "2025-10-05T..."
}
```

### PUT /api/servers/:serverId

서버 정보를 수정합니다.

**Request Body:**
```json
{
  "name": "Updated Server Name",
  "status": "inactive"
}
```

**Response (200):**
```json
{
  "serverId": "uuid",
  "name": "Updated Server Name",
  "status": "inactive",
  "updatedAt": "2025-10-05T..."
}
```

### DELETE /api/servers/:serverId

서버를 삭제합니다.

**Response (204):** No Content

### GET /api/servers/:serverId/health

서버의 헬스 상태를 확인합니다.

**Response (200):**
```json
{
  "serverId": "uuid",
  "status": "active",
  "lastCheck": "2025-10-05T...",
  "responseTime": 45,
  "error": null
}
```

---

## Marketplace

### GET /api/marketplace

마켓플레이스의 서버 템플릿 목록을 조회합니다.

**Query Parameters:**
- `tags` (optional): 쉼표로 구분된 태그 목록 (예: `github,development`)
- `search` (optional): 검색어

**Response (200):**
```json
{
  "servers": [
    {
      "id": "github-mcp",
      "name": "GitHub MCP",
      "description": "GitHub integration server for issues, PRs, and repositories",
      "protocol": "stdio",
      "tags": ["github", "development", "scm", "issues"],
      "installCount": 42,
      "rating": null
    },
    {
      "id": "slack-mcp",
      "name": "Slack MCP",
      "description": "Slack integration for messages, channels, and users",
      "protocol": "stdio",
      "tags": ["slack", "communication", "collaboration"],
      "installCount": 28,
      "rating": null
    }
  ]
}
```

### GET /api/marketplace/:marketplaceId

특정 마켓플레이스 서버의 상세 정보를 조회합니다.

**Response (200):**
```json
{
  "id": "github-mcp",
  "name": "GitHub MCP",
  "description": "GitHub integration server for issues, PRs, and repositories",
  "longDescription": "Complete GitHub integration providing tools for creating issues, searching repositories, managing pull requests, and more.",
  "protocol": "stdio",
  "command": "mcp-server-github",
  "args": [],
  "requiredEnv": ["GITHUB_TOKEN"],
  "optionalEnv": ["GITHUB_ORG"],
  "envDescriptions": {
    "GITHUB_TOKEN": "GitHub Personal Access Token (generate at github.com/settings/tokens)",
    "GITHUB_ORG": "Default organization name (optional)"
  },
  "tags": ["github", "development", "scm", "issues"],
  "installInstructions": "npm install -g @modelcontextprotocol/server-github",
  "documentation": "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
  "installCount": 42,
  "rating": null
}
```

### POST /api/marketplace/:marketplaceId/install

마켓플레이스에서 서버를 설치합니다.

**Request Body:**
```json
{
  "name": "My GitHub Server",
  "namespace": "my-workspace",
  "env": {
    "GITHUB_TOKEN": "ghp_xxxxx",
    "GITHUB_ORG": "my-org"
  }
}
```

**Response (201):**
```json
{
  "serverId": "uuid",
  "name": "My GitHub Server",
  "protocol": "stdio",
  "namespace": "my-workspace",
  "status": "active",
  "installedFrom": "github-mcp"
}
```

### POST /api/marketplace

(Admin) 새 마켓플레이스 서버를 등록합니다.

**Request Body:**
```json
{
  "id": "custom-mcp",
  "name": "Custom MCP",
  "description": "A custom MCP server",
  "protocol": "stdio",
  "command": "custom-mcp",
  "requiredEnv": ["API_KEY"],
  "envDescriptions": {
    "API_KEY": "Your API key"
  },
  "tags": ["custom"]
}
```

**Response (201):**
```json
{
  "id": "custom-mcp",
  "name": "Custom MCP",
  "description": "A custom MCP server",
  "createdAt": "2025-10-05T..."
}
```

### PUT /api/marketplace/:marketplaceId

(Admin) 마켓플레이스 서버 정보를 수정합니다.

### DELETE /api/marketplace/:marketplaceId

(Admin) 마켓플레이스 서버를 삭제합니다.

---

## Health

### GET /health

시스템 헬스 체크.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-05T...",
  "uptime": 12345,
  "version": "1.0.0"
}
```

### GET /health/ready

Kubernetes readiness probe.

**Response (200):**
```json
{
  "status": "ready",
  "timestamp": "2025-10-05T..."
}
```

### GET /health/live

Kubernetes liveness probe.

**Response (200):**
```json
{
  "status": "alive",
  "timestamp": "2025-10-05T..."
}
```

---

## MCP Protocol

### GET /api/mcp/:endpointId/tools

엔드포인트에서 사용 가능한 도구 목록을 조회합니다.

**Headers:**
```
Authorization: Bearer <api-key>
```

**Response (200):**
```json
{
  "tools": [
    {
      "name": "create_issue",
      "description": "Create a GitHub issue",
      "parameters": [
        {
          "name": "title",
          "type": "string",
          "description": "Issue title",
          "required": true
        },
        {
          "name": "body",
          "type": "string",
          "description": "Issue description",
          "required": false
        }
      ],
      "serverId": "server-uuid",
      "namespace": "github"
    }
  ]
}
```

### POST /api/mcp/:endpointId/tools/call

도구를 호출합니다.

**Headers:**
```
Authorization: Bearer <api-key>
```

**Request Body:**
```json
{
  "name": "create_issue",
  "arguments": {
    "title": "Bug report",
    "body": "Description of the bug"
  }
}
```

**Response (200):**
```json
{
  "result": {
    "issue_number": 123,
    "url": "https://github.com/owner/repo/issues/123"
  },
  "error": null
}
```

### GET /api/mcp/:endpointId/sse

SSE(Server-Sent Events) 연결을 수립합니다.

**Response:**
```
Content-Type: text/event-stream

event: connected
data: {"endpointId":"uuid","timestamp":"2025-10-05T..."}

:ping

...
```

### POST /api/mcp/:endpointId/stream

HTTP 스트리밍 연결을 수립합니다.

**Request Body:**
```json
{
  "method": "tools/list",
  "params": {
    "id": 1
  }
}
```

**Response (200):**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "message": "Streaming response",
    "endpointId": "uuid",
    "method": "tools/list"
  }
}
```

---

## Error Responses

모든 에러는 다음 형식으로 반환됩니다:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Common Error Codes

- `INVALID_INPUT`: 잘못된 입력 데이터
- `UNAUTHORIZED`: 인증 필요
- `INVALID_API_KEY`: 유효하지 않은 API 키
- `USER_EXISTS`: 이미 존재하는 사용자
- `SERVER_EXISTS`: 이미 존재하는 서버
- `SERVER_NOT_FOUND`: 서버를 찾을 수 없음
- `TEMPLATE_NOT_FOUND`: 마켓플레이스 템플릿을 찾을 수 없음
- `MISSING_ENV`: 필수 환경변수 누락
- `NOT_IMPLEMENTED`: 아직 구현되지 않은 기능

---

## Rate Limiting

API 요청은 API 키별로 속도 제한이 적용됩니다 (향후 구현).

---

## Pagination

목록 조회 API는 향후 페이지네이션을 지원할 예정입니다.

