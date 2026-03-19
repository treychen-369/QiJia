import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

// 使用环境变量获取测试账号凭据
const E2E_EMAIL = process.env.E2E_USER_EMAIL || 'admin@example.com';
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || 'admin123456';

/**
 * 全局认证 Setup
 * 
 * 在所有测试之前执行一次：
 * 1. 通过 page.request 登录（cookies 自动同步到 browser context）
 * 2. 验证 session 有效
 * 3. 保存完整 cookie/session 状态到 user.json
 * 后续所有测试直接复用这个登录状态，无需重新登录。
 */
setup('登录并保存认证状态', async ({ page }) => {
  // 1. 用 page.request（非独立 request fixture）确保 cookies 同步到 browser context
  const csrfResponse = await page.request.get('/api/auth/csrf');
  const csrfData = await csrfResponse.json();

  const signInResponse = await page.request.post('/api/auth/callback/credentials', {
    form: {
      email: E2E_EMAIL,
      password: E2E_PASSWORD,
      csrfToken: csrfData.csrfToken,
      json: 'true',
    },
  });

  if (!signInResponse.ok()) {
    const body = await signInResponse.text();
    throw new Error(`登录失败: status=${signInResponse.status()}, body=${body}`);
  }

  // 2. 验证 session — 导航到 session endpoint 确认 cookies 生效
  await page.goto('/api/auth/session');
  await page.waitForLoadState('domcontentloaded');
  const sessionText = await page.locator('body').textContent();
  
  if (!sessionText || !sessionText.includes(E2E_EMAIL)) {
    throw new Error(`登录验证失败: session=${sessionText?.substring(0, 300)}`);
  }

  // 3. 保存完整认证状态（含 session-token cookie）
  await page.context().storageState({ path: authFile });
});
