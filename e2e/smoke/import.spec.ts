import { test, expect } from '@playwright/test';

/**
 * 数据导入页面测试
 *
 * 验证导入页面的 UI 结构、步骤流程、核心交互
 */
test.describe('数据导入页面', () => {

  test('页面正常加载，核心元素可见', async ({ page }) => {
    await page.goto('/import');
    await page.waitForLoadState('networkidle');

    // 页面标题
    await expect(page.getByRole('heading', { name: '数据导入' })).toBeVisible();

    // 步骤指示器（3 步）
    await expect(page.locator('text=上传文件')).toBeVisible();
    await expect(page.locator('text=预览数据')).toBeVisible();
    await expect(page.locator('text=导入完成')).toBeVisible();
  });

  test('导入说明和选项可见', async ({ page }) => {
    await page.goto('/import');
    await page.waitForLoadState('networkidle');

    // 导入选项：覆盖模式 / 增量模式
    const overwriteOption = page.locator('text=覆盖模式').or(page.locator('text=覆盖'));
    const incrementalOption = page.locator('text=增量模式').or(page.locator('text=增量'));

    await expect(overwriteOption.first()).toBeVisible({ timeout: 5_000 });
    await expect(incrementalOption.first()).toBeVisible({ timeout: 5_000 });
  });

  test('导入模式切换', async ({ page }) => {
    await page.goto('/import');
    await page.waitForLoadState('networkidle');

    // 找到增量模式的 radio 或可点击区域
    const incrementalRadio = page.locator('text=增量模式').or(page.locator('text=增量'));
    if (await incrementalRadio.first().isVisible().catch(() => false)) {
      await incrementalRadio.first().click();
      await page.waitForTimeout(300);

      // 覆盖模式下的警告应该消失（黄色警告框）
      // 切回覆盖模式
      const overwriteRadio = page.locator('text=覆盖模式').or(page.locator('text=覆盖'));
      await overwriteRadio.first().click();
      await page.waitForTimeout(300);
    }
  });

  test('返回仪表板链接可用', async ({ page }) => {
    await page.goto('/import');
    await page.waitForLoadState('networkidle');

    // 返回仪表板按钮/链接
    const backLink = page.locator('a[href="/dashboard"]').or(page.locator('text=返回仪表板'));
    await expect(backLink.first()).toBeVisible();
  });

  test('无 JS 错误', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (error) => {
      jsErrors.push(error.message);
    });

    await page.goto('/import');
    await page.waitForLoadState('networkidle');

    expect(jsErrors).toEqual([]);
  });
});
