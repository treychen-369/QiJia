'use client'

import {
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
} from 'lucide-react'
import { useDashboardV2 } from '@/app/dashboard-v2/layout'
import { formatPercent } from '../use-dashboard-v2-data'
import { useSettings } from '@/components/dashboard-v2/use-settings'

interface StatCardsProps {
  visible: boolean
  setAmountVisible: (v: boolean) => void
  isFamily: boolean
}

export function StatCards({ visible, setAmountVisible, isFamily }: StatCardsProps) {
  const { apiData, viewMode, selectedMemberId } = useDashboardV2()
  const { pnlColor, fmt } = useSettings()
  const dd = apiData.dashboardData

  const isPersonal = viewMode === 'personal'

  const familyOv = apiData.familyOverview
  const memberData = selectedMemberId && familyOv?.memberBreakdown
    ? familyOv.memberBreakdown.find((m: any) => m.userId === selectedMemberId)
    : null

  const totalAssets = isPersonal
    ? (dd?.overview.totalAssets || 0)
    : (memberData?.totalAssets ?? familyOv?.totalAssets ?? 0)

  const netWorth = isPersonal
    ? (dd?.overview.netWorth ?? dd?.overview.totalAssets ?? 0)
    : (memberData?.netWorth ?? familyOv?.netWorth ?? 0)

  const totalLiabilities = isPersonal
    ? (dd?.overview.totalLiabilities ?? 0)
    : (memberData?.totalLiabilities ?? familyOv?.totalLiabilities ?? 0)

  const totalUnrealizedPnlPercent = isPersonal
    ? (dd?.overview.totalUnrealizedPnlPercent ?? 0)
    : (memberData?.totalUnrealizedPnlPercent ?? familyOv?.totalUnrealizedPnlPercent ?? 0)

  const accountCount = dd?.overview.accountCount ?? 0

  const liabilityRatio = totalAssets > 0 ? (totalLiabilities / totalAssets * 100) : 0
  const assetRatio = totalAssets > 0 ? ((totalAssets - totalLiabilities) / totalAssets * 100) : 100

  const liabilityInfo = dd?.allocationData?.liabilityInfo
  const liabBreakdown = liabilityInfo?.byType || []
  const liabDetailText = liabBreakdown.length > 0
    ? liabBreakdown.map((t: any) => `${t.typeName} ${fmt(t.balance)}`).join(' · ')
    : ''

  const overviewGroups = dd?.underlyingTypePortfolio?.byOverviewGroup || []
  const groupCount = overviewGroups.filter((g: any) => g.value > 0).length

  const pnlPositive = totalUnrealizedPnlPercent >= 0

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4">
      {/* Total Assets — 移动端占满2列 */}
      <div className="col-span-2 sm:col-span-1 group rounded-2xl border border-border bg-card p-4 sm:p-5 transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-xs font-medium text-muted-foreground">
            {isFamily ? '家庭总资产' : '总资产'}
          </span>
          <button
            onClick={() => setAmountVisible(!visible)}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label={visible ? '隐藏金额' : '显示金额'}
          >
            {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
        </div>
        <span className="mt-1.5 sm:mt-2 block text-xl sm:text-2xl font-bold tracking-tight text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {visible ? fmt(totalAssets) : '****'}
        </span>
        <div className="mt-1.5 sm:mt-2 flex items-center gap-2 sm:gap-3">
          <div className={`flex items-center gap-1 ${pnlColor(totalUnrealizedPnlPercent)}`}>
            {pnlPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span className="text-xs sm:text-[11px] font-medium">累计 {formatPercent(totalUnrealizedPnlPercent)}</span>
          </div>
          <span className="text-xs sm:text-[11px] text-muted-foreground">
            {groupCount} 类 · {accountCount} 账户
          </span>
        </div>
      </div>

      {/* Net Worth */}
      <div className="group rounded-2xl border border-border bg-card p-3.5 sm:p-5 transition-shadow hover:shadow-md">
        <span className="text-[11px] sm:text-xs font-medium text-muted-foreground">净资产</span>
        <span className="mt-1 sm:mt-2 block text-base sm:text-2xl font-bold tracking-tight text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {visible ? fmt(netWorth) : '****'}
        </span>
        <div className="mt-1 sm:mt-2 flex items-center gap-1.5 sm:gap-3">
          <div className={`flex items-center gap-0.5 sm:gap-1 ${pnlColor(totalUnrealizedPnlPercent)}`}>
            {pnlPositive ? <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> : <TrendingDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
            <span className="text-[11px] font-medium">{formatPercent(totalUnrealizedPnlPercent)}</span>
          </div>
        </div>
        <div className="mt-1.5 sm:mt-2.5 flex h-1 sm:h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
          <div className="h-full rounded-l-full bg-emerald-500/70 transition-all" style={{ width: `${assetRatio}%` }} title={`资产 ${assetRatio.toFixed(1)}%`} />
          <div className="h-full rounded-r-full bg-red-400/70 transition-all" style={{ width: `${liabilityRatio}%` }} title={`负债 ${liabilityRatio.toFixed(1)}%`} />
        </div>
      </div>

      {/* Total Liabilities */}
      <div className="group rounded-2xl border border-border bg-card p-3.5 sm:p-5 transition-shadow hover:shadow-md">
        <span className="text-[11px] sm:text-xs font-medium text-muted-foreground">总负债</span>
        <span className="mt-1 sm:mt-2 block text-base sm:text-2xl font-bold tracking-tight text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {visible ? fmt(totalLiabilities) : '****'}
        </span>
        <div className="mt-1 sm:mt-2 flex items-center gap-1.5 sm:gap-3">
          <span className={`inline-flex items-center gap-0.5 sm:gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-medium ${
            liabilityRatio < 30 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : liabilityRatio < 60 ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-red-500/10 text-red-700 dark:text-red-400'
          }`}>
            <ShieldCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            {liabilityRatio.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}
