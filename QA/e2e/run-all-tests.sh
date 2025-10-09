#!/bin/bash

# MCP Server Hub - 종합 테스트 실행 스크립트

echo "🚀 MCP Server Hub 종합 테스트 시작..."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 프로젝트 루트 디렉토리로 이동
cd "$(dirname "$0")/../.."

# 1. 환경 확인
echo -e "${BLUE}📋 환경 확인 중...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js가 설치되어 있지 않습니다.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm이 설치되어 있지 않습니다.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js 버전: $(node --version)${NC}"
echo -e "${GREEN}✅ npm 버전: $(npm --version)${NC}"

# 2. 의존성 설치 확인
echo -e "${BLUE}📦 의존성 확인 중...${NC}"

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules가 없습니다. 의존성을 설치합니다...${NC}"
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}⚠️  frontend/node_modules가 없습니다. 프론트엔드 의존성을 설치합니다...${NC}"
    npm run frontend:install
fi

# 3. Playwright 브라우저 설치
echo -e "${BLUE}🌐 Playwright 브라우저 설치 중...${NC}"
npx playwright install --yes

# 4. 빌드 확인
echo -e "${BLUE}🔨 프로젝트 빌드 확인 중...${NC}"

if [ ! -d "dist" ]; then
    echo -e "${YELLOW}⚠️  빌드 파일이 없습니다. 빌드를 실행합니다...${NC}"
    npm run build
fi

# 5. 환경변수 파일 확인
echo -e "${BLUE}⚙️  환경 설정 확인 중...${NC}"

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env 파일이 없습니다. 템플릿을 복사합니다...${NC}"
    cp env.template .env 2>/dev/null || echo -e "${YELLOW}⚠️  환경 템플릿 파일을 찾을 수 없습니다.${NC}"
fi

# 6. 데이터베이스 설정 확인
echo -e "${BLUE}🗄️  데이터베이스 확인 중...${NC}"

# 기본 데이터베이스 설정 (환경변수에서 읽기)
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-mcp_hub_router}

# PostgreSQL 연결 확인 (간단한 방법)
if command -v psql &> /dev/null; then
    if psql -h $DB_HOST -p $DB_PORT -U postgres -l 2>/dev/null | grep -q $DB_NAME; then
        echo -e "${GREEN}✅ 데이터베이스 '$DB_NAME'가 존재합니다.${NC}"
    else
        echo -e "${YELLOW}⚠️  데이터베이스 '$DB_NAME'가 존재하지 않습니다. 초기화 스크립트를 실행합니다...${NC}"
        npm run db:test 2>/dev/null || echo -e "${YELLOW}⚠️  데이터베이스 초기화에 실패했습니다.${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  psql이 설치되어 있지 않아 데이터베이스 연결을 확인할 수 없습니다.${NC}"
fi

# 7. 서비스 시작 (백그라운드에서)
echo -e "${BLUE}🚀 서비스 시작 중...${NC}"

# 백엔드 서버 시작
echo -e "${YELLOW}📡 백엔드 서버 시작 중...${NC}"
npm run dev &
BACKEND_PID=$!

# 프론트엔드 서버 시작 (잠시 대기 후)
sleep 3
echo -e "${YELLOW}🖥️  프론트엔드 서버 시작 중...${NC}"
npm run frontend:dev &
FRONTEND_PID=$!

# 서비스가 시작될 때까지 대기
echo -e "${YELLOW}⏳ 서비스 시작 대기 중...${NC}"
sleep 10

# 서비스 헬스체크
echo -e "${BLUE}🏥 서비스 헬스체크 중...${NC}"

# 백엔드 헬스체크
if curl -f http://localhost:3000/health 2>/dev/null; then
    echo -e "${GREEN}✅ 백엔드 서버가 정상 응답합니다.${NC}"
else
    echo -e "${RED}❌ 백엔드 서버가 응답하지 않습니다.${NC}"
fi

# 프론트엔드 헬스체크
if curl -f http://localhost:5173 2>/dev/null; then
    echo -e "${GREEN}✅ 프론트엔드 서버가 정상 응답합니다.${NC}"
else
    echo -e "${RED}❌ 프론트엔드 서버가 응답하지 않습니다.${NC}"
fi

# 8. 테스트 실행
echo -e "${BLUE}🧪 테스트 실행 중...${NC}"

# 단위 테스트 실행
echo -e "${YELLOW}📊 단위 테스트 실행 중...${NC}"
npm test

# 통합 테스트 실행
echo -e "${YELLOW}🔗 통합 테스트 실행 중...${NC}"
npm run test:integration

# E2E 테스트 실행
echo -e "${YELLOW}🎭 E2E 테스트 실행 중...${NC}"
npm run test:e2e

# 9. 테스트 결과 정리
echo -e "${BLUE}📋 테스트 결과 정리 중...${NC}"

# 테스트 결과 파일 생성
TEST_RESULTS_DIR="QA/e2e/test-results"
mkdir -p "$TEST_RESULTS_DIR"

# 타임스탬프
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# 결과 파일 이동 (있는 경우)
if [ -d "playwright-report" ]; then
    mv playwright-report "$TEST_RESULTS_DIR/report_$TIMESTAMP"
    echo -e "${GREEN}✅ 테스트 리포트가 $TEST_RESULTS_DIR/report_$TIMESTAMP에 저장되었습니다.${NC}"
fi

if [ -f "test-results.json" ]; then
    mv test-results.json "$TEST_RESULTS_DIR/results_$TIMESTAMP.json"
    echo -e "${GREEN}✅ 테스트 결과가 $TEST_RESULTS_DIR/results_$TIMESTAMP.json에 저장되었습니다.${NC}"
fi

# 10. 정리
echo -e "${BLUE}🧹 정리 중...${NC}"

# 서비스 종료
kill $BACKEND_PID 2>/dev/null
kill $FRONTEND_PID 2>/dev/null

echo -e "${GREEN}✅ MCP Server Hub 종합 테스트가 완료되었습니다.${NC}"
echo -e "${BLUE}📊 결과는 $TEST_RESULTS_DIR 디렉토리에서 확인할 수 있습니다.${NC}"
