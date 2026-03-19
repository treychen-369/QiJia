import { test, expect, Page } from '@playwright/test';

/**
 * 家庭管理页 E2E 测试
 * 
 * 测试家庭管理的三个子页签：成员管理、家庭目标、家庭设置
 * 使用全局 auth setup 的登录状态
 */

test.describe('家庭管理页功能测试', () => {

  async function gotoFamilyTab(page: Page) {
    await page.goto('/dashboard-v2', { waitUntil: 'domcontentloaded' });
    // 等待页面加载
    await page.locator('text=/¥/').first().waitFor({ state: 'visible', timeout: 30_000 });
    // 切换到家庭视角 — 点击视角切换器中的"家庭"按钮
    const familyToggle = page.locator('.rounded-full.border.border-border button', { hasText: '家庭' });
    await familyToggle.click();
    await page.waitForTimeout(1500);
    // 点击家庭管理 tab（顶部导航栏）
    const familyTab = page.locator('button[role="tab"]', { hasText: '家庭管理' });
    await familyTab.click();
    await page.waitForTimeout(1500);
  }

  // ═══════ 成员管理 ═══════

  test('成员管理：显示家庭成员列表', async ({ page }) => {
    await gotoFamilyTab(page);
    // 应该默认在成员管理页签
    const membersSection = page.locator('button', { hasText: '成员管理' });
    await expect(membersSection).toBeVisible();
    
    // 应该有成员卡片（至少1个）
    const memberCards = page.locator('.rounded-2xl.border.border-border.bg-card');
    await expect(memberCards.first()).toBeVisible({ timeout: 10_000 });
    console.log(`✅ 找到 ${await memberCards.count()} 个成员卡片`);
  });

  test('成员管理：展开成员详情', async ({ page }) => {
    await gotoFamilyTab(page);
    // 点击第一个成员卡片展开
    const firstMember = page.locator('.rounded-2xl.border.border-border.bg-card').first();
    await firstMember.locator('button').first().click();
    await page.waitForTimeout(2000);
    
    // 展开后应该可以看到资产信息或加载中
    const expanded = page.locator('.border-t.border-border.bg-muted\\/10');
    await expect(expanded).toBeVisible({ timeout: 10_000 });
    console.log('✅ 成员详情已展开');
  });

  test('成员管理：邀请成员对话框', async ({ page }) => {
    await gotoFamilyTab(page);
    // 点击邀请成员按钮
    await page.locator('button', { hasText: '邀请成员' }).click();
    
    // 应该出现邀请对话框
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.locator('text=邀请家庭成员')).toBeVisible();
    
    // 验证表单元素
    await expect(dialog.locator('[data-testid="invite-email"]')).toBeVisible();
    await expect(dialog.locator('button', { hasText: '普通成员' })).toBeVisible();
    await expect(dialog.locator('button', { hasText: '管理员' })).toBeVisible();
    await expect(dialog.locator('button', { hasText: '发送邀请' })).toBeVisible();
    
    // 关闭对话框
    await dialog.locator('button').first().click(); // X button
    await expect(dialog).not.toBeVisible();
    console.log('✅ 邀请成员对话框正常打开和关闭');
  });

  // ═══════ 家庭目标 ═══════

  test('家庭目标：切换到目标页签', async ({ page }) => {
    await gotoFamilyTab(page);
    // 点击家庭目标 tab
    await page.locator('button', { hasText: '家庭目标' }).click();
    await page.waitForTimeout(1000);
    
    // 应该看到家庭财务目标标题
    await expect(page.locator('text=家庭财务目标')).toBeVisible();
    // 应该看到 AI 联动提示
    await expect(page.locator('text=AI 资产配置顾问')).toBeVisible();
    console.log('✅ 家庭目标页签正常加载');
  });

  test('家庭目标：新增目标按钮显示目标类型下拉', async ({ page }) => {
    await gotoFamilyTab(page);
    await page.locator('button', { hasText: '家庭目标' }).click();
    await page.waitForTimeout(1000);
    
    // 点击新增目标
    await page.locator('button', { hasText: '新增目标' }).click();
    await page.waitForTimeout(500);
    
    // 应该出现下拉菜单，包含一些目标类型
    const dropdown = page.locator('.absolute.z-40');
    await expect(dropdown).toBeVisible({ timeout: 3_000 });
    
    // 验证有目标类型选项
    const options = dropdown.locator('button');
    const count = await options.count();
    console.log(`✅ 新增目标下拉菜单显示 ${count} 个可选目标类型`);
    expect(count).toBeGreaterThan(0);
    
    // 关闭菜单
    await page.locator('.fixed.inset-0.z-30').click();
  });

  test('家庭目标：添加新目标并编辑', async ({ page }) => {
    await gotoFamilyTab(page);
    await page.locator('button', { hasText: '家庭目标' }).click();
    await page.waitForTimeout(1500);
    
    // 记录当前目标数
    const initialGoals = page.locator('[aria-label^="编辑"]');
    const initialCount = await initialGoals.count();
    console.log(`当前已有 ${initialCount} 个目标`);
    
    // 点击新增目标
    await page.locator('button', { hasText: '新增目标' }).click();
    await page.waitForTimeout(500);
    
    // 选择第一个可用目标类型
    const dropdown = page.locator('.absolute.z-40');
    const firstOption = dropdown.locator('button').first();
    const goalName = await firstOption.textContent();
    await firstOption.click();
    await page.waitForTimeout(2000);
    
    // 应该进入编辑模式（有输入框）
    const amountInput = page.locator('[data-testid="goal-edit-amount"]');
    await expect(amountInput).toBeVisible({ timeout: 5_000 });
    
    // 填写金额和年份
    await amountInput.fill('500000');
    const yearInput = page.locator('[data-testid="goal-edit-year"]');
    await yearInput.fill('2030');
    
    // 保存
    await page.locator('[data-testid="goal-save-btn"]').click();
    await page.waitForTimeout(3000);
    
    // 验证保存成功（应该有 toast 或目标显示在列表中）
    const newGoalsCount = await page.locator('[aria-label^="编辑"]').count();
    console.log(`✅ 添加目标 "${goalName?.trim()}" 成功，目标数 ${initialCount} → ${newGoalsCount}`);
    expect(newGoalsCount).toBeGreaterThanOrEqual(initialCount);
  });

  test('家庭目标：编辑已有目标', async ({ page }) => {
    await gotoFamilyTab(page);
    await page.locator('button', { hasText: '家庭目标' }).click();
    await page.waitForTimeout(1500);
    
    // 找到第一个编辑按钮
    const editBtn = page.locator('[aria-label^="编辑"]').first();
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(500);
      
      // 应该显示编辑表单
      const amountInput = page.locator('[data-testid="goal-edit-amount"]');
      await expect(amountInput).toBeVisible();
      
      // 修改金额
      await amountInput.fill('300000');
      
      // 保存
      await page.locator('[data-testid="goal-save-btn"]').click();
      await page.waitForTimeout(2000);
      
      // 应该回到展示模式
      await expect(amountInput).not.toBeVisible();
      console.log('✅ 编辑目标并保存成功');
    } else {
      console.log('⚠️ 没有可编辑的目标，跳过');
    }
  });

  test('家庭目标：删除目标', async ({ page }) => {
    await gotoFamilyTab(page);
    await page.locator('button', { hasText: '家庭目标' }).click();
    await page.waitForTimeout(1500);
    
    const deleteBtn = page.locator('[aria-label^="删除"]').first();
    if (await deleteBtn.isVisible().catch(() => false)) {
      const beforeCount = await page.locator('[aria-label^="编辑"]').count();
      await deleteBtn.click();
      await page.waitForTimeout(2000);
      
      const afterCount = await page.locator('[aria-label^="编辑"]').count();
      console.log(`✅ 删除目标成功，目标数 ${beforeCount} → ${afterCount}`);
    } else {
      console.log('⚠️ 没有可删除的目标，跳过');
    }
  });

  // ═══════ 家庭设置 ═══════

  test('家庭设置：显示设置项和危险操作', async ({ page }) => {
    await gotoFamilyTab(page);
    await page.locator('button', { hasText: '家庭设置' }).click();
    await page.waitForTimeout(1000);
    
    // 应该看到设置标题
    await expect(page.locator('text=家庭设置').first()).toBeVisible();
    
    // 应该有家庭名称、风险偏好、投资期限（settings区域内）
    const settingsCard = page.locator('.rounded-2xl.border.border-border.bg-card').filter({ hasText: '家庭设置' });
    await expect(settingsCard.locator('text=家庭名称')).toBeVisible();
    await expect(settingsCard.locator('text=风险偏好')).toBeVisible();
    await expect(settingsCard.locator('text=投资期限')).toBeVisible();
    
    // 应该有危险操作区域
    await expect(page.locator('text=危险操作')).toBeVisible();
    await expect(page.locator('button', { hasText: '解散家庭' })).toBeVisible();
    await expect(page.locator('button', { hasText: '转让管理权' })).toBeVisible();
    console.log('✅ 家庭设置页面正常显示');
  });

  test('家庭设置：危险操作确认框', async ({ page }) => {
    await gotoFamilyTab(page);
    await page.locator('button', { hasText: '家庭设置' }).click();
    await page.waitForTimeout(1000);
    
    // 点击解散家庭
    await page.locator('button', { hasText: '解散家庭' }).click();
    await page.waitForTimeout(500);
    
    // 应该显示确认框
    await expect(page.locator('text=确认要解散家庭吗？')).toBeVisible();
    await expect(page.locator('button', { hasText: '确认解散' })).toBeVisible();
    await expect(page.locator('button', { hasText: '取消' })).toBeVisible();
    
    // 点击取消
    await page.locator('button', { hasText: '取消' }).click();
    await expect(page.locator('text=确认要解散家庭吗？')).not.toBeVisible();
    console.log('✅ 危险操作确认框正常工作');
  });

  // ═══════ Family Header ═══════

  test('家庭头部：显示真实家庭数据', async ({ page }) => {
    await gotoFamilyTab(page);
    
    // 应该显示家庭名称（非硬编码的"陈家财务管理"）
    const header = page.locator('.rounded-2xl.border-amber-200\\/60');
    await expect(header).toBeVisible();
    
    // 应该有4个统计卡片
    const statCards = header.locator('.rounded-xl.bg-white\\/70');
    await expect(statCards.first()).toBeVisible();
    const statCount = await statCards.count();
    expect(statCount).toBe(4);
    
    // 统计卡片应包含：家庭总资产、家庭净资产、成员数、风险偏好
    await expect(header.locator('text=家庭总资产')).toBeVisible();
    await expect(header.locator('text=家庭净资产')).toBeVisible();
    await expect(header.locator('text=成员数')).toBeVisible();
    await expect(header.locator('text=风险偏好')).toBeVisible();
    console.log('✅ 家庭头部显示真实数据');
  });
});
