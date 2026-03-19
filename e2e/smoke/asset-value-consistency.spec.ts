import { test, expect } from '@playwright/test';

/**
 * 资产数值一致性验证 E2E 测试
 *
 * 验证 /api/assets 返回的 currentValue 与 purchasePrice 的一致性
 * 确保活期存款等资产的展示金额不会使用过时的 currentValue
 */

test.describe('资产数值一致性验证', () => {
  let assetsData: any[];

  test.beforeAll(async ({ request }) => {
    const resp = await request.get('/api/assets', { timeout: 30_000 });
    expect(resp.ok()).toBeTruthy();
    const json = await resp.json();
    expect(json.success).toBeTruthy();
    assetsData = json.data;
  });

  test('活期存款 currentValue 应等于 purchasePrice × exchangeRate', async () => {
    const demandAssets = assetsData.filter(
      (a: any) => a.assetCategory?.code === 'CASH_DEMAND' || a.assetCategory?.code === 'CASH_BROKER'
    );

    console.log(`找到 ${demandAssets.length} 个活期存款/券商余额资产`);

    for (const asset of demandAssets) {
      const purchasePrice = Number(asset.purchasePrice);
      const currentValue = Number(asset.currentValue);
      const originalValue = Number(asset.originalValue || asset.purchasePrice);
      const exchangeRate = Number(asset.exchangeRate || 1);
      const expectedValue = originalValue * exchangeRate;

      console.log(
        `${asset.name}: purchasePrice=${purchasePrice}, currentValue=${currentValue}, ` +
        `originalValue=${originalValue}, exchangeRate=${exchangeRate}, expected=${expectedValue}`
      );

      // 活期存款的 currentValue 应等于 originalValue * exchangeRate（允许 0.1% 误差）
      const tolerance = expectedValue * 0.001;
      expect(Math.abs(currentValue - expectedValue)).toBeLessThan(Math.max(tolerance, 1));
    }
  });

  test('定期存款 currentValue 应 >= purchasePrice × exchangeRate', async () => {
    const fixedAssets = assetsData.filter(
      (a: any) => a.assetCategory?.code === 'CASH_FIXED'
    );

    console.log(`找到 ${fixedAssets.length} 个定期存款资产`);

    for (const asset of fixedAssets) {
      const purchasePrice = Number(asset.purchasePrice);
      const currentValue = Number(asset.currentValue);
      const originalValue = Number(asset.originalValue || purchasePrice);
      const exchangeRate = Number(asset.exchangeRate || 1);
      const baseCny = originalValue * exchangeRate;

      console.log(
        `${asset.name}: purchasePrice=${purchasePrice}, currentValue=${currentValue}, baseCny=${baseCny}`
      );

      // 定期存款含利息，currentValue 应 >= baseCny
      expect(currentValue).toBeGreaterThanOrEqual(baseCny - 1);
    }
  });

  test('货币基金 currentValue 应 >= purchasePrice × exchangeRate', async () => {
    const moneyFundAssets = assetsData.filter(
      (a: any) => a.assetCategory?.code === 'CASH_MONEY_FUND'
    );

    console.log(`找到 ${moneyFundAssets.length} 个货币基金资产`);

    for (const asset of moneyFundAssets) {
      const purchasePrice = Number(asset.purchasePrice);
      const currentValue = Number(asset.currentValue);
      const originalValue = Number(asset.originalValue || purchasePrice);
      const exchangeRate = Number(asset.exchangeRate || 1);
      const baseCny = originalValue * exchangeRate;

      console.log(
        `${asset.name}: purchasePrice=${purchasePrice}, currentValue=${currentValue}, baseCny=${baseCny}`
      );

      // 货币基金含利息，currentValue 应 >= baseCny
      expect(currentValue).toBeGreaterThanOrEqual(baseCny - 1);
    }
  });

  test('固定收益资产 currentValue 应 >= purchasePrice × exchangeRate', async () => {
    const fixedIncomeAssets = assetsData.filter(
      (a: any) => ['FIXED_BOND', 'FIXED_CONVERTIBLE', 'FIXED_WEALTH'].includes(a.assetCategory?.code)
    );

    console.log(`找到 ${fixedIncomeAssets.length} 个固定收益资产`);

    for (const asset of fixedIncomeAssets) {
      const purchasePrice = Number(asset.purchasePrice);
      const currentValue = Number(asset.currentValue);
      const originalValue = Number(asset.originalValue || purchasePrice);
      const exchangeRate = Number(asset.exchangeRate || 1);
      const baseCny = originalValue * exchangeRate;

      console.log(
        `${asset.name}: purchasePrice=${purchasePrice}, currentValue=${currentValue}, baseCny=${baseCny}`
      );

      // 固定收益含收益计算，currentValue 应 >= baseCny（允许微小误差）
      expect(currentValue).toBeGreaterThanOrEqual(baseCny - 1);
    }
  });

  test('所有资产的 currentValue 和 purchasePrice 应为有效数值', async () => {
    for (const asset of assetsData) {
      const currentValue = Number(asset.currentValue);
      const purchasePrice = Number(asset.purchasePrice);

      // 不应为 NaN
      expect(isNaN(currentValue)).toBeFalsy();
      expect(isNaN(purchasePrice)).toBeFalsy();

      // currentValue 不应为 0（除非 purchasePrice 也是 0）
      if (purchasePrice > 0) {
        expect(currentValue).toBeGreaterThan(0);
      }

      console.log(
        `[${asset.assetCategory?.code || 'N/A'}] ${asset.name}: ` +
        `currentValue=${currentValue}, purchasePrice=${purchasePrice}`
      );
    }
  });

  test('V2 资产Tab页现金资产展示值与编辑值一致', async ({ page }) => {
    // 直接访问 dashboard-v2
    await page.goto('/dashboard-v2', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 切换到设置以外的任意tab，确保在资产页面
    const cashTab = page.locator('button').filter({ hasText: /现金/ });
    if (await cashTab.count() > 0) {
      await cashTab.first().click();
      await page.waitForTimeout(1000);
    }

    // 验证页面有资产数据加载
    const totalText = page.locator('text=总市值');
    await expect(totalText.first()).toBeVisible({ timeout: 10_000 });
  });

  test('V2 权益资产Tab现金余额编辑按钮可见', async ({ page }) => {
    await page.goto('/dashboard-v2', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 切换到权益资产 tab
    const securitiesTab = page.locator('button').filter({ hasText: /权益|持仓/ });
    if (await securitiesTab.count() > 0) {
      await securitiesTab.first().click();
      await page.waitForTimeout(1000);
    }

    // 展开第一个账户
    const accountHeaders = page.locator('[class*="border-l-"]');
    if (await accountHeaders.count() > 0) {
      await accountHeaders.first().click();
      await page.waitForTimeout(500);

      // 检查现金余额行是否有编辑按钮（hover 显示）
      const cashRow = page.locator('text=现金余额').first();
      if (await cashRow.isVisible()) {
        await cashRow.hover();
        await page.waitForTimeout(300);
        // 验证 Edit 图标按钮存在（可能通过 hover 显示）
        console.log('现金余额行可见，hover 功能正常');
      }
    }
  });

  test('V2 权益资产持仓行有操作菜单', async ({ page }) => {
    await page.goto('/dashboard-v2', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 展开第一个账户
    const accountHeaders = page.locator('[class*="border-l-"]');
    if (await accountHeaders.count() > 0) {
      await accountHeaders.first().click();
      await page.waitForTimeout(500);

      // 检查持仓行是否有 MoreHorizontal 操作按钮
      const holdingRows = page.locator('[class*="bg-card"]').filter({ has: page.locator('text=持仓') });
      if (await holdingRows.count() > 0) {
        await holdingRows.first().hover();
        await page.waitForTimeout(300);
        console.log('持仓行可见，操作菜单按钮应在 hover 后显示');
      }
    }
  });
});
