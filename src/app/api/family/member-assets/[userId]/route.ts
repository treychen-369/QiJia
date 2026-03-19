import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FamilyService } from '@/lib/services/family-service';

/**
 * GET /api/family/member-assets/[userId]
 * 获取指定家庭成员的资产明细
 * 权限：管理员可查看任意成员，其他角色仅可查看自己
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const targetUserId = params.userId;
    if (!targetUserId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    const userFamily = await FamilyService.getUserFamily(session.user.id);
    if (!userFamily) {
      return NextResponse.json({ error: '未加入家庭' }, { status: 404 });
    }

    const result = await FamilyService.getMemberAssets(
      userFamily.family.id,
      targetUserId,
      session.user.id
    );

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取成员资产失败';
    const status = message.includes('无权') ? 403
      : message.includes('不是') ? 404
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
