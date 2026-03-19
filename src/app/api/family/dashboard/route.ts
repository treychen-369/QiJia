import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FamilyService } from '@/lib/services/family-service';
import { PortfolioService } from '@/lib/services/portfolio-service';
import { AssetCalculationService } from '@/lib/services/asset-calculation-service';
import { LiabilityService } from '@/lib/services/liability-service';
import { AllocationService } from '@/lib/services/allocation-service';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/family/dashboard
 * 获取家庭视角的仪表板数据（聚合所有成员的持仓、资产、负债）
 * 每个资产/持仓条目会附加成员名称用于区分
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const userFamily = await FamilyService.getUserFamily(session.user.id);
    if (!userFamily) {
      return NextResponse.json({ error: '未加入家庭' }, { status: 404 });
    }

    const familyId = userFamily.family.id;
    await FamilyService.checkPermission(session.user.id, familyId, 'VIEW_FAMILY');

    // 获取所有家庭成员
    const members = await prisma.familyMember.findMany({
      where: { familyId },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // 并行获取所有成员的持仓、资产、负债和账户摘要数据
    const memberResults = await Promise.all(
      members.map(async (member) => {
        const [holdings, rawAssets, liabilities, accounts] = await Promise.all([
          PortfolioService.getHoldingsWithCalculations(member.userId).catch(() => []),
          prisma.asset.findMany({
            where: { userId: member.userId },
            include: {
              assetCategory: {
                include: { parent: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          }).catch(() => []),
          LiabilityService.getUserLiabilities(member.userId).catch(() => []),
          PortfolioService.getAccountsSummary(member.userId).catch(() => []),
        ]);

        // 使用 AssetCalculationService 进行实时计算（汇率、盈亏、不动产指标等）
        const assets = await AssetCalculationService.calculateAssets(rawAssets);

        return {
          userId: member.userId,
          userName: member.user.name,
          role: member.role,
          holdings,
          assets,
          liabilities,
          accounts,
        };
      })
    );

    // 合并所有成员的持仓数据，每条加上成员名称
    const allFamilyHoldings = memberResults.flatMap((m) => {
      // 证券持仓
      const holdingItems = m.holdings.map((h: any) => ({
        ...h,
        ownerName: m.userName,
        ownerId: m.userId,
        accountName: m.holdings.length > 0 
          ? `${h.accountName || ''}（${m.userName}）`
          : h.accountName,
      }));

      // 账户现金余额（构造 type: 'cash' 的虚拟持仓项，与个人视图一致）
      const cashItems = m.accounts
        .filter((account: any) => Number(account.cashBalanceOriginal) > 0)
        .map((account: any) => ({
          id: `cash-${account.id}`,
          type: 'cash' as const,
          symbol: 'CASH',
          name: `可用现金 - ${account.broker}`,
          accountId: account.id,
          accountName: `${account.name}（${m.userName}）`,
          broker: account.broker,
          quantity: 1,
          currentPrice: Number(account.cashBalanceOriginal),
          costBasis: Number(account.cashBalanceOriginal),
          marketValue: Number(account.cashBalance),
          marketValueOriginal: Number(account.cashBalanceOriginal),
          unrealizedPnL: 0,
          unrealizedPnLPercent: 0,
          dayChange: 0,
          dayChangePercent: 0,
          sector: '现金',
          region: account.currency === 'USD' ? '美国' : account.currency === 'HKD' ? '香港' : '中国',
          currency: account.currency,
          exchangeRate: account.exchangeRate || 1,
          lastUpdated: account.lastUpdated ? new Date(account.lastUpdated).toISOString() : new Date().toISOString(),
          percentage: 0,
          ownerName: m.userName,
          ownerId: m.userId,
        }));

      return [...holdingItems, ...cashItems];
    });

    // 合并所有成员的资产数据（已计算），每条加上成员名称以区分
    const allFamilyAssets = memberResults.flatMap((m) =>
      m.assets.map((a: any) => ({
        ...a,
        ownerName: m.userName,
        ownerId: m.userId,
        name: members.length > 1 ? `${a.name}（${m.userName}）` : a.name,
      }))
    );

    // 合并所有成员的负债数据
    const allFamilyLiabilities = memberResults.flatMap((m) =>
      m.liabilities.map((l: any) => ({
        ...l,
        ownerName: m.userName,
        ownerId: m.userId,
        name: members.length > 1 ? `${l.name}（${m.userName}）` : l.name,
      }))
    );

    // 获取家庭级全量资产 Top 5（所有成员合并，按标的合并 + 非证券资产）
    const memberTopAssets = await Promise.all(
      members.map((member) =>
        PortfolioService.getTopAssets(member.userId, 20).catch(() => [])
      )
    );
    // 合并同名标的（家庭成员间可能持有同一标的）
    const familyAssetMap = new Map<string, { name: string; category: string; subtitle: string; marketValueCny: number; totalCostCny: number }>();
    for (const memberAssets of memberTopAssets) {
      for (const item of memberAssets) {
        const key = `${item.name}_${item.category}`;
        const existing = familyAssetMap.get(key);
        const costCny = item.unrealizedPnlPercent !== 0
          ? item.marketValueCny / (1 + item.unrealizedPnlPercent / 100)
          : item.marketValueCny;
        if (existing) {
          existing.marketValueCny += item.marketValueCny;
          existing.totalCostCny += costCny;
          if (item.subtitle && !existing.subtitle.includes(item.subtitle)) {
            existing.subtitle += ' + ' + item.subtitle;
          }
        } else {
          familyAssetMap.set(key, {
            name: item.name,
            category: item.category,
            subtitle: item.subtitle,
            marketValueCny: item.marketValueCny,
            totalCostCny: costCny,
          });
        }
      }
    }
    const familyTopAssets = [...familyAssetMap.values()]
      .map((item) => {
        const pnl = item.marketValueCny - item.totalCostCny;
        const pnlPercent = item.totalCostCny > 0 ? (pnl / item.totalCostCny) * 100 : 0;
        return {
          name: item.name,
          category: item.category,
          subtitle: item.subtitle,
          marketValueCny: item.marketValueCny,
          unrealizedPnlPercent: pnlPercent,
        };
      })
      .sort((a, b) => b.marketValueCny - a.marketValueCny)
      .slice(0, 5);

    // 获取家庭级配置分析数据
    let allocationData = null;
    try {
      const analysis = await AllocationService.getAnalysisForFamily(familyId, session.user.id);
      
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

      // 获取最近一条家庭级AI建议（按familyId查询，所有成员共享可见）
      let latestAdvice = null;
      try {
        const adviceHistory = await prisma.allocationAdvice.findFirst({
          where: { familyId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            summary: true,
            status: true,
            createdAt: true,
            confidence: true,
            advice: true,
          }
        });
        if (adviceHistory) {
          const adviceData = adviceHistory.advice as any;
          latestAdvice = {
            id: adviceHistory.id,
            summary: adviceHistory.summary,
            status: adviceHistory.status,
            confidence: adviceHistory.confidence,
            createdAt: adviceHistory.createdAt.toISOString(),
            actions: adviceData?.actions || [],
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
          liabilityCount: analysis.liabilityInfo.liabilityCount,
          averageInterestRate: analysis.liabilityInfo.averageInterestRate,
          byType: analysis.liabilityInfo.byType || [],
        } : null,
        scoreBreakdown: analysis.scoreBreakdown,
        keyMetrics: analysis.keyMetrics,
        latestAdvice,
        fullAnalysis: analysis.analysis,
        alerts: analysis.alerts,
      };
    } catch (allocationError) {
      console.error('获取家庭配置分析数据失败（非致命）:', allocationError);
    }

    return NextResponse.json({
      success: true,
      holdings: allFamilyHoldings,
      assets: allFamilyAssets,
      liabilities: allFamilyLiabilities,
      topAssets: familyTopAssets,
      memberCount: members.length,
      allocationData,
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: '获取家庭仪表板数据失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
