/**
 * 投资组合快照API
 * 
 * POST /api/portfolio/snapshot
 * - 手动创建当前投资组合快照
 * - 用于测试或手动触发快照创建
 * 
 * GET /api/portfolio/snapshot/latest
 * - 获取最新快照
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SnapshotService } from '@/lib/services/snapshot-service';

/**
 * POST - 创建快照
 */
export async function POST() {
  try {
    // 验证用户登录
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userId = session.user.id;

    // 检查今日是否已有快照
    const hasSnapshot = await SnapshotService.hasTodaySnapshot(userId);
    if (hasSnapshot) {
      return NextResponse.json(
        {
          success: false,
          error: '今日快照已存在',
          message: '每日只能创建一次快照',
        },
        { status: 409 }
      );
    }

    // 创建快照
    const snapshot = await SnapshotService.createDailySnapshot(userId);

    return NextResponse.json({
      success: true,
      message: '快照创建成功',
      data: snapshot,
    });
  } catch (error) {
    console.error('创建快照失败:', error);
    return NextResponse.json(
      {
        error: '创建快照失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET - 获取最新快照
 */
export async function GET() {
  try {
    // 验证用户登录
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userId = session.user.id;

    // 获取最新快照
    const snapshot = await SnapshotService.getLatestSnapshot(userId);

    if (!snapshot) {
      return NextResponse.json({
        success: true,
        message: '暂无快照数据',
        data: null,
      });
    }

    return NextResponse.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    console.error('获取最新快照失败:', error);
    return NextResponse.json(
      {
        error: '获取最新快照失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
