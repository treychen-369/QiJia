import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FamilyService } from '@/lib/services/family-service';

// GET /api/family/transfer/assets?familyId=xxx&userId=xxx - 获取成员可转移资产
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!currentUser) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const familyId = searchParams.get('familyId');
    const userId = searchParams.get('userId');

    if (!familyId || !userId) {
      return NextResponse.json({ error: '缺少 familyId 或 userId 参数' }, { status: 400 });
    }

    const result = await FamilyService.getMemberTransferableAssets(
      familyId,
      userId,
      currentUser.id
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('获取可转移资产失败:', error);
    return NextResponse.json(
      { error: error.message || '获取失败' },
      { status: 400 }
    );
  }
}
