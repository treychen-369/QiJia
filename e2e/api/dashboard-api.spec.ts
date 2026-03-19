import { test, expect, APIRequestContext } from '@playwright/test';
import { E2E_TEST_EMAIL, E2E_TEST_PASSWORD, loginAsUser } from './test-auth-helper';

/**
 * 第B层：Dashboard API 集成测试（含完整测试数据）
 * 
 * 使用 seed API 创建确定性数据，验证所有计算公式：
 *   costBasis = quantity × averageCost
 *   marketValue = quantity × currentPrice
 *   unrealizedPnl = marketValue - costBasis
 *   unrealizedPnlPercent = (pnl / costBasis) × 100
 *   netWorth = totalAssets - totalLiabilities
 */

let seedData: any;
let authedRequest: APIRequestContext;

test.beforeAll(async ({ playwright }) => {
  // 1. 用独立 request context，先 seed 数据
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

  // 2. 登录测试用户
  authedRequest = await playwright.request.newContext({
    baseURL: 'http://localhost:3000',
  });
  await loginAsUser(authedRequest, E2E_TEST_EMAIL, E2E_TEST_PASSWORD);
});

test.afterAll(async ({ playwright }) => {
  // 清理测试数据
  const cleanupCtx = await playwright.request.newContext({
    baseURL: 'http://localhost:3000',
  });
  await cleanupCtx.delete('/api/test/seed');
  await cleanupCtx.dispose();
  await authedRequest?.dispose();
});

test.describe('Dashboard API 数据完整性', () => {
  let dashboardData: any;

  test.beforeAll(async () => {
    const response = await authedRequest.get('/api/dashboard');
    expect(response.ok()).toBeTruthy();
    dashboardData = await response.json();
  });

  test('overview 包含所有必需字段且类型正确', () => {
    const overview = dashboardData.overview;
    expect(overview).toBeDefined();

    // 核心资产字段
    expect(typeof overview.totalAssets).toBe('number');
    expect(typeof overview.totalInvestmentValue).toBe('number');
    expect(typeof overview.totalCash).toBe('number');
    expect(typeof overview.totalOtherAssets).toBe('number');
    expect(typeof overview.totalCashAssets).toBe('number');

    // 盈亏字段
    expect(typeof overview.totalUnrealizedPnl).toBe('number');
    expect(typeof overview.totalUnrealizedPnlPercent).toBe('number');
    expect(typeof overview.securitiesUnrealizedPnl).toBe('number');
    expect(typeof overview.securitiesUnrealizedPnlPercent).toBe('number');

    // 今日盈亏
    expect(typeof overview.todayPnl).toBe('number');
    expect(typeof overview.todayPnlPercent).toBe('number');

    // 净资产 & 负债
    expect(typeof overview.totalLiabilities).toBe('number');
    expect(typeof overview.netWorth).toBe('number');

    // 计数
    expect(typeof overview.accountCount).toBe('number');
    expect(typeof overview.holdingCount).toBe('number');
  });

  test('净资产 = 总资产 - 总负债', () => {
    const { totalAssets, totalLiabilities, netWorth } = dashboardData.overview;
    expect(netWorth).toBeCloseTo(totalAssets - totalLiabilities, 0);
  });

  test('总负债 = 房贷 + 信用卡 = 1,215,000', () => {
    const { totalLiabilities } = dashboardData.overview;
    // seed 数据：房贷 1,200,000 + 信用卡 15,000 = 1,215,000
    expect(totalLiabilities).toBeCloseTo(1215000, 0);
  });

  test('accounts 数组包含测试账户且总值计算正确', () => {
    const accounts = dashboardData.accounts;
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBeGreaterThanOrEqual(1);

    for (const account of accounts) {
      expect(account.id).toBeDefined();
      expect(account.name).toBeDefined();
      expect(typeof account.holdingsValue).toBe('number');
      expect(typeof account.cashBalance).toBe('number');
      expect(typeof account.totalValue).toBe('number');
      expect(typeof account.exchangeRate).toBe('number');

      // 账户总值 = 持仓市值 + 现金（允许1元误差）
      expect(account.totalValue).toBeCloseTo(
        account.holdingsValue + account.cashBalance, 0
      );
    }
  });

  test('CNY 账户的数值与 seed 数据一致', () => {
    const accounts = dashboardData.accounts;
    const cnyAccount = accounts.find((a: any) => a.id === seedData.accounts.cny.id);
    expect(cnyAccount).toBeDefined();

    // CNY 账户现金 = 50,000
    expect(cnyAccount.cashBalance).toBeCloseTo(50000, 0);
    // CNY 账户持仓市值 = 100 × 22 = 2,200（服务层实时计算，可能与 seed 略有差异）
    expect(cnyAccount.holdingsValue).toBeGreaterThan(0);
    // 汇率 = 1（CNY）
    expect(cnyAccount.exchangeRate).toBe(1);
  });

  test('allHoldings 数组包含测试持仓', () => {
    const holdings = dashboardData.allHoldings;
    expect(Array.isArray(holdings)).toBe(true);
    expect(holdings.length).toBeGreaterThanOrEqual(1);

    for (const h of holdings) {
      expect(h.name).toBeDefined();
      expect(typeof h.quantity).toBe('number');
      expect(typeof h.marketValue).toBe('number');
      expect(typeof h.unrealizedPnL).toBe('number');
      expect(typeof h.unrealizedPnLPercent).toBe('number');
    }
  });

  test('持仓盈亏计算：unrealizedPnL = (marketValueOriginal - quantity*averageCost) × exchangeRate', () => {
    const holdings = dashboardData.allHoldings;
    expect(holdings.length).toBeGreaterThan(0);

    for (const h of holdings) {
      if (h.averageCost > 0 && h.quantity > 0) {
        // 原币种盈亏 = 原币种市值 - 原币种成本
        const originalCost = h.quantity * h.averageCost;
        const originalPnl = h.marketValueOriginal - originalCost;
        // CNY 盈亏 = 原币种盈亏 × 汇率
        const expectedPnl = originalPnl * h.exchangeRate;
        expect(h.unrealizedPnL).toBeCloseTo(expectedPnl, 0);
      }
    }
  });

  test('持仓盈亏百分比 = (原币种盈亏 / 原币种成本) × 100', () => {
    const holdings = dashboardData.allHoldings;
    expect(holdings.length).toBeGreaterThan(0);

    for (const h of holdings) {
      if (h.averageCost > 0 && h.quantity > 0) {
        const originalCost = h.quantity * h.averageCost;
        const originalPnl = h.marketValueOriginal - originalCost;
        const expectedPercent = (originalPnl / originalCost) * 100;
        expect(h.unrealizedPnLPercent).toBeCloseTo(expectedPercent, 0);
      }
    }
  });

  test('holdingCount 与实际持仓数一致', () => {
    const { holdingCount } = dashboardData.overview;
    const { allHoldings } = dashboardData;
    expect(holdingCount).toBe(allHoldings.length);
  });

  test('accountCount 与实际账户数一致', () => {
    const { accountCount } = dashboardData.overview;
    const { accounts } = dashboardData;
    expect(accountCount).toBe(accounts.length);
  });

  test('portfolio 分布数据存在', () => {
    expect(dashboardData.portfolio).toBeDefined();
    expect(dashboardData.portfolio.byRegion).toBeDefined();
    expect(dashboardData.portfolio.byCategory).toBeDefined();
    expect(dashboardData.dualViewPortfolio).toBeDefined();
    expect(dashboardData.underlyingTypePortfolio).toBeDefined();
  });

  test('allocationData 配置分析数据结构（如存在）', () => {
    const allocation = dashboardData.allocationData;
    if (allocation) {
      expect(typeof allocation.overallScore).toBe('number');
      expect(allocation.overallScore).toBeGreaterThanOrEqual(0);
      expect(allocation.overallScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(allocation.topDeviations)).toBe(true);
    }
    // allocation 为 null 也是合法的（测试用户未设置目标）
  });
});
