import { test, expect, APIRequestContext } from '@playwright/test';
import { E2E_TEST_EMAIL, E2E_TEST_PASSWORD, loginAsUser } from './test-auth-helper';

/**
 * 应收款 (Receivables) 功能全量集成测试
 * 
 * 覆盖范围：
 * 1. 分类验证（RECEIVABLE 一级 + 5 个二级）
 * 2. CRUD（创建/查询/修改/删除）
 * 3. 多类型批量创建与归组
 * 4. Dashboard 联动（totalAssets / totalOtherAssets / netWorth 增减）
 * 5. 资产分布（byAssetType / byUnderlyingType / byOverviewGroup）
 * 6. 资产趋势（portfolio history）+ todayPnl
 * 7. 数据完整性（字段、汇率、盈亏）
 * 8. Dashboard ↔ Assets 交叉一致性
 */

const API_TIMEOUT = 30000;
let authedRequest: APIRequestContext;

function api() {
  return {
    get: (url: string, opts?: any) =>
      authedRequest.get(url, { timeout: API_TIMEOUT, ...opts }),
    post: (url: string, opts?: any) =>
      authedRequest.post(url, { timeout: API_TIMEOUT, ...opts }),
    put: (url: string, opts?: any) =>
      authedRequest.put(url, { timeout: API_TIMEOUT, ...opts }),
    delete: (url: string, opts?: any) =>
      authedRequest.delete(url, { timeout: API_TIMEOUT, ...opts }),
  };
}

async function getDashboard() {
  const res = await api().get('/api/dashboard');
  expect(res.ok(), `Dashboard status=${res.status()}`).toBeTruthy();
  return res.json();
}

test.beforeAll(async ({ playwright }) => {
  const seedCtx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
  const seedRes = await seedCtx.post('/api/test/seed', { timeout: 60000 });
  if (!seedRes.ok()) throw new Error(`Seed failed: ${seedRes.status()} - ${await seedRes.text()}`);
  await seedCtx.dispose();

  authedRequest = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
  await loginAsUser(authedRequest, E2E_TEST_EMAIL, E2E_TEST_PASSWORD);
});

test.afterAll(async ({ playwright }) => {
  const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
  await ctx.delete('/api/test/seed', { timeout: 60000 });
  await ctx.dispose();
  await authedRequest?.dispose();
});

// ================================================================
// 第1组：分类验证
// ================================================================
test.describe('应收款分类验证', () => {
  let categories: any[];

  test.beforeAll(async () => {
    const res = await api().get('/api/asset-categories');
    expect(res.ok()).toBeTruthy();
    categories = (await res.json()).data;
  });

  test('RECEIVABLE 一级分类存在', () => {
    const parent = categories.find((c: any) => c.code === 'RECEIVABLE');
    expect(parent).toBeDefined();
    expect(parent.name).toBe('应收款');
    expect(parent.level).toBe(1);
  });

  test('5 个二级分类存在且名称正确', () => {
    const subs = categories.filter((c: any) => c.parent?.code === 'RECEIVABLE');
    expect(subs.length).toBe(5);

    const expected: Record<string, string> = {
      'REC_PERSONAL_LOAN': '个人借款',
      'REC_DEPOSIT': '押金/保证金',
      'REC_SALARY': '薪资/报销',
      'REC_BUSINESS': '商业应收',
      'REC_OTHER': '其他应收',
    };
    for (const [code, name] of Object.entries(expected)) {
      const sub = subs.find((c: any) => c.code === code);
      expect(sub, `${code} 应存在`).toBeDefined();
      expect(sub.name).toBe(name);
      expect(sub.level).toBe(2);
    }
  });
});

// ================================================================
// 第2组：CRUD 完整流程
// ================================================================
test.describe('应收款 CRUD', () => {
  let categoryId: string;
  let assetId: string;

  test.beforeAll(async () => {
    const res = await api().get('/api/asset-categories');
    categoryId = (await res.json()).data.find((c: any) => c.code === 'REC_PERSONAL_LOAN').id;
  });

  test('CREATE: 创建应收款', async () => {
    const res = await api().post('/api/assets', {
      data: {
        name: 'E2E-张三借款',
        assetCategoryId: categoryId,
        purchasePrice: 50000,
        originalValue: 50000,
        currency: 'CNY',
        purchaseDate: '2025-06-01',
        maturityDate: '2026-06-01',
        description: '张三借款5万',
        metadata: { debtorName: '张三', debtorContact: '13800138000', repaymentStatus: 'pending', interestRate: 5.0 },
      },
    });
    expect(res.ok(), `POST status=${res.status()}`).toBeTruthy();
    const { data } = await res.json();
    expect(data.name).toBe('E2E-张三借款');
    expect(data.currentValue).toBeCloseTo(50000, 0);
    expect(data.assetCategory.code).toBe('REC_PERSONAL_LOAN');
    expect(data.assetCategory.parent.code).toBe('RECEIVABLE');
    assetId = data.id;
  });

  test('READ LIST: 列表包含应收款', async () => {
    const { data } = await (await api().get('/api/assets')).json();
    const found = data.find((a: any) => a.id === assetId);
    expect(found).toBeDefined();
    expect(found.name).toBe('E2E-张三借款');
    expect(found.metadata?.debtorName).toBe('张三');
  });

  test('READ DETAIL: 获取单个详情', async () => {
    const { data } = await (await api().get(`/api/assets/${assetId}`)).json();
    expect(data.id).toBe(assetId);
    expect(data.assetCategory.code).toBe('REC_PERSONAL_LOAN');
    expect(data.description).toBe('张三借款5万');
  });

  test('UPDATE: 修改金额和状态', async () => {
    const res = await api().put(`/api/assets/${assetId}`, {
      data: {
        name: 'E2E-张三借款(已部分归还)',
        purchasePrice: 50000,
        currentValue: 30000,
        originalValue: 50000,
        currency: 'CNY',
        metadata: { debtorName: '张三', repaymentStatus: 'partial' },
      },
    });
    expect(res.ok()).toBeTruthy();
    const { data } = await res.json();
    expect(data.name).toContain('已部分归还');
    expect(Number(data.currentValue)).toBeCloseTo(30000, 0);
    expect(data.metadata?.repaymentStatus).toBe('partial');
  });

  test('UPDATE 验证: 持久化', async () => {
    const { data } = await (await api().get(`/api/assets/${assetId}`)).json();
    expect(Number(data.currentValue)).toBeCloseTo(30000, 0);
    expect(data.metadata?.repaymentStatus).toBe('partial');
  });

  test('DELETE: 删除', async () => {
    expect((await api().delete(`/api/assets/${assetId}`)).ok()).toBeTruthy();
  });

  test('DELETE 验证: 不存在', async () => {
    expect((await api().get(`/api/assets/${assetId}`)).status()).toBe(404);
  });
});

// ================================================================
// 第3组：多类型批量创建
// ================================================================
test.describe('多类型应收款', () => {
  const createdIds: string[] = [];

  test.beforeAll(async () => {
    const { data: cats } = await (await api().get('/api/asset-categories')).json();
    const catMap: Record<string, string> = {};
    for (const c of cats) {
      if (c.parent?.code === 'RECEIVABLE') catMap[c.code] = c.id;
    }

    const items = [
      { name: 'E2E-借款-李四', code: 'REC_PERSONAL_LOAN', amount: 20000 },
      { name: 'E2E-租房押金', code: 'REC_DEPOSIT', amount: 6000 },
      { name: 'E2E-1月报销', code: 'REC_SALARY', amount: 3500 },
      { name: 'E2E-客户应收', code: 'REC_BUSINESS', amount: 80000 },
      { name: 'E2E-其他借出', code: 'REC_OTHER', amount: 5000 },
    ];
    for (const item of items) {
      const res = await api().post('/api/assets', {
        data: {
          name: item.name,
          assetCategoryId: catMap[item.code],
          purchasePrice: item.amount,
          originalValue: item.amount,
          currency: 'CNY',
          metadata: { debtorName: '测试', repaymentStatus: 'pending' },
        },
      });
      expect(res.ok(), `创建 ${item.name} status=${res.status()}`).toBeTruthy();
      createdIds.push((await res.json()).data.id);
    }
  });

  test('5 种类型全部创建成功', () => {
    expect(createdIds.length).toBe(5);
  });

  test('应收款归组正确', async () => {
    const { data } = await (await api().get('/api/assets')).json();
    const recs = data.filter((a: any) => a.assetCategory?.parent?.code === 'RECEIVABLE');
    expect(recs.length).toBeGreaterThanOrEqual(5);
    for (const r of recs) {
      expect(r.assetCategory.parent.name).toBe('应收款');
      expect(r.assetCategory.code).toMatch(/^REC_/);
    }
  });

  test('应收款总值 >= 114500', async () => {
    const { data } = await (await api().get('/api/assets')).json();
    const total = data
      .filter((a: any) => a.assetCategory?.parent?.code === 'RECEIVABLE')
      .reduce((s: number, a: any) => s + (a.currentValue || 0), 0);
    expect(total).toBeGreaterThanOrEqual(114500);
  });

  test.afterAll(async () => {
    for (const id of createdIds) await api().delete(`/api/assets/${id}`);
  });
});

// ================================================================
// 第4组：Dashboard 联动
// ================================================================
test.describe('Dashboard 联动', () => {
  let assetId: string;
  let dashBefore: any;
  const AMOUNT = 100000;

  test.beforeAll(async () => {
    const { data: cats } = await (await api().get('/api/asset-categories')).json();
    const catId = cats.find((c: any) => c.code === 'REC_PERSONAL_LOAN').id;

    dashBefore = await getDashboard();

    const res = await api().post('/api/assets', {
      data: {
        name: 'E2E-联动-10万借款',
        assetCategoryId: catId,
        purchasePrice: AMOUNT,
        originalValue: AMOUNT,
        currency: 'CNY',
        metadata: { debtorName: '测试', repaymentStatus: 'pending' },
      },
    });
    expect(res.ok()).toBeTruthy();
    assetId = (await res.json()).data.id;
  });

  test('totalAssets 增加约 10 万', async () => {
    const dash = await getDashboard();
    const diff = dash.overview.totalAssets - dashBefore.overview.totalAssets;
    expect(diff).toBeGreaterThan(AMOUNT * 0.99);
    expect(diff).toBeLessThan(AMOUNT * 1.01);
  });

  test('totalOtherAssets 增加约 10 万', async () => {
    const dash = await getDashboard();
    const diff = dash.overview.totalOtherAssets - dashBefore.overview.totalOtherAssets;
    expect(diff).toBeGreaterThan(AMOUNT * 0.99);
    expect(diff).toBeLessThan(AMOUNT * 1.01);
  });

  test('netWorth 增加约 10 万', async () => {
    const dash = await getDashboard();
    const diff = dash.overview.netWorth - dashBefore.overview.netWorth;
    expect(diff).toBeGreaterThan(AMOUNT * 0.99);
    expect(diff).toBeLessThan(AMOUNT * 1.01);
  });

  test('删除后 totalAssets 恢复', async () => {
    expect((await api().delete(`/api/assets/${assetId}`)).ok()).toBeTruthy();
    assetId = '';
    const dash = await getDashboard();
    const diff = Math.abs(dash.overview.totalAssets - dashBefore.overview.totalAssets);
    expect(diff).toBeLessThan(AMOUNT * 0.01);
  });

  test.afterAll(async () => {
    if (assetId) await api().delete(`/api/assets/${assetId}`);
  });
});

// ================================================================
// 第5组：资产分布 + 底层敞口 + 趋势
// ================================================================
test.describe('资产分布与趋势', () => {
  let assetId: string;
  let dashData: any;
  const AMOUNT = 100000;

  test.beforeAll(async () => {
    const { data: cats } = await (await api().get('/api/asset-categories')).json();
    const catId = cats.find((c: any) => c.code === 'REC_PERSONAL_LOAN').id;

    const res = await api().post('/api/assets', {
      data: {
        name: 'E2E-分布-10万',
        assetCategoryId: catId,
        purchasePrice: AMOUNT,
        originalValue: AMOUNT,
        currency: 'CNY',
        metadata: { debtorName: '测试', repaymentStatus: 'pending' },
      },
    });
    expect(res.ok()).toBeTruthy();
    assetId = (await res.json()).data.id;
    dashData = await getDashboard();
  });

  test('byAssetType 包含 RECEIVABLE', () => {
    const r = dashData.dualViewPortfolio.byAssetType.find((t: any) => t.type === 'RECEIVABLE');
    expect(r).toBeDefined();
    expect(r.typeName).toBe('应收款');
    expect(r.value).toBeGreaterThanOrEqual(AMOUNT * 0.99);
    expect(r.percentage).toBeGreaterThan(0);
  });

  test('byUnderlyingType 包含 RECEIVABLE', () => {
    const r = dashData.underlyingTypePortfolio.byUnderlyingType.find((t: any) => t.code === 'RECEIVABLE');
    expect(r).toBeDefined();
    expect(r.name).toBe('应收款');
    expect(r.value).toBeGreaterThanOrEqual(AMOUNT * 0.99);
  });

  test('overviewGroup RECEIVABLE 独立分组包含应收款', () => {
    const rec = dashData.underlyingTypePortfolio.byOverviewGroup.find((g: any) => g.code === 'RECEIVABLE');
    expect(rec).toBeDefined();
    expect(rec.value).toBeGreaterThanOrEqual(AMOUNT * 0.99);
  });

  test('portfolio history 正常返回', async () => {
    const res = await api().get('/api/portfolio/history?days=30');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.trend.length).toBeGreaterThanOrEqual(1);
    expect(data.data.trend[0].totalValue).toBeGreaterThan(0);
  });

  test('todayPnl 不为 NaN', () => {
    expect(isFinite(dashData.overview.todayPnl)).toBe(true);
    expect(isFinite(dashData.overview.todayPnlPercent)).toBe(true);
  });

  test.afterAll(async () => {
    if (assetId) await api().delete(`/api/assets/${assetId}`);
  });
});

// ================================================================
// 第6组：数据完整性
// ================================================================
test.describe('数据完整性', () => {
  let assetId: string;

  test.beforeAll(async () => {
    const { data: cats } = await (await api().get('/api/asset-categories')).json();
    const catId = cats.find((c: any) => c.code === 'REC_DEPOSIT').id;

    const res = await api().post('/api/assets', {
      data: {
        name: 'E2E-完整性-押金',
        assetCategoryId: catId,
        purchasePrice: 8000,
        originalValue: 8000,
        currency: 'CNY',
        purchaseDate: '2025-01-15',
        maturityDate: '2026-01-15',
        description: '租房押金',
        metadata: { debtorName: '房东', debtorContact: '13900139000', depositType: 'rent', depositAddress: '北京朝阳区', repaymentStatus: 'pending' },
      },
    });
    assetId = (await res.json()).data.id;
  });

  test('字段完整', async () => {
    const { data } = await (await api().get(`/api/assets/${assetId}`)).json();
    expect(data.name).toBe('E2E-完整性-押金');
    expect(data.description).toBe('租房押金');
    expect(data.currency).toBe('CNY');
    expect(Number(data.purchasePrice)).toBe(8000);
    expect(Number(data.currentValue)).toBeCloseTo(8000, 0);
    expect(data.assetCategory.code).toBe('REC_DEPOSIT');
    expect(data.assetCategory.parent.code).toBe('RECEIVABLE');
    const m = data.metadata || {};
    expect(m.debtorName).toBe('房东');
    expect(m.depositType).toBe('rent');
    expect(m.repaymentStatus).toBe('pending');
  });

  test('CNY 汇率 = 1', async () => {
    const { data } = await (await api().get('/api/assets')).json();
    expect(data.find((a: any) => a.id === assetId).exchangeRate).toBe(1);
  });

  test('盈亏为 0', async () => {
    const { data } = await (await api().get('/api/assets')).json();
    expect(Math.abs(data.find((a: any) => a.id === assetId).unrealizedPnl || 0)).toBeLessThan(1);
  });

  test.afterAll(async () => {
    if (assetId) await api().delete(`/api/assets/${assetId}`);
  });
});

// ================================================================
// 第7组：交叉一致性
// ================================================================
test.describe('交叉一致性', () => {
  const createdIds: string[] = [];

  test.beforeAll(async () => {
    const catId = (await (await api().get('/api/asset-categories')).json()).data
      .find((c: any) => c.code === 'REC_PERSONAL_LOAN').id;

    for (const r of [{ name: 'E2E-交叉A', amount: 35000 }, { name: 'E2E-交叉B', amount: 65000 }]) {
      const res = await api().post('/api/assets', {
        data: {
          name: r.name,
          assetCategoryId: catId,
          purchasePrice: r.amount,
          originalValue: r.amount,
          currency: 'CNY',
          metadata: { debtorName: '测试', repaymentStatus: 'pending' },
        },
      });
      createdIds.push((await res.json()).data.id);
    }
  });

  test('Dashboard cash+other ≈ Assets API 总值', async () => {
    const [dash, assetsRes] = await Promise.all([getDashboard(), api().get('/api/assets')]);
    const assetsSum = (await assetsRes.json()).data.reduce((s: number, a: any) => s + (a.currentValue || 0), 0);
    const dashSum = dash.overview.totalCashAssets + dash.overview.totalOtherAssets;
    expect(Math.abs(dashSum - assetsSum)).toBeLessThan(Math.max(assetsSum * 0.01, 100));
  });

  test('netWorth = totalAssets - totalLiabilities', async () => {
    const { overview } = await getDashboard();
    expect(overview.netWorth).toBeCloseTo(overview.totalAssets - overview.totalLiabilities, 0);
  });

  test.afterAll(async () => {
    for (const id of createdIds) await api().delete(`/api/assets/${id}`);
  });
});
