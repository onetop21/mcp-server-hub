# MCP Protocol Implementation

## 개요

MCP Hub Router는 Model Context Protocol을 지원하여 AI 에이전트가 다양한 도구를 사용할 수 있도록 합니다.

## 구현 상태

### ✅ 완료된 기능

1. **Tool Listing API**
   - `GET /api/mcp/:endpointId/tools`
   - 엔드포인트에서 사용 가능한 모든 도구 조회
   - 도구 이름, 설명, 파라미터 정보 제공

2. **Tool Calling API**
   - `POST /api/mcp/:endpointId/tools/call`
   - 도구 호출 및 결과 반환
   - 에러 핸들링

3. **SSE Streaming**
   - `GET /api/mcp/:endpointId/sse`
   - 실시간 이벤트 스트리밍
   - Keep-alive ping 지원

4. **HTTP Streaming**
   - `POST /api/mcp/:endpointId/stream`
   - JSON-RPC 2.0 스트리밍

### ⚠️ 제한사항

현재 구현은 **기본 기능**만 제공합니다:

- SSE/HTTP 스트리밍은 연결만 수립 (실제 MCP 메시지 처리는 미구현)
- Protocol adapter에서 실제 서버와의 통신은 별도 구현 필요
- 멀티플렉싱은 미지원

## API 사용 예제

### 1. 도구 목록 조회

```bash
curl -X GET http://localhost:3000/api/mcp/endpoint-123/tools \
  -H "Authorization: Bearer your-api-key"
```

**Response:**
```json
{
  "tools": [
    {
      "name": "github_create_issue",
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
          "description": "Issue body",
          "required": false
        }
      ],
      "serverId": "server-uuid",
      "namespace": "github"
    }
  ]
}
```

### 2. 도구 호출

```bash
curl -X POST http://localhost:3000/api/mcp/endpoint-123/tools/call \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "github_create_issue",
    "arguments": {
      "title": "New feature request",
      "body": "Please add dark mode"
    }
  }'
```

**Success Response:**
```json
{
  "result": {
    "issue_number": 42,
    "url": "https://github.com/owner/repo/issues/42",
    "created_at": "2025-10-05T..."
  },
  "error": null
}
```

**Error Response:**
```json
{
  "result": null,
  "error": "GitHub API error: Invalid credentials"
}
```

### 3. SSE 스트리밍

```bash
curl -N http://localhost:3000/api/mcp/endpoint-123/sse
```

**Response Stream:**
```
event: connected
data: {"endpointId":"endpoint-123","timestamp":"2025-10-05T..."}

:ping

:ping

...
```

### 4. HTTP 스트리밍

```bash
curl -X POST http://localhost:3000/api/mcp/endpoint-123/stream \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/list",
    "params": {"id": 1}
  }'
```

## 아키텍처

```
┌─────────────┐
│   Client    │
│  (AI Agent) │
└──────┬──────┘
       │ HTTP/SSE
       ▼
┌─────────────────┐
│  MCP Controller │
│  - getTools()   │
│  - callTool()   │
│  - handleSSE()  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Router Service  │
│ - Route to      │
│   correct       │
│   server        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Protocol        │
│ Adapter         │
│ (STDIO/SSE/HTTP)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MCP Server     │
│  (External)     │
└─────────────────┘
```

## 보안

### 인증

- 모든 엔드포인트는 Bearer 토큰 인증 필요
- 엔드포인트 소유권 검증
- 사용자별 도구 격리

### 권한

- 사용자는 자신의 엔드포인트만 접근 가능
- 그룹 멤버십 검증
- API 키 권한 체크

## 에러 코드

| Code | Description |
|------|-------------|
| `ENDPOINT_NOT_FOUND` | 엔드포인트를 찾을 수 없음 |
| `FORBIDDEN` | 접근 권한 없음 |
| `INVALID_INPUT` | 잘못된 입력 (예: 도구 이름 누락) |
| `FETCH_FAILED` | 도구 목록 조회 실패 |
| `CALL_FAILED` | 도구 호출 실패 |
| `SSE_FAILED` | SSE 연결 실패 |
| `STREAM_FAILED` | 스트리밍 실패 |

## 향후 개선 사항

### 단기 (v1.1)
- [ ] 실제 MCP 프로토콜 메시지 파싱
- [ ] Protocol adapter와의 완전한 통합
- [ ] 도구 호출 타임아웃 처리
- [ ] 더 상세한 에러 정보

### 중기 (v1.2)
- [ ] SSE/HTTP 스트리밍 멀티플렉싱
- [ ] 도구 호출 이력 저장
- [ ] 실시간 진행상황 업데이트
- [ ] WebSocket 지원

### 장기 (v2.0)
- [ ] 도구 체이닝 (한 도구의 출력을 다른 도구의 입력으로)
- [ ] 도구 호출 승인 플로우
- [ ] 도구별 사용량 제한
- [ ] A/B 테스팅 지원

## 테스트

### Unit Tests

```bash
npm test -- MCPController.test.ts
```

### Integration Tests

```bash
# 엔드포인트 생성
curl -X POST http://localhost:3000/api/endpoints/default \
  -H "Authorization: Bearer your-api-key"

# 도구 조회
curl http://localhost:3000/api/mcp/endpoint-123/tools \
  -H "Authorization: Bearer your-api-key"

# 도구 호출
curl -X POST http://localhost:3000/api/mcp/endpoint-123/tools/call \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-tool", "arguments": {}}'
```

## 참고 자료

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Protocol Adapters](./Protocol-Adapters.md)
- [API Reference](./API-Reference.md)

