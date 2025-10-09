## 제품 개요

- **제품명**: MCP Hub Router (단순화 아키텍처)
- **목적**: 개인 사용자가 자신만의 MCP 서버(Stateless)를 쉽게 등록/관리하고, 웹 대시보드 및 표준 REST API/MCP 엔드포인트를 통해 안정적으로 활용할 수 있게 한다.
- **타깃 사용자**: 개인 개발자, 파워유저, 소규모 팀(개인 토큰 별 운영)

## 목표 / 비목표

### 목표
- 개인 서버 중심 설계에 맞춘 간단하고 유지보수 쉬운 허브 제공
- 인증은 JWT 기반, 모든 보호 API는 Bearer 토큰로 접근
- 서버 등록/조회/수정/삭제 및 헬스체크 제공
- API 키 발급/목록/폐기(단기: JWT 토큰과 동일 흐름, 장기: 별도 키 저장 스키마 완비)
- 라우팅 규칙(인메모리 1차) API 제공 및 네임스페이스 기반 기본 라우팅
- MCP 프로토콜 엔드포인트(SSE/HTTP) 제공
- 웹 대시보드로 로그인/세션 유지 및 기본 관리 플로우 제공

### 비목표(현 단계)
- 로드밸런싱/서킷브레이커/연결추적의 기본 활성화(코드 보존, 기본 비활성)
- 복잡한 파라미터/태그/시간 기반 라우팅(향후 확장)
- 조직 단위 공유 서버 운영(개인 중심 우선)

## 핵심 가치 제안
- 설정과 운영의 단순성: 개인 API 토큰 기반 MCP 서버를 빠르게 연결/사용
- 예측 가능한 동작: Stateless 가정, 간결한 라우팅, 명확한 에러 응답

## 사용자 시나리오(요약)
- 사용자는 회원가입/로그인 후 대시보드 진입 → 서버 등록(예: GitHub MCP stdio) → 도구 호출용 엔드포인트 사용 → 필요 시 라우팅 규칙 설정 → API 키(또는 JWT)로 클라이언트/툴 연동

## 기능 요구사항(Functional Requirements)

### 1) 인증/권한
- 로그인 성공 시 JWT 발급(기본 만료 24h), 응답: { userId, username, token, expiresAt }
- 보호 API는 `Authorization: Bearer <JWT>` 필수
- (선택) API 키 발급/조회/폐기 API 제공, 단계적 스키마 보완 예정

### 2) 사용자 관리
- 회원가입: 이메일/유저명/비밀번호(6자 이상, 영문+숫자)
- 로그인: 이메일+비밀번호 → JWT 반환
- 현재 사용자 조회: /api/users/me (JWT)

### 3) 서버 관리
- 등록/수정/삭제/조회, 헬스체크 및 도구 목록 조회
- 지원 프로토콜: stdio, sse, http
- 서버 메타데이터 저장 및 상태 노출

### 4) 그룹 및 라우팅 규칙(Phase-1)
- 인메모리 규칙 저장소로 GET/PUT 제공
- 규칙 모델: { id, condition: { toolName? }, targetServerId, priority, enabled }
- 평가: enabled만, priority 높은 순, 첫 매칭 선택 → 실패 시 기본(첫 활성 서버)

### 5) 엔드포인트
- 사용자/그룹 기반 엔드포인트 발급/조회(요구사항 반영), 대시보드/에이전트에서 사용

### 6) MCP 프로토콜
- SSE/HTTP 엔드포인트 제공, MCP Tool 목록/호출 라우팅

### 7) 마켓플레이스(Phase)
- 템플릿 목록/설치 API(개인 토큰 환경변수 연동)

### 8) 로깅/헬스/구성
- 구조적 로깅, /health, Swagger 문서, 환경변수 기반 설정

### 9) 사용량/속도 제한(옵션)
- Redis 기반 사용량 추적 및 기본 레이트리밋(개선 가능)

## 비기능 요구사항(Non-Functional)
- 단순성 우선: 로드밸런싱 비활성(코드 보존)
- 안정성: 보호 API 401 일관 처리, 에러 포맷 표준화
- 성능: 개인 사용자 기준 초당 수 요청 처리 목표, 로깅 최소화 옵션
- 보안: JWT 서명키 환경변수, 민감정보 로그 금지

## API 요약(핵심)

### 인증/사용자
- POST /api/users/register
- POST /api/users/login → { userId, username, token, expiresAt }
- GET  /api/users/me (JWT)

### API 키(점진)
- POST /api/users/api-keys (JWT)  body: { name, permissions?, expiresInDays? }
- GET  /api/users/api-keys (JWT)
- DELETE /api/users/api-keys/:keyId (JWT)

### 서버
- POST /api/servers (JWT)  body: { name, protocol, config, namespace? }
- GET  /api/servers (JWT)
- GET  /api/servers/:serverId (JWT)
- PUT  /api/servers/:serverId (JWT)
- DELETE /api/servers/:serverId (JWT)
- GET  /api/servers/:serverId/health (JWT)
- GET  /api/servers/:serverId/tools (JWT)

### 그룹/라우팅 규칙(Phase-1: 인메모리)
- GET  /api/groups (JWT)
- GET  /api/groups/:groupId/routing-rules (JWT)
- PUT  /api/groups/:groupId/routing-rules (JWT)

### MCP
- GET  /mcp/:endpointId/tools (JWT)
- POST /mcp/:endpointId/tools/call (JWT)
- GET  /mcp/:endpointId/sse (JWT, SSE)
- POST /mcp/:endpointId/http (JWT)

## 데이터 모델(요약)
- User(id, email, username, passwordHash, subscription, timestamps)
- ApiKey(id, userId, key(hash 저장), name, permissions?, rateLimit?, createdAt, expiresAt?, lastUsedAt?)
- Server(id, userId, name, protocol, config, namespace, status, timestamps)
- Group(id, userId, name, description, routingRules?)

## 아키텍처 요약
- Express REST + MCP(HTTP/SSE), DI 컨테이너, Postgres/Redis, React 대시보드
- Stateless MCP 서버 가정, 개인 서버 1차 초점
- 로드밸런서/서킷브레이커 코드는 보존하되 기본 비활성

## 릴리즈 범위(MVP)
- JWT 로그인/세션 유지(대시보드 새로고침 후에도 유지)
- 서버 CRUD/헬스/도구 조회
- 라우팅 규칙 API(인메모리) 제공
- 마켓플레이스 템플릿 조회(설치 기본 흐름)
- Swagger 문서/헬스 체크

## 수용 기준(Acceptance Criteria)
- 로그인 성공 후 대시보드로 이동, 3초 대기/새로고침에도 인증 유지(Playwright)
- `GET /api/servers`가 200 응답하고 빈 배열 또는 등록된 서버를 반환
- `PUT/GET /api/groups/:groupId/routing-rules` 정상 동작 및 우선순위 평가 반영
- MCP 툴 목록/호출 엔드포인트가 JWT 보호 하에 200 응답(기본 연결 환경에서)
- Swagger UI(/api-docs) 및 /health 200 OK

## QA 전략(요약)

### 테스트 범위
- 백엔드: 타입체크/단위/통합, REST 스모크, 에러 포맷 검증
- 프론트: 로그인/세션 유지, 대시보드 렌더링, API 연동 경로
- E2E: Playwright로 브라우저 시나리오 검증

### Playwright 시나리오(필수)
- 로그인 폼 입력 → 로그인 → 대시보드 진입 → 3초 대기 → 여전히 대시보드
- 서버 목록 패널 로딩(401 리다이렉트 없어야 함)
- (선택) 라우팅 규칙 설정/조회 API 호출 후 UI 반영 확인

### API 스모크(예시)
- POST /api/users/login → 200, token 존재
- GET  /api/users/me → 200
- GET  /api/servers → 200
- PUT/GET /api/groups/:groupId/routing-rules → 200

## 성공 지표(Metrics)
- 로그인 성공률 ≥ 99%
- 로그인 후 세션 유지 실패율(의도치 않은 401) ≤ 1%
- 서버 목록 API 평균 응답 < 200ms(개발 환경)

## 리스크 및 완화
- DB 스키마/실행 환경 상이로 인한 컬럼 불일치 → 리포지토리 레벨 가드/폴백, 마이그레이션 스크립트 보강
- JWT/스토리지 불일치로 인한 세션 유실 → 저장 포맷 통일(state+version) 및 부트 시 재수화
- 라우팅 규칙 인메모리 저장소 휘발성 → Phase-2에서 DB 영속화/버저닝 도입

## 오픈 이슈 / 향후 계획
- 라우팅 규칙 파라미터/태그/시간 기반 조건 확장
- 라우팅 규칙/엔드포인트의 DB 영속화/감사로그
- 로드밸런싱/서킷브레이커의 조건부 활성화(팀/조직 레벨)
- API 키 스키마 완비 및 키 관리 UI 고도화




