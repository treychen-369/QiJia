import { test, expect } from '@playwright/test';

/**
 * 认证流程冒烟测试
 * 
 * 注意：这些测试不依赖 auth.setup 的登录状态，
 * 因为需要测试未登录场景和登录流程本身。
 */
test.describe('认证流程', () => {
  // 不使用全局认证状态
  test.use({ storageState: { cookies: [], origins: [] } });

  test('未登录访问首页 → 展示欢迎页', async ({ page }) => {
    await page.goto('/');
    // 首页应该展示欢迎界面或登录入口
    await expect(page.locator('body')).toBeVisible();
    // 不应该跳转到 dashboard
    expect(page.url()).not.toContain('/dashboard');
  });

  test('未登录访问 dashboard → 重定向到首页', async ({ page }) => {
    // Dashboard 客户端守卫：unauthenticated → router.push('/')
    await page.goto('/dashboard');
    // 应该被重定向到首页（WelcomeScreen）
    await page.waitForURL('/', { timeout: 15_000 });
    expect(page.url()).not.toContain('/dashboard');
  });

  test('登录页 - 空表单验证', async ({ page }) => {
    await page.goto('/auth/signin');

    // 空 email 字段时，HTML5 原生验证会拦截提交
    // 通过 JS 直接调用 submit 绕过浏览器原生验证，触发自定义 validateForm()
    // 但 e.preventDefault() 在 handleSubmit 中，我们直接测试空表单的自定义验证
    // 方法：先 fill 一个值再 clear，确保触发 change 事件
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');

    // 确保字段为空
    await emailInput.fill('');
    await passwordInput.fill('');

    // 通过 evaluate 绕过浏览器原生验证，直接触发表单的 submit 事件
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) {
        const event = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(event);
      }
    });

    // 应该显示验证错误
    await expect(page.locator('text=请输入邮箱地址')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=请输入密码')).toBeVisible({ timeout: 5_000 });
  });

  test('登录页 - 邮箱格式验证', async ({ page }) => {
    await page.goto('/auth/signin');

    // 使用包含 @ 但格式仍不合法的邮箱（绕过 HTML5 type=email 的原生验证）
    // 自定义正则 /\S+@\S+\.\S+/ 要求有 @、点号和后缀
    await page.locator('#email').fill('invalid@email');
    await page.locator('#password').fill('123456');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('text=请输入有效的邮箱地址')).toBeVisible({ timeout: 5_000 });
  });

  test('登录页 - 密码长度验证', async ({ page }) => {
    await page.goto('/auth/signin');

    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('123');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('text=密码至少6位')).toBeVisible({ timeout: 5_000 });
  });

  test('登录页 - 错误密码提示', async ({ page }) => {
    await page.goto('/auth/signin');

    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    // 等待错误提示（可能是 toast 或表单内提示）
    // 登录失败后不应跳转到 dashboard
    await page.waitForTimeout(3_000);
    expect(page.url()).toContain('/auth/signin');
  });

  test('登录成功 → 跳转到 dashboard', async ({ page }) => {
    await page.goto('/auth/signin');

    const email = process.env.E2E_USER_EMAIL || 'admin@example.com';
    const password = process.env.E2E_USER_PASSWORD || 'admin123456';
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('button[type="submit"]').click();

    // signIn('credentials', { redirect: false }) 成功后 router.push('/dashboard')
    // 等待跳转，给足够时间让 NextAuth 完成认证 + 客户端路由跳转
    await page.waitForURL('**/dashboard**', { timeout: 30_000 });
    await expect(page).toHaveURL(/dashboard/);
  });

  test('登录页 - 密码可见切换', async ({ page }) => {
    await page.goto('/auth/signin');

    const passwordInput = page.locator('#password');
    await passwordInput.fill('test123456');

    // 默认是密码模式
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // 点击切换按钮（密码输入框旁边的按钮）
    const toggleBtn = page.locator('#password').locator('..').locator('button[type="button"]');
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');
    }
  });

  test('登录页 - 导航链接可用', async ({ page }) => {
    await page.goto('/auth/signin');

    // 注册链接
    const signupLink = page.locator('a[href="/auth/signup"]');
    await expect(signupLink).toBeVisible();

    // 忘记密码链接
    const forgotLink = page.locator('a[href="/auth/forgot-password"]');
    await expect(forgotLink).toBeVisible();
  });
});
