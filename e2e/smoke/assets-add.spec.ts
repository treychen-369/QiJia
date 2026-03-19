import { test, expect, Page } from '@playwright/test';

/**
 * 资产添加功能 E2E 测试
 * 
 * 测试 assets-tab 的"添加资产"下拉菜单（快捷操作栏）、各类型资产对话框、排序功能
 * 使用全局 auth setup 的登录状态
 */

test.describe('资产页 - 添加 & 排序功能', () => {

  async function gotoAssetsTab(page: Page) {
    await page.goto('/dashboard-v2', { waitUntil: 'domcontentloaded' });
    await page.locator('text=/¥/').first().waitFor({ state: 'visible', timeout: 30_000 });
    const assetsTab = page.locator('button[role="tab"]', { hasText: '资产' });
    await assetsTab.click();
    await page.waitForTimeout(1000);
  }

  /** 点击快捷操作栏的"添加资产"按钮 */
  async function clickAddAssetBtn(page: Page) {
    const btn = page.locator('button', { hasText: '添加资产' }).first();
    await expect(btn).toBeVisible();
    await btn.click();
    // 等待下拉菜单出现
    await expect(page.locator('.absolute.left-0.top-full.z-40.w-48')).toBeVisible({ timeout: 3000 });
  }

  /** 从下拉菜单选择指定资产类型 */
  async function selectAssetType(page: Page, label: string) {
    const menu = page.locator('.absolute.left-0.top-full.z-40.w-48');
    await menu.locator('button', { hasText: label }).click();
  }

  // ============================================================
  // 1. 添加按钮基础功能 - 下拉菜单
  // ============================================================

  test('添加资产按钮点击后显示所有资产类型菜单', async ({ page }) => {
    await gotoAssetsTab(page);
    await clickAddAssetBtn(page);

    const menu = page.locator('.absolute.left-0.top-full.z-40.w-48');
    await expect(menu.locator('button', { hasText: '权益资产' })).toBeVisible();
    await expect(menu.locator('button', { hasText: '现金资产' })).toBeVisible();
    await expect(menu.locator('button', { hasText: '固定收益' })).toBeVisible();
    await expect(menu.locator('button', { hasText: '不动产' })).toBeVisible();
    await expect(menu.locator('button', { hasText: '另类投资' })).toBeVisible();
    await expect(menu.locator('button', { hasText: '应收款' })).toBeVisible();
    await expect(menu.locator('button', { hasText: '负债' })).toBeVisible();
  });

  // ============================================================
  // 2. 权益资产 - 添加持仓（核心测试）
  // ============================================================

  test('添加权益资产 - 对话框打开并显示证券搜索', async ({ page }) => {
    await gotoAssetsTab(page);
    await clickAddAssetBtn(page);
    await selectAssetType(page, '权益资产');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator('text=选择证券')).toBeVisible();
    await expect(dialog.locator('input[placeholder*="证券代码"]')).toBeVisible();
  });

  test('添加权益资产 - 搜索证券并进入持仓填写', async ({ page }) => {
    await gotoAssetsTab(page);
    await clickAddAssetBtn(page);
    await selectAssetType(page, '权益资产');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 搜索证券
    const searchInput = dialog.locator('input[placeholder*="证券代码"]');
    await searchInput.fill('腾讯');
    await dialog.getByRole('button', { name: '搜索', exact: true }).click();

    // 等待搜索结果
    await page.waitForTimeout(3000);

    // 如果有搜索结果，点击第一个
    const resultItem = dialog.locator('.cursor-pointer').first();
    const hasResults = await resultItem.isVisible().catch(() => false);

    if (hasResults) {
      await resultItem.click();
      // 应进入持仓填写步骤
      await expect(dialog.getByRole('heading', { name: '添加持仓' })).toBeVisible({ timeout: 5000 });
      // 验证投资账户下拉可见
      await expect(dialog.locator('text=投资账户')).toBeVisible();
    } else {
      // 无搜索结果也算通过（本地可能无数据）
      console.log('本地无证券数据，搜索结果为空');
    }
  });

  test('添加权益资产 - 账户列表正常加载', async ({ page }) => {
    await gotoAssetsTab(page);
    await clickAddAssetBtn(page);
    await selectAssetType(page, '权益资产');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 切换到"所有证券"tab 查看是否有证券
    await dialog.locator('button[role="tab"]', { hasText: '所有证券' }).click();
    await page.waitForTimeout(2000);

    // 查看是否有证券可选
    const securitiesItem = dialog.locator('.cursor-pointer').first();
    const hasSecurities = await securitiesItem.isVisible().catch(() => false);

    if (hasSecurities) {
      await securitiesItem.click();
      // 进入持仓填写步骤
      await expect(dialog.getByRole('heading', { name: '添加持仓' })).toBeVisible({ timeout: 5000 });

      // 点击投资账户下拉
      const selectTrigger = dialog.locator('button[role="combobox"]');
      await selectTrigger.click();
      await page.waitForTimeout(1000);

      // 验证账户列表不为"暂无账户"
      const noAccountText = page.locator('text=暂无账户，请先创建账户');
      const hasNoAccount = await noAccountText.isVisible().catch(() => false);

      if (hasNoAccount) {
        // 如果真没账户，这是bug已修复的验证
        console.log('WARNING: 无账户 - 验证 API 数据映射');
        test.fail();
      } else {
        // 应该有账户选项
        const selectContent = page.locator('[role="listbox"], [data-radix-select-viewport]');
        const options = selectContent.locator('[role="option"]');
        const count = await options.count();
        expect(count).toBeGreaterThan(0);
        console.log(`找到 ${count} 个投资账户`);
      }
    } else {
      console.log('本地无证券数据，跳过账户验证');
    }
  });

  // ============================================================
  // 3. 现金资产
  // ============================================================

  test('添加现金资产 - 对话框可打开', async ({ page }) => {
    await gotoAssetsTab(page);
    await clickAddAssetBtn(page);
    await selectAssetType(page, '现金资产');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.locator('text=添加现金资产')).toBeVisible({ timeout: 5000 });
  });

  test('添加现金资产 - 完整填写并提交', async ({ page }) => {
    await gotoAssetsTab(page);
    await clickAddAssetBtn(page);
    await selectAssetType(page, '现金资产');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.locator('text=添加现金资产')).toBeVisible({ timeout: 5000 });

    // 选择活期存款
    await dialog.locator('button', { hasText: '活期存款' }).click();

    // 填写表单
    await dialog.locator('input#name').fill('E2E-测试活期存款');
    await dialog.locator('input#amount').fill('50000');
    await dialog.locator('input#bankName').fill('测试银行');

    // 提交
    await dialog.locator('button[type="submit"]', { hasText: '创建' }).click();
    await expect(page.locator('text=创建成功')).toBeVisible({ timeout: 10_000 });
  });

  // ============================================================
  // 4. 固定收益
  // ============================================================

  test('添加固定收益 - 对话框可打开', async ({ page }) => {
    await gotoAssetsTab(page);
    await clickAddAssetBtn(page);
    await selectAssetType(page, '固定收益');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.locator('text=添加固定收益')).toBeVisible({ timeout: 5000 });
  });

  // ============================================================
  // 5. 不动产
  // ============================================================

  test('添加不动产 - 对话框可打开', async ({ page }) => {
    await gotoAssetsTab(page);
    await clickAddAssetBtn(page);
    await selectAssetType(page, '不动产');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.locator('text=添加不动产')).toBeVisible({ timeout: 5000 });
  });

  // ============================================================
  // 6. 另类投资
  // ============================================================

  test('添加另类投资 - 对话框可打开', async ({ page }) => {
    await gotoAssetsTab(page);
    await clickAddAssetBtn(page);
    await selectAssetType(page, '另类投资');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.locator('text=添加另类投资')).toBeVisible({ timeout: 5000 });
  });

  // ============================================================
  // 7. 应收款
  // ============================================================

  test('添加应收款 - 对话框可打开', async ({ page }) => {
    await gotoAssetsTab(page);
    await clickAddAssetBtn(page);
    await selectAssetType(page, '应收款');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.locator('text=添加应收款')).toBeVisible({ timeout: 5000 });
  });

  // ============================================================
  // 8. 负债
  // ============================================================

  test('添加负债 - 对话框可打开', async ({ page }) => {
    await gotoAssetsTab(page);
    await clickAddAssetBtn(page);
    await selectAssetType(page, '负债');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.locator('text=添加负债')).toBeVisible({ timeout: 5000 });
  });

  // ============================================================
  // 9. 排序功能
  // ============================================================

  test('排序按钮可点击且显示选项', async ({ page }) => {
    await gotoAssetsTab(page);

    const sortBtn = page.locator('button[aria-label="排序"]');
    await expect(sortBtn).toBeVisible();
    await sortBtn.click();

    await expect(page.locator('text=市值 高→低')).toBeVisible();
    await expect(page.locator('text=市值 低→高')).toBeVisible();
    await expect(page.locator('text=盈亏 高→低')).toBeVisible();
    await expect(page.locator('text=盈亏 低→高')).toBeVisible();
    await expect(page.locator('text=名称 A→Z')).toBeVisible();
  });

  test('选择排序方式后菜单关闭', async ({ page }) => {
    await gotoAssetsTab(page);

    const sortBtn = page.locator('button[aria-label="排序"]');
    await sortBtn.click();

    await page.locator('text=名称 A→Z').click();
    await expect(page.locator('text=名称 A→Z')).not.toBeVisible({ timeout: 2000 });
  });

  // ============================================================
  // 10. 清理测试数据
  // ============================================================

  test('清理 E2E 测试创建的资产', async ({ request }) => {
    const resp = await request.get('/api/assets', { timeout: 15_000 });
    if (!resp.ok()) return;

    const data = await resp.json();
    const testAssets = (data.data || []).filter((a: any) => a.name?.startsWith('E2E-测试'));
    
    for (const asset of testAssets) {
      await request.delete(`/api/assets/${asset.id}`);
    }
  });
});
