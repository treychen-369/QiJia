import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exchangeRateService } from '@/lib/exchange-rate-service'
import { ActivityLogService } from '@/lib/services/activity-log-service'

/**
 * 检查当前用户是否有权操作目标资产
 * 规则：
 *   1. 资产属于当前用户 → 放行
 *   2. 当前用户是家庭管理员，且资产拥有者是同家庭成员 → 放行
 */
async function checkAssetAccess(sessionUserId: string, assetOwnerId: string): Promise<boolean> {
  // 自己的资产
  if (assetOwnerId === sessionUserId) return true

  // 检查家庭管理员权限
  const currentUserMember = await prisma.familyMember.findUnique({
    where: { userId: sessionUserId },
    select: { familyId: true, role: true },
  })

  if (!currentUserMember || currentUserMember.role !== 'ADMIN') return false

  // 确认资产拥有者也在同一个家庭
  const assetOwnerMember = await prisma.familyMember.findFirst({
    where: { userId: assetOwnerId, familyId: currentUserMember.familyId },
  })

  return !!assetOwnerMember
}

// GET - 获取单个资产详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const assetId = params.id

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        assetCategory: {
          include: {
            parent: true,
          },
        },
      },
    })

    if (!asset) {
      return NextResponse.json({ error: '资产不存在' }, { status: 404 })
    }

    // 验证资产访问权限（本人 或 家庭管理员）
    const hasAccess = await checkAssetAccess(session.user.id, asset.userId)
    if (!hasAccess) {
      return NextResponse.json({ error: '无权访问此资产' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      data: asset,
    })
  } catch (error) {
    console.error('获取资产详情失败:', error)
    return NextResponse.json(
      { error: '获取资产详情失败' },
      { status: 500 }
    )
  }
}

// PUT - 更新资产
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const assetId = params.id
    const body = await request.json()

    // 验证资产所属
    const existingAsset = await prisma.asset.findUnique({
      where: { id: assetId },
    })

    if (!existingAsset) {
      return NextResponse.json({ error: '资产不存在' }, { status: 404 })
    }

    // 验证资产修改权限（本人 或 家庭管理员）
    const hasAccess = await checkAssetAccess(session.user.id, existingAsset.userId)
    if (!hasAccess) {
      return NextResponse.json({ error: '无权修改此资产' }, { status: 403 })
    }

    const {
      name,
      description,
      quantity,
      unitPrice,
      purchasePrice,
      currentValue,  // ✅ 添加 currentValue 字段
      originalValue,
      currency,
      purchaseDate,
      maturityDate,
      metadata,
      assetCategoryId,  // ✅ 支持分类变更（资产转移）
      underlyingType,   // ✅ 底层资产敞口类型覆盖（统计分类）
    } = body

    // 如果变更分类，验证目标分类存在
    if (assetCategoryId && assetCategoryId !== existingAsset.assetCategoryId) {
      const targetCategory = await prisma.assetCategory.findUnique({
        where: { id: assetCategoryId },
      })
      if (!targetCategory) {
        return NextResponse.json({ error: '目标资产分类不存在' }, { status: 400 })
      }
    }

    // 计算当前价值（CNY）
    const finalPurchasePrice = purchasePrice !== undefined ? purchasePrice : existingAsset.purchasePrice
    const finalCurrentValue = currentValue !== undefined ? currentValue : existingAsset.currentValue  // ✅ 接收前端传入的 currentValue
    const finalCurrency = currency || existingAsset.currency
    const finalPurchaseDate = purchaseDate ? new Date(purchaseDate) : existingAsset.purchaseDate
    const finalMetadata = metadata !== undefined ? metadata : existingAsset.metadata
    
    // ✅ 优先使用前端传入的 currentValue，否则使用购买价格
    let currentValueCny = finalCurrentValue !== undefined ? Number(finalCurrentValue) : Number(finalPurchasePrice)
    let originalVal = originalValue !== undefined ? originalValue : (Number(finalPurchasePrice) ?? existingAsset.originalValue)
    let purchasePriceCny = Number(finalPurchasePrice)

    // 对于非CNY货币，需要进行汇率换算
    if (finalCurrency && finalCurrency !== 'CNY') {
      const rate = await exchangeRateService.getRate(finalCurrency, 'CNY')
      // 如果前端传入了 currentValue，则换算；否则用 originalVal 换算
      if (currentValue !== undefined) {
        currentValueCny = Number(currentValue) * rate
      } else {
        currentValueCny = Number(originalVal) * rate
      }
      purchasePriceCny = Number(finalPurchasePrice) * rate
    }
    
    console.log(`📝 [API] 资产更新: name=${name} | currentValue(前端)=${currentValue} | currentValueCny=${currentValueCny} | purchasePriceCny=${purchasePriceCny}`)

    // ⭐ 特殊处理：货币基金根据7日年化收益率计算收益
    let unrealizedPnl = currentValueCny - purchasePriceCny
    let unrealizedPnlPercent = purchasePriceCny > 0 ? (unrealizedPnl / purchasePriceCny) * 100 : 0

    // 如果是货币基金且提供了 yield7Day，根据年化收益率和持有天数计算收益
    if (finalMetadata?.yield7Day && finalPurchaseDate) {
      const yield7Day = parseFloat(finalMetadata.yield7Day)
      const daysSincePurchase = Math.floor(
        (Date.now() - new Date(finalPurchaseDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      
      if (yield7Day > 0 && daysSincePurchase > 0) {
        // 计算实际收益：本金 * 年化收益率 / 365 * 天数
        const calculatedPnl = (purchasePriceCny * yield7Day / 100 / 365) * daysSincePurchase
        unrealizedPnl = calculatedPnl
        unrealizedPnlPercent = purchasePriceCny > 0 ? (unrealizedPnl / purchasePriceCny) * 100 : 0
        // 更新当前价值 = 本金 + 收益
        currentValueCny = purchasePriceCny + unrealizedPnl
        
        console.log(`💰 货币基金收益更新: 本金=${purchasePriceCny} 年化=${yield7Day}% 天数=${daysSincePurchase} 收益=${unrealizedPnl.toFixed(2)}`)
      }
    }

    // 更新资产
    const updatedAsset = await prisma.asset.update({
      where: { id: assetId },
      data: {
        name: name || existingAsset.name,
        description: description !== undefined ? description : existingAsset.description,
        quantity: quantity !== undefined ? Number(quantity) : existingAsset.quantity,
        unitPrice: unitPrice !== undefined ? Number(unitPrice) : existingAsset.unitPrice,
        purchasePrice: purchasePrice !== undefined ? Number(purchasePrice) : existingAsset.purchasePrice,
        currentValue: currentValueCny,
        originalValue: originalVal !== undefined ? Number(originalVal) : existingAsset.originalValue,
        currency: currency || existingAsset.currency,
        unrealizedPnl,
        unrealizedPnlPercent,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : existingAsset.purchaseDate,
        maturityDate: maturityDate ? new Date(maturityDate) : existingAsset.maturityDate,
        metadata: metadata !== undefined ? metadata : existingAsset.metadata,
        ...(assetCategoryId ? { assetCategoryId } : {}),
        ...(underlyingType !== undefined ? { underlyingType: underlyingType || null } : {}),
        lastUpdated: new Date(),
      },
      include: {
        assetCategory: {
          include: {
            parent: true,
          },
        },
      },
    })

    // 记录操作日志
    await ActivityLogService.logCashAssetActivity(
      session.user.id,
      {
        id: assetId,
        name: updatedAsset.name,
        currency: updatedAsset.currency,
      },
      'UPDATE',
      `更新资产: ${updatedAsset.name}`,
      {
        purchasePrice: Number(existingAsset.purchasePrice),
        currentValue: Number(existingAsset.currentValue),
      },
      {
        purchasePrice: Number(updatedAsset.purchasePrice),
        currentValue: Number(updatedAsset.currentValue),
      },
      Number(updatedAsset.currentValue) - Number(existingAsset.currentValue)
    )

    return NextResponse.json({
      success: true,
      message: '资产更新成功',
      data: updatedAsset,
    })
  } catch (error) {
    console.error('更新资产失败:', error)
    return NextResponse.json(
      { error: '更新资产失败' },
      { status: 500 }
    )
  }
}

// DELETE - 删除资产
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const assetId = params.id

    // 验证资产所属（含分类信息）
    const existingAsset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        assetCategory: true,
      },
    })

    if (!existingAsset) {
      return NextResponse.json({ error: '资产不存在' }, { status: 404 })
    }

    // 验证资产删除权限（本人 或 家庭管理员）
    const hasDeleteAccess = await checkAssetAccess(session.user.id, existingAsset.userId)
    if (!hasDeleteAccess) {
      return NextResponse.json({ error: '无权删除此资产' }, { status: 403 })
    }

    // 删除资产
    await prisma.asset.delete({
      where: { id: assetId },
    })

    // 记录操作日志
    await ActivityLogService.logCashAssetActivity(
      session.user.id,
      {
        id: assetId,
        name: existingAsset.name,
        currency: existingAsset.currency,
      },
      'DELETE',
      `删除${existingAsset.assetCategory?.name || '资产'}: ${existingAsset.name}`,
      {
        purchasePrice: Number(existingAsset.purchasePrice),
        currentValue: Number(existingAsset.currentValue),
      },
      undefined,
      -Number(existingAsset.currentValue)
    )

    return NextResponse.json({
      success: true,
      message: '资产删除成功',
    })
  } catch (error) {
    console.error('删除资产失败:', error)
    return NextResponse.json(
      { error: '删除资产失败' },
      { status: 500 }
    )
  }
}
