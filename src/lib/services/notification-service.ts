import { prisma } from '@/lib/prisma';

// ─── 类型定义 ──────────────────────────────────────────

export type NotificationType =
  | 'maturity'       // 资产到期（存款/国债）
  | 'payment'        // 还款提醒（信用卡/贷款）
  | 'large_change'   // 大额资产变动
  | 'ai_suggestion'  // AI风险/建议
  | 'info'           // 一般信息

export type NotificationPriority = 'urgent' | 'warning' | 'info'

export interface NotificationItem {
  id: string
  type: NotificationType
  priority: NotificationPriority
  title: string
  message: string
  amount?: number
  currency?: string
  /** 到期/还款日期 */
  dueDate?: string
  /** 距到期天数 */
  daysUntilDue?: number
  /** 标签文字 */
  tag: string
  /** 标签颜色 class */
  tagColor: string
  /** 来源实体信息 */
  sourceId?: string
  sourceType?: string
  createdAt: string
}

export interface NotificationsResult {
  /** 全部通知（已排序：紧急 > 警告 > 信息） */
  notifications: NotificationItem[]
  /** 即将到期事项（专供右侧面板） */
  upcomingEvents: UpcomingEvent[]
  /** 总数 */
  total: number
  /** 未读/紧急数 */
  urgentCount: number
  generatedAt: string
}

export interface UpcomingEvent {
  id: string
  name: string
  type: 'maturity' | 'payment'
  dueDate: string
  /** 到期日的 day */
  day: number
  /** 到期日的月份 */
  month: number
  /** 距到期天数 */
  daysUntilDue: number
  amount: number
  currency: string
  /** 是否紧急（小于 reminderDays） */
  urgent: boolean
  /** 来源描述 */
  description: string
}

// ─── 服务 ──────────────────────────────────────────────

export class NotificationService {
  /**
   * 获取用户通知聚合
   *
   * 多来源聚合：
   * 1. 资产到期：Asset.maturityDate（存款/国债/债券等）
   * 2. 还款提醒：Liability.nextPaymentDate + maturityDate
   * 3. 大额变动：对比最近快照
   * 4. AI建议：最新 AllocationAdvice 中的关键提示
   *
   * @param userId 用户ID
   * @param reminderDays 提前提醒天数（默认7）
   * @param largeChangeThreshold 大额变动阈值百分比（默认5）
   */
  static async getNotifications(
    userId: string,
    reminderDays = 7,
    largeChangeThreshold = 5,
  ): Promise<NotificationsResult> {
    const now = new Date()
    // 搜索范围：当前日期到 reminderDays*2 天后（多取一些以便前端筛选）
    const lookAheadDays = Math.max(reminderDays * 2, 30)
    const lookAheadDate = new Date(now)
    lookAheadDate.setDate(lookAheadDate.getDate() + lookAheadDays)

    // 并行查询所有数据源
    const [
      assetsWithMaturity,
      liabilitiesWithDates,
      recentSnapshots,
      latestAdvice,
    ] = await Promise.all([
      // 1. 有到期日的资产（已到期或未来 lookAheadDays 内到期）
      prisma.asset.findMany({
        where: {
          userId,
          maturityDate: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7), // 包含最近7天已到期的
            lte: lookAheadDate,
          },
        },
        include: { assetCategory: true },
        orderBy: { maturityDate: 'asc' },
      }),

      // 2. 有还款日/到期日的负债
      prisma.liability.findMany({
        where: {
          userId,
          isActive: true,
          OR: [
            {
              nextPaymentDate: {
                gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30),
                lte: lookAheadDate,
              },
            },
            {
              maturityDate: {
                gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
                lte: lookAheadDate,
              },
            },
          ],
        },
        orderBy: { nextPaymentDate: 'asc' },
      }),

      // 3. 最近两条快照（用于计算日变动）
      prisma.portfolioHistory.findMany({
        where: { userId },
        orderBy: { snapshotDate: 'desc' },
        take: 2,
      }),

      // 4. 最新 AI 建议
      prisma.allocationAdvice.findFirst({
        where: {
          userId,
          status: { in: ['PENDING', 'ACTIVE'] },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const notifications: NotificationItem[] = []
    const upcomingEvents: UpcomingEvent[] = []

    // ── 来源1：资产到期提醒 ──
    for (const asset of assetsWithMaturity) {
      if (!asset.maturityDate) continue
      const matDate = new Date(asset.maturityDate)
      const daysUntil = Math.ceil((matDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const isExpired = daysUntil < 0
      const isUrgent = daysUntil >= 0 && daysUntil <= reminderDays

      const categoryName = asset.assetCategory?.name || '资产'
      const isDeposit = categoryName.includes('存款') || categoryName.includes('现金')
      const isBond = categoryName.includes('国债') || categoryName.includes('债券') || categoryName.includes('固收')

      let typeLabel = '资产到期'
      if (isDeposit) typeLabel = '存款到期'
      if (isBond) typeLabel = isBond && asset.name.includes('付息') ? '国债付息' : '债券到期'

      const priority: NotificationPriority = isExpired ? 'urgent' : isUrgent ? 'warning' : 'info'

      const messagePrefix = isExpired
        ? `已到期${Math.abs(daysUntil)}天`
        : daysUntil === 0
        ? '今日到期'
        : `${daysUntil}天后到期`

      notifications.push({
        id: `maturity-${asset.id}`,
        type: 'maturity',
        priority,
        title: asset.name,
        message: `${typeLabel}：${messagePrefix}，金额 ¥${Number(asset.currentValue).toLocaleString()}`,
        amount: Number(asset.currentValue),
        currency: asset.currency,
        dueDate: matDate.toISOString(),
        daysUntilDue: daysUntil,
        tag: isExpired ? '已到期' : '到期',
        tagColor: isExpired
          ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
          : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
        sourceId: asset.id,
        sourceType: 'asset',
        createdAt: now.toISOString(),
      })

      // 加入即将到期列表
      if (!isExpired) {
        upcomingEvents.push({
          id: `maturity-${asset.id}`,
          name: asset.name,
          type: 'maturity',
          dueDate: matDate.toISOString(),
          day: matDate.getDate(),
          month: matDate.getMonth() + 1,
          daysUntilDue: daysUntil,
          amount: Number(asset.currentValue),
          currency: asset.currency,
          urgent: isUrgent,
          description: typeLabel,
        })
      }
    }

    // ── 来源2：负债还款/到期提醒 ──
    for (const liability of liabilitiesWithDates) {
      // 处理 nextPaymentDate（还款日）
      if (liability.nextPaymentDate) {
        const payDate = new Date(liability.nextPaymentDate)
        const daysUntil = Math.ceil((payDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        const isOverdue = daysUntil < 0
        const isUrgent = daysUntil >= 0 && daysUntil <= reminderDays

        const priority: NotificationPriority = isOverdue ? 'urgent' : isUrgent ? 'warning' : 'info'
        const paymentAmount = Number(liability.monthlyPayment || liability.currentBalance)

        const messagePrefix = isOverdue
          ? `已逾期${Math.abs(daysUntil)}天`
          : daysUntil === 0
          ? '今日应还'
          : `${daysUntil}天后到期`

        notifications.push({
          id: `payment-${liability.id}`,
          type: 'payment',
          priority,
          title: `${liability.name}还款`,
          message: `${messagePrefix}，应还 ¥${paymentAmount.toLocaleString()}`,
          amount: paymentAmount,
          currency: liability.currency,
          dueDate: payDate.toISOString(),
          daysUntilDue: daysUntil,
          tag: isOverdue ? '逾期' : '还款',
          tagColor: isOverdue
            ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
          sourceId: liability.id,
          sourceType: 'liability',
          createdAt: now.toISOString(),
        })

        if (!isOverdue) {
          upcomingEvents.push({
            id: `payment-${liability.id}`,
            name: `${liability.name}还款`,
            type: 'payment',
            dueDate: payDate.toISOString(),
            day: payDate.getDate(),
            month: payDate.getMonth() + 1,
            daysUntilDue: daysUntil,
            amount: paymentAmount,
            currency: liability.currency,
            urgent: isUrgent || isOverdue,
            description: liability.type === 'CREDIT_CARD' ? '信用卡还款' : '贷款还款',
          })
        } else if (Math.abs(daysUntil) <= 30) {
          // 逾期不超过15天的还款也显示在即将到期列表中
          upcomingEvents.push({
            id: `payment-overdue-${liability.id}`,
            name: `${liability.name}还款（逾期）`,
            type: 'payment',
            dueDate: payDate.toISOString(),
            day: payDate.getDate(),
            month: payDate.getMonth() + 1,
            daysUntilDue: daysUntil,
            amount: paymentAmount,
            currency: liability.currency,
            urgent: true,
            description: `${liability.type === 'CREDIT_CARD' ? '信用卡' : '贷款'}逾期${Math.abs(daysUntil)}天`,
          })
        }
      }

      // 处理 maturityDate（贷款到期日，与 nextPaymentDate 不同）
      if (liability.maturityDate && (!liability.nextPaymentDate ||
          liability.maturityDate.getTime() !== liability.nextPaymentDate.getTime())) {
        const matDate = new Date(liability.maturityDate)
        const daysUntil = Math.ceil((matDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        if (daysUntil >= 0 && daysUntil <= lookAheadDays) {
          const isUrgent = daysUntil <= reminderDays
          notifications.push({
            id: `liability-maturity-${liability.id}`,
            type: 'maturity',
            priority: isUrgent ? 'warning' : 'info',
            title: `${liability.name}到期`,
            message: `贷款将于${daysUntil}天后到期，余额 ¥${Number(liability.currentBalance).toLocaleString()}`,
            amount: Number(liability.currentBalance),
            currency: liability.currency,
            dueDate: matDate.toISOString(),
            daysUntilDue: daysUntil,
            tag: '到期',
            tagColor: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
            sourceId: liability.id,
            sourceType: 'liability',
            createdAt: now.toISOString(),
          })
        }
      }
    }

    // ── 来源3：大额变动提醒 ──
    if (recentSnapshots.length >= 2) {
      const [latest, previous] = recentSnapshots
      const latestAssets = Number(latest.totalAssets || latest.totalValueCny || 0)
      const prevAssets = Number(previous.totalAssets || previous.totalValueCny || 0)

      if (prevAssets > 0) {
        const changePercent = ((latestAssets - prevAssets) / prevAssets) * 100
        if (Math.abs(changePercent) >= largeChangeThreshold) {
          const isPositive = changePercent > 0
          const changeAmount = latestAssets - prevAssets
          notifications.push({
            id: `large-change-${latest.id}`,
            type: 'large_change',
            priority: Math.abs(changePercent) >= largeChangeThreshold * 2 ? 'urgent' : 'warning',
            title: isPositive ? '资产大幅增值' : '资产大幅缩水',
            message: `总资产${isPositive ? '增长' : '下降'} ${Math.abs(changePercent).toFixed(1)}%（${isPositive ? '+' : ''}¥${changeAmount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}）`,
            amount: changeAmount,
            tag: isPositive ? '增值' : '缩水',
            tagColor: isPositive
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
            createdAt: latest.createdAt.toISOString(),
          })
        }
      }
    }

    // ── 来源4：AI建议/风险提示 ──
    if (latestAdvice) {
      try {
        const adviceData = latestAdvice.advice as any
        // 提取偏离建议（过高/过低的配置）
        const items = Array.isArray(adviceData) ? adviceData : adviceData?.categories || adviceData?.items || []
        for (const item of items) {
          const deviation = Number(item.deviation || item.deviationPercent || 0)
          if (Math.abs(deviation) >= 5) {
            const isOver = deviation > 0
            notifications.push({
              id: `ai-${latestAdvice.id}-${item.category || item.name || Math.random()}`,
              type: 'ai_suggestion',
              priority: Math.abs(deviation) >= 10 ? 'warning' : 'info',
              title: `${item.category || item.name || '配置'}${isOver ? '占比偏高' : '严重不足'}`,
              message: `${item.category || item.name} 偏差 ${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%，${item.action || (isOver ? '建议减持' : '建议增配')}`,
              tag: 'AI建议',
              tagColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
              sourceId: latestAdvice.id,
              sourceType: 'advice',
              createdAt: latestAdvice.createdAt.toISOString(),
            })
          }
        }
      } catch {
        // AI 建议数据格式异常，忽略
      }

      // 也添加总结性通知
      if (latestAdvice.summary) {
        notifications.push({
          id: `ai-summary-${latestAdvice.id}`,
          type: 'ai_suggestion',
          priority: 'info',
          title: 'AI 配置分析',
          message: latestAdvice.summary.length > 80
            ? latestAdvice.summary.substring(0, 80) + '...'
            : latestAdvice.summary,
          tag: 'AI建议',
          tagColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
          sourceId: latestAdvice.id,
          sourceType: 'advice',
          createdAt: latestAdvice.createdAt.toISOString(),
        })
      }
    }

    // ── 排序：紧急 > 警告 > 信息，同级别按到期日/创建日排序 ──
    const priorityOrder: Record<NotificationPriority, number> = {
      urgent: 0,
      warning: 1,
      info: 2,
    }
    notifications.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (pDiff !== 0) return pDiff
      // 同优先级：有到期日的按到期日排序，否则按创建时间
      if (a.daysUntilDue !== undefined && b.daysUntilDue !== undefined) {
        return a.daysUntilDue - b.daysUntilDue
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    // 即将到期事项按到期日排序
    upcomingEvents.sort((a, b) => a.daysUntilDue - b.daysUntilDue)

    const urgentCount = notifications.filter(n => n.priority === 'urgent' || n.priority === 'warning').length

    return {
      notifications,
      upcomingEvents,
      total: notifications.length,
      urgentCount,
      generatedAt: now.toISOString(),
    }
  }
}
