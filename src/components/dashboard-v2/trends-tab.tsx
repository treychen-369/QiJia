'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Snowflake,
  Activity,
  Zap,
  Loader2,
} from 'lucide-react'
import { useDashboardV2 } from '@/app/dashboard-v2/layout'
import { formatCurrency } from './use-dashboard-v2-data'
import { useSettings } from '@/components/dashboard-v2/use-settings'

// ─── Types ──────────────────────────────────────────────

interface HistoricalDataPoint {
  date: string
  totalAssets?: number
  netWorth?: number
  totalLiabilities?: number
  equityAssets?: number
  fixedIncomeAssets?: number
  cashEquivalents?: number
  realEstateAssets?: number
  alternativeAssets?: number
  receivableAssets?: number
}

type TimeRange = '7d' | '30d' | '90d' | '1y'

// ─── Config ─────────────────────────────────────────────

const METRIC_OPTIONS = [
  { id: 'totalAssets', label: '总资产', color: '#3B82F6', dot: 'bg-blue-500', gradientId: 'gradTotalAssets' },
  { id: 'netWorth', label: '净资产', color: '#10B981', dot: 'bg-emerald-500', gradientId: 'gradNetWorth' },
  { id: 'totalLiabilities', label: '负债', color: '#EF4444', dot: 'bg-red-500', gradientId: 'gradLiabilities' },
  { id: 'equityAssets', label: '权益类', color: '#8B5CF6', dot: 'bg-violet-500', gradientId: 'gradEquity' },
  { id: 'cashEquivalents', label: '现金类', color: '#06B6D4', dot: 'bg-cyan-500', gradientId: 'gradCash' },
  { id: 'fixedIncomeAssets', label: '固收类', color: '#F59E0B', dot: 'bg-amber-500', gradientId: 'gradFixed' },
  { id: 'realEstateAssets', label: '不动产', color: '#EC4899', dot: 'bg-pink-500', gradientId: 'gradProperty' },
  { id: 'alternativeAssets', label: '另类投资', color: '#84CC16', dot: 'bg-lime-500', gradientId: 'gradAlternative' },
  { id: 'receivableAssets', label: '应收款', color: '#0EA5E9', dot: 'bg-sky-500', gradientId: 'gradReceivable' },
]

const TIME_RANGES: TimeRange[] = ['7d', '30d', '90d', '1y']
const DAYS_MAP: Record<TimeRange, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }
const RANGE_LABEL: Record<TimeRange, string> = { '7d': '7 天', '30d': '30 天', '90d': '90 天', '1y': '1 年' }

// ─── Component ──────────────────────────────────────────

export function TrendsTab() {
  const { amountVisible, apiData, viewMode } = useDashboardV2()
  const { pnlColor: pnlColorFn } = useSettings()
  const [selectedMetric, setSelectedMetric] = useState('totalAssets')
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // 独立加载的历史数据（支持动态时间范围切换）
  const [historyData, setHistoryData] = useState<HistoricalDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)

  const isFamily = viewMode === 'family'
  const historyApiUrl = isFamily ? '/api/family/history' : '/api/portfolio/history'

  const metric = METRIC_OPTIONS.find((m) => m.id === selectedMetric) ?? METRIC_OPTIONS[0]

  // ─── 加载历史数据 ──────────────────────────────────────

  const loadHistoryData = useCallback(
    async (range: TimeRange) => {
      try {
        setIsLoading(true)
        setError(null)

        const days = DAYS_MAP[range]
        const res = await fetch(`${historyApiUrl}?days=${days}`, {
          headers: { 'Cache-Control': 'no-cache' },
        })

        if (!res.ok) throw new Error('获取历史数据失败')

        const result = await res.json()

        if (result.success && result.data?.trend) {
          const formatted: HistoricalDataPoint[] = result.data.trend.map((item: any) => ({
            date: item.date,
            totalAssets: Number(item.totalAssets || item.totalValue || 0),
            netWorth: Number(item.netWorth || item.totalValue || 0),
            totalLiabilities: Number(item.totalLiabilities || 0),
            equityAssets: Number(item.equityAssets || 0),
            fixedIncomeAssets: Number(item.fixedIncomeAssets || 0),
            cashEquivalents: Number(item.cashEquivalents || 0),
            realEstateAssets: Number(item.realEstateAssets || 0),
            alternativeAssets: Number(item.alternativeAssets || 0),
            receivableAssets: Number(item.receivableAssets || 0),
          }))
          setHistoryData(formatted)
          setMetrics(result.data.metrics || null)
          setSummary(result.data.summary || null)
        } else {
          throw new Error(result.error || '数据格式错误')
        }
      } catch (err) {
        console.error('[TrendsTab] 加载历史数据失败:', err)
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setIsLoading(false)
      }
    },
    [historyApiUrl]
  )

  useEffect(() => {
    loadHistoryData(timeRange)
  }, [timeRange, loadHistoryData])

  // ─── 计算趋势摘要数据 ─────────────────────────────────

  const getMetricValue = useCallback(
    (point: HistoricalDataPoint, key: string): number => {
      return (point as any)[key] || 0
    },
    []
  )

  const latestData = historyData.length > 0 ? historyData[historyData.length - 1] : null
  const firstData = historyData.length > 0 ? historyData[0] : null

  const latestValue = latestData ? getMetricValue(latestData, selectedMetric) : 0
  const firstValue = firstData ? getMetricValue(firstData, selectedMetric) : 0
  const changeValue = latestValue - firstValue
  const changePct = firstValue > 0 ? (changeValue / firstValue) * 100 : 0
  const isPositive = changeValue >= 0

  // ─── 关键趋势指标（从 API metrics + historyData 计算） ──

  const trendMetrics = useMemo(() => {
    const totalAssetsChange = latestData && firstData
      ? (getMetricValue(latestData, 'totalAssets') - getMetricValue(firstData, 'totalAssets'))
      : 0
    const totalAssetsFirst = firstData ? getMetricValue(firstData, 'totalAssets') : 0
    const totalAssetsChangePct = totalAssetsFirst > 0 ? (totalAssetsChange / totalAssetsFirst) * 100 : 0

    // 最大回撤计算
    let maxDrawdown = 0
    let maxDrawdownDate = ''
    if (historyData.length >= 2) {
      let peak = getMetricValue(historyData[0], 'totalAssets')
      for (const point of historyData) {
        const val = getMetricValue(point, 'totalAssets')
        if (val > peak) peak = val
        const dd = peak > 0 ? ((peak - val) / peak) * 100 : 0
        if (dd > maxDrawdown) {
          maxDrawdown = dd
          maxDrawdownDate = new Date(point.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
        }
      }
    }

    // 使用 API 返回的 metrics（如果有的话）
    const volatility = metrics?.volatility != null ? (metrics.volatility * 100) : null
    const sharpeRatio = metrics?.sharpeRatio ?? null

    return [
      {
        label: `${RANGE_LABEL[timeRange]}净值增长`,
        value: totalAssetsChange,
        valueFmt: `${totalAssetsChange >= 0 ? '+' : ''}¥${(Math.abs(totalAssetsChange) / 10000).toFixed(1)}万`,
        subtext: `${totalAssetsChangePct >= 0 ? '+' : ''}${totalAssetsChangePct.toFixed(2)}%`,
        positive: totalAssetsChange >= 0,
      },
      {
        label: '最大回撤',
        value: maxDrawdown,
        valueFmt: `-${maxDrawdown.toFixed(1)}%`,
        subtext: maxDrawdownDate || '-',
        positive: maxDrawdown < 3,
      },
      {
        label: '波动率',
        value: volatility,
        valueFmt: volatility != null ? `${volatility.toFixed(1)}%` : '-',
        subtext: volatility != null ? (volatility < 10 ? '低' : volatility < 20 ? '中等' : '高') : '-',
        positive: null as boolean | null,
      },
      {
        label: '夏普比率',
        value: sharpeRatio,
        valueFmt: sharpeRatio != null ? sharpeRatio.toFixed(2) : '-',
        subtext: sharpeRatio != null ? (sharpeRatio >= 1.5 ? '优秀' : sharpeRatio >= 1 ? '良好' : sharpeRatio >= 0.5 ? '一般' : '较差') : '-',
        positive: sharpeRatio != null ? sharpeRatio >= 1 : null,
      },
    ]
  }, [historyData, latestData, firstData, metrics, timeRange, getMetricValue])

  // ─── 表现最佳 / 最差（从持仓数据计算，家庭/个人自动切换） ──

  const { topPerformers, worstPerformers } = useMemo(() => {
    const holdings = isFamily
      ? (apiData.familyHoldings || [])
      : (apiData.dashboardData?.allHoldings || [])

    const withPnlPct = holdings
      .filter((h: any) => h.marketValue > 0 && h.costBasis > 0)
      .map((h: any) => ({
        name: h.name || h.symbol,
        ticker: h.symbol || '',
        value: h.marketValue || 0,
        change: h.unrealizedPnLPercent || 0,
        category: h.region === 'CN' ? '中国' : h.region === 'US' ? '美国' : h.region === 'HK' ? '港股' : h.region || '其他',
      }))

    const sorted = [...withPnlPct].sort((a, b) => b.change - a.change)
    const top = sorted.slice(0, 3).filter((h) => h.change > 0)
    const worst = sorted
      .slice(-3)
      .reverse()
      .filter((h) => h.change < 0)

    return {
      topPerformers: top.map((h) => ({ ...h, icon: h.change > 5 ? Flame : ArrowUpRight })),
      worstPerformers: worst.map((h) => ({ ...h, icon: h.change < -5 ? Snowflake : ArrowDownRight })),
    }
  }, [isFamily, apiData.familyHoldings, apiData.dashboardData?.allHoldings])

  // ─── 资产构成数据（从 API 获取，家庭模式使用个人数据降级） ──

  const compositionData = useMemo(() => {
    // 注意：家庭 API 未返回 underlyingTypePortfolio，使用个人的（这个数据主要做趋势辅助展示）
    const byOverviewGroup = apiData.dashboardData?.underlyingTypePortfolio?.byOverviewGroup || []
    return byOverviewGroup.map((item: any) => ({
      label: item.name,
      value: item.value,
      pct: item.percentage,
      color: item.color || '#94a3b8',
    }))
  }, [apiData.dashboardData?.underlyingTypePortfolio?.byOverviewGroup])

  // ─── 趋势洞察（从真实数据推导） ────────────────────────

  const trendInsights = useMemo(() => {
    const insights: { text: string; type: 'hot' | 'warn' | 'neutral' | 'info' }[] = []

    if (historyData.length >= 2) {
      const first = historyData[0]
      const last = historyData[historyData.length - 1]

      // 检查各资产类别变化趋势
      const categories = [
        { key: 'equityAssets', label: '权益类' },
        { key: 'fixedIncomeAssets', label: '固收类' },
        { key: 'cashEquivalents', label: '现金类' },
        { key: 'alternativeAssets', label: '另类投资' },
        { key: 'realEstateAssets', label: '不动产' },
      ]

      for (const cat of categories) {
        const startVal = getMetricValue(first, cat.key)
        const endVal = getMetricValue(last, cat.key)
        if (startVal > 0) {
          const pctChange = ((endVal - startVal) / startVal) * 100
          if (pctChange > 5) {
            insights.push({ text: `${cat.label}持续走强`, type: 'hot' })
          } else if (pctChange < -5) {
            insights.push({ text: `${cat.label}回调明显`, type: 'warn' })
          } else if (Math.abs(pctChange) < 1) {
            insights.push({ text: `${cat.label}企稳`, type: 'neutral' })
          }
        }
      }

      // 现金占比检查
      const totalAssets = getMetricValue(last, 'totalAssets')
      const cashAssets = getMetricValue(last, 'cashEquivalents')
      if (totalAssets > 0 && cashAssets / totalAssets > 0.25) {
        insights.push({ text: '现金配置偏高', type: 'info' })
      }
    }

    return insights.slice(0, 4)
  }, [historyData, getMetricValue])

  // ─── 格式化日期 ───────────────────────────────────────

  const formatDate = useCallback(
    (dateStr: string) => {
      const d = new Date(dateStr)
      if (timeRange === '7d' || timeRange === '30d') {
        return `${d.getMonth() + 1}/${d.getDate()}`
      }
      return `${d.getMonth() + 1}月`
    },
    [timeRange]
  )

  const handleRefresh = useCallback(() => {
    loadHistoryData(timeRange)
  }, [loadHistoryData, timeRange])

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Trend Summary (趋势智能摘要) ─── */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="p-5 lg:p-7">
          <div className="mb-5 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10">
              <Activity className="h-4 w-4 text-violet-600" />
            </div>
            <h2 className="text-base font-semibold text-foreground">趋势摘要</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              近 {RANGE_LABEL[timeRange]}
            </span>
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>

          {/* Key Trend Metrics */}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {trendMetrics.map((m) => (
              <div
                key={m.label}
                className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/20 p-4 transition-shadow hover:shadow-sm"
              >
                <span className="text-[11px] font-medium text-muted-foreground">{m.label}</span>
                <span
                  className={`text-lg font-bold tracking-tight ${
                    m.positive === true
                      ? pnlColorFn(1)
                      : m.positive === false
                        ? pnlColorFn(-1)
                        : 'text-foreground'
                  }`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {amountVisible ? m.valueFmt : '****'}
                </span>
                <span
                  className={`text-xs ${
                    m.positive === true
                      ? pnlColorFn(1)
                      : m.positive === false
                        ? pnlColorFn(-1)
                        : 'text-muted-foreground'
                  }`}
                >
                  {m.subtext}
                </span>
              </div>
            ))}
          </div>

          {/* Best & Worst Performers */}
          {(topPerformers.length > 0 || worstPerformers.length > 0) && (
            <div className="mb-5 grid gap-4 lg:grid-cols-2">
              {/* Top Performers */}
              {topPerformers.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <Flame className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-sm font-semibold text-foreground">表现最佳</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {topPerformers.map((asset, i) => {
                      const Icon = asset.icon
                      return (
                        <div
                          key={`top-${asset.ticker}-${i}`}
                          className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 transition-colors hover:bg-emerald-50/60 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            {i + 1}
                          </span>
                          <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground truncate">
                                {asset.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {asset.ticker}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground">{asset.category}</span>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <span
                              className="text-sm font-semibold text-foreground"
                              style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              {amountVisible
                                ? asset.value >= 10000
                                  ? `¥${(asset.value / 10000).toFixed(1)}万`
                                  : formatCurrency(asset.value)
                                : '****'}
                            </span>
                            <span
                              className={`flex items-center gap-0.5 text-xs font-semibold ${pnlColorFn(1)}`}
                              style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              <Icon className="h-3 w-3" />+{asset.change.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Worst Performers */}
              {worstPerformers.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <Snowflake className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-sm font-semibold text-foreground">表现最差</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {worstPerformers.map((asset, i) => {
                      const Icon = asset.icon
                      return (
                        <div
                          key={`worst-${asset.ticker}-${i}`}
                          className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/30 p-3 transition-colors hover:bg-red-50/60 dark:border-red-900/30 dark:bg-red-950/20 dark:hover:bg-red-950/40"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-500/10 text-[11px] font-bold text-red-600 dark:text-red-400">
                            {i + 1}
                          </span>
                          <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground truncate">
                                {asset.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {asset.ticker}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground">{asset.category}</span>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <span
                              className="text-sm font-semibold text-foreground"
                              style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              {amountVisible
                                ? asset.value >= 10000
                                  ? `¥${(asset.value / 10000).toFixed(1)}万`
                                  : formatCurrency(asset.value)
                                : '****'}
                            </span>
                            <span
                              className={`flex items-center gap-0.5 text-xs font-semibold ${pnlColorFn(-1)}`}
                              style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              <Icon className="h-3 w-3" />
                              {asset.change.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trend Insight Tags */}
          {trendInsights.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground">趋势信号</span>
              {trendInsights.map((tag) => (
                <span
                  key={tag.text}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                    tag.type === 'hot'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : tag.type === 'warn'
                        ? 'bg-red-500/10 text-red-500 dark:text-red-400'
                        : tag.type === 'info'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {tag.text}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Chart Card (资产全景) ─── */}
      <div className="rounded-2xl border border-border bg-card">
        {/* Header */}
        <div className="flex flex-col gap-5 border-b border-border p-5 lg:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
                {isPositive ? (
                  <TrendingUp className={`h-4 w-4 ${pnlColorFn(1)}`} />
                ) : (
                  <TrendingDown className={`h-4 w-4 ${pnlColorFn(-1)}`} />
                )}
              </div>
              <h2 className="text-base font-semibold text-foreground">资产全景</h2>
              {historyData.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  ({historyData.length}个数据点)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
              <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
                {TIME_RANGES.map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    disabled={isLoading}
                    className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:px-3 sm:text-xs ${
                      timeRange === range
                        ? 'bg-foreground text-background shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-5">
            {/* Metric selector */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${metric.dot}`} />
                <span>{metric.label}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute left-0 top-full z-40 mt-1.5 w-44 rounded-xl border border-border bg-card p-1.5 shadow-lg">
                    {METRIC_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setSelectedMetric(opt.id)
                          setDropdownOpen(false)
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          selectedMetric === opt.id
                            ? 'bg-muted font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${opt.dot}`} />
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Current value */}
            {latestData && (
              <div className="flex items-baseline gap-4">
                <span
                  className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {amountVisible
                    ? latestValue >= 10000
                      ? `¥${(latestValue / 10000).toFixed(1)}万`
                      : `¥${latestValue.toLocaleString('zh-CN')}`
                    : '****'}
                </span>
                {firstData && firstValue > 0 && (
                  <div className="flex flex-col items-start">
                    <span
                      className={`text-sm font-semibold ${pnlColorFn(changeValue)}`}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {isPositive ? '+' : ''}¥{(Math.abs(changeValue) / 10000).toFixed(1)}万
                    </span>
                    <span className={`text-xs ${pnlColorFn(changeValue)}`}>
                      {isPositive ? '+' : ''}
                      {changePct.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 p-2 text-xs text-red-500">{error}</div>
          )}
        </div>

        {/* Chart */}
        <div className="px-4 py-4 lg:px-6 lg:py-7">
          {isLoading && historyData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center sm:h-[300px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : historyData.length === 0 ? (
            <div className="flex h-[220px] flex-col items-center justify-center text-muted-foreground sm:h-[300px]">
              <TrendingUp className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm">暂无历史数据</p>
              <p className="mt-1 text-xs">请先创建快照或稍后重试</p>
            </div>
          ) : (
            <div className="h-[220px] w-full sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    {METRIC_OPTIONS.map((opt) => (
                      <linearGradient key={opt.gradientId} id={opt.gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={opt.color} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={opt.color} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    strokeOpacity={0.08}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    tickFormatter={formatDate}
                    axisLine={{ stroke: 'currentColor', strokeOpacity: 0.15 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const point = payload[0].payload as HistoricalDataPoint
                        const val = getMetricValue(point, selectedMetric)
                        return (
                          <div className="rounded-xl border border-border bg-card p-3 shadow-lg">
                            <p className="mb-1.5 text-xs font-medium text-foreground">
                              {new Date(point.date).toLocaleDateString('zh-CN')}
                            </p>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-xs text-muted-foreground">{metric.label}:</span>
                                <span className="text-xs font-semibold" style={{ color: metric.color }}>
                                  ¥{(val / 10000).toFixed(1)}万
                                </span>
                              </div>
                              {selectedMetric !== 'totalAssets' && point.totalAssets && (
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-xs text-muted-foreground">总资产:</span>
                                  <span className="text-xs font-medium">
                                    ¥{(point.totalAssets / 10000).toFixed(1)}万
                                  </span>
                                </div>
                              )}
                              {selectedMetric !== 'netWorth' && point.netWorth && (
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-xs text-muted-foreground">净资产:</span>
                                  <span className="text-xs font-medium">
                                    ¥{(point.netWorth / 10000).toFixed(1)}万
                                  </span>
                                </div>
                              )}
                              {selectedMetric !== 'totalLiabilities' &&
                                point.totalLiabilities &&
                                point.totalLiabilities > 0 && (
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs text-muted-foreground">负债:</span>
                                    <span className="text-xs font-medium text-red-500">
                                      ¥{(point.totalLiabilities / 10000).toFixed(1)}万
                                    </span>
                                  </div>
                                )}
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={selectedMetric}
                    stroke={metric.color}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#${metric.gradientId})`}
                    animationDuration={600}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Composition */}
        {compositionData.length > 0 && (
          <div className="border-t border-border p-5 lg:p-7">
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">资产构成</h3>
            <div className="flex h-3.5 overflow-hidden rounded-full">
              {compositionData.map((item: any) => (
                <div
                  key={item.label}
                  className="transition-all hover:opacity-80 first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                  title={`${item.label} ${item.pct.toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              {compositionData.map((item: any) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-muted-foreground">{item.label}</span>
                  <span
                    className="font-semibold text-foreground"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {amountVisible
                      ? item.value >= 10000
                        ? `¥${(item.value / 10000).toFixed(1)}万`
                        : formatCurrency(item.value)
                      : '****'}
                  </span>
                  <span className="text-xs text-muted-foreground">({item.pct.toFixed(1)}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
