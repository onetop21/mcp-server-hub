# MCP Hub Router - Web Dashboard 기획

## 📋 프로젝트 개요

**프로젝트명**: MCP Hub Dashboard  
**유형**: 별도 프론트엔드 프로젝트  
**목적**: MCP Hub Router의 관리 웹 인터페이스  
**상태**: 기획 단계  

---

## 🎯 핵심 목표

### 1. 사용자 경험
- **직관적인 UI**: 비개발자도 쉽게 사용 가능
- **반응형 디자인**: 데스크탑/태블릿/모바일 지원
- **실시간 업데이트**: 서버 상태 실시간 모니터링
- **다크 모드**: 눈의 피로 감소

### 2. 주요 기능
- MCP 서버 관리 (생성, 수정, 삭제)
- 마켓플레이스 브라우징 및 설치
- 서버 헬스 모니터링
- API 키 관리
- 설정 관리

---

## 🏗️ 기술 스택 제안

### Frontend
```
Framework: React 18+ with TypeScript
Styling: Tailwind CSS + shadcn/ui
State Management: Zustand or React Query
Routing: React Router v6
Build Tool: Vite
```

### API 통신
```
HTTP Client: Axios or Fetch API
Real-time: SSE (Server-Sent Events)
Auth: Bearer Token (localStorage)
```

### 개발 도구
```
Linting: ESLint + Prettier
Testing: Vitest + React Testing Library
E2E: Playwright
```

---

## 📱 화면 구성

### 1. 인증 화면

#### 1.1 로그인 페이지
- 이메일 + 비밀번호 입력
- "로그인 유지" 체크박스
- 회원가입 링크

#### 1.2 회원가입 페이지
- 이메일, 사용자명, 비밀번호 입력
- 비밀번호 강도 표시
- 약관 동의

---

### 2. 메인 대시보드 (/)

#### 레이아웃
```
┌─────────────────────────────────────────────┐
│ [Logo]    Dashboard         [User Menu]     │
├─────────────────────────────────────────────┤
│  Sidebar  │  Main Content Area              │
│           │                                  │
│  - Home   │  ┌──────────────────────────┐  │
│  - Servers│  │  Quick Stats             │  │
│  - Market │  │  - Total Servers: 5      │  │
│  - Keys   │  │  - Active: 4  Inactive: 1│  │
│  - Settings  │  └──────────────────────────┘  │
│           │                                  │
│           │  ┌──────────────────────────┐  │
│           │  │  Recent Servers          │  │
│           │  │  [Server Cards]          │  │
│           │  └──────────────────────────┘  │
└───────────┴──────────────────────────────────┘
```

#### 대시보드 위젯
1. **Quick Stats**
   - 총 서버 수
   - 활성/비활성 서버
   - API 호출 횟수 (오늘)
   - 최근 에러 수

2. **서버 상태 차트**
   - 파이 차트: 프로토콜별 서버 분포
   - 라인 차트: 최근 7일 API 호출 추이

3. **최근 활동**
   - 서버 추가/삭제 이력
   - 설정 변경 이력
   - 에러 로그 (최근 10개)

---

### 3. 서버 관리 (/servers)

#### 3.1 서버 목록 화면
```
┌──────────────────────────────────────────┐
│  Servers                  [+ New Server] │
├──────────────────────────────────────────┤
│  🔍 Search  │  Filter: [All ▾] [Sort ▾] │
├──────────────────────────────────────────┤
│                                           │
│  ┌──────────────────────────────────┐   │
│  │ 🟢 My GitHub Server               │   │
│  │ Protocol: STDIO  Namespace: gh    │   │
│  │ Status: Active  │  [Edit] [Delete]│   │
│  └──────────────────────────────────┘   │
│                                           │
│  ┌──────────────────────────────────┐   │
│  │ 🔴 Slack Integration              │   │
│  │ Protocol: STDIO  Namespace: slack │   │
│  │ Status: Error   │  [Edit] [Delete]│   │
│  └──────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

**서버 카드 정보**:
- 서버 이름
- 프로토콜 (STDIO/SSE/HTTP)
- 네임스페이스
- 상태 (Active/Inactive/Error)
- 마지막 헬스 체크 시간
- 액션 버튼 (수정, 삭제, 헬스 체크)

#### 3.2 서버 상세 화면
```
┌──────────────────────────────────────────┐
│  ← Back    My GitHub Server              │
├──────────────────────────────────────────┤
│  [Overview] [Configuration] [Logs]       │
├──────────────────────────────────────────┤
│  Status: 🟢 Active                       │
│  Protocol: STDIO                         │
│  Namespace: github                       │
│  Created: 2025-10-05                    │
│                                           │
│  Command: mcp-server-github              │
│  Environment Variables:                   │
│    GITHUB_TOKEN: ghp_****              │
│    GITHUB_ORG: my-org                   │
│                                           │
│  Health Check:                           │
│    Last Check: 2 minutes ago            │
│    Response Time: 45ms                  │
│    Status: ✓ Healthy                    │
│                                           │
│  [Edit Server] [Delete Server]          │
└──────────────────────────────────────────┘
```

**탭 구성**:
1. **Overview**: 기본 정보 및 상태
2. **Configuration**: 설정 수정
3. **Logs**: 서버 로그 (최근 100개)

#### 3.3 서버 생성/수정 모달
```
┌──────────────────────────────────────────┐
│  Create New Server               [x]     │
├──────────────────────────────────────────┤
│                                           │
│  Name *                                   │
│  [________________]                       │
│                                           │
│  Protocol *                               │
│  (•) STDIO  ( ) SSE  ( ) HTTP           │
│                                           │
│  Namespace                                │
│  [________________]                       │
│                                           │
│  Command (for STDIO) *                   │
│  [________________]                       │
│                                           │
│  Environment Variables                    │
│  Key           Value                      │
│  [________]    [________]  [+ Add]       │
│                                           │
│          [Cancel]  [Create Server]       │
└──────────────────────────────────────────┘
```

---

### 4. 마켓플레이스 (/marketplace)

#### 4.1 마켓플레이스 브라우징
```
┌──────────────────────────────────────────┐
│  Marketplace                              │
├──────────────────────────────────────────┤
│  🔍 Search templates...                  │
│                                           │
│  Tags: [All] [GitHub] [Slack] [Dev]     │
│  Sort: [Popular ▾]                       │
├──────────────────────────────────────────┤
│                                           │
│  ┌────────────┐  ┌────────────┐         │
│  │ GitHub MCP │  │ Slack MCP  │         │
│  │            │  │            │         │
│  │ 🔧 Dev     │  │ 💬 Comm    │         │
│  │ ⭐ 42 installs │ ⭐ 28 installs│       │
│  │ [Install]  │  │ [Install]  │         │
│  └────────────┘  └────────────┘         │
└──────────────────────────────────────────┘
```

**템플릿 카드**:
- 템플릿 이름
- 아이콘/로고
- 짧은 설명
- 태그
- 설치 횟수
- [Install] 버튼

#### 4.2 템플릿 상세 모달
```
┌──────────────────────────────────────────┐
│  GitHub MCP                      [x]     │
├──────────────────────────────────────────┤
│  Protocol: STDIO                         │
│  Tags: github, development, scm          │
│  Installs: 42                            │
│                                           │
│  Description:                            │
│  Complete GitHub integration providing   │
│  tools for creating issues, searching    │
│  repositories, managing pull requests... │
│                                           │
│  Required Environment Variables:         │
│  • GITHUB_TOKEN - GitHub Personal Access │
│    Token (generate at github.com/...)   │
│                                           │
│  Optional:                               │
│  • GITHUB_ORG - Default organization     │
│                                           │
│  Installation:                           │
│  $ npm install -g @modelcontext...      │
│                                           │
│  Documentation: [View Docs]              │
│                                           │
│          [Cancel]  [Install]             │
└──────────────────────────────────────────┘
```

#### 4.3 설치 마법사
```
┌──────────────────────────────────────────┐
│  Install GitHub MCP         [x]  [2/3]  │
├──────────────────────────────────────────┤
│  Step 1: Installation Instructions       │
│  ✓ npm install completed                │
│                                           │
│  Step 2: Configuration                   │
│                                           │
│  Server Name *                           │
│  [My GitHub Server____________]         │
│                                           │
│  Namespace                               │
│  [github___________________]             │
│                                           │
│  GITHUB_TOKEN * (required)              │
│  [ghp_xxxxxxxxxxxxx________]             │
│  🔗 Get your token at github.com/...    │
│                                           │
│  GITHUB_ORG (optional)                  │
│  [my-org___________________]             │
│                                           │
│  Step 3: Review & Install                │
│                                           │
│          [Back]  [Install Now]           │
└──────────────────────────────────────────┘
```

---

### 5. API 키 관리 (/api-keys)

```
┌──────────────────────────────────────────┐
│  API Keys                [+ New Key]     │
├──────────────────────────────────────────┤
│                                           │
│  ┌──────────────────────────────────┐   │
│  │ Default Key                       │   │
│  │ Key: mcp_**********************   │   │
│  │ Created: 2025-10-01               │   │
│  │ Expires: 2026-01-01               │   │
│  │ Last Used: 2 hours ago            │   │
│  │        [Copy] [Revoke]            │   │
│  └──────────────────────────────────┘   │
│                                           │
│  ┌──────────────────────────────────┐   │
│  │ Production Key                    │   │
│  │ Key: mcp_**********************   │   │
│  │ Created: 2025-09-15               │   │
│  │ Expires: Never                    │   │
│  │ Last Used: 1 week ago             │   │
│  │        [Copy] [Revoke]            │   │
│  └──────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

---

### 6. 설정 (/settings)

#### 탭 구성
1. **Profile**: 사용자 정보 수정
2. **Preferences**: UI 설정 (다크 모드, 언어)
3. **Notifications**: 알림 설정
4. **Security**: 비밀번호 변경
5. **Advanced**: 고급 설정

```
┌──────────────────────────────────────────┐
│  Settings                                 │
├──────────────────────────────────────────┤
│  [Profile] [Preferences] [Security]      │
├──────────────────────────────────────────┤
│  Profile Settings                        │
│                                           │
│  Email                                    │
│  [user@example.com_________]             │
│                                           │
│  Username                                 │
│  [myusername_______________]             │
│                                           │
│  Display Name                             │
│  [John Doe_________________]             │
│                                           │
│  Avatar                                   │
│  [Upload Image] or [Use Gravatar]       │
│                                           │
│  Danger Zone                             │
│  [Delete Account]                        │
│                                           │
│          [Cancel]  [Save Changes]        │
└──────────────────────────────────────────┘
```

---

## 🎨 UI/UX 가이드라인

### 색상 팔레트
```css
Primary: #3B82F6 (Blue)
Success: #10B981 (Green)
Warning: #F59E0B (Orange)
Error: #EF4444 (Red)
Neutral: #6B7280 (Gray)

Background (Light): #FFFFFF
Background (Dark): #1F2937
```

### 타이포그래피
```
Headings: Inter (Bold)
Body: Inter (Regular)
Code: Fira Code (Monospace)
```

### 컴포넌트 라이브러리
- **shadcn/ui**: 기본 UI 컴포넌트
- **Lucide React**: 아이콘
- **Recharts**: 차트
- **React Hot Toast**: 알림

---

## 🔐 보안 고려사항

### 1. 인증
- JWT 토큰을 localStorage에 저장
- 토큰 만료 시 자동 갱신
- 로그아웃 시 토큰 삭제

### 2. API 키 보호
- 환경변수는 마스킹 처리 (*****)
- 복사 시에만 전체 값 표시
- HTTPS 통신 필수

### 3. XSS 방어
- 사용자 입력 sanitize
- Content Security Policy 설정
- React의 기본 XSS 방어 활용

---

## 📊 상태 관리 구조

### Zustand Store 예시
```typescript
interface AppStore {
  // Auth
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;

  // Servers
  servers: Server[];
  fetchServers: () => Promise<void>;
  createServer: (data: ServerCreate) => Promise<void>;
  updateServer: (id: string, data: ServerUpdate) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;

  // Marketplace
  marketplaceServers: MarketplaceServer[];
  fetchMarketplace: () => Promise<void>;
  installFromMarketplace: (id: string, config: InstallConfig) => Promise<void>;

  // UI State
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  toggleTheme: () => void;
  toggleSidebar: () => void;
}
```

---

## 🚀 개발 로드맵

### Phase 1: MVP (2-3주)
- ✅ 프로젝트 설정 (Vite + React + TypeScript)
- ✅ 기본 레이아웃 및 라우팅
- ✅ 로그인/회원가입 화면
- ✅ 서버 목록 및 생성/수정/삭제
- ✅ 마켓플레이스 브라우징
- ✅ API 키 관리
- ✅ 기본 설정 화면

### Phase 2: 고급 기능 (2주)
- 서버 헬스 모니터링 (실시간)
- 로그 뷰어
- 통계 대시보드
- 그룹 관리
- 검색 및 필터링 개선

### Phase 3: 폴리싱 (1주)
- 다크 모드 완성
- 반응형 디자인 최적화
- 성능 최적화
- E2E 테스트
- 문서화

---

## 📦 프로젝트 구조

```
mcp-hub-dashboard/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── layout/          # Layout components
│   │   ├── servers/         # Server-related components
│   │   ├── marketplace/     # Marketplace components
│   │   └── common/          # Shared components
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Servers.tsx
│   │   ├── Marketplace.tsx
│   │   ├── ApiKeys.tsx
│   │   └── Settings.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useServers.ts
│   │   └── useMarketplace.ts
│   ├── lib/
│   │   ├── api.ts           # API client
│   │   ├── utils.ts         # Utility functions
│   │   └── constants.ts     # Constants
│   ├── store/
│   │   └── useStore.ts      # Zustand store
│   ├── types/
│   │   └── index.ts         # TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🔗 API 연동

### Base URL
```typescript
const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3000/api';
```

### API Client 예시
```typescript
class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // User endpoints
  async login(email: string, password: string) {
    return this.request('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // Server endpoints
  async getServers() {
    return this.request('/servers');
  }

  async createServer(data: ServerCreate) {
    return this.request('/servers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ... more endpoints
}
```

---

## 🧪 테스트 전략

### Unit Tests
- 컴포넌트 렌더링
- 사용자 인터랙션
- Store 로직

### Integration Tests
- API 통신
- 페이지 전환
- 폼 제출

### E2E Tests
- 로그인 플로우
- 서버 생성 플로우
- 마켓플레이스 설치 플로우

---

## 📝 참고 자료

### Design Inspiration
- Vercel Dashboard
- Supabase Dashboard
- Railway Dashboard
- Netlify Dashboard

### Component Libraries
- [shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Headless UI](https://headlessui.com/)

### State Management
- [Zustand](https://github.com/pmndrs/zustand)
- [React Query](https://tanstack.com/query/latest)

---

## 🎯 성공 지표

### 사용자 경험
- 페이지 로드 시간 < 2초
- Time to Interactive < 3초
- 모바일 접근성 점수 > 90

### 개발자 경험
- TypeScript 타입 커버리지 > 95%
- 테스트 커버리지 > 80%
- Lighthouse 점수 > 90

---

## 🚀 배포 계획

### Development
- Vercel/Netlify 자동 배포
- Preview 환경 제공

### Production
- CDN 활용
- 환경변수 관리
- 롤백 전략

---

**이 문서는 초기 기획이며, 개발 과정에서 지속적으로 업데이트됩니다.**

