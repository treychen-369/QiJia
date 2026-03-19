import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 测试配置
 * 
 * 运行方式:
 *   npm run e2e          # 运行所有 E2E 测试
 *   npm run e2e:ui       # 打开 Playwright UI 模式（可视化调试）
 *   npm run e2e:headed   # 有头模式运行（看到浏览器操作）
 *   npm run e2e:report   # 查看上次测试报告
 */
export default defineConfig({
  // 测试文件目录
  testDir: './e2e',

  // 每个测试最长运行时间（含 beforeAll hook）
  timeout: 60_000,

  // expect 断言超时
  expect: {
    timeout: 10_000,
  },

  // 测试失败后重试次数
  retries: 1,

  // 并行运行的 worker 数量
  workers: 1, // 单 worker 避免数据库竞争

  // 报告器配置
  reporter: [
    ['list'],                           // 终端输出
    ['html', { open: 'never' }],        // HTML 报告（不自动打开）
  ],

  // 全局配置
  use: {
    // 基础 URL
    baseURL: 'http://localhost:3000',

    // 失败时自动截图
    screenshot: 'only-on-failure',

    // 失败时保存 trace（用于调试回放）
    trace: 'on-first-retry',

    // 视口尺寸
    viewport: { width: 1280, height: 720 },

    // 操作超时
    actionTimeout: 10_000,
  },

  // 浏览器配置
  projects: [
    // 认证 setup：登录并保存状态
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // PC端测试：使用已登录状态
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: /.*\.mobile\.spec\.ts/,
    },

    // 移动端测试：使用 Chromium + 小视口模拟移动端
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 14'],
        // 强制使用 Chromium 而非 WebKit（避免需要安装额外浏览器）
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /.*\.mobile\.spec\.ts/,
    },
  ],

  // 自动启动 dev server（如果没有运行的话）
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true, // 如果 3000 端口已在运行，直接复用
    timeout: 120_000,
  },
});
