import { test, expect, APIRequestContext } from '@playwright/test';
import { E2E_TEST_EMAIL, E2E_TEST_EMAIL_2, E2E_TEST_PASSWORD, loginAsUser } from './test-auth-helper';

/**
 * 第B层：Family API 集成测试
 * 
 * 使用 seed 数据验证：
 * 1. 家庭概览数据结构和数值
 * 2. 家庭 Dashboard 合并数据
 * 3. 家庭资产 = 所有成员资产之和
 * 4. 家庭持仓 ≥ 个人持仓（超集关系）
 * 5. 两用户在同一家庭中的数据隔离/聚合
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

test.describe('Family Overview API', () => {
  test('GET /api/family/overview 返回完整数据', async () => {
    const response = await user1Request.get('/api/family/overview');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(typeof data.totalAssets).toBe('number');
    expect(typeof data.netWorth).toBe('number');
    expect(data.totalAssets).toBeGreaterThan(0);
  });

  test('家庭总资产 > 任一个人总资产（双人家庭）', async () => {
    const [familyRes, user1DashRes, user2DashRes] = await Promise.all([
      user1Request.get('/api/family/overview'),
      user1Request.get('/api/dashboard'),
      user2Request.get('/api/dashboard'),
    ]);

    const familyData = await familyRes.json();
    const user1Dash = await user1DashRes.json();
    const user2Dash = await user2DashRes.json();

    // 家庭总资产 >= 用户1总资产
    expect(familyData.totalAssets).toBeGreaterThanOrEqual(user1Dash.overview.totalAssets);
    // 家庭总资产 >= 用户2总资产
    expect(familyData.totalAssets).toBeGreaterThanOrEqual(user2Dash.overview.totalAssets);
  });

  test('家庭总资产 ≈ 用户1 + 用户2 总资产之和', async () => {
    const [familyRes, user1DashRes, user2DashRes] = await Promise.all([
      user1Request.get('/api/family/overview'),
      user1Request.get('/api/dashboard'),
      user2Request.get('/api/dashboard'),
    ]);

    const familyData = await familyRes.json();
    const user1Dash = await user1DashRes.json();
    const user2Dash = await user2DashRes.json();

    const sumTotal = user1Dash.overview.totalAssets + user2Dash.overview.totalAssets;
    // 允许 1% 容差
    const tolerance = Math.max(sumTotal * 0.01, 500);
    expect(Math.abs(familyData.totalAssets - sumTotal)).toBeLessThan(tolerance);
  });

  test('家庭净资产 ≈ 用户1净资产 + 用户2净资产', async () => {
    const [familyRes, user1DashRes, user2DashRes] = await Promise.all([
      user1Request.get('/api/family/overview'),
      user1Request.get('/api/dashboard'),
      user2Request.get('/api/dashboard'),
    ]);

    const familyData = await familyRes.json();
    const user1Dash = await user1DashRes.json();
    const user2Dash = await user2DashRes.json();

    const sumNetWorth = user1Dash.overview.netWorth + user2Dash.overview.netWorth;
    const tolerance = Math.max(Math.abs(sumNetWorth) * 0.01, 500);
    expect(Math.abs(familyData.netWorth - sumNetWorth)).toBeLessThan(tolerance);
  });
});

test.describe('Family Dashboard API', () => {
  test('GET /api/family/dashboard 返回完整合并数据', async () => {
    const response = await user1Request.get('/api/family/dashboard');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.holdings)).toBe(true);
    expect(Array.isArray(data.assets)).toBe(true);
    expect(Array.isArray(data.liabilities)).toBe(true);
    expect(typeof data.memberCount).toBe('number');
    expect(data.memberCount).toBe(2); // 双人家庭
  });

  test('家庭持仓包含双方数据，且每条有 ownerName', async () => {
    const response = await user1Request.get('/api/family/dashboard');
    const data = await response.json();

    // 至少有用户1 + 用户2 的持仓
    expect(data.holdings.length).toBeGreaterThanOrEqual(2);

    for (const h of data.holdings) {
      expect(h.ownerName).toBeDefined();
      expect(typeof h.ownerName).toBe('string');
    }

    // 验证包含两个不同 owner
    const owners = new Set(data.holdings.map((h: any) => h.ownerName));
    expect(owners.size).toBeGreaterThanOrEqual(2);
  });

  test('家庭资产包含双方数据，且每条有 ownerName', async () => {
    const response = await user1Request.get('/api/family/dashboard');
    const data = await response.json();

    // 至少有用户1的2个 + 用户2的1个 = 3个资产
    expect(data.assets.length).toBeGreaterThanOrEqual(3);

    for (const a of data.assets) {
      expect(a.ownerName).toBeDefined();
    }
  });

  test('家庭持仓数 > 任一个人持仓数', async () => {
    const [familyDashRes, user1DashRes] = await Promise.all([
      user1Request.get('/api/family/dashboard'),
      user1Request.get('/api/dashboard'),
    ]);

    const familyDash = await familyDashRes.json();
    const user1Dash = await user1DashRes.json();

    expect(familyDash.holdings.length).toBeGreaterThan(
      user1Dash.allHoldings.length
    );
  });

  test('家庭资产数 > 用户1的个人资产数', async () => {
    const [familyDashRes, assetsRes] = await Promise.all([
      user1Request.get('/api/family/dashboard'),
      user1Request.get('/api/assets'),
    ]);

    const familyDash = await familyDashRes.json();
    const assetsData = await assetsRes.json();

    expect(familyDash.assets.length).toBeGreaterThan(assetsData.data.length);
  });
});

test.describe('Family 数据隔离验证', () => {
  test('用户2的个人 dashboard 只包含自己的持仓', async () => {
    const response = await user2Request.get('/api/dashboard');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // 用户2 只有 1 个 CNY 持仓
    expect(data.allHoldings.length).toBe(1);
    expect(data.overview.holdingCount).toBe(1);
  });

  test('用户2的个人 dashboard 不包含用户1的负债', async () => {
    const response = await user2Request.get('/api/liabilities');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // 用户2 没有负债
    expect(data.data.length).toBe(0);
  });

  test('用户2看到的家庭数据与用户1一致', async () => {
    const [family1Res, family2Res] = await Promise.all([
      user1Request.get('/api/family/overview'),
      user2Request.get('/api/family/overview'),
    ]);

    const family1 = await family1Res.json();
    const family2 = await family2Res.json();

    // 同一家庭，两人看到的家庭总资产应该一致
    expect(family1.totalAssets).toBeCloseTo(family2.totalAssets, 0);
    expect(family1.netWorth).toBeCloseTo(family2.netWorth, 0);
  });
});
