import { test, expect, Page } from '@playwright/test';

/**
 * 设置页 E2E 测试
 *
 * 验证设置修改后的 **实际视觉效果**：
 * - 主题切换 → html.dark
 * - 涨跌颜色 → 总览页颜色变化
 * - 金额格式 → 总览页金额显示方式变化
 * - 默认隐藏 → 刷新后金额显示 ****
 * - 默认视图 → 刷新后进入家庭模式
 */

test.describe('设置页功能与实际效果', () => {

  async function gotoSettings(page: Page) {
    await page.goto('/dashboard-v2', { waitUntil: 'domcontentloaded' });
    // 等待数据加载完成
    await page.locator('.rounded-2xl.border').first().waitFor({ state: 'visible', timeout: 30_000 });
    // 等额外一点确保 settings 从 localStorage 加载完
    await page.waitForTimeout(500);
    // 点击设置 tab
    const settingsTab = page.locator('button[role="tab"]', { hasText: '设置' });
    await settingsTab.click();
    await page.waitForTimeout(500);
  }

  async function gotoOverview(page: Page) {
    const overviewTab = page.locator('button[role="tab"]', { hasText: '总览' });
    await overviewTab.click();
    await page.waitForTimeout(500);
  }

  /** 清除测试后的设置，恢复默认 */
  async function resetSettings(page: Page) {
    await page.evaluate(() => localStorage.removeItem('qijia-settings'));
  }

  // ─── 基础 ───

  test('显示所有设置分区', async ({ page }) => {
    await gotoSettings(page);
    await expect(page.locator('text=外观主题')).toBeVisible();
    await expect(page.locator('text=显示偏好')).toBeVisible();
    await expect(page.locator('text=数据设置')).toBeVisible();
    await expect(page.locator('text=通知提醒')).toBeVisible();
    await expect(page.locator('text=AI 智能配置')).toBeVisible();
    await expect(page.getByRole('main').getByText('已同步')).toBeVisible();
  });

  // ─── 主题切换 → 真正变深色 ───

  test('主题切换：深色模式实际生效（html.dark）', async ({ page }) => {
    await gotoSettings(page);
    // 点击深色
    await page.locator('button', { hasText: '深色' }).filter({ hasText: '暗夜护眼' }).click();
    await page.waitForTimeout(500);
    // 验证 <html> 拿到了 dark class
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('dark');
    // 恢复浅色
    await page.locator('button', { hasText: '浅色' }).filter({ hasText: '明亮清新' }).click();
    await page.waitForTimeout(300);
    const htmlClass2 = await page.locator('html').getAttribute('class');
    expect(htmlClass2).not.toContain('dark');
    await resetSettings(page);
  });

  // ─── 涨跌颜色 → 总览页颜色变化 ───

  test('涨跌颜色：切换后总览页盈亏颜色改变', async ({ page }) => {
    await gotoSettings(page);

    // 先设为默认 涨红跌绿
    await page.locator('button', { hasText: '涨红跌绿' }).click();
    await page.waitForTimeout(300);

    // 切到总览页，找到累计盈亏数字区域
    await gotoOverview(page);
    // 获取累计盈亏颜色 class（在 stat-cards 里）
    const pnlElement = page.locator('text=/累计/').first();
    await expect(pnlElement).toBeVisible();
    const pnlParent = pnlElement.locator('..');
    const classListRedGreen = await pnlParent.getAttribute('class');

    // 回到设置页，切为 涨绿跌红
    const settingsTab = page.locator('button[role="tab"]', { hasText: '设置' });
    await settingsTab.click();
    await page.waitForTimeout(500);
    await page.locator('button', { hasText: '涨绿跌红' }).click();
    await page.waitForTimeout(300);

    // 再回到总览，颜色应该变了
    await gotoOverview(page);
    const pnlElement2 = page.locator('text=/累计/').first();
    await expect(pnlElement2).toBeVisible();
    const pnlParent2 = pnlElement2.locator('..');
    const classListGreenRed = await pnlParent2.getAttribute('class');

    // 两种配色方案的 class 应该不同
    // red-green: positive → text-red-600, green-red: positive → text-emerald-600
    expect(classListRedGreen).not.toBe(classListGreenRed);

    // 恢复
    await resetSettings(page);
  });

  // ─── 金额格式 → 总览页金额显示变化 ───

  test('金额格式：compact 显示万，full 显示完整数字', async ({ page }) => {
    await gotoSettings(page);

    // 先设为 compact
    await page.locator('button', { hasText: '¥692万' }).click();
    await page.waitForTimeout(300);

    // 去总览看
    await gotoOverview(page);
    // stat-cards 里的总资产金额（第一个大数字）
    const amountEl = page.locator('.text-2xl.font-bold').first();
    await expect(amountEl).toBeVisible();
    const compactText = await amountEl.textContent();
    // compact 模式应该包含 "万" (如果金额>10000) 或者是短格式
    // 注意金额可能是 ¥XXX万 或 ¥XXXX（如果<10000）

    // 回到设置，切为 full
    const settingsTab = page.locator('button[role="tab"]', { hasText: '设置' });
    await settingsTab.click();
    await page.waitForTimeout(500);
    await page.locator('button', { hasText: '¥6,920,000' }).click();
    await page.waitForTimeout(300);

    // 再去总览看
    await gotoOverview(page);
    const amountEl2 = page.locator('.text-2xl.font-bold').first();
    await expect(amountEl2).toBeVisible();
    const fullText = await amountEl2.textContent();

    // full 格式应该包含小数点和逗号，不包含"万"
    // 如果金额足够大 (>10000)，compact 有"万"，full 没有
    if (compactText && compactText.includes('万')) {
      expect(fullText).not.toContain('万');
      expect(fullText).toContain('.');
    }

    // 恢复为 compact
    await settingsTab.click();
    await page.waitForTimeout(500);
    await page.locator('button', { hasText: '¥692万' }).click();
    await page.waitForTimeout(300);
    await resetSettings(page);
  });

  // ─── 默认隐藏金额 → 刷新后金额变 **** ───

  test('默认隐藏金额：开启后刷新页面金额显示 ****', async ({ page }) => {
    await gotoSettings(page);

    // 开启默认隐藏
    const toggle = page.locator('button[role="switch"]').first();
    await toggle.click();
    await page.waitForTimeout(300);
    // 验证 aria-checked
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    // 刷新页面（模拟下次进入）
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.rounded-2xl.border').first().waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(1000);

    // 总览页的金额应该显示 ****
    const amountEl = page.locator('.text-2xl.font-bold').first();
    await expect(amountEl).toBeVisible();
    const text = await amountEl.textContent();
    expect(text).toContain('****');

    // 恢复：进设置关闭
    const settingsTab = page.locator('button[role="tab"]', { hasText: '设置' });
    await settingsTab.click();
    await page.waitForTimeout(500);
    await page.locator('button[role="switch"]').first().click();
    await page.waitForTimeout(300);
    await resetSettings(page);
  });

  // ─── 默认视图 → 刷新后进入家庭模式 ───

  test('默认视图：设为家庭后刷新页面默认家庭视角', async ({ page }) => {
    await gotoSettings(page);

    // 切为家庭
    const familyBtn = page.locator('section').filter({ hasText: '显示偏好' }).locator('button', { hasText: '家庭' });
    await familyBtn.click();
    await page.waitForTimeout(1000);

    // 刷新
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.rounded-2xl.border').first().waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(1000);

    // 家庭模式下 header 应该有家庭管理 tab
    const familyTab = page.locator('button[role="tab"]', { hasText: '家庭管理' });
    await expect(familyTab).toBeVisible();

    // 恢复为个人
    await page.evaluate(() => localStorage.removeItem('qijia-settings'));
    await page.reload({ waitUntil: 'domcontentloaded' });
  });

  // ─── 通知设置 ───

  test('通知提醒：到期天数和大额变动开关', async ({ page }) => {
    await gotoSettings(page);

    // 切换到 15 天
    await page.locator('button', { hasText: '15 天' }).click();
    await page.waitForTimeout(300);
    let settings = await page.evaluate(() => {
      const raw = localStorage.getItem('qijia-settings');
      return raw ? JSON.parse(raw) : null;
    });
    expect(settings?.reminderDays).toBe(15);

    // 关闭大额变动提醒
    const alertToggle = page.locator('button[role="switch"]').last();
    await alertToggle.click();
    await page.waitForTimeout(300);
    // 阈值按钮消失
    await expect(page.locator('button', { hasText: '10%' })).not.toBeVisible();
    // 重新开启
    await alertToggle.click();
    await page.waitForTimeout(300);
    await expect(page.locator('button', { hasText: '5%' })).toBeVisible();

    await resetSettings(page);
  });

  // ─── AI 配置 ───

  test('AI 配置：切换分析频率', async ({ page }) => {
    await gotoSettings(page);
    await page.locator('button', { hasText: '手动触发' }).click();
    await page.waitForTimeout(300);
    const settings = await page.evaluate(() => {
      const raw = localStorage.getItem('qijia-settings');
      return raw ? JSON.parse(raw) : null;
    });
    expect(settings?.aiFrequency).toBe('manual');
    // 切回每周
    await page.locator('section').filter({ hasText: 'AI 智能配置' }).locator('button', { hasText: '每周' }).click();
    await page.waitForTimeout(300);
    await resetSettings(page);
  });

  // ─── 持久化 ───

  test('持久化：刷新页面后设置保持', async ({ page }) => {
    await gotoSettings(page);

    // 做一些修改
    await page.locator('button', { hasText: '深色' }).filter({ hasText: '暗夜护眼' }).click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: '涨绿跌红' }).click();
    await page.waitForTimeout(300);

    // 刷新
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.rounded-2xl.border').first().waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(500);

    // 验证 html 还是 dark
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('dark');

    // 验证 localStorage 值
    const settings = await page.evaluate(() => {
      const raw = localStorage.getItem('qijia-settings');
      return raw ? JSON.parse(raw) : null;
    });
    expect(settings?.theme).toBe('dark');
    expect(settings?.pnlColor).toBe('green-red');

    // 恢复
    await resetSettings(page);
  });

});
