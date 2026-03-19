/**
 * 建议历史 API
 * 
 * GET /api/allocation/advice-history - 获取AI建议历史
 * PUT /api/allocation/advice-history - 更新建议状态（采纳/拒绝）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { AllocationService } from '@/lib/services/allocation-service';

/**
 * GET: 获取建议历史列表
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const scope = searchParams.get('scope'); // 'family' = 家庭级别

    let history;
    if (scope === 'family' && session.user.familyId) {
      // 家庭视角：按familyId查询，所有成员共享可见
      history = await AllocationService.getAdviceHistoryForFamily(session.user.familyId, limit);
    } else {
      history = await AllocationService.getAdviceHistory(session.user.id, limit);
    }

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('[API] 获取建议历史失败:', error);
    return NextResponse.json(
      { error: '获取建议历史失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT: 更新建议状态
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { adviceId, status, userFeedback } = body;

    if (!adviceId) {
      return NextResponse.json(
        { error: '缺少建议ID' },
        { status: 400 }
      );
    }

    if (!['ACCEPTED', 'REJECTED', 'PARTIAL'].includes(status)) {
      return NextResponse.json(
        { error: '无效的状态值' },
        { status: 400 }
      );
    }

    await AllocationService.updateAdviceFeedback(adviceId, {
      status,
      userFeedback,
    });

    return NextResponse.json({
      success: true,
      message: '建议状态已更新',
    });
  } catch (error) {
    console.error('[API] 更新建议状态失败:', error);
    return NextResponse.json(
      { error: '更新建议状态失败' },
      { status: 500 }
    );
  }
}
