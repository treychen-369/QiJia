import { test, expect } from '@playwright/test';

/**
 * 页面导航冒烟测试
 * 
 * 验证主要页面都能正常加载，无崩溃
 */
test.describe('核心页面导航', () => {

  const pages = [
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/import', name: '数据导入' },
    { path: '/settings/family', name: '家庭设置' },
    { path: '/settings/sync', name: '同步设置' },
  ];

  for (const { path, name } of pages) {
    test(`${name} 页面 (${path}) 正常加载`, async ({ page }) => {
      // 收集错误
      const jsErrors: string[] = [];
      page.on('pageerror', (error) => {
        jsErrors.push(error.message);
      });

      // 监听失败的请求
      const failedRequests: string[] = [];
      page.on('response', (response) => {
        if (response.status() >= 500) {
          failedRequests.push(`${response.status()} ${response.url()}`);
        }
      });

      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // 1. 页面不应有 JS 错误
      expect(jsErrors, `${name} 页面存在 JS 错误`).toEqual([]);

      // 2. 不应有 5xx 服务端错误
      expect(failedRequests, `${name} 页面存在服务端错误`).toEqual([]);

      // 3. 页面应该有内容（不是空白）
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.length, `${name} 页面内容为空`).toBeGreaterThan(50);
    });
  }
});
