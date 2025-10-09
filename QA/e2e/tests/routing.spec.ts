import { test, expect } from '@playwright/test';

test.describe('라우팅 규칙 기능 테스트', () => {
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

  test('그룹 페이지 접근', async ({ page }) => {
    // 그룹 관리 페이지로 이동
    await page.goto('/groups');

    // 그룹 페이지가 정상적으로 로딩되는지 확인
    await expect(page.locator('h1, h2')).toContainText(/그룹|Groups/i);
  });

  test('라우팅 규칙 조회', async ({ page }) => {
    await page.goto('/groups');

    // 그룹 선택 또는 생성 후 라우팅 규칙 페이지로 이동
    // 실제 구현에 따라 그룹이 이미 존재하거나 생성해야 할 수 있음

    // 그룹이 있는 경우 첫 번째 그룹의 라우팅 규칙 버튼 클릭
    const routingButton = page.locator('[data-testid="routing-rules"], button:has-text("라우팅 규칙")').first();
    if (await routingButton.isVisible()) {
      await routingButton.click();

      // 라우팅 규칙 페이지가 로딩되는지 확인
      await expect(page.locator('[data-testid="routing-rules-list"], .routing-rules')).toBeVisible();
    }
  });

  test('라우팅 규칙 설정', async ({ page }) => {
    await page.goto('/groups');

    // 그룹 선택 또는 생성 후 라우팅 규칙 페이지로 이동
    const routingButton = page.locator('[data-testid="routing-rules"], button:has-text("라우팅 규칙")').first();
    if (await routingButton.isVisible()) {
      await routingButton.click();

      // 라우팅 규칙 설정 폼이 있는지 확인
      const rulesForm = page.locator('form').first();
      await expect(rulesForm).toBeVisible();

      // 라우팅 규칙 입력
      await page.fill('input[name="condition"]', 'test_condition');
      await page.fill('input[name="targetServerId"]', 'server_123');
      await page.selectOption('select[name="priority"]', '1');

      // 규칙 저장
      await page.click('button[type="submit"]');

      // 규칙이 목록에 추가되었는지 확인
      await expect(page.locator('text=test_condition')).toBeVisible();
    }
  });

  test('라우팅 규칙 수정', async ({ page }) => {
    await page.goto('/groups');

    const routingButton = page.locator('[data-testid="routing-rules"], button:has-text("라우팅 규칙")').first();
    if (await routingButton.isVisible()) {
      await routingButton.click();

      // 기존 규칙의 수정 버튼 클릭
      await page.click('[data-testid="edit-rule"]:first-child, .edit-button:first');

      // 수정 폼에서 조건 변경
      await page.fill('input[name="condition"]', 'updated_condition');

      // 수정 제출
      await page.click('button[type="submit"]');

      // 수정된 규칙이 반영되었는지 확인
      await expect(page.locator('text=updated_condition')).toBeVisible();
    }
  });

  test('라우팅 규칙 삭제', async ({ page }) => {
    await page.goto('/groups');

    const routingButton = page.locator('[data-testid="routing-rules"], button:has-text("라우팅 규칙")').first();
    if (await routingButton.isVisible()) {
      await routingButton.click();

      // 규칙의 삭제 버튼 클릭
      await page.click('[data-testid="delete-rule"]:first-child, .delete-button:first');

      // 삭제 확인
      await page.click('button:has-text("삭제"), button:has-text("확인")');

      // 규칙이 목록에서 제거되었는지 확인
      await expect(page.locator('text=updated_condition')).not.toBeVisible();
    }
  });

  test('라우팅 규칙 우선순위 평가', async ({ page }) => {
    await page.goto('/groups');

    const routingButton = page.locator('[data-testid="routing-rules"], button:has-text("라우팅 규칙")').first();
    if (await routingButton.isVisible()) {
      await routingButton.click();

      // 여러 규칙이 설정되어 있는지 확인하고 우선순위가 높은 순으로 정렬되어 있는지 확인
      const rules = page.locator('[data-testid="routing-rule-item"], .routing-rule');
      const ruleCount = await rules.count();

      if (ruleCount > 1) {
        // 첫 번째 규칙이 가장 높은 우선순위를 가져야 함
        const firstRule = rules.first();
        await expect(firstRule).toBeVisible();

        // 우선순위 값들을 확인하여 올바른 순서로 정렬되어 있는지 검증
        const priorities = await rules.locator('[data-testid="priority"], .priority').allTextContents();
        for (let i = 1; i < priorities.length; i++) {
          expect(parseInt(priorities[i-1])).toBeGreaterThanOrEqual(parseInt(priorities[i]));
        }
      }
    }
  });
});
