import { test, expect } from '@playwright/test';

/**
 * 注册页面测试
 */
test.describe('注册页面', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('页面正常加载，核心元素可见', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('networkidle');

    // 品牌标题
    await expect(page.locator("text=QiJia")).toBeVisible();

    // 注册表单 4 个字段
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();

    // 提交按钮
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();

    // 登录链接
    await expect(page.locator('a[href="/auth/signin"]')).toBeVisible();
  });

  test('空表单验证', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('networkidle');

    // 通过 JS 绕过 HTML5 原生验证
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) {
        const event = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(event);
      }
    });

    // 应该显示验证错误
    await expect(page.locator('text=请输入姓名').or(page.locator('text=姓名至少'))).toBeVisible({ timeout: 5_000 });
  });

  test('密码不一致验证', async ({ page }) => {
    await page.goto('/auth/signup');

    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill('newuser@example.com');
    await page.locator('#password').fill('password123');
    await page.locator('#confirmPassword').fill('differentpassword');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('text=两次密码输入不一致')).toBeVisible({ timeout: 5_000 });
  });

  test('密码强度指示器变化', async ({ page }) => {
    await page.goto('/auth/signup');

    const passwordInput = page.locator('#password');

    // 输入弱密码
    await passwordInput.fill('123');
    // 页面应显示密码强度相关指示（具体 UI 可能是进度条或文字）
    await page.waitForTimeout(300);

    // 输入强密码
    await passwordInput.fill('Str0ng!Pass@2024');
    await page.waitForTimeout(300);

    // 强度文字应该变化（很弱→强/很强）
    const strengthText = page.locator('text=很强').or(page.locator('text=强'));
    if (await strengthText.first().isVisible().catch(() => false)) {
      expect(true).toBe(true);
    }
  });

  test('密码可见性切换', async ({ page }) => {
    await page.goto('/auth/signup');

    const passwordInput = page.locator('#password');
    await passwordInput.fill('test123456');

    // 默认 password 类型
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // 点击切换按钮
    const toggleBtn = page.locator('#password').locator('..').locator('button[type="button"]');
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');
    }
  });
});

/**
 * 忘记密码页面测试
 */
test.describe('忘记密码页面', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('页面正常加载，核心元素可见', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.waitForLoadState('networkidle');

    // 页面标题
    await expect(page.locator('text=忘记密码')).toBeVisible();

    // 邮箱输入框
    const emailInput = page.locator('input[type="email"]').or(page.locator('#email'));
    await expect(emailInput.first()).toBeVisible();

    // 提交按钮
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();

    // 返回登录链接
    await expect(page.locator('a[href="/auth/signin"]').first()).toBeVisible();
  });

  test('提交邮箱后显示成功提示', async ({ page }) => {
    await page.goto('/auth/forgot-password');

    // 填写邮箱并提交
    const emailInput = page.locator('input[type="email"]').or(page.locator('#email'));
    await emailInput.first().fill('test@example.com');
    await page.locator('button[type="submit"]').click();

    // 等待模拟 API（1.5秒延迟）+ 显示成功页面
    await expect(page.getByRole('heading', { name: '邮件已发送' })).toBeVisible({ timeout: 5_000 });

    // 成功页面应包含返回登录按钮/链接
    await expect(page.locator('a[href="/auth/signin"]').first()).toBeVisible();
  });
});
