/**
 * 再平衡服务 - RebalanceService
 *
 * 基于 AI 投资建议 (AllocationAdvice) 和当前偏离分析 (AllocationAnalysis)，
 * 生成可执行的多期再平衡计划，并管理任务状态和进度跟踪。
 *
 * ⚠️ 2026-03-07 新增：自动进度追踪
 * 获取计划时自动对比快照 vs 当前资产，计算各分类的实际变动金额，
 * 无需用户手动更新任务状态即可感知再平衡进展。
 */

import { prisma } from '@/lib/prisma'
import { AllocationService, type AllocationAnalysis, type AllocationAnalysisItem } from './allocation-service'
import { PortfolioService } from './portfolio-service'

// ─── 类型定义 ───

export interface RebalancePlanSummary {
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
  tasks: RebalanceTaskItem[]
}

export interface RebalanceTaskItem {
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

export interface PlanProgress {
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

/**
 * 自动进度追踪：基于快照 vs 当前资产的实际变动
 */
export interface AutoProgressItem {
  categoryCode: string
  categoryName: string
  action: 'BUY' | 'SELL'
  /** 计划创建时该分类的资产价值（CNY） */
  snapshotValue: number
  /** 当前该分类的资产价值（CNY） */
  currentValue: number
  /** 实际变动金额（正数表示朝目标方向移动） */
  actualChange: number
  /** 该分类所有任务的目标总额 */
  targetTotalAmount: number
  /** 自动计算的完成百分比（0-100） */
  autoPercent: number
  /** 快照时该分类占总资产的比例（%） */
  snapshotPercent: number
  /** 当前该分类占总资产的比例（%） */
  currentPercent: number
  /** 目标比例（%） */
  targetPercent: number
  /** 比例变化（百分点，正数表示朝目标方向移动） */
  percentChange: number
}

export interface AutoProgress {
  /** 各分类的自动进度 */
  items: AutoProgressItem[]
  /** 整体自动完成百分比（加权平均） */
  overallPercent: number
  /** 最后一次快照时间 */
  snapshotDate: string
  /** 当前计算时间 */
  calculatedAt: string
}

interface GeneratePlanOptions {
  userId: string
  familyId?: string
  adviceId?: string
  name?: string
}

// 每期任务拆解项
interface TaskBreakdownItem {
  periodNumber: number
  categoryCode: string
  categoryName: string
  action: 'BUY' | 'SELL'
  targetAmount: number
  dueDate: Date
}

// ─── 服务实现 ───

export class RebalanceService {

  /**
   * 生成再平衡计划
   * 从最新 AI 建议 + 偏离分析中提取 GAP，自动决定周期并拆解任务
   */
  static async generatePlan(options: GeneratePlanOptions): Promise<RebalancePlanSummary> {
    const { userId, familyId, adviceId: inputAdviceId, name } = options

    // 1. 获取 AI 建议（指定 adviceId 或最新的）
    let advice: any = null
    if (inputAdviceId) {
      advice = await prisma.allocationAdvice.findUnique({ where: { id: inputAdviceId } })
    } else if (familyId) {
      advice = await AllocationService.getLatestAdviceForFamily(familyId)
    } else {
      advice = await AllocationService.getLatestAdvice(userId)
    }

    if (!advice) {
      throw new Error('没有可用的 AI 投资建议，请先获取 AI 建议')
    }

    // 2. 获取偏离分析
    let analysis: AllocationAnalysis
    if (familyId) {
      analysis = await AllocationService.getAnalysisForFamily(familyId, userId)
    } else {
      analysis = await AllocationService.getAnalysis(userId)
    }

    // 3. 解析 AI 建议中的 targets 和 actions
    const adviceData = typeof advice.advice === 'string' ? JSON.parse(advice.advice) : advice.advice
    const aiTargets: Array<{ categoryCode: string; categoryName: string; currentPercent: number; suggestedPercent: number }> = adviceData?.targets || []
    const aiActions: Array<{ category: string; categoryName: string; action: string; amount?: number; priority: number }> = adviceData?.actions || []

    // 4. 计算总 GAP 和每类偏离
    const totalAssets = analysis.totalAssets || 0
    const gapItems = this.calculateGapItems(analysis.analysis, aiTargets, totalAssets)

    if (gapItems.length === 0) {
      throw new Error('当前资产配置已接近目标，无需再平衡')
    }

    // totalGapAmount = 单边调整量（BUY 总额或 SELL 总额取较大者）
    // 卖出和买入是此消彼长的操作，实际调动资金量应取单边
    const buyTotal = gapItems.filter(g => g.action === 'BUY').reduce((sum, g) => sum + Math.abs(g.gapAmount), 0)
    const sellTotal = gapItems.filter(g => g.action === 'SELL').reduce((sum, g) => sum + Math.abs(g.gapAmount), 0)
    const totalGapAmount = Math.max(buyTotal, sellTotal)

    // 5. 优先使用 AI 建议中的再平衡策略，否则回退到固定算法
    const aiRebalanceStrategy = adviceData?.rebalanceStrategy
    let periodType: string
    let totalPeriods: number
    let firstPeriodRatio: number
    let strategySource: 'AI' | 'ALGORITHM'
    let strategyReasoning: string

    if (aiRebalanceStrategy?.periodType && aiRebalanceStrategy?.totalPeriods) {
      periodType = aiRebalanceStrategy.periodType
      totalPeriods = aiRebalanceStrategy.totalPeriods
      firstPeriodRatio = aiRebalanceStrategy.firstPeriodRatio || 0.2
      strategySource = 'AI'
      strategyReasoning = aiRebalanceStrategy.reasoning || 'AI 建议的再平衡策略'
      console.log('[RebalanceService] 使用 AI 建议的再平衡策略:', {
        periodType, totalPeriods, firstPeriodRatio,
        reasoning: aiRebalanceStrategy.reasoning,
      })
    } else {
      const maxDeviation = Math.max(...gapItems.map(g => Math.abs(g.deviation)))
      const strategy = this.suggestPeriodStrategy(maxDeviation)
      periodType = strategy.periodType
      totalPeriods = strategy.totalPeriods
      firstPeriodRatio = 0.2
      strategySource = 'ALGORITHM'
      strategyReasoning = `基于最大偏离度 ${maxDeviation.toFixed(1)}% 的固定算法策略`
      console.log('[RebalanceService] AI 建议中无再平衡策略，使用固定算法:', { periodType, totalPeriods, maxDeviation })
    }

    // 6. 拆解任务
    const startDate = new Date()
    const taskBreakdown = this.breakdownTasks(gapItems, periodType, totalPeriods, startDate, firstPeriodRatio)
    const endDate = taskBreakdown.length > 0
      ? taskBreakdown[taskBreakdown.length - 1].dueDate
      : new Date(startDate.getTime() + 30 * 24 * 3600 * 1000)

    // 7. 终止旧的活跃计划
    await prisma.rebalancePlan.updateMany({
      where: {
        userId,
        ...(familyId ? { familyId } : {}),
        status: 'ACTIVE',
      },
      data: { status: 'EXPIRED' },
    })

    // 8. 创建计划 + 任务
    const plan = await prisma.rebalancePlan.create({
      data: {
        userId,
        familyId: familyId || null,
        adviceId: advice.id,
        name: name || `再平衡计划 ${new Date().toLocaleDateString('zh-CN')}`,
        status: 'ACTIVE',
        totalGapAmount,
        periodType,
        totalPeriods,
        startDate,
        endDate,
        portfolioSnapshot: {
          totalAssets,
          analysis: analysis.analysis.map(a => ({
            categoryCode: a.categoryCode,
            categoryName: a.categoryName,
            currentPercent: a.currentPercent,
            targetPercent: a.targetPercent,
            deviation: a.deviation,
            currentValue: a.currentValue,  // ⚠️ 保存绝对值，用于自动进度对比
          })),
          aiTargets,
          strategySource,
          strategyReasoning,
          createdAt: new Date().toISOString(),
        },
        tasks: {
          create: taskBreakdown.map(t => ({
            periodNumber: t.periodNumber,
            categoryCode: t.categoryCode,
            categoryName: t.categoryName,
            action: t.action,
            targetAmount: t.targetAmount,
            status: 'PENDING',
            dueDate: t.dueDate,
            isCustom: false,
          })),
        },
      },
      include: { tasks: { orderBy: [{ periodNumber: 'asc' }, { categoryCode: 'asc' }] } },
    })

    return this.formatPlanSummary(plan)
  }

  /**
   * 获取当前活跃计划（含自动进度追踪）
   */
  static async getActivePlan(userId: string, familyId?: string): Promise<RebalancePlanSummary | null> {
    const plan = await prisma.rebalancePlan.findFirst({
      where: {
        userId,
        ...(familyId ? { familyId } : { familyId: null }),
        status: 'ACTIVE',
      },
      include: { tasks: { orderBy: [{ periodNumber: 'asc' }, { categoryCode: 'asc' }] } },
      orderBy: { createdAt: 'desc' },
    })

    if (!plan) return null

    // 自动进度追踪：获取当前资产数据与快照对比
    let autoProgress: AutoProgress | null = null
    try {
      autoProgress = await this.calculateAutoProgress(plan, userId, familyId)
    } catch (e) {
      console.error('[RebalanceService] 自动进度计算失败:', e)
    }

    return this.formatPlanSummary(plan, autoProgress)
  }

  /**
   * 获取计划历史（含非活跃的）
   */
  static async getPlanHistory(userId: string, familyId?: string, limit = 10): Promise<RebalancePlanSummary[]> {
    const plans = await prisma.rebalancePlan.findMany({
      where: {
        userId,
        ...(familyId ? { familyId } : {}),
      },
      include: { tasks: { orderBy: [{ periodNumber: 'asc' }, { categoryCode: 'asc' }] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return plans.map((p: any) => this.formatPlanSummary(p))
  }

  /**
   * 完成任务
   */
  static async completeTask(taskId: string, actualAmount?: number): Promise<RebalanceTaskItem> {
    const task = await prisma.rebalanceTask.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        actualAmount: actualAmount ?? undefined,
        completedAt: new Date(),
      },
    })

    await this.checkAndUpdatePlanStatus(task.planId)
    return this.formatTask(task)
  }

  /**
   * 跳过任务
   */
  static async skipTask(taskId: string, notes?: string): Promise<RebalanceTaskItem> {
    const task = await prisma.rebalanceTask.update({
      where: { id: taskId },
      data: {
        status: 'SKIPPED',
        notes: notes || '用户跳过',
        completedAt: new Date(),
      },
    })

    await this.checkAndUpdatePlanStatus(task.planId)
    return this.formatTask(task)
  }

  /**
   * 更新任务（修改金额或备注）
   */
  static async updateTask(taskId: string, data: { targetAmount?: number; notes?: string }): Promise<RebalanceTaskItem> {
    const task = await prisma.rebalanceTask.update({
      where: { id: taskId },
      data: {
        ...(data.targetAmount !== undefined ? { targetAmount: data.targetAmount } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    })
    return this.formatTask(task)
  }

  /**
   * 新增自定义任务
   */
  static async addCustomTask(planId: string, data: {
    periodNumber: number
    categoryCode: string
    categoryName: string
    action: 'BUY' | 'SELL'
    targetAmount: number
    dueDate: string
    notes?: string
  }): Promise<RebalanceTaskItem> {
    const task = await prisma.rebalanceTask.create({
      data: {
        planId,
        periodNumber: data.periodNumber,
        categoryCode: data.categoryCode,
        categoryName: data.categoryName,
        action: data.action,
        targetAmount: data.targetAmount,
        dueDate: new Date(data.dueDate),
        status: 'PENDING',
        isCustom: true,
        notes: data.notes || null,
      },
    })
    return this.formatTask(task)
  }

  /**
   * 取消计划
   */
  static async cancelPlan(planId: string): Promise<void> {
    await prisma.rebalancePlan.update({
      where: { id: planId },
      data: { status: 'CANCELLED' },
    })
  }

  // ─── 内部辅助方法 ───

  /**
   * 计算各分类 GAP
   */
  private static calculateGapItems(
    analysisItems: AllocationAnalysisItem[],
    aiTargets: Array<{ categoryCode: string; categoryName: string; suggestedPercent: number }>,
    totalAssets: number,
  ) {
    const items: Array<{
      categoryCode: string
      categoryName: string
      deviation: number
      gapAmount: number
      action: 'BUY' | 'SELL'
    }> = []

    for (const item of analysisItems) {
      if (item.level !== 1) continue

      // AI 建议目标优先，否则用用户设定的 targetPercent
      const aiTarget = aiTargets.find(t => t.categoryCode === item.categoryCode)
      const target = aiTarget ? aiTarget.suggestedPercent : item.targetPercent
      const deviation = item.currentPercent - target

      // 偏离度小于 1% 的忽略
      if (Math.abs(deviation) < 1) continue

      const gapAmount = (deviation / 100) * totalAssets
      items.push({
        categoryCode: item.categoryCode,
        categoryName: item.categoryName,
        deviation,
        gapAmount,
        action: deviation > 0 ? 'SELL' : 'BUY',
      })
    }

    return items
  }

  /**
   * 基于最大偏离度建议周期策略
   */
  private static suggestPeriodStrategy(maxDeviation: number): { periodType: string; totalPeriods: number } {
    if (maxDeviation > 20) {
      return { periodType: 'WEEKLY', totalPeriods: 6 }
    } else if (maxDeviation > 10) {
      return { periodType: 'BIWEEKLY', totalPeriods: 5 }
    } else {
      return { periodType: 'MONTHLY', totalPeriods: 3 }
    }
  }

  /**
   * 将 GAP 拆解为多期任务
   * 首期按 firstPeriodRatio 占比，其余等分
   */
  private static breakdownTasks(
    gapItems: Array<{ categoryCode: string; categoryName: string; gapAmount: number; action: 'BUY' | 'SELL' }>,
    periodType: string,
    totalPeriods: number,
    startDate: Date,
    firstPeriodRatio: number = 0.2,
  ): TaskBreakdownItem[] {
    const tasks: TaskBreakdownItem[] = []

    for (const gap of gapItems) {
      const absGap = Math.abs(gap.gapAmount)
      const firstPeriodAmount = Math.round(absGap * firstPeriodRatio * 100) / 100
      const remainingAmount = absGap - firstPeriodAmount
      const perPeriodAmount = totalPeriods > 1
        ? Math.round((remainingAmount / (totalPeriods - 1)) * 100) / 100
        : 0

      for (let period = 1; period <= totalPeriods; period++) {
        const amount = period === 1 ? firstPeriodAmount : perPeriodAmount
        if (amount < 100) continue // 忽略小于 100 元的任务

        const dueDate = this.calculateDueDate(startDate, periodType, period)

        tasks.push({
          periodNumber: period,
          categoryCode: gap.categoryCode,
          categoryName: gap.categoryName,
          action: gap.action,
          targetAmount: amount,
          dueDate,
        })
      }
    }

    return tasks.sort((a, b) => a.periodNumber - b.periodNumber || a.categoryCode.localeCompare(b.categoryCode))
  }

  /**
   * 根据周期类型计算截止日期
   */
  private static calculateDueDate(startDate: Date, periodType: string, period: number): Date {
    const date = new Date(startDate)
    switch (periodType) {
      case 'WEEKLY':
        date.setDate(date.getDate() + period * 7)
        break
      case 'BIWEEKLY':
        date.setDate(date.getDate() + period * 14)
        break
      case 'MONTHLY':
      default:
        date.setMonth(date.getMonth() + period)
        break
    }
    return date
  }

  /**
   * 检查并更新计划状态（所有任务完成/跳过时标记计划为 COMPLETED）
   */
  private static async checkAndUpdatePlanStatus(planId: string): Promise<void> {
    const tasks = await prisma.rebalanceTask.findMany({
      where: { planId },
      select: { status: true },
    })

    const allDone = tasks.every((t: { status: string }) => t.status === 'COMPLETED' || t.status === 'SKIPPED')
    if (allDone && tasks.length > 0) {
      await prisma.rebalancePlan.update({
        where: { id: planId },
        data: { status: 'COMPLETED' },
      })
    }
  }

  /**
   * 自动进度追踪：对比计划快照 vs 当前资产，计算各分类的实际变动
   *
   * 核心逻辑（v2 比例优先）：
   * 1. 从 portfolioSnapshot 提取计划创建时每个分类的资产价值和比例
   * 2. 获取当前实际资产（按 overview group），计算当前比例
   * 3. 用**比例变化**判断进度，而非绝对金额变化
   *    → 消除新资金流入/流出对进度的干扰
   * 4. 比例变化朝目标方向移动 = 有效进度
   * 5. 进度 = 比例已移动距离 / 比例需移动总距离 × 100
   */
  private static async calculateAutoProgress(
    plan: any,
    userId: string,
    familyId?: string,
  ): Promise<AutoProgress | null> {
    const snapshot = plan.portfolioSnapshot as any
    if (!snapshot?.analysis || !Array.isArray(snapshot.analysis)) {
      return null
    }

    // 1. 获取当前资产配置
    let currentGroups: Array<{ code: string; value: number }>
    if (familyId) {
      const members = await prisma.familyMember.findMany({
        where: { familyId },
        select: { userId: true },
      })
      const allGroups = await Promise.all(
        members.map(m => PortfolioService.getPortfolioByOverviewGroup(m.userId).catch(() => []))
      )
      const agg: Record<string, number> = {}
      for (const memberGroups of allGroups) {
        for (const g of memberGroups) {
          agg[g.code] = (agg[g.code] || 0) + g.value
        }
      }
      currentGroups = Object.entries(agg).map(([code, value]) => ({ code, value }))
    } else {
      const groups = await PortfolioService.getPortfolioByOverviewGroup(userId)
      currentGroups = groups.map(g => ({ code: g.code, value: g.value }))
    }

    // 2. 计算当前总资产和各分类比例
    const currentTotal = currentGroups.reduce((sum, g) => sum + g.value, 0)
    const currentMap = new Map(currentGroups.map(g => [g.code, g.value]))

    // 3. 构建快照资产映射 + 快照比例映射 + 目标比例映射
    const snapshotMap = new Map<string, number>()
    const snapshotPercentMap = new Map<string, number>()
    const targetPercentMap = new Map<string, number>()
    const snapshotTotal = snapshot.totalAssets || 0

    for (const item of snapshot.analysis) {
      const value = item.currentValue != null
        ? item.currentValue
        : snapshotTotal * (item.currentPercent || 0) / 100
      snapshotMap.set(item.categoryCode, value)
      snapshotPercentMap.set(item.categoryCode, item.currentPercent || 0)
      targetPercentMap.set(item.categoryCode, item.targetPercent || 0)
    }

    // 4. 按分类聚合任务目标总额
    const taskAgg: Record<string, { action: 'BUY' | 'SELL'; categoryName: string; totalTarget: number }> = {}
    for (const task of (plan.tasks || [])) {
      const code = task.categoryCode
      if (!taskAgg[code]) {
        taskAgg[code] = {
          action: task.action,
          categoryName: task.categoryName,
          totalTarget: 0,
        }
      }
      taskAgg[code].totalTarget += Number(task.targetAmount)
    }

    // 5. 计算每个分类的自动进度（比例优先）
    const items: AutoProgressItem[] = []
    let weightedSum = 0
    let weightTotal = 0

    for (const [categoryCode, agg] of Object.entries(taskAgg)) {
      const snapshotValue = snapshotMap.get(categoryCode) || 0
      const currentValue = currentMap.get(categoryCode) || 0
      const rawChange = currentValue - snapshotValue

      // 绝对值方向判断（保留用于展示）
      const actualChange = agg.action === 'BUY' ? rawChange : -rawChange

      // ── 比例变化计算（核心改进） ──
      const snapPct = snapshotPercentMap.get(categoryCode) || 0
      const tgtPct = targetPercentMap.get(categoryCode) || 0
      const curPct = currentTotal > 0
        ? (currentValue / currentTotal) * 100
        : 0

      // 比例需移动的总距离（目标比例 - 快照比例）
      // BUY: targetPercent > snapshotPercent → 需要提升
      // SELL: targetPercent < snapshotPercent → 需要降低
      const percentGap = tgtPct - snapPct            // 正值=需增配，负值=需减配
      const percentMoved = curPct - snapPct           // 正值=比例上升，负值=比例下降

      // percentChange：朝目标方向移动了多少百分点（正数=正向）
      // 如果 gap 和 moved 同号，说明方向正确
      const percentChange = percentGap !== 0
        ? (percentGap > 0 ? percentMoved : -percentMoved)
        : 0

      // 进度 = 已移动比例 / 需移动总比例 × 100
      const absGap = Math.abs(percentGap)
      const positivePercentChange = Math.max(0, percentChange)
      const autoPercent = absGap > 0.1  // 避免除以极小数
        ? Math.min(100, Math.round((positivePercentChange / absGap) * 100))
        : 0

      items.push({
        categoryCode,
        categoryName: agg.categoryName,
        action: agg.action,
        snapshotValue: Math.round(snapshotValue),
        currentValue: Math.round(currentValue),
        actualChange: Math.round(actualChange),
        targetTotalAmount: Math.round(agg.totalTarget),
        autoPercent,
        snapshotPercent: Math.round(snapPct * 100) / 100,
        currentPercent: Math.round(curPct * 100) / 100,
        targetPercent: Math.round(tgtPct * 100) / 100,
        percentChange: Math.round(percentChange * 100) / 100,
      })

      // 加权求整体进度（以目标金额为权重）
      weightedSum += autoPercent * agg.totalTarget
      weightTotal += agg.totalTarget
    }

    const overallPercent = weightTotal > 0
      ? Math.min(100, Math.round(weightedSum / weightTotal))
      : 0

    return {
      items: items.sort((a, b) => b.autoPercent - a.autoPercent),
      overallPercent,
      snapshotDate: snapshot.createdAt || plan.createdAt?.toISOString?.() || plan.createdAt,
      calculatedAt: new Date().toISOString(),
    }
  }

  /**
   * 计算计划进度
   */
  private static calculateProgress(tasks: any[]): PlanProgress {
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length
    const skippedTasks = tasks.filter(t => t.status === 'SKIPPED').length
    const pendingTasks = totalTasks - completedTasks - skippedTasks

    // 只计算 BUY 侧金额（卖出资金用于买入，避免双倍计算）
    // 如果没有 BUY 任务则用 SELL 侧（纯减仓场景）
    const buyTasks = tasks.filter(t => t.action === 'BUY')
    const sellTasks = tasks.filter(t => t.action === 'SELL')
    
    const completedBuyAmount = buyTasks.filter(t => t.status === 'COMPLETED').reduce((sum, t) => sum + Number(t.actualAmount || t.targetAmount), 0)
    const completedSellAmount = sellTasks.filter(t => t.status === 'COMPLETED').reduce((sum, t) => sum + Number(t.actualAmount || t.targetAmount), 0)
    const completedAmount = Math.max(completedBuyAmount, completedSellAmount)
    
    const pendingBuyAmount = buyTasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').reduce((sum, t) => sum + Number(t.targetAmount), 0)
    const pendingSellAmount = sellTasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').reduce((sum, t) => sum + Number(t.targetAmount), 0)
    const pendingAmount = Math.max(pendingBuyAmount, pendingSellAmount)
    
    const buyTotal = buyTasks.reduce((sum, t) => sum + Number(t.targetAmount), 0)
    const sellTotal = sellTasks.reduce((sum, t) => sum + Number(t.targetAmount), 0)
    const totalAmount = Math.max(buyTotal, sellTotal)

    const percent = totalTasks > 0
      ? Math.round(((completedTasks + skippedTasks) / totalTasks) * 100)
      : 0

    // 计算当前期数：第一个未完成任务的 periodNumber
    const firstPending = tasks.find(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS')
    const currentPeriod = firstPending ? Number(firstPending.periodNumber) : (tasks.length > 0 ? Number(tasks[tasks.length - 1].periodNumber) : 1)

    return { totalTasks, completedTasks, skippedTasks, pendingTasks, completedAmount, pendingAmount, totalAmount, percent, currentPeriod }
  }

  /**
   * 格式化计划为前端 summary 格式
   */
  private static formatPlanSummary(plan: any, autoProgress: AutoProgress | null = null): RebalancePlanSummary {
    const tasks = (plan.tasks || []).map((t: any) => this.formatTask(t))
    const progress = this.calculateProgress(plan.tasks || [])
    const snapshot = plan.portfolioSnapshot as any

    return {
      id: plan.id,
      name: plan.name,
      status: plan.status,
      periodType: plan.periodType,
      totalPeriods: plan.totalPeriods,
      totalGapAmount: Number(plan.totalGapAmount),
      startDate: plan.startDate instanceof Date ? plan.startDate.toISOString() : plan.startDate,
      endDate: plan.endDate instanceof Date ? plan.endDate.toISOString() : plan.endDate,
      adviceId: plan.adviceId,
      strategySource: snapshot?.strategySource || null,
      strategyReasoning: snapshot?.strategyReasoning || null,
      createdAt: plan.createdAt instanceof Date ? plan.createdAt.toISOString() : plan.createdAt,
      progress,
      autoProgress,
      tasks,
    }
  }

  /**
   * 格式化单个任务
   */
  private static formatTask(task: any): RebalanceTaskItem {
    return {
      id: task.id,
      periodNumber: task.periodNumber,
      categoryCode: task.categoryCode,
      categoryName: task.categoryName,
      action: task.action,
      targetAmount: Number(task.targetAmount),
      actualAmount: task.actualAmount != null ? Number(task.actualAmount) : null,
      status: task.status,
      dueDate: task.dueDate instanceof Date ? task.dueDate.toISOString() : task.dueDate,
      completedAt: task.completedAt ? (task.completedAt instanceof Date ? task.completedAt.toISOString() : task.completedAt) : null,
      notes: task.notes,
      isCustom: task.isCustom,
    }
  }
}
