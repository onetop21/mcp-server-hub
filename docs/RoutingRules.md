# Routing Rules Engine

## 개요

MCP Hub Router의 라우팅 규칙 시스템은 **단순하지만 강력한** 도구 라우팅을 제공합니다.

### 설계 철학

```
✅ 단순성 우선
  - 대부분의 사용자는 간단한 규칙만 필요
  - 복잡한 조건 파서는 불필요
  
✅ 예측 가능
  - 우선순위 기반 평가
  - 첫 번째 매칭 규칙 적용
  
✅ 확장 가능
  - 기본 기능으로 충분
  - 필요시 조건 추가 가능
```

## 기본 동작

### 라우팅 순서

```
1. 네임스페이스 파싱
   toolName: "github.create_issue"
   → namespace: "github"
   → baseName: "create_issue"

2. 네임스페이스 필터링
   "github" 네임스페이스 서버만 선택

3. 라우팅 규칙 적용
   그룹에 규칙이 있으면 우선순위 순으로 평가

4. 폴백
   규칙 매칭 실패 시 첫 번째 활성 서버 선택
```

## 라우팅 규칙 구조

### RoutingRule 모델

```typescript
interface RoutingRule {
  id: string;              // 고유 ID
  condition: RoutingCondition;  // 매칭 조건
  targetServerId: string;  // 대상 서버
  priority: number;        // 우선순위 (높을수록 먼저)
  enabled: boolean;        // 활성화 여부
}

interface RoutingCondition {
  toolName?: string;           // 도구 이름 매칭
  parameterMatch?: Record<string, any>;  // 파라미터 매칭 (미구현)
  serverTags?: string[];       // 서버 태그 매칭 (미구현)
}
```

## 사용 예시

### 예시 1: 기본 도구 라우팅

```typescript
// "create_issue" 도구는 항상 primary GitHub 서버로
const rule1: RoutingRule = {
  id: "rule-github-primary",
  condition: { toolName: "create_issue" },
  targetServerId: "github-server-1",
  priority: 100,
  enabled: true
};

// "search_repos" 도구는 secondary 서버로
const rule2: RoutingRule = {
  id: "rule-github-secondary",
  condition: { toolName: "search_repos" },
  targetServerId: "github-server-2",
  priority: 90,
  enabled: true
};
```

### 예시 2: Failover 라우팅

```typescript
// Primary 서버로 라우팅 (높은 우선순위)
const primaryRule: RoutingRule = {
  id: "primary",
  condition: { toolName: "expensive_operation" },
  targetServerId: "high-performance-server",
  priority: 100,
  enabled: true
};

// Backup 서버로 폴백 (낮은 우선순위)
const backupRule: RoutingRule = {
  id: "backup",
  condition: { toolName: "expensive_operation" },
  targetServerId: "backup-server",
  priority: 50,
  enabled: true
};

// Primary가 inactive면 자동으로 backup 선택됨
```

### 예시 3: A/B 테스트 (간단 버전)

```typescript
// 새 버전 테스트 (특정 도구만)
const canaryRule: RoutingRule = {
  id: "canary-test",
  condition: { toolName: "new_feature_tool" },
  targetServerId: "canary-server-v2",
  priority: 100,
  enabled: true  // 문제 발생 시 false로 변경
};

// 안정 버전 (나머지 모든 도구)
// 규칙 없으면 자동으로 첫 번째 서버 선택됨
```

## API 사용법

### 라우팅 규칙 설정

```typescript
// REST API
PUT /api/groups/:groupId/routing-rules
Authorization: Bearer key_xxx
Content-Type: application/json

{
  "rules": [
    {
      "id": "rule1",
      "condition": { "toolName": "create_issue" },
      "targetServerId": "server_123",
      "priority": 100,
      "enabled": true
    },
    {
      "id": "rule2",
      "condition": { "toolName": "search_code" },
      "targetServerId": "server_456",
      "priority": 90,
      "enabled": true
    }
  ]
}
```

### 라우팅 규칙 조회

```typescript
GET /api/groups/:groupId/routing-rules
Authorization: Bearer key_xxx

Response:
{
  "rules": [
    {
      "id": "rule1",
      "condition": { "toolName": "create_issue" },
      "targetServerId": "server_123",
      "serverName": "GitHub Primary",
      "priority": 100,
      "enabled": true
    }
  ]
}
```

## 규칙 평가 로직

### 평가 순서

```
1. 규칙 필터링
   enabled: true인 것만

2. 우선순위 정렬
   priority 높은 순

3. 순차 평가
   for each rule:
     if condition matches:
       if target server is ACTIVE:
         return target server
       else:
         continue to next rule

4. 매칭 실패
   return null → 기본 선택 로직으로
```

### 주의사항

```
✅ 활성 서버만 선택
  - 대상 서버가 INACTIVE면 다음 규칙 평가
  
✅ 첫 번째 매칭 우선
  - 우선순위 순으로 평가
  - 첫 번째로 매칭되고 활성인 서버 선택
  
✅ 폴백 동작
  - 모든 규칙 실패 시 기본 선택 로직
  - 첫 번째 활성 서버 선택
```

## 제한사항 및 향후 확장

### 현재 제한사항

```
❌ 파라미터 매칭 미지원
  - condition.parameterMatch는 정의되어 있으나 미구현
  - 도구 이름으로만 라우팅 가능
  
❌ 서버 태그 미지원
  - condition.serverTags는 정의되어 있으나 미구현
  
❌ 시간 기반 라우팅 미지원
  - 특정 시간대에 다른 서버로 라우팅 불가
  
❌ 클라이언트 기반 라우팅 미지원
  - 특정 사용자/프로젝트별 라우팅 불가
```

### 향후 확장 가능성

```typescript
// 파라미터 기반 라우팅
{
  condition: {
    toolName: "create_issue",
    parameterMatch: {
      "repo": "urgent-project"  // 특정 레포만 primary로
    }
  },
  targetServerId: "high-priority-server"
}

// 태그 기반 라우팅
{
  condition: {
    serverTags: ["production", "high-performance"]
  },
  targetServerId: "prod-server"
}

// 시간 기반 라우팅
{
  condition: {
    toolName: "batch_process",
    timeWindow: {
      start: "22:00",
      end: "06:00"
    }
  },
  targetServerId: "night-batch-server"
}
```

## 모범 사례

### 1. 우선순위 체계 정립

```typescript
// 100-199: Critical (최우선)
// 50-99:   Normal (일반)
// 1-49:    Fallback (폴백)

const rules = [
  { priority: 100, ... },  // 긴급 요청
  { priority: 50, ... },   // 일반 요청
  { priority: 10, ... }    // 폴백
];
```

### 2. 명확한 규칙 ID

```typescript
// ✅ Good
{ id: "github-create-issue-primary" }

// ❌ Bad
{ id: "rule1" }
```

### 3. 규칙 문서화

```typescript
// 각 그룹에 routing rules 설명 추가
{
  groupId: "dev-tools",
  name: "Development Tools",
  description: "GitHub primary, Slack backup",
  routingRules: [
    {
      id: "github-primary",
      // Rule routes create_issue to primary for reliability
      condition: { toolName: "create_issue" },
      targetServerId: "github-1"
    }
  ]
}
```

### 4. 규칙 테스트

```bash
# 특정 도구 라우팅 테스트
curl -X POST /api/groups/test-routing \
  -H "Authorization: Bearer key_xxx" \
  -d '{"toolName": "create_issue"}'

Response:
{
  "matchedRule": "github-primary",
  "targetServer": "github-server-1",
  "rulesPriority": [100, 50, 10]
}
```

## 디버깅

### 로깅

RouterService는 규칙 평가 과정을 로깅하지 않습니다 (단순성 유지).
디버깅이 필요하면:

```typescript
// 디버그 모드 활성화 (환경변수)
DEBUG=router:rules npm start

// 또는 코드에 임시 로깅 추가
console.log('Evaluating rules:', sortedRules);
console.log('Matched rule:', matchedRule);
```

### 규칙 검증

```typescript
// 규칙 설정 전 검증
function validateRule(rule: RoutingRule, servers: RegisteredServer[]): string[] {
  const errors = [];
  
  if (rule.priority < 1 || rule.priority > 1000) {
    errors.push('Priority must be between 1 and 1000');
  }
  
  const targetExists = servers.some(s => s.id === rule.targetServerId);
  if (!targetExists) {
    errors.push('Target server does not exist');
  }
  
  return errors;
}
```

## 요약

MCP Hub Router의 라우팅 규칙은:

✅ **단순**: 도구 이름 기반 매칭만  
✅ **강력**: 우선순위와 폴백으로 대부분의 사용 사례 커버  
✅ **예측 가능**: 명확한 평가 순서  
✅ **확장 가능**: 필요시 조건 추가 가능  

대부분의 사용자에게는 현재 기능으로 충분하며, 복잡한 조건은 실제 필요성이 확인된 후 추가합니다.

