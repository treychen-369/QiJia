import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ActivityLogService } from '@/lib/services/activity-log-service';

// 汇率转换函数
function getExchangeRate(currency: string): number {
  switch (currency) {
    case 'USD': return 7.2;
    case 'HKD': return 0.92;
    case 'CNY': 
    default: return 1.0;
  }
}

// 转移持仓的验证Schema
const transferHoldingSchema = z.object({
  sourceHoldingId: z.string().uuid('源持仓ID无效'),
  targetAccountId: z.string().uuid('目标账户ID无效'),
  quantity: z.number().positive('转移数量必须大于0'),
  keepCostBasis: z.boolean().default(true),
  newCostBasis: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
});

// POST /api/holdings/transfer - 转移持仓
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
    const validation = transferHoldingSchema.safeParse(body);
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

    // 1. 获取源持仓
    const sourceHolding = await prisma.holding.findUnique({
      where: { id: data.sourceHoldingId },
      include: {
        security: true,
        account: true,
      },
    });

    if (!sourceHolding) {
      return NextResponse.json({ error: '源持仓不存在' }, { status: 404 });
    }

    if (sourceHolding.userId !== user.id) {
      return NextResponse.json({ error: '无权限操作该持仓' }, { status: 403 });
    }

    // 2. 验证转移数量
    if (data.quantity > Number(sourceHolding.quantity)) {
      return NextResponse.json(
        { 
          error: '转移数量超过可用数量',
          available: Number(sourceHolding.quantity),
          requested: data.quantity,
        },
        { status: 400 }
      );
    }

    // 3. 验证目标账户
    const targetAccount = await prisma.investmentAccount.findUnique({
      where: { id: data.targetAccountId },
    });

    if (!targetAccount) {
      return NextResponse.json({ error: '目标账户不存在' }, { status: 404 });
    }

    if (targetAccount.userId !== user.id) {
      return NextResponse.json({ error: '无权限操作该账户' }, { status: 403 });
    }

    if (!targetAccount.isActive) {
      return NextResponse.json({ error: '目标账户已停用' }, { status: 400 });
    }

    if (sourceHolding.accountId === data.targetAccountId) {
      return NextResponse.json({ error: '源账户和目标账户不能相同' }, { status: 400 });
    }

    // 4. 确定成本价
    const costBasis = data.keepCostBasis 
      ? Number(sourceHolding.averageCost)
      : data.newCostBasis || Number(sourceHolding.averageCost);

    // 5. 使用事务执行转移
    const result = await prisma.$transaction(async (tx) => {
      // 5.1 减少源持仓数量
      const remainingQuantity = Number(sourceHolding.quantity) - data.quantity;
      
      if (remainingQuantity > 0) {
        // 部分转移：更新源持仓
        const sourceExchangeRate = getExchangeRate(sourceHolding.account.currency);
        await tx.holding.update({
          where: { id: sourceHolding.id },
          data: {
            quantity: remainingQuantity,
            // 重新计算相关字段
            costBasis: remainingQuantity * Number(sourceHolding.averageCost),
            marketValueOriginal: remainingQuantity * Number(sourceHolding.currentPrice || 0),
            marketValueCny: remainingQuantity * Number(sourceHolding.currentPrice || 0) * sourceExchangeRate,
            unrealizedPnl: (Number(sourceHolding.currentPrice || 0) - Number(sourceHolding.averageCost)) * remainingQuantity,
            unrealizedPnlPercent: Number(sourceHolding.averageCost) > 0
              ? ((Number(sourceHolding.currentPrice || 0) - Number(sourceHolding.averageCost)) / Number(sourceHolding.averageCost)) * 100
              : 0,
          },
        });
      } else {
        // 全部转移：删除源持仓
        await tx.holding.delete({
          where: { id: sourceHolding.id },
        });
      }

      // 5.2 检查目标账户是否已有该证券的持仓
      const existingTargetHolding = await tx.holding.findUnique({
        where: {
          userId_accountId_securityId: {
            userId: user.id,
            accountId: data.targetAccountId,
            securityId: sourceHolding.securityId,
          },
        },
      });

      let targetHolding;

      if (existingTargetHolding) {
        // 目标账户已有该证券：合并持仓
        const totalQuantity = Number(existingTargetHolding.quantity) + data.quantity;
        const totalCostBasis = (Number(existingTargetHolding.quantity) * Number(existingTargetHolding.averageCost)) + 
                                (data.quantity * costBasis);
        const newAverageCost = totalCostBasis / totalQuantity;
        const targetExchangeRate = getExchangeRate(targetAccount.currency);

        targetHolding = await tx.holding.update({
          where: { id: existingTargetHolding.id },
          data: {
            quantity: totalQuantity,
            averageCost: newAverageCost,
            costBasis: totalCostBasis,
            marketValueOriginal: totalQuantity * Number(existingTargetHolding.currentPrice || 0),
            marketValueCny: totalQuantity * Number(existingTargetHolding.currentPrice || 0) * targetExchangeRate,
            unrealizedPnl: (Number(existingTargetHolding.currentPrice || 0) - newAverageCost) * totalQuantity,
            unrealizedPnlPercent: newAverageCost > 0
              ? ((Number(existingTargetHolding.currentPrice || 0) - newAverageCost) / newAverageCost) * 100
              : 0,
          },
        });
      } else {
        // 目标账户没有该证券：创建新持仓
        const targetExchangeRate = getExchangeRate(targetAccount.currency);
        targetHolding = await tx.holding.create({
          data: {
            userId: user.id,
            accountId: data.targetAccountId,
            securityId: sourceHolding.securityId,
            quantity: data.quantity,
            averageCost: costBasis,
            currentPrice: sourceHolding.currentPrice,
            costBasis: data.quantity * costBasis,
            marketValueOriginal: data.quantity * Number(sourceHolding.currentPrice || 0),
            marketValueCny: data.quantity * Number(sourceHolding.currentPrice || 0) * targetExchangeRate,
            unrealizedPnl: (Number(sourceHolding.currentPrice || 0) - costBasis) * data.quantity,
            unrealizedPnlPercent: costBasis > 0
              ? ((Number(sourceHolding.currentPrice || 0) - costBasis) / costBasis) * 100
              : 0,
          },
        });
      }

      // 5.3 记录转移日志
      const transferLog = await tx.holdingTransferLog.create({
        data: {
          userId: user.id,
          securityId: sourceHolding.securityId,
          sourceAccountId: sourceHolding.accountId,
          targetAccountId: data.targetAccountId,
          quantity: data.quantity,
          costBasis: costBasis,
          notes: data.notes,
        },
      });

      return {
        transferLog,
        targetHolding,
        remainingQuantity,
      };
    });

    // 记录活动日志
    await ActivityLogService.log({
      userId: user.id,
      assetType: 'HOLDING',
      assetId: sourceHolding.id,
      assetName: sourceHolding.security.name,
      assetSymbol: sourceHolding.security.symbol,
      action: 'TRANSFER',
      description: `从 ${sourceHolding.account.accountName} 转移 ${data.quantity} 股 ${sourceHolding.security.name} 到 ${targetAccount.accountName}`,
      previousValue: {
        accountName: sourceHolding.account.accountName,
        quantity: Number(sourceHolding.quantity),
      },
      newValue: {
        accountName: targetAccount.accountName,
        transferQuantity: data.quantity,
        remainingQuantity: result.remainingQuantity,
      },
      currency: sourceHolding.account.currency,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `成功转移 ${data.quantity} 股 ${sourceHolding.security.name}`,
    });

  } catch (error: any) {
    console.error('转移持仓失败:', error);
    
    // 特殊处理Prisma错误
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: '持仓记录冲突' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: '转移持仓失败', details: error.message },
      { status: 500 }
    );
  }
}

// GET /api/holdings/transfer - 获取转移历史
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 获取转移历史
    const logs = await prisma.holdingTransferLog.findMany({
      where: { userId: user.id },
      include: {
        security: {
          select: {
            symbol: true,
            name: true,
            nameEn: true,
          },
        },
        sourceAccount: {
          select: {
            accountName: true,
            broker: {
              select: { name: true },
            },
          },
        },
        targetAccount: {
          select: {
            accountName: true,
            broker: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { transferredAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.holdingTransferLog.count({
      where: { userId: user.id },
    });

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });

  } catch (error: any) {
    console.error('获取转移历史失败:', error);
    return NextResponse.json(
      { error: '获取转移历史失败', details: error.message },
      { status: 500 }
    );
  }
}
