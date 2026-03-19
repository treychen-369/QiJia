import { Page, expect } from '@playwright/test';

/**
 * E2E 测试工具函数
 */

/** 等待页面加载完成（无网络请求 500ms） */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}

/** 等待 toast 消息出现并验证内容 */
export async function expectToast(page: Page, text: string) {
  const toast = page.locator('[role="status"]').filter({ hasText: text });
  await expect(toast).toBeVisible({ timeout: 10_000 });
}

/** 截图并保存（用于调试） */
export async function takeDebugScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `e2e/screenshots/${name}-${Date.now()}.png`,
    fullPage: true,
  });
}

/** 等待 API 请求完成 */
export async function waitForAPI(page: Page, urlPattern: string | RegExp) {
  return page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern) && response.status() === 200;
      }
      return urlPattern.test(url) && response.status() === 200;
    },
    { timeout: 15_000 }
  );
}

/** 获取页面中所有可见的错误信息 */
export async function getVisibleErrors(page: Page): Promise<string[]> {
  const errors = await page.locator('.text-red-500, .text-destructive, [role="alert"]').allTextContents();
  return errors.filter(Boolean);
}

/** 模拟慢网络（用于测试 loading 状态） */
export async function simulateSlowNetwork(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: 50 * 1024, // 50kb/s
    uploadThroughput: 50 * 1024,
    latency: 2000,
  });
}
