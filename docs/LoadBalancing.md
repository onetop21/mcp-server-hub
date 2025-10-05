# Load Balancing and Failover System

> ⚠️ **현재 상태**: 이 기능은 구현되었으나 **기본적으로 비활성화**되어 있습니다.
> 
> MCP Hub Router는 단순성을 위해 개인 서버 중심 아키텍처를 채택했습니다.
> 로드 밸런싱은 향후 팀/조직 공유 서버가 필요할 때 활성화할 수 있습니다.
> 
> 자세한 내용: `docs/Architecture-Simplified.md`

## 개요

MCP Hub Router는 고급 로드 밸런싱 및 장애 조치 시스템을 **구현했지만**, 현재는 아키텍처 단순화를 위해 비활성화되어 있습니다.

### 현재 동작 방식

```typescript
// 현재: 첫 번째 활성 서버 선택
const server = activeServers[0];

// 비활성화됨: 로드 밸런싱
// const server = await loadBalancer.selectServer(servers, strategy);
```

## 로드 밸런싱 전략

### 1. Round Robin (라운드 로빈)
요청을 서버 목록을 순회하며 균등하게 분배합니다.

```typescript
const server = await loadBalancer.selectServer(
  servers,
  LoadBalancingStrategy.ROUND_ROBIN,
  { groupId: 'my-group' }
);
```

**특징:**
- 각 서버에 균등하게 트래픽 분배
- 그룹별 독립적인 카운터 유지
- 가장 간단하고 예측 가능한 분배 방식

**적합한 경우:**
- 모든 서버의 성능이 비슷한 경우
- 간단하고 예측 가능한 분배가 필요한 경우

### 2. Weighted (가중치 기반)
서버별 가중치에 따라 트래픽을 분배합니다.

```typescript
// 서버 가중치 설정
await loadBalancer.setServerWeights('group-id', [
  { serverId: 'server-1', weight: 50 },  // 50%
  { serverId: 'server-2', weight: 30 },  // 30%
  { serverId: 'server-3', weight: 20 }   // 20%
]);

const server = await loadBalancer.selectServer(
  servers,
  LoadBalancingStrategy.WEIGHTED,
  { groupId: 'group-id' }
);
```

**특징:**
- 서버 성능에 따라 차등 분배
- 가중치는 1-100 범위
- 동적으로 가중치 조정 가능

**적합한 경우:**
- 서버 성능이 다른 경우
- 점진적 배포 시나리오 (카나리 배포)
- 비용 최적화 (저비용 서버에 더 많은 트래픽)

### 3. Least Connections (최소 연결)
현재 활성 연결 수가 가장 적은 서버를 선택합니다.

```typescript
const server = await loadBalancer.selectServer(
  servers,
  LoadBalancingStrategy.LEAST_CONNECTIONS
);
```

**특징:**
- 실시간 부하 기반 분배
- 긴 처리 시간의 요청에 적합
- 자동으로 부하 균형 유지

**적합한 경우:**
- 요청 처리 시간이 가변적인 경우
- 실시간 부하에 따른 동적 분배가 필요한 경우

### 4. Random (랜덤)
무작위로 서버를 선택합니다.

```typescript
const server = await loadBalancer.selectServer(
  servers,
  LoadBalancingStrategy.RANDOM
);
```

**특징:**
- 가장 간단한 구현
- 상태 유지 불필요
- 통계적으로 균등 분배

## 서킷 브레이커 패턴

서버 장애를 감지하고 자동으로 트래픽을 차단하여 시스템을 보호합니다.

### 서킷 브레이커 상태

#### 1. CLOSED (정상)
- 모든 요청이 정상적으로 처리됨
- 실패 카운터 모니터링

#### 2. OPEN (차단)
- 실패 임계값 초과 시 전환
- 모든 요청 즉시 차단
- 타임아웃 후 HALF_OPEN으로 전환

#### 3. HALF_OPEN (반개방)
- 제한된 수의 요청만 허용
- 성공 시 CLOSED로 복구
- 실패 시 다시 OPEN으로 전환

### 설정 파라미터

```typescript
const config: CircuitBreakerConfig = {
  failureThreshold: 5,        // OPEN 전환 실패 횟수
  successThreshold: 2,        // CLOSED 전환 성공 횟수
  timeout: 60000,            // OPEN 상태 유지 시간 (ms)
  halfOpenMaxAttempts: 3     // HALF_OPEN에서 최대 시도 횟수
};
```

### 사용 예시

```typescript
// 요청 성공 기록
await loadBalancer.recordSuccess(serverId);

// 요청 실패 기록
await loadBalancer.recordFailure(serverId);

// 서킷 브레이커 상태 확인
const status = await loadBalancer.getCircuitBreakerStatus(serverId);
console.log(`State: ${status.state}, Failures: ${status.failureCount}`);

// 수동 리셋
await loadBalancer.resetCircuitBreaker(serverId);
```

## 자동 장애 조치 (Failover)

### 폴백 메커니즘

1. **1차 서버 선택**: 라우팅 규칙/로드 밸런싱에 따라 서버 선택
2. **헬스 체크**: 선택된 서버의 상태 확인
3. **서킷 브레이커 확인**: 서킷이 OPEN이 아닌지 확인
4. **폴백**: 실패 시 대체 서버로 자동 전환
5. **에러 반환**: 모든 서버 실패 시 명확한 에러 메시지

### RouterService 통합

RouterService는 자동으로 LoadBalancerService를 사용합니다:

```typescript
// RouterService 내부 동작
const result = await this.executeToolCallWithTracking(server, toolName, params);

// executeToolCallWithTracking 내부:
// 1. 연결 카운트 증가
await loadBalancer.incrementConnections(serverId);

// 2. 요청 실행
const result = await executeToolCall(...);

// 3. 성공/실패 기록
if (result.success) {
  await loadBalancer.recordSuccess(serverId);
} else {
  await loadBalancer.recordFailure(serverId);
}

// 4. 연결 카운트 감소 (항상 실행)
await loadBalancer.decrementConnections(serverId);
```

## 연결 추적

활성 연결 수를 추적하여 Least Connections 전략에 활용합니다.

```typescript
// 연결 시작
await loadBalancer.incrementConnections(serverId);

try {
  // 요청 처리
  const result = await processRequest();
} finally {
  // 연결 종료 (항상 실행)
  await loadBalancer.decrementConnections(serverId);
}

// 현재 연결 수 조회
const count = await loadBalancer.getConnectionCount(serverId);
```

## 헬스 모니터링

### 개별 서버 상태 조회

```typescript
const health = await routerService.getServerHealth(serverId);
console.log({
  status: health.status,        // ACTIVE, INACTIVE, ERROR
  lastCheck: health.lastCheck,
  responseTime: health.responseTime,
  error: health.error
});
```

### 그룹 전체 헬스 상태

```typescript
const groupHealth = await routerService.getGroupHealth(groupId);
for (const health of groupHealth) {
  console.log(`${health.serverId}: ${health.status}`);
}
```

### 서킷 브레이커 상태 모니터링

```typescript
// 전체 서버 서킷 브레이커 상태
const allStatus = await loadBalancer.getAllCircuitBreakerStatus();

for (const status of allStatus) {
  console.log({
    serverId: status.serverId,
    state: status.state,
    failureCount: status.failureCount,
    lastFailureTime: status.lastFailureTime
  });
}
```

## 모범 사례

### 1. 적절한 로드 밸런싱 전략 선택

- **동일 성능 서버**: Round Robin
- **성능 차이 있는 서버**: Weighted
- **가변 처리 시간**: Least Connections
- **상태 비저장 간단한 경우**: Random

### 2. 서킷 브레이커 설정

```typescript
// 민감한 서비스 (빠른 차단)
{
  failureThreshold: 3,
  timeout: 30000  // 30초
}

// 관대한 서비스 (느린 차단)
{
  failureThreshold: 10,
  timeout: 120000  // 2분
}
```

### 3. 가중치 설정

```typescript
// 점진적 배포 (카나리)
await loadBalancer.setServerWeights('prod-group', [
  { serverId: 'stable-v1', weight: 90 },
  { serverId: 'canary-v2', weight: 10 }
]);

// 성능 기반
await loadBalancer.setServerWeights('compute-group', [
  { serverId: 'high-perf', weight: 60 },
  { serverId: 'medium-perf', weight: 30 },
  { serverId: 'low-perf', weight: 10 }
]);
```

### 4. 모니터링 및 알림

```typescript
// 정기적인 헬스 체크
setInterval(async () => {
  const statuses = await loadBalancer.getAllCircuitBreakerStatus();
  
  for (const status of statuses) {
    if (status.state === CircuitBreakerState.OPEN) {
      // 알림 발송
      await alerting.sendAlert(`Server ${status.serverId} is down`);
    }
  }
}, 60000); // 1분마다
```

## 성능 고려사항

### 인메모리 상태 관리

현재 구현은 인메모리 상태를 사용합니다:

```typescript
private roundRobinCounters: Map<string, number> = new Map();
private circuitBreakers: Map<string, CircuitBreakerStatus> = new Map();
private connectionCounts: Map<string, number> = new Map();
```

**프로덕션 환경에서는 Redis로 전환 권장:**

- 수평 확장 지원
- 상태 지속성
- 분산 환경 지원

### 최적화 팁

1. **캐싱**: 서버 목록을 캐싱하여 DB 조회 최소화
2. **비동기 로깅**: 성공/실패 기록을 비동기로 처리
3. **배치 업데이트**: 여러 메트릭을 한 번에 업데이트

## 트러블슈팅

### 문제: 특정 서버로 트래픽이 가지 않음

```typescript
// 서킷 브레이커 상태 확인
const status = await loadBalancer.getCircuitBreakerStatus(serverId);
if (status.state === CircuitBreakerState.OPEN) {
  // 수동 리셋
  await loadBalancer.resetCircuitBreaker(serverId);
}
```

### 문제: 부하 분산이 고르지 않음

```typescript
// 전략 확인 및 변경
const currentStrategy = LoadBalancingStrategy.WEIGHTED;
// -> LoadBalancingStrategy.ROUND_ROBIN으로 변경

// 가중치 재설정
await loadBalancer.setServerWeights(groupId, [
  { serverId: 'server-1', weight: 33 },
  { serverId: 'server-2', weight: 33 },
  { serverId: 'server-3', weight: 34 }
]);
```

### 문제: 잦은 서킷 브레이커 오픈

```typescript
// 임계값 조정 필요 (코드 수정)
const config: CircuitBreakerConfig = {
  failureThreshold: 10,  // 5 -> 10으로 증가
  timeout: 30000         // 60초 -> 30초로 감소
};
```

## 향후 활성화 방법

### 코드에서 활성화

```typescript
// src/infrastructure/di/container.ts

// LoadBalancerService 인스턴스 생성
const loadBalancerService = new LoadBalancerService();
this.bind(TYPES.LoadBalancerService, loadBalancerService);

// RouterService에 주입
const routerService = new RouterService(
  serverRepository,
  endpointRepository,
  serverGroupRepository,
  protocolAdapterService,
  loadBalancerService  // 활성화!
);
```

### 선택적 활성화 (권장)

```typescript
// 서버 타입에 따라 선택적으로 활성화
interface RegisteredServer {
  // ...
  sharingMode?: 'personal' | 'team' | 'organization';
}

// RouterService에서 조건부 사용
if (server.sharingMode === 'team' || server.sharingMode === 'organization') {
  // 공유 서버는 로드밸런싱 사용
  const selected = await this.loadBalancerService?.selectServer(servers, strategy);
} else {
  // 개인 서버는 단순 선택
  return servers[0];
}
```

## 참고 자료

- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Load Balancing Algorithms](https://www.nginx.com/blog/choosing-nginx-plus-load-balancing-techniques/)
- [Health Checks Best Practices](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Architecture Simplification](./Architecture-Simplified.md)

