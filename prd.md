## MCP Hub Router PRD (Product Requirements Document)

### 1. 개요
- 제품명: MCP Hub Router
- 한줄 요약: 다중 테넌트 MCP 서버들을 다양한 프로토콜(STDIO, SSE, HTTP)로 연결하고, 네임스페이스/규칙 기반 라우팅과 API 키·사용량 관리를 제공하는 허브.
- 배경: AI/에이전트 환경에서 다양한 MCP(Server)들을 통합적으로 운영하려면, 통일된 엔드포인트, 보안/요율 제한, 동적 라우팅, 서버 상태 관리가 필요함.

### 2. 목표와 비목표
- 목표(Do)
  - 멀티 테넌트(사용자/조직 단위) 서버 등록·관리.
  - STDIO/SSE/HTTP 프로토콜 어댑터를 통한 통신 추상화.
  - 네임스페이스 및 라우팅 규칙 기반의 도구(tool) 호출 라우팅.
  - 엔드포인트 발급(기본/그룹)과 API 키 검증, 레이트 리밋, 사용량 추적.
  - 서버 그룹과 라우팅 규칙 CRUD, 그룹 헬스 모니터링.
  - 확장 가능한 DI 컨테이너 기반 구조.
- 비목표(Don’t)
  - 개별 MCP 서버의 비즈니스 로직 구현.
  - 복잡한 멀티 리전 HA 배포 자동화.
  - 과도한 UI(본 PRD 범위는 서버/REST/API 중심).

### 3. 대상 사용자와 유즈케이스
- 대상 사용자
  - 플랫폼 운영자: 여러 MCP 서버를 통합 운영하고 API 키/사용량을 관리.
  - 애플리케이션 개발자: 단일 허브 엔드포인트로 다양한 MCP 도구 호출.
  - 조직 관리자: 팀 단위 그룹화/네임스페이스/정책 관리.
- 핵심 유즈케이스
  - U1. 사용자는 API 키를 발급받고 기본 엔드포인트를 생성한다.
  - U2. 서버를 등록(STDIO/SSE/HTTP)하고 네임스페이스를 부여한다.
  - U3. 서버 그룹을 만들고 라우팅 규칙을 설정한다.
  - U4. 클라이언트는 엔드포인트 + API 키로 도구 목록을 조회하고 호출한다.
  - U5. 허브는 규칙/헬스/네임스페이스를 고려해 적절한 서버로 라우팅한다.
  - U6. 운영자는 사용량·레이트 리밋·서버 헬스를 조회/관리한다.

### 4. 범위 및 기능 요구사항
- 4.1 테넌시/사용자 관리
  - 사용자/조직 단위 데이터 구분.
  - API 키 발급/폐기/검증, 만료일·권한 관리.
  - 수락 기준: API 키로 인증된 요청만 엔드포인트 접근 가능. 만료/폐기 키는 거부.
- 4.2 서버 레지스트리(등록/수정/삭제/조회)
  - 지원 프로토콜: STDIO, SSE, HTTP.
  - 서버 속성: `name`, `protocol`, `config`, `namespace`, `status`, `lastHealthCheck`, `createdAt/updatedAt`.
  - 수락 기준: 필수 필드 유효성 검증, 프로토콜별 config 스키마 검증, 중복/권한 검사.
- 4.3 서버 그룹/라우팅 규칙
  - 그룹: `name`, `description`, `serverIds`, `routingRules`.
  - 규칙: `priority`, `enabled`, `condition(toolName/param/serverTags)`, `targetServerId`.
  - 수락 기준: 규칙 우선순위 적용, 조건 일치 시 해당 서버로 라우팅, 비가용 시 폴백.
- 4.4 엔드포인트 관리
  - 기본 엔드포인트(전체 서버)와 그룹 엔드포인트 생성.
  - 엔드포인트 URL 3종 생성: base, SSE, HTTP. 고유성 보장.
  - 수락 기준: API 키 소유권 검증, 중복 URL 금지, 재발급 시 이전 URL 무효화.
- 4.5 프로토콜 어댑터
  - 추상화 인터페이스: 요청/스트림/헬스체크/어댑터 수명주기.
  - STDIO/SSE/HTTP 어댑터 메타/라이프사이클 관리(생성/종료/상태).
  - 수락 기준: `tools/list`, `tools/call` 요청 성공/오류 전파, 타임아웃/에러 핸들링.
- 4.6 라우터
  - 네임스페이스 파싱, 규칙 기반 선택, 헬스 기반 폴백, 라운드로빈.
  - 도구 목록 통합 시 네임스페이스 부여 및 중복 억제.
  - 수락 기준: 지정 네임스페이스가 없거나 불일치 시 합리적 선택/오류 응답.
- 4.7 사용량/레이트 리밋
  - Redis 기반 시간창(hour/day) 레이트 리밋.
  - 엔드포인트/툴 단위 카운팅, 최근 요청 시각, 일자별 카운트.
  - 수락 기준: 제한 초과 시 429, 관리자는 리셋/조회 가능.
- 4.8 보안/권한
  - API 키 인증, 키-엔드포인트 매칭 검증, 키 만료/취소 처리.
  - 사용자 소유 리소스만 CRUD 가능.
  - 수락 기준: 권한 위반 시 403/404/401 일관 응답.

### 5. 시스템 아키텍처 요약
- DI 컨테이너: `src/infrastructure/di/container.ts`에서 DB/Redis/리포지토리/서비스 초기화 및 종료.
- 도메인 서비스: UserManagement, ServerRegistry, ProtocolAdapter, Router, Endpoint, UsageTracking, Permission.
- 리포지토리: User/Server/ServerGroup/ApiKey/Endpoint.
- 어댑터: STDIO 프로세스 매니저, SSE/HTTP 어댑터 팩토리(라이프사이클/헬스관리).
- API 계층(초안): 서버 관리 컨트롤러 및 라우트 스켈레톤.

### 6. API 요구사항(요약)
- 인증: 헤더의 API 키(Bearer/Custom) 검증.
- 서버 관리
  - POST `/api/servers` 등록
  - PUT `/api/servers/:id` 수정
  - DELETE `/api/servers/:id` 삭제
  - GET `/api/servers` 목록, GET `/api/servers/:id` 상세
- 엔드포인트 관리
  - POST `/api/endpoints/default` 기본 엔드포인트 생성
  - POST `/api/endpoints/group/:groupId` 그룹 엔드포인트 생성
  - GET `/api/endpoints/:id` 조회, DELETE 삭제, POST 재발급
- 라우팅/도구
  - GET `/api/endpoints/:id/tools` 도구 목록
  - POST `/api/endpoints/:id/tools/:toolName/call` 호출
- 사용량/리밋
  - GET `/api/usage/:apiKey` 상세 통계
  - POST `/api/usage/:apiKey/reset` 리밋 초기화(관리자)

### 7. 데이터 모델(요약)
- Server: `id,userId,name,protocol,config,namespace,status,lastHealthCheck,createdAt,updatedAt`.
- Endpoint: `id,userId,groupId?,url,sseUrl,httpUrl,apiKeyId,createdAt,lastAccessedAt?`.
- ServerGroup: `id,userId,name,description,serverIds[],routingRules[],createdAt,updatedAt`.
- ApiKey: `id,userId,hash,expiresAt,scopes,limits,createdAt,revoked`.
- User: `id,email/passwordHash or externalId,roles,createdAt`.

### 8. 비기능 요구사항
- 성능
  - p50 라우팅 지연 50ms 이하(내부 캐시/어댑터 연결 유지 시).
  - 초당 100 RPS 기준 스케일링 가이드(수평 확장 가정).
- 가용성/복원력
  - 어댑터 헬스체크 및 폴백, 실패 격리.
  - Redis 비가용 시 인메모리 리밋으로 강등(기능 저하 허용).
- 보안
  - API 키 저장 시 해시, 최소 권한 스코프, 감사 로그(추가 과업).
  - URL 고유성, 엔드포인트 재발급 시 이전 URL 무효화.
- 관측성
  - 요청 로깅, 에러/지표 수집(Histogram 카운터), 헬스 엔드포인트(추가 과업).

### 9. 수락 기준(샘플)
- 엔드포인트 생성
  - 올바른 API 키/소유자일 때만 생성 성공, URL 3종 고유.
- 도구 목록 통합
  - 활성 서버들의 `tools/list` 결과를 네임스페이스 부여 후 중복 없이 반환.
- 도구 호출 라우팅
  - 네임스페이스 일치 서버 우선, 규칙 일치 시 해당 서버, 비가용 시 폴백, 실패 시 명확한 오류 응답.
- 레이트 리밋
  - 설정 초과 시 429, 헤더/바디에 남은 쿼터 표준화(추가 과업).

### 10. 마일스톤
- M1. 데이터베이스 스키마/리포지토리 정합성 검증 및 마이그레이션 러너 완성
- M2. 프로토콜 어댑터(특히 STDIO/SSE) 기본 통신 및 헬스체크 구현
- M3. 라우터 규칙/네임스페이스/폴백 완성 및 통합 테스트
- M4. REST API(서버/엔드포인트/사용량) 공개 및 인증·권한 연동
- M5. 관측성/운영(로그/지표/헬스), 보안 강화를 위한 하드닝

### 11. 위험요소와 대응
- 다양한 MCP 서버의 응답/스키마 편차 → 어댑터 변환 계층 표준화, 엄격한 스키마 검증.
- 외부 의존성(Redis/DB) 장애 → 강등 전략, 재시도/타임아웃, 서킷브레이커.
- 멀티테넌시 데이터 격리 → 리포지토리 레벨 소유권 검사 일관화, 테스트 강화.

### 12. 오픈 이슈(향후 결정)
- 인증 스킴 표준화(Bearer vs. 커스텀 헤더), 권한 스코프 설계.
- 사용량/리밋 헤더 표준(예: X-RateLimit-Remaining 등).
- 라우팅 규칙 표현식 확장(파라미터 매칭/태그/시간대/비용 기반 등).
- HTTP/SSE 어댑터의 재연결/백오프 정책.

### 13. 참고(코드 맵)
- 엔트리포인트: `src/index.ts`
- DI 컨테이너: `src/infrastructure/di/container.ts`
- 서비스 인터페이스/구현: `src/domain/services/*`
- 모델: `src/domain/models/*`
- 리포지토리: `src/infrastructure/repositories/*`
- 어댑터/팩토리: `src/infrastructure/adapters/*`
- API 스켈레톤: `src/infrastructure/api/*`

