import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FamilyService } from '@/lib/services/family-service';

/**
 * POST /api/family/invite/accept
 * 接受或拒绝家庭邀请
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { token, action } = body; // action: 'accept' | 'reject'

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: '缺少邀请token' }, { status: 400 });
    }

    if (action === 'reject') {
      await FamilyService.rejectInvitation(token, session.user.id);
      return NextResponse.json({ success: true, message: '已拒绝邀请' });
    }

    // 默认接受
    const result = await FamilyService.acceptInvitation(token, session.user.id);

    return NextResponse.json({
      success: true,
      message: '已加入家庭',
      family: result.family,
      member: result.member,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '处理邀请失败';
    const status = message.includes('不存在') ? 404
      : message.includes('过期') || message.includes('已被处理') ? 410
      : message.includes('不匹配') || message.includes('已属于') ? 409
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
