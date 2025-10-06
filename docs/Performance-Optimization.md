# Performance Optimization Guide

## Task 23: Performance Optimization and Caching

이 문서는 MCP Hub Router의 성능 최적화 전략과 구현을 설명합니다.

---

## 🎯 최적화 목표

1. **응답 시간 개선**: API 응답 시간 < 200ms
2. **처리량 증대**: 동시 요청 1000+ 처리
3. **메모리 효율**: 메모리 사용량 최소화
4. **캐시 활용**: 반복 조회 성능 향상

---

## 🔧 구현된 최적화

### 1. In-Memory Caching

**구현**: `CacheService`
- TTL 기반 캐시
- 자동 만료 항목 정리
- Get-or-Set 패턴 지원

**사용 예시**:
```typescript
import { getCacheService } from '@/infrastructure/cache/CacheService';

const cache = getCacheService();

// 캐시 조회
const user = cache.get<User>(`user:${userId}`);

// 캐시 설정 (5분 TTL)
cache.set(`user:${userId}`, user, { ttl: 300000 });

// Get-or-Set 패턴
const servers = await cache.getOrSet(
  `servers:${userId}`,
  async () => await serverRepository.findByUserId(userId),
  { ttl: 60000 } // 1분
);
```

**캐싱 전략**:
- ✅ User 정보: 5분 TTL
- ✅ Server 목록: 1분 TTL
- ✅ Marketplace 템플릿: 10분 TTL
- ✅ API 키 검증: 3분 TTL
- ❌ Tool 실행 결과: 캐싱 안 함 (실시간 필요)

---

### 2. Database Query Optimization

**인덱스 추가**:
```sql
-- 사용자별 서버 조회 최적화
CREATE INDEX idx_servers_user_id ON servers(user_id);

-- API 키 조회 최적화
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

-- 서버 상태 필터링 최적화
CREATE INDEX idx_servers_status ON servers(status);

-- 마켓플레이스 태그 검색 최적화
CREATE INDEX idx_marketplace_tags ON marketplace_servers USING GIN(tags);
```

**쿼리 최적화**:
- 필요한 컬럼만 SELECT
- JOIN 최소화
- 페이지네이션 구현 (LIMIT/OFFSET)
- Prepared Statements 사용

---

### 3. API Response Optimization

**압축**:
```typescript
// app.ts에 추가
import compression from 'compression';

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // 압축 레벨 (0-9)
}));
```

**응답 크기 최소화**:
- 불필요한 필드 제거
- 페이지네이션
- 필드 선택 옵션 (`?fields=id,name`)

---

### 4. Connection Pooling

**데이터베이스 연결 풀**:
```typescript
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  maxConnections: 20, // 최대 연결 수
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
};
```

---

### 5. Rate Limiting (구현됨, 비활성화 가능)

**Redis 기반 Rate Limiting**:
```typescript
// Usage Tracking Service 활용
const limit = await usageTrackingService.checkLimit(userId, 'api_calls');

if (limit.limitReached) {
  return res.status(429).json({
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests',
      retryAfter: limit.resetAt
    }
  });
}
```

---

## 📊 성능 측정

### 벤치마크 도구

**Artillery**:
```bash
npm install -g artillery

# Load test
artillery quick --count 100 --num 10 http://localhost:3000/api/health
```

**Apache Bench**:
```bash
ab -n 1000 -c 100 http://localhost:3000/api/health
```

### 모니터링

**응답 시간 로깅**:
```typescript
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${duration}ms`);
    
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  
  next();
});
```

---

## 🚀 추가 최적화 (향후)

### 1. Redis Cache (Production)

현재 In-Memory 캐시를 Redis로 전환:

```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0
});

class RedisCacheService {
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    await redis.setex(key, Math.floor(ttl / 1000), JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    await redis.del(key);
  }
}
```

### 2. CDN for Static Assets

API 문서, 로고, 정적 파일을 CDN으로 서빙

### 3. Database Read Replicas

읽기 부하 분산을 위한 Read Replica 구성

### 4. API Response Caching

자주 조회되는 엔드포인트에 HTTP 캐싱 헤더 추가:

```typescript
app.get('/api/marketplace', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300'); // 5분
  // ...
});
```

### 5. GraphQL (선택)

REST API 대신 GraphQL로 필요한 데이터만 요청

---

## 🎯 최적화 체크리스트

- [x] In-memory 캐시 구현
- [x] Database 인덱스 최적화 (문서화)
- [x] Connection pooling 설정
- [ ] Redis 캐시 (프로덕션)
- [ ] API 응답 압축 (구현 필요)
- [x] Rate limiting (구현됨, 옵션)
- [ ] 응답 시간 모니터링 (로깅 개선 필요)
- [ ] Load testing (수동)

---

## 📈 성능 목표

| 지표 | 목표 | 현재 상태 |
|------|------|-----------|
| API 응답 시간 (p50) | < 100ms | 측정 필요 |
| API 응답 시간 (p95) | < 300ms | 측정 필요 |
| 처리량 | 1000 req/s | 측정 필요 |
| 메모리 사용량 | < 512MB | 측정 필요 |
| Database 연결 | < 20 | ✅ 설정됨 |
| 캐시 히트율 | > 70% | 측정 필요 |

---

**다음 단계**: 프로덕션 환경에서 실제 부하 테스트를 수행하고 병목 지점을 식별합니다.

