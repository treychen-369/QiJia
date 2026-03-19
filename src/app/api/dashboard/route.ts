import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PortfolioService } from '@/lib/services/portfolio-service';
import { LiabilityService } from '@/lib/services/liability-service';
import { AllocationService } from '@/lib/services/allocation-service';

export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const userId = session.user.id;

    // =====================================================
    // ✅ Phase 2: 统一使用服务层计算所有数据
    // =====================================================

    // 1. 获取投资组合概览
    const overview = await PortfolioService.calculatePortfolioOverview(userId);

    // 2. 获取账户摘要
    const accountsSummary = await PortfolioService.getAccountsSummary(userId);

    // 3. 获取投资组合分布
    const portfolioByAccount = await PortfolioService.getPortfolioByAccount(userId);
    const portfolioByRegion = await PortfolioService.getPortfolioByRegion(userId);
    const portfolioByCategory = await PortfolioService.getPortfolioByCategory(userId);
    const portfolioByAssetType = await PortfolioService.getPortfolioByAssetType(userId);
    
    // ✨ Phase 2: 按底层敞口分布（新增）
    const portfolioByUnderlyingType = await PortfolioService.getPortfolioByUnderlyingType(userId);
    const portfolioByOverviewGroup = await PortfolioService.getPortfolioByOverviewGroup(userId);
    
    // ✨ Phase 2.1: 权益类按地区细分（新增）
    const equityByRegion = await PortfolioService.getEquityByRegion(userId);
    
    // ✨ Phase 2.2: 各资产分组的二级分类细分（新增）
    const allGroupsSubCategories = await PortfolioService.getAllGroupsSubCategories(userId);

    // 4. 获取负债概览
    const liabilityOverview = await LiabilityService.calculateLiabilityOverview(userId);
    const totalLiabilities = liabilityOverview.totalLiabilities;
    
    // 计算净资产 = 总资产 - 总负债
    const netWorth = overview.totalAssets - totalLiabilities;

    console.log('💰 [Dashboard API] 净资产计算:', {
      totalAssets: overview.totalAssets.toFixed(2),
      totalLiabilities: totalLiabilities.toFixed(2),
      netWorth: netWorth.toFixed(2)
    });

    // =====================================================
    // ✅ Phase 2 侧边栏优化: 获取配置分析数据（可选字段）
    // =====================================================
    let allocationData = null;
    try {
      const analysis = await AllocationService.getAnalysis(userId);
      
      // 提取主要偏离项（偏离度>2%）
      const topDeviations = analysis.analysis
        .filter(a => Math.abs(a.deviation) > 2)
        .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
        .slice(0, 3)
        .map(a => ({
          categoryCode: a.categoryCode,
          categoryName: a.categoryName,
          currentPercent: a.currentPercent,
          targetPercent: a.targetPercent,
          deviation: a.deviation,
          deviationStatus: a.deviationStatus,
        }));
      
      // 获取最近一条AI建议（包含完整 advice 字段用于显示二级资产建议）
      let latestAdvice = null;
      try {
        const adviceHistory = await prisma.allocationAdvice.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            summary: true,
            status: true,
            createdAt: true,
            confidence: true,
            advice: true,  // ✨ 新增：返回完整建议内容（包含 actions, fullAnalysis）
          }
        });
        if (adviceHistory) {
          // 解析 advice JSON 字段
          const adviceData = adviceHistory.advice as {
            actions?: Array<{
              priority: number;
              category: string;
              categoryName: string;
              action: 'BUY' | 'SELL' | 'HOLD';
              amount?: number;
              reason: string;
              subCategory?: string;
              suggestedProducts?: string[];
            }>;
            fullAnalysis?: string;
            targets?: Array<{
              categoryCode: string;
              categoryName: string;
              currentPercent: number;
              suggestedPercent: number;
              reason: string;
            }>;
            risks?: string[];
          } | null;
          
          latestAdvice = {
            id: adviceHistory.id,
            summary: adviceHistory.summary,
            status: adviceHistory.status,
            confidence: adviceHistory.confidence,
            createdAt: adviceHistory.createdAt.toISOString(),
            // ✨ 新增：返回 actions 用于显示二级资产建议
            actions: adviceData?.actions || [],
            // ✨ 新增：返回 fullAnalysis 用于显示详细分析报告
            fullAnalysis: adviceData?.fullAnalysis || '',
            targets: adviceData?.targets || [],
            risks: adviceData?.risks || [],
          };
        }
      } catch (adviceError) {
        console.error('获取最近AI建议失败（非致命）:', adviceError);
      }
      
      allocationData = {
        overallScore: analysis.overallScore,
        topDeviations,
        liabilityInfo: analysis.liabilityInfo ? {
          totalLiabilities: analysis.liabilityInfo.totalLiabilities,
          liabilityRatio: analysis.liabilityInfo.liabilityRatio,
          dti: analysis.liabilityInfo.dti,
          monthlyPayment: analysis.liabilityInfo.monthlyPayment,
          debtHealthStatus: analysis.liabilityInfo.debtHealthStatus,
          // ✨ 新增：完整负债数据，用于AI建议
          liabilityCount: analysis.liabilityInfo.liabilityCount,
          averageInterestRate: analysis.liabilityInfo.averageInterestRate,
          byType: analysis.liabilityInfo.byType || [],
        } : null,
        scoreBreakdown: analysis.scoreBreakdown,
        keyMetrics: analysis.keyMetrics,
        latestAdvice,
        // 完整分析数据（用于主页配置分析区）
        fullAnalysis: analysis.analysis,
        alerts: analysis.alerts,
      };
      
      console.log('📊 [Dashboard API] 配置分析数据已加载:', {
        score: allocationData.overallScore,
        deviationsCount: topDeviations.length,
        hasLiabilityInfo: !!allocationData.liabilityInfo,
        hasLatestAdvice: !!latestAdvice,
      });
    } catch (allocationError) {
      console.error('获取配置分析数据失败（非致命）:', allocationError);
      // allocationData 保持 null，不影响主流程
    }

    // 5. ✅ Phase 2: 使用服务层方法获取持仓（消除重复计算）
    const allHoldings = await PortfolioService.getHoldingsWithCalculations(userId);

    // 前10大持仓（用于概览卡片）
    const topHoldings = allHoldings.slice(0, 10);

    // 5.1 全量资产 Top 5（证券按标的合并 + 非证券资产）
    const topAssets = await PortfolioService.getTopAssets(userId, 5);

    // 6. 获取投资计划（最近5条）
    const investmentPlans = await prisma.investmentPlan.findMany({
      where: { userId },
      orderBy: { planDate: 'desc' },
      take: 5,
    });

    const investmentPlansData = investmentPlans.map((plan) => ({
      id: plan.id,
      date: plan.planDate,
      totalValue: plan.totalPortfolioValue,
      investmentRatio: plan.investmentRatio,
      plannedAmount: plan.plannedInvestmentAmount,
      cashReserve: plan.cashReserve,
    }));

    // =====================================================
    // 构建响应数据
    // =====================================================

    const dashboardData = {
      // 资产概览
      overview: {
        totalAssets: overview.totalAssets,
        totalCash: overview.totalCash,
        totalInvestmentValue: overview.totalInvestmentValue,
        totalCashAssets: overview.totalCashAssets,
        totalOtherAssets: overview.totalOtherAssets,
        // 全量资产收益
        totalUnrealizedPnl: overview.totalUnrealizedPnl,
        totalUnrealizedPnlPercent: overview.totalUnrealizedPnlPercent,
        securitiesUnrealizedPnl: overview.securitiesUnrealizedPnl,
        securitiesUnrealizedPnlPercent: overview.securitiesUnrealizedPnlPercent,
        cashAssetsUnrealizedPnl: overview.cashAssetsUnrealizedPnl,
        todayPnl: overview.todayPnl,
        todayPnlPercent: overview.todayPnlPercent,
        accountCount: overview.accountCount,
        holdingCount: overview.holdingCount,
        calculatedAt: overview.calculatedAt,
        // 净资产和负债
        totalLiabilities: totalLiabilities,
        netWorth: netWorth,
      },

      // 账户余额列表（包含现金余额详情）
      accounts: accountsSummary.map((account) => ({
        id: account.id,
        name: account.name,
        broker: account.broker,
        currency: account.currency,
        // 持仓相关
        holdingsValue: account.holdingsValue,
        holdingsValueOriginal: account.holdingsValueOriginal,
        holdingCount: account.holdingCount,
        // 现金相关
        cashBalance: account.cashBalance,
        cashBalanceOriginal: account.cashBalanceOriginal,
        cashLastUpdated: account.cashLastUpdated,
        // 总计
        totalValue: account.totalValue,
        totalValueOriginal: account.totalValueOriginal,
        investableAmount: account.cashBalance,
        exchangeRate: account.exchangeRate,
        lastUpdated: account.lastUpdated,
      })),

      // 投资组合分布
      portfolio: {
        byRegion: portfolioByRegion,
        byCategory: portfolioByCategory,
      },

      // 持仓列表
      topHoldings,
      allHoldings,

      // 全量资产 Top 5（证券按标的合并 + 非证券资产）
      topAssets,

      // 投资计划
      investmentPlans: investmentPlansData,

      // 双视角投资组合数据
      dualViewPortfolio: {
        byAccount: portfolioByAccount,
        byAssetType: portfolioByAssetType,
      },
      
      // ✨ Phase 2: 底层敞口分布（新增）
      // - byUnderlyingType: 细分的底层敞口（EQUITY, BOND, GOLD, CASH等）
      // - byOverviewGroup: 聚合的概览分组（权益类、固定收益、现金等）
      // - equityByRegion: 权益类按地区细分（中国、美国、日本等）
      // - groupsSubCategories: 各资产分组的二级分类细分
      underlyingTypePortfolio: {
        byUnderlyingType: portfolioByUnderlyingType,
        byOverviewGroup: portfolioByOverviewGroup,
        equityByRegion: equityByRegion,
        groupsSubCategories: allGroupsSubCategories,
      },
      
      // ✅ Phase 2 侧边栏优化: 配置分析数据（新增）
      // 用于侧边栏和主页配置分析区
      allocationData,
    };

    return NextResponse.json(dashboardData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('获取仪表板数据失败:', error);
    return NextResponse.json(
      {
        error: '获取仪表板数据失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
