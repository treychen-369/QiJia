'use client'

import { useMemo } from 'react'
import { useDashboardV2 } from '@/app/dashboard-v2/layout'
import { StatCards } from './overview/stat-cards'
import { AIInsight } from './overview/ai-insight'
import { AssetComposition, type CompositionItem } from './overview/asset-composition'
import { RightPanel } from './overview/right-panel'
import { FamilyMembersSection } from './overview/family-members'
import { formatCurrency } from './use-dashboard-v2-data'
import { useViewConfig, useViewData } from './use-view-config'

// ─── Component ───

export function OverviewTab() {
  const { amountVisible, setAmountVisible, familyMembers, selectedMemberId } = useDashboardV2()
  const { isFamily, features } = useViewConfig()
  const { holdings, underlyingTypePortfolio, topAssets } = useViewData()
  const visible = amountVisible

  // compositionData：由 useViewData 统一获取 underlyingTypePortfolio
  const compositionData: CompositionItem[] = useMemo(() => {
    const groups = underlyingTypePortfolio?.byOverviewGroup || []
    return groups
      .filter((g: any) => g.value > 0)
      .sort((a: any, b: any) => b.value - a.value)
      .map((g: any) => ({
        label: g.name,
        value: formatCurrency(g.value),
        rawValue: g.value,
        pct: g.percentage,
        color: g.color || '#94A3B8',
        code: g.code,
      }))
  }, [underlyingTypePortfolio?.byOverviewGroup])

  // 构建 categoryAssets：二级分组结构
  // - EQUITY: 按地区分组 (equityByRegion.byRegion[])
  // - 其他分组: 按二级分类分组 (groupsSubCategories[code].bySubCategory[])
  interface SubGroupItem { name: string; value: number; formattedValue: string; change: string; positive: boolean }
  interface SubGroup { name: string; color: string; value: number; formattedValue: string; percentage: number; count: number; items: SubGroupItem[] }

  const categorySubGroups: Record<string, SubGroup[]> = useMemo(() => {
    const result: Record<string, SubGroup[]> = {}
    const equityByRegion = underlyingTypePortfolio?.equityByRegion
    const groupsSub = underlyingTypePortfolio?.groupsSubCategories

    for (const comp of compositionData) {
      const subGroups: SubGroup[] = []
      const groupCode = comp.code

      // 权益类：按地区分组
      if (groupCode === 'EQUITY' && equityByRegion?.byRegion) {
        const regions = [...equityByRegion.byRegion].sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
        for (const region of regions) {
          const holdings = (region.holdings || [])
            .sort((a: any, b: any) => (b.marketValue || 0) - (a.marketValue || 0))
          subGroups.push({
            name: region.regionName || region.name || '',
            color: region.color || comp.color,
            value: region.value || 0,
            formattedValue: formatCurrency(region.value || 0),
            percentage: region.percentage || 0,
            count: region.count || holdings.length,
            items: holdings.map((h: any) => ({
              name: h.name,
              value: h.marketValue || 0,
              formattedValue: formatCurrency(h.marketValue || 0),
              change: `${(h.unrealizedPnLPercent ?? 0) >= 0 ? '+' : ''}${(h.unrealizedPnLPercent ?? 0).toFixed(1)}%`,
              positive: (h.unrealizedPnLPercent ?? 0) >= 0,
            })),
          })
        }
      }
      // 其他分组：按二级分类分组
      else if (groupsSub && groupCode && groupsSub[groupCode]) {
        const subCats = [...(groupsSub[groupCode].bySubCategory || [])]
          .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
        for (const sub of subCats) {
          const items = (sub.items || [])
            .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
          subGroups.push({
            name: sub.categoryName || '',
            color: sub.color || comp.color,
            value: sub.value || 0,
            formattedValue: formatCurrency(sub.value || 0),
            percentage: sub.percentage || 0,
            count: sub.count || items.length,
            items: items.map((item: any) => ({
              name: item.name,
              value: item.value || 0,
              formattedValue: formatCurrency(item.value || 0),
              change: `${(item.percentage ?? 0).toFixed(1)}%`,
              positive: true,
            })),
          })
        }
      }

      result[comp.label] = subGroups
    }

    return result
  }, [compositionData, underlyingTypePortfolio?.equityByRegion, underlyingTypePortfolio?.groupsSubCategories])

  // 默认 TOP 5 资产（优先使用服务层合并后的 topAssets，家庭模式回退到 holdings）
  const defaultTopAssets = useMemo(() => {
    if (topAssets && topAssets.length > 0) {
      return topAssets.map((item: any) => ({
        name: item.name,
        value: formatCurrency(item.marketValueCny),
        change: `${item.unrealizedPnlPercent >= 0 ? '+' : ''}${item.unrealizedPnlPercent.toFixed(1)}%`,
        positive: item.unrealizedPnlPercent >= 0,
        subtitle: item.subtitle || item.category || '',
        category: item.category || '',
      }))
    }
    // 家庭模式回退：使用 holdings
    return holdings
      .slice(0, 5)
      .map((h: any) => ({
        name: h.name,
        value: formatCurrency(h.marketValue),
        change: `${h.unrealizedPnLPercent >= 0 ? '+' : ''}${h.unrealizedPnLPercent.toFixed(1)}%`,
        positive: h.unrealizedPnLPercent >= 0,
        subtitle: h.broker || h.accountName || '',
        category: '证券',
      }))
  }, [topAssets, holdings])

  return (
    <div className="flex flex-col gap-3 sm:gap-5">
      {/* Stat Cards */}
      <StatCards visible={visible} setAmountVisible={setAmountVisible} isFamily={isFamily} />

      {/* AI Investment Insight: 由 ViewConfig.features.showAiInsight 统一控制 */}
      {features.showAiInsight && <AIInsight visible={visible} />}

      {/* Two-column layout: Asset Composition + Right Panel */}
      <div className="grid gap-3 sm:gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AssetComposition
            compositionData={compositionData}
            categorySubGroups={categorySubGroups}
            defaultTopAssets={defaultTopAssets}
            visible={visible}
          />
        </div>
        <RightPanel visible={visible} />
      </div>

      {/* Family Members (family view only) */}
      {features.showFamilyMembersSection && !selectedMemberId && (
        <FamilyMembersSection visible={visible} familyMembers={familyMembers} />
      )}
    </div>
  )
}
