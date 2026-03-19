'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Target,
  RefreshCw,
  CheckCircle2,
  Circle,
  SkipForward,
  Edit3,
  Plus,
  XCircle,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react'
import { useDashboardV2 } from '@/app/dashboard-v2/layout'
import { formatCurrency } from './use-dashboard-v2-data'

// ─── 类型 ───

interface PlanProgress {
  totalTasks: number
  completedTasks: number
  skippedTasks: number
  pendingTasks: number
  completedAmount: number
  pendingAmount: number
  totalAmount: number
  percent: number
  currentPeriod: number
}

interface TaskItem {
  id: string
  periodNumber: number
  categoryCode: string
  categoryName: string
  action: string
  targetAmount: number
  actualAmount: number | null
  status: string
  dueDate: string
  completedAt: string | null
  notes: string | null
  isCustom: boolean
}

interface AutoProgressItem {
  categoryCode: string
  categoryName: string
  action: 'BUY' | 'SELL'
  snapshotValue: number
  currentValue: number
  actualChange: number
  targetTotalAmount: number
  autoPercent: number
  snapshotPercent: number
  currentPercent: number
  targetPercent: number
  percentChange: number
}

interface AutoProgress {
  items: AutoProgressItem[]
  overallPercent: number
  snapshotDate: string
  calculatedAt: string
}

interface PlanData {
  id: string
  name: string
  status: string
  periodType: string
  totalPeriods: number
  totalGapAmount: number
  startDate: string
  endDate: string
  adviceId: string | null
  strategySource: 'AI' | 'ALGORITHM' | null
  strategyReasoning: string | null
  createdAt: string
  progress: PlanProgress
  autoProgress: AutoProgress | null
  tasks: TaskItem[]
}

interface AnalysisItem {
  categoryCode: string
  categoryName: string
  currentPercent: number
  targetPercent: number
  deviation: number
  deviationStatus: string
  suggestedAction: string
  currentValue: number
  color?: string
}

// ─── 常量 ───

const CATEGORY_COLORS: Record<string, string> = {
  EQUITY: '#3B82F6',
  FIXED_INCOME: '#8B5CF6',
  CASH: '#10B981',
  REAL_ESTATE: '#F59E0B',
  ALTERNATIVE: '#EF4444',
}

const CATEGORY_BG: Record<string, string> = {
  EQUITY: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  FIXED_INCOME: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  CASH: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  REAL_ESTATE: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  ALTERNATIVE: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
}

const PERIOD_LABELS: Record<string, string> = {
  WEEKLY: '每周',
  BIWEEKLY: '每两周',
  MONTHLY: '每月',
}

// ─── 组件 ───

export function FutureTab() {
  const { viewMode, apiData } = useDashboardV2()
  const isFamily = viewMode === 'family'

  const [plan, setPlan] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [expandedPeriods, setExpandedPeriods] = useState<Set<number>>(new Set())
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')

  const scope = isFamily ? 'family' : 'personal'

  // ─── 从 apiData 中获取分析数据（与总览页一致，由 ViewConfig 统一选择数据源） ───
  const allocation = isFamily ? apiData.familyAllocationData : apiData.dashboardData?.allocationData
  const analysis: AnalysisItem[] = useMemo(() => {
    const fullAnalysis = allocation?.fullAnalysis || []
    return fullAnalysis.filter((a: AnalysisItem) => a.categoryCode && a.currentPercent !== undefined)
  }, [allocation])

  // ─── 数据加载 ───

  const fetchPlan = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/rebalance/plan?scope=${scope}`)
      const data = await res.json()
      if (data.success) setPlan(data.data || null)
    } catch (e) {
      console.error('[FutureTab] 加载计划失败:', e)
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => {
    fetchPlan()
  }, [fetchPlan])

  // ─── 操作 ───

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/rebalance/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      })
      const data = await res.json()
      if (data.success) {
        setPlan(data.data)
      } else {
        alert(data.error || '生成计划失败')
      }
    } catch (e) {
      console.error('[FutureTab] 生成计划失败:', e)
    } finally {
      setGenerating(false)
    }
  }, [scope])

  const handleCancelPlan = useCallback(async () => {
    if (!plan) return
    if (!confirm('确定取消当前计划？')) return
    try {
      await fetch(`/api/rebalance/plan?planId=${plan.id}`, { method: 'DELETE' })
      setPlan(null)
    } catch (e) {
      console.error('[FutureTab] 取消计划失败:', e)
    }
  }, [plan])

  const handleTaskAction = useCallback(async (taskId: string, action: 'complete' | 'skip', actualAmount?: number) => {
    try {
      const res = await fetch(`/api/rebalance/task/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, actualAmount }),
      })
      if ((await res.json()).success) fetchPlan()
    } catch (e) {
      console.error('[FutureTab] 任务操作失败:', e)
    }
  }, [fetchPlan])

  const handleUpdateTaskAmount = useCallback(async (taskId: string) => {
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount <= 0) return
    try {
      const res = await fetch(`/api/rebalance/task/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', targetAmount: amount }),
      })
      if ((await res.json()).success) {
        setEditingTask(null)
        setEditAmount('')
        fetchPlan()
      }
    } catch (e) {
      console.error('[FutureTab] 更新金额失败:', e)
    }
  }, [editAmount, fetchPlan])

  const togglePeriod = useCallback((period: number) => {
    setExpandedPeriods(prev => {
      const next = new Set(prev)
      if (next.has(period)) next.delete(period)
      else next.add(period)
      return next
    })
  }, [])

  // 按期数分组
  const tasksByPeriod = useMemo(() => {
    if (!plan) return new Map<number, TaskItem[]>()
    const map = new Map<number, TaskItem[]>()
    for (const task of plan.tasks) {
      if (!map.has(task.periodNumber)) map.set(task.periodNumber, [])
      map.get(task.periodNumber)!.push(task)
    }
    return map
  }, [plan])

  // ─── 渲染 ───

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">加载再平衡数据...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ─── 区块1: GAP 概览面板 ─── */}
      <GapOverview
        analysis={analysis}
        plan={plan}
        isFamily={isFamily}
      />

      {/* ─── 区块2/3: 计划 + 自动进度 + 时间线 或 空状态引导 ─── */}
      {plan ? (
        <>
          <PlanCard
            plan={plan}
            isFamily={isFamily}
            onCancel={handleCancelPlan}
            onRegenerate={handleGenerate}
            generating={generating}
          />
          <TaskTimeline
            plan={plan}
            tasksByPeriod={tasksByPeriod}
            expandedPeriods={expandedPeriods}
            onTogglePeriod={togglePeriod}
            onComplete={(id) => handleTaskAction(id, 'complete')}
            onSkip={(id) => handleTaskAction(id, 'skip')}
            editingTask={editingTask}
            editAmount={editAmount}
            onStartEdit={(id, amount) => { setEditingTask(id); setEditAmount(String(amount)) }}
            onCancelEdit={() => { setEditingTask(null); setEditAmount('') }}
            onSaveEdit={handleUpdateTaskAmount}
            onEditAmountChange={setEditAmount}
            isFamily={isFamily}
          />
        </>
      ) : (
        <EmptyState
          hasAnalysis={analysis.length > 0}
          onGenerate={handleGenerate}
          generating={generating}
          isFamily={isFamily}
        />
      )}
    </div>
  )
}

// ─── 子组件：GAP 概览 ───

function GapOverview({ analysis, plan, isFamily }: { analysis: AnalysisItem[]; plan: PlanData | null; isFamily: boolean }) {
  if (analysis.length === 0) return null

  // 与总览页 ai-insight 一致：显示所有有目标或有持仓的类别，按偏离绝对值排序
  const deviationBars = analysis
    .filter(a => a.targetPercent > 0 || a.currentPercent > 0)
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
    .slice(0, 6)

  if (deviationBars.length === 0) return null

  // 优先展示自动进度，回退到手动进度
  const progressPercent = plan?.autoProgress?.overallPercent ?? plan?.progress?.percent ?? 0
  const isAutoProgress = plan?.autoProgress != null && plan.autoProgress.items.length > 0

  return (
    <div className="rounded-2xl border border-border bg-card p-5 lg:p-7">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Target className={`h-5 w-5 ${isFamily ? 'text-amber-500' : 'text-primary'}`} />
          <h2 className="text-base font-semibold text-foreground">资产配置偏离度</h2>
        </div>
        {plan && (
          <div className="flex items-center gap-2">
            <div className="relative h-10 w-10">
              <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted/30" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={isAutoProgress ? 'text-emerald-500' : (isFamily ? 'text-amber-500' : 'text-primary')}
                  strokeDasharray={`${progressPercent * 0.975} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
                {progressPercent}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 与总览页 ai-insight 完全一致的偏离度条形图 */}
      <div className="flex flex-col gap-2.5">
        {deviationBars.map(item => {
          const color = CATEGORY_COLORS[item.categoryCode] || item.color || '#94A3B8'
          const deviation = item.currentPercent - item.targetPercent
          const status = deviation > 0 ? 'over' : deviation < 0 ? 'under' : 'normal'

          return (
            <div key={item.categoryCode} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs text-foreground">{item.categoryName}</span>
              <div className="relative h-2 flex-1 overflow-visible rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(item.currentPercent, 100)}%`, backgroundColor: color }}
                />
                {/* 目标竖线 + 百分比标注 */}
                <div className="absolute top-0 h-full" style={{ left: `${Math.min(item.targetPercent, 100)}%` }}>
                  <div className="h-full w-0.5 bg-foreground/40" />
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium text-muted-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {item.targetPercent.toFixed(0)}%
                  </span>
                </div>
              </div>
              <span className={`w-12 text-right text-[11px] font-semibold ${
                status === 'over' ? 'text-amber-600 dark:text-amber-400' : status === 'under' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
              }`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%
              </span>
            </div>
          )
        })}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-2 bg-foreground/40" />目标配置</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-500/60" />偏高</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-500/60" />偏低</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500/60" />正常</span>
        </div>
      </div>
    </div>
  )
}

// ─── 子组件：计划卡片 ───

function PlanCard({ plan, isFamily, onCancel, onRegenerate, generating }: {
  plan: PlanData
  isFamily: boolean
  onCancel: () => void
  onRegenerate: () => void
  generating: boolean
}) {
  const p = plan.progress
  const periodLabel = PERIOD_LABELS[plan.periodType] || plan.periodType
  const accent = isFamily ? 'amber' : 'blue'

  return (
    <div className="rounded-2xl border border-border bg-card p-5 lg:p-7">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
            {plan.strategySource === 'AI' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/40">
                <Sparkles className="h-2.5 w-2.5" />
                AI 策略
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                <AlertCircle className="h-2.5 w-2.5" />
                固定算法
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            <span>{periodLabel} × {plan.totalPeriods}期</span>
            <span className="text-muted-foreground/40">·</span>
            <span>总调整 {formatCurrency(p.totalAmount || plan.totalGapAmount)}</span>
          </div>
          {plan.strategyReasoning && (
            <p className="mt-1 text-[11px] text-muted-foreground/80 max-w-md line-clamp-1">
              {plan.strategyReasoning}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            disabled={generating}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              isFamily
                ? 'border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                : 'border-primary/30 text-primary hover:bg-primary/5'
            }`}
          >
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            重新生成
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <XCircle className="h-3 w-3" />
            终止
          </button>
        </div>
      </div>

      {/* 进度条 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {plan.autoProgress ? (
              <>
                <Activity className="h-3 w-3" />
                再平衡进度
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3" />
                任务进度
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            {plan.autoProgress && (
              <span className="text-[10px] text-muted-foreground">
                任务 {p.completedTasks + p.skippedTasks}/{p.totalTasks}
              </span>
            )}
            <span className="text-xs font-semibold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {plan.autoProgress ? `${plan.autoProgress.overallPercent}%` : `${p.completedTasks + p.skippedTasks}/${p.totalTasks}`}
            </span>
          </div>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted/40">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              plan.autoProgress
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                : (isFamily ? 'bg-amber-500' : 'bg-primary')
            }`}
            style={{ width: `${plan.autoProgress ? plan.autoProgress.overallPercent : p.percent}%` }}
          />
        </div>
      </div>

      {/* 三列统计 */}
      <div className="grid grid-cols-3 gap-4 rounded-xl border border-border bg-muted/20 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">已调整</span>
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(p.completedAmount)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">待调整</span>
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(p.pendingAmount)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">当前期</span>
          <span className="text-sm font-bold text-foreground">
            第{p.currentPeriod}期 / {plan.totalPeriods}期
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── 子组件：任务时间线 ───

function TaskTimeline({ plan, tasksByPeriod, expandedPeriods, onTogglePeriod, onComplete, onSkip, editingTask, editAmount, onStartEdit, onCancelEdit, onSaveEdit, onEditAmountChange, isFamily }: {
  plan: PlanData
  tasksByPeriod: Map<number, TaskItem[]>
  expandedPeriods: Set<number>
  onTogglePeriod: (p: number) => void
  onComplete: (id: string) => void
  onSkip: (id: string) => void
  editingTask: string | null
  editAmount: string
  onStartEdit: (id: string, amount: number) => void
  onCancelEdit: () => void
  onSaveEdit: (id: string) => void
  onEditAmountChange: (v: string) => void
  isFamily: boolean
}) {
  const currentPeriod = plan.progress.currentPeriod
  const periods = Array.from(tasksByPeriod.keys()).sort((a, b) => a - b)

  // 构建分类→自动进度映射
  const autoMap = useMemo(() => {
    const m = new Map<string, AutoProgressItem>()
    if (plan.autoProgress?.items) {
      for (const item of plan.autoProgress.items) {
        m.set(item.categoryCode, item)
      }
    }
    return m
  }, [plan.autoProgress])

  return (
    <div className="rounded-2xl border border-border bg-card p-5 lg:p-7">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Clock className={`h-5 w-5 ${isFamily ? 'text-amber-500' : 'text-primary'}`} />
          <h2 className="text-base font-semibold text-foreground">任务时间线</h2>
        </div>
        {plan.autoProgress && (
          <span className="text-[10px] text-muted-foreground">
            基准 {new Date(plan.autoProgress.snapshotDate).toLocaleDateString('zh-CN')}
          </span>
        )}
      </div>

      <div className="relative pl-6">
        {/* 竖线 */}
        <div className="absolute left-[9px] top-0 bottom-0 w-px bg-border" />

        {periods.map((period, idx) => {
          const tasks = tasksByPeriod.get(period) || []
          const allDone = tasks.every(t => t.status === 'COMPLETED' || t.status === 'SKIPPED')
          const isCurrent = period === currentPeriod
          const isFuture = period > currentPeriod
          const isExpanded = expandedPeriods.has(period) || isCurrent

          // 期截止日期（取该期第一个任务的 dueDate）
          const dueDate = tasks[0]?.dueDate ? new Date(tasks[0].dueDate) : null
          const dueDateStr = dueDate ? `${dueDate.getMonth() + 1}/${dueDate.getDate()}` : ''

          return (
            <div key={period} className={`relative mb-5 last:mb-0 ${isFuture ? 'opacity-50' : ''}`}>
              {/* 圆点 */}
              <div className={`absolute -left-6 top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 ${
                allDone
                  ? 'border-emerald-500 bg-emerald-500'
                  : isCurrent
                    ? `border-${isFamily ? 'amber' : 'blue'}-500 bg-${isFamily ? 'amber' : 'blue'}-500`
                    : 'border-border bg-card'
              }`}>
                {allDone ? (
                  <CheckCircle2 className="h-3 w-3 text-white" />
                ) : isCurrent ? (
                  <div className="h-2 w-2 rounded-full bg-white" />
                ) : (
                  <Circle className="h-2.5 w-2.5 text-muted-foreground/40" />
                )}
              </div>

              {/* 期头 */}
              <button
                onClick={() => onTogglePeriod(period)}
                className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                    第{period}期
                  </span>
                  {dueDateStr && (
                    <span className="text-[11px] text-muted-foreground">截止 {dueDateStr}</span>
                  )}
                  {isCurrent && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      isFamily ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'
                    }`}>
                      当前
                    </span>
                  )}
                  {allDone && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      已完成
                    </span>
                  )}
                </div>
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>

              {/* 任务列表 */}
              {isExpanded && (
                <div className="mt-2 flex flex-col gap-2">
                  {tasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      autoItem={autoMap.get(task.categoryCode)}
                      isEditing={editingTask === task.id}
                      editAmount={editAmount}
                      onComplete={() => onComplete(task.id)}
                      onSkip={() => onSkip(task.id)}
                      onStartEdit={() => onStartEdit(task.id, task.targetAmount)}
                      onCancelEdit={onCancelEdit}
                      onSaveEdit={() => onSaveEdit(task.id)}
                      onEditAmountChange={onEditAmountChange}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 子组件：任务卡片 ───

function TaskCard({ task, autoItem, isEditing, editAmount, onComplete, onSkip, onStartEdit, onCancelEdit, onSaveEdit, onEditAmountChange }: {
  task: TaskItem
  autoItem?: AutoProgressItem
  isEditing: boolean
  editAmount: string
  onComplete: () => void
  onSkip: () => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onEditAmountChange: (v: string) => void
}) {
  const color = CATEGORY_COLORS[task.categoryCode] || '#6B7280'
  const bgClass = CATEGORY_BG[task.categoryCode] || 'bg-muted/30 text-muted-foreground'
  const isDone = task.status === 'COMPLETED'
  const isSkipped = task.status === 'SKIPPED'
  const isPending = task.status === 'PENDING'

  return (
    <div className={`group rounded-xl border p-3 transition-all ${
      isDone ? 'border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10' :
      isSkipped ? 'border-border bg-muted/20 opacity-60' :
      'border-border hover:bg-muted/20 hover:shadow-sm'
    }`}>
      <div className="flex items-center gap-3">
        {/* 左侧彩色竖条 */}
        <div className="w-[3px] self-stretch rounded-full" style={{ backgroundColor: color }} />

        {/* 信息 */}
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">{task.categoryName}</span>
              <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${bgClass}`}>
                {task.action === 'BUY' ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                {task.action === 'BUY' ? '增配' : '减配'}
              </span>
              {task.isCustom && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">自定义</span>
              )}
              {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
              {isSkipped && <SkipForward className="h-3 w-3 text-muted-foreground" />}
            </div>
            {task.notes && <span className="text-[10px] text-muted-foreground truncate">{task.notes}</span>}
          </div>

          {/* 金额 */}
          <div className="text-right shrink-0">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => onEditAmountChange(e.target.value)}
                  className="h-7 w-24 rounded-lg border border-border bg-background px-2 text-xs text-right focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                  autoFocus
                />
                <button onClick={onSaveEdit} className="rounded-lg bg-primary/10 p-1 text-primary hover:bg-primary/20">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={onCancelEdit} className="rounded-lg bg-muted p-1 text-muted-foreground hover:bg-muted/80">
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <span className={`text-sm font-semibold ${isDone ? 'text-emerald-600' : 'text-foreground'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(isDone && task.actualAmount != null ? task.actualAmount : task.targetAmount)}
              </span>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        {isPending && !isEditing && (
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={onComplete}
              className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-600 transition-colors hover:bg-emerald-500/20"
              title="完成"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onSkip}
              className="rounded-lg bg-muted p-1.5 text-muted-foreground transition-colors hover:bg-muted/80"
              title="跳过"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onStartEdit}
              className="rounded-lg bg-muted p-1.5 text-muted-foreground transition-colors hover:bg-muted/80"
              title="编辑金额"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 自动进度行：比例变化 + 金额参考 */}
      {autoItem && (autoItem.percentChange !== 0 || autoItem.actualChange !== 0) && (
        <div className="mt-2 ml-[11px] space-y-1">
          {/* 第一行：比例变化（核心指标） */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-1 min-w-0">
              <span className="text-muted-foreground/60">占比</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{autoItem.snapshotPercent.toFixed(1)}%</span>
              <span className="text-muted-foreground/40">→</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{autoItem.currentPercent.toFixed(1)}%</span>
              <span className={`flex items-center gap-0.5 font-medium ${
                autoItem.percentChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : autoItem.percentChange < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'
              }`}>
                {autoItem.percentChange > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : autoItem.percentChange < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : null}
                {autoItem.percentChange > 0 ? '+' : ''}{autoItem.percentChange.toFixed(1)}pp
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-muted-foreground/50">目标{autoItem.targetPercent.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="h-1 w-16 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(autoItem.autoPercent, 100)}%`,
                    backgroundColor: autoItem.autoPercent >= 100 ? '#10B981' : color,
                  }}
                />
              </div>
              <span className={`text-[10px] font-semibold ${
                autoItem.autoPercent >= 100 ? 'text-emerald-600 dark:text-emerald-400' :
                autoItem.autoPercent > 0 ? 'text-foreground' : 'text-muted-foreground'
              }`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {autoItem.autoPercent}%
              </span>
            </div>
          </div>
          {/* 第二行：金额参考（辅助信息） */}
          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/50 ml-0.5">
            <span>市值</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(autoItem.snapshotValue)}</span>
            <span>→</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(autoItem.currentValue)}</span>
            <span className={autoItem.actualChange > 0 ? 'text-emerald-600/60 dark:text-emerald-400/60' : autoItem.actualChange < 0 ? 'text-rose-600/60 dark:text-rose-400/60' : ''}>
              {autoItem.actualChange > 0 ? '+' : ''}{formatCurrency(autoItem.actualChange)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 子组件：空状态引导 ───

function EmptyState({ hasAnalysis, onGenerate, generating, isFamily }: {
  hasAnalysis: boolean
  onGenerate: () => void
  generating: boolean
  isFamily: boolean
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 lg:p-16">
      <div className="flex flex-col items-center text-center gap-4">
        <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
          isFamily ? 'bg-amber-500/10' : 'bg-primary/10'
        }`}>
          <Target className={`h-8 w-8 ${isFamily ? 'text-amber-500' : 'text-primary'}`} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">开启再平衡之旅</h3>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-md">
            {hasAnalysis
              ? '基于 AI 投资建议，自动生成分期调仓计划，将资产配置逐步调整到目标比例。'
              : '请先前往「AI 顾问」获取投资建议，然后即可一键生成再平衡计划。'
            }
          </p>
        </div>
        {hasAnalysis ? (
          <button
            onClick={onGenerate}
            disabled={generating}
            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-all hover:shadow-lg disabled:opacity-60 ${
              isFamily
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
            }`}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? '生成中...' : '基于最新建议生成计划'}
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>需要先获取 AI 投资建议</span>
          </div>
        )}
      </div>
    </div>
  )
}
