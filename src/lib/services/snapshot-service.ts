/**
 * 快照服务层
 * 
 * 职责：
 * 1. 创建每日投资组合快照
 * 2. 查询历史快照数据
 * 3. 计算历史趋势和收益率
 * 
 * 设计原则：
 * - 快照数据只用于历史查询，不用于实时展示
 * - 每日定时任务自动创建快照
 * - 快照基于PortfolioService的实时计算生成
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { PortfolioService } from './portfolio-service';
import { LiabilityService } from './liability-service';

// ==================== 类型定义 ====================

export interface PortfolioSnapshot {
  id: string;
  userId: string;
  snapshotDate: Date;
  totalValueCny: number;
  totalValueUsd?: number;
  cashBalanceCny: number;
  investedAmountCny: number;
  unrealizedPnl: number;
  realizedPnl?: number;
  dailyReturn?: number;
  cumulativeReturn?: number;
  // 新增：一级资产类型
  equityAssets?: number;
  fixedIncomeAssets?: number;
  cashEquivalents?: number;
  realEstateAssets?: number;
  alternativeAssets?: number;
  receivableAssets?: number;
  // 新增：总资产、负债、净资产
  totalAssets?: number;
  totalLiabilities?: number;
  netWorth?: number;
}

export interface HistoricalTrend {
  date: Date;
  totalValue: number;
  cashBalance: number;
  investedValue: number;
  unrealizedPnl: number;
  dailyReturn?: number;
  // 新增：一级资产类型
  equityAssets?: number;
  fixedIncomeAssets?: number;
  cashEquivalents?: number;
  realEstateAssets?: number;
  alternativeAssets?: number;
  receivableAssets?: number;
  // 新增：总资产、负债、净资产
  totalAssets?: number;
  totalLiabilities?: number;
  netWorth?: number;
}

export interface PerformanceMetrics {
  totalReturn: number;          // 总收益率
  annualizedReturn: number;     // 年化收益率
  volatility: number;            // 波动率
  sharpeRatio: number;          // 夏普比率
  maxDrawdown: number;          // 最大回撤
  winRate: number;              // 胜率（正收益天数占比）
}

// ==================== 服务类 ====================

export class SnapshotService {
  /**
   * 创建今日快照
   * 
   * 使用PortfolioService实时计算当前数据并保存快照
   * 通常由定时任务每日凌晨调用
   * 
   * @param userId 用户ID
   * @returns 创建的快照记录
   */
  static async createDailySnapshot(userId: string): Promise<PortfolioSnapshot> {
    // 获取实时投资组合数据
    const overview = await PortfolioService.calculatePortfolioOverview(userId);
    
    // 获取一级资产类型分布
    const overviewGroups = await PortfolioService.getPortfolioByOverviewGroup(userId);
    
    // 获取负债数据
    const liabilityOverview = await LiabilityService.calculateLiabilityOverview(userId);

    // 获取昨日快照（用于计算日收益率）
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const previousSnapshot = await prisma.portfolioHistory.findFirst({
      where: {
        userId,
        snapshotDate: {
          lte: yesterday,
        },
      },
      orderBy: {
        snapshotDate: 'desc',
      },
    });

    // 计算日收益率
    let dailyReturn = 0;
    if (previousSnapshot && Number(previousSnapshot.totalValueCny) > 0) {
      const prevValue = Number(previousSnapshot.totalValueCny);
      dailyReturn = (overview.totalAssets - prevValue) / prevValue;
    }

    // 计算累计收益率（需要知道初始投入，这里简化处理）
    const investedAmount = overview.totalAssets - overview.totalUnrealizedPnl;
    const cumulativeReturn =
      investedAmount > 0 ? overview.totalUnrealizedPnl / investedAmount : 0;

    // 解析一级资产类型金额（使用 code 字段匹配，大写）
    const getGroupValue = (groupId: string): number => {
      const group = overviewGroups.find(g => g.code.toLowerCase() === groupId.toLowerCase());
      return group ? group.value : 0;
    };
    
    const equityAssets = getGroupValue('EQUITY');
    const fixedIncomeAssets = getGroupValue('FIXED_INCOME');
    const cashEquivalents = getGroupValue('CASH');
    const realEstateAssets = getGroupValue('REAL_ESTATE');
    const alternativeAssets = getGroupValue('ALTERNATIVE');
    const receivableAssets = getGroupValue('RECEIVABLE');
    
    // 计算净资产
    const totalAssets = overview.totalAssets;
    const totalLiabilities = liabilityOverview.totalLiabilities;
    const netWorth = totalAssets - totalLiabilities;

    // 创建快照
    const snapshot = await prisma.portfolioHistory.create({
      data: {
        userId,
        snapshotDate: new Date(),
        totalValueCny: overview.totalAssets,
        cashBalanceCny: overview.totalCash,
        investedAmountCny: overview.totalInvestmentValue,
        unrealizedPnl: overview.totalUnrealizedPnl,
        realizedPnl: 0, // 需要从Transaction表计算
        dailyReturn,
        cumulativeReturn,
        // 新增字段
        totalAssets,
        totalCashAssets: overview.totalCashAssets,
        totalOtherAssets: overview.totalOtherAssets,
        totalLiabilities,
        netWorth,
        equityAssets,
        fixedIncomeAssets,
        cashEquivalents,
        realEstateAssets,
        alternativeAssets,
        receivableAssets,
      },
    });

    return {
      id: snapshot.id,
      userId: snapshot.userId,
      snapshotDate: snapshot.snapshotDate,
      totalValueCny: Number(snapshot.totalValueCny),
      cashBalanceCny: Number(snapshot.cashBalanceCny),
      investedAmountCny: Number(snapshot.investedAmountCny),
      unrealizedPnl: Number(snapshot.unrealizedPnl || 0),
      realizedPnl: Number(snapshot.realizedPnl || 0),
      dailyReturn: Number(snapshot.dailyReturn || 0),
      cumulativeReturn: Number(snapshot.cumulativeReturn || 0),
      equityAssets: Number(snapshot.equityAssets || 0),
      fixedIncomeAssets: Number(snapshot.fixedIncomeAssets || 0),
      cashEquivalents: Number(snapshot.cashEquivalents || 0),
      realEstateAssets: Number(snapshot.realEstateAssets || 0),
      alternativeAssets: Number(snapshot.alternativeAssets || 0),
      receivableAssets: Number(snapshot.receivableAssets || 0),
      totalAssets: Number(snapshot.totalAssets || 0),
      totalLiabilities: Number(snapshot.totalLiabilities || 0),
      netWorth: Number(snapshot.netWorth || 0),
    };
  }

  /**
   * 获取历史趋势数据
   * 
   * @param userId 用户ID
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @returns 历史趋势数据数组
   */
  static async getHistoricalTrend(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalTrend[]> {
    const snapshots = await prisma.portfolioHistory.findMany({
      where: {
        userId,
        snapshotDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        snapshotDate: 'asc',
      },
    });

    return snapshots.map((snapshot) => ({
      date: snapshot.snapshotDate,
      totalValue: Number(snapshot.totalValueCny),
      cashBalance: Number(snapshot.cashBalanceCny),
      investedValue: Number(snapshot.investedAmountCny),
      unrealizedPnl: Number(snapshot.unrealizedPnl || 0),
      dailyReturn: Number(snapshot.dailyReturn || 0),
      // 新增：一级资产类型
      equityAssets: Number(snapshot.equityAssets || 0),
      fixedIncomeAssets: Number(snapshot.fixedIncomeAssets || 0),
      cashEquivalents: Number(snapshot.cashEquivalents || 0),
      realEstateAssets: Number(snapshot.realEstateAssets || 0),
      alternativeAssets: Number(snapshot.alternativeAssets || 0),
      receivableAssets: Number(snapshot.receivableAssets || 0),
      // 新增：总资产、负债、净资产
      totalAssets: Number(snapshot.totalAssets || snapshot.totalValueCny || 0),
      totalLiabilities: Number(snapshot.totalLiabilities || 0),
      netWorth: Number(snapshot.netWorth || snapshot.totalValueCny || 0),
    }));
  }

  /**
   * 获取最近N天的趋势数据
   * 
   * @param userId 用户ID
   * @param days 天数（默认30天）
   * @returns 历史趋势数据数组
   */
  static async getRecentTrend(
    userId: string,
    days: number = 30
  ): Promise<HistoricalTrend[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.getHistoricalTrend(userId, startDate, endDate);
  }

  /**
   * 计算投资组合性能指标
   * 
   * @param userId 用户ID
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @returns 性能指标
   */
  static async calculatePerformanceMetrics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PerformanceMetrics> {
    const snapshots = await this.getHistoricalTrend(userId, startDate, endDate);

    if (snapshots.length < 2) {
      return {
        totalReturn: 0,
        annualizedReturn: 0,
        volatility: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
      };
    }

    // 计算总收益率
    const initialValue = snapshots[0].totalValue;
    const finalValue = snapshots[snapshots.length - 1].totalValue;
    const totalReturn = initialValue > 0 ? (finalValue - initialValue) / initialValue : 0;

    // 计算年化收益率
    const days = snapshots.length;
    const years = days / 365;
    const annualizedReturn = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;

    // 计算日收益率数组
    const dailyReturns = snapshots.map((s) => s.dailyReturn || 0);

    // 计算波动率（日收益率标准差 * sqrt(252)）
    const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
      dailyReturns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252); // 年化波动率

    // 计算夏普比率（假设无风险利率为3%）
    const riskFreeRate = 0.03;
    const sharpeRatio =
      volatility > 0 ? (annualizedReturn - riskFreeRate) / volatility : 0;

    // 计算最大回撤
    let maxDrawdown = 0;
    let peak = snapshots[0].totalValue;
    for (const snapshot of snapshots) {
      if (snapshot.totalValue > peak) {
        peak = snapshot.totalValue;
      }
      const drawdown = (peak - snapshot.totalValue) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // 计算胜率
    const positiveDays = dailyReturns.filter((r) => r > 0).length;
    const winRate = dailyReturns.length > 0 ? positiveDays / dailyReturns.length : 0;

    return {
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio,
      maxDrawdown,
      winRate,
    };
  }

  /**
   * 获取最新快照
   * 
   * @param userId 用户ID
   * @returns 最新快照或null
   */
  static async getLatestSnapshot(userId: string): Promise<PortfolioSnapshot | null> {
    const snapshot = await prisma.portfolioHistory.findFirst({
      where: { userId },
      orderBy: { snapshotDate: 'desc' },
    });

    if (!snapshot) return null;

    return {
      id: snapshot.id,
      userId: snapshot.userId,
      snapshotDate: snapshot.snapshotDate,
      totalValueCny: Number(snapshot.totalValueCny),
      cashBalanceCny: Number(snapshot.cashBalanceCny),
      investedAmountCny: Number(snapshot.investedAmountCny),
      unrealizedPnl: Number(snapshot.unrealizedPnl || 0),
      realizedPnl: Number(snapshot.realizedPnl || 0),
      dailyReturn: Number(snapshot.dailyReturn || 0),
      cumulativeReturn: Number(snapshot.cumulativeReturn || 0),
      equityAssets: Number(snapshot.equityAssets || 0),
      fixedIncomeAssets: Number(snapshot.fixedIncomeAssets || 0),
      cashEquivalents: Number(snapshot.cashEquivalents || 0),
      realEstateAssets: Number(snapshot.realEstateAssets || 0),
      alternativeAssets: Number(snapshot.alternativeAssets || 0),
      receivableAssets: Number(snapshot.receivableAssets || 0),
      totalAssets: Number(snapshot.totalAssets || 0),
      totalLiabilities: Number(snapshot.totalLiabilities || 0),
      netWorth: Number(snapshot.netWorth || 0),
    };
  }

  /**
   * 检查今日是否已创建快照
   * 
   * @param userId 用户ID
   * @returns 是否已存在今日快照
   */
  static async hasTodaySnapshot(userId: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await prisma.portfolioHistory.count({
      where: {
        userId,
        snapshotDate: {
          gte: today,
        },
      },
    });

    return count > 0;
  }

  /**
   * 批量创建所有用户的每日快照
   * 
   * 用于定时任务批量处理
   * 
   * @returns 创建的快照数量
   */
  static async createDailySnapshotsForAllUsers(): Promise<{
    success: number;
    failed: number;
    errors: Array<{ userId: string; error: string }>;
  }> {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true },
    });

    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    for (const user of users) {
      try {
        // 检查今日是否已有快照
        const hasSnapshot = await this.hasTodaySnapshot(user.id);
        if (hasSnapshot) {
          console.log(`用户 ${user.email} 今日快照已存在，跳过`);
          continue;
        }

        // 创建快照
        await this.createDailySnapshot(user.id);
        successCount++;
        console.log(`✅ 用户 ${user.email} 快照创建成功`);
      } catch (error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ userId: user.id, error: errorMessage });
        console.error(`❌ 用户 ${user.email} 快照创建失败:`, errorMessage);
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      errors,
    };
  }

  /**
   * 获取本月资产变动
   * 
   * 数据来源：
   * 1. PortfolioHistory 快照对比：月初 vs 最新 → 净资产变化、各分类变动
   * 2. AssetActivityLog 事件聚合：本月操作记录 → 具体变动事项
   * 
   * @param userId 用户ID
   * @returns MonthlyChangesResult
   */
  static async getMonthlyChanges(userId: string): Promise<MonthlyChangesResult> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 并行获取：月初快照、最新快照、本月活动日志
    const [monthStartSnapshot, latestSnapshot, activityLogs] = await Promise.all([
      // 月初快照：取本月1日或之后最早的一条
      prisma.portfolioHistory.findFirst({
        where: {
          userId,
          snapshotDate: { gte: monthStart },
        },
        orderBy: { snapshotDate: 'asc' },
      }),
      // 最新快照
      prisma.portfolioHistory.findFirst({
        where: { userId },
        orderBy: { snapshotDate: 'desc' },
      }),
      // 本月活动日志（排除 PRICE_UPDATE，它太频繁且不算用户操作变动）
      prisma.assetActivityLog.findMany({
        where: {
          userId,
          createdAt: { gte: monthStart },
          action: { not: 'PRICE_UPDATE' },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    // 如果没有快照数据，返回空结果
    if (!monthStartSnapshot || !latestSnapshot) {
      return {
        netWorthChange: 0,
        totalAssetsChange: 0,
        totalLiabilitiesChange: 0,
        items: [],
        updatedAt: now.toISOString(),
      };
    }

    const startAssets = Number(monthStartSnapshot.totalAssets || monthStartSnapshot.totalValueCny || 0);
    const startLiabilities = Number(monthStartSnapshot.totalLiabilities || 0);
    const startNetWorth = Number(monthStartSnapshot.netWorth || (startAssets - startLiabilities));
    const startEquity = Number(monthStartSnapshot.equityAssets || 0);
    const startFixedIncome = Number(monthStartSnapshot.fixedIncomeAssets || 0);
    const startCash = Number(monthStartSnapshot.cashEquivalents || 0);
    const startRealEstate = Number(monthStartSnapshot.realEstateAssets || 0);
    const startAlternative = Number(monthStartSnapshot.alternativeAssets || 0);

    const endAssets = Number(latestSnapshot.totalAssets || latestSnapshot.totalValueCny || 0);
    const endLiabilities = Number(latestSnapshot.totalLiabilities || 0);
    const endNetWorth = Number(latestSnapshot.netWorth || (endAssets - endLiabilities));
    const endEquity = Number(latestSnapshot.equityAssets || 0);
    const endFixedIncome = Number(latestSnapshot.fixedIncomeAssets || 0);
    const endCash = Number(latestSnapshot.cashEquivalents || 0);
    const endRealEstate = Number(latestSnapshot.realEstateAssets || 0);
    const endAlternative = Number(latestSnapshot.alternativeAssets || 0);

    // 构建变动项目列表（两个来源合并）
    const items: MonthlyChangeItem[] = [];

    // ── 来源1：快照分类变动（6大类资产 + 负债） ──
    const categoryChanges = [
      { name: '权益类资产', type: '市值变动', change: endEquity - startEquity },
      { name: '固定收益', type: '市值变动', change: endFixedIncome - startFixedIncome },
      { name: '现金及等价物', type: '资产变动', change: endCash - startCash },
      { name: '不动产', type: '资产变动', change: endRealEstate - startRealEstate },
      { name: '另类投资', type: '市值变动', change: endAlternative - startAlternative },
    ];

    // 只添加有显著变化的分类（变动 > 100 元）
    for (const cat of categoryChanges) {
      if (Math.abs(cat.change) > 100) {
        items.push({
          name: cat.name,
          type: cat.type,
          amount: cat.change,
          positive: cat.change >= 0,
          source: 'snapshot',
        });
      }
    }

    // 负债变动（单独处理，减少为正面）
    const liabilityChange = endLiabilities - startLiabilities;
    if (Math.abs(liabilityChange) > 100) {
      items.push({
        name: liabilityChange < 0 ? '负债减少' : '负债增加',
        type: liabilityChange < 0 ? '偿还债务' : '新增负债',
        amount: liabilityChange,
        positive: liabilityChange < 0, // 负债减少是正面的
        source: 'snapshot',
      });
    }

    // ── 来源2：活动日志中的重要事件（CREATE/DELETE 操作） ──
    const significantLogs = activityLogs.filter(
      (log) => log.action === 'CREATE' || log.action === 'DELETE'
    );

    for (const log of significantLogs) {
      const amount = Number(log.amountChange || 0);
      if (Math.abs(amount) < 100) continue;

      const actionLabel = log.action === 'CREATE'
        ? (log.assetType === 'LIABILITY' ? '新增负债' : '新增资产')
        : (log.assetType === 'LIABILITY' ? '移除负债' : '移除资产');

      items.push({
        name: log.assetName,
        type: actionLabel,
        amount,
        positive: log.action === 'CREATE'
          ? log.assetType !== 'LIABILITY'
          : log.assetType === 'LIABILITY',
        source: 'activity',
      });
    }

    // 按金额绝对值排序，取前8条
    items.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    return {
      netWorthChange: endNetWorth - startNetWorth,
      totalAssetsChange: endAssets - startAssets,
      totalLiabilitiesChange: endLiabilities - startLiabilities,
      items: items.slice(0, 8),
      updatedAt: latestSnapshot.snapshotDate.toISOString(),
    };
  }
}

// ─── 本月资产变动类型 ─────────────────────────────────

export interface MonthlyChangeItem {
  name: string;
  type: string;
  amount: number;
  positive: boolean;
  source: 'snapshot' | 'activity';
}

export interface MonthlyChangesResult {
  netWorthChange: number;
  totalAssetsChange: number;
  totalLiabilitiesChange: number;
  items: MonthlyChangeItem[];
  updatedAt: string;
}
