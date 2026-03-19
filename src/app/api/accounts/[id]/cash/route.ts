/**
 * 账户现金余额 API
 * 
 * 功能：
 * - GET: 获取账户现金余额
 * - PUT: 更新账户现金余额
 * 
 * 2026-01-31 新增
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PortfolioService } from '@/lib/services/portfolio-service';
import { exchangeRateService } from '@/lib/exchange-rate-service';

// GET /api/accounts/[id]/cash - 获取账户现金余额
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: accountId } = await params;

    // 获取账户
    const account = await prisma.investmentAccount.findUnique({
      where: { 
        id: accountId,
        userId: session.user.id  // 确保只能访问自己的账户
      },
      include: { broker: true }
    });

    if (!account) {
      return NextResponse.json({ error: '账户不存在' }, { status: 404 });
    }

    // 获取实时汇率
    const exchangeRate = await exchangeRateService.getRate(account.currency, 'CNY');
    const cashBalance = Number(account.cashBalance) || 0;
    const cashBalanceCny = cashBalance * exchangeRate;

    return NextResponse.json({
      success: true,
      data: {
        accountId: account.id,
        accountName: account.accountName,
        broker: account.broker.name,
        currency: account.currency,
        cashBalance,
        cashBalanceCny,
        exchangeRate,
        lastUpdated: account.cashLastUpdated
      }
    });

  } catch (error) {
    console.error('[API错误] 获取现金余额:', error);
    return NextResponse.json(
      { error: '获取失败' },
      { status: 500 }
    );
  }
}

// PUT /api/accounts/[id]/cash - 更新账户现金余额
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: accountId } = await params;
    const body = await request.json();
    const { cashBalance } = body;

    // 验证输入
    if (typeof cashBalance !== 'number' || cashBalance < 0) {
      return NextResponse.json(
        { error: '无效的现金余额，必须为非负数' },
        { status: 400 }
      );
    }

    // 验证账户归属
    const account = await prisma.investmentAccount.findUnique({
      where: { 
        id: accountId,
        userId: session.user.id
      }
    });

    if (!account) {
      return NextResponse.json({ error: '账户不存在' }, { status: 404 });
    }

    // 使用服务层更新
    const updated = await PortfolioService.updateAccountCashBalance(
      accountId,
      cashBalance
    );

    console.log(`✅ [API] 账户 ${account.accountName} 现金余额已更新:`, {
      old: Number(account.cashBalance),
      new: cashBalance,
      currency: account.currency
    });

    return NextResponse.json({
      success: true,
      data: {
        accountId: updated.id,
        cashBalance: updated.cashBalance,
        cashBalanceCny: updated.cashBalanceCny,
        exchangeRate: updated.cashExchangeRate,
        lastUpdated: updated.cashLastUpdated
      }
    });

  } catch (error) {
    console.error('[API错误] 更新现金余额:', error);
    return NextResponse.json(
      { error: '更新失败' },
      { status: 500 }
    );
  }
}
