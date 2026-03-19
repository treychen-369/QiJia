import { test, expect, Page } from '@playwright/test';

/**
 * Dashboard V2 E2E 测试
 *
 * 使用全局 auth setup 的登录状态（storageState: user.json）
 * 无需每个测试重新登录，极大加速测试执行。
 *
 * 策略：
 * - beforeAll 获取 V1 API 基准数据（~5-10s）
 * - 用 page.route 拦截浏览器端 API 请求，避免 dev server SSR+API 并发瓶颈
 * - stat-cards 数值与 V1 API 交叉验证
 */

test.describe('Dashboard V2 全量测试', () => {
  let v1Data: any;
  let monthlyChangesData: any;
  let notificationsData: any;

  // 获取 V1 API 基准数据（只需一次，复用全局 auth cookies）
  test.beforeAll(async ({ request }) => {
    const [dashResp, mcResp, notifResp] = await Promise.all([
      request.get('/api/dashboard', { timeout: 45_000 }),
      request.get('/api/portfolio/monthly-changes', { timeout: 30_000 }),
      request.get('/api/notifications', { timeout: 30_000 }),
    ]);
    if (!dashResp.ok()) {
      const body = await dashResp.text();
      throw new Error(`/api/dashboard 返回 ${dashResp.status()}: ${body.substring(0, 500)}`);
    }
    v1Data = await dashResp.json();
    if (mcResp.ok()) {
      monthlyChangesData = await mcResp.json();
    }
    if (notifResp.ok()) {
      notificationsData = await notifResp.json();
    }
  });

  /**
   * 拦截所有 V2 页面依赖的 API 请求。
   * 用 beforeAll 中获取的真实数据直接 fulfill，
   * 避免 dev server 同时处理页面 SSR + 多个 API 请求导致的并发超时。
   */
  async function interceptApis(page: Page) {
    await page.route(/\/api\/dashboard(\?|$)/, route => {
      if (v1Data) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(v1Data),
        });
      } else {
        route.continue();
      }
    });
    await page.route(/\/api\/assets(\?|$)/, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[]}' });
    });
    await page.route(/\/api\/liabilities(\?|$)/, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[]}' });
    });
    await page.route('**/api/family/**', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.route(/\/api\/portfolio\/monthly-changes(\?|$)/, route => {
      if (monthlyChangesData) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(monthlyChangesData),
        });
      } else {
        route.continue();
      }
    });
    await page.route(/\/api\/notifications(\?|$)/, route => {
      if (notificationsData) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(notificationsData),
        });
      } else {
        route.continue();
      }
    });
  }

  /** 导航到 V2 页面（仅等 DOM 就绪，不等所有资源加载完） */
  async function gotoV2(page: Page) {
    await page.goto('/dashboard-v2', { waitUntil: 'domcontentloaded' });
  }

  /** 导航到 V2 并等待 stat-card 数据渲染完成 */
  async function gotoV2WithData(page: Page) {
    await interceptApis(page);
    await page.goto('/dashboard-v2', { waitUntil: 'domcontentloaded' });
    // 等待 stat-card ¥XX万 或 ¥XX.X万 数字渲染出来
    await page.locator('text=/¥[\\d.]+万/').first().waitFor({
      state: 'visible',
      timeout: 15_000,
    });
  }

  // ============================================================
  // Step 1: 基础可访问性
  // ============================================================

  test('V2 页面可访问且不报错', async ({ page }) => {
    await interceptApis(page);
    await gotoV2(page);

    expect(page.url()).toContain('/dashboard-v2');
    const errorCount = await page.locator('text=加载失败').count();
    expect(errorCount).toBe(0);
  });

  test('V2 页面显示 header 和 tab 导航', async ({ page }) => {
    await interceptApis(page);
    await gotoV2(page);
    // header 在数据加载前就渲染了
    await page.waitForTimeout(2000);

    const header = page.locator('header');
    await expect(header).toBeVisible();

    const overviewTab = page.locator('button[role="tab"]', { hasText: '总览' });
    await expect(overviewTab).toBeVisible();
  });

  // ============================================================
  // Step 2: stat-cards 与 V1 API 交叉验证
  // ============================================================

  test('API 数据基准检查：overview 字段完整', () => {
    expect(v1Data.overview).toBeDefined();
    expect(typeof v1Data.overview.totalAssets).toBe('number');
    expect(typeof v1Data.overview.netWorth).toBe('number');
    expect(typeof v1Data.overview.totalLiabilities).toBe('number');
    expect(v1Data.overview.totalAssets).toBeGreaterThan(0);
  });

  test('V2 stat-cards 总资产与 V1 API 一致（万元级别）', async ({ page }) => {
    const expectedWan = v1Data.overview.totalAssets / 10000;

    await gotoV2WithData(page);

    const text = await page.locator('text=/¥[\\d.]+万/').first().textContent();
    expect(text).toBeTruthy();
    const match = text!.match(/¥([\d.]+)万/);
    expect(match).toBeTruthy();
    const displayWan = parseFloat(match![1]);

    // 允许 ±0.2 万的舍入误差（显示使用 toFixed(1)）
    expect(Math.abs(displayWan - expectedWan)).toBeLessThanOrEqual(0.2);
  });

  test('V2 净资产与 V1 API 一致', async ({ page }) => {
    const expectedNetWorthWan = v1Data.overview.netWorth / 10000;

    await gotoV2WithData(page);

    const wanNumbers = await page.locator('text=/¥[\\d.]+万/').allTextContents();
    expect(wanNumbers.length).toBeGreaterThanOrEqual(2);

    const match = wanNumbers[1].match(/¥([\d.]+)万/);
    expect(match).toBeTruthy();
    const displayWan = parseFloat(match![1]);

    // 允许 ±0.2 万的舍入误差
    expect(Math.abs(displayWan - expectedNetWorthWan)).toBeLessThanOrEqual(0.2);
  });

  // ============================================================
  // Step 3: 资产构成验证
  // ============================================================

  test('资产构成饼图使用真实数据（分组数匹配）', async ({ page }) => {
    const expectedGroups = (v1Data.underlyingTypePortfolio?.byOverviewGroup || [])
      .filter((g: any) => g.value > 0);

    await gotoV2WithData(page);

    const title = page.locator('h3', { hasText: '资产构成' });
    await expect(title).toBeVisible();

    const legendButtons = page.locator('button[aria-pressed]');
    const count = await legendButtons.count();
    expect(count).toBe(expectedGroups.length);
  });

  test('资产 TOP 5 列表有真实数据', async ({ page }) => {
    await gotoV2WithData(page);

    const topTitle = page.locator('h3', { hasText: '资产 TOP 5' });
    await expect(topTitle).toBeVisible();

    if (v1Data.allHoldings?.length > 0) {
      const topHoldingName = v1Data.allHoldings[0].name;
      const nameInList = page.locator(`text=${topHoldingName}`).first();
      await expect(nameInList).toBeVisible({ timeout: 10_000 });
    }
  });

  // ============================================================
  // Step 3.5: 本月资产变动
  // ============================================================

  test('本月资产变动 API 返回有效数据', () => {
    expect(monthlyChangesData).toBeTruthy();
    expect(monthlyChangesData.success).toBe(true);
    expect(monthlyChangesData.data).toBeDefined();
    expect(typeof monthlyChangesData.data.netWorthChange).toBe('number');
    expect(Array.isArray(monthlyChangesData.data.items)).toBe(true);
  });

  test('本月资产变动卡片渲染真实数据', async ({ page }) => {
    await gotoV2WithData(page);

    // 卡片标题可见
    const title = page.locator('text=本月资产变动');
    await expect(title).toBeVisible({ timeout: 10_000 });

    // 净资产变化标签可见
    const netWorthLabel = page.locator('text=净资产变化');
    await expect(netWorthLabel).toBeVisible();

    // 无"待开发"标签
    const devTag = page.locator('text=本月资产变动').locator('..').locator('text=待开发');
    expect(await devTag.count()).toBe(0);

    // 有变动项目（至少一条）
    if (monthlyChangesData?.data?.items?.length > 0) {
      const firstItemName = monthlyChangesData.data.items[0].name;
      const itemInPage = page.locator(`text=${firstItemName}`).first();
      await expect(itemInPage).toBeVisible({ timeout: 10_000 });
    }
  });

  // ============================================================
  // Step 3.6: 通知系统
  // ============================================================

  test('通知 API 返回有效数据结构', () => {
    expect(notificationsData).toBeTruthy();
    expect(notificationsData.success).toBe(true);
    expect(notificationsData.data).toBeDefined();
    expect(typeof notificationsData.data.total).toBe('number');
    expect(typeof notificationsData.data.urgentCount).toBe('number');
    expect(Array.isArray(notificationsData.data.notifications)).toBe(true);
    expect(Array.isArray(notificationsData.data.upcomingEvents)).toBe(true);
    expect(notificationsData.data.generatedAt).toBeTruthy();
  });

  test('通知铃铛显示真实通知数', async ({ page }) => {
    await gotoV2WithData(page);

    // 铃铛按钮可见
    const bellBtn = page.locator('button[aria-label="通知提醒"]');
    await expect(bellBtn).toBeVisible({ timeout: 10_000 });

    // 如果有通知，badge 应显示数量
    if (notificationsData?.data?.total > 0) {
      // badge should be visible (red circle)
      const badge = bellBtn.locator('span.bg-red-500');
      await expect(badge).toBeVisible();
    }
  });

  test('通知下拉面板显示真实数据', async ({ page }) => {
    await gotoV2WithData(page);

    // 点击铃铛
    const bellBtn = page.locator('button[aria-label="通知提醒"]');
    await bellBtn.click();

    // 面板标题可见
    const panelTitle = page.locator('text=通知提醒').last();
    await expect(panelTitle).toBeVisible({ timeout: 5_000 });

    // 如果有通知，应显示第一条通知的标题
    const notifs = notificationsData?.data?.notifications || [];
    if (notifs.length > 0) {
      const firstTitle = notifs[0].title;
      const titleInPanel = page.locator(`text=${firstTitle}`).first();
      await expect(titleInPanel).toBeVisible({ timeout: 5_000 });
    }
  });

  test('即将到期卡片无"待开发"标签', async ({ page }) => {
    await gotoV2WithData(page);

    const title = page.locator('text=即将到期');
    await expect(title).toBeVisible({ timeout: 10_000 });

    // 不应该有"待开发"标签
    const devTag = page.locator('text=待开发');
    expect(await devTag.count()).toBe(0);
  });

  test('设置页通知来源管理可见', async ({ page }) => {
    await interceptApis(page);
    await page.goto('/dashboard-v2', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 切换到设置 tab
    const settingsBtn = page.locator('button[role="tab"]', { hasText: '设置' });
    if (await settingsBtn.count() > 0) {
      await settingsBtn.click();
    } else {
      // 可能是设置齿轮按钮
      const gearBtn = page.locator('button').filter({ has: page.locator('svg.lucide-settings') }).last();
      await gearBtn.click();
    }

    // 通知来源管理标题可见
    const sourceTitle = page.locator('text=通知来源管理');
    await expect(sourceTitle).toBeVisible({ timeout: 10_000 });

    // 各来源选项可见
    await expect(page.locator('text=存款/国债到期')).toBeVisible();
    await expect(page.locator('text=还款日提醒')).toBeVisible();
    await expect(page.locator('text=大额变动通知')).toBeVisible();
    await expect(page.locator('text=AI 配置建议')).toBeVisible();
  });

  // ============================================================
  // Step 4: 版本切换
  // ============================================================

  test('V2 有"旧版"按钮，点击可跳转到 V1', async ({ page }) => {
    await interceptApis(page);
    await gotoV2(page);
    await page.waitForTimeout(2000);

    const oldVersionBtn = page.locator('button', { hasText: '旧版' });
    await expect(oldVersionBtn).toBeVisible();
    await oldVersionBtn.click();

    await page.waitForURL('**/dashboard', { timeout: 15_000 });
    expect(page.url()).toContain('/dashboard');
    expect(page.url()).not.toContain('/dashboard-v2');
  });

  test('V1 有"体验新版"按钮，点击可跳转到 V2', async ({ page }) => {
    // V1 页面也拦截 API，避免 dev server 并发瓶颈导致加载缓慢
    await interceptApis(page);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // 等待按钮渲染（而非固定 waitForTimeout）
    const newVersionBtn = page.locator('button', { hasText: '体验新版' });
    await newVersionBtn.waitFor({ state: 'visible', timeout: 30_000 });
    await newVersionBtn.click();

    await page.waitForURL('**/dashboard-v2', { timeout: 15_000 });
    expect(page.url()).toContain('/dashboard-v2');
  });
});
