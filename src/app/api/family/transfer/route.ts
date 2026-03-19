import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FamilyService } from '@/lib/services/family-service';
import { z } from 'zod';

// 转移请求验证
const transferSchema = z.object({
  familyId: z.string().uuid('家庭ID无效'),
  fromUserId: z.string().uuid('转出方ID无效'),
  toUserId: z.string().uuid('转入方ID无效'),
  assetType: z.enum(['HOLDING', 'ASSET', 'CASH_ACCOUNT', 'LIABILITY'], {
    errorMap: () => ({ message: '类型无效，支持: HOLDING, ASSET, CASH_ACCOUNT, LIABILITY' }),
  }),
  holdingId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  liabilityId: z.string().uuid().optional(),
  quantity: z.number().positive('数量必须大于0').optional(),
  transferAll: z.boolean().optional(),
  targetAccountId: z.string().uuid().optional(),
  notes: z.string().max(500, '备注最长500字').optional(),
});

// POST /api/family/transfer - 执行跨成员资产转移
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const body = await request.json();
    const validation = transferSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: '输入验证失败',
          details: validation.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // 额外验证
    if (data.assetType === 'HOLDING' && !data.holdingId) {
      return NextResponse.json({ error: '转移证券持仓时必须提供 holdingId' }, { status: 400 });
    }
    if (data.assetType === 'HOLDING' && !data.targetAccountId) {
      return NextResponse.json({ error: '转移证券持仓时必须提供目标账户 targetAccountId' }, { status: 400 });
    }
    if ((data.assetType === 'ASSET' || data.assetType === 'CASH_ACCOUNT') && !data.assetId) {
      return NextResponse.json({ error: '转移资产时必须提供 assetId' }, { status: 400 });
    }
    if (data.assetType === 'CASH_ACCOUNT' && !data.quantity) {
      return NextResponse.json({ error: '转移现金时必须提供转移金额 quantity' }, { status: 400 });
    }
    if (data.assetType === 'LIABILITY' && !data.liabilityId) {
      return NextResponse.json({ error: '转移负债时必须提供 liabilityId' }, { status: 400 });
    }

    const result = await FamilyService.transferAsset({
      ...data,
      operatorId: user.id,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `成功将 ${result.assetName} 从 ${result.fromUserName} 转移到 ${result.toUserName}`,
    });
  } catch (error: any) {
    console.error('家庭资产转移失败:', error);
    return NextResponse.json(
      { error: error.message || '转移失败' },
      { status: error.message?.includes('权限') || error.message?.includes('管理员') ? 403 : 400 }
    );
  }
}

// GET /api/family/transfer - 获取转移历史
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const familyId = searchParams.get('familyId');
    if (!familyId) {
      return NextResponse.json({ error: '缺少 familyId 参数' }, { status: 400 });
    }

    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await FamilyService.getTransferHistory(familyId, user.id, { limit, offset });

    return NextResponse.json({
      success: true,
      data: result.records,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
      },
    });
  } catch (error: any) {
    console.error('获取转移历史失败:', error);
    return NextResponse.json(
      { error: error.message || '获取失败' },
      { status: 400 }
    );
  }
}
