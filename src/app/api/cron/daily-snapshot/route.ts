/**
 * 定时任务 API - 每日快照
 * 
 * POST /api/cron/daily-snapshot
 * 
 * 用于服务器 crontab 调用，为所有用户创建每日快照
 * 
 * 安全机制：
 * - 只接受来自 localhost 的请求
 * - 或者带有正确的 CRON_SECRET 头
 * 
 * crontab 配置示例（服务器上）：
 * 30 0 * * * curl -X POST http://localhost:3000/api/cron/daily-snapshot -H "x-cron-secret: YOUR_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { SnapshotService } from '@/lib/services/snapshot-service';

// 验证请求来源
function isAuthorized(request: NextRequest): boolean {
  // 1. 检查是否来自 localhost
  const host = request.headers.get('host') || '';
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return true;
  }
  
  // Docker 内部网络
  if (forwardedFor === '' || forwardedFor.startsWith('172.') || forwardedFor.startsWith('10.')) {
    return true;
  }
  
  // 2. 检查 CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  const requestSecret = request.headers.get('x-cron-secret');
  
  if (cronSecret && requestSecret === cronSecret) {
    return true;
  }
  
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // 验证请求来源
    if (!isAuthorized(request)) {
      console.warn('[CRON] 未授权的定时任务请求');
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    console.log('[CRON] 开始执行每日快照任务...');
    const startTime = Date.now();

    // 调用服务层批量创建快照
    const result = await SnapshotService.createDailySnapshotsForAllUsers();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[CRON] 每日快照任务完成，耗时 ${duration}s`);
    console.log(`[CRON] 成功: ${result.success}, 失败: ${result.failed}`);

    return NextResponse.json({
      success: true,
      message: '每日快照任务完成',
      data: {
        successful: result.success,
        failed: result.failed,
        errors: result.errors,
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[CRON] 每日快照任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '每日快照任务失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// GET 请求用于健康检查
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/cron/daily-snapshot',
    method: 'POST',
    description: '为所有用户创建每日投资组合快照',
    usage: 'curl -X POST http://localhost:3000/api/cron/daily-snapshot',
  });
}
