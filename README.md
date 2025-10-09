# MCP Hub Router - Mono-repo

MCP (Model Context Protocol) 서버들을 관리하고 라우팅하는 허브 시스템입니다.

## 📁 프로젝트 구조

```
mcp-server-hub/
├── src/                    # 백엔드 소스 코드
│   ├── domain/            # 도메인 로직
│   ├── infrastructure/    # 인프라스트럭처
│   └── index.ts          # 진입점
├── frontend/              # 프론트엔드 (React + TypeScript)
│   ├── src/
│   │   ├── pages/        # 페이지 컴포넌트
│   │   ├── stores/       # 상태 관리 (Zustand)
│   │   └── lib/          # API 클라이언트
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml     # Docker 서비스 정의
├── Dockerfile            # 백엔드 Docker 이미지
├── package.json          # 루트 package.json
└── README.md
```

## 🚀 빠른 시작

### 1. 전체 개발 환경 실행

```bash
# 모든 의존성 설치
npm install
npm run frontend:install

# 백엔드와 프론트엔드를 동시에 실행
npm run dev:all
```

### 2. 개별 실행

#### 백엔드만 실행
```bash
npm run dev
```

#### 프론트엔드만 실행
```bash
npm run frontend:dev
```

### 3. Docker로 백엔드 실행
```bash
docker-compose up -d
```

## 🌐 접속 URL

- **백엔드 API**: http://localhost:3000
- **프론트엔드**: http://localhost:5173
- **API 문서**: http://localhost:3000/api-docs

## 📋 주요 기능

### 백엔드 (Node.js + TypeScript + Express)
- ✅ 사용자 관리 (회원가입, 로그인, API 키)
- ✅ MCP 서버 등록 및 관리
- ✅ 마켓플레이스 (서버 템플릿)
- ✅ MCP 프로토콜 엔드포인트
- ✅ 데이터베이스 연결 (PostgreSQL)
- ✅ Redis 캐싱 및 Rate Limiting

### 프론트엔드 (React + TypeScript + Vite)
- ✅ 로그인/회원가입 페이지
- ✅ 대시보드 (서버 현황)
- ✅ 서버 관리 (CRUD)
- ✅ 마켓플레이스 브라우징
- ✅ API 키 관리
- ✅ 반응형 UI (Tailwind CSS)

## 🛠️ 개발 명령어

```bash
# 전체 빌드
npm run build:all

# 프론트엔드 빌드
npm run frontend:build

# 테스트 실행
npm test

# 데이터베이스 마이그레이션
npm run db:migrate

# E2E 테스트 실행 (Playwright)
npm run test:e2e

# E2E 테스트 UI 모드 실행
npm run test:e2e:ui

# E2E 테스트 디버그 모드 실행
npm run test:e2e:debug

# 종합 테스트 실행 (모든 테스트 포함)
QA/e2e/run-all-tests.sh
```

## 🔧 환경 설정

### 환경 변수 (.env)
```env
# 데이터베이스
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mcp_hub_router
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key

# 로그 레벨
LOG_LEVEL=debug
```

## 📦 의존성

### 백엔드
- Express.js (웹 프레임워크)
- TypeScript (타입 안전성)
- PostgreSQL (데이터베이스)
- Redis (캐싱)
- InversifyJS (의존성 주입)

### 프론트엔드
- React 18 (UI 라이브러리)
- TypeScript (타입 안전성)
- Vite (빌드 도구)
- Tailwind CSS (스타일링)
- Zustand (상태 관리)
- React Router (라우팅)

## 🐳 Docker

```bash
# 모든 서비스 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 서비스 중지
docker-compose down
```

## 📝 API 문서

Swagger UI를 통해 API 문서를 확인할 수 있습니다:
http://localhost:3000/api-docs

## 🤝 기여하기

1. 이슈 생성 또는 기존 이슈 확인
2. 기능 브랜치 생성
3. 코드 작성 및 테스트
4. Pull Request 생성

## 🧪 QA 및 테스트

프로젝트는 포괄적인 테스트 스위트를 포함합니다:

### 테스트 범위
- **단위 테스트**: Jest를 사용한 백엔드 로직 테스트
- **통합 테스트**: API 엔드포인트 및 데이터베이스 연동 테스트
- **E2E 테스트**: Playwright를 사용한 브라우저 기반 사용자 시나리오 테스트

### E2E 테스트 시나리오
- ✅ 사용자 인증 (회원가입, 로그인, 세션 유지)
- ✅ 대시보드 접근 및 서버 목록 표시
- ✅ 서버 관리 (등록, 수정, 삭제, 헬스체크)
- ✅ 라우팅 규칙 설정 및 우선순위 평가
- ✅ MCP 프로토콜 엔드포인트 통신

### 테스트 실행 방법

```bash
# 기본 E2E 테스트 실행
npm run test:e2e

# UI 모드로 테스트 실행 (인터랙티브)
npm run test:e2e:ui

# 디버그 모드로 테스트 실행
npm run test:e2e:debug

# 모든 테스트 실행 (단위 + 통합 + E2E)
./QA/e2e/run-all-tests.sh
```

테스트 결과는 `QA/e2e/test-results/` 디렉토리에 저장됩니다.

## 📄 라이선스

MIT License