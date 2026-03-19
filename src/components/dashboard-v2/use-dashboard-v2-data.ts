'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { apiClient, type DashboardData } from '@/lib/api-client'

// ─── Types ─────────────────────────────────────────────

export interface TrendPoint {
  date: string
  totalAssets: number
  netWorth: number
  totalLiabilities: number
}

export interface MonthlyChangeItem {
  name: string
  type: string
  amount: number
  positive: boolean
  source: 'snapshot' | 'activity'
}

export interface MonthlyChangesData {
  netWorthChange: number
  totalAssetsChange: number
  totalLiabilitiesChange: number
  items: MonthlyChangeItem[]
  updatedAt: string
}

export interface UpcomingEvent {
  id: string
  name: string
  type: 'maturity' | 'payment'
  dueDate: string
  day: number
  month: number
  daysUntilDue: number
  amount: number
  currency: string
  urgent: boolean
  description: string
}

export interface NotificationItem {
  id: string
  type: string
  priority: 'urgent' | 'warning' | 'info'
  title: string
  message: string
  amount?: number
  dueDate?: string
  daysUntilDue?: number
  tag: string
  tagColor: string
  createdAt: string
}

export interface NotificationsData {
  notifications: NotificationItem[]
  upcomingEvents: UpcomingEvent[]
  total: number
  urgentCount: number
  generatedAt: string
}

export interface PriceRefreshResult {
  success: boolean
  updated?: number
  total?: number
  message?: string
}

export interface DashboardV2DataState {
  // 原始 API 数据
  dashboardData: DashboardData | null
  assets: any[]
  liabilities: any[]

  // 历史趋势数据
  personalTrend: TrendPoint[]
  familyTrend: TrendPoint[]

  // 本月资产变动
  monthlyChanges: MonthlyChangesData | null

  // 通知系统
  notificationsData: NotificationsData | null

  // 家庭数据
  familyOverview: any | null
  familyMembers: any[]
  familyHoldings: any[]
  familyAssets: any[]
  familyLiabilities: any[]
  familyAllocationData: any | null
  familyTopAssets: any[]

  // 状态
  isLoading: boolean
  isFamilyLoading: boolean
  isPriceRefreshing: boolean
  error: string | null

  // 用户信息
  session: any
  hasFamilyId: boolean
  familyRole: string | null

  // 操作
  refresh: (silent?: boolean) => Promise<void>
  refreshFamily: () => Promise<void>
  refreshPrices: () => Promise<PriceRefreshResult>
  lastPriceRefreshAt: Date | null
}

// ─── Hook ──────────────────────────────────────────────

export function useDashboardV2Data(): DashboardV2DataState {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [assets, setAssets] = useState<any[]>([])
  const [liabilities, setLiabilities] = useState<any[]>([])
  const [personalTrend, setPersonalTrend] = useState<TrendPoint[]>([])
  const [familyTrend, setFamilyTrend] = useState<TrendPoint[]>([])
  const [monthlyChanges, setMonthlyChanges] = useState<MonthlyChangesData | null>(null)
  const [notificationsData, setNotificationsData] = useState<NotificationsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 家庭数据
  const [familyOverview, setFamilyOverview] = useState<any>(null)
  const [familyMembers, setFamilyMembers] = useState<any[]>([])
  const [familyHoldings, setFamilyHoldings] = useState<any[]>([])
  const [familyAssets, setFamilyAssets] = useState<any[]>([])
  const [familyLiabilities, setFamilyLiabilities] = useState<any[]>([])
  const [familyAllocationData, setFamilyAllocationData] = useState<any>(null)
  const [familyTopAssets, setFamilyTopAssets] = useState<any[]>([])
  const [isFamilyLoading, setIsFamilyLoading] = useState(false)
  const [isPriceRefreshing, setIsPriceRefreshing] = useState(false)
  const [lastPriceRefreshAt, setLastPriceRefreshAt] = useState<Date | null>(null)

  // 加载主数据 (复用 V1 的 API: /api/dashboard + /api/assets + /api/liabilities)
  const loadDashboardData = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      setError(null)

      const data = await apiClient.getDashboardData()
      setDashboardData(data)

      // 并行加载资产、负债、历史趋势、本月变动和通知
      const [assetsRes, liabilitiesRes, trendRes, monthlyRes, notifRes] = await Promise.all([
        fetch('/api/assets').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/liabilities').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/portfolio/history?days=90').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/portfolio/monthly-changes').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/notifications').then(r => r.json()).catch(() => ({ success: false })),
      ])

      if (assetsRes.success) setAssets(assetsRes.data)
      if (liabilitiesRes.success) setLiabilities(liabilitiesRes.data)
      if (monthlyRes.success && monthlyRes.data) setMonthlyChanges(monthlyRes.data)
      if (notifRes.success && notifRes.data) setNotificationsData(notifRes.data)
      if (trendRes.success && trendRes.data?.trend) {
        const points: TrendPoint[] = trendRes.data.trend.map((t: any) => ({
          date: t.date,
          totalAssets: Number(t.totalAssets || t.totalValue || 0),
          netWorth: Number(t.netWorth || t.totalValue || 0),
          totalLiabilities: Number(t.totalLiabilities || 0),
        }))
        setPersonalTrend(points)
      }
    } catch (err) {
      console.error('[Dashboard V2] 加载数据失败:', err)
      const msg = err instanceof Error ? err.message : '加载数据失败'
      if (msg.includes('未授权') || msg.includes('401')) {
        router.push('/')
        return
      }
      setError(msg)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [router])

  // 加载家庭数据 (复用 V1: /api/family/overview + /api/family/members + /api/family/dashboard)
  const loadFamilyData = useCallback(async () => {
    // 如果 session 中没有 familyId，先尝试刷新 session（JWT 可能缓存了旧数据）
    if (!session?.user?.familyId) {
      await updateSession()
      // 即使刷新后仍无 familyId，也尝试请求 API（API 端有数据库 fallback）
    }
    setIsFamilyLoading(true)
    try {
      const [overviewRes, membersRes, dashboardRes, familyTrendRes] = await Promise.all([
        fetch('/api/family/overview'),
        fetch('/api/family/members'),
        fetch('/api/family/dashboard'),
        fetch('/api/family/history?days=90').then(r => r.json()).catch(() => ({ success: false })),
      ])

      if (overviewRes.ok) {
        const data = await overviewRes.json()
        setFamilyOverview(data)
      }
      if (membersRes.ok) {
        const data = await membersRes.json()
        setFamilyMembers(data.members || [])
      }
      if (dashboardRes.ok) {
        const data = await dashboardRes.json()
        if (data.success) {
          const holdings = (data.holdings || []).map((h: any) => ({
            ...h,
            lastUpdated: new Date(h.lastUpdated).toLocaleString('zh-CN', {
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit'
            })
          }))
          setFamilyHoldings(holdings)
          setFamilyAssets(data.assets || [])
          setFamilyLiabilities(data.liabilities || [])
          setFamilyAllocationData(data.allocationData || null)
          setFamilyTopAssets(data.topAssets || [])
        }
      }
      // 解析家庭趋势数据（兼容多种返回结构）
      const trendData = familyTrendRes?.data?.trend || familyTrendRes?.trend || []
      if (Array.isArray(trendData) && trendData.length > 0) {
        const points: TrendPoint[] = trendData.map((t: any) => ({
          date: t.date,
          totalAssets: Number(t.totalAssets || t.totalValue || 0),
          netWorth: Number(t.netWorth || t.totalValue || 0),
          totalLiabilities: Number(t.totalLiabilities || 0),
        }))
        setFamilyTrend(points)
      }
    } catch (err) {
      console.error('[Dashboard V2] 加载家庭数据失败:', err)
    } finally {
      setIsFamilyLoading(false)
    }
  }, [session?.user?.familyId, updateSession])

  // 刷新证券价格并重新加载仪表板数据
  const refreshPrices = useCallback(async (): Promise<PriceRefreshResult> => {
    setIsPriceRefreshing(true)
    try {
      const res = await fetch('/api/prices/update', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setLastPriceRefreshAt(new Date())
        // 价格更新后静默刷新个人+家庭数据
        await loadDashboardData(true)
        await loadFamilyData()
        return { success: true, updated: data.updated, total: data.total, message: data.message }
      }
      return { success: false, message: data.error || '价格更新失败' }
    } catch (err) {
      console.error('[Dashboard V2] 价格刷新失败:', err)
      return { success: false, message: '网络错误' }
    } finally {
      setIsPriceRefreshing(false)
    }
  }, [loadDashboardData, loadFamilyData])

  // 初始化：认证后自动加载
  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/')
      return
    }
    if (status === 'authenticated') {
      loadDashboardData()
      // 始终尝试加载家庭数据（API 端有 DB fallback，不完全依赖 JWT 缓存的 familyId）
      loadFamilyData()
    }
  }, [status, router, loadDashboardData, loadFamilyData])

  return {
    dashboardData,
    assets,
    liabilities,
    personalTrend,
    familyTrend,
    monthlyChanges,
    notificationsData,
    familyOverview,
    familyMembers,
    familyHoldings,
    familyAssets,
    familyLiabilities,
    familyAllocationData,
    familyTopAssets,
    isLoading,
    isFamilyLoading,
    isPriceRefreshing,
    error,
    session,
    hasFamilyId: !!session?.user?.familyId,
    familyRole: (session?.user as any)?.familyRole || null,
    refresh: loadDashboardData,
    refreshFamily: loadFamilyData,
    refreshPrices,
    lastPriceRefreshAt,
  }
}

// ─── 数据格式化辅助 ────────────────────────────────────

/** 格式化金额为万元显示（如 ¥692万）*/
export function formatWan(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    return `¥${(amount / 10000).toFixed(0)}万`
  }
  return `¥${amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}

/** 格式化金额为完整显示（如 ¥6,920,993.00）*/
export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** 格式化百分比（如 +2.56%）*/
export function formatPercent(value: number, showSign = true): string {
  const sign = showSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}
