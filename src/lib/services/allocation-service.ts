/**
 * 资产配置分析服务
 * 
 * Phase 3: 提供资产配置目标管理、偏离分析、AI建议等功能
 */

import { prisma } from '@/lib/prisma';
import { PortfolioService } from './portfolio-service';
import { LiabilityService } from './liability-service';
import { Decimal } from '@prisma/client/runtime/library';
import { exchangeRateService } from '@/lib/exchange-rate-service';
import { createLogger } from '@/lib/logger';
import { ASSET_OVERVIEW_GROUPS } from '@/lib/underlying-type';

const logger = createLogger('AllocationService');

// ==================== 类型定义 ====================

export interface AllocationTarget {
  categoryCode: string;
  categoryName: string;
  level: number;
  parentCode?: string;
  targetPercent: number;
  minPercent: number;
  maxPercent: number;
  alertThreshold: number;
  priority: number;
  isActive: boolean;
  color?: string;
  icon?: string;
}

export interface AllocationAnalysisItem {
  categoryCode: string;
  categoryName: string;
  level: number;
  color?: string;
  currentValue: number;
  currentPercent: number;
  targetPercent: number;
  minPercent: number;
  maxPercent: number;
  deviation: number;  // currentPercent - targetPercent
  deviationStatus: 'NORMAL' | 'WARNING' | 'CRITICAL';
  suggestedAction: 'HOLD' | 'BUY' | 'SELL' | 'REBALANCE';
  suggestedAmount: number;
}

export interface AllocationAlert {
  type: 'OVERWEIGHT' | 'UNDERWEIGHT' | 'MISSING_CATEGORY' | 'CONCENTRATION_RISK';
  categoryCode: string;
  categoryName: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  currentPercent?: number;
  targetPercent?: number;
  deviation?: number;
}

export interface AllocationAnalysis {
  analysis: AllocationAnalysisItem[];
  overallScore: number;  // 0-100
  alerts: AllocationAlert[];
  totalAssets: number;
  lastUpdated: string;
  
  // 负债信息
  liabilityInfo?: {
    totalLiabilities: number;      // 总负债（CNY）
    liabilityRatio: number;        // 负债率 = 总负债 / 总资产
    netAssets: number;             // 净资产 = 总资产 - 总负债
    monthlyPayment: number;        // 月供总额
    liabilityCount: number;        // 负债项目数
    debtHealthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';  // 负债健康状态
    debtAdvice?: string;           // 负债建议
    // 新增专业指标
    dti?: number;                  // 负债收入比 (Debt-to-Income) = 月供 / 月收入
    debtCoverageRatio?: number;    // 偿债覆盖率 = 现金资产 / 月供（建议≥6个月）
    averageInterestRate?: number;  // 平均利率
    byType?: Array<{               // 按类型分布
      type: string;
      typeName: string;
      balance: number;
      percentage: number;
    }>;
  };
  
  // 新增：评分维度细分
  scoreBreakdown?: {
    deviationScore: number;        // 偏离度得分（满分40）
    diversityScore: number;        // 多样性得分（满分20）
    liquidityScore: number;        // 流动性得分（满分20）
    debtScore: number;             // 负债健康得分（满分20）
  };
  
  // 新增：关键财务指标
  keyMetrics?: {
    liquidityRatio: number;        // 流动性比率 = 现金类资产 / 月支出
    liquidityMonths: number;       // 可覆盖月数
    emergencyFundStatus: 'INSUFFICIENT' | 'ADEQUATE' | 'SURPLUS';  // 应急资金状态
    diversityIndex: number;        // 资产多样性指数（0-100）
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';  // 整体风险水平
    equityRatio: number;           // 权益类占比
    incomeAssetRatio?: number;     // 生息资产占比
    totalInvestmentValue: number;  // 投资类资产总值
    totalCashValue: number;        // 现金类资产总值
    // 新增：生息资产详情
    incomeAssetDetails?: {
      equityValue: number;                      // 权益类资产
      fixedIncomeValue: number;                 // 固定收益类资产
      moneyFundValue: number;                   // 货币基金
      foreignBrokerCashValue: number;           // 港美户现金
      incomeGeneratingCashValue: number;        // 生息现金合计（货币基金 + 港美户现金）
      incomeGeneratingRealEstateValue: number;  // 出租不动产
      totalValue: number;                       // 生息资产总值
    };
  };
  
  // ⚠️ 2026-02-01新增：二级分类数据
  groupsSubCategories?: any;
  equityByRegion?: any;
}

// 财务目标类型
export interface FinancialGoals {
  primaryGoal?: string;          // 主要目标
  shortTermGoals?: string[];     // 短期目标（1-3年）
  mediumTermGoals?: string[];    // 中期目标（3-10年）
  longTermGoals?: string[];      // 长期目标（10年以上）
  targetNetWorth?: number;       // 目标净资产
  targetDate?: string;           // 目标达成时间
  notes?: string;                // 其他说明
}

export interface FamilyProfile {
  id: string;
  householdMembers: number;
  primaryEarnerAge?: number;
  childrenCount: number;
  elderlyCount: number;
  monthlyIncome?: number;
  incomeStability?: string;
  monthlyExpenses?: number;
  emergencyFundMonths: number;
  riskTolerance: string;
  investmentHorizon: string;
  retirementAge?: number;
  majorGoals?: Array<{ name: string; targetAmount: number; targetDate: string }>;
  financialGoals?: FinancialGoals;  // 财务目标
  hasHomeLoan: boolean;
  homeLoanMonthlyPayment?: number;
  hasCarLoan: boolean;
  hasOtherLoans: boolean;
  hasLifeInsurance: boolean;
  hasHealthInsurance: boolean;
  hasCriticalIllnessInsurance: boolean;
}

export interface AIAdviceRequest {
  includeMarketContext?: boolean;
  focusCategories?: string[];
  userNotes?: string;
}

export interface AIAdviceResponse {
  adviceId: string;
  summary: string;
  confidence: number;
  targets: Array<{
    categoryCode: string;
    categoryName: string;
    currentPercent: number;
    suggestedPercent: number;
    reason: string;
  }>;
  actions: Array<{
    priority: number;
    category: string;
    categoryName: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    amount?: number;
    reason: string;
  }>;
  risks: string[];
  nextReviewDate: string;
  fullAnalysis: string;
}

// ==================== 服务实现 ====================

export class AllocationService {
  
  /**
   * 获取用户的配置目标列表
   */
  static async getAllocationTargets(userId: string): Promise<AllocationTarget[]> {
    // 获取用户自定义的目标
    const userTargets = await prisma.userAllocationTarget.findMany({
      where: { userId, isActive: true },
    });

    // 如果用户没有设置目标，使用系统默认值
    if (userTargets.length === 0) {
      return this.getDefaultTargets();
    }

    // ✨ 使用 ASSET_OVERVIEW_GROUPS 获取分类名称和颜色
    const { ASSET_OVERVIEW_GROUPS } = await import('@/lib/underlying-type');
    
    return userTargets.map(target => {
      const group = ASSET_OVERVIEW_GROUPS.find(g => g.id.toUpperCase() === target.categoryCode);
      return {
        categoryCode: target.categoryCode,
        categoryName: group?.name || target.categoryCode,
        level: 1, // 顶层分类
        parentCode: undefined,
        targetPercent: Number(target.targetPercent),
        minPercent: Number(target.minPercent || Number(target.targetPercent) * 0.8),
        maxPercent: Number(target.maxPercent || Number(target.targetPercent) * 1.2),
        alertThreshold: Number(target.alertThreshold),
        priority: target.priority,
        isActive: target.isActive,
        color: group?.color || undefined,
        icon: group?.icon || undefined,
      };
    });
  }

  /**
   * 获取系统默认的配置目标（基于资产概览分组，与首页一致）
   * 
   * ⚠️ 2026-02-01更新：改用 ASSET_OVERVIEW_GROUPS 与首页保持一致
   * 分类体系：权益类(EQUITY)、固定收益(FIXED_INCOME)、现金等价物(CASH)、不动产(REAL_ESTATE)、另类投资(ALTERNATIVE)
   */
  static async getDefaultTargets(): Promise<AllocationTarget[]> {
    // 动态导入分组配置
    const { ASSET_OVERVIEW_GROUPS } = await import('@/lib/underlying-type');

    // 预设合理的默认配置（总和=100%）
    // 这是一个适合中等风险偏好的配置
    const defaultAllocations: Record<string, { 
      target: number; 
      min: number; 
      max: number;
    }> = {
      'EQUITY': { target: 55, min: 40, max: 70 },      // 权益类 55%
      'FIXED_INCOME': { target: 15, min: 5, max: 30 }, // 固定收益 15%
      'CASH': { target: 15, min: 5, max: 25 },         // 现金等价物 15%
      'REAL_ESTATE': { target: 10, min: 0, max: 30 },  // 不动产 10%
      'ALTERNATIVE': { target: 5, min: 0, max: 15 },   // 另类投资 5%
    };

    return ASSET_OVERVIEW_GROUPS.map(group => {
      const code = group.id.toUpperCase();  // 转为大写以匹配预设
      const allocation = defaultAllocations[code] || { target: 0, min: 0, max: 100 };
      
      return {
        categoryCode: code,
        categoryName: group.name,
        level: 1,
        targetPercent: allocation.target,
        minPercent: allocation.min,
        maxPercent: allocation.max,
        alertThreshold: 5,
        priority: group.sortOrder,
        isActive: true,
        color: group.color,
        icon: group.icon,
      };
    });
  }

  /**
   * 批量更新用户的配置目标
   */
  static async updateAllocationTargets(
    userId: string,
    targets: Array<{
      categoryCode: string;
      targetPercent: number;
      minPercent?: number;
      maxPercent?: number;
      alertThreshold?: number;
      priority?: number;
    }>
  ): Promise<void> {
    // 使用事务批量更新
    await prisma.$transaction(async (tx) => {
      for (const target of targets) {
        await tx.userAllocationTarget.upsert({
          where: {
            userId_categoryCode: {
              userId,
              categoryCode: target.categoryCode,
            },
          },
          update: {
            targetPercent: target.targetPercent,
            minPercent: target.minPercent,
            maxPercent: target.maxPercent,
            alertThreshold: target.alertThreshold ?? 5,
            priority: target.priority ?? 0,
            isActive: true,
          },
          create: {
            userId,
            categoryCode: target.categoryCode,
            targetPercent: target.targetPercent,
            minPercent: target.minPercent,
            maxPercent: target.maxPercent,
            alertThreshold: target.alertThreshold ?? 5,
            priority: target.priority ?? 0,
          },
        });
      }
    });
  }

  /**
   * 重置为默认配置目标
   */
  static async resetToDefaults(userId: string): Promise<void> {
    await prisma.userAllocationTarget.deleteMany({
      where: { userId },
    });
  }

  /**
   * 获取配置分析（当前 vs 目标）
   * 
   * ⚠️ 2026-02-01更新：改用 getPortfolioByOverviewGroup() 与首页保持一致
   * 分类体系：权益类、固定收益、现金等价物、不动产、另类投资
   */
  static async getAnalysis(userId: string): Promise<AllocationAnalysis> {
    // 1. 获取当前资产配置（使用底层敞口分组，与首页一致）
    const portfolioByOverviewGroup = await PortfolioService.getPortfolioByOverviewGroup(userId);
    const overview = await PortfolioService.calculatePortfolioOverview(userId);
    
    logger.debug('获取资产配置分析');
    
    // 2. 获取配置目标
    const targets = await this.getAllocationTargets(userId);
    
    // 3. 构建分析结果
    const analysis: AllocationAnalysisItem[] = [];
    const alerts: AllocationAlert[] = [];
    
    // 创建目标映射
    const targetMap = new Map(targets.map(t => [t.categoryCode, t]));
    
    // 分析每个资产类别
    // portfolioByOverviewGroup 返回的字段是 code(代码) 和 name(名称)
    for (const asset of portfolioByOverviewGroup) {
      const assetCode = asset.code;  // 如 EQUITY, FIXED_INCOME, CASH, REAL_ESTATE, ALTERNATIVE
      const assetName = asset.name;  // 如 权益类, 固定收益, 现金等价物, 不动产, 另类投资
      
      const target = targetMap.get(assetCode);
      const currentPercent = asset.percentage;
      const targetPercent = target?.targetPercent || 0;
      const minPercent = target?.minPercent || 0;
      const maxPercent = target?.maxPercent || 100;
      const alertThreshold = target?.alertThreshold || 5;
      
      const deviation = currentPercent - targetPercent;
      const absDeviation = Math.abs(deviation);
      
      // 判断状态
      let deviationStatus: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
      if (absDeviation >= alertThreshold * 2) {
        deviationStatus = 'CRITICAL';
      } else if (absDeviation >= alertThreshold) {
        deviationStatus = 'WARNING';
      }
      
      // 判断建议操作
      let suggestedAction: 'HOLD' | 'BUY' | 'SELL' | 'REBALANCE' = 'HOLD';
      let suggestedAmount = 0;
      
      if (currentPercent > maxPercent) {
        suggestedAction = 'SELL';
        suggestedAmount = (currentPercent - targetPercent) / 100 * overview.totalAssets;
      } else if (currentPercent < minPercent) {
        suggestedAction = 'BUY';
        suggestedAmount = (targetPercent - currentPercent) / 100 * overview.totalAssets;
      } else if (deviationStatus !== 'NORMAL') {
        suggestedAction = 'REBALANCE';
        suggestedAmount = Math.abs(deviation) / 100 * overview.totalAssets;
      }
      
      analysis.push({
        categoryCode: assetCode,
        categoryName: assetName,
        level: 1,
        color: asset.color,
        currentValue: asset.value,
        currentPercent,
        targetPercent,
        minPercent,
        maxPercent,
        deviation,
        deviationStatus,
        suggestedAction,
        suggestedAmount,
      });
      
      // 生成告警
      if (deviationStatus === 'CRITICAL') {
        if (deviation > 0) {
          alerts.push({
            type: 'OVERWEIGHT',
            categoryCode: assetCode,
            categoryName: assetName,
            message: `${assetName}占比偏高（当前${currentPercent.toFixed(1)}%，目标${targetPercent.toFixed(1)}%），建议适当减仓`,
            severity: 'HIGH',
            currentPercent,
            targetPercent,
            deviation,
          });
        } else {
          alerts.push({
            type: 'UNDERWEIGHT',
            categoryCode: assetCode,
            categoryName: assetName,
            message: `${assetName}占比偏低（当前${currentPercent.toFixed(1)}%，目标${targetPercent.toFixed(1)}%），建议增配`,
            severity: 'HIGH',
            currentPercent,
            targetPercent,
            deviation,
          });
        }
      } else if (deviationStatus === 'WARNING') {
        alerts.push({
          type: deviation > 0 ? 'OVERWEIGHT' : 'UNDERWEIGHT',
          categoryCode: assetCode,
          categoryName: assetName,
          message: `${assetName}配置偏离目标${Math.abs(deviation).toFixed(1)}%，请关注`,
          severity: 'MEDIUM',
          currentPercent,
          targetPercent,
          deviation,
        });
      }
    }
    
    // 检查目标中有但实际没有的分类 — 同时补充到 analysis 数组，确保偏离度图表完整
    for (const [code, target] of targetMap) {
      // 注意：portfolioByOverviewGroup 返回的字段是 code (而不是 type)
      if (target.targetPercent > 0 && !portfolioByOverviewGroup.find(p => p.code === code)) {
        // 查找该类别的颜色定义
        const groupDef = ASSET_OVERVIEW_GROUPS.find(g => g.id === code.toLowerCase());
        
        // 补充到 analysis 数组（当前持仓为 0，偏离度 = -targetPercent）
        const deviation = 0 - target.targetPercent;
        const absDeviation = Math.abs(deviation);
        const alertThreshold = target.alertThreshold || 5;
        let deviationStatus: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
        if (absDeviation >= alertThreshold * 2) {
          deviationStatus = 'CRITICAL';
        } else if (absDeviation >= alertThreshold) {
          deviationStatus = 'WARNING';
        }
        
        analysis.push({
          categoryCode: code,
          categoryName: target.categoryName,
          level: 1,
          color: groupDef?.color || '#94A3B8',
          currentValue: 0,
          currentPercent: 0,
          targetPercent: target.targetPercent,
          minPercent: target.minPercent || 0,
          maxPercent: target.maxPercent || 100,
          deviation,
          deviationStatus,
          suggestedAction: 'BUY',
          suggestedAmount: target.targetPercent / 100 * overview.totalAssets,
        });

        alerts.push({
          type: 'MISSING_CATEGORY',
          categoryCode: code,
          categoryName: target.categoryName,
          message: `目标配置中的${target.categoryName}（${target.targetPercent.toFixed(1)}%）尚未配置`,
          severity: target.targetPercent >= 10 ? 'MEDIUM' : 'LOW',
          targetPercent: target.targetPercent,
        });
      }
    }
    
    // 检查集中度风险
    const maxSingleCategory = Math.max(...analysis.map(a => a.currentPercent));
    if (maxSingleCategory > 50) {
      const topCategory = analysis.find(a => a.currentPercent === maxSingleCategory);
      if (topCategory) {
        alerts.push({
          type: 'CONCENTRATION_RISK',
          categoryCode: topCategory.categoryCode,
          categoryName: topCategory.categoryName,
          message: `${topCategory.categoryName}占比达${maxSingleCategory.toFixed(1)}%，存在集中风险`,
          severity: maxSingleCategory > 60 ? 'HIGH' : 'MEDIUM',
          currentPercent: maxSingleCategory,
        });
      }
    }
    
    // 计算整体评分
    const overallScore = this.calculateOverallScore(analysis, alerts);
    
    // =====================================================
    // 5. 获取负债信息
    // =====================================================
    let liabilityInfo = undefined;
    try {
      const liabilityOverview = await LiabilityService.calculateLiabilityOverview(userId);
      
      if (liabilityOverview.liabilityCount > 0 || liabilityOverview.totalLiabilities > 0) {
        const liabilityRatio = overview.totalAssets > 0 
          ? (liabilityOverview.totalLiabilities / overview.totalAssets) * 100 
          : 0;
        const netAssets = overview.totalAssets - liabilityOverview.totalLiabilities;
        
        // 判断负债健康状态
        let debtHealthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
        let debtAdvice = '';
        
        if (liabilityRatio > 80) {
          debtHealthStatus = 'CRITICAL';
          debtAdvice = '负债率过高，建议优先偿还高息债务，暂缓新增投资';
        } else if (liabilityRatio > 50) {
          debtHealthStatus = 'WARNING';
          debtAdvice = '负债率偏高，建议控制负债增长，优化债务结构';
        } else if (liabilityRatio > 30) {
          debtAdvice = '负债率适中，建议保持稳健的资产负债结构';
        } else {
          debtAdvice = '负债率健康，可适当利用低息贷款进行资产配置';
        }
        
        // 获取家庭概况以计算DTI
        const familyProfile = await this.getFamilyProfile(userId);
        const monthlyIncome = familyProfile?.monthlyIncome || 0;
        const monthlyExpenses = familyProfile?.monthlyExpenses || 0;
        
        // 计算DTI（负债收入比）
        const dti = monthlyIncome > 0 
          ? (liabilityOverview.totalMonthlyPayment / monthlyIncome) * 100 
          : undefined;
        
        // 计算偿债覆盖率（现金资产能覆盖多少个月的月供）
        const cashAssets = portfolioByOverviewGroup.find(p => p.code === 'CASH')?.value || 0;
        const debtCoverageRatio = liabilityOverview.totalMonthlyPayment > 0
          ? cashAssets / liabilityOverview.totalMonthlyPayment
          : undefined;
        
        // 按类型分布
        const byType = liabilityOverview.byType?.map(item => ({
          type: item.type,
          typeName: item.typeName,
          balance: item.totalBalance,
          percentage: liabilityOverview.totalLiabilities > 0 
            ? (item.totalBalance / liabilityOverview.totalLiabilities) * 100 
            : 0,
        })) || [];
        
        liabilityInfo = {
          totalLiabilities: liabilityOverview.totalLiabilities,
          liabilityRatio,
          netAssets,
          monthlyPayment: liabilityOverview.totalMonthlyPayment,
          liabilityCount: liabilityOverview.liabilityCount,
          debtHealthStatus,
          debtAdvice,
          dti,
          debtCoverageRatio,
          averageInterestRate: liabilityOverview.averageInterestRate,
          byType,
        };
        
        // 如果负债率过高，添加告警
        if (debtHealthStatus === 'CRITICAL') {
          alerts.push({
            type: 'CONCENTRATION_RISK' as const,
            categoryCode: 'LIABILITY',
            categoryName: '负债',
            message: `负债率${liabilityRatio.toFixed(1)}%，已超过80%警戒线`,
            severity: 'HIGH',
            currentPercent: liabilityRatio,
          });
        } else if (debtHealthStatus === 'WARNING') {
          alerts.push({
            type: 'CONCENTRATION_RISK' as const,
            categoryCode: 'LIABILITY',
            categoryName: '负债',
            message: `负债率${liabilityRatio.toFixed(1)}%，建议适当控制`,
            severity: 'MEDIUM',
            currentPercent: liabilityRatio,
          });
        }
        
        // DTI警告
        if (dti !== undefined && dti > 50) {
          alerts.push({
            type: 'CONCENTRATION_RISK' as const,
            categoryCode: 'DTI',
            categoryName: '负债收入比',
            message: `月供占收入${dti.toFixed(1)}%，超过50%安全线，现金流压力较大`,
            severity: dti > 70 ? 'HIGH' : 'MEDIUM',
            currentPercent: dti,
          });
        }
      }
    } catch (error) {
      console.error('[AllocationService] 获取负债信息失败:', error);
    }
    
    // =====================================================
    // 6. 计算关键财务指标
    // =====================================================
    // ✨ 使用底层敞口数据（portfolioByOverviewGroup），与前端 HeroSection 一致
    // 注意：portfolioByOverviewGroup 已在方法开头获取，这里直接使用
    
    // 从底层敞口数据获取各分类金额（这与前端显示的数据一致）
    const cashValue = portfolioByOverviewGroup.find(p => p.code === 'CASH')?.value || 0;
    const equityValue = portfolioByOverviewGroup.find(p => p.code === 'EQUITY')?.value || 0;
    const fixedIncomeValue = portfolioByOverviewGroup.find(p => p.code === 'FIXED_INCOME')?.value || 0;
    const realEstateValue = portfolioByOverviewGroup.find(p => p.code === 'REAL_ESTATE')?.value || 0;
    
    // 获取家庭概况信息
    let familyProfileData = null;
    try {
      familyProfileData = await this.getFamilyProfile(userId);
    } catch (e) {
      logger.warn('获取家庭概况失败', e);
    }
    
    const monthlyExpensesValue = familyProfileData?.monthlyExpenses || 0;
    const monthlyIncomeValue = familyProfileData?.monthlyIncome || 0;
    
    // 流动性比率（现金能覆盖多少个月支出）
    const liquidityMonths = monthlyExpensesValue > 0 
      ? cashValue / monthlyExpensesValue 
      : (cashValue > 0 ? 12 : 0);  // 如果没有设置月支出，有现金就算12个月
    
    // 应急资金状态
    let emergencyFundStatus: 'INSUFFICIENT' | 'ADEQUATE' | 'SURPLUS' = 'ADEQUATE';
    const targetEmergencyMonths = familyProfileData?.emergencyFundMonths || 6;
    if (liquidityMonths < targetEmergencyMonths * 0.5) {
      emergencyFundStatus = 'INSUFFICIENT';
    } else if (liquidityMonths > targetEmergencyMonths * 2) {
      emergencyFundStatus = 'SURPLUS';
    }
    
    // 资产多样性指数（使用 HHI 逆向计算，越分散越高）
    const percentages = analysis.map(a => a.currentPercent / 100);
    const hhi = percentages.reduce((sum, p) => sum + p * p, 0);
    const diversityIndex = Math.round((1 - hhi) * 100);  // 转换为0-100
    
    // 风险水平判断
    const equityRatio = overview.totalAssets > 0 ? (equityValue / overview.totalAssets) * 100 : 0;
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (equityRatio > 70) {
      riskLevel = 'HIGH';
    } else if (equityRatio < 30) {
      riskLevel = 'LOW';
    }
    
    // =====================================================
    // 6.1 计算生息资产（基于底层敞口架构精确统计）
    // =====================================================
    // 生息资产包括：
    // 1. 权益类（EQUITY）- 从底层敞口取（与前端HeroSection一致）
    // 2. 固定收益（FIXED_INCOME）- 从底层敞口取（包含定期存款）
    // 3. 现金资产中的货币基金（CASH_MONEY_FUND）- 使用 getAssetsBySubCategory 获取（与首页一致）
    // 4. 证券账户现金 - 仅长桥港户和美户（排除平安账户）
    // 5. 不动产（REAL_ESTATE）- 从底层敞口取（仅有一套出租房）
    // =====================================================
    
    // 生息现金资产的详细数据
    let moneyFundValue = 0;
    let foreignBrokerCashValue = 0;
    
    try {
      // 1. 获取货币基金 - 直接调用 PortfolioService.getAssetsBySubCategory('CASH')
      // 这确保与首页资产概览使用完全相同的计算逻辑
      const cashSubCategories = await PortfolioService.getAssetsBySubCategory(userId, 'CASH');
      const moneyFundCategory = cashSubCategories.bySubCategory.find(c => c.categoryCode === 'CASH_MONEY_FUND');
      moneyFundValue = moneyFundCategory?.value || 0;
      
      // 2. 获取港美户现金 - 直接调用 PortfolioService.getAssetsBySubCategory('CASH')
      // 券商现金分类包含所有证券账户的现金（已按汇率转换为 CNY）
      const brokerCashCategory = cashSubCategories.bySubCategory.find(c => c.categoryCode === 'CASH_BROKER');
      
      // 从券商现金中筛选出长桥的港美户现金
      // 注意：brokerCashCategory.items 包含所有券商的现金，我们只需要长桥的港美户
      if (brokerCashCategory?.items) {
        for (const item of brokerCashCategory.items) {
          // 根据名称判断是否是长桥的港美户（名称格式：长桥证券-长桥美股账户）
          if (item.name.includes('长桥') && (item.name.includes('美股') || item.name.includes('港股'))) {
            foreignBrokerCashValue += item.value;
          }
        }
      }
      
    } catch (e) {
      logger.warn('获取生息资产详情失败', e);
    }
    
    // 生息现金 = 货币基金 + 港美户现金（长桥）
    const incomeGeneratingCashValue = moneyFundValue + foreignBrokerCashValue;
    
    // 生息资产总值 = 权益(底层敞口) + 固收(底层敞口) + 生息现金(货币基金 + 港美户) + 不动产(底层敞口)
    const totalIncomeGeneratingAssets = equityValue + fixedIncomeValue + incomeGeneratingCashValue + realEstateValue;
    
    const incomeAssetRatio = overview.totalAssets > 0 
      ? (totalIncomeGeneratingAssets / overview.totalAssets) * 100 
      : 0;
    
    const keyMetrics = {
      liquidityRatio: monthlyExpensesValue > 0 ? cashValue / monthlyExpensesValue : 0,
      liquidityMonths,
      emergencyFundStatus,
      diversityIndex,
      riskLevel,
      equityRatio,
      incomeAssetRatio,
      totalInvestmentValue: overview.totalInvestmentValue || 0,
      totalCashValue: cashValue,
      // 新增：生息资产详情（更精细的分类，数据来自底层敞口）
      incomeAssetDetails: {
        equityValue,                         // 权益类（底层敞口）
        fixedIncomeValue,                    // 固定收益（底层敞口，含定期存款）
        moneyFundValue,                      // 货币基金
        foreignBrokerCashValue,              // 港美户现金（长桥）
        incomeGeneratingCashValue,           // 生息现金合计（货币基金 + 港美户现金）
        incomeGeneratingRealEstateValue: realEstateValue, // 不动产（底层敞口）
        totalValue: totalIncomeGeneratingAssets,
      },
    };
    
    // 流动性不足警告
    if (emergencyFundStatus === 'INSUFFICIENT' && monthlyExpensesValue > 0) {
      alerts.push({
        type: 'UNDERWEIGHT' as const,
        categoryCode: 'EMERGENCY_FUND',
        categoryName: '应急资金',
        message: `现金仅能覆盖${liquidityMonths.toFixed(1)}个月支出，低于建议的${targetEmergencyMonths}个月`,
        severity: liquidityMonths < 3 ? 'HIGH' : 'MEDIUM',
        currentPercent: liquidityMonths,
        targetPercent: targetEmergencyMonths,
      });
    }
    
    // =====================================================
    // 7. 计算评分维度细分
    // =====================================================
    const scoreBreakdown = this.calculateScoreBreakdown(
      analysis, 
      liabilityInfo, 
      keyMetrics,
      familyProfileData
    );
    
    // 使用细分评分计算总分
    const calculatedScore = scoreBreakdown.deviationScore + 
                            scoreBreakdown.diversityScore + 
                            scoreBreakdown.liquidityScore + 
                            scoreBreakdown.debtScore;
    
    // =====================================================
    // 8. 获取二级分类数据（用于展示和AI建议）
    // ⚠️ 2026-02-01新增：与首页资产概览保持一致的二级分类展示
    // =====================================================
    let groupsSubCategories = null;
    let equityByRegion = null;
    
    try {
      // 获取各资产分组的二级分类数据（CASH、FIXED_INCOME、REAL_ESTATE、ALTERNATIVE、OTHER）
      groupsSubCategories = await PortfolioService.getAllGroupsSubCategories(userId);
      
      // 获取权益类按地区细分数据
      equityByRegion = await PortfolioService.getEquityByRegion(userId);
    } catch (e) {
      logger.warn('获取二级分类数据失败', e);
    }
    
    return {
      analysis,
      overallScore: Math.round(calculatedScore),
      alerts: alerts.sort((a, b) => {
        const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      totalAssets: overview.totalAssets,
      lastUpdated: new Date().toISOString(),
      liabilityInfo,
      scoreBreakdown,
      keyMetrics,
      // ⚠️ 2026-02-01新增：二级分类数据
      groupsSubCategories,
      equityByRegion,
    };
  }

  /**
   * 获取家庭级别的配置分析（聚合所有家庭成员的数据）
   * 
   * 与 getAnalysis(userId) 逻辑一致，但数据来源是所有家庭成员的聚合
   */
  static async getAnalysisForFamily(familyId: string, userId: string): Promise<AllocationAnalysis> {
    // 1. 获取所有家庭成员
    const members = await prisma.familyMember.findMany({
      where: { familyId },
      select: { userId: true },
    });

    if (members.length === 0) {
      throw new Error('家庭没有成员');
    }

    const memberUserIds = members.map(m => m.userId);

    // 2. 并行获取所有成员的底层敞口分组数据
    const allOverviewGroups = await Promise.all(
      memberUserIds.map(uid => 
        PortfolioService.getPortfolioByOverviewGroup(uid).catch(() => [])
      )
    );

    // 3. 聚合底层敞口分组
    const groupAgg: Record<string, { value: number; name: string; color: string; count: number }> = {};
    for (const memberGroups of allOverviewGroups) {
      for (const group of memberGroups) {
        if (!groupAgg[group.code]) {
          groupAgg[group.code] = { value: 0, name: group.name, color: group.color, count: 0 };
        }
        groupAgg[group.code].value += group.value;
        groupAgg[group.code].count += group.count;
      }
    }

    // 4. 计算总资产
    const familyTotalAssets = Object.values(groupAgg).reduce((sum, g) => sum + g.value, 0);

    // 构建与 PortfolioService.getPortfolioByOverviewGroup 返回格式一致的数组
    const familyOverviewGroups = Object.entries(groupAgg).map(([code, data]) => ({
      code,
      name: data.name,
      value: data.value,
      percentage: familyTotalAssets > 0 ? Number(((data.value / familyTotalAssets) * 100).toFixed(2)) : 0,
      count: data.count,
      color: data.color,
      includeInNetWorth: true,
    }));

    // 5. 获取配置目标（使用当前用户的目标）
    const targets = await this.getAllocationTargets(userId);

    // 6. 与 getAnalysis 相同的分析逻辑
    const familyAnalysis: AllocationAnalysisItem[] = [];
    const familyAlerts: AllocationAlert[] = [];
    const targetMap = new Map(targets.map(t => [t.categoryCode, t]));

    for (const asset of familyOverviewGroups) {
      const assetCode = asset.code;
      const assetName = asset.name;
      const target = targetMap.get(assetCode);
      const currentPercent = asset.percentage;
      const targetPercent = target?.targetPercent || 0;
      const minPercent = target?.minPercent || 0;
      const maxPercent = target?.maxPercent || 100;
      const alertThreshold = target?.alertThreshold || 5;
      const deviation = currentPercent - targetPercent;
      const absDeviation = Math.abs(deviation);

      let deviationStatus: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
      if (absDeviation >= alertThreshold * 2) deviationStatus = 'CRITICAL';
      else if (absDeviation >= alertThreshold) deviationStatus = 'WARNING';

      let suggestedAction: 'HOLD' | 'BUY' | 'SELL' | 'REBALANCE' = 'HOLD';
      let suggestedAmount = 0;
      if (currentPercent > maxPercent) {
        suggestedAction = 'SELL';
        suggestedAmount = (currentPercent - targetPercent) / 100 * familyTotalAssets;
      } else if (currentPercent < minPercent) {
        suggestedAction = 'BUY';
        suggestedAmount = (targetPercent - currentPercent) / 100 * familyTotalAssets;
      } else if (deviationStatus !== 'NORMAL') {
        suggestedAction = 'REBALANCE';
        suggestedAmount = Math.abs(deviation) / 100 * familyTotalAssets;
      }

      familyAnalysis.push({
        categoryCode: assetCode,
        categoryName: assetName,
        level: 1,
        color: asset.color,
        currentValue: asset.value,
        currentPercent,
        targetPercent,
        minPercent,
        maxPercent,
        deviation,
        deviationStatus,
        suggestedAction,
        suggestedAmount,
      });

      if (deviationStatus === 'CRITICAL') {
        familyAlerts.push({
          type: deviation > 0 ? 'OVERWEIGHT' : 'UNDERWEIGHT',
          categoryCode: assetCode,
          categoryName: assetName,
          message: `${assetName}占比${deviation > 0 ? '偏高' : '偏低'}（当前${currentPercent.toFixed(1)}%，目标${targetPercent.toFixed(1)}%），建议${deviation > 0 ? '适当减仓' : '增配'}`,
          severity: 'HIGH',
          currentPercent,
          targetPercent,
          deviation,
        });
      } else if (deviationStatus === 'WARNING') {
        familyAlerts.push({
          type: deviation > 0 ? 'OVERWEIGHT' : 'UNDERWEIGHT',
          categoryCode: assetCode,
          categoryName: assetName,
          message: `${assetName}配置偏离目标${Math.abs(deviation).toFixed(1)}%，请关注`,
          severity: 'MEDIUM',
          currentPercent,
          targetPercent,
          deviation,
        });
      }
    }

    // 检查目标中有但实际没有的分类
    for (const [code, target] of targetMap) {
      if (target.targetPercent > 0 && !familyOverviewGroups.find(p => p.code === code)) {
        familyAlerts.push({
          type: 'MISSING_CATEGORY',
          categoryCode: code,
          categoryName: target.categoryName,
          message: `目标配置中的${target.categoryName}（${target.targetPercent.toFixed(1)}%）尚未配置`,
          severity: target.targetPercent >= 10 ? 'MEDIUM' : 'LOW',
          targetPercent: target.targetPercent,
        });
      }
    }

    // 集中度风险
    const maxSingleCategory = Math.max(...familyAnalysis.map(a => a.currentPercent), 0);
    if (maxSingleCategory > 50) {
      const topCategory = familyAnalysis.find(a => a.currentPercent === maxSingleCategory);
      if (topCategory) {
        familyAlerts.push({
          type: 'CONCENTRATION_RISK',
          categoryCode: topCategory.categoryCode,
          categoryName: topCategory.categoryName,
          message: `${topCategory.categoryName}占比达${maxSingleCategory.toFixed(1)}%，存在集中风险`,
          severity: maxSingleCategory > 60 ? 'HIGH' : 'MEDIUM',
          currentPercent: maxSingleCategory,
        });
      }
    }

    // 7. 负债信息（聚合所有成员）
    let familyLiabilityInfo = undefined;
    try {
      const allLiabilities = await Promise.all(
        memberUserIds.map(uid => LiabilityService.calculateLiabilityOverview(uid).catch(() => null))
      );
      
      let totalLiab = 0;
      let totalMonthly = 0;
      let liabCount = 0;
      let weightedRate = 0;
      
      for (const l of allLiabilities) {
        if (l) {
          totalLiab += l.totalLiabilities;
          totalMonthly += l.totalMonthlyPayment;
          liabCount += l.liabilityCount;
          weightedRate += l.averageInterestRate * l.totalLiabilities;
        }
      }
      
      const avgRate = totalLiab > 0 ? weightedRate / totalLiab : 0;
      const liabRatio = familyTotalAssets > 0 ? (totalLiab / familyTotalAssets) * 100 : 0;

      let debtStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
      let debtAdv = '负债率健康';
      if (liabRatio > 80) { debtStatus = 'CRITICAL'; debtAdv = '负债率过高'; }
      else if (liabRatio > 50) { debtStatus = 'WARNING'; debtAdv = '负债率偏高'; }

      const fp = await this.getFamilyProfile(userId);
      const monthlyInc = fp?.monthlyIncome || 0;
      const dtiVal = monthlyInc > 0 ? (totalMonthly / monthlyInc) * 100 : undefined;
      const cashVal = familyOverviewGroups.find(p => p.code === 'CASH')?.value || 0;
      const coverageRatio = totalMonthly > 0 ? cashVal / totalMonthly : undefined;

      if (totalLiab > 0 || liabCount > 0) {
        familyLiabilityInfo = {
          totalLiabilities: totalLiab,
          liabilityRatio: liabRatio,
          netAssets: familyTotalAssets - totalLiab,
          monthlyPayment: totalMonthly,
          liabilityCount: liabCount,
          debtHealthStatus: debtStatus,
          debtAdvice: debtAdv,
          dti: dtiVal,
          debtCoverageRatio: coverageRatio,
          averageInterestRate: avgRate,
          byType: [] as Array<{ type: string; typeName: string; balance: number; percentage: number }>,
        };

        if (debtStatus === 'CRITICAL') {
          familyAlerts.push({
            type: 'CONCENTRATION_RISK' as const,
            categoryCode: 'LIABILITY',
            categoryName: '负债',
            message: `家庭负债率${liabRatio.toFixed(1)}%，已超过80%警戒线`,
            severity: 'HIGH',
            currentPercent: liabRatio,
          });
        }
      }
    } catch (error) {
      logger.warn('家庭负债聚合失败', error);
    }

    // 8. 评分细分和关键指标
    const familyProfile = await this.getFamilyProfile(userId);
    const fCashValue = familyOverviewGroups.find(p => p.code === 'CASH')?.value || 0;
    const fEquityValue = familyOverviewGroups.find(p => p.code === 'EQUITY')?.value || 0;
    const fMonthlyExpenses = familyProfile?.monthlyExpenses || 0;
    const fLiquidityMonths = fMonthlyExpenses > 0 ? fCashValue / fMonthlyExpenses : (fCashValue > 0 ? 12 : 0);
    const fTargetMonths = familyProfile?.emergencyFundMonths || 6;
    let fEmergencyStatus: 'INSUFFICIENT' | 'ADEQUATE' | 'SURPLUS' = 'ADEQUATE';
    if (fLiquidityMonths < fTargetMonths * 0.5) fEmergencyStatus = 'INSUFFICIENT';
    else if (fLiquidityMonths > fTargetMonths * 2) fEmergencyStatus = 'SURPLUS';

    const fPercentages = familyAnalysis.map(a => a.currentPercent / 100);
    const fHhi = fPercentages.reduce((sum, p) => sum + p * p, 0);
    const fDiversityIndex = Math.round((1 - fHhi) * 100);
    const fEquityRatio = familyTotalAssets > 0 ? (fEquityValue / familyTotalAssets) * 100 : 0;
    let fRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (fEquityRatio > 70) fRiskLevel = 'HIGH';
    else if (fEquityRatio < 30) fRiskLevel = 'LOW';

    const fKeyMetrics: NonNullable<AllocationAnalysis['keyMetrics']> = {
      liquidityRatio: fMonthlyExpenses > 0 ? fCashValue / fMonthlyExpenses : 0,
      liquidityMonths: Number(fLiquidityMonths.toFixed(1)),
      emergencyFundStatus: fEmergencyStatus,
      diversityIndex: fDiversityIndex,
      riskLevel: fRiskLevel,
      equityRatio: fEquityRatio,
      totalInvestmentValue: fEquityValue,
      totalCashValue: fCashValue,
    };

    const fScoreBreakdown = this.calculateScoreBreakdown(familyAnalysis, familyLiabilityInfo as any, fKeyMetrics, familyProfile);
    const fCalcScore = fScoreBreakdown.deviationScore + fScoreBreakdown.diversityScore + fScoreBreakdown.liquidityScore + fScoreBreakdown.debtScore;

    if (fEmergencyStatus === 'INSUFFICIENT') {
      familyAlerts.push({
        type: 'CONCENTRATION_RISK' as const,
        categoryCode: 'CASH',
        categoryName: '现金等价物',
        message: `现金仅能覆盖${fLiquidityMonths.toFixed(1)}个月支出，低于建议的${fTargetMonths}个月`,
        severity: fLiquidityMonths < fTargetMonths * 0.3 ? 'HIGH' : 'MEDIUM',
        currentPercent: familyOverviewGroups.find(p => p.code === 'CASH')?.percentage || 0,
      });
    }

    return {
      analysis: familyAnalysis,
      overallScore: Math.round(fCalcScore),
      alerts: familyAlerts.sort((a, b) => {
        const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      totalAssets: familyTotalAssets,
      lastUpdated: new Date().toISOString(),
      liabilityInfo: familyLiabilityInfo,
      scoreBreakdown: fScoreBreakdown,
      keyMetrics: fKeyMetrics,
      groupsSubCategories: undefined,
      equityByRegion: undefined,
    };
  }

  /**
   * 生成家庭级别的 AI 建议输入数据
   */
  static async prepareAIAdviceInputForFamily(familyId: string, userId: string): Promise<{
    familyProfile: FamilyProfile | null;
    currentAllocation: Array<{ code: string; name: string; value: number; percentage: number; count: number; color: string }>;
    portfolioOverview: { totalAssets: number; totalCash: number; totalInvestmentValue: number; totalCashAssets: number; totalOtherAssets: number };
    regionAllocation: Array<{ name: string; value: number; percentage: number }>;
    currentTargets: AllocationTarget[];
    liabilityOverview: Awaited<ReturnType<typeof LiabilityService.calculateLiabilityOverview>> | null;
    groupsSubCategories: undefined;
    equityByRegion: undefined;
  }> {
    const members = await prisma.familyMember.findMany({
      where: { familyId },
      select: { userId: true },
    });
    const memberUserIds = members.map(m => m.userId);

    // 并行获取所有成员数据
    const [familyProfile, allOverviewGroups, allOverviews, allRegions, currentTargets, allLiabilities] = await Promise.all([
      this.getFamilyProfile(userId),
      Promise.all(memberUserIds.map(uid => PortfolioService.getPortfolioByOverviewGroup(uid).catch(() => []))),
      Promise.all(memberUserIds.map(uid => PortfolioService.calculatePortfolioOverview(uid).catch(() => null))),
      Promise.all(memberUserIds.map(uid => PortfolioService.getPortfolioByRegion(uid).catch(() => []))),
      this.getAllocationTargets(userId),
      Promise.all(memberUserIds.map(uid => LiabilityService.calculateLiabilityOverview(uid).catch(() => null))),
    ]);

    // 聚合底层敞口分组
    const groupAgg: Record<string, { value: number; name: string; color: string; count: number }> = {};
    for (const memberGroups of allOverviewGroups) {
      for (const group of memberGroups) {
        if (!groupAgg[group.code]) {
          groupAgg[group.code] = { value: 0, name: group.name, color: group.color, count: 0 };
        }
        groupAgg[group.code].value += group.value;
        groupAgg[group.code].count += group.count;
      }
    }
    const totalAssets = Object.values(groupAgg).reduce((sum, g) => sum + g.value, 0);
    const currentAllocation = Object.entries(groupAgg).map(([code, data]) => ({
      code,
      name: data.name,
      value: data.value,
      percentage: totalAssets > 0 ? Number(((data.value / totalAssets) * 100).toFixed(2)) : 0,
      count: data.count,
      color: data.color,
    }));

    // 聚合概览
    let totalCash = 0, totalInvestmentValue = 0, totalCashAssets = 0, totalOtherAssets = 0;
    for (const o of allOverviews) {
      if (o) {
        totalCash += o.totalCash;
        totalInvestmentValue += o.totalInvestmentValue;
        totalCashAssets += o.totalCashAssets;
        totalOtherAssets += o.totalOtherAssets;
      }
    }

    // 聚合地区分布
    const regionAgg: Record<string, { value: number; name: string }> = {};
    for (const memberRegions of allRegions) {
      for (const r of memberRegions) {
        if (!regionAgg[r.name]) regionAgg[r.name] = { value: 0, name: r.name };
        regionAgg[r.name].value += r.value || 0;
      }
    }
    const totalRegionValue = Object.values(regionAgg).reduce((sum, r) => sum + r.value, 0);
    const regionAllocation = Object.values(regionAgg).map(r => ({
      name: r.name,
      value: r.value,
      percentage: totalRegionValue > 0 ? Number(((r.value / totalRegionValue) * 100).toFixed(2)) : 0,
    }));

    // 聚合负债
    let liabilityOverview = null;
    let totalLiab = 0, totalMonthly = 0, liabCount = 0, weightedRate = 0;
    for (const l of allLiabilities) {
      if (l) {
        totalLiab += l.totalLiabilities;
        totalMonthly += l.totalMonthlyPayment;
        liabCount += l.liabilityCount;
        weightedRate += l.averageInterestRate * l.totalLiabilities;
      }
    }
    if (totalLiab > 0 || liabCount > 0) {
      liabilityOverview = {
        totalLiabilities: totalLiab,
        totalMonthlyPayment: totalMonthly,
        liabilityCount: liabCount,
        averageInterestRate: totalLiab > 0 ? weightedRate / totalLiab : 0,
        byType: [] as Array<{ type: string; typeName: string; totalBalance: number; count: number }>,
      } as any;
    }

    return {
      familyProfile,
      currentAllocation,
      portfolioOverview: { totalAssets, totalCash, totalInvestmentValue, totalCashAssets, totalOtherAssets },
      regionAllocation,
      currentTargets,
      liabilityOverview,
      groupsSubCategories: undefined,
      equityByRegion: undefined,
    };
  }

  /**
   * 计算配置健康度评分
   */
  private static calculateOverallScore(
    analysis: AllocationAnalysisItem[],
    alerts: AllocationAlert[]
  ): number {
    let score = 100;
    
    // 根据偏离程度扣分
    for (const item of analysis) {
      const absDeviation = Math.abs(item.deviation);
      if (item.deviationStatus === 'CRITICAL') {
        score -= 15;
      } else if (item.deviationStatus === 'WARNING') {
        score -= 5;
      } else if (absDeviation > 2) {
        score -= 2;
      }
    }
    
    // 根据告警扣分
    for (const alert of alerts) {
      if (alert.severity === 'HIGH' && alert.type === 'CONCENTRATION_RISK') {
        score -= 10;
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 计算评分维度细分
   * - 偏离度得分（满分40）：配置与目标的偏离程度
   * - 多样性得分（满分20）：资产分散程度
   * - 流动性得分（满分20）：现金覆盖能力
   * - 负债健康得分（满分20）：负债水平健康度
   */
  private static calculateScoreBreakdown(
    analysis: AllocationAnalysisItem[],
    liabilityInfo: AllocationAnalysis['liabilityInfo'],
    keyMetrics: AllocationAnalysis['keyMetrics'],
    familyProfile: FamilyProfile | null
  ): NonNullable<AllocationAnalysis['scoreBreakdown']> {
    // 1. 偏离度得分（满分40）
    let deviationScore = 40;
    for (const item of analysis) {
      const absDeviation = Math.abs(item.deviation);
      if (item.deviationStatus === 'CRITICAL') {
        deviationScore -= 10;
      } else if (item.deviationStatus === 'WARNING') {
        deviationScore -= 4;
      } else if (absDeviation > 2) {
        deviationScore -= 1;
      }
    }
    deviationScore = Math.max(0, deviationScore);
    
    // 2. 多样性得分（满分20）
    // 基于资产多样性指数
    let diversityScore = 20;
    const diversityIndex = keyMetrics?.diversityIndex || 0;
    if (diversityIndex < 30) {
      diversityScore = 5;  // 高度集中
    } else if (diversityIndex < 50) {
      diversityScore = 10;  // 中度集中
    } else if (diversityIndex < 70) {
      diversityScore = 15;  // 轻度分散
    }
    // diversityIndex >= 70 时满分20
    
    // 3. 流动性得分（满分20）
    let liquidityScore = 20;
    const liquidityMonths = keyMetrics?.liquidityMonths || 0;
    const targetMonths = familyProfile?.emergencyFundMonths || 6;
    
    if (liquidityMonths < targetMonths * 0.3) {
      liquidityScore = 5;  // 严重不足
    } else if (liquidityMonths < targetMonths * 0.5) {
      liquidityScore = 10;  // 不足
    } else if (liquidityMonths < targetMonths) {
      liquidityScore = 15;  // 略低
    }
    // liquidityMonths >= targetMonths 时满分20
    
    // 4. 负债健康得分（满分20）
    let debtScore = 20;
    if (liabilityInfo) {
      const { liabilityRatio, dti, debtHealthStatus } = liabilityInfo;
      
      // 根据负债率扣分
      if (debtHealthStatus === 'CRITICAL') {
        debtScore -= 15;
      } else if (debtHealthStatus === 'WARNING') {
        debtScore -= 8;
      } else if (liabilityRatio > 20) {
        debtScore -= 3;
      }
      
      // 根据DTI扣分
      if (dti !== undefined) {
        if (dti > 70) {
          debtScore -= 5;
        } else if (dti > 50) {
          debtScore -= 3;
        } else if (dti > 40) {
          debtScore -= 1;
        }
      }
      
      debtScore = Math.max(0, debtScore);
    }
    
    return {
      deviationScore: Math.round(deviationScore),
      diversityScore: Math.round(diversityScore),
      liquidityScore: Math.round(liquidityScore),
      debtScore: Math.round(debtScore),
    };
  }

  /**
   * 根据 userId 查找其所属家庭的 familyId
   * 用于内部调用的桥接方法
   */
  private static async getUserFamilyId(userId: string): Promise<string | null> {
    const member = await prisma.familyMember.findUnique({
      where: { userId },
      select: { familyId: true },
    });
    return member?.familyId || null;
  }

  /**
   * 获取家庭财务概况
   * 
   * Phase 4 迁移：FamilyFinancialProfile 已从 userId 迁移到 familyId 维度
   * 此方法保持 userId 入参以兼容内部调用，内部自动桥接到 familyId
   */
  static async getFamilyProfile(userId: string): Promise<FamilyProfile | null> {
    const familyId = await this.getUserFamilyId(userId);
    if (!familyId) return null;

    return this.getFamilyProfileByFamilyId(familyId);
  }

  /**
   * 直接通过 familyId 获取家庭财务概况
   */
  static async getFamilyProfileByFamilyId(familyId: string): Promise<FamilyProfile | null> {
    const profile = await prisma.familyFinancialProfile.findUnique({
      where: { familyId },
    });
    
    if (!profile) return null;
    
    return {
      id: profile.id,
      householdMembers: profile.householdMembers,
      primaryEarnerAge: profile.primaryEarnerAge || undefined,
      childrenCount: profile.childrenCount || 0,
      elderlyCount: profile.elderlyCount || 0,
      monthlyIncome: profile.monthlyIncome ? Number(profile.monthlyIncome) : undefined,
      incomeStability: profile.incomeStability || undefined,
      monthlyExpenses: profile.monthlyExpenses ? Number(profile.monthlyExpenses) : undefined,
      emergencyFundMonths: profile.emergencyFundMonths,
      riskTolerance: profile.riskTolerance,
      investmentHorizon: profile.investmentHorizon,
      retirementAge: profile.retirementAge || undefined,
      majorGoals: profile.majorGoals as FamilyProfile['majorGoals'],
      financialGoals: profile.financialGoals as FamilyProfile['financialGoals'],
      hasHomeLoan: profile.hasHomeLoan,
      homeLoanMonthlyPayment: profile.homeLoanMonthlyPayment ? Number(profile.homeLoanMonthlyPayment) : undefined,
      hasCarLoan: profile.hasCarLoan,
      hasOtherLoans: profile.hasOtherLoans,
      hasLifeInsurance: profile.hasLifeInsurance,
      hasHealthInsurance: profile.hasHealthInsurance,
      hasCriticalIllnessInsurance: profile.hasCriticalIllnessInsurance,
    };
  }

  /**
   * 更新家庭财务概况
   * 
   * Phase 4 迁移：此方法保持 userId 入参以兼容内部调用
   */
  static async updateFamilyProfile(
    userId: string,
    data: Partial<Omit<FamilyProfile, 'id'>>
  ): Promise<FamilyProfile> {
    const familyId = await this.getUserFamilyId(userId);
    if (!familyId) {
      throw new Error('用户未加入家庭，无法更新家庭概况');
    }
    return this.updateFamilyProfileByFamilyId(familyId, data);
  }

  /**
   * 直接通过 familyId 更新家庭财务概况
   */
  static async updateFamilyProfileByFamilyId(
    familyId: string,
    data: Partial<Omit<FamilyProfile, 'id'>>
  ): Promise<FamilyProfile> {
    logger.debug('更新家庭概况', { familyId });
    
    try {
      const profile = await prisma.familyFinancialProfile.upsert({
        where: { familyId },
        update: data as any,
        create: {
          familyId,
          ...data,
        } as any,
      });
      logger.debug('家庭概况更新成功', { profileId: profile.id });
      
      return this.getFamilyProfileByFamilyId(familyId) as Promise<FamilyProfile>;
    } catch (error) {
      logger.error('家庭概况更新失败', error);
      throw error;
    }
  }

  /**
   * 生成 AI 建议的输入数据
   * 
   * ⚠️ 2026-02-01更新：添加实际负债数据，与负债管理模块保持一致
   * ⚠️ 2026-02-01更新：添加二级分类数据和净资产数据，完善AI提示词
   * ⚠️ 2026-02-01更新：添加权益类按地区细分数据（equityByRegion）
   */
  static async prepareAIAdviceInput(userId: string): Promise<{
    familyProfile: FamilyProfile | null;
    currentAllocation: Awaited<ReturnType<typeof PortfolioService.getPortfolioByOverviewGroup>>;
    portfolioOverview: Awaited<ReturnType<typeof PortfolioService.calculatePortfolioOverview>>;
    regionAllocation: Awaited<ReturnType<typeof PortfolioService.getPortfolioByRegion>>;
    currentTargets: AllocationTarget[];
    liabilityOverview: Awaited<ReturnType<typeof LiabilityService.calculateLiabilityOverview>>;
    groupsSubCategories: Awaited<ReturnType<typeof PortfolioService.getAllGroupsSubCategories>>;
    equityByRegion: Awaited<ReturnType<typeof PortfolioService.getEquityByRegion>>;
  }> {
    const [familyProfile, currentAllocation, portfolioOverview, regionAllocation, currentTargets, liabilityOverview, groupsSubCategories, equityByRegion] = 
      await Promise.all([
        this.getFamilyProfile(userId),
        PortfolioService.getPortfolioByOverviewGroup(userId),  // ⚠️ 改用与首页一致的分组
        PortfolioService.calculatePortfolioOverview(userId),
        PortfolioService.getPortfolioByRegion(userId),
        this.getAllocationTargets(userId),
        LiabilityService.calculateLiabilityOverview(userId),  // ✨ 添加实际负债数据
        PortfolioService.getAllGroupsSubCategories(userId),   // ✨ 添加二级分类数据
        PortfolioService.getEquityByRegion(userId),           // ✨ 添加权益类按地区细分
      ]);
    
    return {
      familyProfile,
      currentAllocation,
      portfolioOverview,
      regionAllocation,
      currentTargets,
      liabilityOverview,
      groupsSubCategories,
      equityByRegion,
    };
  }

  /**
   * 保存 AI 建议
   */
  static async saveAIAdvice(
    userId: string,
    advice: {
      summary: string;
      confidence: number;
      advice: object;
      marketContext?: object;
      familyContext?: object;
      portfolioSnapshot?: object;
      expiresInDays?: number;
      scope?: 'personal' | 'family';
      modelUsed?: string;
    }
  ): Promise<string> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (advice.expiresInDays || 30));
    
    // 只有家庭视角的建议才存 familyId，个人建议不存
    const familyId = advice.scope === 'family' 
      ? (await this.getUserFamilyId(userId) || undefined)
      : undefined;
    
    const record = await prisma.allocationAdvice.create({
      data: {
        userId,
        familyId,
        summary: advice.summary,
        confidence: advice.confidence,
        advice: advice.advice,
        marketContext: advice.marketContext as any || undefined,
        familyContext: advice.familyContext as any || undefined,
        portfolioSnapshot: advice.portfolioSnapshot as any || undefined,
        modelUsed: advice.modelUsed || undefined,
        expiresAt,
      },
    });
    
    return record.id;
  }

  /**
   * 创建 PROCESSING 状态的占位记录（异步模式用）
   */
  static async createProcessingAdvice(
    userId: string,
    scope: 'personal' | 'family',
    modelUsed?: string,
    portfolioSnapshot?: object,
  ): Promise<string> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const familyId = scope === 'family' 
      ? (await this.getUserFamilyId(userId) || undefined)
      : undefined;
    
    const record = await prisma.allocationAdvice.create({
      data: {
        userId,
        familyId,
        summary: 'AI 正在深度分析中...',
        confidence: 0,
        advice: {},
        portfolioSnapshot: portfolioSnapshot as any || undefined,
        modelUsed: modelUsed || undefined,
        status: 'PROCESSING',
        expiresAt,
      },
    });
    
    return record.id;
  }

  /**
   * 更新异步分析完成后的记录
   */
  static async updateAdviceResult(
    adviceId: string,
    result: {
      summary: string;
      confidence: number;
      advice: object;
      status: 'PENDING' | 'ERROR';
      modelUsed?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    await prisma.allocationAdvice.update({
      where: { id: adviceId },
      data: {
        summary: result.summary,
        confidence: result.confidence,
        advice: result.advice as any,
        status: result.status,
        modelUsed: result.modelUsed || undefined,
        errorMessage: result.errorMessage || undefined,
      },
    });
  }

  /**
   * 查询单条建议的状态（轮询用）
   */
  static async getAdviceStatus(adviceId: string, userId: string): Promise<{
    id: string;
    status: string;
    summary: string;
    confidence: number;
    modelUsed: string | null;
    errorMessage: string | null;
    createdAt: Date;
    advice?: any;
  } | null> {
    return prisma.allocationAdvice.findFirst({
      where: { id: adviceId, userId },
      select: {
        id: true,
        status: true,
        summary: true,
        confidence: true,
        modelUsed: true,
        errorMessage: true,
        createdAt: true,
        advice: true,
      },
    });
  }

  /**
   * 获取最新的 AI 建议（个人）
   * 查询该用户创建的个人级别建议（familyId 为空），
   * 如果没有，也查询该用户创建的所有建议（兼容历史数据）
   */
  static async getLatestAdvice(userId: string): Promise<{
    id: string;
    summary: string;
    confidence: number;
    advice: object;
    status: string;
    createdAt: string;
    expiresAt: string;
  } | null> {
    // 优先查个人级别建议
    let advice = await prisma.allocationAdvice.findFirst({
      where: { 
        userId,
        familyId: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // 兼容历史数据：如果没有个人建议，查该用户创建的最新建议
    if (!advice) {
      advice = await prisma.allocationAdvice.findFirst({
        where: { 
          userId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    
    if (!advice) return null;
    
    return {
      id: advice.id,
      summary: advice.summary,
      confidence: Number(advice.confidence),
      advice: advice.advice as object,
      status: advice.status,
      createdAt: advice.createdAt.toISOString(),
      expiresAt: advice.expiresAt.toISOString(),
    };
  }

  /**
   * 获取最新的家庭级 AI 建议
   * 按 familyId 查询，所有家庭成员共享可见
   */
  static async getLatestAdviceForFamily(familyId: string): Promise<{
    id: string;
    summary: string;
    confidence: number;
    advice: object;
    status: string;
    createdAt: string;
    expiresAt: string;
  } | null> {
    const advice = await prisma.allocationAdvice.findFirst({
      where: { 
        familyId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!advice) return null;
    
    return {
      id: advice.id,
      summary: advice.summary,
      confidence: Number(advice.confidence),
      advice: advice.advice as object,
      status: advice.status,
      createdAt: advice.createdAt.toISOString(),
      expiresAt: advice.expiresAt.toISOString(),
    };
  }

  /**
   * 更新 AI 建议的反馈
   */
  static async updateAdviceFeedback(
    adviceId: string,
    feedback: {
      status: 'ACCEPTED' | 'REJECTED' | 'PARTIAL';
      userFeedback?: string;
    }
  ): Promise<void> {
    await prisma.allocationAdvice.update({
      where: { id: adviceId },
      data: {
        status: feedback.status,
        userFeedback: feedback.userFeedback,
        appliedAt: feedback.status === 'ACCEPTED' || feedback.status === 'PARTIAL' 
          ? new Date() 
          : undefined,
      },
    });
  }

  /**
   * 获取历史 AI 建议（个人）
   * 查询该用户创建的个人级别建议，兼容历史数据
   */
  static async getAdviceHistory(
    userId: string,
    limit: number = 10
  ): Promise<Array<{
    id: string;
    summary: string;
    status: string;
    createdAt: string;
  }>> {
    const advices = await prisma.allocationAdvice.findMany({
      where: { userId, familyId: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        summary: true,
        status: true,
        createdAt: true,
      },
    });
    
    // 兼容历史数据：如果没有个人建议，查该用户创建的所有建议
    if (advices.length === 0) {
      const allAdvices = await prisma.allocationAdvice.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          summary: true,
          status: true,
          createdAt: true,
        },
      });
      return allAdvices.map(a => ({
        id: a.id,
        summary: a.summary,
        status: a.status,
        createdAt: a.createdAt.toISOString(),
      }));
    }
    
    return advices.map(a => ({
      id: a.id,
      summary: a.summary,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  /**
   * 获取家庭级 AI 建议历史
   * 按 familyId 查询，所有家庭成员共享可见
   */
  static async getAdviceHistoryForFamily(
    familyId: string,
    limit: number = 10
  ): Promise<Array<{
    id: string;
    summary: string;
    status: string;
    createdAt: string;
  }>> {
    const advices = await prisma.allocationAdvice.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        summary: true,
        status: true,
        createdAt: true,
      },
    });
    
    return advices.map(a => ({
      id: a.id,
      summary: a.summary,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    }));
  }
}
