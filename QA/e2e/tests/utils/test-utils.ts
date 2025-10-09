import { Page } from '@playwright/test';

export class TestUtils {
  constructor(private page: Page) {}

  /**
   * 테스트용 사용자 생성 및 로그인
   */
  async createTestUserAndLogin(email = 'test@example.com', password = 'password123') {
    await this.page.goto('/login');

    // 회원가입 페이지로 이동
    await this.page.click('text=새 계정 만들기');
    await this.page.fill('input[name="username"]', 'testuser');
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.fill('input[name="confirmPassword"]', password);
    await this.page.click('button[type="submit"]');

    // 로그인
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.click('button[type="submit"]');

    // 대시보드로 이동 확인
    await this.page.waitForURL('/dashboard');
  }

  /**
   * 로그인 상태 확인
   */
  async verifyLoggedIn() {
    await this.page.waitForURL('/dashboard');
    // 대시보드의 특정 요소가 있는지 확인
    await this.page.waitForSelector('h1, h2, [data-testid="dashboard"]');
  }

  /**
   * API 호출 헬퍼 함수
   */
  async makeApiCall(endpoint: string, method = 'GET', body?: any, token?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await this.page.request[method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](
      `http://localhost:3000${endpoint}`,
      {
        headers,
        data: body,
      }
    );

    return response;
  }

  /**
   * JWT 토큰 추출
   */
  async getAuthToken() {
    // 실제 구현에서는 localStorage에서 토큰을 가져와야 함
    // Playwright에서는 page.evaluate를 사용
    return await this.page.evaluate(() => {
      return localStorage.getItem('auth-storage');
    });
  }

  /**
   * 서버 등록 헬퍼 함수
   */
  async createTestServer(name = '테스트 서버', protocol = 'stdio') {
    await this.page.goto('/servers');

    await this.page.fill('input[name="name"]', name);
    await this.page.fill('input[name="protocol"]', protocol);
    await this.page.fill('textarea[name="config"]', JSON.stringify({
      command: 'node',
      args: ['test-server.js']
    }));

    await this.page.click('button[type="submit"]');
    await this.page.waitForSelector('.success, [data-testid="server-created"]');
  }

  /**
   * 대기 시간 동안 페이지가 특정 상태를 유지하는지 확인
   */
  async waitAndVerifyStableState(timeout = 3000) {
    const initialUrl = this.page.url();
    await this.page.waitForTimeout(timeout);
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForURL(initialUrl);
  }

  /**
   * 에러 메시지 확인
   */
  async expectErrorMessage(message?: string) {
    const errorElement = this.page.locator('.error, .text-red-600, [data-testid="error"]');
    await errorElement.waitFor({ state: 'visible' });

    if (message) {
      await errorElement.filter({ hasText: message }).waitFor();
    }
  }

  /**
   * 성공 메시지 확인
   */
  async expectSuccessMessage(message?: string) {
    const successElement = this.page.locator('.success, .text-green-600, [data-testid="success"]');
    await successElement.waitFor({ state: 'visible' });

    if (message) {
      await successElement.filter({ hasText: message }).waitFor();
    }
  }
}
