import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exchangeRateService } from '@/lib/exchange-rate-service'
import { goldPriceService } from '@/lib/gold-price-service'
import { ActivityLogService } from '@/lib/services/activity-log-service'
import { AssetCalculationService } from '@/lib/services/asset-calculation-service'

// GET - 获取资产列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')

    // 构建查询条件
    const where: any = {
      userId: session.user.id,
    }

    if (categoryId) {
      where.assetCategoryId = categoryId
    }

    const assets = await prisma.asset.findMany({
      where,
      include: {
        assetCategory: {
          include: {
            parent: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // ⭐ 使用 AssetCalculationService 进行实时计算
    const assetsWithCalculations = await AssetCalculationService.calculateAssets(assets);

    return NextResponse.json({
      success: true,
      data: assetsWithCalculations,
    })
  } catch (error) {
    console.error('获取资产列表失败:', error)
    return NextResponse.json(
      { error: '获取资产列表失败' },
      { status: 500 }
    )
  }
}

// POST - 创建资产
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      assetCategoryId,
      quantity,
      unitPrice,
      purchasePrice,
      originalValue,
      currency,
      purchaseDate,
      maturityDate,
      metadata,
    } = body

    // 验证必填字段
    if (!name || !assetCategoryId) {
      return NextResponse.json(
        { error: '资产名称和分类为必填项' },
        { status: 400 }
      )
    }

    // 验证分类是否存在
    const category = await prisma.assetCategory.findUnique({
      where: { id: assetCategoryId },
    })

    if (!category) {
      return NextResponse.json(
        { error: '资产分类不存在' },
        { status: 400 }
      )
    }

    // 计算当前价值（CNY）
    // purchasePrice 是资产的原始货币金额，originalValue 可以用来覆盖
    const originalValueInOriginalCurrency = originalValue ?? purchasePrice ?? 0
    let currentValueCny = originalValueInOriginalCurrency
    let purchasePriceCny = purchasePrice ?? 0  // 购买成本（CNY）

    if (currency && currency !== 'CNY') {
      // 获取汇率并换算为CNY
      const rate = await exchangeRateService.getRate(currency, 'CNY')
      currentValueCny = originalValueInOriginalCurrency * rate
      purchasePriceCny = (purchasePrice ?? 0) * rate  // 购买成本也需要换算
    }

    // ⭐ 特殊处理：根据资产类型计算收益
    let unrealizedPnl = currentValueCny - purchasePriceCny
    let unrealizedPnlPercent = purchasePriceCny > 0 ? (unrealizedPnl / purchasePriceCny) * 100 : 0


    // 获取资产分类代码
    const assetType = category.code || '';

    // 如果是货币基金且提供了 yield7Day，根据年化收益率和持有天数计算收益
    if (assetType === 'CASH_MONEY_FUND' && metadata?.yield7Day && purchaseDate) {
      const yield7Day = parseFloat(metadata.yield7Day)
      const daysSincePurchase = Math.floor(
        (Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      
      if (yield7Day > 0 && daysSincePurchase > 0) {
        // 计算实际收益：本金 * 年化收益率 / 365 * 天数
        const calculatedPnl = (purchasePriceCny * yield7Day / 100 / 365) * daysSincePurchase
        unrealizedPnl = calculatedPnl
        unrealizedPnlPercent = purchasePriceCny > 0 ? (unrealizedPnl / purchasePriceCny) * 100 : 0
        // 更新当前价值 = 本金 + 收益
        currentValueCny = purchasePriceCny + unrealizedPnl
        
        console.log(`💰 货币基金收益计算: 本金=${purchasePriceCny} 年化=${yield7Day}% 天数=${daysSincePurchase} 收益=${unrealizedPnl.toFixed(2)}`)
      }
    }
    // 固定收益类：债券和理财产品
    else if (['FIXED_BOND', 'FIXED_WEALTH'].includes(assetType) && metadata?.annualYield && purchaseDate) {
      const annualYield = parseFloat(metadata.annualYield)
      const daysSincePurchase = Math.floor(
        (Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      
      if (annualYield > 0 && daysSincePurchase > 0) {
        const calculatedPnl = (purchasePriceCny * annualYield / 100 / 365) * daysSincePurchase
        unrealizedPnl = calculatedPnl
        unrealizedPnlPercent = purchasePriceCny > 0 ? (unrealizedPnl / purchasePriceCny) * 100 : 0
        currentValueCny = purchasePriceCny + unrealizedPnl
        
        console.log(`📊 固定收益计算: 本金=${purchasePriceCny} 年化=${annualYield}% 天数=${daysSincePurchase} 收益=${unrealizedPnl.toFixed(2)}`)
      }
    }
    // 不动产类：使用市场价值
    else if (['RE_RESIDENTIAL', 'RE_COMMERCIAL', 'RE_REITS'].includes(assetType) && metadata?.marketValue) {
      const marketValue = parseFloat(metadata.marketValue)
      if (marketValue > 0) {
        currentValueCny = marketValue * (currency && currency !== 'CNY' ? await exchangeRateService.getRate(currency, 'CNY') : 1)
        unrealizedPnl = currentValueCny - purchasePriceCny
        unrealizedPnlPercent = purchasePriceCny > 0 ? (unrealizedPnl / purchasePriceCny) * 100 : 0
        
        console.log(`🏠 不动产价值: 购买价=${purchasePriceCny} 市场价=${currentValueCny} 增值=${unrealizedPnl.toFixed(2)}`)
      }
    }
    // 贵金属：使用实时金价计算
    else if (assetType === 'ALT_GOLD' && metadata?.weight && metadata?.unitPrice) {
      const weight = parseFloat(metadata.weight);
      const purchaseUnitPrice = parseFloat(metadata.unitPrice);
      const metalType = metadata.metalType || 'gold';
      const goldCategory = metadata.goldCategory || 'investment';
      const jewelryBrand = metadata.jewelryBrand || '';
      
      // 使用金价服务获取实时价格
      const currentUnitPrice = goldPriceService.getCurrentPrice(metalType, goldCategory, jewelryBrand);
      
      const purchaseTotalCny = weight * purchaseUnitPrice;
      const currentTotalCny = weight * currentUnitPrice;
      
      purchasePriceCny = purchaseTotalCny;
      currentValueCny = currentTotalCny;
      unrealizedPnl = currentTotalCny - purchaseTotalCny;
      unrealizedPnlPercent = purchaseTotalCny > 0 ? (unrealizedPnl / purchaseTotalCny) * 100 : 0;
      
      console.log(`🪙 贵金属创建: 重量=${weight}克 买入价=${purchaseUnitPrice}元/克 现价=${currentUnitPrice}元/克 成本=${purchaseTotalCny} 市值=${currentValueCny} 盈亏=${unrealizedPnl.toFixed(2)}`);
    }
    // 其他另类投资：使用当前价格
    else if (['ALT_CRYPTO', 'ALT_COMMODITY', 'ALT_COLLECTIBLE'].includes(assetType) && metadata?.currentPrice) {
      const currentPrice = parseFloat(metadata.currentPrice)
      const assetQuantity = quantity ?? 1
      
      if (currentPrice > 0) {
        const marketValueOriginal = currentPrice * assetQuantity
        currentValueCny = marketValueOriginal * (currency && currency !== 'CNY' ? await exchangeRateService.getRate(currency, 'CNY') : 1)
        unrealizedPnl = currentValueCny - purchasePriceCny
        unrealizedPnlPercent = purchasePriceCny > 0 ? (unrealizedPnl / purchasePriceCny) * 100 : 0
        
        console.log(`🪙 另类投资: 数量=${assetQuantity} 单价=${currentPrice} 市值=${currentValueCny} 盈亏=${unrealizedPnl.toFixed(2)}`)
      }
    }

    // 创建资产
    const asset = await prisma.asset.create({
      data: {
        userId: session.user.id,
        assetCategoryId,
        name,
        description,
        quantity: quantity ?? 0,
        unitPrice: unitPrice ?? 0,
        purchasePrice: purchasePrice ?? 0,
        currentValue: currentValueCny,
        originalValue: originalValueInOriginalCurrency,
        currency: currency || 'CNY',
        unrealizedPnl,
        unrealizedPnlPercent,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        maturityDate: maturityDate ? new Date(maturityDate) : null,
        metadata: metadata || {},
      },
      include: {
        assetCategory: {
          include: {
            parent: true,
          },
        },
      },
    })

    // 转换Decimal类型为number
    const assetWithNumbers = {
      ...asset,
      quantity: Number(asset.quantity),
      unitPrice: Number(asset.unitPrice),
      purchasePrice: Number(asset.purchasePrice),
      currentValue: Number(asset.currentValue),
      originalValue: asset.originalValue ? Number(asset.originalValue) : null,
      unrealizedPnl: asset.unrealizedPnl ? Number(asset.unrealizedPnl) : null,
      unrealizedPnlPercent: asset.unrealizedPnlPercent ? Number(asset.unrealizedPnlPercent) : null,
    }

    // 记录操作日志
    const assetTypeMap: Record<string, 'CASH_ASSET' | 'REAL_ESTATE' | 'OTHER_ASSET'> = {
      'CASH_DEMAND': 'CASH_ASSET',
      'CASH_FIXED': 'CASH_ASSET',
      'CASH_MONEY_FUND': 'CASH_ASSET',
      'CASH_BROKER': 'CASH_ASSET',
      'RE_RESIDENTIAL': 'REAL_ESTATE',
      'RE_COMMERCIAL': 'REAL_ESTATE',
      'RE_REITS': 'REAL_ESTATE',
      'REC_PERSONAL_LOAN': 'OTHER_ASSET',
      'REC_DEPOSIT': 'OTHER_ASSET',
      'REC_SALARY': 'OTHER_ASSET',
      'REC_BUSINESS': 'OTHER_ASSET',
      'REC_OTHER': 'OTHER_ASSET',
    };
    
    const logAssetType = assetTypeMap[category.code || ''] || 'OTHER_ASSET';
    
    await ActivityLogService.log({
      userId: session.user.id,
      assetType: logAssetType,
      assetId: asset.id,
      assetName: asset.name,
      action: 'CREATE',
      description: `新建${category.name}: ${asset.name}`,
      newValue: {
        purchasePrice: assetWithNumbers.purchasePrice,
        currentValue: assetWithNumbers.currentValue,
        currency: asset.currency,
      },
      amountChange: assetWithNumbers.currentValue,
      currency: asset.currency,
    });

    return NextResponse.json({
      success: true,
      message: '资产创建成功',
      data: assetWithNumbers,
    })
  } catch (error) {
    console.error('创建资产失败:', error)
    return NextResponse.json(
      { error: '创建资产失败' },
      { status: 500 }
    )
  }
}
