/**
 * 股票数据同步API
 * 提供手动同步和获取股票价格的接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { syncManager } from '@/lib/sync/sync-manager';
import { z } from 'zod';

// 请求参数验证schema
const syncRequestSchema = z.object({
  symbols: z.array(z.string()).min(1).max(100),
  services: z.array(z.enum(['tonghuashun', 'eastmoney', 'xueqiu'])).optional(),
  force: z.boolean().optional().default(false)
});

const priceRequestSchema = z.object({
  symbols: z.array(z.string()).min(1).max(50)
});

/**
 * POST /api/sync/stocks - 执行股票数据同步
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户认证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求参数
    const body = await request.json();
    const validation = syncRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: '请求参数无效',
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { symbols, services, force } = validation.data;
    const userId = session.user.id;

    // 检查同步频率限制（除非强制同步）
    if (!force) {
      const lastSyncKey = `last_sync_${userId}`;
      const lastSyncTime = global.syncCache?.get(lastSyncKey);
      const minInterval = 60 * 1000; // 最小间隔1分钟

      if (lastSyncTime && Date.now() - lastSyncTime < minInterval) {
        return NextResponse.json(
          { 
            error: '同步过于频繁，请稍后再试',
            nextAllowedTime: new Date(lastSyncTime + minInterval)
          },
          { status: 429 }
        );
      }
    }

    // 执行同步
    const syncConfig = services ? { enabledServices: services } : {};
    const result = await syncManager.syncOnce(userId, symbols, syncConfig);

    // 记录同步时间
    if (!global.syncCache) {
      global.syncCache = new Map();
    }
    global.syncCache.set(`last_sync_${userId}`, Date.now());

    // 返回结果
    return NextResponse.json({
      success: result.success,
      data: {
        totalUpdated: result.totalUpdated,
        duration: result.duration,
        timestamp: result.timestamp,
        services: Array.from(result.serviceResults.entries()).map(([type, res]) => ({
          type,
          success: res.success,
          updatedCount: res.updatedCount,
          errors: res.errors
        }))
      },
      errors: result.errors
    });

  } catch (error) {
    console.error('股票同步API错误:', error);
    
    return NextResponse.json(
      { 
        error: '同步服务内部错误',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync/stocks - 获取股票实时价格
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户认证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');
    
    if (!symbolsParam) {
      return NextResponse.json(
        { error: '缺少symbols参数' },
        { status: 400 }
      );
    }

    const symbols = symbolsParam.split(',').filter(Boolean);
    const validation = priceRequestSchema.safeParse({ symbols });
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: '股票代码参数无效',
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    // 获取股票价格数据
    const result = await syncManager.getStockPrices(symbols);

    return NextResponse.json({
      success: result.data.length > 0,
      data: {
        stocks: result.data,
        source: result.source,
        count: result.data.length,
        timestamp: new Date()
      },
      errors: result.errors
    });

  } catch (error) {
    console.error('获取股票价格API错误:', error);
    
    return NextResponse.json(
      { 
        error: '获取股票价格失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

// 扩展全局类型以支持同步缓存
declare global {
  var syncCache: Map<string, number> | undefined;
}