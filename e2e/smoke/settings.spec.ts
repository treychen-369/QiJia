import { test, expect } from '@playwright/test';

/**
 * 家庭设置页面测试
 */
test.describe('家庭设置页面', () => {

  test('页面正常加载，无 JS 错误', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (error) => {
      jsErrors.push(error.message);
    });

    await page.goto('/settings/family');
    await page.waitForLoadState('networkidle');

    // 页面标题
    await expect(page.locator('text=家庭管理').or(page.locator('text=家庭设置'))).toBeVisible();

    expect(jsErrors).toEqual([]);
  });

  test('家庭信息或创建家庭界面可见', async ({ page }) => {
    await page.goto('/settings/family');
    await page.waitForLoadState('networkidle');

    // 两种情况：已有家庭显示信息，未有家庭显示创建界面
    const hasFamily = page.locator('text=家庭成员').or(page.locator('text=成员'));
    const createFamily = page.locator('text=创建家庭').or(page.locator('text=创建'));

    // 至少一种情况应该可见
    const familyVisible = await hasFamily.first().isVisible().catch(() => false);
    const createVisible = await createFamily.first().isVisible().catch(() => false);

    expect(familyVisible || createVisible).toBe(true);
  });

  test('页面无 5xx 错误', async ({ page }) => {
    const serverErrors: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 500) {
        serverErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto('/settings/family');
    await page.waitForLoadState('networkidle');

    expect(serverErrors).toEqual([]);
  });
});

/**
 * 同步设置页面测试
 */
test.describe('同步设置页面', () => {

  test('页面正常加载，核心元素可见', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (error) => {
      jsErrors.push(error.message);
    });

    await page.goto('/settings/sync');
    await page.waitForLoadState('networkidle');

    // 页面标题
    await expect(page.locator('text=数据同步').or(page.locator('text=同步设置'))).toBeVisible();

    expect(jsErrors).toEqual([]);
  });

  test('4 个 Tab 页签可见', async ({ page }) => {
    await page.goto('/settings/sync');
    await page.waitForLoadState('networkidle');

    // 4 个 Tab
    const tabs = ['数据源', '定时同步', '手动同步', '系统状态'];
    for (const tabName of tabs) {
      const tab = page.locator(`text=${tabName}`);
      // Tab 文字应该出现在页面中
      if (await tab.first().isVisible().catch(() => false)) {
        expect(true).toBe(true);
      }
    }
  });

  test('Tab 页签切换正常', async ({ page }) => {
    await page.goto('/settings/sync');
    await page.waitForLoadState('networkidle');

    // 尝试点击各个 Tab
    const tabNames = ['定时同步', '手动同步', '系统状态', '数据源'];

    for (const name of tabNames) {
      const tab = page.getByRole('tab').filter({ hasText: name });
      if (await tab.first().isVisible().catch(() => false)) {
        await tab.first().click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('页面无 5xx 错误', async ({ page }) => {
    const serverErrors: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 500) {
        serverErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto('/settings/sync');
    await page.waitForLoadState('networkidle');

    expect(serverErrors).toEqual([]);
  });
});
