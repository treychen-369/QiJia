import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/regions - 获取地区/市场列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 获取地区列表
    const regions = await prisma.region.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        currency: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: regions,
      count: regions.length,
    });
  } catch (error: any) {
    console.error('获取地区列表失败:', error);
    return NextResponse.json(
      { error: '获取地区列表失败', details: error.message },
      { status: 500 }
    );
  }
}
