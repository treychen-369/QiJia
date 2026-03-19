import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all' // all, region, category, account

    // 获取所有持仓数据
    const holdings = await prisma.holding.findMany({
      where: { userId },
      include: {
        security: {
          include: {
            assetCategory: true,
            region: true
          }
        },
        account: {
          include: { broker: true }
        }
      },
      orderBy: { marketValueCny: 'desc' }
    })

    // 计算总投资价值
    const totalValue = holdings.reduce((sum, holding) => sum + Number(holding.marketValueCny || 0), 0)

    let portfolioData: any = {}

    switch (type) {
      case 'region':
        // 按地区分组
        const regionGroups = holdings.reduce((acc, holding) => {
          const region = holding.security.region.name
          if (!acc[region]) {
            acc[region] = {
              name: region,
              code: holding.security.region.code,
              currency: holding.security.region.currency,
              holdings: [],
              totalValue: 0,
              totalUnrealizedPnl: 0,
              count: 0
            }
          }
          acc[region].holdings.push(holding)
          acc[region].totalValue += Number(holding.marketValueCny || 0)
          acc[region].totalUnrealizedPnl += Number(holding.unrealizedPnl || 0)
          acc[region].count += 1
          return acc
        }, {} as Record<string, any>)

        portfolioData = {
          type: 'region',
          totalValue,
          groups: Object.values(regionGroups).map((group: any) => ({
            ...group,
            percentage: totalValue > 0 ? (group.totalValue / totalValue) * 100 : 0,
            unrealizedPnlPercent: group.totalValue > 0 ? (group.totalUnrealizedPnl / group.totalValue) * 100 : 0,
            holdings: group.holdings.map((h: any) => ({
              id: h.id,
              security: {
                symbol: h.security.symbol,
                name: h.security.name,
                category: h.security.assetCategory.name
              },
              marketValue: h.marketValueCny,
              unrealizedPnl: h.unrealizedPnl,
              unrealizedPnlPercent: h.unrealizedPnlPercent,
              percentage: group.totalValue > 0 ? (h.marketValueCny / group.totalValue) * 100 : 0
            }))
          })).sort((a, b) => b.totalValue - a.totalValue)
        }
        break

      case 'category':
        // 按资产类别分组
        const categoryGroups = holdings.reduce((acc, holding) => {
          const category = holding.security.assetCategory.name
          if (!acc[category]) {
            acc[category] = {
              name: category,
              nameEn: holding.security.assetCategory.nameEn,
              holdings: [],
              totalValue: 0,
              totalUnrealizedPnl: 0,
              count: 0
            }
          }
          acc[category].holdings.push(holding)
          acc[category].totalValue += Number(holding.marketValueCny || 0)
          acc[category].totalUnrealizedPnl += Number(holding.unrealizedPnl || 0)
          acc[category].count += 1
          return acc
        }, {} as Record<string, any>)

        portfolioData = {
          type: 'category',
          totalValue,
          groups: Object.values(categoryGroups).map((group: any) => ({
            ...group,
            percentage: totalValue > 0 ? (group.totalValue / totalValue) * 100 : 0,
            unrealizedPnlPercent: group.totalValue > 0 ? (group.totalUnrealizedPnl / group.totalValue) * 100 : 0,
            holdings: group.holdings.map((h: any) => ({
              id: h.id,
              security: {
                symbol: h.security.symbol,
                name: h.security.name,
                region: h.security.region.name
              },
              account: {
                name: h.account.accountName,
                broker: h.account.broker.name
              },
              marketValue: h.marketValueCny,
              unrealizedPnl: h.unrealizedPnl,
              unrealizedPnlPercent: h.unrealizedPnlPercent,
              percentage: group.totalValue > 0 ? (h.marketValueCny / group.totalValue) * 100 : 0
            }))
          })).sort((a, b) => b.totalValue - a.totalValue)
        }
        break

      case 'account':
        // 按账户分组
        const accountGroups = holdings.reduce((acc, holding) => {
          const accountId = holding.account.id
          if (!acc[accountId]) {
            acc[accountId] = {
              id: accountId,
              name: holding.account.accountName,
              broker: holding.account.broker.name,
              currency: holding.account.currency,
              holdings: [],
              totalValue: 0,
              totalUnrealizedPnl: 0,
              count: 0
            }
          }
          acc[accountId].holdings.push(holding)
          acc[accountId].totalValue += Number(holding.marketValueCny || 0)
          acc[accountId].totalUnrealizedPnl += Number(holding.unrealizedPnl || 0)
          acc[accountId].count += 1
          return acc
        }, {} as Record<string, any>)

        portfolioData = {
          type: 'account',
          totalValue,
          groups: Object.values(accountGroups).map((group: any) => ({
            ...group,
            percentage: totalValue > 0 ? (group.totalValue / totalValue) * 100 : 0,
            unrealizedPnlPercent: group.totalValue > 0 ? (group.totalUnrealizedPnl / group.totalValue) * 100 : 0,
            holdings: group.holdings.map((h: any) => ({
              id: h.id,
              security: {
                symbol: h.security.symbol,
                name: h.security.name,
                category: h.security.assetCategory.name,
                region: h.security.region.name
              },
              marketValue: h.marketValueCny,
              unrealizedPnl: h.unrealizedPnl,
              unrealizedPnlPercent: h.unrealizedPnlPercent,
              percentage: group.totalValue > 0 ? (h.marketValueCny / group.totalValue) * 100 : 0
            }))
          })).sort((a, b) => b.totalValue - a.totalValue)
        }
        break

      default:
        // 返回所有持仓的详细信息
        const totalUnrealizedPnl = holdings.reduce((sum, h) => sum + Number(h.unrealizedPnl || 0), 0);
        portfolioData = {
          type: 'all',
          totalValue,
          totalUnrealizedPnl,
          totalUnrealizedPnlPercent: totalValue > 0 ? (totalUnrealizedPnl / totalValue) * 100 : 0,
          count: holdings.length,
          holdings: holdings.map(holding => ({
            id: holding.id,
            security: {
              symbol: holding.security.symbol,
              name: holding.security.name,
              category: holding.security.assetCategory.name,
              region: holding.security.region.name,
              exchange: holding.security.exchange
            },
            account: {
              id: holding.account.id,
              name: holding.account.accountName,
              broker: holding.account.broker.name,
              currency: holding.account.currency
            },
            quantity: holding.quantity,
            averageCost: holding.averageCost,
            currentPrice: holding.currentPrice,
            marketValue: holding.marketValueCny,
            costBasis: holding.costBasis,
            unrealizedPnl: holding.unrealizedPnl,
            unrealizedPnlPercent: holding.unrealizedPnlPercent,
            percentage: totalValue > 0 ? (Number(holding.marketValueCny || 0) / totalValue) * 100 : 0,
            lastUpdated: holding.lastUpdated
          }))
        }
    }

    return NextResponse.json(portfolioData)

  } catch (error) {
    console.error('获取投资组合数据失败:', error)
    return NextResponse.json(
      { error: '获取投资组合数据失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}