/**
 * 投资组合服务层
 * 
 * 职责：
 * 1. 计算账户总市值（持仓 + 现金）
 * 2. 计算投资组合概览（总资产、盈亏等）
 * 3. 计算投资组合分布（按账户、按资产类型、按地区）
 * 
 * 原则：
 * - 所有计算基于基础表（Holding、AccountBalance）实时计算
 * - 不依赖快照表的汇总字段
 * - 提供清晰的数据结构和类型定义
 * 
 * 阶段3优化：
 * - 从基础字段（quantity, averageCost, currentPrice）实时计算所有派生数据
 * - 移除对冗余字段（marketValueCny, unrealizedPnl等）的依赖
 * 
 * Phase 1 修复（2025-01-29）：
 * - 今日收益使用历史快照对比计算真实数据
 * - 净资产计算纳入负债扣除
 */

import { prisma } from '@/lib/prisma';
import { exchangeRateService } from '@/lib/exchange-rate-service';
import { goldPriceService } from '@/lib/gold-price-service';
import { Decimal } from '@prisma/client/runtime/library';
import { createLogger } from '@/lib/logger';

const logger = createLogger('PortfolioService');

// ==================== 计算辅助类型 ====================

/**
 * 持仓基础数据（从数据库读取）
 */
interface HoldingBaseData {
  quantity: number;
  averageCost: number;
  currentPrice: number;
}

/**
 * 持仓计算结果（实时计算）
 */
interface HoldingCalculatedData {
  costBasis: number;              // 成本基础 = quantity * averageCost
  marketValueOriginal: number;    // 原币种市值 = quantity * currentPrice
  marketValueCny: number;         // 人民币市值 = marketValueOriginal * exchangeRate
  unrealizedPnl: number;          // 未实现盈亏 = marketValueOriginal - costBasis
  unrealizedPnlPercent: number;   // 盈亏百分比 = (unrealizedPnl / costBasis) * 100
}

// ==================== 类型定义 ====================

export interface AccountSummary {
  id: string;
  name: string;
  broker: string;
  currency: string;
  holdingsValue: number;       // 持仓市值（CNY）
  holdingsValueOriginal: number; // 持仓市值（原币种）
  cashBalance: number;         // 现金余额（CNY）
  totalValue: number;          // 总市值（CNY）
  totalValueOriginal: number;  // 总市值（原币种）
  cashBalanceOriginal: number; // 现金余额（原币种）
  holdingCount: number;        // 持仓数量
  exchangeRate: number;        // 汇率
  lastUpdated: Date;
  cashLastUpdated: Date | null; // 现金余额最后更新时间
}

export interface PortfolioOverview {
  totalAssets: number;              // 总资产（证券+现金资产+其他资产）
  totalCash: number;                // 总现金（证券账户现金+活期存款）
  totalInvestmentValue: number;     // 证券持仓总市值
  totalCashAssets: number;          // 现金资产总值（活期+定期+货币基金+券商现金）
  totalOtherAssets: number;         // 其他资产总值（不动产、贵金属等）
  totalCostBasis: number;           // 全量资产总成本（证券+现金+其他）
  totalUnrealizedPnl: number;       // 全量资产未实现盈亏（证券+现金资产+其他资产）
  totalUnrealizedPnlPercent: number; // 全量资产未实现盈亏百分比
  securitiesUnrealizedPnl: number;  // 证券未实现盈亏
  securitiesUnrealizedPnlPercent: number; // 证券未实现盈亏百分比
  cashAssetsUnrealizedPnl: number;  // 现金资产收益（利息等）
  todayPnl: number;                 // 今日盈亏（全量资产）
  todayPnlPercent: number;          // 今日盈亏百分比（全量资产）
  accountCount: number;             // 证券账户数量
  holdingCount: number;             // 持仓数量
  calculatedAt: Date;               // 计算时间
}

export interface PortfolioDistribution {
  name: string;
  value: number;
  percentage: number;
  count: number;
  color?: string;
}

export interface AccountDistribution {
  id: string;
  name: string;
  broker: string;
  value: number;
  percentage: number;
  color?: string;
}

// ==================== 服务类 ====================

export class PortfolioService {
  /**
   * ⭐ 核心计算方法：从基础字段计算持仓详情
   * 
   * 这是阶段3优化的核心：所有派生数据从3个基础字段实时计算
   * - quantity: 持仓数量
   * - averageCost: 平均成本
   * - currentPrice: 当前价格
   * 
   * @param holding 持仓基础数据
   * @param exchangeRate 汇率（原币种 -> CNY）
   * @returns 计算后的持仓详情
   */
  static calculateHoldingDetails(
    holding: HoldingBaseData,
    exchangeRate: number = 1
  ): HoldingCalculatedData {
    const costBasis = holding.quantity * holding.averageCost;
    const marketValueOriginal = holding.quantity * holding.currentPrice;
    const marketValueCny = marketValueOriginal * exchangeRate;
    const unrealizedPnl = marketValueOriginal - costBasis;
    const unrealizedPnlPercent = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;

    return {
      costBasis,
      marketValueOriginal,
      marketValueCny,
      unrealizedPnl,
      unrealizedPnlPercent,
    };
  }

  /**
   * ✨ 新增：更新账户现金余额
   * 
   * @param accountId 账户ID
   * @param cashBalance 现金余额（原币种）
   * @returns 更新后的账户
   */
  static async updateAccountCashBalance(
    accountId: string,
    cashBalance: number
  ): Promise<{
    id: string;
    cashBalance: number;
    cashBalanceCny: number;
    cashExchangeRate: number;
    cashLastUpdated: Date;
  }> {
    // 获取账户信息以确定币种
    const account = await prisma.investmentAccount.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      throw new Error(`账户不存在: ${accountId}`);
    }

    // 获取汇率
    let exchangeRate = 1;
    if (account.currency !== 'CNY') {
      exchangeRate = await exchangeRateService.getRate(account.currency, 'CNY');
    }

    const cashBalanceCny = cashBalance * exchangeRate;

    // 更新账户
    const updated = await prisma.investmentAccount.update({
      where: { id: accountId },
      data: {
        cashBalance,
        cashBalanceCny,
        cashExchangeRate: exchangeRate,
        cashLastUpdated: new Date()
      }
    });

    logger.debug('更新账户现金余额', {
      accountId,
      accountName: account.accountName,
      currency: account.currency,
      cashBalance,
      exchangeRate
    });

    return {
      id: updated.id,
      cashBalance: Number(updated.cashBalance),
      cashBalanceCny: Number(updated.cashBalanceCny),
      cashExchangeRate: Number(updated.cashExchangeRate),
      cashLastUpdated: updated.cashLastUpdated!
    };
  }

  /**
   * 计算单个账户的总市值
   * 总市值 = 持仓市值 + 现金余额
   * 
   * ⚠️ 阶段3优化：现在使用基础字段实时计算，而非读取冗余字段
   * ⚠️ 2026-01-31更新：现金从账户表直接获取
   */
  static async calculateAccountTotalValue(
    accountId: string
  ): Promise<{ holdingsValue: number; cashBalance: number; totalValue: number }> {
    // 获取账户信息（包含现金余额）
    const account = await prisma.investmentAccount.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return { holdingsValue: 0, cashBalance: 0, totalValue: 0 };
    }

    // 获取实时汇率
    const exchangeRate = await exchangeRateService.getRate(account.currency, 'CNY');

    // 获取持仓数据
    const holdings = await prisma.holding.findMany({
      where: { accountId },
    });

    // 实时计算持仓市值
    let holdingsValue = 0;
    for (const holding of holdings) {
      // 优先使用新计算方法，如果数据库仍有旧字段则向后兼容
      if (holding.quantity && holding.averageCost && holding.currentPrice) {
        const calculated = this.calculateHoldingDetails(
          {
            quantity: Number(holding.quantity),
            averageCost: Number(holding.averageCost),
            currentPrice: Number(holding.currentPrice),
          },
          exchangeRate
        );
        holdingsValue += calculated.marketValueCny;
      } else {
        // 向后兼容：如果基础字段缺失，使用旧的marketValueCny字段
        holdingsValue += Number(holding.marketValueCny ?? 0);
      }
    }

    // ✨ 从账户表直接获取现金余额
    const cashBalanceOriginal = Number(account.cashBalance) ?? 0;
    const cashBalance = cashBalanceOriginal * exchangeRate;
    const totalValue = holdingsValue + cashBalance;

    return { holdingsValue, cashBalance, totalValue };
  }

  /**
   * 获取用户所有账户摘要
   * 
   * ⚠️ 阶段3优化：使用实时汇率计算持仓市值
   * ⚠️ 2026-01-31更新：现金从账户表直接获取
   */
  static async getAccountsSummary(userId: string): Promise<AccountSummary[]> {
    // 获取所有账户（包含现金余额）
    const accounts = await prisma.investmentAccount.findMany({
      where: { userId },
      include: { 
        broker: true,
        holdings: true  // 包含持仓以获取数量
      },
    });

    // 获取所有持仓（包含账户信息以获取货币）
    const holdings = await prisma.holding.findMany({
      where: { userId },
      include: { account: true }
    });

    // 按账户分组并实时计算持仓市值
    const accountHoldingsValue: Record<string, { cny: number; original: number }> = {};
    
    for (const holding of holdings) {
      const accountId = holding.accountId;
      if (!accountHoldingsValue[accountId]) {
        accountHoldingsValue[accountId] = { cny: 0, original: 0 };
      }

      // ✅ 使用 exchangeRateService 获取实时汇率
      const exchangeRate = await exchangeRateService.getRate(holding.account.currency, 'CNY');

      // 使用新计算方法
      if (holding.quantity && holding.averageCost && holding.currentPrice) {
        const calculated = this.calculateHoldingDetails(
          {
            quantity: Number(holding.quantity),
            averageCost: Number(holding.averageCost),
            currentPrice: Number(holding.currentPrice),
          },
          exchangeRate
        );
        accountHoldingsValue[accountId].cny += calculated.marketValueCny;
        accountHoldingsValue[accountId].original += calculated.marketValueOriginal;
      } else {
        // 向后兼容
        accountHoldingsValue[accountId].cny += Number(holding.marketValueCny ?? 0);
        accountHoldingsValue[accountId].original += Number(holding.marketValueOriginal ?? 0);
      }
    }

    // 构建账户摘要
    const summaries: AccountSummary[] = [];
    
    for (const account of accounts) {
      const holdingsValue = accountHoldingsValue[account.id]?.cny || 0;
      const holdingsValueOriginal = accountHoldingsValue[account.id]?.original || 0;
      
      // ✨ 从账户表直接获取现金余额
      const cashBalanceOriginal = Number(account.cashBalance) || 0;
      const exchangeRate = await exchangeRateService.getRate(account.currency, 'CNY');
      const cashBalance = cashBalanceOriginal * exchangeRate;
      
      const totalValue = holdingsValue + cashBalance;
      const totalValueOriginal = holdingsValueOriginal + cashBalanceOriginal;

      summaries.push({
        id: account.id,
        name: account.accountName,
        broker: account.broker.name,
        currency: account.currency,
        holdingsValue,
        holdingsValueOriginal,
        cashBalance,
        totalValue,
        totalValueOriginal,
        cashBalanceOriginal,
        holdingCount: account.holdings.length,
        exchangeRate,
        lastUpdated: account.updatedAt,
        cashLastUpdated: account.cashLastUpdated,
      });
    }

    return summaries;
  }

  /**
   * 计算投资组合概览
   * 
   * ⚠️ 阶段3优化：使用实时汇率计算盈亏数据
   * ⚠️ Phase 1修复：
   *    1. 今日收益基于历史快照计算真实数据
   *    2. 总资产包含所有资产类型（证券+现金资产+其他资产）
   *    3. 总现金包含证券账户现金+活期存款
   */
  static async calculatePortfolioOverview(userId: string): Promise<PortfolioOverview> {
    // =====================================================
    // Part 1: 计算证券相关数据
    // =====================================================
    
    // 获取账户摘要（已使用实时汇率）
    const accounts = await this.getAccountsSummary(userId);

    // 获取所有持仓（包含账户信息）
    const holdings = await prisma.holding.findMany({
      where: { userId },
      include: { account: true }
    });

    // 证券账户总现金
    const brokerCash = accounts.reduce((sum, acc) => sum + acc.cashBalance, 0);

    // 实时计算持仓市值和盈亏（使用实时汇率）
    let totalInvestmentValue = 0;
    let totalUnrealizedPnl = 0;
    let totalCostBasis = 0;

    for (const holding of holdings) {
      const exchangeRate = await exchangeRateService.getRate(holding.account.currency, 'CNY');

      if (holding.quantity && holding.averageCost && holding.currentPrice) {
        const calculated = this.calculateHoldingDetails(
          {
            quantity: Number(holding.quantity),
            averageCost: Number(holding.averageCost),
            currentPrice: Number(holding.currentPrice),
          },
          exchangeRate
        );
        totalInvestmentValue += calculated.marketValueCny;
        totalUnrealizedPnl += calculated.unrealizedPnl * exchangeRate;
        totalCostBasis += calculated.costBasis * exchangeRate;
      } else {
        // 向后兼容
        totalInvestmentValue += Number(holding.marketValueCny ?? 0);
        totalUnrealizedPnl += Number(holding.unrealizedPnl ?? 0);
        totalCostBasis += Number(holding.costBasis ?? 0);
      }
    }

    // =====================================================
    // Part 2: 计算现金资产（Asset表）
    // =====================================================
    
    const cashAssetCategories = ['CASH_DEMAND', 'CASH_FIXED', 'CASH_MONEY_FUND', 'CASH_BROKER'];
    const cashAssetsResult = await this.calculateCashAssets(userId, cashAssetCategories);
    const { totalCashAssets, demandDeposits, totalEarnings: cashEarnings, totalCostBasis: cashCostBasis } = cashAssetsResult;

    // =====================================================
    // Part 3: 计算其他非证券资产（不动产、贵金属等）
    // =====================================================
    
    const otherAssetsResult = await this.calculateOtherAssets(userId, cashAssetCategories);
    const { totalOtherAssets, totalUnrealizedPnl: otherAssetsPnl, totalCostBasis: otherAssetsCostBasis } = otherAssetsResult;

    // =====================================================
    // Part 4: 汇总计算（全量家庭资产视角）
    // =====================================================
    
    // 总资产 = 证券持仓 + 证券账户现金 + 现金资产 + 其他资产
    const totalAssets = totalInvestmentValue + brokerCash + totalCashAssets + totalOtherAssets;
    
    // 总现金 = 证券账户现金 + 活期存款（高流动性）
    const totalCash = brokerCash + demandDeposits;

    // =====================================================
    // Part 5: 全量资产收益计算（核心修正）
    // =====================================================
    
    // 证券部分的收益率（仅用于单独展示）
    const securitiesUnrealizedPnl = totalUnrealizedPnl;  // 证券未实现盈亏
    const securitiesUnrealizedPnlPercent = totalCostBasis > 0 
      ? (securitiesUnrealizedPnl / totalCostBasis) * 100 
      : 0;
    
    // 全量资产的累计收益 = 证券收益 + 现金资产收益（利息）+ 其他资产收益
    const allAssetsUnrealizedPnl = securitiesUnrealizedPnl + cashEarnings + otherAssetsPnl;
    
    // 全量资产的总成本
    const allAssetsCostBasis = totalCostBasis + cashCostBasis + otherAssetsCostBasis;
    
    // 全量资产的收益率
    const allAssetsUnrealizedPnlPercent = allAssetsCostBasis > 0 
      ? (allAssetsUnrealizedPnl / allAssetsCostBasis) * 100 
      : 0;

    // =====================================================
    // Part 6: 今日收益（全量资产视角）
    // =====================================================
    
    // ⚠️ 今日收益需要使用全量资产进行对比
    const { todayPnl, todayPnlPercent } = await this.calculateTodayPnl(userId, totalAssets);

    logger.debug('总资产计算完成', {
      totalAssets: totalAssets.toFixed(2),
      totalCash: totalCash.toFixed(2),
      holdingsCount: holdings.length
    });

    return {
      totalAssets,
      totalCash,
      totalInvestmentValue,
      totalCashAssets,
      totalOtherAssets,
      totalCostBasis: allAssetsCostBasis,                   // 全量资产总成本
      totalUnrealizedPnl: allAssetsUnrealizedPnl,           // 全量资产收益
      totalUnrealizedPnlPercent: allAssetsUnrealizedPnlPercent, // 全量资产收益率
      securitiesUnrealizedPnl,                              // 证券收益
      securitiesUnrealizedPnlPercent,                       // 证券收益率
      cashAssetsUnrealizedPnl: cashEarnings,                // 现金资产收益（利息）
      todayPnl,
      todayPnlPercent,
      accountCount: accounts.length,
      holdingCount: holdings.length,
      calculatedAt: new Date(),
    };
  }

  /**
   * 计算现金资产总值（从Asset表）
   * 
   * @param userId 用户ID
   * @param cashAssetCategories 现金资产分类代码
   * @returns { totalCashAssets: 现金资产总值, demandDeposits: 活期存款, totalEarnings: 累计收益, totalCostBasis: 总成本 }
   */
  private static async calculateCashAssets(
    userId: string,
    cashAssetCategories: string[]
  ): Promise<{ 
    totalCashAssets: number; 
    demandDeposits: number; 
    totalEarnings: number;
    totalCostBasis: number;
  }> {
    // 获取现金资产分类ID
    const categories = await prisma.assetCategory.findMany({
      where: { code: { in: cashAssetCategories } },
      select: { id: true, code: true }
    });

    const categoryIds = categories.map(c => c.id);
    const demandCategoryId = categories.find(c => c.code === 'CASH_DEMAND')?.id;

    // 获取所有现金资产
    const cashAssets = await prisma.asset.findMany({
      where: {
        userId,
        assetCategoryId: { in: categoryIds }
      },
      include: { assetCategory: true }
    });

    let totalCashAssets = 0;
    let demandDeposits = 0;
    let totalEarnings = 0;    // 累计收益
    let totalCostBasis = 0;   // 总成本

    for (const asset of cashAssets) {
      const exchangeRate = await exchangeRateService.getRate(asset.currency, 'CNY');
      const assetType = asset.assetCategory?.code;
      const metadata = asset.metadata as any || {};

      // 原币种本金
      const originalValue = asset.originalValue != null ? Number(asset.originalValue) : Number(asset.purchasePrice);

      // 先在原币种计算收益，再统一转 CNY
      let currentValueOriginal = originalValue;
      let earningsOriginal = 0;

      // 货币基金：根据7日年化收益率计算
      if (assetType === 'CASH_MONEY_FUND' && metadata.yield7Day && asset.purchaseDate) {
        const yield7Day = parseFloat(metadata.yield7Day) || 0;
        const daysSincePurchase = Math.floor(
          (Date.now() - new Date(asset.purchaseDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (yield7Day > 0 && daysSincePurchase > 0) {
          earningsOriginal = (originalValue * yield7Day / 100 / 365) * daysSincePurchase;
          currentValueOriginal = originalValue + earningsOriginal;
        }
      }
      // 定期存款：根据利率计算应计利息
      else if (assetType === 'CASH_FIXED' && metadata.interestRate && asset.purchaseDate) {
        const interestRate = parseFloat(metadata.interestRate) || 0;
        const startDate = new Date(asset.purchaseDate);
        const maturityDate = asset.maturityDate ? new Date(asset.maturityDate) : new Date();
        const now = new Date();

        const totalDays = Math.floor((maturityDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const elapsedDays = Math.min(
          Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
          totalDays > 0 ? totalDays : 365
        );

        if (interestRate > 0 && elapsedDays > 0) {
          earningsOriginal = (originalValue * interestRate / 100 / 365) * elapsedDays;
          currentValueOriginal = originalValue + earningsOriginal;
        }
      }

      // 统一转换为 CNY
      const currentValueCny = currentValueOriginal * exchangeRate;
      const purchasePriceCny = originalValue * exchangeRate;
      const earningsCny = earningsOriginal * exchangeRate;

      totalCashAssets += currentValueCny;
      totalCostBasis += purchasePriceCny;
      totalEarnings += earningsCny;

      // 活期存款单独统计（高流动性）
      if (asset.assetCategoryId === demandCategoryId) {
        demandDeposits += currentValueCny;
      }
    }

    logger.debug('现金资产计算完成', {
      count: cashAssets.length,
      total: totalCashAssets.toFixed(2),
      earnings: totalEarnings.toFixed(2)
    });

    return { totalCashAssets, demandDeposits, totalEarnings, totalCostBasis };
  }

  /**
   * 计算其他非证券资产总值（不动产、贵金属等）
   * 
   * @param userId 用户ID
   * @param excludeCategories 排除的分类代码（现金资产已单独计算）
   * @returns { totalOtherAssets: 其他资产总值, totalUnrealizedPnl: 未实现盈亏, totalCostBasis: 总成本 }
   */
  private static async calculateOtherAssets(
    userId: string,
    excludeCategories: string[]
  ): Promise<{ totalOtherAssets: number; totalUnrealizedPnl: number; totalCostBasis: number }> {
    // 获取排除的分类ID
    const excludedCategories = await prisma.assetCategory.findMany({
      where: { code: { in: excludeCategories } },
      select: { id: true }
    });
    const excludeIds = excludedCategories.map(c => c.id);

    // 获取所有其他资产
    const otherAssets = await prisma.asset.findMany({
      where: {
        userId,
        assetCategoryId: { notIn: excludeIds }
      },
      include: { assetCategory: true }
    });

    let totalOtherAssets = 0;
    let totalUnrealizedPnl = 0;  // 未实现盈亏
    let totalCostBasis = 0;       // 总成本

    for (const asset of otherAssets) {
      const exchangeRate = await exchangeRateService.getRate(asset.currency, 'CNY');
      const assetType = asset.assetCategory?.code;
      const metadata = asset.metadata as any || {};

      let assetValue = 0;
      let costBasis = 0;  // 资产成本
      let calculationMethod = '';

      // 计算成本基础（CNY）
      const purchasePriceCny = (asset.originalValue != null ? Number(asset.originalValue) : Number(asset.purchasePrice)) * exchangeRate;
      costBasis = purchasePriceCny;

      // 不动产：使用市场估值（支持多种metadata字段）
      if (assetType?.startsWith('RE_')) {
        // 优先级：marketValue > currentMarketPrice > appraisalValue > currentValue > purchasePrice
        const marketValue = 
          metadata.marketValue ?? 
          metadata.currentMarketPrice ?? 
          metadata.appraisalValue ?? 
          (asset.currentValue != null ? Number(asset.currentValue) : Number(asset.purchasePrice));
        assetValue = Number(marketValue) * exchangeRate;
        calculationMethod = `RE_ (marketValue=${metadata.marketValue}, currentMarketPrice=${metadata.currentMarketPrice}, appraisalValue=${metadata.appraisalValue}, currentValue=${asset.currentValue})`;
      }
      // 贵金属：使用当前价值
      else if (assetType?.startsWith('METAL_')) {
        assetValue = (asset.currentValue != null ? Number(asset.currentValue) : Number(asset.purchasePrice)) * exchangeRate;
        calculationMethod = 'METAL_ (currentValue || purchasePrice)';
      }
      // 固定收益类（理财产品等）：计算应计收益
      else if (assetType?.startsWith('FIXED_') && metadata.annualYield && asset.purchaseDate) {
        const annualYield = parseFloat(metadata.annualYield) || 0;
        const daysSincePurchase = Math.floor(
          (Date.now() - new Date(asset.purchaseDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (annualYield > 0 && daysSincePurchase > 0) {
          const earnings = (purchasePriceCny * annualYield / 100 / 365) * daysSincePurchase;
          assetValue = purchasePriceCny + earnings;
          calculationMethod = `FIXED_ (yield=${annualYield}%, days=${daysSincePurchase}, earnings=${earnings.toFixed(2)})`;
        } else {
          assetValue = purchasePriceCny;
          calculationMethod = 'FIXED_ (no yield or days)';
        }
      }
      // 黄金/贵金属（ALT_GOLD）：使用实时金价计算市值
      else if (assetType === 'ALT_GOLD') {
        // 读取 metadata 中的贵金属信息
        const weight = metadata.weight != null ? Number(metadata.weight) : (asset.quantity != null ? Number(asset.quantity) : 1);
        const purchaseUnitPrice = metadata.unitPrice != null ? Number(metadata.unitPrice) : (asset.unitPrice != null ? Number(asset.unitPrice) : 0);
        const metalType = metadata.metalType || 'gold';
        const goldCategory = metadata.goldCategory || 'investment';
        const jewelryBrand = metadata.jewelryBrand || '';
        
        // 使用金价服务获取实时价格（返回 CNY/克）
        const currentUnitPrice = goldPriceService.getCurrentPrice(metalType, goldCategory, jewelryBrand);
        
        // 金价已是 CNY，不需要再乘汇率
        const purchaseTotalCny = weight * purchaseUnitPrice;
        const currentTotalCny = weight * currentUnitPrice;
        
        assetValue = currentTotalCny;
        costBasis = purchaseTotalCny;
        
        calculationMethod = `ALT_GOLD (weight=${weight}g, buy=${purchaseUnitPrice}元/g, now=${currentUnitPrice}元/g)`;
      }
      // 实物资产（ALT_PHYSICAL）：使用估值
      else if (assetType === 'ALT_PHYSICAL') {
        // 优先级：estimatedValue > currentMarketPrice > appraisalValue > currentValue > purchasePrice
        const estimatedValue = metadata.estimatedValue != null ? Number(metadata.estimatedValue) : 
                               metadata.currentMarketPrice != null ? Number(metadata.currentMarketPrice) : 
                               metadata.appraisalValue != null ? Number(metadata.appraisalValue) : 
                               (asset.currentValue != null ? Number(asset.currentValue) : 
                               (asset.purchasePrice != null ? Number(asset.purchasePrice) : 0));
        assetValue = estimatedValue * exchangeRate;
        calculationMethod = `ALT_PHYSICAL (estimatedValue=${metadata.estimatedValue}, appraisalValue=${metadata.appraisalValue}, currentValue=${asset.currentValue})`;
      }
      // 其他类型：使用当前价值或购买价格
      else {
        const value = asset.currentValue != null ? Number(asset.currentValue) : (asset.purchasePrice != null ? Number(asset.purchasePrice) : 0);
        assetValue = value * exchangeRate;
        calculationMethod = 'default (currentValue || purchasePrice)';
      }

      totalOtherAssets += assetValue;
      totalCostBasis += costBasis;
      totalUnrealizedPnl += (assetValue - costBasis);
    }

    logger.debug('其他资产计算完成', {
      count: otherAssets.length,
      total: totalOtherAssets.toFixed(2)
    });

    return { totalOtherAssets, totalUnrealizedPnl, totalCostBasis };
  }

  /**
   * 计算今日盈亏（基于历史快照对比）
   * 
   * ⚠️ Phase 2 修正：全量家庭资产视角
   * - 历史快照需要包含全量资产（totalAssets）
   * - 今日收益 = 当前全量资产 - 昨日全量资产
   * 
   * 策略：
   * 1. 优先使用快照的 totalAssets 字段（如果存在）
   * 2. 否则使用 totalValueCny（向后兼容旧快照）
   * 3. 如果完全没有历史数据，返回0
   * 
   * @param userId 用户ID
   * @param currentTotalAssets 当前全量资产总值
   * @returns 今日盈亏和盈亏百分比
   */
  private static async calculateTodayPnl(
    userId: string,
    currentTotalAssets: number
  ): Promise<{ todayPnl: number; todayPnlPercent: number }> {
    // 获取今天0点的时间戳（使用本地时区）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 获取昨天0点的时间戳
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    try {
      // 方案1：查找昨日快照
      let previousSnapshot = await prisma.portfolioHistory.findFirst({
        where: {
          userId,
          snapshotDate: {
            gte: yesterday,
            lt: today
          }
        },
        orderBy: { snapshotDate: 'desc' }
      });

      // 方案2：如果没有昨日快照，查找最近7天内的快照
      if (!previousSnapshot) {
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        previousSnapshot = await prisma.portfolioHistory.findFirst({
          where: {
            userId,
            snapshotDate: {
              gte: oneWeekAgo,
              lt: today
            }
          },
          orderBy: { snapshotDate: 'desc' }
        });
      }

      // 如果找到历史快照，计算差值
      if (previousSnapshot) {
        // ✅ 优先使用 totalAssets 字段（全量资产）
        // 如果不存在，则使用 totalValueCny（向后兼容旧快照，仅含证券）
        const previousValue = Number(previousSnapshot.totalAssets ?? previousSnapshot.totalValueCny ?? 0);
        
        if (previousValue > 0) {
          const todayPnl = currentTotalAssets - previousValue;
          const todayPnlPercent = (todayPnl / previousValue) * 100;

          logger.debug('今日收益计算完成', {
            previousDate: previousSnapshot.snapshotDate.toISOString().split('T')[0],
            todayPnl: todayPnl.toFixed(2)
          });

          return { todayPnl, todayPnlPercent };
        }
      }

      // 没有历史数据，返回0（首次使用或数据丢失）
      logger.debug('无历史快照数据，今日收益显示为0');
      return { todayPnl: 0, todayPnlPercent: 0 };

    } catch (error) {
      logger.error('计算今日收益失败', error);
      return { todayPnl: 0, todayPnlPercent: 0 };
    }
  }

  /**
   * 计算按账户的投资组合分布
   */
  static async getPortfolioByAccount(userId: string): Promise<AccountDistribution[]> {
    const accounts = await this.getAccountsSummary(userId);
    const totalAssets = accounts.reduce((sum, acc) => sum + acc.totalValue, 0);

    // 专业协调的账户配色方案
    const colors = ['#60A5FA', '#34D399', '#A78BFA', '#FBBF24', '#F9A8D4', '#FB923C'];

    return accounts
      .map((account, index) => ({
        id: account.id,
        name: account.name,
        broker: account.broker,
        value: account.totalValue,
        percentage: totalAssets > 0 ? (account.totalValue / totalAssets) * 100 : 0,
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.value - a.value);
  }

  /**
   * 计算按地区的投资组合分布
   */
  static async getPortfolioByRegion(userId: string): Promise<PortfolioDistribution[]> {
    const holdings = await prisma.holding.findMany({
      where: { userId },
      include: {
        security: {
          include: { region: true },
        },
        account: true,
      },
    });

    // 使用实时汇率计算市值
    let totalInvestmentValue = 0;
    const holdingValues: { region: string; value: number }[] = [];

    for (const holding of holdings) {
      const exchangeRate = await exchangeRateService.getRate(holding.account.currency, 'CNY');
      let value = 0;
      if (holding.quantity && holding.currentPrice) {
        value = Number(holding.quantity) * Number(holding.currentPrice) * exchangeRate;
      } else {
        value = Number(holding.marketValueCny ?? 0);
      }
      totalInvestmentValue += value;
      holdingValues.push({ region: holding.security.region.name, value });
    }

    // 按地区分组
    const regionDistribution: Record<string, { value: number; count: number }> = {};
    for (const { region, value } of holdingValues) {
      if (!regionDistribution[region]) {
        regionDistribution[region] = { value: 0, count: 0 };
      }
      regionDistribution[region].value += value;
      regionDistribution[region].count += 1;
    }

    return Object.entries(regionDistribution)
      .map(([region, data]) => ({
        name: region,
        value: data.value,
        percentage: totalInvestmentValue > 0 ? (data.value / totalInvestmentValue) * 100 : 0,
        count: data.count,
      }))
      .sort((a, b) => b.value - a.value);
  }

  /**
   * 计算按资产类别的投资组合分布
   */
  static async getPortfolioByCategory(userId: string): Promise<PortfolioDistribution[]> {
    const holdings = await prisma.holding.findMany({
      where: { userId },
      include: {
        security: {
          include: { assetCategory: true },
        },
        account: true,
      },
    });

    // 使用实时汇率计算市值
    let totalInvestmentValue = 0;
    const holdingValues: { category: string; value: number }[] = [];

    for (const holding of holdings) {
      const exchangeRate = await exchangeRateService.getRate(holding.account.currency, 'CNY');
      let value = 0;
      if (holding.quantity && holding.currentPrice) {
        value = Number(holding.quantity) * Number(holding.currentPrice) * exchangeRate;
      } else {
        value = Number(holding.marketValueCny ?? 0);
      }
      totalInvestmentValue += value;
      holdingValues.push({ category: holding.security.assetCategory.name, value });
    }

    // 按资产类别分组
    const categoryDistribution: Record<string, { value: number; count: number }> = {};
    for (const { category, value } of holdingValues) {
      if (!categoryDistribution[category]) {
        categoryDistribution[category] = { value: 0, count: 0 };
      }
      categoryDistribution[category].value += value;
      categoryDistribution[category].count += 1;
    }

    return Object.entries(categoryDistribution)
      .map(([category, data]) => ({
        name: category,
        value: data.value,
        percentage: totalInvestmentValue > 0 ? (data.value / totalInvestmentValue) * 100 : 0,
        count: data.count,
      }))
      .sort((a, b) => b.value - a.value);
  }

  /**
   * 计算按资产类型的投资组合分布（用于双视角图表）
   * 使用新的6大分类体系
   * 
   * 重要：同时包含 holdings（证券）和 assets（现金、不动产等）
   * 
   * ⚠️ 2026-01-31更新：券商现金从账户表直接获取
   */
  static async getPortfolioByAssetType(userId: string): Promise<any[]> {
    // 1. 获取证券持仓
    const holdings = await prisma.holding.findMany({
      where: { userId },
      include: {
        security: {
          include: { 
            assetCategory: {
              include: {
                parent: true // 包含父分类
              }
            }
          },
        },
        account: true,
      },
    });

    // 2. 获取其他资产（现金、不动产等）
    const assets = await prisma.asset.findMany({
      where: { userId },
      include: {
        assetCategory: {
          include: {
            parent: true // 包含父分类
          }
        }
      }
    });

    // 3. ✨ 从账户表获取证券账户现金（2026-01-31更新）
    const investmentAccounts = await prisma.investmentAccount.findMany({
      where: { userId, isActive: true },
    });
    
    // 计算证券账户现金总额
    let brokerCash = 0;
    let accountCount = 0;
    for (const account of investmentAccounts) {
      const cashBalance = Number(account.cashBalance) || 0;
      if (cashBalance > 0) {
        const exchangeRate = await exchangeRateService.getRate(account.currency, 'CNY');
        brokerCash += cashBalance * exchangeRate;
        accountCount++;
      }
    }

    // 按顶层分类（Level 1）分组
    const assetTypeDistribution: Record<
      string,
      { value: number; count: number; name: string; code: string; color: string }
    > = {};

    // 辅助函数：添加资产到分布
    const addToDistribution = (
      category: { level: number; code: string | null; name: string; color: string | null; parent: { code: string | null; name: string; color: string | null } | null } | null,
      value: number,
      sourceName: string
    ) => {
      if (!category) {
        console.warn(`[getPortfolioByAssetType] 找不到分类: ${sourceName}`);
        return;
      }

      // 获取顶层分类（如果当前是二级分类，则取父分类）
      const topLevelCategory = category.level === 1 ? category : category.parent;
      
      if (!topLevelCategory) {
        console.warn(`[getPortfolioByAssetType] 找不到顶层分类: ${category.name}`);
        return;
      }

      const code = topLevelCategory.code || 'OTHER';
      
      if (!assetTypeDistribution[code]) {
        assetTypeDistribution[code] = {
          value: 0,
          count: 0,
          name: topLevelCategory.name,
          code: code,
          color: topLevelCategory.color || '#94A3B8'
        };
      }
      
      assetTypeDistribution[code].value += value;
      assetTypeDistribution[code].count += 1;
    };

    // 4. 处理证券持仓（使用实时汇率计算市值）
    for (const holding of holdings) {
      let value = Number(holding.marketValueCny ?? 0);
      if (holding.quantity && holding.currentPrice) {
        const exchangeRate = await exchangeRateService.getRate(holding.account.currency, 'CNY');
        value = Number(holding.quantity) * Number(holding.currentPrice) * exchangeRate;
      }
      addToDistribution(
        holding.security.assetCategory,
        value,
        holding.security.symbol
      );
    }

    // 5. 处理其他资产（现金、不动产等）- 使用实时计算值
    for (const asset of assets) {
      const assetType = asset.assetCategory?.code;
      const metadata = asset.metadata as any || {};
      const exchangeRate = await exchangeRateService.getRate(asset.currency, 'CNY');
      
      let assetValue = 0;
      
      // 贵金属：使用实时金价计算市值（金价已是 CNY，不乘汇率）
      if (assetType === 'ALT_GOLD') {
        const weight = metadata.weight != null ? Number(metadata.weight) : (asset.quantity != null ? Number(asset.quantity) : 1);
        const metalType = metadata.metalType || 'gold';
        const goldCategory = metadata.goldCategory || 'investment';
        const jewelryBrand = metadata.jewelryBrand || '';
        
        const currentUnitPrice = goldPriceService.getCurrentPrice(metalType, goldCategory, jewelryBrand);
        assetValue = weight * currentUnitPrice;
      } 
      // 其他资产：使用数据库中的 currentValue
      else {
        assetValue = Number(asset.currentValue ?? 0);
      }
      
      addToDistribution(
        asset.assetCategory,
        assetValue,
        asset.name
      );
    }

    // 6. 将证券账户现金加入到现金分类（CASH）
    if (brokerCash > 0) {
      if (!assetTypeDistribution['CASH']) {
        assetTypeDistribution['CASH'] = {
          value: 0,
          count: 0,
          name: '现金及现金等价物',
          code: 'CASH',
          color: '#34D399' // 绿色系
        };
      }
      assetTypeDistribution['CASH'].value += brokerCash;
      assetTypeDistribution['CASH'].count += accountCount;
    }

    // 7. 计算总资产
    const totalValue = Object.values(assetTypeDistribution).reduce(
      (sum, item) => sum + item.value,
      0
    );

    logger.debug('资产分布统计完成', {
      holdingsCount: holdings.length,
      assetsCount: assets.length,
      totalValue: totalValue.toFixed(2)
    });

    return Object.entries(assetTypeDistribution)
      .map(([code, data]) => ({
        type: code,
        typeName: data.name,
        value: data.value,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
        count: data.count,
        color: data.color,
      }))
      .sort((a, b) => b.value - a.value);
  }

  /**
   * ✅ Phase 2: 获取持仓列表（包含完整计算数据）
   * 
   * 统一持仓计算逻辑，避免 API 层和服务层重复代码
   * 
   * @param userId 用户ID
   * @returns 包含完整计算数据的持仓列表
   */
  static async getHoldingsWithCalculations(userId: string): Promise<HoldingWithCalculations[]> {
    const holdings = await prisma.holding.findMany({
      where: { userId },
      include: {
        security: {
          include: {
            assetCategory: true,
            region: true,
          },
        },
        account: {
          include: { broker: true },
        },
      },
      orderBy: { marketValueCny: 'desc' },
    });

    // 第一遍：并行计算所有持仓的实时市值
    const holdingCalculations = await Promise.all(
      holdings.map(async (holding) => {
        const exchangeRate = await exchangeRateService.getRate(holding.account.currency, 'CNY');
        const quantity = Number(holding.quantity);
        const currentPrice = Number(holding.currentPrice);
        const averageCost = Number(holding.averageCost);

        const calculated = this.calculateHoldingDetails(
          { quantity, averageCost, currentPrice },
          exchangeRate
        );

        return { holding, exchangeRate, quantity, currentPrice, averageCost, calculated };
      })
    );

    // 使用实时计算的总市值（而非数据库旧值）
    const totalInvestmentValue = holdingCalculations.reduce(
      (sum, h) => sum + h.calculated.marketValueCny, 0
    );

    // 第二遍：构建返回结果
    return holdingCalculations.map(({ holding, exchangeRate, quantity, currentPrice, averageCost, calculated }) => ({
      id: holding.id,
      type: 'holding' as const,
      symbol: holding.security.symbol,
      name: holding.security.name,
      accountId: holding.account.id,
      accountName: holding.account.accountName,
      broker: holding.account.broker.name,
      quantity,
      currentPrice,
      averageCost,
      costBasis: averageCost * quantity * exchangeRate,
      marketValue: calculated.marketValueCny,
      marketValueOriginal: calculated.marketValueOriginal,
      unrealizedPnL: calculated.unrealizedPnl * exchangeRate,
      unrealizedPnLPercent: calculated.unrealizedPnlPercent,
      dayChange: 0,
      dayChangePercent: 0,
      sector: holding.security.assetCategory.name,
      region: holding.security.region.name,
      currency: holding.account.currency,
      exchangeRate,
      lastUpdated: holding.lastUpdated.toISOString(),
      percentage: totalInvestmentValue > 0
        ? (calculated.marketValueCny / totalInvestmentValue) * 100
        : 0,
      underlyingType: holding.security.underlyingType || undefined,
    }));
  }

  /**
   * 获取全量资产 Top N（证券按标的合并 + 非证券资产）
   * 
   * 逻辑：
   * 1. 证券持仓：同一 securityId 的不同账户合并，市值求和，盈亏按成本加权
   * 2. 非证券资产（不动产、贵金属、现金类等）：逐个纳入
   * 3. 按市值降序排序，取 Top N
   */
  static async getTopAssets(userId: string, topN: number = 5): Promise<TopAssetItem[]> {
    // ─── 1. 证券持仓：按标的合并 ───
    const holdings = await prisma.holding.findMany({
      where: { userId },
      include: {
        security: { include: { assetCategory: true, region: true } },
        account: { include: { broker: true } },
      },
    });

    // 按 securityId 分组合并
    const securityMap = new Map<string, {
      name: string;
      category: string;
      totalMarketValueCny: number;
      totalCostBasisCny: number;
      accounts: string[];
    }>();

    for (const holding of holdings) {
      const exchangeRate = await exchangeRateService.getRate(holding.account.currency, 'CNY');
      const quantity = Number(holding.quantity);
      const currentPrice = Number(holding.currentPrice);
      const averageCost = Number(holding.averageCost);
      const marketValueCny = quantity * currentPrice * exchangeRate;
      const costBasisCny = quantity * averageCost * exchangeRate;

      const existing = securityMap.get(holding.securityId);
      if (existing) {
        existing.totalMarketValueCny += marketValueCny;
        existing.totalCostBasisCny += costBasisCny;
        if (!existing.accounts.includes(holding.account.broker.name)) {
          existing.accounts.push(holding.account.broker.name);
        }
      } else {
        securityMap.set(holding.securityId, {
          name: holding.security.name,
          category: '证券',
          totalMarketValueCny: marketValueCny,
          totalCostBasisCny: costBasisCny,
          accounts: [holding.account.broker.name],
        });
      }
    }

    const mergedHoldings: TopAssetItem[] = [];
    for (const [, data] of securityMap) {
      const pnl = data.totalMarketValueCny - data.totalCostBasisCny;
      const pnlPercent = data.totalCostBasisCny > 0 ? (pnl / data.totalCostBasisCny) * 100 : 0;
      mergedHoldings.push({
        name: data.name,
        category: data.category,
        subtitle: data.accounts.length > 1 ? data.accounts.join(' + ') : data.accounts[0],
        marketValueCny: data.totalMarketValueCny,
        unrealizedPnlPercent: pnlPercent,
      });
    }

    // ─── 2. 非证券资产（全部 Asset 表） ───
    const allAssets = await prisma.asset.findMany({
      where: { userId },
      include: { assetCategory: { include: { parent: true } } },
    });

    const nonSecurityAssets: TopAssetItem[] = [];
    for (const asset of allAssets) {
      const exchangeRate = await exchangeRateService.getRate(asset.currency, 'CNY');
      const assetType = asset.assetCategory?.code || '';
      const metadata = asset.metadata as any || {};
      const parentName = asset.assetCategory?.parent?.name || asset.assetCategory?.name || '其他';

      let marketValueCny = 0;
      let costBasisCny = 0;

      // 成本基础
      const originalValue = asset.originalValue != null ? Number(asset.originalValue) : Number(asset.purchasePrice);
      costBasisCny = originalValue * exchangeRate;

      // 不动产
      if (assetType.startsWith('RE_')) {
        const mv = metadata.marketValue ?? metadata.currentMarketPrice ?? metadata.appraisalValue ??
          (asset.currentValue != null ? Number(asset.currentValue) : Number(asset.purchasePrice));
        marketValueCny = Number(mv) * exchangeRate;
      }
      // 贵金属（非ALT_GOLD）
      else if (assetType.startsWith('METAL_')) {
        marketValueCny = (asset.currentValue != null ? Number(asset.currentValue) : Number(asset.purchasePrice)) * exchangeRate;
      }
      // ALT_GOLD：实时金价
      else if (assetType === 'ALT_GOLD') {
        const weight = metadata.weight != null ? Number(metadata.weight) : (asset.quantity != null ? Number(asset.quantity) : 1);
        const purchaseUnitPrice = metadata.unitPrice != null ? Number(metadata.unitPrice) : (asset.unitPrice != null ? Number(asset.unitPrice) : 0);
        const metalType = metadata.metalType || 'gold';
        const goldCategory = metadata.goldCategory || 'investment';
        const jewelryBrand = metadata.jewelryBrand || '';
        const currentUnitPrice = goldPriceService.getCurrentPrice(metalType, goldCategory, jewelryBrand);
        marketValueCny = weight * currentUnitPrice;
        costBasisCny = weight * purchaseUnitPrice;
      }
      // 实物资产
      else if (assetType === 'ALT_PHYSICAL') {
        const ev = metadata.estimatedValue ?? metadata.currentMarketPrice ?? metadata.appraisalValue ??
          (asset.currentValue != null ? Number(asset.currentValue) : (asset.purchasePrice != null ? Number(asset.purchasePrice) : 0));
        marketValueCny = Number(ev) * exchangeRate;
      }
      // 固定收益类（理财产品/债券）
      else if (assetType.startsWith('FIXED_') && metadata.annualYield && asset.purchaseDate) {
        const annualYield = parseFloat(metadata.annualYield) || 0;
        const daysSincePurchase = Math.floor((Date.now() - new Date(asset.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
        if (annualYield > 0 && daysSincePurchase > 0) {
          const earnings = (originalValue * annualYield / 100 / 365) * daysSincePurchase;
          marketValueCny = (originalValue + earnings) * exchangeRate;
        } else {
          marketValueCny = costBasisCny;
        }
      }
      // 货币基金
      else if (assetType === 'CASH_MONEY_FUND' && metadata.yield7Day && asset.purchaseDate) {
        const yield7Day = parseFloat(metadata.yield7Day) || 0;
        const daysSincePurchase = Math.floor((Date.now() - new Date(asset.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
        if (yield7Day > 0 && daysSincePurchase > 0) {
          const earnings = (originalValue * yield7Day / 100 / 365) * daysSincePurchase;
          marketValueCny = (originalValue + earnings) * exchangeRate;
        } else {
          marketValueCny = costBasisCny;
        }
      }
      // 定期存款
      else if (assetType === 'CASH_FIXED' && metadata.interestRate && asset.purchaseDate) {
        const interestRate = parseFloat(metadata.interestRate) || 0;
        const startDate = new Date(asset.purchaseDate);
        const maturityDate = asset.maturityDate ? new Date(asset.maturityDate) : new Date();
        const now = new Date();
        const totalDays = Math.floor((maturityDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const elapsedDays = Math.min(
          Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
          totalDays > 0 ? totalDays : 365
        );
        if (interestRate > 0 && elapsedDays > 0) {
          const earnings = (originalValue * interestRate / 100 / 365) * elapsedDays;
          marketValueCny = (originalValue + earnings) * exchangeRate;
        } else {
          marketValueCny = costBasisCny;
        }
      }
      // 其他类型
      else {
        const v = asset.currentValue != null ? Number(asset.currentValue) : (asset.purchasePrice != null ? Number(asset.purchasePrice) : 0);
        marketValueCny = v * exchangeRate;
      }

      const pnl = marketValueCny - costBasisCny;
      const pnlPercent = costBasisCny > 0 ? (pnl / costBasisCny) * 100 : 0;

      nonSecurityAssets.push({
        name: asset.name,
        category: parentName,
        subtitle: asset.assetCategory?.name || '',
        marketValueCny,
        unrealizedPnlPercent: pnlPercent,
      });
    }

    // ─── 3. 合并排序取 Top N ───
    const allItems = [...mergedHoldings, ...nonSecurityAssets];
    allItems.sort((a, b) => b.marketValueCny - a.marketValueCny);
    return allItems.slice(0, topN);
  }

  /**
   * ✨ Phase 2: 按底层敞口类型聚合资产分布
   * 
   * 这是"双重分类"架构的核心方法：
   * - 资产详情：按存放分类（AssetCategory）展示
   * - 资产概览：按底层敞口（UnderlyingType）聚合
   * 
   * @param userId 用户ID
   * @param includeDepreciating 是否包含消耗性资产（默认不包含）
   * @returns 按底层敞口聚合的资产分布
   */
  static async getPortfolioByUnderlyingType(
    userId: string,
    includeDepreciating: boolean = false
  ): Promise<UnderlyingTypeDistribution[]> {
    // 动态导入底层敞口类型配置
    const { 
      UNDERLYING_TYPE_INFO, 
      getDefaultUnderlyingType, 
      UnderlyingType,
      ASSET_OVERVIEW_GROUPS,
      getOverviewGroupByUnderlyingType
    } = await import('@/lib/underlying-type');

    // 1. 获取证券持仓（包含 underlyingType）
    const holdings = await prisma.holding.findMany({
      where: { userId },
      include: {
        security: {
          include: { 
            assetCategory: true,
            region: true
          },
        },
        account: true,
      },
    });

    // 2. 获取所有资产（包含 underlyingType）
    const assets = await prisma.asset.findMany({
      where: { userId },
      include: {
        assetCategory: true
      }
    });

    // 3. 获取证券账户现金
    const investmentAccounts = await prisma.investmentAccount.findMany({
      where: { userId, isActive: true },
    });

    // 4. 按底层敞口类型聚合
    const distribution: Record<string, {
      value: number;
      count: number;
      holdings: number;
      cashAssets: number;
      otherAssets: number;
    }> = {};

    // 辅助函数：添加到分布
    const addToDistribution = (
      underlyingType: string,
      value: number,
      source: 'holdings' | 'cashAssets' | 'otherAssets'
    ) => {
      if (!distribution[underlyingType]) {
        distribution[underlyingType] = {
          value: 0,
          count: 0,
          holdings: 0,
          cashAssets: 0,
          otherAssets: 0,
        };
      }
      distribution[underlyingType].value += value;
      distribution[underlyingType].count += 1;
      distribution[underlyingType][source] += value;
    };

    // 5. 处理证券持仓
    for (const holding of holdings) {
      const exchangeRate = await exchangeRateService.getRate(holding.account.currency, 'CNY');
      const marketValueCny = Number(holding.quantity) * Number(holding.currentPrice || 0) * exchangeRate;
      
      // 获取底层敞口类型
      // 优先使用 Security 表的 underlyingType，否则根据分类推断
      let underlyingType = holding.security.underlyingType;
      if (!underlyingType) {
        const categoryCode = holding.security.assetCategory?.code || '';
        underlyingType = getDefaultUnderlyingType(categoryCode);
      }
      
      addToDistribution(underlyingType, marketValueCny, 'holdings');
    }

    // 6. 处理其他资产（现金、不动产等）
    for (const asset of assets) {
      const exchangeRate = await exchangeRateService.getRate(asset.currency, 'CNY');
      const assetCategoryCode = asset.assetCategory?.code || '';
      const metadata = asset.metadata as any || {};
      const originalValue = asset.originalValue != null ? Number(asset.originalValue) : (Number(asset.purchasePrice) || 0);
      const currency = asset.currency || 'CNY';
      
      // 计算资产价值（确保与 getAssetsBySubCategory 保持一致）
      let assetValue = 0;
      
      // 贵金属：使用实时金价（金价已是 CNY，不乘汇率）
      if (assetCategoryCode === 'ALT_GOLD') {
        const weight = metadata.weight || Number(asset.quantity) || 1;
        const metalType = metadata.metalType || 'gold';
        const goldCategory = metadata.goldCategory || 'investment';
        const jewelryBrand = metadata.jewelryBrand || '';
        
        const currentUnitPrice = goldPriceService.getCurrentPrice(metalType, goldCategory, jewelryBrand);
        assetValue = weight * currentUnitPrice;
      }
      // 实物资产：使用估值（estimatedValue）
      else if (assetCategoryCode === 'ALT_PHYSICAL') {
        const estimatedValue = Number(metadata.estimatedValue) || 
                               Number(metadata.currentMarketPrice) || 
                               Number(metadata.appraisalValue) || 
                               originalValue;
        assetValue = estimatedValue * exchangeRate;
      }
      // 货币基金：实时计算收益
      else if (assetCategoryCode === 'CASH_MONEY_FUND' && metadata.yield7Day && asset.purchaseDate) {
        const yield7Day = parseFloat(String(metadata.yield7Day)) || 0;
        const daysSincePurchase = Math.floor(
          (Date.now() - new Date(asset.purchaseDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (yield7Day > 0 && daysSincePurchase > 0) {
          const earningsOriginal2 = (originalValue * yield7Day / 100 / 365) * daysSincePurchase;
          const currentValueOriginal2 = originalValue + earningsOriginal2;
          assetValue = currentValueOriginal2 * exchangeRate;
        } else {
          assetValue = originalValue * exchangeRate;
        }
      }
      // 定期存款：实时计算收益
      else if (assetCategoryCode === 'CASH_FIXED' && metadata.interestRate && asset.purchaseDate) {
        const interestRate = parseFloat(String(metadata.interestRate)) || 0;
        const startDate = new Date(asset.purchaseDate);
        const maturityDate = asset.maturityDate ? new Date(asset.maturityDate) : new Date();
        const now = new Date();
        const totalDays = Math.floor((maturityDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const elapsedDays = Math.min(
          Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
          totalDays > 0 ? totalDays : 365
        );
        if (interestRate > 0 && elapsedDays > 0) {
          const earningsOriginal3 = (originalValue * interestRate / 100 / 365) * elapsedDays;
          const currentValueOriginal3 = originalValue + earningsOriginal3;
          assetValue = currentValueOriginal3 * exchangeRate;
        } else {
          assetValue = originalValue * exchangeRate;
        }
      }
      // 活期存款和券商现金：直接使用本金 × 汇率
      else if (assetCategoryCode === 'CASH_DEMAND' || assetCategoryCode === 'CASH_BROKER') {
        assetValue = originalValue * exchangeRate;
      }
      // CNY 资产：使用数据库中的 currentValue 或本金
      else if (currency === 'CNY') {
        const dbCurrentValue = Number(asset.currentValue ?? 0);
        assetValue = dbCurrentValue > 0 ? dbCurrentValue : originalValue;
      }
      // 非 CNY 资产
      else {
        assetValue = originalValue * exchangeRate;
      }
      
      // 获取底层敞口类型
      let underlyingType = asset.underlyingType;
      if (!underlyingType) {
        underlyingType = getDefaultUnderlyingType(assetCategoryCode);
      }
      
      // 区分现金资产和其他资产
      const isCashAsset = ['CASH_DEMAND', 'CASH_FIXED', 'CASH_MONEY_FUND', 'CASH_BROKER'].includes(assetCategoryCode);
      addToDistribution(underlyingType, assetValue, isCashAsset ? 'cashAssets' : 'otherAssets');
    }

    // 7. 处理证券账户现金
    for (const account of investmentAccounts) {
      const cashBalance = Number(account.cashBalance) || 0;
      if (cashBalance > 0) {
        const exchangeRate = await exchangeRateService.getRate(account.currency, 'CNY');
        const cashBalanceCny = cashBalance * exchangeRate;
        addToDistribution(UnderlyingType.CASH, cashBalanceCny, 'cashAssets');
      }
    }

    // 8. 计算总资产（可选排除消耗性资产）
    let totalValue = 0;
    
    for (const [type, data] of Object.entries(distribution)) {
      const typeInfo = UNDERLYING_TYPE_INFO[type as keyof typeof UNDERLYING_TYPE_INFO];
      if (typeInfo?.includeInNetWorth || includeDepreciating) {
        totalValue += data.value;
      }
    }

    // 9. 转换为结果数组
    const result: UnderlyingTypeDistribution[] = [];
    
    for (const [type, data] of Object.entries(distribution)) {
      const typeInfo = UNDERLYING_TYPE_INFO[type as keyof typeof UNDERLYING_TYPE_INFO] || {
        code: type,
        name: '其他',
        nameEn: 'Other',
        color: '#94A3B8',
        includeInNetWorth: true,
      };

      // 可选排除消耗性资产
      if (!includeDepreciating && !typeInfo.includeInNetWorth) {
        continue;
      }

      result.push({
        code: type,
        name: typeInfo.name,
        value: data.value,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
        count: data.count,
        color: typeInfo.color,
        includeInNetWorth: typeInfo.includeInNetWorth,
        details: {
          holdings: data.holdings,
          cashAssets: data.cashAssets,
          otherAssets: data.otherAssets,
        },
      });
    }

    // 10. 按市值降序排列
    result.sort((a, b) => b.value - a.value);

    logger.debug('底层敞口聚合完成', {
      totalValue: totalValue.toFixed(2),
      groupCount: result.length
    });

    return result;
  }

  /**
   * ✨ Phase 2: 按资产概览分组聚合（合并同类底层敞口）
   * 
   * 将细分的底层敞口类型合并为5大类：
   * - 权益类（EQUITY）
   * - 固定收益（BOND + FIXED_INCOME）
   * - 现金等价物（CASH）
   * - 不动产（REAL_ESTATE）
   * - 另类投资（GOLD + COMMODITY + CRYPTO + COLLECTIBLE + DEPRECIATING + MIXED + OTHER）
   * 
   * @param userId 用户ID
   * @returns 合并后的资产概览分组
   */
  static async getPortfolioByOverviewGroup(userId: string): Promise<UnderlyingTypeDistribution[]> {
    // 获取底层敞口分布（包含消耗性资产，因为已合并到另类投资）
    const underlyingDistribution = await this.getPortfolioByUnderlyingType(userId, true);
    
    // 动态导入分组配置
    const { ASSET_OVERVIEW_GROUPS, getOverviewGroupByUnderlyingType } = await import('@/lib/underlying-type');
    
    // 按概览分组聚合
    const groupDistribution: Record<string, {
      value: number;
      count: number;
      details: { holdings: number; cashAssets: number; otherAssets: number };
    }> = {};

    for (const item of underlyingDistribution) {
      const group = getOverviewGroupByUnderlyingType(item.code);
      
      if (!groupDistribution[group.id]) {
        groupDistribution[group.id] = {
          value: 0,
          count: 0,
          details: { holdings: 0, cashAssets: 0, otherAssets: 0 },
        };
      }
      
      groupDistribution[group.id].value += item.value;
      groupDistribution[group.id].count += item.count;
      if (item.details) {
        groupDistribution[group.id].details.holdings += item.details.holdings;
        groupDistribution[group.id].details.cashAssets += item.details.cashAssets;
        groupDistribution[group.id].details.otherAssets += item.details.otherAssets;
      }
    }

    // 计算总资产
    const totalValue = Object.values(groupDistribution).reduce((sum, g) => sum + g.value, 0);

    // 转换为结果数组
    const result: UnderlyingTypeDistribution[] = ASSET_OVERVIEW_GROUPS
      .filter(group => groupDistribution[group.id])
      .map(group => ({
        code: group.id.toUpperCase(),
        name: group.name,
        value: groupDistribution[group.id].value,
        percentage: totalValue > 0 ? (groupDistribution[group.id].value / totalValue) * 100 : 0,
        count: groupDistribution[group.id].count,
        color: group.color,
        includeInNetWorth: true,
        details: groupDistribution[group.id].details,
      }))
      .sort((a, b) => b.value - a.value);

    logger.debug('概览分组聚合完成', {
      totalValue: totalValue.toFixed(2),
      groupCount: result.length
    });

    return result;
  }

  /**
   * ✨ Phase 2.1: 按地区细分权益类资产
   * 
   * 获取权益类资产按地区（中国、美国、日本、其他）的细分数据
   * 用于在资产概览展开权益类时显示地区分布
   * 
   * @param userId 用户ID
   * @returns 按地区细分的权益类资产数据
   */
  static async getEquityByRegion(userId: string): Promise<{
    total: number;
    count: number;
    byRegion: Array<{
      regionCode: string;
      regionName: string;
      value: number;
      percentage: number;
      count: number;
      color: string;
      holdings: Array<{
        symbol: string;
        name: string;
        marketValue: number;
        percentage: number;
      }>;
    }>;
  }> {
    // 地区配置
    const REGION_CONFIG: Record<string, { name: string; color: string; order: number }> = {
      CN: { name: '中国证券', color: '#EF4444', order: 1 },   // 红色 - 中国
      US: { name: '美国证券', color: '#3B82F6', order: 2 },   // 蓝色 - 美国  
      JP: { name: '日本证券', color: '#EC4899', order: 3 },   // 粉色 - 日本
      HK: { name: '香港证券', color: '#F59E0B', order: 4 },   // 橙色 - 香港
      OTHER: { name: '其他地区', color: '#6B7280', order: 99 }, // 灰色 - 其他
    };

    // 获取权益类持仓（包含地区信息）
    const holdings = await prisma.holding.findMany({
      where: { userId },
      include: {
        security: {
          include: { 
            assetCategory: true,
            region: true
          },
        },
        account: true,
      },
    });

    // 动态导入底层敞口类型配置
    const { getDefaultUnderlyingType, UnderlyingType } = await import('@/lib/underlying-type');

    // 按地区聚合
    const regionDistribution: Record<string, {
      value: number;
      count: number;
      holdings: Array<{
        symbol: string;
        name: string;
        marketValue: number;
      }>;
    }> = {};

    let totalEquityValue = 0;
    let totalEquityCount = 0;

    for (const holding of holdings) {
      // 判断是否是权益类资产
      const underlyingType = holding.security.underlyingType || 
        getDefaultUnderlyingType(holding.security.assetCategory?.code || '');
      
      // 只处理权益类资产
      if (underlyingType !== UnderlyingType.EQUITY) {
        continue;
      }

      // 获取汇率并计算市值
      const exchangeRate = await exchangeRateService.getRate(holding.account.currency, 'CNY');
      const marketValueCny = Number(holding.quantity) * Number(holding.currentPrice || 0) * exchangeRate;

      if (marketValueCny <= 0) continue;

      // 确定地区代码
      // 优先使用 targetCountry（如中概股在美股上市但属于中国），否则使用交易市场所在地区
      let regionCode = holding.security.targetCountry || holding.security.region?.code || 'OTHER';
      
      // 标准化地区代码
      if (!['CN', 'US', 'JP', 'HK'].includes(regionCode)) {
        regionCode = 'OTHER';
      }

      // 添加到分布
      if (!regionDistribution[regionCode]) {
        regionDistribution[regionCode] = {
          value: 0,
          count: 0,
          holdings: [],
        };
      }

      regionDistribution[regionCode].value += marketValueCny;
      regionDistribution[regionCode].count += 1;
      regionDistribution[regionCode].holdings.push({
        symbol: holding.security.symbol,
        name: holding.security.name,
        marketValue: marketValueCny,
      });

      totalEquityValue += marketValueCny;
      totalEquityCount += 1;
    }

    // 转换为结果数组并排序
    const byRegion = Object.entries(regionDistribution)
      .map(([code, data]) => {
        const config = REGION_CONFIG[code] || REGION_CONFIG.OTHER;
        
        // 对该地区的持仓按市值排序
        data.holdings.sort((a, b) => b.marketValue - a.marketValue);
        
        return {
          regionCode: code,
          regionName: config.name,
          value: data.value,
          percentage: totalEquityValue > 0 ? (data.value / totalEquityValue) * 100 : 0,
          count: data.count,
          color: config.color,
          order: config.order,
          holdings: data.holdings.map(h => ({
            ...h,
            percentage: totalEquityValue > 0 ? (h.marketValue / totalEquityValue) * 100 : 0,
          })),
        };
      })
      .sort((a, b) => a.order - b.order)
      .map(({ order, ...rest }) => rest); // 移除排序字段

    logger.debug('权益类按地区细分完成', {
      total: totalEquityValue.toFixed(2),
      regionCount: byRegion.length
    });

    return {
      total: totalEquityValue,
      count: totalEquityCount,
      byRegion,
    };
  }

  /**
   * ✨ Phase 2.2: 按二级分类细分各资产类别
   * 
   * 获取指定资产分组（现金、固定收益、不动产、另类投资等）的二级分类细分
   * 用于在资产概览展开时显示详细分布
   * 
   * @param userId 用户ID
   * @param overviewGroup 概览分组代码 ('CASH', 'FIXED_INCOME', 'REAL_ESTATE', 'ALTERNATIVE', 'OTHER')
   * @returns 按二级分类细分的资产数据
   */
  static async getAssetsBySubCategory(userId: string, overviewGroup: string): Promise<{
    groupCode: string;
    groupName: string;
    total: number;
    count: number;
    bySubCategory: Array<{
      categoryCode: string;
      categoryName: string;
      value: number;
      percentage: number;
      count: number;
      color: string;
      items: Array<{
        id: string;
        name: string;
        value: number;
        percentage: number;
      }>;
    }>;
  }> {
    // 分组配置：定义每个概览分组包含哪些二级分类
    const GROUP_CONFIG: Record<string, {
      name: string;
      categories: Array<{
        code: string;
        name: string;
        color: string;
        order: number;
      }>;
    }> = {
      CASH: {
        name: '现金等价物',
        categories: [
          { code: 'CASH_DEMAND', name: '活期存款', color: '#6366F1', order: 1 },
          { code: 'CASH_MONEY_FUND', name: '货币基金', color: '#8B5CF6', order: 2 },
          { code: 'CASH_BROKER', name: '券商现金', color: '#A855F7', order: 3 },
        ],
      },
      FIXED_INCOME: {
        name: '固定收益',
        categories: [
          { code: 'CASH_FIXED', name: '定期存款', color: '#10B981', order: 1 },
          { code: 'FIXED_BOND', name: '债券', color: '#14B8A6', order: 2 },
          { code: 'FIXED_WEALTH', name: '理财产品', color: '#06B6D4', order: 3 },
        ],
      },
      REAL_ESTATE: {
        name: '不动产',
        categories: [
          { code: 'RE_RESIDENTIAL', name: '住宅房产', color: '#06B6D4', order: 1 },
          { code: 'RE_COMMERCIAL', name: '商业地产', color: '#0891B2', order: 2 },
          { code: 'RE_REITS', name: 'REITs', color: '#0E7490', order: 3 },
        ],
      },
      ALTERNATIVE: {
        name: '另类投资',
        categories: [
          { code: 'ALT_GOLD_JEWELRY', name: '贵金属-黄金饰品', color: '#F59E0B', order: 1 },  // 拆分：黄金饰品
          { code: 'ALT_GOLD_ETF', name: '贵金属-黄金ETF', color: '#FBBF24', order: 2 },      // 拆分：黄金ETF
          { code: 'ALT_CRYPTO', name: '数字资产', color: '#8B5CF6', order: 3 },
          { code: 'ALT_COMMODITY', name: '大宗商品', color: '#F97316', order: 4 },
          { code: 'ALT_COLLECTIBLE', name: '收藏品', color: '#EC4899', order: 5 },
          { code: 'ALT_PHYSICAL', name: '实物资产', color: '#94A3B8', order: 6 },
        ],
      },
      RECEIVABLE: {
        name: '应收款',
        categories: [
          { code: 'REC_PERSONAL_LOAN', name: '个人借款', color: '#0EA5E9', order: 1 },
          { code: 'REC_DEPOSIT', name: '押金/保证金', color: '#38BDF8', order: 2 },
          { code: 'REC_SALARY', name: '薪资/报销', color: '#7DD3FC', order: 3 },
          { code: 'REC_BUSINESS', name: '商业应收', color: '#0284C7', order: 4 },
          { code: 'REC_OTHER', name: '其他应收', color: '#BAE6FD', order: 5 },
        ],
      },
      OTHER: {
        name: '其他资产',
        categories: [
          { code: 'OTHER', name: '其他', color: '#94A3B8', order: 1 },
        ],
      },
    };

    const config = GROUP_CONFIG[overviewGroup];
    if (!config) {
      return {
        groupCode: overviewGroup,
        groupName: '未知分组',
        total: 0,
        count: 0,
        bySubCategory: [],
      };
    }

    // 动态导入底层敞口类型配置
    const { getDefaultUnderlyingType, getOverviewGroupByUnderlyingType, ASSET_OVERVIEW_GROUPS } = await import('@/lib/underlying-type');
    
    // 获取当前概览分组包含的底层敞口类型
    const currentOverviewGroup = ASSET_OVERVIEW_GROUPS.find(g => g.id === overviewGroup.toLowerCase()) ||
      ASSET_OVERVIEW_GROUPS.find(g => g.underlyingTypes.includes(overviewGroup as any));
    const groupUnderlyingTypes = currentOverviewGroup?.underlyingTypes || [];

    // 🔧 获取该用户的所有资产（不按 category 过滤），然后按 effective underlyingType 判断归属
    // 这样才能正确处理 underlyingType 被覆盖的资产
    const allAssets = await prisma.asset.findMany({
      where: { userId },
      include: { assetCategory: true },
    });

    // 按 effective underlyingType 筛选属于当前组的资产
    const assets = allAssets.filter(asset => {
      const categoryCode = asset.assetCategory?.code || '';
      const effectiveType = asset.underlyingType || getDefaultUnderlyingType(categoryCode);
      const effectiveGroup = getOverviewGroupByUnderlyingType(effectiveType);
      // 判断该资产的 effective 分组是否匹配当前请求的 overviewGroup
      return effectiveGroup.id === (currentOverviewGroup?.id || overviewGroup.toLowerCase());
    });

    // 按二级分类聚合
    const distribution: Record<string, {
      value: number;
      count: number;
      items: Array<{
        id: string;
        name: string;
        value: number;
      }>;
    }> = {};

    // 初始化所有配置的分类
    for (const cat of config.categories) {
      distribution[cat.code] = { value: 0, count: 0, items: [] };
    }

    let totalValue = 0;
    let totalCount = 0;

    for (const asset of assets) {
      const categoryCode = asset.assetCategory?.code || 'OTHER';
      const categoryName = asset.assetCategory?.name || '其他';
      const currency = asset.currency || 'CNY';
      
      // 获取汇率
      let exchangeRate = 1.0;
      if (currency !== 'CNY') {
        try {
          exchangeRate = await exchangeRateService.getRate(currency, 'CNY');
        } catch (error) {
          console.error(`获取汇率失败 ${currency} -> CNY:`, error);
          exchangeRate = 1.0;
        }
      }
      
      let currentValueCny = 0;
      const originalValue = asset.originalValue != null ? Number(asset.originalValue) : (Number(asset.purchasePrice) || 0);
      const metadata = (asset.metadata as Record<string, unknown>) || {};
      
      // 统一：先算原币种收益，再转 CNY
      if (categoryCode === 'CASH_MONEY_FUND' && metadata.yield7Day && asset.purchaseDate) {
        const yield7Day = parseFloat(String(metadata.yield7Day)) || 0;
        const daysSincePurchase = Math.floor(
          (Date.now() - new Date(asset.purchaseDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (yield7Day > 0 && daysSincePurchase > 0) {
          const earningsOriginal = (originalValue * yield7Day / 100 / 365) * daysSincePurchase;
          currentValueCny = (originalValue + earningsOriginal) * exchangeRate;
        } else {
          currentValueCny = originalValue * exchangeRate;
        }
      } else if (categoryCode === 'CASH_FIXED' && metadata.interestRate && asset.purchaseDate) {
        const interestRate = parseFloat(String(metadata.interestRate)) || 0;
        const startDate = new Date(asset.purchaseDate);
        const maturityDate = asset.maturityDate ? new Date(asset.maturityDate) : new Date();
        const now = new Date();
        const totalDays = Math.floor((maturityDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const elapsedDays = Math.min(
          Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
          totalDays > 0 ? totalDays : 365
        );
        if (interestRate > 0 && elapsedDays > 0) {
          const earningsOriginal = (originalValue * interestRate / 100 / 365) * elapsedDays;
          currentValueCny = (originalValue + earningsOriginal) * exchangeRate;
        } else {
          currentValueCny = originalValue * exchangeRate;
        }
      }
      // 贵金属（ALT_GOLD）：使用实时金价服务计算市值（金价已是 CNY，不乘汇率）
      else if (categoryCode === 'ALT_GOLD') {
        const weight = Number(metadata.weight) || Number(asset.quantity) || 1;
        const metalType = String(metadata.metalType || 'gold');
        const goldCategory = String(metadata.goldCategory || 'investment');
        const jewelryBrand = String(metadata.jewelryBrand || '');
        
        const currentUnitPrice = goldPriceService.getCurrentPrice(metalType, goldCategory, jewelryBrand);
        currentValueCny = weight * currentUnitPrice;
      }
      // 实物资产（ALT_PHYSICAL）：使用估值或 currentValue
      else if (categoryCode === 'ALT_PHYSICAL') {
        const estimatedValue = Number(metadata.estimatedValue) || 
                               Number(metadata.currentMarketPrice) || 
                               Number(metadata.appraisalValue) || 
                               Number(asset.currentValue) || 
                               originalValue;
        currentValueCny = estimatedValue * exchangeRate;
      }
      else {
        if (categoryCode === 'CASH_DEMAND' || categoryCode === 'CASH_BROKER') {
          currentValueCny = originalValue * exchangeRate;
        } else if (currency === 'CNY') {
          const dbCurrentValue = Number(asset.currentValue ?? 0);
          currentValueCny = dbCurrentValue > 0 ? dbCurrentValue : originalValue;
        } else {
          currentValueCny = originalValue * exchangeRate;
        }
      }

      if (currentValueCny <= 0) continue;

      // 🔧 确定分桶目标：先看 categoryCode 是否属于当前组的已知子分类
      let targetCategoryCode = categoryCode;
      if (categoryCode === 'ALT_GOLD') {
        targetCategoryCode = 'ALT_GOLD_JEWELRY';
      }

      // 如果该资产是通过 underlyingType 覆盖归入本组的（原始 category 不在 config 中），
      // 则创建一个动态子分类（用原始分类名作为子分类名）
      if (!distribution[targetCategoryCode]) {
        // 检查是否在当前组的预定义分类中
        const isInConfig = config.categories.some(c => c.code === targetCategoryCode);
        if (!isInConfig) {
          // 动态创建子分类条目（被覆盖归入的资产）
          const dynamicCode = `_override_${categoryCode}`;
          targetCategoryCode = dynamicCode;
          if (!distribution[dynamicCode]) {
            distribution[dynamicCode] = { value: 0, count: 0, items: [] };
            // 同时在 config 中添加动态分类（用于最终渲染）
            config.categories.push({
              code: dynamicCode,
              name: `${categoryName} (自定义归入)`,
              color: currentOverviewGroup?.color || '#94A3B8',
              order: 100 + config.categories.length,
            });
          }
        } else {
          distribution[targetCategoryCode] = { value: 0, count: 0, items: [] };
        }
      }

      distribution[targetCategoryCode].value += currentValueCny;
      distribution[targetCategoryCode].count += 1;
      distribution[targetCategoryCode].items.push({
        id: asset.id,
        name: asset.name,
        value: currentValueCny,
      });

      totalValue += currentValueCny;
      totalCount += 1;
    }

    // 🔧 对于现金等价物分组，还需要添加券商账户现金
    if (overviewGroup === 'CASH') {
      const investmentAccounts = await prisma.investmentAccount.findMany({
        where: { userId },
        include: { broker: true },
      });

      for (const account of investmentAccounts) {
        const cashBalance = Number(account.cashBalance) || 0;
        if (cashBalance > 0) {
          const exchangeRate = await exchangeRateService.getRate(account.currency, 'CNY');
          const cashBalanceCny = cashBalance * exchangeRate;
          
          const brokerCashCode = 'CASH_BROKER';
          if (!distribution[brokerCashCode]) {
            distribution[brokerCashCode] = { value: 0, count: 0, items: [] };
          }
          
          distribution[brokerCashCode].value += cashBalanceCny;
          distribution[brokerCashCode].count += 1;
          distribution[brokerCashCode].items.push({
            id: `broker-cash-${account.id}`,
            name: `${account.broker?.name || account.accountName}-券商现金`,
            value: cashBalanceCny,
          });
          
          totalValue += cashBalanceCny;
          totalCount += 1;
        }
      }
    }

    // 🔧 对于另类投资分组，还需要添加证券持仓中的黄金ETF等另类投资
    if (overviewGroup === 'ALTERNATIVE') {
      const underlyingToAltCategory: Record<string, string> = {
        'GOLD': 'ALT_GOLD_ETF',
        'COMMODITY': 'ALT_COMMODITY',
        'CRYPTO': 'ALT_CRYPTO',
      };
      
      const holdings = await prisma.holding.findMany({
        where: { userId },
        include: {
          security: {
            include: { assetCategory: true },
          },
          account: true,
        },
      });

      for (const holding of holdings) {
        let underlyingType = holding.security.underlyingType;
        if (!underlyingType) {
          const holdingCategoryCode = holding.security.assetCategory?.code || '';
          underlyingType = getDefaultUnderlyingType(holdingCategoryCode);
        }
        
        const altCategoryCode = underlyingToAltCategory[underlyingType];
        if (!altCategoryCode) continue;
        
        const exchangeRate = await exchangeRateService.getRate(holding.account.currency, 'CNY');
        const marketValueCny = Number(holding.quantity) * Number(holding.currentPrice || 0) * exchangeRate;
        
        if (marketValueCny <= 0) continue;
        
        if (!distribution[altCategoryCode]) {
          distribution[altCategoryCode] = { value: 0, count: 0, items: [] };
        }
        
        distribution[altCategoryCode].value += marketValueCny;
        distribution[altCategoryCode].count += 1;
        distribution[altCategoryCode].items.push({
          id: `holding-${holding.id}`,
          name: `${holding.security.name} (${holding.security.symbol})`,
          value: marketValueCny,
        });
        
        totalValue += marketValueCny;
        totalCount += 1;
      }
    }

    // 🔧 对于权益类和固定收益分组，也需要添加证券持仓
    if (overviewGroup === 'EQUITY' || overviewGroup === 'FIXED_INCOME') {
      const holdings = await prisma.holding.findMany({
        where: { userId },
        include: {
          security: {
            include: { assetCategory: true },
          },
          account: true,
        },
      });

      for (const holding of holdings) {
        let underlyingType = holding.security.underlyingType;
        if (!underlyingType) {
          const holdingCategoryCode = holding.security.assetCategory?.code || '';
          underlyingType = getDefaultUnderlyingType(holdingCategoryCode);
        }
        
        // 检查此持仓的 underlyingType 是否属于当前组
        const holdingGroup = getOverviewGroupByUnderlyingType(underlyingType);
        if (holdingGroup.id !== (currentOverviewGroup?.id || overviewGroup.toLowerCase())) continue;
        
        const exchangeRate = await exchangeRateService.getRate(holding.account.currency, 'CNY');
        const marketValueCny = Number(holding.quantity) * Number(holding.currentPrice || 0) * exchangeRate;
        
        if (marketValueCny <= 0) continue;
        
        // 用证券的分类名作为子分类
        const secCategoryCode = holding.security.assetCategory?.code || 'OTHER';
        const secCategoryName = holding.security.assetCategory?.name || '其他';
        
        // 尝试匹配 config 中的子分类，否则创建动态子分类
        let targetCode = secCategoryCode;
        if (!config.categories.some(c => c.code === targetCode)) {
          targetCode = `_holding_${secCategoryCode}`;
          if (!config.categories.some(c => c.code === targetCode)) {
            config.categories.push({
              code: targetCode,
              name: secCategoryName,
              color: currentOverviewGroup?.color || '#94A3B8',
              order: 100 + config.categories.length,
            });
          }
        }
        
        if (!distribution[targetCode]) {
          distribution[targetCode] = { value: 0, count: 0, items: [] };
        }
        
        distribution[targetCode].value += marketValueCny;
        distribution[targetCode].count += 1;
        distribution[targetCode].items.push({
          id: `holding-${holding.id}`,
          name: `${holding.security.name} (${holding.security.symbol})`,
          value: marketValueCny,
        });
        
        totalValue += marketValueCny;
        totalCount += 1;
      }
    }

    // 转换为结果数组并排序
    const bySubCategory = config.categories
      .map(catConfig => {
        const data = distribution[catConfig.code] || { value: 0, count: 0, items: [] };
        
        // 对该分类的资产按市值排序
        data.items.sort((a, b) => b.value - a.value);
        
        return {
          categoryCode: catConfig.code,
          categoryName: catConfig.name,
          value: data.value,
          percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
          count: data.count,
          color: catConfig.color,
          order: catConfig.order,
          items: data.items.map(item => ({
            ...item,
            percentage: totalValue > 0 ? (item.value / totalValue) * 100 : 0,
          })),
        };
      })
      .filter(cat => cat.value > 0) // 只返回有值的分类
      .sort((a, b) => a.order - b.order)
      .map(({ order, ...rest }) => rest); // 移除排序字段

    logger.debug('二级分类细分完成', {
      group: overviewGroup,
      total: totalValue.toFixed(2),
      categoryCount: bySubCategory.length
    });

    return {
      groupCode: overviewGroup,
      groupName: config.name,
      total: totalValue,
      count: totalCount,
      bySubCategory,
    };
  }

  /**
   * ✨ Phase 2.2: 批量获取所有概览分组的二级分类细分
   * 
   * @param userId 用户ID
   * @returns 所有分组的二级分类细分数据
   */
  static async getAllGroupsSubCategories(userId: string): Promise<Record<string, {
    groupCode: string;
    groupName: string;
    total: number;
    count: number;
    bySubCategory: Array<{
      categoryCode: string;
      categoryName: string;
      value: number;
      percentage: number;
      count: number;
      color: string;
      items: Array<{
        id: string;
        name: string;
        value: number;
        percentage: number;
      }>;
    }>;
  }>> {
    const groups = ['CASH', 'FIXED_INCOME', 'REAL_ESTATE', 'ALTERNATIVE', 'RECEIVABLE', 'OTHER'];
    
    const results: Record<string, Awaited<ReturnType<typeof this.getAssetsBySubCategory>>> = {};
    
    for (const group of groups) {
      results[group] = await this.getAssetsBySubCategory(userId, group);
    }
    
    return results;
  }
}

// ==================== 导出类型 ====================

/**
 * 持仓计算结果（完整数据）
 */
export interface HoldingWithCalculations {
  id: string;
  type: 'holding';
  symbol: string;
  name: string;
  accountId: string;
  accountName: string;
  broker: string;
  quantity: number;
  currentPrice: number;
  averageCost: number;
  costBasis: number;
  marketValue: number;
  marketValueOriginal: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  sector: string;
  region: string;
  currency: string;
  exchangeRate: number;
  lastUpdated: string;
  percentage: number;
  underlyingType?: string; // 底层敞口类型
}

/**
 * 全量资产 Top N 项目（证券按标的合并 + 非证券资产）
 */
export interface TopAssetItem {
  name: string;                    // 资产名称
  category: string;                // 资产大类（证券、不动产、贵金属...）
  subtitle: string;                // 副标题（券商名/资产子类名）
  marketValueCny: number;          // 市值（CNY）
  unrealizedPnlPercent: number;    // 盈亏百分比（加权平均）
}

// ==================== 底层敞口分布类型 ====================

/**
 * 按底层敞口的资产分布
 */
export interface UnderlyingTypeDistribution {
  code: string;           // 底层敞口类型代码
  name: string;           // 中文名称
  value: number;          // 总市值（CNY）
  percentage: number;     // 占比
  count: number;          // 资产数量
  color: string;          // 图表颜色
  includeInNetWorth: boolean; // 是否计入净资产
  details?: {             // 详细构成（可选）
    holdings: number;     // 证券持仓市值
    cashAssets: number;   // 现金资产市值
    otherAssets: number;  // 其他资产市值
  };
}
