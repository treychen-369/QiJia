'use client'

import { useState, useEffect, useMemo, useRef, createContext, useContext, useCallback } from 'react'
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  User,
  Home,
  Settings,
  RefreshCw,
  CalendarDays,
  Bell,
  DollarSign,
  Sparkles,
  AlertCircle,
  ArrowLeftRight,
  Loader2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useDashboardV2Data, type DashboardV2DataState } from '@/components/dashboard-v2/use-dashboard-v2-data'
import { AIAdvisorPanel } from '@/components/dashboard-v2/ai-advisor-panel'
import { MobileBottomNav } from '@/components/dashboard-v2/mobile-bottom-nav'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import type { DashboardData } from '@/lib/api-client'
import {
  type SettingsData,
  type SettingsContextValue,
  type CurrencyUnit,
  SettingsContext,
  defaultSettings,
  loadSettings,
  saveSettings,
  getPnlTextColor,
  getPnlBgColor,
  formatAmount,
} from '@/components/dashboard-v2/use-settings'

// ─── Context ───────────────────────────────────────────
export type ViewMode = 'personal' | 'family'
export type FamilyMember = {
  id: string
  name: string
  role: string
  initials: string
  color: string
}

interface DashboardV2Context {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  activeTab: string
  setActiveTab: (tab: string) => void
  selectedMemberId: string | null // null = 全家
  setSelectedMemberId: (id: string | null) => void
  amountVisible: boolean
  setAmountVisible: (v: boolean) => void
  familyMembers: FamilyMember[]
  // 真实数据
  apiData: DashboardV2DataState
}

const DashboardCtx = createContext<DashboardV2Context>(null!)
export const useDashboardV2 = () => useContext(DashboardCtx)

// ─── Nav definition ────────────────────────────────────
interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  familyOnly?: boolean
  /** 在个人模式+已加入家庭时隐藏（与 AI 顾问同逻辑） */
  hiddenInPersonalWithFamily?: boolean
}

const navItems: NavItem[] = [
  { id: 'overview', label: '总览', icon: LayoutDashboard },
  { id: 'assets', label: '资产详情与管理', icon: Wallet },
  { id: 'liabilities', label: '负债详情与管理', icon: CreditCard },
  { id: 'trends', label: '趋势', icon: TrendingUp },
  { id: 'future', label: '规划', icon: Target, hiddenInPersonalWithFamily: true },
  { id: 'family', label: '家庭管理', icon: Users, familyOnly: true },
  { id: 'settings', label: '设置', icon: Settings },
]

const MEMBER_COLORS = ['bg-blue-500', 'bg-pink-500', 'bg-amber-500', 'bg-emerald-500', 'bg-purple-500']
const ROLE_MAP: Record<string, string> = { ADMIN: '管理员', MEMBER: '成员', OWNER: '管理员' }

// Icon mapping for notification types
function getNotifIcon(type: string) {
  switch (type) {
    case 'maturity': return AlertCircle
    case 'payment': return CreditCard
    case 'large_change': return TrendingDown
    case 'ai_suggestion': return Sparkles
    default: return AlertCircle
  }
}

function getNotifIconColor(type: string, priority: string) {
  if (priority === 'urgent') return 'text-red-500'
  switch (type) {
    case 'maturity': return 'text-amber-500'
    case 'payment': return 'text-red-500'
    case 'large_change': return 'text-blue-500'
    case 'ai_suggestion': return 'text-purple-500'
    default: return 'text-muted-foreground'
  }
}

function getNotifBorderColor(type: string, priority: string) {
  if (priority === 'urgent') return 'border-red-100 bg-red-50/30 hover:bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20'
  switch (type) {
    case 'maturity': return 'border-amber-100 bg-amber-50/20 hover:bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20'
    case 'payment': return 'border-orange-100 bg-orange-50/20 hover:bg-orange-50/40 dark:border-orange-900/40 dark:bg-orange-950/20'
    case 'ai_suggestion': return 'border-purple-100 bg-purple-50/30 hover:bg-purple-50/60 dark:border-purple-900/40 dark:bg-purple-950/20'
    default: return 'hover:bg-muted/30'
  }
}

// ─── Layout ────────────────────────────────────────────
export default function DashboardV2Layout({
  children,
}: {
  children: React.ReactNode
}) {
  // 真实数据
  const apiData = useDashboardV2Data()
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()
  const [isBluePro, setIsBluePro] = useState(false)

  // 蓝色专业版：设为 'dark'（让 Tailwind dark: 变体生效），再手动加 'blue-pro' 类覆盖 CSS 变量
  const applyTheme = useCallback((theme: string) => {
    if (theme === 'blue-pro') {
      setTheme('dark')
      setIsBluePro(true)
      document.documentElement.classList.add('blue-pro')
    } else {
      document.documentElement.classList.remove('blue-pro')
      setIsBluePro(false)
      setTheme(theme)
    }
  }, [setTheme])

  // 确保 blue-pro 类始终与 settings 同步（防止 next-themes 覆盖）
  useEffect(() => {
    if (isBluePro) {
      document.documentElement.classList.add('blue-pro')
    }
  }, [isBluePro, resolvedTheme])

  // ─── Settings state (localStorage-backed) ───
  const [settings, setSettings] = useState<SettingsData>(defaultSettings)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  // Load settings from localStorage on mount and apply defaults
  useEffect(() => {
    const saved = loadSettings()
    setSettings(saved)
    setSettingsLoaded(true)
    // Apply theme
    applyTheme(saved.theme)
    // Apply default view and hidden state
    setViewMode(saved.defaultView)
    setAmountVisible(!saved.defaultHidden)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateSettings = useCallback((patch: Partial<SettingsData>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      // Apply theme change
      if (patch.theme !== undefined) {
        applyTheme(patch.theme)
      }
      // Sync context
      if (patch.defaultHidden !== undefined) {
        setAmountVisible(!patch.defaultHidden)
      }
      if (patch.defaultView !== undefined) {
        setViewMode(patch.defaultView)
      }
      return next
    })
  }, [setTheme])

  const settingsCtxValue = useMemo<SettingsContextValue>(() => ({
    settings,
    loaded: settingsLoaded,
    update: updateSettings,
    pnlColor: (v: number) => getPnlTextColor(v, settings.pnlColor),
    pnlBg: (v: number) => getPnlBgColor(v, settings.pnlColor),
    isPositive: (v: number) => v >= 0,
    fmt: (amount: number, currencyOverride?: CurrencyUnit) =>
      formatAmount(amount, settings.amountFormat, currencyOverride || settings.currency),
  }), [settings, settingsLoaded, updateSettings])

  const [viewMode, setViewMode] = useState<ViewMode>('personal')
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [amountVisible, setAmountVisible] = useState(true)




  const [memberPanelOpen, setMemberPanelOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [exchangeOpen, setExchangeOpen] = useState(false)
  const [exchangeRefreshing, setExchangeRefreshing] = useState(false)
  const [exchangeUpdatedAt, setExchangeUpdatedAt] = useState<string | null>(null)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)

  // 将 API 家庭成员转为 FamilyMember 格式
  const familyMembers: FamilyMember[] = apiData.familyMembers.map((m: any, idx: number) => ({
    id: m.user?.id || m.userId || m.id,
    name: m.user?.name || m.name || '未知',
    role: ROLE_MAP[m.role] || m.role || '成员',
    initials: (m.user?.name || m.name || '?')[0],
    color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
  }))

  // 从 dashboardData 提取汇率（通过 accounts 推断）
  const exchangeRates = (() => {
    const accounts = apiData.dashboardData?.accounts || []
    const usdAccount = accounts.find((a: any) => a.currency === 'USD')
    const hkdAccount = accounts.find((a: any) => a.currency === 'HKD')
    return {
      usdCny: (usdAccount as any)?.exchangeRate || 7.2,
      hkdCny: (hkdAccount as any)?.exchangeRate || 0.92,
    }
  })()

  const handleRefreshExchangeRate = useCallback(async () => {
    setExchangeRefreshing(true)
    try {
      await fetch('/api/exchange-rates', { method: 'POST' })
      await apiData.refresh(true)
      setExchangeUpdatedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      console.error('[汇率刷新失败]', e)
    } finally {
      setExchangeRefreshing(false)
    }
  }, [apiData])

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    if (mode === 'personal') {
      setSelectedMemberId(null)
      setAiPanelOpen(false)
      setMemberPanelOpen(false)
      // 切到个人模式时，退出仅家庭可见的 Tab
      if (activeTab === 'family' || (activeTab === 'future' && apiData.hasFamilyId)) {
        setActiveTab('overview')
      }
    }
  }, [activeTab, apiData.hasFamilyId])

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
  }, [])

  // ─── 资产价格自动刷新 ───
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [nextRefreshIn, setNextRefreshIn] = useState<number | null>(null) // 秒
  const [priceRefreshMsg, setPriceRefreshMsg] = useState<string | null>(null)

  // refreshFreq → 间隔秒数映射
  const getRefreshIntervalMs = useCallback((freq: typeof settings.refreshFreq) => {
    switch (freq) {
      case 'realtime': return 5 * 60 * 1000   // 5分钟
      case 'daily': return 60 * 60 * 1000      // 1小时
      case 'weekly': return 0                   // 不自动刷新
      default: return 0
    }
  }, [])

  const handleManualPriceRefresh = useCallback(async () => {
    setPriceRefreshMsg(null)
    const result = await apiData.refreshPrices()
    if (result.success) {
      setPriceRefreshMsg(`已更新 ${result.updated || 0} 个持仓价格`)
      // 3秒后清除消息
      setTimeout(() => setPriceRefreshMsg(null), 3000)
    } else {
      setPriceRefreshMsg(result.message || '刷新失败')
      setTimeout(() => setPriceRefreshMsg(null), 3000)
    }
  }, [apiData])

  // 自动刷新定时器
  useEffect(() => {
    // 清理旧定时器
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
    }

    const intervalMs = getRefreshIntervalMs(settings.refreshFreq)
    if (intervalMs <= 0) {
      setNextRefreshIn(null)
      return
    }

    const intervalSec = intervalMs / 1000
    setNextRefreshIn(intervalSec)

    // 倒计时 + 自动触发
    const countdownTimer = setInterval(() => {
      setNextRefreshIn(prev => {
        if (prev === null) return null
        if (prev <= 1) {
          // 触发自动刷新
          apiData.refreshPrices().then(result => {
            if (result.success) {
              setPriceRefreshMsg(`自动更新 ${result.updated || 0} 个价格`)
              setTimeout(() => setPriceRefreshMsg(null), 3000)
            }
          })
          return intervalSec // 重置倒计时
        }
        return prev - 1
      })
    }, 1000)

    refreshTimerRef.current = countdownTimer

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [settings.refreshFreq, getRefreshIntervalMs]) // eslint-disable-line react-hooks/exhaustive-deps

  // 格式化倒计时显示
  const formatCountdown = (seconds: number | null): string => {
    if (seconds === null) return '手动'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    if (m > 0) return `${m}:${s.toString().padStart(2, '0')}`
    return `${s}s`
  }

  const today = new Date()
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`

  const visibleNav = navItems.filter(
    (item) => {
      if (item.familyOnly && viewMode !== 'family') return false
      if (item.hiddenInPersonalWithFamily && viewMode === 'personal' && apiData.hasFamilyId) return false
      return true
    }
  )

  const isFamily = viewMode === 'family'

  return (
    <SettingsContext.Provider value={settingsCtxValue}>
    <DashboardCtx.Provider
      value={{
        viewMode,
        setViewMode: handleViewModeChange,
        activeTab,
        setActiveTab: handleTabChange,
        selectedMemberId,
        setSelectedMemberId,
        amountVisible,
        setAmountVisible,
        familyMembers,
        apiData,
      }}
    >
      <div
        className={`min-h-screen transition-colors duration-300 ${
          isBluePro
            ? 'bg-gradient-to-br from-blue-950/50 via-sky-950/20 to-background'
            : isFamily
              ? 'bg-gradient-to-br from-amber-50/40 via-orange-50/20 to-background dark:from-amber-950/20 dark:via-orange-950/10 dark:to-background'
              : 'bg-gradient-to-br from-slate-50/60 via-blue-50/20 to-background dark:from-slate-950/40 dark:via-blue-950/10 dark:to-background'
        }`}
      >
        {/* ─── Top Header ─── */}
        <header
          className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-colors duration-300 ${
            isBluePro
              ? 'border-blue-700/30 bg-[hsl(213,58%,13.5%)]/90'
              : isFamily
                ? 'border-amber-200/60 dark:border-amber-800/40 bg-white/80 dark:bg-background/80'
                : 'border-border/60 bg-white/80 dark:bg-background/80'
          }`}
        >
          <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-3 px-3 sm:h-14 sm:gap-4 sm:px-4 lg:px-8">
            {/* Logo + Context Switch */}
            <div className="flex items-center gap-3">
              {/* Brand — 个人👤 / 家庭🏠 对称图标 */}
              <div className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors duration-300 ${
                  isFamily ? 'bg-amber-500 text-white' : 'bg-primary text-primary-foreground'
                }`}>
                  {isFamily ? <Home className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <span className="hidden text-base font-bold tracking-tight text-foreground sm:inline">
                  {"QiJia"}
                </span>
              </div>
            </div>

            {/* ── Unified Context Switcher + Member Selector ── */}
            <div className="relative flex items-center gap-0">
              {/* Personal mode button */}
              <button
                onClick={() => { handleViewModeChange('personal'); setMemberPanelOpen(false) }}
                className={`relative flex items-center gap-1.5 sm:gap-2 rounded-l-full border py-1.5 pl-3 pr-2.5 sm:py-2 sm:pl-4 sm:pr-3 transition-all duration-300 ${
                  !isFamily
                    ? 'z-10 border-primary/40 bg-primary text-primary-foreground shadow-md'
                    : 'border-border bg-card/60 text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <div className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[9px] sm:text-[10px] font-bold transition-all duration-300 ${
                  !isFamily ? 'bg-white/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {(apiData.session?.user?.name || 'U').slice(0, 1).toUpperCase()}
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[11px] sm:text-xs font-semibold">{apiData.session?.user?.name || 'User'}</span>
                  <span className={`text-[9px] sm:text-[10px] transition-colors ${!isFamily ? 'text-primary-foreground/70' : 'text-muted-foreground/60'}`}>我的资产</span>
                </div>
              </button>

              {/* Family mode button — 点击切换模式 + 展开成员面板 */}
              <button
                onClick={() => {
                  if (!isFamily) {
                    handleViewModeChange('family')
                    setMemberPanelOpen(true)
                  } else {
                    setMemberPanelOpen(!memberPanelOpen)
                  }
                }}
                className={`relative flex items-center gap-1.5 sm:gap-2 rounded-r-full border border-l-0 py-1.5 pl-2.5 pr-3 sm:py-2 sm:pl-3 sm:pr-4 transition-all duration-300 ${
                  isFamily
                    ? 'z-10 border-amber-400/50 bg-amber-500 text-white shadow-md'
                    : 'border-border bg-card/60 text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[11px] sm:text-xs font-semibold">家庭</span>
                  <span className={`text-[9px] sm:text-[10px] transition-colors ${isFamily ? 'text-white/70' : 'text-muted-foreground/60'}`}>
                    {isFamily && selectedMemberId
                      ? familyMembers.find(m => m.id === selectedMemberId)?.name || '全部'
                      : familyMembers.length > 0 ? `${familyMembers.length}位成员` : '协作管理'}
                  </span>
                </div>
                {/* 已选成员小指示器 */}
                {isFamily && familyMembers.length > 0 && (
                  <div className="ml-0.5 flex items-center -space-x-1.5">
                    {familyMembers.slice(0, 3).map((m) => (
                      <div
                        key={m.id}
                        className={`h-4 w-4 sm:h-5 sm:w-5 rounded-full border border-amber-400/60 text-[7px] sm:text-[8px] font-bold text-white flex items-center justify-center ${m.color} ${
                          selectedMemberId === m.id ? 'ring-1 ring-white' : ''
                        }`}
                      >
                        {m.initials}
                      </div>
                    ))}
                    {familyMembers.length > 3 && (
                      <div className="h-4 w-4 sm:h-5 sm:w-5 rounded-full border border-amber-400/60 bg-amber-600 text-[7px] sm:text-[8px] font-bold text-white flex items-center justify-center">
                        +{familyMembers.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </button>

              {/* Family member dropdown panel */}
              {memberPanelOpen && isFamily && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMemberPanelOpen(false)} />
                  <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-card shadow-xl overflow-hidden">
                    <div className="border-b border-amber-200/40 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-900/20 px-3 py-2">
                      <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">查看成员数据</span>
                    </div>
                    <div className="p-1.5">
                      {/* 全部成员 */}
                      <button
                        onClick={() => { setSelectedMemberId(null); setMemberPanelOpen(false) }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          !selectedMemberId
                            ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
                            : 'text-foreground hover:bg-muted/60'
                        }`}
                      >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                          !selectedMemberId ? 'bg-amber-500 text-white shadow-sm' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                        }`}>
                          <Users className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold">全部成员</span>
                          <span className="text-[10px] text-muted-foreground">查看家庭整体数据</span>
                        </div>
                        {!selectedMemberId && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-500" />}
                      </button>

                      {/* 各成员 */}
                      {familyMembers.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setSelectedMemberId(selectedMemberId === m.id ? null : m.id); setMemberPanelOpen(false) }}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                            selectedMemberId === m.id
                              ? 'bg-muted/80'
                              : 'hover:bg-muted/40'
                          }`}
                        >
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white ${m.color}`}>
                            {m.initials}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-foreground">{m.name}</span>
                            <span className="text-[10px] text-muted-foreground">{m.role}</span>
                          </div>
                          {selectedMemberId === m.id && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* 使用旧版按钮 - 小屏隐藏 */}
              <button
                onClick={() => router.push('/dashboard')}
                className="hidden items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
              >
                <ArrowLeftRight className="h-3 w-3" />
                <span className="hidden sm:inline">旧版</span>
              </button>

              <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>{dateStr}</span>
              </div>

              <button
                onClick={handleManualPriceRefresh}
                disabled={apiData.isPriceRefreshing || apiData.isLoading}
                className="group relative flex items-center gap-1 rounded-full border border-border bg-card/80 p-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted sm:gap-1.5 sm:px-3 sm:py-1.5"
                title={priceRefreshMsg || (nextRefreshIn !== null ? `${formatCountdown(nextRefreshIn)} 后自动刷新` : '点击手动刷新价格')}
              >
                <RefreshCw className={`h-3 w-3 ${apiData.isPriceRefreshing ? 'animate-spin text-blue-500' : ''}`} />
                <span className={`hidden font-medium sm:inline ${
                  apiData.isPriceRefreshing ? 'text-blue-600' :
                  priceRefreshMsg ? 'text-emerald-600' :
                  'text-muted-foreground'
                }`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {apiData.isPriceRefreshing ? '刷新中...' :
                   priceRefreshMsg ? priceRefreshMsg :
                   nextRefreshIn !== null ? formatCountdown(nextRefreshIn) : '手动刷新'}
                </span>
              </button>

              {/* Exchange Rate Button */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => { setExchangeOpen(!exchangeOpen); setNotifOpen(false) }}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
                >
                  <DollarSign className="h-3 w-3" />
                  <span className="hidden font-medium sm:inline" style={{ fontVariantNumeric: 'tabular-nums' }}>{exchangeRates.usdCny.toFixed(2)}</span>
                </button>

                {exchangeOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setExchangeOpen(false)} />
                    <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-card p-4 shadow-xl">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-semibold text-foreground">汇率监控</span>
                        </div>
                        <button
                          onClick={handleRefreshExchangeRate}
                          disabled={exchangeRefreshing}
                          className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${exchangeRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                      <div className="flex flex-col gap-3">
                        {[
                          { flag: '🇺🇸', pair: 'USD/CNY', rate: exchangeRates.usdCny.toFixed(4), change: '', positive: true },
                          { flag: '🇭🇰', pair: 'HKD/CNY', rate: exchangeRates.hkdCny.toFixed(4), change: '', positive: false },
                        ].map((item) => (
                          <div key={item.pair} className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="text-base">{item.flag}</span>
                              <span className="text-xs text-muted-foreground">{item.pair}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {item.rate}
                              </span>
                              <span className={`text-[10px] font-medium ${item.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                                {item.change}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-right text-[10px] text-muted-foreground/60">
                        更新于 {exchangeUpdatedAt || new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Notification Bell */}
              {(() => {
                // Filter notifications based on user settings
                const src = settings.notificationSources || { maturityReminder: true, paymentReminder: true, largeChangeAlert: true, aiSuggestion: true }
                const allNotifs = apiData.notificationsData?.notifications || []
                const filtered = allNotifs.filter(n => {
                  if (n.type === 'maturity' && !src.maturityReminder) return false
                  if (n.type === 'payment' && !src.paymentReminder) return false
                  if (n.type === 'large_change' && !src.largeChangeAlert) return false
                  if (n.type === 'ai_suggestion' && !src.aiSuggestion) return false
                  return true
                })
                const filteredUrgent = filtered.filter(n => n.priority === 'urgent' || n.priority === 'warning').length

                return (
                  <div className="relative">
                    <button
                      onClick={() => { setNotifOpen(!notifOpen); setExchangeOpen(false) }}
                      className="relative rounded-full border border-border bg-card/80 p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                      aria-label="通知提醒"
                    >
                      <Bell className="h-3.5 w-3.5" />
                      {filtered.length > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                          {filtered.length > 9 ? '9+' : filtered.length}
                        </span>
                      )}
                    </button>

                    {notifOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-card shadow-xl sm:w-96">
                          <div className="flex items-center justify-between border-b border-border px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Bell className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-semibold text-foreground">通知提醒</span>
                              {filteredUrgent > 0 && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                  {filteredUrgent}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="max-h-[400px] overflow-y-auto p-3">
                            {filtered.length === 0 ? (
                              <div className="py-6 text-center text-xs text-muted-foreground">
                                暂无通知
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {filtered.slice(0, 10).map((n) => {
                                  const NIcon = getNotifIcon(n.type)
                                  const iconColor = getNotifIconColor(n.type, n.priority)
                                  const bColor = getNotifBorderColor(n.type, n.priority)
                                  return (
                                    <div key={n.id} className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${bColor}`}>
                                      <NIcon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${iconColor}`} />
                                      <div className="flex flex-1 flex-col gap-1">
                                        <span className="text-[11px] font-medium text-foreground">{n.title}</span>
                                        <span className="text-[11px] leading-relaxed text-muted-foreground">{n.message}</span>
                                        <span className={`self-start rounded px-1.5 py-0.5 text-[9px] font-medium ${n.tagColor}`}>{n.tag}</span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })()}

              {/* AI Assistant Button — 仅家庭视角可用 */}
              {isFamily && (
                <button
                  onClick={() => setAiPanelOpen(!aiPanelOpen)}
                  className="flex items-center gap-1.5 rounded-full border border-purple-200/60 dark:border-purple-800/40 bg-purple-500/10 p-1.5 text-purple-600 dark:text-purple-400 transition-colors hover:bg-purple-500/20"
                  aria-label="AI 资产配置顾问"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                onClick={() => handleTabChange('settings')}
                className={`rounded-full border p-1.5 transition-colors ${
                  activeTab === 'settings'
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-card/80 text-muted-foreground hover:bg-muted'
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
              </button>

              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/10 text-xs font-semibold text-primary">
                {(apiData.session?.user?.name || 'U').slice(0, 2).toUpperCase()}
              </div>
            </div>
          </div>

          {/* ─── Tab Navigation (Level 2) ─── */}
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="flex items-center justify-between">
              <nav className="hidden items-center gap-0.5 lg:flex" role="tablist">
                {visibleNav.map((item) => {
                  const Icon = item.icon
                  const isActive = activeTab === item.id
                  return (
                    <button
                      key={item.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => handleTabChange(item.id)}
                      className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                        isActive
                          ? isFamily ? 'text-amber-700 dark:text-amber-400' : 'text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                      {isActive && (
                        <span
                          className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full ${
                            isFamily ? 'bg-amber-500' : 'bg-primary'
                          }`}
                        />
                      )}
                    </button>
                  )
                })}
              </nav>


            </div>
          </div>
        </header>

        {/* ─── Main Content ─── */}
        <main className="mx-auto max-w-[1440px] px-3 pb-20 pt-4 sm:px-4 sm:py-6 lg:px-8 lg:pb-8 lg:pt-8">
          {apiData.isLoading && !apiData.dashboardData ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">加载数据中...</span>
            </div>
          ) : apiData.error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <span className="text-sm text-red-500">加载失败: {apiData.error}</span>
              <button
                onClick={() => apiData.refresh()}
                className="mt-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                重试
              </button>
            </div>
          ) : (
            children
          )}
        </main>

        {/* ─── AI Advisor Panel ─── */}
        <AIAdvisorPanel open={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />

        {/* ─── Mobile Bottom Navigation ─── */}
        <MobileBottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          viewMode={viewMode}
          hasFamilyId={apiData.hasFamilyId}
        />
      </div>
    </DashboardCtx.Provider>
    </SettingsContext.Provider>
  )
}
