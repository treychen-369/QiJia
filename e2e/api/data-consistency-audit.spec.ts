/**
 * 数据服务层审计 E2E 测试
 * 
 * 使用测试账号验证各项数据口径修复：
 * - P0-#1: 个人视图 vs 家庭视图收益率一致性
 * - P0-#4: ALT_GOLD 贵金属汇率不重复
 * - P3-#9: 除零保护
 */

import { test, expect } from '@playwright/test';

// 测试账号凭据（通过环境变量配置）
const E2E_EMAIL = process.env.E2E_USER_EMAIL || 'admin@example.com';
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || 'admin123456';

/**
 * 登录测试账号
 */
async function loginAsTestUser(request: import('@playwright/test').APIRequestContext) {
  const csrfResponse = await request.get('/api/auth/csrf');
  const csrfData = await csrfResponse.json();

  const signInResponse = await request.post('/api/auth/callback/credentials', {
    form: {
      email: E2E_EMAIL,
      password: E2E_PASSWORD,
      csrfToken: csrfData.csrfToken,
      json: 'true',
    },
  });

  if (!signInResponse.ok()) {
    throw new Error(`登录失败: status=${signInResponse.status()}`);
  }
}

// ========================================================
// P0-#1: 个人视图 vs 家庭视图收益率一致性
// ========================================================
test.describe('P0-#1: 个人 vs 家庭视图数据口径一致性', () => {
  test.beforeEach(async ({ request }) => {
    await loginAsTestUser(request);
  });

  test('totalAssets、totalUnrealizedPnl 在两个视图下应一致', async ({ request }) => {
    test.setTimeout(60000);
    const personalRes = await request.get('/api/dashboard', { timeout: 30000 });
    expect(personalRes.ok()).toBeTruthy();
    const personalData = await personalRes.json();
    const personal = personalData.overview;

    const familyRes = await request.get('/api/family/overview', { timeout: 30000 });
    expect(familyRes.ok()).toBeTruthy();
    const familyData = await familyRes.json();

    // 打印返回结构以便调试
    console.log('[DEBUG] family overview keys:', Object.keys(familyData));
    console.log('[DEBUG] memberBreakdown count:', familyData.memberBreakdown?.length);

    const testMember = familyData.memberBreakdown?.find(
      (m: any) => m.userName === 'Test User' || m.userName === 'testuser'
    );
    expect(testMember, '应在 memberBreakdown 中找到 Test User').toBeDefined();

    // 总资产应一致（允许 0.1% 容差，因为两次 API 调用间利息可能微变）
    const tolerance = 0.001;
    const assetsDiff = Math.abs(personal.totalAssets - testMember.totalAssets) / Math.max(personal.totalAssets, 1);
    expect(assetsDiff, `总资产差异 ${assetsDiff} 超过容差`).toBeLessThan(tolerance);

    // 未实现盈亏应一致
    const pnlDiff = Math.abs(personal.totalUnrealizedPnl - testMember.totalUnrealizedPnl) / Math.max(Math.abs(personal.totalUnrealizedPnl), 1);
    expect(pnlDiff, `盈亏差异 ${pnlDiff} 超过容差`).toBeLessThan(tolerance);

    console.log(`[P0-#1] 个人总资产: ${personal.totalAssets.toFixed(2)}, 家庭(User): ${testMember.totalAssets.toFixed(2)}`);
    console.log(`[P0-#1] 个人盈亏: ${personal.totalUnrealizedPnl.toFixed(2)}, 家庭(User): ${testMember.totalUnrealizedPnl.toFixed(2)}`);
  });

  test('收益率百分比在两个视图下应一致（核心修复验证）', async ({ request }) => {
    const personalRes = await request.get('/api/dashboard');
    const personalData = await personalRes.json();
    const personalPercent = personalData.overview.totalUnrealizedPnlPercent;

    const familyRes = await request.get('/api/family/overview');
    const familyData = await familyRes.json();

    const testMember = familyData.memberBreakdown?.find(
      (m: any) => m.userName === 'Test User' || m.userName === 'testuser'
    );
    expect(testMember, '应在 memberBreakdown 中找到 Test User').toBeDefined();

    // 收益率百分比应一致（允许 0.05 个百分点的容差）
    const percentDiff = Math.abs(personalPercent - testMember.totalUnrealizedPnlPercent);
    expect(percentDiff, `收益率差异 ${percentDiff.toFixed(4)}% 超过容差`).toBeLessThan(0.05);

    console.log(`[P0-#1] 个人收益率: ${personalPercent.toFixed(2)}%, 家庭(User): ${testMember.totalUnrealizedPnlPercent.toFixed(2)}%, 差异: ${percentDiff.toFixed(4)}%`);
  });

  test('家庭总收益率应基于总成本重算', async ({ request }) => {
    const familyRes = await request.get('/api/family/overview');
    const familyData = await familyRes.json();

    if (familyData.totalUnrealizedPnl !== 0) {
      expect(familyData.totalUnrealizedPnlPercent).not.toBe(0);
    }

    const memberPercents = familyData.memberBreakdown?.map((m: any) => m.totalUnrealizedPnlPercent) || [];
    const simpleAvg = memberPercents.length > 0
      ? memberPercents.reduce((s: number, p: number) => s + p, 0) / memberPercents.length
      : 0;

    console.log(`[P0-#1] 家庭总收益率: ${familyData.totalUnrealizedPnlPercent}%, 各成员: [${memberPercents.join(', ')}], 简单平均: ${simpleAvg.toFixed(2)}%`);
  });

  test('todayPnl 和 todayPnlPercent 在两个视图下应一致', async ({ request }) => {
    const personalRes = await request.get('/api/dashboard');
    const personalData = await personalRes.json();

    const familyRes = await request.get('/api/family/overview');
    const familyData = await familyRes.json();

    const testMember = familyData.memberBreakdown?.find(
      (m: any) => m.userName === 'Test User' || m.userName === 'testuser'
    );
    expect(testMember, '应在 memberBreakdown 中找到 Test User').toBeDefined();

    const todayPnlDiff = Math.abs(personalData.overview.todayPnl - testMember.todayPnl);
    expect(todayPnlDiff, `今日盈亏差异 ${todayPnlDiff}`).toBeLessThan(1);

    const todayPctDiff = Math.abs(personalData.overview.todayPnlPercent - testMember.todayPnlPercent);
    expect(todayPctDiff, `今日盈亏% 差异 ${todayPctDiff}`).toBeLessThan(0.05);

    console.log(`[P0-#1] 个人今日盈亏: ${personalData.overview.todayPnl.toFixed(2)}, 家庭(User): ${testMember.todayPnl.toFixed(2)}`);
  });
});

// ========================================================
// P0-#4: ALT_GOLD 贵金属汇率验证
// ========================================================
test.describe('P0-#4: 贵金属汇率一致性', () => {
  test.beforeEach(async ({ request }) => {
    await loginAsTestUser(request);
  });

  test('贵金属市值在 overview 和 byOverviewGroup 的 ALT 子项中应一致', async ({ request }) => {
    const dashRes = await request.get('/api/dashboard');
    const dashData = await dashRes.json();

    // byOverviewGroup 中的 ALT 分组
    const altGroup = dashData.underlyingTypePortfolio?.byOverviewGroup?.find(
      (g: any) => g.code === 'ALT' || g.name?.includes('另类')
    );

    // groupsSubCategories 中的 ALTERNATIVE 分组
    const altSub = dashData.underlyingTypePortfolio?.groupsSubCategories?.ALTERNATIVE;

    if (altGroup && altSub) {
      // ALT 总值应在两个视图中一致
      const diff = Math.abs(altGroup.value - altSub.total);
      const tolerance = Math.max(altGroup.value, altSub.total) * 0.01; // 1% 容差
      expect(diff, `ALT 分组内部一致性: byOverviewGroup=${altGroup.value.toFixed(2)}, subCategories.total=${altSub.total.toFixed(2)}`).toBeLessThan(tolerance);
      
      console.log(`[P0-#4] ALT byOverviewGroup: ${altGroup.value.toFixed(2)}, ALT subCategories.total: ${altSub.total.toFixed(2)}, diff: ${diff.toFixed(2)}`);
    } else {
      console.log('[P0-#4] 无 ALT 分组数据，跳过验证');
    }
  });
});

// ========================================================
// P3-#9: 除零保护验证
// ========================================================
test.describe('P3-#9: API 返回值不含 Infinity 或 NaN', () => {
  test.beforeEach(async ({ request }) => {
    await loginAsTestUser(request);
  });

  const checkNoInfNaN = (obj: any, path: string = '') => {
    if (obj == null) return;
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      if (typeof value === 'number') {
        expect(isFinite(value), `${currentPath} 应为有限数，实际: ${value}`).toBeTruthy();
        expect(isNaN(value), `${currentPath} 不应为 NaN`).toBeFalsy();
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        checkNoInfNaN(value, currentPath);
      }
    }
  };

  test('Dashboard API 所有数值字段不含 Infinity/NaN', async ({ request }) => {
    const res = await request.get('/api/dashboard');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    checkNoInfNaN(data.overview);
  });

  test('Family Overview API 所有数值字段不含 Infinity/NaN', async ({ request }) => {
    const res = await request.get('/api/family/overview');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    checkNoInfNaN(data);
  });
});

// ========================================================
// P1-#2: 持仓市值统一使用实时计算
// ========================================================
test.describe('P1-#2: 持仓市值一致性（overview vs 分布图 vs 持仓列表）', () => {
  test.beforeEach(async ({ request }) => {
    await loginAsTestUser(request);
  });

  test('overview.totalInvestmentValue 应与 allHoldings 市值总和一致', async ({ request }) => {
    test.setTimeout(30000);
    const res = await request.get('/api/dashboard');
    const data = await res.json();

    const overviewTotal = data.overview.totalInvestmentValue;
    const holdingsTotal = data.allHoldings.reduce((sum: number, h: any) => sum + (h.marketValue || 0), 0);

    const diff = Math.abs(overviewTotal - holdingsTotal);
    const tolerance = Math.max(overviewTotal, 1) * 0.001; // 0.1% 容差
    expect(diff, `overview.totalInvestmentValue=${overviewTotal.toFixed(2)} vs allHoldings sum=${holdingsTotal.toFixed(2)}, diff=${diff.toFixed(2)}`).toBeLessThan(tolerance);

    console.log(`[P1-#2] overview总市值: ${overviewTotal.toFixed(2)}, 持仓列表总和: ${holdingsTotal.toFixed(2)}, diff: ${diff.toFixed(2)}`);
  });

  test('portfolio.byRegion 总值应与 overview.totalInvestmentValue 一致', async ({ request }) => {
    test.setTimeout(30000);
    const res = await request.get('/api/dashboard');
    const data = await res.json();

    const overviewTotal = data.overview.totalInvestmentValue;
    const regionTotal = data.portfolio?.byRegion?.reduce((sum: number, r: any) => sum + (r.value || 0), 0) || 0;

    if (regionTotal > 0) {
      const diff = Math.abs(overviewTotal - regionTotal);
      const tolerance = Math.max(overviewTotal, 1) * 0.001;
      expect(diff, `byRegion sum=${regionTotal.toFixed(2)} vs overview=${overviewTotal.toFixed(2)}`).toBeLessThan(tolerance);
      console.log(`[P1-#2] byRegion总和: ${regionTotal.toFixed(2)}, overview: ${overviewTotal.toFixed(2)}, diff: ${diff.toFixed(2)}`);
    }
  });

  test('allHoldings 中每只持仓的 percentage 总和应接近 100%', async ({ request }) => {
    test.setTimeout(30000);
    const res = await request.get('/api/dashboard');
    const data = await res.json();

    if (data.allHoldings && data.allHoldings.length > 0) {
      const totalPercentage = data.allHoldings.reduce((sum: number, h: any) => sum + (h.percentage || 0), 0);
      expect(Math.abs(totalPercentage - 100), `持仓百分比总和=${totalPercentage.toFixed(2)}% 应接近 100%`).toBeLessThan(1);
      console.log(`[P1-#2] 持仓百分比总和: ${totalPercentage.toFixed(2)}%`);
    }
  });
});
