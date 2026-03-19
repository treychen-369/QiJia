import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FamilyService } from '@/lib/services/family-service';

/**
 * GET /api/family/invite
 * 获取家庭的邀请列表 或 当前用户收到的待处理邀请
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'received' | 'sent'(default)

    if (type === 'received') {
      // 获取用户收到的待处理邀请
      const invitations = await FamilyService.getPendingInvitationsForUser(session.user.email!);
      return NextResponse.json({ invitations });
    }

    // 默认：获取家庭发出的邀请列表
    const userFamily = await FamilyService.getUserFamily(session.user.id);
    if (!userFamily) {
      return NextResponse.json({ invitations: [] });
    }

    const invitations = await FamilyService.getInvitations(userFamily.family.id);
    return NextResponse.json({ invitations });
  } catch (error) {
    return NextResponse.json(
      { error: '获取邀请列表失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/family/invite
 * 发送家庭邀请（仅管理员）
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: '邮箱不能为空' }, { status: 400 });
    }

    const inviteRole = role || 'MEMBER';
    if (!['ADMIN', 'MEMBER', 'VIEWER'].includes(inviteRole)) {
      return NextResponse.json({ error: '无效的角色' }, { status: 400 });
    }

    const userFamily = await FamilyService.getUserFamily(session.user.id);
    if (!userFamily) {
      return NextResponse.json({ error: '未加入家庭，请先创建家庭' }, { status: 404 });
    }

    const invitation = await FamilyService.inviteMember(
      userFamily.family.id,
      email.trim().toLowerCase(),
      inviteRole,
      session.user.id
    );

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '发送邀请失败';
    const status = message.includes('仅管理员') ? 403
      : message.includes('已是') || message.includes('已属于') || message.includes('已存在') ? 409
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
