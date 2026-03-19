import { test, expect, APIRequestContext } from '@playwright/test';
import { E2E_TEST_EMAIL, E2E_TEST_PASSWORD, loginAsUser } from './test-auth-helper';

/**
 * 第B层：Portfolio + History + Snapshot API 集成测试
 * 
 * 使用 seed 数据验证：
 * 1. 各视角（all/region/category/account）的 totalValue 一致
 * 2. 各持仓 percentage 之和 ≈ 100%
 * 3. 各持仓 marketValue 之和 ≈ totalValue
 * 4. 历史趋势数据有序且首尾一致
 * 5. 快照创建和获取
 */

let seedData: any;
let authedRequest: APIRequestContext;

test.beforeAll(async ({ playwright }) => {
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

  authedRequest = await playwright.request.newContext({
    baseURL: 'http://localhost:3000',
  });
  await loginAsUser(authedRequest, E2E_TEST_EMAIL, E2E_TEST_PASSWORD);
});

test.afterAll(async ({ playwright }) => {
  const cleanupCtx = await playwright.request.newContext({
    baseURL: 'http://localhost:3000',
  });
  await cleanupCtx.delete('/api/test/seed');
  await cleanupCtx.dispose();
  await authedRequest?.dispose();
});

test.describe('Portfolio API 多视角数据', () => {
  test('GET /api/portfolio?type=all 返回所有持仓', async () => {
    const response = await authedRequest.get('/api/portfolio?type=all');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.type).toBe('all');
    expect(typeof data.totalValue).toBe('number');
    expect(typeof data.totalUnrealizedPnl).toBe('number');
    expect(Array.isArray(data.holdings)).toBe(true);
    expect(data.holdings.length).toBeGreaterThanOrEqual(1);

    const h = data.holdings[0];
    expect(h.security).toBeDefined();
    expect(h.security.symbol).toBeDefined();
    expect(h.security.name).toBeDefined();
    expect(h.account).toBeDefined();
    // Prisma Decimal 序列化为 string，验证可转换为有效数字
    expect(Number(h.marketValue)).not.toBeNaN();
    expect(Number(h.unrealizedPnl)).not.toBeNaN();
    expect(typeof h.percentage).toBe('number');
  });

  test('各持仓 percentage 之和 ≈ 100%', async () => {
    const response = await authedRequest.get('/api/portfolio?type=all');
    const data = await response.json();

    expect(data.holdings.length).toBeGreaterThan(0);

    const totalPercentage = data.holdings.reduce(
      (sum: number, h: any) => sum + h.percentage, 0
    );
    expect(totalPercentage).toBeCloseTo(100, 0);
  });

  test('各持仓 marketValue 之和 ≈ totalValue', async () => {
    const response = await authedRequest.get('/api/portfolio?type=all');
    const data = await response.json();

    expect(data.holdings.length).toBeGreaterThan(0);

    const sumMarketValue = data.holdings.reduce(
      (sum: number, h: any) => sum + Number(h.marketValue || 0), 0
    );
    expect(sumMarketValue).toBeCloseTo(data.totalValue, 0);
  });

  test('GET /api/portfolio?type=region 按地区分组', async () => {
    const response = await authedRequest.get('/api/portfolio?type=region');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.type).toBe('region');
    expect(Array.isArray(data.groups)).toBe(true);
    expect(data.groups.length).toBeGreaterThan(0);

    // 各组 percentage 之和 ≈ 100%
    const totalPct = data.groups.reduce(
      (sum: number, g: any) => sum + Number(g.percentage), 0
    );
    expect(totalPct).toBeCloseTo(100, 0);

    // 各组 totalValue 之和 ≈ data.totalValue
    const sumValue = data.groups.reduce(
      (sum: number, g: any) => sum + Number(g.totalValue), 0
    );
    expect(sumValue).toBeCloseTo(data.totalValue, 0);
  });

  test('GET /api/portfolio?type=category 按类别分组', async () => {
    const response = await authedRequest.get('/api/portfolio?type=category');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.type).toBe('category');
    expect(Array.isArray(data.groups)).toBe(true);
    expect(data.groups.length).toBeGreaterThan(0);

    const totalPct = data.groups.reduce(
      (sum: number, g: any) => sum + Number(g.percentage), 0
    );
    expect(totalPct).toBeCloseTo(100, 0);
  });

  test('GET /api/portfolio?type=account 按账户分组', async () => {
    const response = await authedRequest.get('/api/portfolio?type=account');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.type).toBe('account');
    expect(Array.isArray(data.groups)).toBe(true);
    expect(data.groups.length).toBeGreaterThan(0);

    const totalPct = data.groups.reduce(
      (sum: number, g: any) => sum + Number(g.percentage), 0
    );
    expect(totalPct).toBeCloseTo(100, 0);
  });

  test('四种视角的 totalValue 完全一致', async () => {
    const [allRes, regionRes, categoryRes, accountRes] = await Promise.all([
      authedRequest.get('/api/portfolio?type=all'),
      authedRequest.get('/api/portfolio?type=region'),
      authedRequest.get('/api/portfolio?type=category'),
      authedRequest.get('/api/portfolio?type=account'),
    ]);

    const all = await allRes.json();
    const region = await regionRes.json();
    const category = await categoryRes.json();
    const account = await accountRes.json();

    expect(all.totalValue).toBeCloseTo(region.totalValue, 0);
    expect(all.totalValue).toBeCloseTo(category.totalValue, 0);
    expect(all.totalValue).toBeCloseTo(account.totalValue, 0);
  });

  test('portfolio totalValue > 0（测试用户有持仓）', async () => {
    const response = await authedRequest.get('/api/portfolio?type=all');
    const data = await response.json();
    expect(data.totalValue).toBeGreaterThan(0);
  });

  test('portfolio totalUnrealizedPnl > 0（测试持仓均盈利）', async () => {
    const response = await authedRequest.get('/api/portfolio?type=all');
    const data = await response.json();
    // seed 数据中所有持仓 currentPrice > averageCost，应盈利
    expect(data.totalUnrealizedPnl).toBeGreaterThan(0);
  });
});

test.describe('Portfolio History API', () => {
  test('GET /api/portfolio/history 返回有序时间序列', async () => {
    const response = await authedRequest.get('/api/portfolio/history?days=30');
    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data.trend)).toBe(true);
    expect(json.data.summary).toBeDefined();

    // seed 创建了 3 个快照点，应该至少有 3 条
    expect(json.data.trend.length).toBeGreaterThanOrEqual(3);

    // 时间应递增
    for (let i = 1; i < json.data.trend.length; i++) {
      const prev = new Date(json.data.trend[i - 1].date).getTime();
      const curr = new Date(json.data.trend[i].date).getTime();
      expect(curr).toBeGreaterThanOrEqual(prev);
    }

    // 每条趋势数据包含必要字段
    const item = json.data.trend[0];
    expect(typeof item.totalValue).toBe('number');
    expect(item.date).toBeDefined();
  });

  test('summary 的 startValue/endValue 与 trend 首尾一致', async () => {
    const response = await authedRequest.get('/api/portfolio/history?days=30');
    const json = await response.json();
    const { trend, summary } = json.data;

    expect(trend.length).toBeGreaterThanOrEqual(2);
    expect(summary.startValue).toBeCloseTo(trend[0].totalValue, 0);
    expect(summary.endValue).toBeCloseTo(trend[trend.length - 1].totalValue, 0);
    expect(summary.dataPoints).toBe(trend.length);
  });

  test('趋势数据的 totalValue 值与 seed 数据吻合', async () => {
    const response = await authedRequest.get('/api/portfolio/history?days=30');
    const json = await response.json();
    const { trend } = json.data;

    // 最早的点应接近 seed 的 2,600,000
    expect(trend[0].totalValue).toBeCloseTo(2600000, -4); // 允许万级别误差
    // 最新的点应接近 seed 的 2,650,000
    expect(trend[trend.length - 1].totalValue).toBeCloseTo(2650000, -4);
  });
});

test.describe('Snapshot API', () => {
  test('GET /api/portfolio/snapshot 获取最新快照', async () => {
    const response = await authedRequest.get('/api/portfolio/snapshot');
    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    expect(json.success).toBe(true);
    // seed 已创建今日快照，data 应存在
    expect(json.data).toBeDefined();
  });

  test('POST /api/portfolio/snapshot 创建快照（幂等）', async () => {
    const response = await authedRequest.post('/api/portfolio/snapshot');

    // 可能 200（新建）或 409（今日已存在，seed 已创建）
    expect([200, 409]).toContain(response.status());

    const json = await response.json();
    if (response.status() === 200) {
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    } else {
      // 409 - 今日已存在
      expect(json.error || json.message).toBeDefined();
    }
  });
});
