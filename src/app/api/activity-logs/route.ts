/**
 * 资产操作记录 API
 * 
 * GET /api/activity-logs - 获取操作记录列表
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ActivityLogService } from '@/lib/services/activity-log-service';
import { AssetType, ActivityAction } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // 解析查询参数
    const assetId = searchParams.get('assetId');  // ✨ 新增：单资产筛选
    const assetType = searchParams.get('assetType') as AssetType | null;
    const action = searchParams.get('action') as ActivityAction | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { logs, total } = await ActivityLogService.getActivityLogs(
      session.user.id,
      {
        assetId: assetId || undefined,  // ✨ 新增
        assetType: assetType || undefined,
        action: action || undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit,
        offset,
      }
    );

    // 格式化返回数据
    const formattedLogs = logs.map(log => ({
      id: log.id,
      assetId: log.assetId,     // ✨ 新增：返回资产ID，便于前端跳转详情
      assetType: log.assetType,
      assetName: log.assetName,
      assetSymbol: log.assetSymbol,
      action: log.action,
      description: log.description,
      previousValue: log.previousValue,
      newValue: log.newValue,
      amountChange: log.amountChange ? Number(log.amountChange) : null,
      currency: log.currency,
      source: log.source,
      createdAt: log.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        logs: formattedLogs,
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total,
      },
    });
  } catch (error) {
    console.error('[API] 获取操作记录失败:', error);
    return NextResponse.json(
      { error: '获取操作记录失败' },
      { status: 500 }
    );
  }
}
