/**
 * 投资组合历史数据API
 * 
 * GET /api/portfolio/history?days=30
 * - 获取最近N天的投资组合历史趋势
 * - 支持参数：days（默认30天）
 * 
 * GET /api/portfolio/history?startDate=2024-01-01&endDate=2024-12-31
 * - 获取指定日期范围的历史数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SnapshotService } from '@/lib/services/snapshot-service';

export async function GET(request: NextRequest) {
  try {
    // 验证用户登录
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userId = session.user.id;
    const searchParams = request.nextUrl.searchParams;

    // 解析查询参数
    const days = searchParams.get('days');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let trend;

    if (startDate && endDate) {
      // 按日期范围查询
      trend = await SnapshotService.getHistoricalTrend(
        userId,
        new Date(startDate),
        new Date(endDate)
      );
    } else {
      // 按天数查询
      const daysNumber = days ? parseInt(days, 10) : 30;
      trend = await SnapshotService.getRecentTrend(userId, daysNumber);
    }

    // 计算性能指标
    let metrics = null;
    if (trend.length >= 2) {
      const start = startDate ? new Date(startDate) : new Date();
      if (!startDate) {
        start.setDate(start.getDate() - (days ? parseInt(days, 10) : 30));
      }
      const end = endDate ? new Date(endDate) : new Date();

      metrics = await SnapshotService.calculatePerformanceMetrics(userId, start, end);
    }

    const firstItem = trend[0];
    const lastItem = trend[trend.length - 1];
    
    return NextResponse.json({
      success: true,
      data: {
        trend,
        metrics,
        summary: {
          dataPoints: trend.length,
          startDate: firstItem?.date ?? null,
          endDate: lastItem?.date ?? null,
          startValue: firstItem?.totalValue ?? 0,
          endValue: lastItem?.totalValue ?? 0,
        },
      },
    });
  } catch (error) {
    console.error('获取历史数据失败:', error);
    return NextResponse.json(
      {
        error: '获取历史数据失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
