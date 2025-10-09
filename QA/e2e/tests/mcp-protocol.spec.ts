import { test, expect } from '@playwright/test';

test.describe('MCP 프로토콜 기능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 각 테스트 전에 로그인
    await page.goto('/login');

    // 회원가입 후 로그인 (테스트용 계정 생성)
    await page.click('text=새 계정 만들기');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="confirmPassword"]', 'password123');
    await page.click('button[type="submit"]');

    // 로그인
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // 대시보드로 이동 확인
    await expect(page).toHaveURL('/dashboard');
  });

  test('MCP 엔드포인트 페이지 접근', async ({ page }) => {
    // MCP 엔드포인트 페이지로 이동 (사용 가능한 엔드포인트 목록)
    // 실제 구현에 따라 경로가 달라질 수 있음
    await page.goto('/mcp');

    // 엔드포인트 목록이 표시되는지 확인
    await expect(page.locator('[data-testid="mcp-endpoints"], .endpoint-list')).toBeVisible();
  });

  test('MCP 도구 목록 조회', async ({ page }) => {
    // 특정 엔드포인트의 도구 목록 조회
    // 실제 구현에 따라 엔드포인트 ID나 경로가 필요함
    const endpointId = 'test-endpoint-123';
    await page.goto(`/mcp/${endpointId}/tools`);

    // 도구 목록이 표시되는지 확인
    await expect(page.locator('[data-testid="tools-list"], .tools-list')).toBeVisible();

    // 도구 아이템들이 있는지 확인
    await expect(page.locator('[data-testid="tool-item"], .tool-item')).toHaveCountGreaterThan(0);
  });

  test('MCP 도구 호출 기능', async ({ page }) => {
    // 특정 엔드포인트의 도구 호출
    const endpointId = 'test-endpoint-123';
    await page.goto(`/mcp/${endpointId}/tools/call`);

    // 도구 호출 폼이 있는지 확인
    await expect(page.locator('form')).toBeVisible();

    // 도구 호출 입력
    await page.fill('input[name="toolName"]', 'test-tool');
    await page.fill('textarea[name="parameters"]', JSON.stringify({
      param1: 'value1',
      param2: 'value2'
    }));

    // 도구 호출 제출
    await page.click('button[type="submit"]');

    // 호출 결과가 표시되는지 확인
    await expect(page.locator('[data-testid="call-result"], .call-result')).toBeVisible();
  });

  test('MCP SSE 엔드포인트 연결', async ({ page }) => {
    // SSE 엔드포인트에 연결
    const endpointId = 'test-endpoint-123';

    // SSE 엔드포인트로 이동 (브라우저에서 직접 테스트하기 어려우므로 기본 연결만 확인)
    await page.goto(`/mcp/${endpointId}/sse`);

    // 페이지가 정상적으로 로딩되는지 확인
    await expect(page.locator('body')).toBeVisible();

    // 연결 상태 메시지나 에러 메시지가 없는지 확인
    await expect(page.locator('.error')).not.toBeVisible();
  });

  test('MCP HTTP 엔드포인트 통신', async ({ page }) => {
    // HTTP 엔드포인트를 통한 MCP 통신 테스트
    const endpointId = 'test-endpoint-123';

    // HTTP 엔드포인트로 요청 보내기 (페이지에서 직접 호출하거나 별도 API 호출)
    await page.goto(`/mcp/${endpointId}/http`);

    // HTTP 통신 폼이나 인터페이스가 있는지 확인
    await expect(page.locator('form, [data-testid="http-interface"]')).toBeVisible();
  });

  test('엔드포인트 생성 및 관리', async ({ page }) => {
    // 엔드포인트 관리 페이지로 이동
    await page.goto('/endpoints');

    // 엔드포인트 생성 폼이 있는지 확인
    await expect(page.locator('[data-testid="create-endpoint"], button:has-text("엔드포인트 생성")')).toBeVisible();

    // 엔드포인트 생성
    await page.fill('input[name="name"]', '테스트 엔드포인트');
    await page.selectOption('select[name="serverId"]', 'server_123');
    await page.click('button[type="submit"]');

    // 엔드포인트가 생성되었는지 확인
    await expect(page.locator('text=테스트 엔드포인트')).toBeVisible();
  });

  test('엔드포인트별 도구 호출 권한 확인', async ({ page }) => {
    // 특정 엔드포인트에 대한 접근 권한 테스트
    const endpointId = 'test-endpoint-123';

    // 인증 없이 접근 시도 (401 응답 확인)
    await page.goto(`/mcp/${endpointId}/tools`);

    // 인증되지 않은 접근에 대한 적절한 응답 확인
    // 실제 구현에 따라 리다이렉션이나 에러 페이지가 표시될 수 있음
    await expect(page.locator('.unauthorized, .error')).toBeVisible();
  });
});
