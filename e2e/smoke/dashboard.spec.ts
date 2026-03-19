import { test, expect } from '@playwright/test';

/**
 * Dashboard 页面冒烟测试
 * 
 * 使用全局认证状态（已登录）
 */
test.describe('Dashboard 页面', () => {

  test('页面正常加载，无 JS 错误', async ({ page }) => {
    // 收集页面上的 JS 错误
    const jsErrors: string[] = [];
    page.on('pageerror', (error) => {
      jsErrors.push(error.message);
    });

    await page.goto('/dashboard');

    // storageState 偶尔会有延迟加载，如果被重定向到首页则重新导航
    if (!page.url().includes('/dashboard')) {
      await page.waitForTimeout(1_000);
      await page.goto('/dashboard');
    }

    await page.waitForLoadState('networkidle');

    // 页面应该正常加载
    await expect(page).toHaveURL(/.*dashboard/);

    // 不应有 JS 错误
    expect(jsErrors).toEqual([]);
  });

  test('Dashboard 显示核心数据区域', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 页面中应包含关键内容（不硬编码具体文字，检查结构）
    // 检查页面不是空白或错误状态
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);

    // 不应该显示"未授权"或"错误"类的异常状态
    expect(bodyText).not.toContain('未授权');
    expect(bodyText).not.toContain('Unauthorized');
  });

  test('Dashboard API 请求成功', async ({ page }) => {
    // 监听关键 API 请求
    const apiResponses: { url: string; status: number }[] = [];
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/')) {
        apiResponses.push({ url, status: response.status() });
      }
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 至少应该有一些 API 调用
    expect(apiResponses.length).toBeGreaterThan(0);

    // 所有 API 应该返回成功（2xx）或可接受的状态
    const failedAPIs = apiResponses.filter(
      (r) => r.status >= 500
    );
    expect(failedAPIs).toEqual([]);
  });

  test('Dashboard 无控制台错误', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // 忽略一些常见的无害错误
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('hydration')) {
          consoleErrors.push(text);
        }
      }
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 不应有严重的控制台错误
    expect(consoleErrors).toEqual([]);
  });
});
