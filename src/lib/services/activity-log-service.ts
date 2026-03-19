/**
 * 资产操作记录服务
 * 用于记录所有资产的增删改查操作
 */
import { prisma } from '@/lib/prisma';
import { AssetType, ActivityAction, Prisma } from '@prisma/client';

export interface ActivityLogParams {
  userId: string;
  assetType: AssetType;
  assetId: string;
  assetName: string;
  assetSymbol?: string;
  action: ActivityAction;
  description?: string;
  previousValue?: Record<string, any>;
  newValue?: Record<string, any>;
  amountChange?: number;
  currency?: string;
  source?: 'manual' | 'api' | 'import' | 'scheduled';
  ipAddress?: string;
  userAgent?: string;
}

export class ActivityLogService {
  /**
   * 记录资产操作
   */
  static async log(params: ActivityLogParams): Promise<void> {
    try {
      await prisma.assetActivityLog.create({
        data: {
          userId: params.userId,
          assetType: params.assetType,
          assetId: params.assetId,
          assetName: params.assetName,
          assetSymbol: params.assetSymbol,
          action: params.action,
          description: params.description,
          previousValue: params.previousValue as Prisma.InputJsonValue,
          newValue: params.newValue as Prisma.InputJsonValue,
          amountChange: params.amountChange,
          currency: params.currency || 'CNY',
          source: params.source || 'manual',
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
      
      console.log(`📝 [ActivityLog] ${params.action}: ${params.assetType} - ${params.assetName}`);
    } catch (error) {
      // 记录日志失败不应影响主流程
      console.error('❌ [ActivityLog] 记录失败:', error);
    }
  }

  /**
   * 批量记录价格更新
   */
  static async logPriceUpdates(
    userId: string,
    updates: Array<{
      assetId: string;
      assetName: string;
      assetSymbol: string;
      previousPrice: number;
      newPrice: number;
      currency: string;
    }>,
    source: 'api' | 'scheduled' = 'api'
  ): Promise<void> {
    try {
      // 只记录价格有变化的
      const changedUpdates = updates.filter(u => u.previousPrice !== u.newPrice);
      
      if (changedUpdates.length === 0) {
        console.log('📝 [ActivityLog] 无价格变动，跳过记录');
        return;
      }

      await prisma.assetActivityLog.createMany({
        data: changedUpdates.map(update => ({
          userId,
          assetType: 'HOLDING' as AssetType,
          assetId: update.assetId,
          assetName: update.assetName,
          assetSymbol: update.assetSymbol,
          action: 'PRICE_UPDATE' as ActivityAction,
          description: `价格从 ${update.previousPrice.toFixed(2)} 更新为 ${update.newPrice.toFixed(2)}`,
          previousValue: { price: update.previousPrice } as Prisma.InputJsonValue,
          newValue: { price: update.newPrice } as Prisma.InputJsonValue,
          currency: update.currency,
          source,
        })),
      });

      console.log(`📝 [ActivityLog] 批量记录价格更新: ${changedUpdates.length} 条`);
    } catch (error) {
      console.error('❌ [ActivityLog] 批量记录失败:', error);
    }
  }

  /**
   * 获取用户的操作记录
   * 
   * ✨ 2026-01-31: 新增 assetId 筛选支持，用于详情对话框展示单资产更新记录
   */
  static async getActivityLogs(
    userId: string,
    options?: {
      assetId?: string;      // ✨ 新增：按单个资产ID筛选
      assetType?: AssetType;
      action?: ActivityAction;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: Prisma.AssetActivityLogWhereInput = {
      userId,
      ...(options?.assetId && { assetId: options.assetId }),  // ✨ 新增
      ...(options?.assetType && { assetType: options.assetType }),
      ...(options?.action && { action: options.action }),
      ...(options?.startDate || options?.endDate
        ? {
            createdAt: {
              ...(options?.startDate && { gte: options.startDate }),
              ...(options?.endDate && { lte: options.endDate }),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.assetActivityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.assetActivityLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * ✨ 新增：获取单个资产的更新记录（用于详情对话框）
   */
  static async getAssetActivityLogs(
    userId: string,
    assetId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ) {
    return this.getActivityLogs(userId, {
      assetId,
      limit: options?.limit || 20,
      offset: options?.offset || 0,
    });
  }

  /**
   * 获取最近的操作记录（用于Dashboard展示）
   */
  static async getRecentActivities(userId: string, limit: number = 10) {
    return prisma.assetActivityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        assetType: true,
        assetName: true,
        assetSymbol: true,
        action: true,
        description: true,
        amountChange: true,
        currency: true,
        source: true,
        createdAt: true,
      },
    });
  }

  /**
   * 获取今日操作统计
   */
  static async getTodayStats(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await prisma.assetActivityLog.groupBy({
      by: ['action'],
      where: {
        userId,
        createdAt: { gte: today },
      },
      _count: { id: true },
    });

    return {
      totalActivities: stats.reduce((sum, s) => sum + s._count.id, 0),
      byAction: Object.fromEntries(stats.map(s => [s.action, s._count.id])),
    };
  }

  // ============================================
  // 便捷方法：各资产类型的记录
  // ============================================

  /**
   * 记录持仓创建
   */
  static async logHoldingCreated(
    userId: string,
    holding: {
      id: string;
      symbol: string;
      name: string;
      quantity: number;
      averageCost: number;
      currency: string;
    }
  ) {
    await this.log({
      userId,
      assetType: 'HOLDING',
      assetId: holding.id,
      assetName: holding.name,
      assetSymbol: holding.symbol,
      action: 'CREATE',
      description: `新增持仓 ${holding.symbol} ${holding.quantity}股，均价 ${holding.averageCost}`,
      newValue: {
        quantity: holding.quantity,
        averageCost: holding.averageCost,
      },
      amountChange: holding.quantity * holding.averageCost,
      currency: holding.currency,
    });
  }

  /**
   * 记录持仓更新
   */
  static async logHoldingUpdated(
    userId: string,
    holding: {
      id: string;
      symbol: string;
      name: string;
    },
    previousValue: Record<string, any>,
    newValue: Record<string, any>
  ) {
    const changes = Object.keys(newValue)
      .filter(k => previousValue[k] !== newValue[k])
      .map(k => `${k}: ${previousValue[k]} → ${newValue[k]}`)
      .join(', ');

    await this.log({
      userId,
      assetType: 'HOLDING',
      assetId: holding.id,
      assetName: holding.name,
      assetSymbol: holding.symbol,
      action: 'UPDATE',
      description: changes || '更新持仓信息',
      previousValue,
      newValue,
    });
  }

  /**
   * 记录持仓删除
   */
  static async logHoldingDeleted(
    userId: string,
    holding: {
      id: string;
      symbol: string;
      name: string;
      quantity: number;
      marketValue: number;
      currency: string;
    }
  ) {
    await this.log({
      userId,
      assetType: 'HOLDING',
      assetId: holding.id,
      assetName: holding.name,
      assetSymbol: holding.symbol,
      action: 'DELETE',
      description: `删除持仓 ${holding.symbol} ${holding.quantity}股`,
      previousValue: {
        quantity: holding.quantity,
        marketValue: holding.marketValue,
      },
      amountChange: -holding.marketValue,
      currency: holding.currency,
    });
  }

  /**
   * 记录现金资产操作
   */
  static async logCashAssetActivity(
    userId: string,
    asset: {
      id: string;
      name: string;
      currency: string;
    },
    action: ActivityAction,
    description: string,
    previousValue?: Record<string, any>,
    newValue?: Record<string, any>,
    amountChange?: number
  ) {
    await this.log({
      userId,
      assetType: 'CASH_ASSET',
      assetId: asset.id,
      assetName: asset.name,
      action,
      description,
      previousValue,
      newValue,
      amountChange,
      currency: asset.currency,
    });
  }

  /**
   * 记录不动产操作
   */
  static async logRealEstateActivity(
    userId: string,
    asset: {
      id: string;
      name: string;
    },
    action: ActivityAction,
    description: string,
    previousValue?: Record<string, any>,
    newValue?: Record<string, any>,
    amountChange?: number
  ) {
    await this.log({
      userId,
      assetType: 'REAL_ESTATE',
      assetId: asset.id,
      assetName: asset.name,
      action,
      description,
      previousValue,
      newValue,
      amountChange,
      currency: 'CNY',
    });
  }

  /**
   * 记录负债操作
   */
  static async logLiabilityActivity(
    userId: string,
    liability: {
      id: string;
      name: string;
      currency: string;
    },
    action: ActivityAction,
    description: string,
    previousValue?: Record<string, any>,
    newValue?: Record<string, any>,
    amountChange?: number
  ) {
    await this.log({
      userId,
      assetType: 'LIABILITY',
      assetId: liability.id,
      assetName: liability.name,
      action,
      description,
      previousValue,
      newValue,
      amountChange,
      currency: liability.currency,
    });
  }
}
