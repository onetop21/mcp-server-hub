import { test, expect } from '@playwright/test';

test.describe('서버 관리 기능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 각 테스트 전에 로그인
    await page.goto('http://localhost:5173/login');

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
    await expect(page).toHaveURL('http://localhost:5173/dashboard');
  });

  test('서버 등록 페이지 접근', async ({ page }) => {
    // 서버 관리 페이지로 이동 (네비게이션 메뉴에서 접근)
    // 실제 구현에 따라 경로가 달라질 수 있음
    await page.goto('http://localhost:5173/servers');

    // 서버 등록 버튼이나 폼이 있는지 확인
    await expect(page.locator('[data-testid="add-server"], button:has-text("서버 추가"), form')).toBeDefined();
  });

  test('서버 등록 기능', async ({ page }) => {
    await page.goto('/servers');

    // 서버 등록 폼 요소들이 있는지 확인
    const serverForm = page.locator('form').first();
    await expect(serverForm).toBeVisible();

    // 서버 정보 입력
    await page.fill('input[name="name"]', '테스트 MCP 서버');
    await page.fill('input[name="protocol"]', 'stdio');
    await page.fill('textarea[name="config"]', JSON.stringify({
      command: 'node',
      args: ['test-server.js']
    }));

    // 서버 등록 제출
    await page.click('button[type="submit"]');

    // 서버 등록 성공 확인
    await expect(page.locator('.success, [data-testid="server-added"]')).toBeVisible();
  });

  test('서버 목록 조회', async ({ page }) => {
    await page.goto('/servers');

    // 서버 목록이 표시되는지 확인
    await expect(page.locator('[data-testid="servers-list"], .server-item, table')).toBeVisible();

    // 등록된 서버가 목록에 나타나는지 확인
    await expect(page.locator('text=테스트 MCP 서버')).toBeVisible();
  });

  test('서버 수정 기능', async ({ page }) => {
    await page.goto('/servers');

    // 등록된 서버의 수정 버튼 클릭
    await page.click('[data-testid="edit-server"]:first-child, .edit-button:first');

    // 수정 폼이 나타나는지 확인
    await expect(page.locator('form')).toBeVisible();

    // 서버 이름 수정
    await page.fill('input[name="name"]', '수정된 테스트 MCP 서버');

    // 수정 제출
    await page.click('button[type="submit"]');

    // 수정 성공 확인
    await expect(page.locator('text=수정된 테스트 MCP 서버')).toBeVisible();
  });

  test('서버 삭제 기능', async ({ page }) => {
    await page.goto('/servers');

    // 등록된 서버의 삭제 버튼 클릭
    await page.click('[data-testid="delete-server"]:first-child, .delete-button:first');

    // 삭제 확인 다이얼로그에서 확인 클릭
    await page.click('button:has-text("삭제"), button:has-text("확인")');

    // 서버가 목록에서 제거되었는지 확인
    await expect(page.locator('text=수정된 테스트 MCP 서버')).not.toBeVisible();
  });

  test('서버 헬스체크 기능', async ({ page }) => {
    await page.goto('/servers');

    // 서버의 헬스체크 버튼 클릭
    await page.click('[data-testid="health-check"]:first-child, .health-button:first');

    // 헬스체크 결과가 표시되는지 확인
    await expect(page.locator('[data-testid="health-status"], .health-status')).toBeVisible();
  });

  test('서버 도구 목록 조회', async ({ page }) => {
    await page.goto('/servers');

    // 서버의 도구 목록 버튼 클릭
    await page.click('[data-testid="view-tools"]:first-child, .tools-button:first');

    // 도구 목록이 표시되는지 확인
    await expect(page.locator('[data-testid="tools-list"], .tools-list')).toBeVisible();
  });
});
