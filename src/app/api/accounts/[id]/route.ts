import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateAccountSchema = z.object({
  accountName: z.string().min(1).max(100).optional(),
  accountNumber: z.string().max(50).optional(),
  accountType: z.enum(['INVESTMENT', 'CASH', 'MARGIN']).optional(),
  currency: z.string().length(3).optional(),
  brokerId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/accounts/[id] - 获取单个账户详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const account = await prisma.investmentAccount.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
      include: {
        broker: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        holdings: {
          select: {
            id: true,
            quantity: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: '账户不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: account,
    });
  } catch (error: any) {
    console.error('获取账户失败:', error);
    return NextResponse.json(
      { error: '获取账户失败', details: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/accounts/[id] - 更新账户
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const body = await request.json();
    
    // 验证输入
    const validation = updateAccountSchema.safeParse(body);
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

    // 检查账户是否存在
    const existingAccount = await prisma.investmentAccount.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!existingAccount) {
      return NextResponse.json({ error: '账户不存在' }, { status: 404 });
    }

    // 如果修改账户名称，检查重名
    if (data.accountName && data.accountName !== existingAccount.accountName) {
      const duplicate = await prisma.investmentAccount.findFirst({
        where: {
          userId: user.id,
          accountName: data.accountName,
          id: { not: params.id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: '账户名称已存在' },
          { status: 409 }
        );
      }
    }

    // 更新账户
    const updateData: {
      accountName?: string;
      accountNumber?: string;
      accountType?: 'INVESTMENT' | 'CASH' | 'MARGIN';
      currency?: string;
      isActive?: boolean;
      updatedAt: Date;
      broker?: { connect: { id: string } };
    } = {
      updatedAt: new Date(),
    };

    if (data.accountName !== undefined) updateData.accountName = data.accountName;
    if (data.accountNumber !== undefined) updateData.accountNumber = data.accountNumber;
    if (data.accountType !== undefined) updateData.accountType = data.accountType;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.brokerId !== undefined) updateData.broker = { connect: { id: data.brokerId } };

    const updatedAccount = await prisma.investmentAccount.update({
      where: { id: params.id },
      data: updateData,
      include: {
        broker: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedAccount,
      message: '账户更新成功',
    });

  } catch (error: any) {
    console.error('更新账户失败:', error);
    return NextResponse.json(
      { error: '更新账户失败', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/accounts/[id] - 删除账户
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 检查账户是否存在
    const account = await prisma.investmentAccount.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
      include: {
        holdings: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: '账户不存在' }, { status: 404 });
    }

    // 检查是否有持仓
    if (account.holdings.length > 0) {
      return NextResponse.json(
        { 
          error: '无法删除',
          details: '该账户下还有持仓，请先删除或转移所有持仓',
          holdingsCount: account.holdings.length,
        },
        { status: 400 }
      );
    }

    // 删除账户
    await prisma.investmentAccount.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: '账户删除成功',
    });

  } catch (error: any) {
    console.error('删除账户失败:', error);
    return NextResponse.json(
      { error: '删除账户失败', details: error.message },
      { status: 500 }
    );
  }
}
