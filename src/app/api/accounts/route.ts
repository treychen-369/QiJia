import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// 创建账户的验证Schema
const createAccountSchema = z.object({
  brokerId: z.string().uuid('券商ID无效'),
  accountName: z.string().min(1, '账户名称不能为空').max(100),
  accountNumber: z.string().max(100).optional(),
  currency: z.string().length(3, '货币代码必须为3位').default('CNY'),
  accountType: z.enum(['INVESTMENT', 'CASH', 'MARGIN']).default('INVESTMENT'),
});

// 更新账户的验证Schema
const updateAccountSchema = z.object({
  accountName: z.string().min(1).max(100).optional(),
  accountNumber: z.string().max(100).optional().nullable(),
  currency: z.string().length(3).optional(),
  accountType: z.enum(['INVESTMENT', 'CASH', 'MARGIN']).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/accounts - 获取用户的所有账户
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
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // 获取账户列表
    const accounts = await prisma.investmentAccount.findMany({
      where: {
        userId: user.id,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        broker: {
          select: {
            id: true,
            name: true,
            code: true,
            country: true,
          },
        },
        holdings: {
          select: {
            id: true,
          },
        },
        accountBalances: {
          orderBy: { snapshotDate: 'desc' },
          take: 1,
          select: {
            cashBalanceCny: true,
            cashBalanceOriginal: true,
          },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    // 计算每个账户的持仓数量和现金
    const accountsWithStats = accounts.map(account => ({
      ...account,
      holdingsCount: account.holdings.length,
      latestCashBalance: account.accountBalances[0] || null,
      holdings: undefined, // 移除holdings详情
      accountBalances: undefined, // 移除详情
    }));

    return NextResponse.json({
      success: true,
      data: accountsWithStats,
      count: accountsWithStats.length,
    });
  } catch (error: any) {
    console.error('获取账户列表失败:', error);
    return NextResponse.json(
      { error: '获取账户列表失败', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/accounts - 创建新账户
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
    
    // 验证输入
    const validation = createAccountSchema.safeParse(body);
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

    // 验证券商是否存在
    const broker = await prisma.broker.findUnique({
      where: { id: data.brokerId },
    });

    if (!broker) {
      return NextResponse.json({ error: '券商不存在' }, { status: 404 });
    }

    // 检查账户是否已存在（同一用户+券商+账号）
    if (data.accountNumber) {
      const existing = await prisma.investmentAccount.findUnique({
        where: {
          userId_brokerId_accountNumber: {
            userId: user.id,
            brokerId: data.brokerId,
            accountNumber: data.accountNumber,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: '该账户已存在' },
          { status: 409 }
        );
      }
    }

    // 创建账户
    const account = await prisma.investmentAccount.create({
      data: {
        userId: user.id,
        brokerId: data.brokerId,
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        currency: data.currency,
        accountType: data.accountType,
      },
      include: {
        broker: {
          select: {
            id: true,
            name: true,
            code: true,
            country: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: account,
      message: '账户创建成功',
    }, { status: 201 });

  } catch (error: any) {
    console.error('创建账户失败:', error);
    return NextResponse.json(
      { error: '创建账户失败', details: error.message },
      { status: 500 }
    );
  }
}
