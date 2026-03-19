'use client'

import { useState, useMemo } from 'react'
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Target,
  ChevronDown,
  ChevronUp,
  FileText,
  Info,
} from 'lucide-react'
import { useDashboardV2 } from '@/app/dashboard-v2/layout'

/** 简易 Markdown → HTML（支持标题、加粗、列表、表格、段落） */
function renderMarkdown(md: string): string {
  if (!md) return ''
  const lines = md.split('\n')
  const html: string[] = []
  let inTable = false
  let inList = false

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // 表格行
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      // 跳过分隔行
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

    // 标题
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

    // 列表项（数字或 -/*/·）
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

    // 空行
    if (line.trim() === '') {
      continue
    }

    // 普通段落
    if (inList) { html.push('</ul>'); inList = false }
    html.push(`<p class="text-[11px] leading-relaxed text-foreground my-1">${inlineMd(line)}</p>`)
  }

  if (inTable) html.push('</table>')
  if (inList) html.push('</ul>')
  return html.join('')
}

/** 行内 Markdown：**粗体**、*斜体*、`代码` */
function inlineMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-muted/40 px-1 py-0.5 text-[10px] font-mono">$1</code>')
}

interface AIInsightProps {
  visible: boolean
}

function getScoreLabel(score: number): { text: string; color: string } {
  if (score >= 85) return { text: '优秀', color: 'text-emerald-600 dark:text-emerald-400' }
  if (score >= 70) return { text: '良好', color: 'text-emerald-600 dark:text-emerald-400' }
  if (score >= 50) return { text: '一般', color: 'text-amber-600 dark:text-amber-400' }
  return { text: '待改善', color: 'text-red-600 dark:text-red-400' }
}

export function AIInsight({ visible }: AIInsightProps) {
  const [insightExpanded, setInsightExpanded] = useState(false)
  const [aiReportOpen, setAiReportOpen] = useState(false)
  const { apiData, viewMode } = useDashboardV2()
  const isFamily = viewMode === 'family'

  // 家庭模式使用 familyAllocationData，个人模式使用 dashboardData.allocationData
  const allocation = isFamily ? apiData.familyAllocationData : apiData.dashboardData?.allocationData
  const score = allocation?.overallScore ?? 0
  const topDeviations = allocation?.topDeviations || []
  const latestAdvice = allocation?.latestAdvice
  const fullAnalysis = allocation?.fullAnalysis || []
  const scoreLabel = getScoreLabel(score)
  const scoreRatio = score / 100

  // 构建偏离度数据（来自 fullAnalysis，因为它有 currentPercent 和 targetPercent）
  const deviationBars = fullAnalysis.length > 0
    ? fullAnalysis
        .filter((a: any) => a.targetPercent > 0 || a.currentPercent > 0)
        .sort((a: any, b: any) => Math.abs(b.deviation) - Math.abs(a.deviation))
        .slice(0, 6)
        .map((a: any) => ({
          label: a.categoryName,
          current: a.currentPercent,
          target: a.targetPercent,
          color: a.color || '#94A3B8',
          status: a.deviationStatus === 'CRITICAL' ? 'over' as const
            : a.deviation > 0 ? 'over' as const
            : a.deviation < 0 ? 'under' as const
            : 'normal' as const,
        }))
    : topDeviations.map((d: any) => ({
        label: d.categoryName,
        current: d.currentPercent,
        target: d.targetPercent,
        color: '#94A3B8',
        status: d.deviation > 0 ? 'over' as const : 'under' as const,
      }))

  // 建议文本（从 topDeviations 生成）
  const suggestions = topDeviations.map((d: any) => {
    const deviation = d.deviation
    const isOver = deviation > 0
    return {
      icon: isOver ? AlertTriangle : Target,
      text: `${d.categoryName}占比${isOver ? '偏高' : '不足'} ${Math.abs(deviation).toFixed(1)}%（当前 ${d.currentPercent.toFixed(1)}%，目标 ${d.targetPercent.toFixed(1)}%）`,
      color: isOver ? 'text-amber-500' : 'text-blue-500',
    }
  })

  // 无配置分析数据时显示提示
  if (!allocation) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <Info className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI 投资洞察</h3>
            <p className="text-xs text-muted-foreground">
              尚未设置资产配置目标，请先设置目标后查看分析。
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-2xl border border-purple-200/60 dark:border-purple-800/40 bg-card">
        {/* Summary Row */}
        <div
          className="flex cursor-pointer flex-col gap-2 p-3 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:gap-4 sm:p-5"
          onClick={() => setInsightExpanded(!insightExpanded)}
          role="button"
          aria-expanded={insightExpanded}
          aria-label="展开 AI 投资洞察详情"
        >
          {/* Score badge + Key info */}
          <div className="flex flex-1 items-center gap-3 sm:gap-4">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center sm:h-14 sm:w-14">
              <svg className="h-full w-full" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
                <circle
                  cx="28" cy="28" r="24" fill="none"
                  stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${scoreRatio * 2 * Math.PI * 24} ${2 * Math.PI * 24}`}
                  transform="rotate(-90 28 28)"
                />
                <text x="28" y="31" textAnchor="middle" className="fill-foreground font-bold" style={{ fontSize: '16px' }}>
                  {score}
                </text>
              </svg>
            </div>

            <div className="flex flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <h3 className="text-sm font-semibold text-foreground">AI 投资洞察</h3>
                <span className="hidden rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-400 sm:inline-block">
                  DeepSeek 分析
                </span>
                <span className={`flex items-center gap-1 text-xs font-medium ${scoreLabel.color}`}>
                  <CheckCircle2 className="h-3 w-3" />
                  {scoreLabel.text}
                </span>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {latestAdvice?.summary || (topDeviations.length > 0
                  ? topDeviations.map((d: any) => `${d.categoryName}${d.deviation > 0 ? '偏高' : '不足'} ${Math.abs(d.deviation).toFixed(1)}%`).join('；')
                  : '资产配置整体均衡'
                )}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pl-15 sm:pl-0">
            {latestAdvice && (
              <button
                onClick={(e) => { e.stopPropagation(); setAiReportOpen(true) }}
                className="flex items-center gap-1.5 rounded-xl border border-purple-200 dark:border-purple-800/40 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-400 transition-colors hover:bg-purple-500/20"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">AI 分析报告</span>
                <span className="sm:hidden">报告</span>
              </button>
            )}
            {insightExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Detail Panel */}
        {insightExpanded && (
          <div className="border-t border-border" style={{ animation: 'fadeSlideIn 0.25s ease-out' }}>
            <div className="flex flex-col lg:flex-row">
              {/* Left: Score Ring */}
              <div className="flex flex-col items-center justify-center border-b border-border p-3 sm:p-6 lg:w-[220px] lg:shrink-0 lg:border-b-0 lg:border-r">
                <div className="relative mb-2 sm:mb-3">
                  <svg className="h-[80px] w-[80px] sm:h-[130px] sm:w-[130px]" viewBox="0 0 130 130">
                    <circle cx="65" cy="65" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
                    <circle
                      cx="65" cy="65" r="52" fill="none"
                      stroke="#8b5cf6" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${scoreRatio * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                      transform="rotate(-90 65 65)"
                      className="transition-all duration-700"
                    />
                    <text x="65" y="58" textAnchor="middle" className="fill-foreground font-bold" style={{ fontSize: '28px' }}>
                      {score}
                    </text>
                    <text x="65" y="78" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: '11px' }}>
                      投资健康
                    </text>
                  </svg>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                  <span className={`text-xs font-semibold ${scoreLabel.color}`}>{scoreLabel.text}</span>
                </div>
              </div>

              {/* Right: Allocation Deviation + Suggestions */}
              <div className="flex flex-1 flex-col p-3 sm:p-6">
                {/* Allocation Deviation Bars */}
                {deviationBars.length > 0 && (
                  <div className="mb-4 flex flex-col gap-2.5">
                    <span className="text-[11px] font-medium text-muted-foreground">配置偏离度</span>
                    {deviationBars.map((item: any) => {
                      const deviation = item.current - item.target
                      return (
                        <div key={item.label} className="flex items-center gap-3">
                          <span className="w-16 shrink-0 text-xs text-foreground">{item.label}</span>
                          <div className="relative h-2 flex-1 overflow-visible rounded-full bg-muted">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(item.current, 100)}%`, backgroundColor: item.color }} />
                            {/* 目标竖线 + 百分比标注 */}
                            <div className="absolute top-0 h-full" style={{ left: `${Math.min(item.target, 100)}%` }}>
                              <div className="h-full w-0.5 bg-foreground/40" />
                              <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium text-muted-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {item.target.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <span className={`w-12 text-right text-[11px] font-semibold ${
                            item.status === 'over' ? 'text-amber-600 dark:text-amber-400' : item.status === 'under' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
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
                )}

                {/* AI Suggestions */}
                {suggestions.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">优化建议</span>
                    <div className="flex flex-col gap-1.5">
                      {suggestions.map((tip: any, i: number) => {
                        const Icon = tip.icon
                        return (
                          <div key={i} className="flex items-start gap-2.5 rounded-lg bg-muted/20 px-3 py-2">
                            <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tip.color}`} />
                            <span className="text-xs leading-relaxed text-foreground">{tip.text}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Analysis Report Panel (Overlay) */}
      {aiReportOpen && latestAdvice && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setAiReportOpen(false)} />
          <div
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-card shadow-2xl sm:w-[520px]"
            style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">AI 投资分析报告</h3>
                  <span className="text-[10px] text-muted-foreground">
                    基于 DeepSeek · 生成于 {latestAdvice.createdAt ? new Date(latestAdvice.createdAt).toLocaleDateString('zh-CN') : new Date().toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setAiReportOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="关闭报告"
              >
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>

            {/* Report Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex flex-col gap-6">
                {/* Overall Assessment */}
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-100 dark:bg-purple-900/30 text-[11px] font-bold text-purple-700 dark:text-purple-400">1</span>
                    总体评估
                  </h4>
                  <div className="rounded-xl bg-muted/20 p-4">
                    <FormattedAnalysis content={
                      latestAdvice.fullAnalysis
                        ? (typeof latestAdvice.fullAnalysis === 'string' ? latestAdvice.fullAnalysis : latestAdvice.summary)
                        : latestAdvice.summary
                    } />
                  </div>
                </div>

                {/* Risk Analysis from topDeviations */}
                {topDeviations.length > 0 && (
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/30 text-[11px] font-bold text-amber-700 dark:text-amber-400">2</span>
                      风险分析
                    </h4>
                    <div className="flex flex-col gap-2">
                      {topDeviations.map((d: any, i: number) => {
                        const isOver = d.deviation > 0
                        return (
                          <div key={i} className={`flex items-start gap-2.5 rounded-xl border p-3 ${
                            isOver ? 'border-amber-200/60 dark:border-amber-800/40 bg-amber-500/10' : 'border-blue-200/60 dark:border-blue-800/40 bg-blue-500/10'
                          }`}>
                            {isOver
                              ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                              : <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                            }
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-foreground">
                                {d.categoryName}配置{isOver ? '偏高' : '不足'}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                当前占比 {d.currentPercent.toFixed(1)}%，目标 {d.targetPercent.toFixed(1)}%，偏离 {d.deviation > 0 ? '+' : ''}{d.deviation.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Optimization Actions from latestAdvice.actions */}
                {latestAdvice.actions && latestAdvice.actions.length > 0 && (
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">3</span>
                      优化建议
                    </h4>
                    <div className="flex flex-col gap-2">
                      {latestAdvice.actions.map((action: any, i: number) => {
                        const priorityTag = action.priority <= 1
                          ? { text: '高', cls: 'bg-red-500/10 text-red-500' }
                          : action.priority <= 2
                          ? { text: '中', cls: 'bg-amber-500/10 text-amber-600' }
                          : { text: '低', cls: 'bg-emerald-500/10 text-emerald-600' }
                        return (
                          <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3">
                            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${priorityTag.cls}`}>
                              {priorityTag.text}
                            </span>
                            <span className="text-xs text-foreground">{action.reason}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Risks */}
                {latestAdvice.risks && latestAdvice.risks.length > 0 && (
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30 text-[11px] font-bold text-red-700 dark:text-red-400">4</span>
                      风险提示
                    </h4>
                    <div className="flex flex-col gap-1.5">
                      {latestAdvice.risks.map((risk: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 rounded-lg bg-red-50/30 dark:bg-red-950/20 px-3 py-2">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
                          <span className="text-[11px] text-foreground">{risk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="rounded-xl bg-muted/30 p-3">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    以上分析由 AI 自动生成，仅供参考，不构成投资建议。投资有风险，决策需谨慎。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

/** Markdown 内容格式化展示组件 */
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
