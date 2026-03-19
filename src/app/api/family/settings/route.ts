import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FamilyService } from '@/lib/services/family-service';
import { createLogger } from '@/lib/logger';

const logger = createLogger('FamilySettingsAPI');

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userFamily = await FamilyService.getUserFamily(session.user.id);
    if (!userFamily) {
      return NextResponse.json({ error: '未加入家庭' }, { status: 404 });
    }

    await FamilyService.checkPermission(session.user.id, userFamily.family.id, 'MANAGE_PROFILE');

    const body = await request.json();
    const { name } = body;

    if (name !== undefined) {
      const updated = await FamilyService.updateFamilyName(userFamily.family.id, name);
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ error: '无有效更新字段' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新失败';
    logger.error('更新家庭设置失败', error);
    const status = message.includes('仅管理员') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
