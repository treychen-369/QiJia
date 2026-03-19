'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Target,
  TrendingUp,
  TrendingDown,
  Users,
  Wallet,
  CreditCard,
  FileText,
  RefreshCw,
  Check,
  Minus,
  History,
  Clock,
  Brain,
  Search,
  Copy,
  CheckCheck,
} from 'lucide-react'
import { useDashboardV2 } from '@/app/dashboard-v2/layout'

// ─── Types ─────────────────────────────────────────

interface AITarget {
  categoryCode: string
  categoryName: string
  currentPercent: number
  suggestedPercent: number
  reason: string
  selected: boolean
}

interface AIAction {
  priority: number
  category: string
  categoryName: string
  action: 'BUY' | 'SELL' | 'HOLD'
  amount?: number
  reason: string
}

type Phase = 'idle' | 'collecting' | 'analyzing' | 'result' | 'applying' | 'applied' | 'error'
type PanelTab = 'advisor' | 'history'

interface ContextSummary {
  totalAssets: number
  netWorth: number
  totalLiabilities: number
  debtRatio: number
  memberCount: number
  accountCount: number
  allocation: Array<{ name: string; percentage: number; value: number }>
  topHoldings: Array<{ name: string; value: number }>
  promptPreview?: string
}

interface HistoryItem {
  id: string
  summary: string
  status: string
  confidence: number
  createdAt: string
  appliedAt?: string | null
  targets?: any[]
  modelUsed?: string | null
}

// ─── Helpers ───────────────────────────────────────

function fmtWan(v: number): string {
  if (Math.abs(v) >= 10000) return `¥${(v / 10000).toFixed(1)}万`
  return `¥${v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function statusLabel(s: string): { text: string; cls: string } {
  switch (s) {
    case 'ACCEPTED': return { text: '已采纳', cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' }
    case 'REJECTED': return { text: '已拒绝', cls: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' }
    case 'PARTIAL': return { text: '部分采纳', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' }
    case 'EXPIRED': return { text: '已过期', cls: 'bg-muted text-muted-foreground' }
    case 'PROCESSING': return { text: '分析中', cls: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' }
    case 'ERROR': return { text: '分析失败', cls: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' }
    default: return { text: '待处理', cls: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' }
  }
}

// ─── Component ─────────────────────────────────────

interface AIAdvisorPanelProps {
  open: boolean
  onClose: () => void
}

export function AIAdvisorPanel({ open, onClose }: AIAdvisorPanelProps) {
  const { apiData, viewMode } = useDashboardV2()
  const isFamily = viewMode === 'family'

  // Tab 切换
  const [activeTab, setActiveTab] = useState<PanelTab>('advisor')

  // ─── Advisor 状态 ───
  const [phase, setPhase] = useState<Phase>('idle')
  const [contextSummary, setContextSummary] = useState<ContextSummary | null>(null)
  const [contextExpanded, setContextExpanded] = useState(false)
  const [promptExpanded, setPromptExpanded] = useState(false)
  const [targets, setTargets] = useState<AITarget[]>([])
  const [actions, setActions] = useState<AIAction[]>([])
  const [summary, setSummary] = useState('')
  const [risks, setRisks] = useState<string[]>([])
  const [confidence, setConfidence] = useState(0)
  const [adviceId, setAdviceId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [applyingStatus, setApplyingStatus] = useState<'idle' | 'applying' | 'success' | 'error'>('idle')
  const [modelUsed, setModelUsed] = useState<string | null>(null)
  const [pollingElapsed, setPollingElapsed] = useState(0)

  // 轮询 ref
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const elapsedRef = useRef<NodeJS.Timeout | null>(null)

  // ─── History 状态 ───
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [expandedHistoryDetail, setExpandedHistoryDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ─── Audit 状态 ───
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditData, setAuditData] = useState<{
    systemPrompt?: string
    userPrompt?: string
    reasoningContent?: string
    tokenUsage?: {
      promptTokens?: number
      completionTokens?: number
      totalTokens?: number
      reasoningTokens?: number
      responseTime?: number
    }
    modelUsed?: string
    createdAt?: string
    confidence?: number
  } | null>(null)
  const [auditTab, setAuditTab] = useState<'system' | 'user' | 'reasoning' | 'stats'>('user')

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current)
      elapsedRef.current = null
    }
  }, [])

  // 重置所有 advisor 状态（关闭面板/暂不调整时调用）
  const resetAdvisorState = useCallback(() => {
    stopPolling()
    setPhase('idle')
    setContextSummary(null)
    setContextExpanded(false)
    setPromptExpanded(false)
    setTargets([])
    setActions([])
    setSummary('')
    setRisks([])
    setConfidence(0)
    setAdviceId(null)
    setErrorMsg('')
    setApplyingStatus('idle')
    setModelUsed(null)
    setPollingElapsed(0)
  }, [stopPolling])

  // 关闭面板时重置
  const handleClose = useCallback(() => {
    resetAdvisorState()
    setActiveTab('advisor')
    setExpandedHistoryId(null)
    setExpandedHistoryDetail(null)
    onClose()
  }, [onClose, resetAdvisorState])

  // 暂不调整
  const handleDismiss = useCallback(() => {
    if (adviceId) {
      fetch('/api/allocation/advice-history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adviceId, status: 'REJECTED' }),
      }).catch(() => {})
    }
    resetAdvisorState()
  }, [adviceId, resetAdvisorState])

  // 卸载时清理
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  // 处理 AI 结果数据（从轮询或历史记录中获取）
  const processAdviceResult = useCallback((advice: any, id: string) => {
    setAdviceId(id)
    setSummary(advice.summary || '')
    setConfidence(advice.confidence || 0)
    setRisks(advice.risks || [])
    setActions(advice.actions || [])
    setModelUsed(advice.modelUsed || advice.rawResponse?.model || null)

    const aiTargets: AITarget[] = (advice.targets || []).map((t: any) => ({
      categoryCode: t.categoryCode,
      categoryName: t.categoryName,
      currentPercent: t.currentPercent,
      suggestedPercent: t.suggestedPercent,
      reason: t.reason,
      selected: Math.abs(t.currentPercent - t.suggestedPercent) > 2,
    }))
    setTargets(aiTargets)
    setPhase('result')
    setApplyingStatus('idle')
  }, [])

  // 轮询分析状态
  const startPolling = useCallback((id: string) => {
    stopPolling()
    setPollingElapsed(0)

    // 计时器
    elapsedRef.current = setInterval(() => {
      setPollingElapsed(prev => prev + 1)
    }, 1000)

    // 轮询请求
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/allocation/ai-advice?action=status&adviceId=${id}`)
        if (!res.ok) return

        const data = await res.json()
        if (!data.success) return

        const status = data.data.status

        if (status === 'PROCESSING') {
          // 还在处理中，继续轮询
          return
        }

        // 处理完成，停止轮询
        stopPolling()

        if (status === 'ERROR') {
          setErrorMsg(data.data.errorMessage || data.data.summary || '分析失败')
          setPhase('error')
          return
        }

        // 成功：PENDING 或其他完成状态
        processAdviceResult(data.data, id)
      } catch {
        // 网络错误，继续轮询
      }
    }, 5000) // 每 5 秒轮询
  }, [stopPolling, processAdviceResult])

  // 加载历史记录
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/allocation/advice-history?scope=family&limit=20`)
      const data = await res.json()
      if (data.success) {
        setHistoryItems(data.data || [])
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  // 加载单条历史详情
  const loadHistoryDetail = useCallback(async (id: string) => {
    if (expandedHistoryId === id) {
      setExpandedHistoryId(null)
      setExpandedHistoryDetail(null)
      return
    }
    setExpandedHistoryId(id)
    setDetailLoading(true)
    setExpandedHistoryDetail(null)
    try {
      const res = await fetch(`/api/allocation/advice-history/${id}`)
      const data = await res.json()
      if (data.success) {
        setExpandedHistoryDetail(data.data)
      }
    } catch {
      // ignore
    } finally {
      setDetailLoading(false)
    }
  }, [expandedHistoryId])

  // 从历史记录中应用建议
  const applyFromHistory = useCallback(async (historyDetail: any, historyId: string) => {
    if (!historyDetail?.advice?.targets?.length) return

    // 切换到 advisor tab 并设置结果
    setActiveTab('advisor')
    processAdviceResult({
      ...historyDetail.advice,
      modelUsed: historyDetail.modelUsed,
    }, historyId)
  }, [processAdviceResult])

  // 打开审计弹窗（从当前结果或历史详情）
  const openAudit = useCallback((adviceDetail: any) => {
    const promptUsed = adviceDetail?.advice?.promptUsed || adviceDetail?.promptUsed || {}
    setAuditData({
      systemPrompt: promptUsed.systemPrompt || null,
      userPrompt: promptUsed.userPrompt || null,
      reasoningContent: promptUsed.reasoningContent || null,
      tokenUsage: promptUsed.tokenUsage || null,
      modelUsed: adviceDetail?.modelUsed || null,
      createdAt: adviceDetail?.createdAt || null,
      confidence: adviceDetail?.confidence || adviceDetail?.advice?.confidence || null,
    })
    setAuditTab('user')
    setAuditOpen(true)
  }, [])

  // 从当前分析结果打开审计（需要通过 API 获取完整数据）
  const openAuditForCurrentResult = useCallback(async () => {
    if (!adviceId) return
    try {
      const res = await fetch(`/api/allocation/advice-history/${adviceId}`)
      const data = await res.json()
      if (data.success) {
        openAudit(data.data)
      }
    } catch {
      // ignore
    }
  }, [adviceId, openAudit])

  // 切换到历史 tab 时自动加载
  useEffect(() => {
    if (open && activeTab === 'history') {
      loadHistory()
    }
  }, [open, activeTab, loadHistory])

  // 收集数据上下文 + 调用 AI（异步模式）
  const startAnalysis = useCallback(async () => {
    setPhase('collecting')
    setErrorMsg('')
    setContextExpanded(false)
    setPromptExpanded(false)

    try {
      // Phase 1: 收集上下文摘要
      const overview = isFamily ? apiData.familyOverview : apiData.dashboardData
      const allocationData = isFamily ? apiData.familyAllocationData : apiData.dashboardData?.allocationData
      
      const totalAssets = isFamily 
        ? (overview?.totalAssets || overview?.data?.totalAssets || 0)
        : (overview?.overview?.totalAssets || 0)
      const totalLiabilities = isFamily
        ? (overview?.totalLiabilities || overview?.data?.totalLiabilities || 0)
        : (overview?.overview?.totalLiabilities || allocationData?.liabilityInfo?.totalLiabilities || 0)
      const netWorth = totalAssets - totalLiabilities
      const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0

      const memberCount = isFamily ? (apiData.familyMembers?.length || 0) : 1
      const accountCount = apiData.dashboardData?.accounts?.length || 0

      const fullAnalysisData = allocationData?.fullAnalysis || []
      const allocation = fullAnalysisData.map((a: any) => ({
        name: a.categoryName || a.name || '',
        percentage: a.currentPercent ?? a.percentage ?? 0,
        value: a.currentValue ?? a.value ?? 0,
      }))

      const holdings = isFamily ? apiData.familyHoldings : ((apiData.dashboardData as any)?.holdings || [])
      const topHoldings = [...(holdings || [])]
        .sort((a: any, b: any) => (b.marketValueCNY || b.marketValue || 0) - (a.marketValueCNY || a.marketValue || 0))
        .slice(0, 5)
        .map((h: any) => ({
          name: h.securityName || h.name || h.symbol || '',
          value: h.marketValueCNY || h.marketValue || 0,
        }))

      let promptPreview = ''
      try {
        const promptRes = await fetch(`/api/allocation/ai-advice?action=preview-prompt&scope=${isFamily ? 'family' : 'personal'}`)
        const promptData = await promptRes.json()
        if (promptData.success) {
          promptPreview = promptData.data.userPrompt || ''
        }
      } catch {
        // ignore
      }

      const ctx: ContextSummary = {
        totalAssets, netWorth, totalLiabilities, debtRatio,
        memberCount, accountCount, allocation, topHoldings, promptPreview,
      }
      setContextSummary(ctx)

      // Phase 2: 发起异步 AI 分析
      setPhase('analyzing')

      const res = await fetch('/api/allocation/ai-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: isFamily ? 'family' : 'personal' }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '请求失败' }))
        throw new Error(err.error || `请求失败 (${res.status})`)
      }

      const data = await res.json()
      if (!data.success) throw new Error(data.error || '创建分析任务失败')

      const result = data.data
      setAdviceId(result.adviceId)
      setModelUsed(result.modelUsed || null)

      if (result.status === 'PROCESSING') {
        // 异步模式：开始轮询
        startPolling(result.adviceId)
      } else {
        // 同步返回（mock 模式）
        processAdviceResult(result, result.adviceId)
      }
    } catch (err) {
      console.error('[AI Advisor] 分析失败:', err)
      setErrorMsg(err instanceof Error ? err.message : '分析失败')
      setPhase('error')
    }
  }, [isFamily, apiData, startPolling, processAdviceResult])

  const toggleTarget = (idx: number) => {
    setTargets(prev => prev.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t))
  }

  const toggleAll = () => {
    const allSelected = targets.every(t => t.selected)
    setTargets(prev => prev.map(t => ({ ...t, selected: !allSelected })))
  }

  const applySelectedTargets = useCallback(async () => {
    const selected = targets.filter(t => t.selected)
    if (selected.length === 0) return

    setApplyingStatus('applying')

    try {
      const res = await fetch('/api/allocation/targets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets: selected.map(t => ({
            categoryCode: t.categoryCode,
            categoryName: t.categoryName,
            targetPercent: t.suggestedPercent,
          })),
          source: 'AI_ADVICE',
          adviceId,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '更新失败' }))
        throw new Error(err.error || '更新配置目标失败')
      }

      setApplyingStatus('success')
      setPhase('applied')

      await apiData.refresh(true)
      if (isFamily) await apiData.refreshFamily()
    } catch (err) {
      console.error('[AI Advisor] 采纳失败:', err)
      setApplyingStatus('error')
    }
  }, [targets, adviceId, apiData, isFamily])

  if (!open) return null

  const selectedCount = targets.filter(t => t.selected).length

  // 格式化已用时间
  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}秒`
    return `${Math.floor(s / 60)}分${s % 60}秒`
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={handleClose} />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-card shadow-2xl sm:w-[520px]"
        style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">AI 资产配置顾问</h3>
              <span className="text-[10px] text-muted-foreground">
                家庭资产分析 · DeepSeek {modelUsed === 'deepseek-reasoner' ? 'R1 思考模式' : ''}
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ─── Tab Switcher ─── */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('advisor')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              activeTab === 'advisor'
                ? 'border-b-2 border-purple-500 text-purple-600'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="h-3 w-3" />
            配置分析
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              activeTab === 'history'
                ? 'border-b-2 border-purple-500 text-purple-600'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="h-3 w-3" />
            咨询记录
          </button>
        </div>

        {/* ─── Content ─── */}
        <div className="flex-1 overflow-y-auto">

          {/* ═══════ Advisor Tab ═══════ */}
          {activeTab === 'advisor' && (
            <>
              {/* Idle State */}
              {phase === 'idle' && (
                <div className="flex flex-col items-center justify-center gap-6 px-6 py-16">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-100/60 dark:bg-purple-900/30">
                    <Brain className="h-10 w-10 text-purple-500" />
                  </div>
                  <div className="text-center">
                    <h4 className="text-base font-semibold text-foreground">
                      家庭资产深度分析
                    </h4>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      AI 将使用 DeepSeek R1 思考模式，对您的家庭资产进行多维度深度推理分析，<br />
                      生成专业的配置分析报告和调仓建议。
                    </p>
                    <p className="mt-1.5 text-[10px] text-muted-foreground/60">
                      深度分析通常需要 2-5 分钟，您可以在等待期间查看其他页面
                    </p>
                  </div>
                  <button
                    onClick={startAnalysis}
                    className="flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-700"
                  >
                    <Brain className="h-4 w-4" />
                    开始深度分析
                  </button>
                </div>
              )}

              {/* Collecting State */}
              {phase === 'collecting' && (
                <div className="flex flex-col gap-6 px-6 py-8">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">正在收集数据...</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        收集资产构成、负债、持仓等数据
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Analyzing State (Async Polling) */}
              {phase === 'analyzing' && (
                <div className="flex flex-col gap-6 px-6 py-8">
                  <div className="flex flex-col items-center gap-4">
                    {/* 思考模式动画 */}
                    <div className="relative">
                      <div className="h-16 w-16 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Brain className="h-8 w-8 text-purple-500 animate-pulse" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500">
                        <Loader2 className="h-3 w-3 animate-spin text-white" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">
                        AI 深度推理分析中
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        DeepSeek R1 正在进行多步推理，已用时 {formatElapsed(pollingElapsed)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                        深度分析通常需要 2-5 分钟，您可以先去查看其他页面
                      </p>
                    </div>

                    {/* 进度提示 */}
                    <div className="w-full max-w-xs">
                      <div className="flex flex-col gap-1.5">
                        <AnalysisStep done={pollingElapsed > 0} label="数据收集" desc="资产、负债、持仓" />
                        <AnalysisStep done={pollingElapsed > 3} label="提交分析" desc="构建提示词，发送到 AI" />
                        <AnalysisStep done={pollingElapsed > 10} active={pollingElapsed > 3 && pollingElapsed <= 10} label="多步推理" desc="评估风险、约束条件、联动影响" />
                        <AnalysisStep active={pollingElapsed > 10} label="生成报告" desc="配置建议、调仓计划、风险提示" />
                      </div>
                    </div>
                  </div>
                  {contextSummary && (
                    <ContextSummaryCard
                      ctx={contextSummary}
                      expanded={contextExpanded}
                      onToggle={() => setContextExpanded(!contextExpanded)}
                      promptExpanded={promptExpanded}
                      onTogglePrompt={() => setPromptExpanded(!promptExpanded)}
                    />
                  )}
                </div>
              )}

              {/* Error State */}
              {phase === 'error' && (
                <div className="flex flex-col gap-6 px-6 py-8">
                  {contextSummary && (
                    <ContextSummaryCard
                      ctx={contextSummary}
                      expanded={contextExpanded}
                      onToggle={() => setContextExpanded(!contextExpanded)}
                      promptExpanded={promptExpanded}
                      onTogglePrompt={() => setPromptExpanded(!promptExpanded)}
                    />
                  )}
                  <div className="flex flex-col items-center gap-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/20 p-6">
                    <AlertTriangle className="h-8 w-8 text-red-500" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">分析失败</p>
                      <p className="mt-1 text-xs text-muted-foreground">{errorMsg}</p>
                    </div>
                    <button
                      onClick={startAnalysis}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <RefreshCw className="h-3 w-3" />
                      重试
                    </button>
                  </div>
                </div>
              )}

              {/* Result / Applied State */}
              {(phase === 'result' || phase === 'applied') && (
                <div className="flex flex-col gap-5 px-6 py-5">
                  {contextSummary && (
                    <ContextSummaryCard
                      ctx={contextSummary}
                      expanded={contextExpanded}
                      onToggle={() => setContextExpanded(!contextExpanded)}
                      promptExpanded={promptExpanded}
                      onTogglePrompt={() => setPromptExpanded(!promptExpanded)}
                    />
                  )}

                  {/* Summary */}
                  <div className="rounded-xl border border-purple-200/60 dark:border-purple-800/40 bg-purple-50/20 dark:bg-purple-950/20 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                      <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">AI 分析摘要</span>
                      {confidence > 0 && (
                        <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-600 dark:text-purple-400">
                          置信度 {(confidence * 100).toFixed(0)}%
                        </span>
                      )}
                      {modelUsed && (
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-600 dark:text-blue-400">
                          {modelUsed === 'deepseek-reasoner' ? 'R1 深度分析' : modelUsed}
                        </span>
                      )}
                      <button
                        onClick={openAuditForCurrentResult}
                        className="ml-auto flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="审计：查看AI输入输出详情"
                      >
                        <Search className="h-2.5 w-2.5" />
                        审计
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground">{summary}</p>
                  </div>

                  {/* Targets */}
                  {targets.length > 0 && (
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Target className="h-4 w-4 text-purple-500" />
                          调仓建议
                        </h4>
                        {phase === 'result' && (
                          <button
                            onClick={toggleAll}
                            className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {targets.every(t => t.selected) ? '取消全选' : '全选'}
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {targets.map((t, idx) => {
                          const diff = t.suggestedPercent - t.currentPercent
                          const isIncrease = diff > 0
                          return (
                            <div
                              key={t.categoryCode}
                              onClick={() => phase === 'result' && toggleTarget(idx)}
                              className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                                phase === 'result' ? 'cursor-pointer hover:shadow-sm' : ''
                              } ${
                                t.selected
                                  ? 'border-purple-300 dark:border-purple-700 bg-purple-500/10'
                                  : 'border-border bg-card'
                              }`}
                            >
                              {phase === 'result' && (
                                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                                  t.selected
                                    ? 'border-purple-500 bg-purple-500 text-white'
                                    : 'border-border bg-background'
                                }`}>
                                  {t.selected && <Check className="h-3 w-3" />}
                                </div>
                              )}
                              {phase === 'applied' && (
                                <CheckCircle2 className={`h-4 w-4 shrink-0 ${t.selected ? 'text-emerald-500' : 'text-muted-foreground/30'}`} />
                              )}
                              <div className="flex flex-1 flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-foreground">{t.categoryName}</span>
                                  <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${
                                    isIncrease ? 'text-emerald-600' : diff < 0 ? 'text-amber-600' : 'text-muted-foreground'
                                  }`}>
                                    {isIncrease ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                    {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                  <span>当前 {fmtPct(t.currentPercent)}</span>
                                  <span>→</span>
                                  <span className="font-medium text-foreground">建议 {fmtPct(t.suggestedPercent)}</span>
                                </div>
                                {t.reason && (
                                  <span className="text-[10px] text-muted-foreground">{t.reason}</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {actions.length > 0 && (
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                        <FileText className="h-4 w-4 text-blue-500" />
                        执行步骤
                      </h4>
                      <div className="flex flex-col gap-1.5">
                        {actions.map((a, i) => {
                          const tag = a.priority <= 1
                            ? { text: '高', cls: 'bg-red-500/10 text-red-500' }
                            : a.priority <= 2
                            ? { text: '中', cls: 'bg-amber-500/10 text-amber-600' }
                            : { text: '低', cls: 'bg-emerald-500/10 text-emerald-600' }
                          return (
                            <div key={i} className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
                              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${tag.cls}`}>
                                {tag.text}
                              </span>
                              <span className="flex-1 text-xs text-foreground">{a.reason}</span>
                              {a.amount && a.amount > 0 && (
                                <span className="shrink-0 text-[11px] font-medium text-muted-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                  {fmtWan(a.amount)}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Risks */}
                  {risks.length > 0 && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        风险提示
                      </h4>
                      <div className="flex flex-col gap-1">
                        {risks.map((r, i) => (
                          <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2">
                            <span className="mt-0.5 text-[10px] text-amber-500">•</span>
                            <span className="text-[11px] text-foreground">{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div className="rounded-xl bg-muted/30 p-3">
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      以上分析由 AI 自动生成，仅供参考，不构成投资建议。投资有风险，决策需谨慎。
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══════ History Tab ═══════ */}
          {activeTab === 'history' && (
            <div className="px-6 py-5">
              {historyLoading ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">加载咨询记录...</span>
                </div>
              ) : historyItems.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-12">
                  <History className="h-10 w-10 text-muted-foreground/30" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground">暂无咨询记录</p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      切换到「配置分析」开始首次 AI 咨询
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      共 {historyItems.length} 条记录
                    </span>
                    <button
                      onClick={loadHistory}
                      className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  </div>

                  {historyItems.map((item) => {
                    const st = statusLabel(item.status)
                    const isExpanded = expandedHistoryId === item.id

                    return (
                      <div key={item.id} className="rounded-xl border border-border transition-all">
                        {/* Summary row */}
                        <button
                          onClick={() => loadHistoryDetail(item.id)}
                          className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/20"
                        >
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                            {item.status === 'PROCESSING' ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                            )}
                          </div>
                          <div className="flex flex-1 flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${st.cls}`}>
                                {st.text}
                              </span>
                              {item.confidence > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  置信度 {(Number(item.confidence) * 100).toFixed(0)}%
                                </span>
                              )}
                              {item.modelUsed && (
                                <span className="text-[10px] text-blue-500">
                                  {item.modelUsed === 'deepseek-reasoner' ? 'R1' : item.modelUsed === 'deepseek-chat' ? 'V3' : ''}
                                </span>
                              )}
                            </div>
                            <p className="line-clamp-2 text-xs leading-relaxed text-foreground">
                              {item.summary}
                            </p>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {fmtDate(item.createdAt)}
                              {item.appliedAt && (
                                <span className="ml-2 text-emerald-600">
                                  · 已于 {fmtDate(item.appliedAt)} 应用
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronDown className={`mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="border-t border-border px-3 pb-3 pt-2">
                            {detailLoading ? (
                              <div className="flex items-center gap-2 py-3">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">加载详情...</span>
                              </div>
                            ) : expandedHistoryDetail ? (
                              <div className="flex flex-col gap-3">
                                {/* Targets */}
                                {expandedHistoryDetail.advice?.targets?.length > 0 && (
                                  <div>
                                    <span className="text-[10px] font-medium text-muted-foreground">调仓建议</span>
                                    <div className="mt-1.5 flex flex-col gap-1">
                                      {expandedHistoryDetail.advice.targets.map((t: any, i: number) => {
                                        const diff = (t.suggestedPercent || 0) - (t.currentPercent || 0)
                                        return (
                                          <div key={i} className="flex items-center justify-between rounded-lg bg-muted/20 px-2.5 py-1.5">
                                            <span className="text-[11px] text-foreground">{t.categoryName}</span>
                                            <div className="flex items-center gap-2 text-[11px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                              <span className="text-muted-foreground">{fmtPct(t.currentPercent || 0)}</span>
                                              <span className="text-muted-foreground">→</span>
                                              <span className="font-medium text-foreground">{fmtPct(t.suggestedPercent || 0)}</span>
                                              <span className={`font-semibold ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                                              </span>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Risks */}
                                {expandedHistoryDetail.advice?.risks?.length > 0 && (
                                  <div>
                                    <span className="text-[10px] font-medium text-muted-foreground">风险提示</span>
                                    <div className="mt-1 flex flex-col gap-0.5">
                                      {expandedHistoryDetail.advice.risks.map((r: string, i: number) => (
                                        <div key={i} className="flex items-start gap-1.5 text-[11px] text-foreground">
                                          <span className="mt-0.5 text-amber-500">•</span>
                                          <span>{r}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Full Analysis */}
                                {expandedHistoryDetail.advice?.fullAnalysis && (
                                  <div>
                                    <span className="text-[10px] font-medium text-muted-foreground">完整分析</span>
                                    <div className="mt-1 rounded-lg bg-muted/10 p-2">
                                      <FormattedAnalysis content={expandedHistoryDetail.advice.fullAnalysis} />
                                    </div>
                                  </div>
                                )}

                                {/* Apply button for PENDING items */}
                                {(item.status === 'PENDING') && expandedHistoryDetail.advice?.targets?.length > 0 && (
                                  <button
                                    onClick={() => applyFromHistory(expandedHistoryDetail, item.id)}
                                    className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-purple-700"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    查看并应用此建议
                                  </button>
                                )}

                                {/* Audit button */}
                                <button
                                  onClick={() => openAudit(expandedHistoryDetail)}
                                  className="mt-1 flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                >
                                  <Search className="h-3 w-3" />
                                  审计：查看AI输入输出
                                </button>
                              </div>
                            ) : (
                              <p className="py-2 text-xs text-muted-foreground">加载失败</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Footer Actions ─── */}
        {activeTab === 'advisor' && phase === 'analyzing' && (
          <div className="border-t border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  // 切换到历史 tab，轮询继续在后台
                  setActiveTab('history')
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <History className="h-3 w-3" />
                查看咨询记录
              </button>
              <button
                onClick={handleClose}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                先去别处看看
              </button>
            </div>
          </div>
        )}

        {activeTab === 'advisor' && phase === 'result' && (
          <div className="border-t border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleDismiss}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                暂不调整
              </button>
              <button
                onClick={applySelectedTargets}
                disabled={selectedCount === 0 || applyingStatus === 'applying'}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-purple-700 disabled:opacity-50"
              >
                {applyingStatus === 'applying' ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    应用中...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    应用选中的建议 ({selectedCount})
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'advisor' && phase === 'applied' && (
          <div className="border-t border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex flex-1 items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">配置目标已更新，仪表板数据已刷新</span>
              </div>
              <button
                onClick={resetAdvisorState}
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                <RefreshCw className="h-3 w-3" />
                重新分析
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Audit Modal ─── */}
      {auditOpen && auditData && (
        <AuditModal
          data={auditData}
          activeTab={auditTab}
          onTabChange={setAuditTab}
          onClose={() => setAuditOpen(false)}
        />
      )}
    </>
  )
}

// ─── Audit Modal ──────────────────────────────────

type AuditTabType = 'system' | 'user' | 'reasoning' | 'stats'

interface AuditModalProps {
  data: {
    systemPrompt?: string
    userPrompt?: string
    reasoningContent?: string
    tokenUsage?: {
      promptTokens?: number
      completionTokens?: number
      totalTokens?: number
      reasoningTokens?: number
      responseTime?: number
    }
    modelUsed?: string
    createdAt?: string
    confidence?: number
  }
  activeTab: AuditTabType
  onTabChange: (tab: AuditTabType) => void
  onClose: () => void
}

function AuditModal({ data, activeTab, onTabChange, onClose }: AuditModalProps) {
  const [copied, setCopied] = useState(false)

  const copyContent = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [])

  const tabs: { key: AuditTabType; label: string; icon: any; count?: string }[] = [
    { key: 'user', label: '用户提示词', icon: FileText, count: data.userPrompt ? `${data.userPrompt.length}字` : undefined },
    { key: 'system', label: '系统提示词', icon: Brain, count: data.systemPrompt ? `${data.systemPrompt.length}字` : undefined },
    { key: 'reasoning', label: 'AI思维链', icon: Sparkles, count: data.reasoningContent ? `${data.reasoningContent.length}字` : undefined },
    { key: 'stats', label: '统计信息', icon: Target },
  ]

  const currentContent = activeTab === 'system' ? data.systemPrompt
    : activeTab === 'user' ? data.userPrompt
    : activeTab === 'reasoning' ? data.reasoningContent
    : null

  return (
    <>
      {/* Modal backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-4 z-[70] flex flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-[10%] sm:inset-y-[5%] lg:inset-x-[15%] lg:inset-y-[8%]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Search className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">AI 分析审计</h3>
              <span className="text-[10px] text-muted-foreground">
                查看AI分析的完整输入、思维过程和统计信息
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            const hasContent = tab.key === 'stats' || (
              tab.key === 'system' ? !!data.systemPrompt :
              tab.key === 'user' ? !!data.userPrompt :
              !!data.reasoningContent
            )
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-b-2 border-amber-500 text-amber-600 dark:text-amber-400'
                    : hasContent
                    ? 'text-muted-foreground hover:text-foreground'
                    : 'text-muted-foreground/40 cursor-not-allowed'
                }`}
                disabled={!hasContent}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.slice(0, 2)}</span>
                {tab.count && (
                  <span className="hidden text-[9px] text-muted-foreground/60 sm:inline">({tab.count})</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'stats' ? (
            <div className="h-full overflow-y-auto p-6">
              <div className="flex flex-col gap-5">
                {/* Model Info */}
                <div className="rounded-xl border border-border p-4">
                  <h4 className="mb-3 text-xs font-semibold text-muted-foreground">模型信息</h4>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <StatCell label="模型" value={data.modelUsed || '未知'} />
                    <StatCell label="置信度" value={data.confidence ? `${(Number(data.confidence) * 100).toFixed(0)}%` : '—'} />
                    <StatCell label="分析时间" value={data.createdAt ? new Date(data.createdAt).toLocaleString('zh-CN') : '—'} />
                  </div>
                </div>

                {/* Token Usage */}
                {data.tokenUsage && (
                  <div className="rounded-xl border border-border p-4">
                    <h4 className="mb-3 text-xs font-semibold text-muted-foreground">Token 用量</h4>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <StatCell label="输入 Tokens" value={data.tokenUsage.promptTokens?.toLocaleString() || '—'} />
                      <StatCell label="输出 Tokens" value={data.tokenUsage.completionTokens?.toLocaleString() || '—'} />
                      <StatCell label="总 Tokens" value={data.tokenUsage.totalTokens?.toLocaleString() || '—'} highlight />
                      <StatCell label="推理 Tokens" value={data.tokenUsage.reasoningTokens?.toLocaleString() || '—'} />
                      <StatCell label="响应耗时" value={data.tokenUsage.responseTime ? `${(data.tokenUsage.responseTime / 1000).toFixed(1)}s` : '—'} />
                      {data.tokenUsage.totalTokens && data.tokenUsage.totalTokens > 0 && (
                        <StatCell
                          label="推理占比"
                          value={data.tokenUsage.reasoningTokens
                            ? `${((data.tokenUsage.reasoningTokens / data.tokenUsage.totalTokens) * 100).toFixed(0)}%`
                            : '—'}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Prompt Sizes */}
                <div className="rounded-xl border border-border p-4">
                  <h4 className="mb-3 text-xs font-semibold text-muted-foreground">内容统计</h4>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <StatCell label="系统提示词" value={data.systemPrompt ? `${data.systemPrompt.length} 字` : '无'} />
                    <StatCell label="用户提示词" value={data.userPrompt ? `${data.userPrompt.length} 字` : '无'} />
                    <StatCell label="思维链" value={data.reasoningContent ? `${data.reasoningContent.length} 字` : '无'} />
                  </div>
                </div>

                {/* No token data hint */}
                {!data.tokenUsage && (
                  <div className="rounded-xl bg-amber-500/10 p-4 text-center">
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      该记录未包含 Token 用量数据（可能是早期生成的建议或 Mock 模式）
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : currentContent ? (
            <div className="flex h-full flex-col">
              {/* Copy button */}
              <div className="flex items-center justify-between border-b border-border/50 px-6 py-2">
                <span className="text-[10px] text-muted-foreground">
                  {currentContent.length.toLocaleString()} 字符 · {currentContent.split('\n').length} 行
                </span>
                <button
                  onClick={() => copyContent(currentContent)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {copied ? (
                    <>
                      <CheckCheck className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-500">已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      复制内容
                    </>
                  )}
                </button>
              </div>
              {/* Pre content */}
              <div className="flex-1 overflow-auto p-6">
                <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-foreground">
                  {currentContent}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <p className="text-xs text-muted-foreground">
                {activeTab === 'reasoning' ? '该记录未包含 AI 思维链数据' : '该记录未包含此项内容'}
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                {activeTab === 'reasoning'
                  ? '思维链仅在使用 DeepSeek R1 模式时生成'
                  : '可能是早期版本生成的建议'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-muted/20 p-2.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold ${highlight ? 'text-purple-600 dark:text-purple-400' : 'text-foreground'}`}
            style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  )
}

// ─── Analysis Step Indicator ──────────────────────

function AnalysisStep({ done, active, label, desc }: { done?: boolean; active?: boolean; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
        done ? 'bg-emerald-500 text-white' :
        active ? 'bg-purple-500 text-white' :
        'bg-muted text-muted-foreground'
      }`}>
        {done ? (
          <Check className="h-3 w-3" />
        ) : active ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <span className="text-[10px]">·</span>
        )}
      </div>
      <div className="flex flex-col">
        <span className={`text-[11px] font-medium ${done || active ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
        <span className="text-[10px] text-muted-foreground">{desc}</span>
      </div>
    </div>
  )
}

// ─── Context Summary Sub-component ─────────────────

function ContextSummaryCard({
  ctx,
  expanded,
  onToggle,
  promptExpanded,
  onTogglePrompt,
}: {
  ctx: ContextSummary
  expanded: boolean
  onToggle: () => void
  promptExpanded: boolean
  onTogglePrompt: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/10">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/20"
      >
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">输入数据摘要</span>
          <span className="text-[10px] text-muted-foreground">
            {ctx.memberCount}人 · {fmtWan(ctx.totalAssets)} · {ctx.allocation.length}类资产
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <div className="mb-3 grid grid-cols-3 gap-3">
            <MetricCell icon={Wallet} label="总资产" value={fmtWan(ctx.totalAssets)} />
            <MetricCell icon={TrendingUp} label="净资产" value={fmtWan(ctx.netWorth)} />
            <MetricCell icon={CreditCard} label="总负债" value={fmtWan(ctx.totalLiabilities)} />
          </div>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <MetricCell icon={Target} label="负债率" value={fmtPct(ctx.debtRatio)} />
            <MetricCell icon={Users} label="成员数" value={`${ctx.memberCount}人`} />
            <MetricCell icon={Wallet} label="账户数" value={`${ctx.accountCount}个`} />
          </div>

          {ctx.allocation.length > 0 && (
            <div className="mb-3">
              <span className="text-[10px] font-medium text-muted-foreground">资产构成</span>
              <div className="mt-1.5 flex flex-col gap-1">
                {ctx.allocation.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="text-foreground">{a.name}</span>
                    <span className="text-muted-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtPct(a.percentage)} ({fmtWan(a.value)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ctx.topHoldings.length > 0 && (
            <div className="mb-3">
              <span className="text-[10px] font-medium text-muted-foreground">持仓 TOP {ctx.topHoldings.length}</span>
              <div className="mt-1.5 flex flex-col gap-1">
                {ctx.topHoldings.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="text-foreground">{h.name}</span>
                    <span className="text-muted-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtWan(h.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ctx.promptPreview && (
            <div>
              <button
                onClick={(e) => { e.stopPropagation(); onTogglePrompt() }}
                className="flex items-center gap-1 text-[10px] text-purple-500 transition-colors hover:text-purple-700"
              >
                <FileText className="h-3 w-3" />
                {promptExpanded ? '收起完整 Prompt' : '查看完整 Prompt'}
              </button>
              {promptExpanded && (
                <pre className="mt-2 max-h-[300px] overflow-auto rounded-lg bg-muted/30 p-3 text-[10px] leading-relaxed text-muted-foreground">
                  {ctx.promptPreview}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MetricCell({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-background p-2">
      <div className="flex items-center gap-1">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <span className="text-xs font-semibold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  )
}

// ─── Markdown Formatter ────────────────────────────

function renderMarkdown(md: string): string {
  if (!md) return ''
  const lines = md.split('\n')
  const html: string[] = []
  let inTable = false
  let inList = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (/^\|[\s\-:|]+\|$/.test(line.trim())) continue
      if (!inTable) {
        if (inList) { html.push('</ul>'); inList = false }
        html.push('<table class="w-full text-[11px] border-collapse my-2">')
        inTable = true
      }
      const cells = line.split('|').filter(c => c.trim() !== '')
      html.push('<tr>' + cells.map(c => `<td class="border border-border/40 px-2 py-1.5 text-foreground">${inlineMd(c.trim())}</td>`).join('') + '</tr>')
      continue
    } else if (inTable) {
      html.push('</table>')
      inTable = false
    }

    const h3Match = line.match(/^###\s+(.+)/)
    if (h3Match) {
      if (inList) { html.push('</ul>'); inList = false }
      html.push(`<h4 class="text-xs font-bold text-foreground mt-4 mb-1.5">${inlineMd(h3Match[1])}</h4>`)
      continue
    }
    const h2Match = line.match(/^##\s+(.+)/)
    if (h2Match) {
      if (inList) { html.push('</ul>'); inList = false }
      html.push(`<h3 class="text-sm font-bold text-foreground mt-5 mb-2 pb-1 border-b border-border/40">${inlineMd(h2Match[1])}</h3>`)
      continue
    }

    const listMatch = line.match(/^\s*(?:\d+\.|[-*·])\s+(.+)/)
    if (listMatch) {
      if (!inList) { html.push('<ul class="flex flex-col gap-1 my-1.5">'); inList = true }
      html.push(`<li class="flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground"><span class="mt-1 h-1 w-1 shrink-0 rounded-full bg-foreground/30"></span><span>${inlineMd(listMatch[1])}</span></li>`)
      continue
    } else if (inList && line.trim() === '') {
      html.push('</ul>')
      inList = false
      continue
    }

    if (line.trim() === '') continue

    if (inList) { html.push('</ul>'); inList = false }
    html.push(`<p class="text-[11px] leading-relaxed text-foreground my-1">${inlineMd(line)}</p>`)
  }

  if (inTable) html.push('</table>')
  if (inList) html.push('</ul>')
  return html.join('')
}

function inlineMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-muted/40 px-1 py-0.5 text-[10px] font-mono">$1</code>')
}

function FormattedAnalysis({ content }: { content: string }) {
  const html = useMemo(() => renderMarkdown(content || ''), [content])
  if (!content) return null
  return (
    <div
      className="formatted-analysis"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
