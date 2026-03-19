import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ActivityLogService } from '@/lib/services/activity-log-service'

// POST - 创建新持仓
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const body = await request.json()
    const { securityId, accountId, quantity, averageCost, currentPrice, purchaseDate, notes } = body

    // 验证必填字段
    if (!securityId || !accountId || !quantity || !averageCost) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
    }

    if (quantity <= 0) {
      return NextResponse.json({ error: '持仓数量必须大于0' }, { status: 400 })
    }

    if (averageCost <= 0) {
      return NextResponse.json({ error: '成本价必须大于0' }, { status: 400 })
    }

    // 验证证券存在
    const security = await prisma.security.findUnique({
      where: { id: securityId },
      include: { region: true },
    })

    if (!security) {
      return NextResponse.json({ error: '证券不存在' }, { status: 404 })
    }

    // 验证账户存在且属于当前用户
    const account = await prisma.investmentAccount.findUnique({
      where: { id: accountId },
    })

    if (!account) {
      return NextResponse.json({ error: '投资账户不存在' }, { status: 404 })
    }

    if (account.userId !== session.user.id) {
      return NextResponse.json({ error: '无权操作此账户' }, { status: 403 })
    }

    // 检查是否已有相同持仓（同账户+同证券）
    const existingHolding = await prisma.holding.findUnique({
      where: {
        userId_accountId_securityId: {
          userId: session.user.id,
          accountId,
          securityId,
        },
      },
    })

    if (existingHolding) {
      return NextResponse.json(
        { error: '该账户下已存在此证券的持仓，请直接编辑现有持仓' },
        { status: 409 }
      )
    }

    // 计算市值和盈亏
    const price = currentPrice || averageCost
    const marketValue = quantity * price
    const totalCost = quantity * averageCost
    const unrealizedPnl = marketValue - totalCost
    const unrealizedPnlPercent = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0

    // 获取汇率用于计算人民币市值
    let exchangeRate = 1
    const currency = account.currency || security.region.currency || 'CNY'
    if (currency !== 'CNY') {
      try {
        const { ExchangeRateService } = await import('@/lib/exchange-rate-service')
        exchangeRate = await ExchangeRateService.getRate(currency, 'CNY')
      } catch {
        // 回退默认汇率
        const fallbackRates: Record<string, number> = { USD: 7.25, HKD: 0.93 }
        exchangeRate = fallbackRates[currency] || 1
      }
    }

    const marketValueCny = marketValue * exchangeRate

    // 创建持仓
    const holding = await prisma.holding.create({
      data: {
        userId: session.user.id,
        accountId,
        securityId,
        quantity,
        averageCost,
        currentPrice: price,
        marketValueOriginal: marketValue,
        marketValueCny,
        unrealizedPnl,
        unrealizedPnlPercent,
        costBasis: totalCost,
      },
      include: {
        security: {
          include: {
            assetCategory: true,
            region: true,
          },
        },
        account: {
          include: {
            broker: true,
          },
        },
      },
    })

    // 记录操作日志
    try {
      await ActivityLogService.log({
        userId: session.user.id,
        action: 'HOLDING_CREATED',
        entityType: 'holding',
        entityId: holding.id,
        details: {
          symbol: security.symbol,
          name: security.name,
          quantity,
          averageCost,
          accountName: account.accountName,
          notes: notes || undefined,
          purchaseDate: purchaseDate || undefined,
        },
      })
    } catch (logError) {
      console.error('[日志记录失败]', logError)
    }

    return NextResponse.json({
      success: true,
      message: '持仓创建成功',
      data: holding,
    })
  } catch (error) {
    console.error('[创建持仓失败]', error)
    return NextResponse.json(
      { error: '创建持仓失败' },
      { status: 500 }
    )
  }
}

// GET - 获取用户所有持仓
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')

    const where: Record<string, unknown> = { userId: session.user.id }
    if (accountId) {
      where.accountId = accountId
    }

    const holdings = await prisma.holding.findMany({
      where,
      include: {
        security: {
          include: {
            assetCategory: true,
            region: true,
          },
        },
        account: {
          include: {
            broker: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: holdings,
    })
  } catch (error) {
    console.error('[获取持仓列表失败]', error)
    return NextResponse.json(
      { error: '获取持仓列表失败' },
      { status: 500 }
    )
  }
}
