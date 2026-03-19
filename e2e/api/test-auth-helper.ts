/**
 * E2E 测试认证辅助工具
 * 
 * 提供测试用户登录功能，返回带认证 cookie 的 API request context。
 */

import { APIRequestContext } from '@playwright/test';

export const E2E_TEST_EMAIL = 'e2e-test-user@finance.test';
export const E2E_TEST_EMAIL_2 = 'e2e-test-user2@finance.test';
export const E2E_TEST_PASSWORD = 'test123456';

/**
 * 用指定邮箱登录，返回认证后的 request context cookies
 */
export async function loginAsUser(
  request: APIRequestContext,
  email: string = E2E_TEST_EMAIL,
  password: string = E2E_TEST_PASSWORD
): Promise<void> {
  // 获取 CSRF token
  const csrfResponse = await request.get('/api/auth/csrf');
  const csrfData = await csrfResponse.json();
  const csrfToken = csrfData.csrfToken;

  // 登录
  const signInResponse = await request.post('/api/auth/callback/credentials', {
    form: {
      email,
      password,
      csrfToken,
      json: 'true',
    },
  });

  if (!signInResponse.ok()) {
    throw new Error(`登录失败: ${email}, status=${signInResponse.status()}`);
  }
}
