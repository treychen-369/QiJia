/**
 * 家庭投资组合历史数据API
 * 
 * GET /api/family/history?days=30
 * - 获取家庭所有成员聚合的历史趋势
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FamilyService } from '@/lib/services/family-service';
import { SnapshotService, HistoricalTrend } from '@/lib/services/snapshot-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 优先使用 JWT 中的 familyId，若为空则从数据库实时查询（防止 JWT 缓存过期）
    let familyId = session.user.familyId;
    if (!familyId) {
      const { prisma } = await import('@/lib/prisma');
      const membership = await prisma.familyMember.findUnique({
        where: { userId: session.user.id },
        select: { familyId: true },
      });
      familyId = membership?.familyId;
    }
    if (!familyId) {
      return NextResponse.json({ error: '用户未加入家庭' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30', 10);

    // 获取家庭成员
    const members = await FamilyService.getMembers(familyId);
    if (!members || members.length === 0) {
      return NextResponse.json({
        success: true,
        data: { trend: [], metrics: null, summary: { dataPoints: 0 } },
      });
    }

    // 并行获取所有成员的历史数据
    const memberTrends: HistoricalTrend[][] = await Promise.all(
      members.map(async (member): Promise<HistoricalTrend[]> => {
        try {
          const result = await SnapshotService.getRecentTrend(member.userId, days);
          return result;
        } catch (err) {
          console.error(`[Family History] member ${member.userId} trend failed:`, err);
          return [];
        }
      })
    );

    // 按日期聚合所有成员的数据
    const dateMap = new Map<string, {
      totalValue: number;
      totalAssets: number;
      totalLiabilities: number;
      netWorth: number;
      cashBalance: number;
      investedValue: number;
      unrealizedPnl: number;
      equityAssets: number;
      fixedIncomeAssets: number;
      cashEquivalents: number;
      realEstateAssets: number;
      alternativeAssets: number;
      receivableAssets: number;
    }>();

    for (const trends of memberTrends) {
      for (const point of trends) {
        const dateKey = new Date(point.date).toISOString().split('T')[0];
        
        const existing = dateMap.get(dateKey) || {
          totalValue: 0,
          totalAssets: 0,
          totalLiabilities: 0,
          netWorth: 0,
          cashBalance: 0,
          investedValue: 0,
          unrealizedPnl: 0,
          equityAssets: 0,
          fixedIncomeAssets: 0,
          cashEquivalents: 0,
          realEstateAssets: 0,
          alternativeAssets: 0,
          receivableAssets: 0,
        };

        existing.totalValue += Number(point.totalValue || 0);
        existing.totalAssets += Number((point as any).totalAssets || point.totalValue || 0);
        existing.totalLiabilities += Number((point as any).totalLiabilities || 0);
        existing.netWorth += Number((point as any).netWorth || point.totalValue || 0);
        existing.cashBalance += Number(point.cashBalance || 0);
        existing.investedValue += Number(point.investedValue || 0);
        existing.unrealizedPnl += Number(point.unrealizedPnl || 0);
        existing.equityAssets += Number((point as any).equityAssets || 0);
        existing.fixedIncomeAssets += Number((point as any).fixedIncomeAssets || 0);
        existing.cashEquivalents += Number((point as any).cashEquivalents || 0);
        existing.realEstateAssets += Number((point as any).realEstateAssets || 0);
        existing.alternativeAssets += Number((point as any).alternativeAssets || 0);
        existing.receivableAssets += Number((point as any).receivableAssets || 0);

        dateMap.set(dateKey, existing);
      }
    }

    // 排序并构建趋势数据
    const trend = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        totalAssets: data.totalAssets,
        totalValue: data.totalValue,
        netWorth: data.netWorth,
        totalLiabilities: data.totalLiabilities,
        equityAssets: data.equityAssets,
        fixedIncomeAssets: data.fixedIncomeAssets,
        cashEquivalents: data.cashEquivalents,
        realEstateAssets: data.realEstateAssets,
        alternativeAssets: data.alternativeAssets,
        receivableAssets: data.receivableAssets,
      }));

    const firstItem = trend[0];
    const lastItem = trend[trend.length - 1];

    return NextResponse.json({
      success: true,
      data: {
        trend,
        metrics: null,
        summary: {
          dataPoints: trend.length,
          startDate: firstItem?.date ?? null,
          endDate: lastItem?.date ?? null,
          startValue: firstItem?.totalValue ?? 0,
          endValue: lastItem?.totalValue ?? 0,
        },
      },
    });
  } catch (error) {
    console.error('获取家庭历史数据失败:', error);
    return NextResponse.json(
      { error: '获取家庭历史数据失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
