# MCP Hub Router - 단순화된 아키텍처

## 📌 핵심 설계 원칙

### 1. 개인 서버 중심 아키텍처

MCP Hub Router는 **개인이 자신의 MCP 서버를 실행하고 관리**하는 것을 기본으로 합니다.

```
사용자 A:
  ├─ Atlassian MCP (A's API key)
  ├─ GitHub MCP (A's token)
  └─ Custom Tool MCP

사용자 B:
  ├─ Slack MCP (B's workspace)
  ├─ Google Drive MCP (B's OAuth)
  └─ Weather MCP
```

**핵심:**
- ✅ 각 사용자가 자신의 인증 정보로 MCP 서버 실행
- ✅ MCP 서버는 Stateless하게 동작
- ✅ 개인이 띄운 서버를 여러 프로젝트에서 재사용 가능

## 🎯 단순화 결정사항

### 로드밸런싱 제거 (현재)

```typescript
// ❌ 복잡한 로드밸런싱 (제거됨)
- Round-robin across multiple servers
- Weighted load balancing
- Circuit breaker pattern
- Connection tracking

// ✅ 단순한 서버 선택 (현재)
- 첫 번째 활성 서버 선택
- Stateless MCP 서버 가정
- 성능보다 단순성 우선
```

**이유:**
1. 대부분의 MCP 서버는 개인 인증 정보 필요 → 공유 불가
2. 개인용 서버 1개면 충분 → 복제본 불필요
3. Stateless 설계 → 성능 저하 있어도 정상 동작
4. 향후 필요시 확장 가능하도록 코드는 보존

### 향후 확장 시나리오 (선택적)

조직/팀 레벨에서 공유 서버가 필요한 경우에만:

```typescript
// 향후 필요시 LoadBalancer 활성화 가능
const loadBalancerService = new LoadBalancerService();
const routerService = new RouterService(
  serverRepository,
  endpointRepository,
  serverGroupRepository,
  protocolAdapterService,
  loadBalancerService  // Optional parameter
);
```

## 🏗️ 현재 아키텍처

### 단순화된 컴포넌트 구조

```
┌─────────────────────────────────────────┐
│         MCP Hub Router                   │
├─────────────────────────────────────────┤
│                                          │
│  User Management                         │
│  ├─ API Key 발급/검증                    │
│  ├─ 사용량 제한                          │
│  └─ 권한 관리                            │
│                                          │
│  Server Registry                         │
│  ├─ 개인별 MCP 서버 등록                 │
│  ├─ 프로토콜 어댑터 (STDIO/SSE/HTTP)     │
│  └─ 서버 그룹 관리                       │
│                                          │
│  Router Service (Simplified)             │
│  ├─ 네임스페이스 기반 라우팅             │
│  ├─ 첫 번째 활성 서버 선택               │
│  └─ 라우팅 규칙 적용                     │
│                                          │
│  Endpoint Management                     │
│  ├─ 사용자별 엔드포인트 발급             │
│  └─ 여러 프로젝트에서 재사용             │
│                                          │
└─────────────────────────────────────────┘
```

### 제거/비활성화된 컴포넌트

```
🔘 LoadBalancerService (코드는 보존, 기본 비활성)
   ├─ Round-robin load balancing
   ├─ Weighted distribution
   ├─ Circuit breaker
   └─ Connection tracking

→ 향후 필요시 활성화 가능
```

## 💡 사용자 시나리오

### 시나리오 1: 개인 개발자

```typescript
// Alice가 자신의 MCP 서버들을 등록
alice.registerServer({
  name: 'my-github',
  protocol: 'stdio',
  config: { 
    command: 'mcp-github',
    env: { GITHUB_TOKEN: 'alice_token_123' }
  }
});

alice.registerServer({
  name: 'my-notion',
  protocol: 'http',
  config: { 
    baseUrl: 'http://localhost:3001',
    headers: { Authorization: 'alice_notion_key' }
  }
});

// Alice의 여러 프로젝트에서 동일한 엔드포인트 사용
// Project A (Claude Desktop) → alice-endpoint
// Project B (VS Code Extension) → alice-endpoint
// Project C (Web App) → alice-endpoint
```

**장점:**
- ✅ 서버 1번 실행 → 여러 프로젝트에서 재사용
- ✅ 각자의 인증 정보로 격리된 환경
- ✅ 설정 간단, 관리 쉬움

### 시나리오 2: 팀 협업

```typescript
// 팀 내에서도 개인별로 서버 실행
teamMember1.registerServer('github', { token: 'user1_token' });
teamMember2.registerServer('github', { token: 'user2_token' });
teamMember3.registerServer('github', { token: 'user3_token' });

// 각자의 권한으로 작업
// → 보안 유지, 감사 추적 가능
```

## 🚀 성능 특성

### Stateless 설계의 장단점

**장점:**
- ✅ 단순한 구조
- ✅ 예측 가능한 동작
- ✅ 디버깅 용이
- ✅ 확장 경로 명확

**트레이드오프:**
- ⚠️ 매 요청마다 MCP 서버 호출 (캐싱 없음)
- ⚠️ 동시 요청 시 순차 처리
- ⚠️ 단일 서버 장애 시 영향

**현실적 평가:**
```
개인 사용자 기준:
- 일반적인 사용 패턴: 초당 1-5 요청
- MCP 서버 응답 시간: 100-500ms
- 실제 체감 성능 저하: 거의 없음 ✅
```

## 🔮 향후 확장 가능성

### Phase 1 (현재): 단순 개인 사용

```
개인 서버 → 단일 인스턴스 → 첫 번째 서버 선택
```

### Phase 2 (필요시): 팀 공유 서버

```typescript
// 팀 공용 서버에만 로드밸런싱 적용
if (server.sharingMode === 'team') {
  await loadBalancer.selectServer(servers, strategy);
} else {
  return servers[0]; // 개인 서버는 단순 선택
}
```

### Phase 3 (대규모): 엔터프라이즈

```typescript
// 완전한 로드밸런싱 + 캐싱 + 모니터링
- Redis 기반 분산 상태 관리
- 서킷 브레이커 활성화
- 실시간 헬스 모니터링
- Auto-scaling 지원
```

## 📊 비교: 복잡 vs 단순

### 복잡한 설계 (이전)

```
장점:
- 고가용성
- 로드 분산
- 자동 장애 조치

단점:
- 복잡한 코드베이스
- 높은 운영 오버헤드
- 대부분 사용자에게 불필요
- Redis 의존성
```

### 단순한 설계 (현재) ✅

```
장점:
- 이해하기 쉬움
- 유지보수 간단
- 빠른 개발 속도
- 실제 사용 패턴에 적합

단점:
- 기본적인 로드밸런싱 없음
- 장애 조치 제한적

→ 하지만 대부분 사용자에게는 문제 없음
```

## 🎯 결론

MCP Hub Router는 **현실적인 사용 패턴에 최적화**된 단순한 아키텍처를 채택합니다:

1. **개인 서버 중심**: 각자의 인증 정보로 서버 실행
2. **Stateless 설계**: 단순하고 예측 가능
3. **여러 프로젝트 재사용**: 한 번 설정, 어디서나 사용
4. **향후 확장 가능**: 필요시 로드밸런싱 활성화

이 접근 방식은:
- ✅ 90% 사용 사례에 충분
- ✅ 유지보수 비용 최소화
- ✅ 필요시 쉽게 확장 가능
- ✅ 실용적이고 현실적

