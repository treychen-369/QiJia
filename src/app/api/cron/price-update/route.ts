/**
 * 定时任务 API - 行情价格自动更新
 * 
 * POST /api/cron/price-update
 * 
 * 用于服务器 crontab 调用，为所有用户更新持仓行情价格
 * 每日触发三次，覆盖中国A股、香港、美国市场交易时段：
 *   - 15:10 北京时间（A股收盘后）
 *   - 16:15 北京时间（港股收盘后）
 *   - 05:10 北京时间（美股收盘后，冬令时04:10夏令时05:10取折中）
 * 
 * 安全机制：
 * - 只接受来自 localhost / Docker 内部网络的请求
 * - 或者带有正确的 CRON_SECRET 头
 */

import { NextRequest, NextResponse } from 'next/server';
import { PriceUpdateService } from '@/lib/services/price-update-service';

// 验证请求来源（复用 daily-snapshot 的鉴权逻辑）
function isAuthorized(request: NextRequest): boolean {
  const host = request.headers.get('host') || '';
  const forwardedFor = request.headers.get('x-forwarded-for') || '';

  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return true;
  }

  // Docker 内部网络
  if (forwardedFor === '' || forwardedFor.startsWith('172.') || forwardedFor.startsWith('10.')) {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET;
  const requestSecret = request.headers.get('x-cron-secret');

  if (cronSecret && requestSecret === cronSecret) {
    return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      console.warn('[CRON] 未授权的行情更新请求');
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    console.log('[CRON] 开始执行行情价格更新任务...');
    const startTime = Date.now();

    const result = await PriceUpdateService.updateAllUsersPrices();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[CRON] 行情更新完成，耗时 ${duration}s`);
    console.log(`[CRON] 用户成功: ${result.success}, 失败: ${result.failed}, 共更新: ${result.totalUpdated} 条持仓`);

    return NextResponse.json({
      success: true,
      message: '行情价格更新任务完成',
      data: {
        usersSuccessful: result.success,
        usersFailed: result.failed,
        totalHoldingsUpdated: result.totalUpdated,
        errors: result.errors,
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[CRON] 行情更新任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '行情更新任务失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// GET 请求用于健康检查
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/cron/price-update',
    method: 'POST',
    description: '自动更新所有用户的证券持仓行情价格',
    schedule: [
      { time: '15:10 CST', market: 'A股收盘后' },
      { time: '16:15 CST', market: '港股收盘后' },
      { time: '05:10 CST', market: '美股收盘后' },
    ],
    usage: 'curl -X POST http://localhost:3000/api/cron/price-update',
  });
}
