import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ActivityLogService } from '@/lib/services/activity-log-service'

// GET - 获取单个持仓详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const holdingId = params.id

    const holding = await prisma.holding.findUnique({
      where: { id: holdingId },
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

    if (!holding) {
      return NextResponse.json({ error: '持仓不存在' }, { status: 404 })
    }

    // 验证持仓所属用户
    if (holding.userId !== session.user.id) {
      return NextResponse.json({ error: '无权访问此持仓' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      data: holding,
    })
  } catch (error) {
    console.error('获取持仓详情失败:', error)
    return NextResponse.json(
      { error: '获取持仓详情失败' },
      { status: 500 }
    )
  }
}

// PUT - 更新持仓
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const holdingId = params.id
    const body = await request.json()

    // 验证持仓所属
    const existingHolding = await prisma.holding.findUnique({
      where: { id: holdingId },
    })

    if (!existingHolding) {
      return NextResponse.json({ error: '持仓不存在' }, { status: 404 })
    }

    if (existingHolding.userId !== session.user.id) {
      return NextResponse.json({ error: '无权修改此持仓' }, { status: 403 })
    }

    // 验证输入数据
    const { quantity, costBasis, currentPrice, currency } = body

    if (!quantity || quantity <= 0) {
      return NextResponse.json({ error: '持仓数量必须大于0' }, { status: 400 })
    }

    if (!costBasis || costBasis <= 0) {
      return NextResponse.json({ error: '成本价必须大于0' }, { status: 400 })
    }

    if (!currentPrice || currentPrice <= 0) {
      return NextResponse.json({ error: '当前价格必须大于0' }, { status: 400 })
    }

    // 如果提供了货币类型，更新账户的货币
    if (currency && ['CNY', 'USD', 'HKD'].includes(currency)) {
      await prisma.investmentAccount.update({
        where: { id: existingHolding.accountId },
        data: { currency }
      })
    }

    // 计算新的值
    const marketValue = quantity * currentPrice
    const totalCost = quantity * costBasis
    const unrealizedPnl = marketValue - totalCost
    const unrealizedPnlPercent = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0

    // 获取汇率（简化处理，实际应该从数据库或API获取）
    const exchangeRate = existingHolding.marketValueCny && existingHolding.marketValueOriginal 
      ? Number(existingHolding.marketValueCny) / Number(existingHolding.marketValueOriginal)
      : 1

    // 更新持仓
    const updatedHolding = await prisma.holding.update({
      where: { id: holdingId },
      data: {
        quantity: Number(quantity),
        averageCost: Number(costBasis), // 更新平均成本
        currentPrice: Number(currentPrice),
        marketValueOriginal: Number(marketValue), // 原币种市值
        marketValueCny: Number(marketValue * exchangeRate), // 人民币市值
        unrealizedPnl: Number(unrealizedPnl),
        unrealizedPnlPercent: Number(unrealizedPnlPercent),
        costBasis: Number(totalCost), // 总成本
        lastUpdated: new Date(), // 使用 lastUpdated 而不是 updatedAt
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
    await ActivityLogService.logHoldingUpdated(
      session.user.id,
      {
        id: holdingId,
        symbol: updatedHolding.security.symbol,
        name: updatedHolding.security.name,
      },
      {
        quantity: Number(existingHolding.quantity),
        averageCost: Number(existingHolding.averageCost),
        currentPrice: Number(existingHolding.currentPrice),
      },
      {
        quantity: Number(quantity),
        averageCost: Number(costBasis),
        currentPrice: Number(currentPrice),
      }
    )

    return NextResponse.json({
      success: true,
      message: '持仓更新成功',
      data: updatedHolding,
    })
  } catch (error) {
    console.error('更新持仓失败:', error)
    return NextResponse.json(
      { error: '更新持仓失败' },
      { status: 500 }
    )
  }
}

// DELETE - 删除持仓
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const holdingId = params.id

    // 验证持仓所属（包含证券信息用于日志）
    const existingHolding = await prisma.holding.findUnique({
      where: { id: holdingId },
      include: {
        security: true,
        account: true,
      },
    })

    if (!existingHolding) {
      return NextResponse.json({ error: '持仓不存在' }, { status: 404 })
    }

    if (existingHolding.userId !== session.user.id) {
      return NextResponse.json({ error: '无权删除此持仓' }, { status: 403 })
    }

    // 删除持仓
    await prisma.holding.delete({
      where: { id: holdingId },
    })

    // 记录操作日志
    await ActivityLogService.logHoldingDeleted(
      session.user.id,
      {
        id: holdingId,
        symbol: existingHolding.security.symbol,
        name: existingHolding.security.name,
        quantity: Number(existingHolding.quantity),
        marketValue: Number(existingHolding.marketValueCny || 0),
        currency: existingHolding.account.currency,
      }
    )

    return NextResponse.json({
      success: true,
      message: '持仓删除成功',
    })
  } catch (error) {
    console.error('删除持仓失败:', error)
    return NextResponse.json(
      { error: '删除持仓失败' },
      { status: 500 }
    )
  }
}
