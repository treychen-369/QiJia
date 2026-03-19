import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FamilyService } from '@/lib/services/family-service';

/**
 * GET /api/family/overview
 * 获取家庭资产总览（所有成员资产汇总）
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const userFamily = await FamilyService.getUserFamily(session.user.id);
    if (!userFamily) {
      return NextResponse.json({ error: '未加入家庭' }, { status: 404 });
    }

    // 权限校验：所有家庭成员均可查看家庭概览
    await FamilyService.checkPermission(session.user.id, userFamily.family.id, 'VIEW_FAMILY');

    const overview = await FamilyService.getFamilyPortfolioOverview(userFamily.family.id);

    return NextResponse.json(overview, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: '获取家庭资产概览失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
