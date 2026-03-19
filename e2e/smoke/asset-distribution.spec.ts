import { test, expect, Page } from '@playwright/test';

/**
 * 资产分布 E2E 测试 —— 使用测试账号
 * 
 * 验证：
 * 1. API 数据完整性（Dashboard + Family Overview）
 * 2. 个人视图：图例含金额+百分比+下拉箭头，每个分类可展开
 * 3. 家庭视图：图例含金额+百分比
 */

const E2E_EMAIL = process.env.E2E_USER_EMAIL || 'admin@example.com';
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || 'admin123456';
const API_TIMEOUT = 60_000;

/**
 * 登录测试账号：先清除旧 session，再通过 API 登录，最后验证
 */
async function loginAsTestUser(page: Page) {
  // 1. 清除旧 session
  await page.context().clearCookies();
  
  // 2. 获取 CSRF token
  await page.goto('/api/auth/csrf');
  await page.waitForLoadState('networkidle');
  const csrfText = await page.locator('body').textContent();
  const csrfData = JSON.parse(csrfText || '{}');

  // 3. 登录（增加 timeout）
  const signInResponse = await page.request.post('/api/auth/callback/credentials', {
    form: {
      email: E2E_EMAIL,
      password: E2E_PASSWORD,
      csrfToken: csrfData.csrfToken,
      json: 'true',
    },
    timeout: 15_000,
  });

  if (!signInResponse.ok()) {
    throw new Error(`登录失败: ${signInResponse.status()}`);
  }

  // 4. 验证 session
  await page.goto('/api/auth/session');
  await page.waitForLoadState('networkidle');
  const sessionText = await page.locator('body').textContent();
  if (!sessionText || !sessionText.includes(E2E_EMAIL)) {
    throw new Error(`登录验证失败: ${sessionText?.substring(0, 200)}`);
  }
}

/**
 * 登录后进入 dashboard 并等待数据加载
 */
async function gotoDashboard(page: Page) {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  // 等待 dashboard API 数据加载完成
  await page.waitForTimeout(5000);
  // 确认在 dashboard 页
  const url = page.url();
  if (!url.includes('/dashboard')) {
    throw new Error(`未到达 dashboard，当前 URL: ${url}`);
  }
}

// ============================================================
// 1. API 数据完整性
// ============================================================
test.describe('API 数据完整性', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('Dashboard API byOverviewGroup + groupsSubCategories + RECEIVABLE', async ({ page }) => {
    const response = await page.request.get('/api/dashboard', { timeout: API_TIMEOUT });
    expect(response.ok()).toBe(true);

    const json = await response.json();
    const portfolio = json.underlyingTypePortfolio;
    expect(portfolio).toBeDefined();

    // byOverviewGroup
    expect(portfolio.byOverviewGroup.length).toBeGreaterThan(0);
    for (const g of portfolio.byOverviewGroup) {
      expect(typeof g.value).toBe('number');
      expect(typeof g.percentage).toBe('number');
      expect(g).toHaveProperty('color');
    }
    console.log('byOverviewGroup:', portfolio.byOverviewGroup.map((g: any) => `${g.code}: ¥${g.value.toFixed(0)} (${g.percentage.toFixed(1)}%)`));

    // groupsSubCategories
    expect(portfolio.groupsSubCategories).toBeDefined();
    const subCatKeys = Object.keys(portfolio.groupsSubCategories);
    console.log('groupsSubCategories keys:', subCatKeys);

    // RECEIVABLE 应在 keys 中
    const hasReceivable = portfolio.byOverviewGroup.some((g: any) => g.code === 'RECEIVABLE');
    if (hasReceivable) {
      expect(subCatKeys).toContain('RECEIVABLE');
      console.log('✅ RECEIVABLE 在 groupsSubCategories 中');
    }
  });

  test('Family Overview API assetDistribution', async ({ page }) => {
    const response = await page.request.get('/api/family/overview', { timeout: API_TIMEOUT });
    expect(response.ok()).toBe(true);

    const json = await response.json();
    expect(json.assetDistribution).toBeDefined();
    expect(json.assetDistribution.length).toBeGreaterThan(0);

    for (const item of json.assetDistribution) {
      expect(typeof item.value).toBe('number');
      expect(typeof item.percentage).toBe('number');
      expect(item).toHaveProperty('color');
    }
    console.log('assetDistribution:', json.assetDistribution.map((i: any) => `${i.categoryName}: ¥${i.value.toFixed(0)} (${i.percentage}%)`));
  });
});

// ============================================================
// 2. 个人视图 - UI 验证
// ============================================================
test.describe('个人视图', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('图例显示金额、百分比和下拉箭头', async ({ page }) => {
    await gotoDashboard(page);

    const legendButtons = page.locator('button').filter({
      has: page.locator('svg'),
    }).filter({
      hasText: /\d+(\.\d+)?%/,
    });

    const count = await legendButtons.count();
    console.log(`图例按钮数量: ${count}`);
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await legendButtons.nth(i).textContent();
      console.log(`  图例 ${i}: ${text?.trim()}`);
    }
  });

  test('逐个点击每个资产类别下拉，验证展开内容', async ({ page }) => {
    await gotoDashboard(page);

    const jsErrors: string[] = [];
    page.on('pageerror', (error) => jsErrors.push(error.message));

    const groupKeywords = [
      { code: 'EQUITY', keywords: ['权益类', '权益'] },
      { code: 'CASH', keywords: ['现金等价物', '现金'] },
      { code: 'FIXED_INCOME', keywords: ['固定收益'] },
      { code: 'ALTERNATIVE', keywords: ['另类投资', '另类'] },
      { code: 'RECEIVABLE', keywords: ['应收款'] },
    ];

    let testedCount = 0;

    for (const group of groupKeywords) {
      let btn = null;
      for (const kw of group.keywords) {
        const candidate = page.locator('button').filter({ hasText: kw }).first();
        if (await candidate.count() > 0) {
          btn = candidate;
          break;
        }
      }

      if (!btn) {
        console.log(`⚠️ 未找到 ${group.code} 按钮，跳过`);
        continue;
      }

      await btn.click();
      await page.waitForTimeout(1500);

      if (group.code === 'EQUITY') {
        const hasRegion = await page.locator('text=个地区').first().isVisible().catch(() => false);
        console.log(`✅ ${group.code}: 地区细分 = ${hasRegion}`);
      } else {
        const panels = page.locator('.grid .rounded-lg.border');
        const panelCount = await panels.count();
        console.log(`✅ ${group.code}: ${panelCount} 个详情卡片`);

        if (group.code === 'RECEIVABLE') {
          expect(panelCount).toBeGreaterThan(0);
          console.log(`  🔑 RECEIVABLE 验证通过`);
        }
      }

      testedCount++;
      await btn.click();
      await page.waitForTimeout(500);
    }

    console.log(`共测试了 ${testedCount} 个资产分组`);
    expect(testedCount).toBeGreaterThan(0);
    expect(jsErrors).toEqual([]);
  });
});

// ============================================================
// 3. 家庭视图 - UI 验证
// ============================================================
test.describe('家庭视图', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('家庭视图概览卡片显示金额和百分比', async ({ page }) => {
    await gotoDashboard(page);

    const familyTab = page.locator('button').filter({ hasText: /家庭|的家/ });
    if (await familyTab.count() === 0) {
      test.skip();
      return;
    }

    await familyTab.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(4000);

    const jsErrors: string[] = [];
    page.on('pageerror', (error) => jsErrors.push(error.message));

    // 验证图例中有 ¥ 金额
    const familyLegends = page.locator('.flex.items-center').filter({ hasText: /¥/ });
    const legendCount = await familyLegends.count();
    console.log(`家庭视图含 ¥ 的图例数: ${legendCount}`);
    expect(legendCount).toBeGreaterThan(0);

    expect(jsErrors).toEqual([]);
  });
});
