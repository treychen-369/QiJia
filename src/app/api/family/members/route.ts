import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FamilyService } from '@/lib/services/family-service';

/**
 * GET /api/family/members
 * 获取当前用户的家庭信息和成员列表
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const userFamily = await FamilyService.getUserFamily(session.user.id);
    if (!userFamily) {
      return NextResponse.json({ family: null, members: [], role: null });
    }

    const members = await FamilyService.getMembers(userFamily.family.id);

    return NextResponse.json({
      family: userFamily.family,
      members,
      role: userFamily.role,
    });
  } catch (error) {
    return NextResponse.json(
      { error: '获取家庭信息失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/family/members
 * 创建家庭
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '家庭名称不能为空' }, { status: 400 });
    }

    const result = await FamilyService.createFamily(session.user.id, name.trim(), description);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建家庭失败';
    const status = message.includes('已属于') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * PUT /api/family/members
 * 更新成员角色
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { memberId, role } = body;

    if (!memberId || !role) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    if (!['ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
      return NextResponse.json({ error: '无效的角色' }, { status: 400 });
    }

    const userFamily = await FamilyService.getUserFamily(session.user.id);
    if (!userFamily) {
      return NextResponse.json({ error: '未加入家庭' }, { status: 404 });
    }

    const updated = await FamilyService.updateMemberRole(
      userFamily.family.id,
      memberId,
      role,
      session.user.id
    );

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新角色失败';
    const status = message.includes('仅管理员') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/family/members
 * 移除成员或退出家庭
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const action = searchParams.get('action'); // 'remove' | 'leave'

    if (action === 'leave') {
      await FamilyService.leaveFamily(session.user.id);
      return NextResponse.json({ success: true, message: '已退出家庭' });
    }

    if (!memberId) {
      return NextResponse.json({ error: '缺少成员ID' }, { status: 400 });
    }

    const userFamily = await FamilyService.getUserFamily(session.user.id);
    if (!userFamily) {
      return NextResponse.json({ error: '未加入家庭' }, { status: 404 });
    }

    await FamilyService.removeMember(userFamily.family.id, memberId, session.user.id);

    return NextResponse.json({ success: true, message: '成员已移除' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '操作失败';
    const status = message.includes('仅管理员') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
