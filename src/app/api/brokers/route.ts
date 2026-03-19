import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// 创建券商的验证Schema (管理员功能)
const createBrokerSchema = z.object({
  name: z.string().min(1, '券商名称不能为空').max(100),
  code: z.string().min(1, '券商代码不能为空').max(20),
  country: z.string().length(2, '国家代码必须为2位'),
});

// GET /api/brokers - 获取券商列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const query = searchParams.get('q');

    // 构建查询条件
    const whereClause = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(query ? {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { code: { contains: query, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    // 获取券商列表
    const brokers = await prisma.broker.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        code: true,
        country: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            investmentAccounts: true,
          },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: brokers,
      count: brokers.length,
    });
  } catch (error: any) {
    console.error('获取券商列表失败:', error);
    return NextResponse.json(
      { error: '获取券商列表失败', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/brokers - 创建新券商 (管理员功能或首次使用时添加)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    
    // 验证输入
    const validation = createBrokerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: '输入验证失败', 
          details: validation.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // 检查券商是否已存在
    const existing = await prisma.broker.findFirst({
      where: {
        OR: [
          { name: data.name },
          { code: data.code },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { 
          error: existing.name === data.name 
            ? '券商名称已存在' 
            : '券商代码已存在',
          existing,
        },
        { status: 409 }
      );
    }

    // 创建券商
    const broker = await prisma.broker.create({
      data: {
        name: data.name,
        code: data.code,
        country: data.country,
      },
    });

    return NextResponse.json({
      success: true,
      data: broker,
      message: '券商创建成功',
    }, { status: 201 });

  } catch (error: any) {
    console.error('创建券商失败:', error);
    return NextResponse.json(
      { error: '创建券商失败', details: error.message },
      { status: 500 }
    );
  }
}
