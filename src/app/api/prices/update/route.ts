/**
 * 证券价格更新 API
 * 
 * GET  /api/prices/update - 更新当前用户所有持仓的价格
 * POST /api/prices/update - 手动触发价格更新
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PriceUpdateService } from '@/lib/services/price-update-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const result = await PriceUpdateService.updateAllPrices(session.user.id);

    return NextResponse.json({
      success: result.success,
      data: {
        totalUpdated: result.totalUpdated,
        totalFailed: result.totalFailed,
        source: result.source,
        timestamp: result.timestamp.toISOString(),
        updates: result.updates.map(u => ({
          symbol: u.symbol,
          previousPrice: u.previousPrice,
          newPrice: u.newPrice,
          change: u.change,
          changePercent: u.changePercent,
        })),
      },
      errors: result.errors,
    });
  } catch (error) {
    console.error('[API] 价格更新失败:', error);
    return NextResponse.json(
      { error: '更新价格失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // POST 和 GET 行为相同，都是触发价格更新
  return GET(request);
}
