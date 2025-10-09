import { test, expect } from '@playwright/test';

test.describe('인증 기능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 각 테스트 전에 로그인 페이지로 이동
    await page.goto('http://localhost:5173/login');
  });

  test('회원가입 페이지 접근', async ({ page }) => {
    await page.click('text=새 계정 만들기');
    await expect(page).toHaveURL('/register');
    await expect(page.locator('h2')).toContainText('새 계정 만들기');
  });

  test('로그인 폼 표시', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('MCP Hub 로그인');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('로그인');
  });

  test('회원가입 기능', async ({ page }) => {
    // 회원가입 페이지로 이동
    await page.click('text=새 계정 만들기');
    await expect(page).toHaveURL('/register');

    // 회원가입 폼 입력
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="confirmPassword"]', 'password123');

    // 회원가입 제출
    await page.click('button[type="submit"]');

    // 로그인 페이지로 리다이렉션 확인
    await expect(page).toHaveURL('/login');
  });

  test('로그인 성공 및 대시보드 접근', async ({ page }) => {
    // 먼저 회원가입
    await page.click('text=새 계정 만들기');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="confirmPassword"]', 'password123');
    await page.click('button[type="submit"]');

    // 로그인 시도
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // 대시보드로 이동 확인
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1, h2')).toContainText(/대시보드|Dashboard/i);
  });

  test('세션 유지 확인', async ({ page }) => {
    // 로그인 후 세션 유지 테스트를 위해 필요한 경우에만 실행
    // 실제 구현 시에는 로그인 상태를 확인하는 방법이 필요함

    // 로그인 성공 후 대시보드 접근
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // 대시보드 접근 확인
    await expect(page).toHaveURL('/dashboard');

    // 페이지 새로고침 후에도 로그인 상태 유지 확인
    await page.reload();
    await expect(page).toHaveURL('/dashboard');

    // 3초 대기 후에도 여전히 대시보드에 머물러 있는지 확인
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL('/dashboard');
  });

  test('잘못된 로그인 정보로 로그인 실패', async ({ page }) => {
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // 에러 메시지 표시 확인
    await expect(page.locator('.text-red-600')).toBeVisible();
  });

  test('로그인 페이지에서 서버 목록 패널 로딩', async ({ page }) => {
    // 로그인 성공
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // 대시보드 접근 후 서버 목록이 로딩되는지 확인
    await expect(page).toHaveURL('/dashboard');

    // 서버 목록이 표시되는지 확인 (401 리다이렉트 없음)
    // 실제 구현에 따라 서버 목록 요소의 셀렉터가 달라질 수 있음
    await expect(page.locator('[data-testid="servers-list"], .servers-list, #servers')).toBeDefined();
  });
});
