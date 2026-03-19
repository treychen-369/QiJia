'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Search,
  Plus,
  CreditCard,
  Home,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Shield,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  User,
  Building2,
  Car,
  MoreHorizontal,
  Minus,
} from 'lucide-react'
import { useDashboardV2 } from '@/app/dashboard-v2/layout'
import { formatCurrency } from './use-dashboard-v2-data'
import { AddLiabilityDialog } from '@/components/liabilities/add-liability-dialog'
import { LiabilityDetailDialog } from '@/components/liabilities/liability-detail-dialog'

// ─── Types ──────────────────────────────────────────────

type SortKey = 'amount' | 'monthly' | 'rate' | 'remaining'

interface LiabilityDetail {
  id: string
  name: string
  type: string // LiabilityType enum: MORTGAGE | CREDIT_CARD | PERSONAL_LOAN | etc.
  description?: string
  principalAmount: number
  currentBalance: number
  interestRate?: number
  monthlyPayment?: number
  currency: string
  startDate?: string
  maturityDate?: string
  nextPaymentDate?: string
  metadata?: any
  isActive: boolean
  lastUpdated: string
  createdAt: string
  currentBalanceCny: number
  monthlyPaymentCny: number
  exchangeRate: number
  remainingMonths?: number
  totalInterest?: number
}

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'amount', label: '余额' },
  { key: 'monthly', label: '月供' },
  { key: 'rate', label: '利率' },
  { key: 'remaining', label: '剩余期限' },
]

// ─── Helpers ────────────────────────────────────────────

function getLiabilityTypeName(type: string): string {
  const map: Record<string, string> = {
    MORTGAGE: '房贷',
    CREDIT_CARD: '信用卡',
    PERSONAL_LOAN: '个人贷款',
    BUSINESS_LOAN: '商业贷款',
    CAR_LOAN: '车贷',
    STUDENT_LOAN: '学生贷款',
    PAYABLE: '应付款项',
    OTHER: '其他',
  }
  return map[type] || '未知'
}

function getLiabilityTypeIcon(type: string) {
  const map: Record<string, typeof CreditCard> = {
    MORTGAGE: Home,
    CREDIT_CARD: CreditCard,
    PERSONAL_LOAN: User,
    BUSINESS_LOAN: Building2,
    CAR_LOAN: Car,
    STUDENT_LOAN: GraduationCap,
    PAYABLE: MoreHorizontal,
    OTHER: MoreHorizontal,
  }
  return map[type] || MoreHorizontal
}

function getLiabilityTypeColors(type: string) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    MORTGAGE: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-l-blue-500' },
    CREDIT_CARD: { bg: 'bg-red-500/10', text: 'text-red-500 dark:text-red-400', border: 'border-l-red-500' },
    PERSONAL_LOAN: { bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-l-yellow-500' },
    BUSINESS_LOAN: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-l-purple-500' },
    CAR_LOAN: { bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-l-cyan-500' },
    STUDENT_LOAN: { bg: 'bg-green-500/10', text: 'text-green-600 dark:text-green-400', border: 'border-l-green-500' },
    PAYABLE: { bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', border: 'border-l-pink-500' },
    OTHER: { bg: 'bg-gray-500/10', text: 'text-gray-600 dark:text-gray-400', border: 'border-l-gray-500' },
  }
  return map[type] || { bg: 'bg-gray-500/10', text: 'text-gray-600 dark:text-gray-400', border: 'border-l-gray-500' }
}

function getHealthStatus(score: number): { label: string; color: string; Icon: typeof CheckCircle2 } {
  if (score >= 80) return { label: '状态优秀', color: 'text-emerald-600 dark:text-emerald-400', Icon: CheckCircle2 }
  if (score >= 60) return { label: '状态良好', color: 'text-yellow-600 dark:text-yellow-400', Icon: AlertTriangle }
  return { label: '需要关注', color: 'text-red-600 dark:text-red-400', Icon: AlertCircle }
}

function getRingColor(score: number): string {
  if (score >= 80) return '#10b981'
  if (score >= 60) return '#f59e0b'
  return '#ef4444'
}

function getMetricStatus(current: number, threshold: number): 'good' | 'warning' | 'bad' {
  const ratio = current / threshold
  if (ratio < 0.6) return 'good'
  if (ratio < 0.85) return 'warning'
  return 'bad'
}

function getMetricColor(status: 'good' | 'warning' | 'bad'): string {
  if (status === 'good') return 'text-emerald-600 dark:text-emerald-400'
  if (status === 'warning') return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function getBarColor(status: 'good' | 'warning' | 'bad'): string {
  if (status === 'good') return 'bg-emerald-500'
  if (status === 'warning') return 'bg-yellow-500'
  return 'bg-red-500'
}

function getBorderColor(score: number): string {
  if (score >= 80) return 'border-emerald-200/60 dark:border-emerald-800/40'
  if (score >= 60) return 'border-yellow-200/60 dark:border-yellow-800/40'
  return 'border-red-200/60 dark:border-red-800/40'
}

// ─── Component ──────────────────────────────────────────

export function LiabilitiesTab() {
  const { amountVisible, viewMode, apiData } = useDashboardV2()
  const isFamily = viewMode === 'family'
  const [activeSort, setActiveSort] = useState<SortKey>('amount')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  // 对话框状态
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedLiability, setSelectedLiability] = useState<LiabilityDetail | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingLiability, setEditingLiability] = useState<LiabilityDetail | null>(null)

  // ─── 从 API 获取真实数据（家庭/个人自动切换） ─────────

  const liabilities: LiabilityDetail[] = isFamily
    ? (apiData.familyLiabilities || [])
    : (apiData.liabilities || [])
  const allocationSource = isFamily ? apiData.familyAllocationData : apiData.dashboardData?.allocationData
  const liabilityInfo = allocationSource?.liabilityInfo
  const scoreBreakdown = allocationSource?.scoreBreakdown

  // ─── 过滤 & 排序 ────────────────────────────────────

  const filteredLiabilities = useMemo(() => {
    return liabilities.filter(
      (l) =>
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getLiabilityTypeName(l.type).toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [liabilities, searchQuery])

  const sortedLiabilities = useMemo(() => {
    return [...filteredLiabilities].sort((a, b) => {
      switch (activeSort) {
        case 'amount':
          return b.currentBalanceCny - a.currentBalanceCny
        case 'monthly':
          return (b.monthlyPaymentCny || 0) - (a.monthlyPaymentCny || 0)
        case 'rate':
          return (b.interestRate || 0) - (a.interestRate || 0)
        case 'remaining':
          return (b.remainingMonths || 0) - (a.remainingMonths || 0)
        default:
          return 0
      }
    })
  }, [filteredLiabilities, activeSort])

  // ─── 按类型分组 ──────────────────────────────────────

  const groupedLiabilities = useMemo(() => {
    return sortedLiabilities.reduce(
      (groups, l) => {
        const type = l.type
        if (!groups[type]) groups[type] = []
        groups[type].push(l)
        return groups
      },
      {} as Record<string, LiabilityDetail[]>
    )
  }, [sortedLiabilities])

  // ─── 汇总计算 ────────────────────────────────────────

  const totalBalance = useMemo(
    () => filteredLiabilities.reduce((s, l) => s + l.currentBalanceCny, 0),
    [filteredLiabilities]
  )
  const totalMonthlyPayment = useMemo(
    () => filteredLiabilities.reduce((s, l) => s + (l.monthlyPaymentCny || 0), 0),
    [filteredLiabilities]
  )
  const averageRate = useMemo(() => {
    const weighted = filteredLiabilities.reduce(
      (s, l) => s + (l.interestRate || 0) * l.currentBalanceCny,
      0
    )
    return totalBalance > 0 ? weighted / totalBalance : 0
  }, [filteredLiabilities, totalBalance])

  // ─── 健康度计算 ───────────────────────────────────────

  const healthScore = useMemo(() => {
    if (scoreBreakdown) {
      // 满分 100 = deviation(40) + diversity(20) + liquidity(20) + debt(20)
      // 这里只取 debt score 换算成百分比：debtScore / 20 * 100
      const debtScoreNorm = (scoreBreakdown.debtScore / 20) * 100
      return Math.round(debtScoreNorm)
    }
    // 无配置分析数据时，根据负债率估算
    const ratio = liabilityInfo?.liabilityRatio || 0
    if (ratio < 10) return 95
    if (ratio < 20) return 85
    if (ratio < 30) return 75
    if (ratio < 50) return 60
    return 40
  }, [scoreBreakdown, liabilityInfo])

  const liabilityRatio = liabilityInfo?.liabilityRatio || 0
  const dti = liabilityInfo?.dti
  // 短期偿债比（使用信用卡等短期负债 / 总负债）
  const shortTermDebtRatio = useMemo(() => {
    if (totalBalance <= 0) return 0
    const shortTermTypes = ['CREDIT_CARD', 'PAYABLE']
    const shortTermBalance = filteredLiabilities
      .filter((l) => shortTermTypes.includes(l.type))
      .reduce((s, l) => s + l.currentBalanceCny, 0)
    return (shortTermBalance / totalBalance) * 100
  }, [filteredLiabilities, totalBalance])

  const healthMetrics = useMemo(
    () => [
      {
        label: '负债率',
        value: liabilityRatio,
        threshold: 30,
        desc: '< 30% 健康',
      },
      {
        label: '月供收入比',
        value: dti ?? 0,
        threshold: 40,
        desc: '< 40% 安全',
      },
      {
        label: '短期偿债比',
        value: shortTermDebtRatio,
        threshold: 50,
        desc: '< 50% 安全',
      },
    ],
    [liabilityRatio, dti, shortTermDebtRatio]
  )

  const healthStatusInfo = getHealthStatus(healthScore)
  const ringColor = getRingColor(healthScore)

  // ─── 操作处理 ─────────────────────────────────────────

  const handleViewDetail = useCallback((liability: LiabilityDetail) => {
    setSelectedLiability(liability)
    setDetailDialogOpen(true)
  }, [])

  const handleEdit = useCallback((liability: LiabilityDetail) => {
    setEditingLiability(liability)
    setEditDialogOpen(true)
    setDetailDialogOpen(false)
  }, [])

  const handleRefresh = useCallback(() => {
    apiData.refresh?.()
  }, [apiData])

  const toggleGroup = useCallback((type: string) => {
    setExpandedGroups((prev) => ({ ...prev, [type]: !prev[type] }))
  }, [])

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Debt Health Dashboard ─── */}
      <div className={`rounded-2xl border ${getBorderColor(healthScore)} bg-card`}>
        <div className="flex flex-col lg:flex-row">
          {/* Left: Overall Score */}
          <div className="flex flex-col items-center justify-center border-b border-border p-6 lg:w-[220px] lg:shrink-0 lg:border-b-0 lg:border-r">
            <div className="relative mb-3">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/30"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(healthScore / 100) * 2 * Math.PI * 48} ${2 * Math.PI * 48}`}
                  transform="rotate(-90 60 60)"
                  className="transition-all duration-700"
                />
                <text
                  x="60"
                  y="54"
                  textAnchor="middle"
                  className="fill-foreground font-bold"
                  style={{ fontSize: '24px' }}
                >
                  {amountVisible ? healthScore : '**'}
                </text>
                <text
                  x="60"
                  y="72"
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: '11px' }}
                >
                  健康评分
                </text>
              </svg>
            </div>
            <div className="flex items-center gap-1.5">
              <healthStatusInfo.Icon className={`h-4 w-4 ${healthStatusInfo.color}`} />
              <span className={`text-sm font-semibold ${healthStatusInfo.color}`}>
                {healthStatusInfo.label}
              </span>
            </div>
          </div>

          {/* Right: Metrics */}
          <div className="flex flex-1 flex-col p-6">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-foreground">负债健康度</h3>
            </div>

            <div className="flex flex-col gap-4">
              {healthMetrics.map((metric) => {
                const status = getMetricStatus(metric.value, metric.threshold)
                return (
                  <div key={metric.label}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground">{metric.label}</span>
                        <span className="text-[11px] text-muted-foreground">{metric.desc}</span>
                      </div>
                      <span
                        className={`text-sm font-bold ${getMetricColor(status)}`}
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {amountVisible ? `${metric.value.toFixed(1)}%` : '****'}
                      </span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${getBarColor(status)} transition-all duration-500`}
                        style={{
                          width: `${Math.min((metric.value / metric.threshold) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>0%</span>
                      <span>安全线 {metric.threshold}%</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary stats row */}
            <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-muted/20 p-3 sm:grid-cols-3">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[11px] text-muted-foreground">总负债</span>
                <span
                  className="text-sm font-bold text-red-500"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {amountVisible
                    ? totalBalance >= 10000
                      ? `¥${(totalBalance / 10000).toFixed(0)}万`
                      : formatCurrency(totalBalance)
                    : '****'}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[11px] text-muted-foreground">月供总额</span>
                <span
                  className="text-sm font-bold text-foreground"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {amountVisible ? formatCurrency(totalMonthlyPayment) : '****'}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[11px] text-muted-foreground">平均利率</span>
                <span className="text-sm font-bold text-foreground">
                  {averageRate.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Debt List ─── */}
      <div className="rounded-2xl border border-border bg-card">
        {/* Header */}
        <div className="border-b border-border p-5 lg:p-7">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10">
                <CreditCard className="h-4 w-4 text-red-500" />
              </div>
              <h2 className="text-base font-semibold text-foreground">负债明细</h2>
            </div>
            <button
              onClick={() => setAddDialogOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索负债..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
              />
            </div>
            <span className="shrink-0 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-500">
              {filteredLiabilities.length} 项
            </span>
          </div>
        </div>

        {/* Sort + List */}
        <div className="p-5 lg:p-7">
          {/* Sort bar */}
          {filteredLiabilities.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-xs text-muted-foreground">排序:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setActiveSort(opt.key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeSort === opt.key
                        ? 'bg-foreground text-background shadow-sm'
                        : 'border border-border bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                    {activeSort === opt.key && ' ↓'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredLiabilities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CreditCard className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm">
                {searchQuery ? '没有找到匹配的负债' : '暂无负债记录'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setAddDialogOpen(true)}
                  className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  添加负债
                </button>
              )}
            </div>
          ) : (
            /* Grouped by type */
            <div className="flex flex-col gap-3">
              {Object.entries(groupedLiabilities).map(([type, items]) => {
                const typeName = getLiabilityTypeName(type)
                const Icon = getLiabilityTypeIcon(type)
                const colors = getLiabilityTypeColors(type)
                const groupBalance = items.reduce((s, l) => s + l.currentBalanceCny, 0)
                const groupMonthly = items.reduce(
                  (s, l) => s + (l.monthlyPaymentCny || 0),
                  0
                )
                const isExpanded = expandedGroups[type] ?? false

                return (
                  <div key={type} className="rounded-xl border border-border overflow-hidden">
                    {/* Group Header */}
                    <button
                      onClick={() => toggleGroup(type)}
                      className="flex w-full items-center gap-4 p-4 transition-colors hover:bg-muted/30"
                    >
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors.bg}`}
                      >
                        <Icon className={`h-5 w-5 ${colors.text}`} />
                      </div>
                      <div className="flex flex-1 flex-col items-start gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{typeName}</span>
                          <span className="text-xs text-muted-foreground">({items.length})</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            合计{' '}
                            {amountVisible ? formatCurrency(groupBalance) : '****'}
                          </span>
                          {groupMonthly > 0 && (
                            <span>
                              月供{' '}
                              {amountVisible ? formatCurrency(groupMonthly) : '****'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/50">
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Items */}
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/10 p-3 flex flex-col gap-2">
                        {items.map((liability) => {
                          const progress =
                            liability.principalAmount > 0
                              ? Math.round(
                                  ((liability.principalAmount - liability.currentBalance) /
                                    liability.principalAmount) *
                                    100
                                )
                              : 0

                          return (
                            <div
                              key={liability.id}
                              onClick={() => handleViewDetail(liability)}
                              className={`rounded-xl border border-border ${colors.border} border-l-[3px] bg-card p-4 transition-all hover:bg-muted/20 hover:shadow-sm cursor-pointer`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex flex-1 flex-col gap-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-foreground truncate">
                                      {liability.name}
                                    </span>
                                    {liability.currency !== 'CNY' && (
                                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                        {liability.currency}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                    {liability.monthlyPaymentCny > 0 && (
                                      <span>
                                        月供{' '}
                                        {amountVisible
                                          ? formatCurrency(liability.monthlyPaymentCny)
                                          : '****'}
                                      </span>
                                    )}
                                    {(liability.interestRate ?? 0) > 0 && (
                                      <span
                                        className={
                                          (liability.interestRate || 0) > 5
                                            ? 'text-orange-600 dark:text-orange-400 font-medium'
                                            : ''
                                        }
                                      >
                                        利率 {(liability.interestRate || 0).toFixed(2)}%
                                      </span>
                                    )}
                                    {liability.remainingMonths && liability.remainingMonths > 0 && (
                                      <span>剩余 {liability.remainingMonths}个月</span>
                                    )}
                                    {liability.nextPaymentDate && (
                                      <span>
                                        下次还款{' '}
                                        {new Date(liability.nextPaymentDate).toLocaleDateString(
                                          'zh-CN'
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="flex items-center gap-1 text-sm font-semibold text-red-600 dark:text-red-400">
                                    <Minus className="h-3.5 w-3.5" />
                                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                      {amountVisible
                                        ? formatCurrency(liability.currentBalanceCny)
                                        : '****'}
                                    </span>
                                  </div>
                                  {liability.currency !== 'CNY' && (
                                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                                      {liability.currency}{' '}
                                      {liability.currentBalance.toLocaleString('zh-CN', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Progress bar */}
                              {progress > 0 && (
                                <div className="mt-3 flex items-center gap-3">
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-primary/60 transition-all"
                                      style={{ width: `${Math.min(progress, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">
                                    已还 {progress}%
                                  </span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Dialogs ─── */}

      {/* 添加负债 */}
      <AddLiabilityDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => {
          setAddDialogOpen(false)
          handleRefresh()
        }}
      />

      {/* 编辑负债 */}
      <AddLiabilityDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editData={editingLiability as any}
        onSuccess={() => {
          setEditDialogOpen(false)
          setEditingLiability(null)
          handleRefresh()
        }}
      />

      {/* 详情对话框 */}
      {selectedLiability && (
        <LiabilityDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          liability={selectedLiability as any}
          onEdit={() => handleEdit(selectedLiability)}
          onDelete={() => {
            setDetailDialogOpen(false)
          }}
        />
      )}
    </div>
  )
}
