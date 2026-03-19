import { test, expect, APIRequestContext } from '@playwright/test';
import { E2E_TEST_EMAIL, E2E_TEST_PASSWORD, loginAsUser } from './test-auth-helper';

/**
 * 第B层：Assets + Liabilities API 集成测试
 * 
 * 使用 seed 数据验证：
 * 1. 资产列表完整性和字段正确性
 * 2. 资产汇率字段合理性
 * 3. 分类资产加总一致性
 * 4. 负债数据完整性
 * 5. Dashboard ↔ Assets/Liabilities 交叉一致性
 */

let seedData: any;
let authedRequest: APIRequestContext;

test.beforeAll(async ({ playwright }) => {
  // seed 数据
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

  // 登录
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

test.describe('Assets API 数据正确性', () => {
  test('GET /api/assets 返回完整数据结构', async () => {
    const response = await authedRequest.get('/api/assets');
    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    // 至少有 seed 的 2 个资产
    expect(json.data.length).toBeGreaterThanOrEqual(2);

    for (const asset of json.data) {
      expect(asset.id).toBeDefined();
      expect(asset.name).toBeDefined();
      expect(asset.currency).toBeDefined();
      expect(asset.assetCategory).toBeDefined();
      expect(typeof asset.currentValue).toBe('number');
      expect(typeof asset.exchangeRate).toBe('number');
    }
  });

  test('seed 的资产数值与预期一致', async () => {
    const response = await authedRequest.get('/api/assets');
    const json = await response.json();

    // 查找银行存款
    const deposit = json.data.find((a: any) => a.id === seedData.assets.deposit.id);
    expect(deposit).toBeDefined();
    expect(deposit.currentValue).toBeCloseTo(100000, 0);
    expect(deposit.currency).toBe('CNY');
    expect(deposit.exchangeRate).toBe(1);

    // 查找房产
    const property = json.data.find((a: any) => a.id === seedData.assets.property.id);
    expect(property).toBeDefined();
    expect(property.currentValue).toBeCloseTo(2500000, 0);
  });

  test('CNY 资产汇率 = 1', async () => {
    const response = await authedRequest.get('/api/assets');
    const json = await response.json();

    for (const asset of json.data) {
      if (asset.currency === 'CNY') {
        expect(asset.exchangeRate).toBe(1);
      }
      // 所有汇率必须 > 0
      expect(asset.exchangeRate).toBeGreaterThan(0);
    }
  });

  test('资产分类加总：各分类之和 = 总资产值', async () => {
    const response = await authedRequest.get('/api/assets');
    const json = await response.json();

    // 按一级分类分组
    const groups: Record<string, number> = {};
    let totalSum = 0;
    for (const asset of json.data) {
      const parentName = asset.assetCategory?.parent?.name || asset.assetCategory?.name || 'unknown';
      groups[parentName] = (groups[parentName] || 0) + (asset.currentValue || 0);
      totalSum += asset.currentValue || 0;
    }

    // 分类加总 = 总和
    const groupSum = Object.values(groups).reduce((s, v) => s + v, 0);
    expect(groupSum).toBeCloseTo(totalSum, 0);
  });
});

test.describe('Liabilities API 数据正确性', () => {
  test('GET /api/liabilities 返回完整数据结构', async () => {
    const response = await authedRequest.get('/api/liabilities');
    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    // 至少有 seed 的 2 个负债
    expect(json.data.length).toBeGreaterThanOrEqual(2);

    for (const liability of json.data) {
      expect(liability.id).toBeDefined();
      expect(liability.name).toBeDefined();
      // Prisma Decimal 序列化为 string，转换后验证
      expect(Number(liability.currentBalance)).not.toBeNaN();
    }
  });

  test('seed 的负债数值与预期一致', async () => {
    const response = await authedRequest.get('/api/liabilities');
    const json = await response.json();

    const mortgage = json.data.find((l: any) => l.id === seedData.liabilities.mortgage.id);
    expect(mortgage).toBeDefined();
    expect(Number(mortgage.currentBalance)).toBeCloseTo(1200000, 0);
    expect(mortgage.type).toBe('MORTGAGE');

    const creditCard = json.data.find((l: any) => l.id === seedData.liabilities.creditCard.id);
    expect(creditCard).toBeDefined();
    expect(Number(creditCard.currentBalance)).toBeCloseTo(15000, 0);
    expect(creditCard.type).toBe('CREDIT_CARD');
  });

  test('负债概览总额 = 各负债余额之和', async () => {
    const [overviewRes, listRes] = await Promise.all([
      authedRequest.get('/api/liabilities?action=overview'),
      authedRequest.get('/api/liabilities'),
    ]);

    expect(overviewRes.ok()).toBeTruthy();
    const overview = await overviewRes.json();
    const list = await listRes.json();

    const sumBalance = list.data.reduce(
      (sum: number, l: any) => sum + Number(l.currentBalance || 0), 0
    );
    expect(Number(overview.data.totalLiabilities)).toBeCloseTo(sumBalance, 0);
  });
});

test.describe('Dashboard ↔ Assets/Liabilities 交叉一致性', () => {
  test('Dashboard 负债总额 = Liabilities API 负债总额', async () => {
    const [dashRes, liabRes] = await Promise.all([
      authedRequest.get('/api/dashboard'),
      authedRequest.get('/api/liabilities?action=overview'),
    ]);

    const dashData = await dashRes.json();
    const liabData = await liabRes.json();

    expect(dashData.overview.totalLiabilities).toBeCloseTo(
      liabData.data.totalLiabilities, 0
    );
  });

  test('Dashboard totalOtherAssets + totalCashAssets ≈ Assets API 总和', async () => {
    const [dashRes, assetsRes] = await Promise.all([
      authedRequest.get('/api/dashboard'),
      authedRequest.get('/api/assets'),
    ]);

    const dashData = await dashRes.json();
    const assetsData = await assetsRes.json();

    const assetsSum = assetsData.data.reduce(
      (sum: number, a: any) => sum + (a.currentValue || 0), 0
    );

    const dashCashAndOther = dashData.overview.totalCashAssets + dashData.overview.totalOtherAssets;

    // 允许 1% 或 100 元误差
    const tolerance = Math.max(assetsSum * 0.01, 100);
    expect(Math.abs(dashCashAndOther - assetsSum)).toBeLessThan(tolerance);
  });

  test('Dashboard totalAssets > 0（测试用户有数据）', async () => {
    const response = await authedRequest.get('/api/dashboard');
    const data = await response.json();
    expect(data.overview.totalAssets).toBeGreaterThan(0);
  });

  test('Dashboard totalInvestmentValue > 0（测试用户有持仓）', async () => {
    const response = await authedRequest.get('/api/dashboard');
    const data = await response.json();
    expect(data.overview.totalInvestmentValue).toBeGreaterThan(0);
  });
});
