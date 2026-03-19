'use client'

import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Loader2,
  Clock,
  CreditCard,
  Landmark,
  AlertCircle,
} from 'lucide-react'
import { useDashboardV2 } from '@/app/dashboard-v2/layout'
import { useSettings } from '@/components/dashboard-v2/use-settings'

interface RightPanelProps {
  visible: boolean
}

export function RightPanel({ visible }: RightPanelProps) {
  const { pnlColor, fmt, settings } = useSettings()
  const { apiData } = useDashboardV2()
  const mc = apiData.monthlyChanges
  const notif = apiData.notificationsData

  // 格式化更新时间
  const updatedAtText = mc?.updatedAt
    ? (() => {
        const d = new Date(mc.updatedAt)
        return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
      })()
    : ''

  // 格式化变动金额（带符号）
  const fmtChange = (amount: number) => {
    const sign = amount >= 0 ? '+' : ''
    return `${sign}${fmt(amount)}`
  }

  const isLoading = !mc && apiData.isLoading
  const isNotifLoading = !notif && apiData.isLoading

  // 根据用户设置过滤即将到期事件
  const upcomingEvents = (notif?.upcomingEvents || []).filter(event => {
    if (event.type === 'maturity' && !settings.notificationSources.maturityReminder) return false
    if (event.type === 'payment' && !settings.notificationSources.paymentReminder) return false
    return true
  })

  return (
    <div className="flex flex-col gap-3 sm:gap-4 lg:col-span-2">
      {/* Monthly Asset Change Summary */}
      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
        <div className="mb-2 sm:mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">本月资产变动</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !mc || (mc.items.length === 0 && mc.netWorthChange === 0) ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            暂无本月变动数据
          </div>
        ) : (
          <>
            {/* Net change highlight */}
            <div className="mb-2 sm:mb-3 flex items-center justify-between rounded-xl bg-muted/30 p-2.5 sm:p-3">
              <span className="text-[11px] sm:text-xs text-muted-foreground">净资产变化</span>
              <span
                className={`text-sm sm:text-base font-bold ${pnlColor(mc.netWorthChange)}`}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {visible ? fmtChange(mc.netWorthChange) : '****'}
              </span>
            </div>

            {/* Change items */}
            <div className="flex flex-col gap-1">
              {mc.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 sm:gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/30 sm:px-2 sm:py-2"
                >
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg sm:h-7 sm:w-7 ${
                      item.positive ? 'bg-emerald-500/10' : 'bg-red-500/10'
                    }`}
                  >
                    {item.positive ? (
                      <TrendingUp className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${pnlColor(1)}`} />
                    ) : (
                      <TrendingDown className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${pnlColor(-1)}`} />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-0 sm:gap-0.5 overflow-hidden">
                    <span className="truncate text-[11px] sm:text-xs font-medium text-foreground">
                      {item.name}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground">{item.type}</span>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-semibold ${pnlColor(item.amount)}`}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {visible ? fmtChange(item.amount) : '****'}
                  </span>
                </div>
              ))}
            </div>

            {updatedAtText && (
              <p className="mt-3 text-right text-[10px] text-muted-foreground/60">
                上次更新：{updatedAtText}
              </p>
            )}
          </>
        )}
      </div>

      {/* Upcoming Events — 即将到期（真实数据） */}
      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
        <div className="mb-2 sm:mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">即将到期</span>
          </div>
          {upcomingEvents.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {upcomingEvents.length} 项
            </span>
          )}
        </div>

        {isNotifLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className="py-6 text-center">
            <AlertCircle className="mx-auto mb-2 h-5 w-5 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              近期无到期事项
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 sm:gap-2">
            {upcomingEvents.slice(0, 5).map((event) => {
              const EventIcon = event.type === 'payment' ? CreditCard : Landmark
              const urgentLabel = event.daysUntilDue < 0
                ? `已逾期${Math.abs(event.daysUntilDue)}天`
                : event.daysUntilDue === 0
                ? '今日到期'
                : event.daysUntilDue === 1
                ? '明天到期'
                : `${event.daysUntilDue}天后到期`

              return (
                <div
                  key={event.id}
                  className={`flex items-center gap-2 sm:gap-3 rounded-xl p-2 sm:p-3 transition-colors ${
                    event.urgent
                      ? 'border border-red-100 bg-red-50/30 dark:border-red-900/40 dark:bg-red-950/20'
                      : 'border border-border bg-muted/10'
                  }`}
                >
                  {/* Date badge */}
                  <div
                    className={`flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-lg sm:h-10 sm:w-10 ${
                      event.urgent ? 'bg-red-500/10' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`text-[11px] sm:text-xs font-bold leading-none ${
                        event.urgent ? 'text-red-500' : 'text-foreground'
                      }`}
                    >
                      {event.day}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {event.month}月
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <EventIcon className={`h-3 w-3 shrink-0 ${event.urgent ? 'text-red-500' : 'text-muted-foreground'}`} />
                      <span className="truncate text-xs font-medium text-foreground">{event.name}</span>
                    </div>
                    <span
                      className={`text-[11px] ${
                        event.urgent ? 'font-medium text-red-500' : 'text-muted-foreground'
                      }`}
                    >
                      {event.urgent ? urgentLabel : `${event.month}月${event.day}日`}
                    </span>
                  </div>

                  {/* Amount */}
                  <span
                    className="shrink-0 text-xs font-semibold text-foreground"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {visible ? fmt(event.amount) : '****'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
