import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/asset-categories - 获取资产类别列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 获取资产类别列表
    const categories = await prisma.assetCategory.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        nameEn: true,
        description: true,
        level: true,
        sortOrder: true,
        parent: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: categories,
      count: categories.length,
    });
  } catch (error: any) {
    console.error('获取资产类别失败:', error);
    return NextResponse.json(
      { error: '获取资产类别失败', details: error.message },
      { status: 500 }
    );
  }
}
