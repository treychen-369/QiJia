import { test, expect, APIRequestContext } from '@playwright/test';
import { E2E_TEST_EMAIL, E2E_TEST_EMAIL_2, E2E_TEST_PASSWORD, loginAsUser } from './test-auth-helper';

/**
 * 第C层：前端↔API 数据一致性测试
 * 
 * 验证目标：
 * 1. 前端调用的 API 返回数据结构与 api-client.ts 类型定义一致
 * 2. Dashboard API 是唯一的个人概览数据源，没有冗余接口
 * 3. 家庭视角使用独立的 family/* API，不与个人 API 混用
 * 4. 各 API 之间的交叉数据一致（同一数据不同接口返回值相同）
 * 5. Portfolio 四种视角的 totalValue 一致
 * 6. 家庭聚合数据 = 所有成员个人数据之和
 * 
 * 前端→API 调用映射：
 *   page.tsx loadDashboardData() → GET /api/dashboard    → overview, allHoldings, accounts, portfolio, allocationData
 *   page.tsx loadDashboardData() → GET /api/assets       → 非证券资产列表
 *   page.tsx loadDashboardData() → GET /api/liabilities  → 负债列表
 *   page.tsx loadFamilyData()    → GET /api/family/overview + /api/family/members + /api/family/dashboard
 *   charts  historicalTrend      → GET /api/portfolio/history?days=N
 *   charts  familyTrend          → GET /api/family/history?days=N
 *   portfolio page               → GET /api/portfolio?type=all|region|category|account
 */

let seedData: any;
let user1Request: APIRequestContext;
let user2Request: APIRequestContext;

test.beforeAll(async ({ playwright }) => {
  // Seed 数据
  const seedContext = await playwright.request.newContext({
    baseURL: 'http://localhost:3000',
  });
  const seedRes = await seedContext.post('/api/test/seed');
  if (!seedRes.ok()) {
    const body = await seedRes.text();
    throw new Error(`Seed 失败: ${seedRes.status()} - ${body}`);
  }
  seedData = (await seedRes.json()).data;
  await seedContext.dispose();

  // 登录用户1
  user1Request = await playwright.request.newContext({
    baseURL: 'http://localhost:3000',
  });
  await loginAsUser(user1Request, E2E_TEST_EMAIL, E2E_TEST_PASSWORD);

  // 登录用户2
  user2Request = await playwright.request.newContext({
    baseURL: 'http://localhost:3000',
  });
  await loginAsUser(user2Request, E2E_TEST_EMAIL_2, E2E_TEST_PASSWORD);
});

test.afterAll(async ({ playwright }) => {
  const cleanupCtx = await playwright.request.newContext({
    baseURL: 'http://localhost:3000',
  });
  await cleanupCtx.delete('/api/test/seed');
  await cleanupCtx.dispose();
  await user1Request?.dispose();
  await user2Request?.dispose();
});

// ===============================================================
// 一、Dashboard API 数据结构与前端 DashboardData 类型一致性
// ===============================================================

test.describe('Dashboard API 数据结构与前端类型一致', () => {
  let dashboardData: any;

  test.beforeAll(async () => {
    const response = await user1Request.get('/api/dashboard');
    expect(response.ok()).toBeTruthy();
    dashboardData = await response.json();
  });

  test('Dashboard 返回所有前端需要的顶层字段', () => {
    // 前端 api-client.ts DashboardData 接口的所有必须字段
    expect(dashboardData.overview).toBeDefined();
    expect(dashboardData.accounts).toBeDefined();
    expect(dashboardData.portfolio).toBeDefined();
    expect(dashboardData.topHoldings).toBeDefined();
    expect(dashboardData.allHoldings).toBeDefined();
    expect(dashboardData.investmentPlans).toBeDefined();

    // 可选但前端使用的字段
    expect(dashboardData.dualViewPortfolio).toBeDefined();
    expect(dashboardData.underlyingTypePortfolio).toBeDefined();
  });

  test('overview 字段满足 HeroSection 组件所需', () => {
    // HeroSection 需要的字段（见 page.tsx heroData 映射）
    const o = dashboardData.overview;
    expect(typeof o.totalAssets).toBe('number');
    expect(typeof o.totalCash).toBe('number');
    expect(typeof o.totalInvestmentValue).toBe('number');
    expect(typeof o.todayPnl).toBe('number');
    expect(typeof o.todayPnlPercent).toBe('number');
    expect(typeof o.totalUnrealizedPnl).toBe('number');
    expect(typeof o.totalUnrealizedPnlPercent).toBe('number');

    // Phase 1.2 净资产字段
    expect(typeof o.netWorth).toBe('number');
    expect(typeof o.totalLiabilities).toBe('number');

    // Phase 2 资产构成字段
    expect(typeof o.totalCashAssets).toBe('number');
    expect(typeof o.totalOtherAssets).toBe('number');
  });

  test('accounts 数组每项满足前端 accountsCashData 映射所需', () => {
    // page.tsx 第376-383行将 accounts 映射为 accountsCashData
    for (const account of dashboardData.accounts) {
      expect(account.id).toBeDefined();
      expect(typeof account.name).toBe('string');
      expect(typeof account.broker).toBe('string');
      expect(typeof account.currency).toBe('string');
      expect(account.cashBalance).toBeDefined();
      expect(account.cashBalanceOriginal).toBeDefined();
      // Number() 转换后必须是有效数字
      expect(Number(account.cashBalance)).not.toBeNaN();
      expect(Number(account.cashBalanceOriginal)).not.toBeNaN();
    }
  });

  test('allHoldings 每项满足前端 allHoldingsData 映射所需', () => {
    // page.tsx 第418-430行将 allHoldings 映射到 allHoldingsData
    for (const h of dashboardData.allHoldings) {
      // 必须字段（前端直接使用）
      expect(h.id).toBeDefined();
      expect(typeof h.name).toBe('string');
      expect(typeof h.symbol).toBe('string');
      expect(typeof h.quantity).toBe('number');
      expect(typeof h.marketValue).toBe('number');
      expect(typeof h.unrealizedPnL).toBe('number');
      expect(typeof h.unrealizedPnLPercent).toBe('number');
      expect(typeof h.averageCost).toBe('number');
      expect(typeof h.currentPrice).toBe('number');
      expect(typeof h.dayChange).toBe('number');
      expect(typeof h.dayChangePercent).toBe('number');
      expect(typeof h.currency).toBe('string');
      expect(typeof h.region).toBe('string');
      expect(h.lastUpdated).toBeDefined();

      // 前端 HoldingsList 组件用到的字段
      expect(h.accountName).toBeDefined();
      expect(h.broker).toBeDefined();
      expect(typeof h.marketValueOriginal).toBe('number');
    }
  });

  test('portfolio.byRegion 和 portfolio.byCategory 满足 ChartsGrid 所需', () => {
    const { byRegion, byCategory } = dashboardData.portfolio;
    expect(Array.isArray(byRegion)).toBe(true);
    expect(Array.isArray(byCategory)).toBe(true);

    for (const item of byRegion) {
      expect(typeof item.name).toBe('string');
      expect(typeof item.value).toBe('number');
      expect(typeof item.percentage).toBe('number');
    }
    for (const item of byCategory) {
      expect(typeof item.name).toBe('string');
      expect(typeof item.value).toBe('number');
      expect(typeof item.percentage).toBe('number');
    }
  });

  test('underlyingTypePortfolio 满足 AssetPanorama 组件所需', () => {
    const utp = dashboardData.underlyingTypePortfolio;
    expect(Array.isArray(utp.byUnderlyingType)).toBe(true);
    expect(Array.isArray(utp.byOverviewGroup)).toBe(true);

    for (const group of utp.byOverviewGroup) {
      expect(typeof group.code).toBe('string');
      expect(typeof group.name).toBe('string');
      expect(typeof group.value).toBe('number');
      expect(typeof group.percentage).toBe('number');
      expect(typeof group.color).toBe('string');
    }
  });
});

// ===============================================================
// 二、API 之间交叉数据一致性（消除数据冗余导致的不一致）
// ===============================================================

test.describe('API 之间交叉数据一致性', () => {
  let dashboardData: any;
  let portfolioAll: any;
  let assetsData: any;
  let liabilitiesData: any;

  test.beforeAll(async () => {
    const [dashRes, portfolioRes, assetsRes, liabilitiesRes] = await Promise.all([
      user1Request.get('/api/dashboard'),
      user1Request.get('/api/portfolio?type=all'),
      user1Request.get('/api/assets'),
      user1Request.get('/api/liabilities'),
    ]);

    dashboardData = await dashRes.json();
    portfolioAll = await portfolioRes.json();
    assetsData = (await assetsRes.json()).data;
    liabilitiesData = (await liabilitiesRes.json()).data;
  });

  test('Dashboard.allHoldings 与 Portfolio(all).holdings 持仓数一致', () => {
    // Dashboard 的 allHoldings 和 Portfolio(type=all) 的 holdings 应该来自同一数据源
    const dashHoldings = dashboardData.allHoldings;
    const portfolioHoldings = portfolioAll.holdings || [];

    expect(dashHoldings.length).toBe(portfolioHoldings.length);
  });

  test('Dashboard.overview.totalLiabilities 与 Liabilities API 总额一致', () => {
    const dashTotalLiabilities = dashboardData.overview.totalLiabilities;
    const liabilitiesSum = liabilitiesData.reduce(
      (sum: number, l: any) => sum + Number(l.currentBalance || 0), 0
    );
    expect(dashTotalLiabilities).toBeCloseTo(liabilitiesSum, 0);
  });

  test('Dashboard.overview.holdingCount 与 Portfolio(all).count 一致', () => {
    expect(dashboardData.overview.holdingCount).toBe(portfolioAll.count || portfolioAll.holdings?.length || 0);
  });

  test('Portfolio 四种视角的 totalValue 全部一致', async () => {
    const [regionRes, categoryRes, accountRes] = await Promise.all([
      user1Request.get('/api/portfolio?type=region'),
      user1Request.get('/api/portfolio?type=category'),
      user1Request.get('/api/portfolio?type=account'),
    ]);

    const regionData = await regionRes.json();
    const categoryData = await categoryRes.json();
    const accountData = await accountRes.json();

    const allTotal = portfolioAll.totalValue;
    expect(regionData.totalValue).toBeCloseTo(allTotal, 0);
    expect(categoryData.totalValue).toBeCloseTo(allTotal, 0);
    expect(accountData.totalValue).toBeCloseTo(allTotal, 0);
  });

  test('Dashboard.overview.totalOtherAssets + totalCashAssets ≈ Assets API 全部资产总额', () => {
    // totalOtherAssets = 非现金类 Asset 总值
    // totalCashAssets = 现金类 Asset 总值（活期、定期、货基、券商现金资产）
    // 两者之和应该约等于 /api/assets 返回的全部 Asset 的 currentValue 之和
    const dashOtherAssets = dashboardData.overview.totalOtherAssets || 0;
    const dashCashAssets = dashboardData.overview.totalCashAssets || 0;
    const assetsTotal = assetsData.reduce(
      (sum: number, a: any) => sum + Number(a.currentValue || 0), 0
    );
    // 允许较大误差（因为服务层对不同资产类型有独立估值逻辑，如不动产用市场价、固收算利息等）
    const tolerance = Math.max(assetsTotal * 0.05, 1000);
    expect(Math.abs((dashOtherAssets + dashCashAssets) - assetsTotal)).toBeLessThan(tolerance);
  });

  test('Dashboard.overview.totalCash >= accounts.cashBalance 总和（含活期存款）', () => {
    // totalCash = 券商账户现金 + 活期存款
    // accounts.cashBalance 之和 = 仅券商账户现金
    // 所以 totalCash >= cashBalance 之和
    const totalCashFromAccounts = dashboardData.accounts.reduce(
      (sum: number, a: any) => sum + Number(a.cashBalance || 0), 0
    );
    expect(dashboardData.overview.totalCash).toBeGreaterThanOrEqual(
      totalCashFromAccounts - 1 // 允许精度误差
    );
  });
});

// ===============================================================
// 三、个人视角 vs 家庭视角 API 不混用
// ===============================================================

test.describe('个人视角 vs 家庭视角 API 隔离', () => {
  let personalDashboard: any;
  let familyOverview: any;
  let familyDashboard: any;

  test.beforeAll(async () => {
    const [dashRes, familyOverRes, familyDashRes] = await Promise.all([
      user1Request.get('/api/dashboard'),
      user1Request.get('/api/family/overview'),
      user1Request.get('/api/family/dashboard'),
    ]);

    personalDashboard = await dashRes.json();
    familyOverview = await familyOverRes.json();
    familyDashboard = (await familyDashRes.json());
  });

  test('个人 Dashboard 只包含当前用户数据，不含家庭聚合', () => {
    // 个人 Dashboard 不应返回 memberCount、ownerName 等家庭字段
    expect(personalDashboard.memberCount).toBeUndefined();

    // allHoldings 中不应有 ownerName 字段（个人数据只属于自己）
    for (const h of personalDashboard.allHoldings) {
      expect(h.ownerName).toBeUndefined();
    }
  });

  test('家庭 Dashboard 的持仓包含 ownerName，个人 Dashboard 不含', () => {
    // 家庭持仓每项必须标记属于谁
    for (const h of familyDashboard.holdings || []) {
      expect(h.ownerName).toBeDefined();
      expect(typeof h.ownerName).toBe('string');
    }

    // 个人持仓不需要标记（因为都属于当前用户）
    for (const h of personalDashboard.allHoldings) {
      expect(h.ownerName).toBeUndefined();
    }
  });

  test('家庭 Overview 的 totalAssets >= 个人 Dashboard 的 totalAssets', () => {
    expect(familyOverview.totalAssets).toBeGreaterThanOrEqual(
      personalDashboard.overview.totalAssets
    );
  });

  test('家庭 Dashboard 的 memberCount = 2（双人家庭）', () => {
    expect(familyDashboard.memberCount).toBe(2);
  });

  test('家庭 Members API 返回正确的成员列表', async () => {
    const membersRes = await user1Request.get('/api/family/members');
    expect(membersRes.ok()).toBeTruthy();
    const membersData = await membersRes.json();
    expect(membersData.members.length).toBe(2);

    // 每个成员有基本信息
    for (const m of membersData.members) {
      expect(m.role).toBeDefined();
      expect(m.user).toBeDefined();
      expect(m.user.name).toBeDefined();
    }
  });
});

// ===============================================================
// 四、家庭聚合数据 = 个人数据之和
// ===============================================================

test.describe('家庭聚合数据一致性', () => {
  test('家庭 Dashboard 持仓数 = 用户1持仓数 + 用户2持仓数', async () => {
    const [familyDashRes, user1DashRes, user2DashRes] = await Promise.all([
      user1Request.get('/api/family/dashboard'),
      user1Request.get('/api/dashboard'),
      user2Request.get('/api/dashboard'),
    ]);

    const familyDash = await familyDashRes.json();
    const user1Dash = await user1DashRes.json();
    const user2Dash = await user2DashRes.json();

    expect(familyDash.holdings.length).toBe(
      user1Dash.allHoldings.length + user2Dash.allHoldings.length
    );
  });

  test('家庭 Dashboard 资产数 = 用户1资产数 + 用户2资产数', async () => {
    const [familyDashRes, user1AssetsRes, user2AssetsRes] = await Promise.all([
      user1Request.get('/api/family/dashboard'),
      user1Request.get('/api/assets'),
      user2Request.get('/api/assets'),
    ]);

    const familyDash = await familyDashRes.json();
    const user1Assets = (await user1AssetsRes.json()).data;
    const user2Assets = (await user2AssetsRes.json()).data;

    expect(familyDash.assets.length).toBe(
      user1Assets.length + user2Assets.length
    );
  });

  test('家庭 Dashboard 负债数 = 用户1负债数 + 用户2负债数', async () => {
    const [familyDashRes, user1LiabilitiesRes, user2LiabilitiesRes] = await Promise.all([
      user1Request.get('/api/family/dashboard'),
      user1Request.get('/api/liabilities'),
      user2Request.get('/api/liabilities'),
    ]);

    const familyDash = await familyDashRes.json();
    const user1Liabilities = (await user1LiabilitiesRes.json()).data;
    const user2Liabilities = (await user2LiabilitiesRes.json()).data;

    expect(familyDash.liabilities.length).toBe(
      user1Liabilities.length + user2Liabilities.length
    );
  });

  test('家庭 Overview.memberBreakdown 包含双方且百分比合计≈100%', async () => {
    const familyRes = await user1Request.get('/api/family/overview');
    const familyData = await familyRes.json();

    expect(familyData.memberBreakdown).toBeDefined();
    expect(familyData.memberBreakdown.length).toBe(2);

    const totalPct = familyData.memberBreakdown.reduce(
      (sum: number, m: any) => sum + (m.percentage || 0), 0
    );
    expect(totalPct).toBeCloseTo(100, 0);
  });
});

// ===============================================================
// 五、历史趋势 API 数据结构验证
// ===============================================================

test.describe('历史趋势 API 数据结构', () => {
  test('GET /api/portfolio/history 返回 { success, data: { trend, summary } } 结构', async () => {
    const response = await user1Request.get('/api/portfolio/history?days=30');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // 响应结构: { success: true, data: { trend: [], metrics, summary } }
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data.trend)).toBe(true);
    expect(data.data.summary).toBeDefined();

    if (data.data.trend.length > 0) {
      const point = data.data.trend[0];
      // HistoricalTrendChart / AssetPanorama 组件需要的字段
      expect(point.date).toBeDefined();
      expect(Number(point.totalValue)).not.toBeNaN();
    }
  });

  test('个人历史趋势数据按日期升序排列', async () => {
    const response = await user1Request.get('/api/portfolio/history?days=30');
    const data = await response.json();
    const trend = data.data?.trend || [];

    for (let i = 1; i < trend.length; i++) {
      expect(new Date(trend[i].date).getTime()).toBeGreaterThanOrEqual(
        new Date(trend[i - 1].date).getTime()
      );
    }
  });

  test('趋势数据点包含前端图表需要的所有指标字段', async () => {
    const response = await user1Request.get('/api/portfolio/history?days=30');
    const data = await response.json();
    const trend = data.data?.trend || [];

    if (trend.length > 0) {
      const point = trend[0];
      // HistoricalTrendChart METRIC_OPTIONS 引用的字段
      // totalAssets, netWorth, totalLiabilities, equityAssets 等
      expect(point.totalValue).toBeDefined();
      // 以下字段为可选，但如果存在必须是有效数字
      for (const field of ['totalAssets', 'netWorth', 'totalLiabilities', 
                           'equityAssets', 'cashEquivalents']) {
        if (point[field] !== undefined && point[field] !== null) {
          expect(Number(point[field])).not.toBeNaN();
        }
      }
    }
  });

  test('家庭历史趋势 API 可访问', async () => {
    const response = await user1Request.get('/api/family/history?days=30');
    // 家庭历史可能没有数据但不应该报错
    expect([200, 404].includes(response.status())).toBeTruthy();
  });
});

// ===============================================================
// 六、API 无冗余：前端没有重复调用不同接口获取同一数据
// ===============================================================

test.describe('API 设计无冗余', () => {
  let dashData: any;
  let assetsListData: any;
  let liabilitiesListData: any;

  test.beforeAll(async () => {
    const [dashRes, assetsRes, liabilitiesRes] = await Promise.all([
      user1Request.get('/api/dashboard'),
      user1Request.get('/api/assets'),
      user1Request.get('/api/liabilities'),
    ]);
    dashData = await dashRes.json();
    assetsListData = (await assetsRes.json()).data;
    liabilitiesListData = (await liabilitiesRes.json()).data;
  });

  test('Dashboard API 是个人概览的唯一数据源（非家庭场景）', () => {
    // 验证 /api/dashboard 返回的 overview 已经包含了所有 HeroSection 需要的数据
    expect(dashData.overview.totalAssets).toBeDefined();
    expect(dashData.overview.netWorth).toBeDefined();
    expect(dashData.overview.totalLiabilities).toBeDefined();
    expect(dashData.overview.totalCash).toBeDefined();
    expect(dashData.overview.totalInvestmentValue).toBeDefined();
    expect(dashData.overview.totalUnrealizedPnl).toBeDefined();
    expect(dashData.overview.todayPnl).toBeDefined();
    expect(dashData.overview.accountCount).toBeDefined();
    expect(dashData.overview.holdingCount).toBeDefined();

    // allHoldings 也来自此接口（前端不额外调 /api/holdings）
    expect(dashData.allHoldings.length).toBeGreaterThan(0);
    // accounts 也来自此接口
    expect(dashData.accounts.length).toBeGreaterThan(0);
  });

  test('家庭概览使用独立的3个接口，各自职责不同', async () => {
    const [overviewRes, membersRes, dashboardRes] = await Promise.all([
      user1Request.get('/api/family/overview'),
      user1Request.get('/api/family/members'),
      user1Request.get('/api/family/dashboard'),
    ]);

    const overview = await overviewRes.json();
    const members = await membersRes.json();
    const dashboard = await dashboardRes.json();

    // overview: 家庭总览数值（totalAssets, netWorth等）
    expect(typeof overview.totalAssets).toBe('number');
    expect(typeof overview.netWorth).toBe('number');

    // members: 成员列表（用于 ViewSwitcher 成员筛选）
    expect(Array.isArray(members.members)).toBe(true);

    // dashboard: 合并的持仓/资产/负债列表（用于 AssetsTabNavigation）
    expect(Array.isArray(dashboard.holdings)).toBe(true);
    expect(Array.isArray(dashboard.assets)).toBe(true);
    expect(Array.isArray(dashboard.liabilities)).toBe(true);
  });

  test('allHoldings(证券)、assets(非证券)、liabilities(负债) 三者数据不重复', () => {
    // allHoldings 只包含证券持仓（有 symbol 字段）
    const holdingIds = new Set(dashData.allHoldings.map((h: any) => h.id));
    const assetIds = new Set(assetsListData.map((a: any) => a.id));
    const liabilityIds = new Set(liabilitiesListData.map((l: any) => l.id));

    // 三个集合之间不应有交集
    for (const id of holdingIds) {
      expect(assetIds.has(id)).toBe(false);
      expect(liabilityIds.has(id)).toBe(false);
    }
    for (const id of assetIds) {
      expect(liabilityIds.has(id)).toBe(false);
    }

    // allHoldings 每项都有 symbol（证券特征）
    for (const h of dashData.allHoldings) {
      expect(h.symbol).toBeDefined();
    }
  });
});
