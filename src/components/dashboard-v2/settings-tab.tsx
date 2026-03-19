'use client'

import {
  Sun,
  Moon,
  Monitor,
  Check,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Globe,
  Bell,
  BellOff,
  Sparkles,
  RefreshCw,
  CreditCard,
  Landmark,
  BarChart3,
} from 'lucide-react'
import { useDashboardV2 } from '@/app/dashboard-v2/layout'
import { useSettings, defaultSettings } from '@/components/dashboard-v2/use-settings'
import type {
  ThemeMode,
  PnLColorScheme,
  CurrencyUnit,
  AmountFormat,
  DefaultView,
  NotificationSources,
} from '@/components/dashboard-v2/use-settings'

// ─── Component ─────────────────────────────────────────
export function SettingsTab() {
  const { viewMode, amountVisible } = useDashboardV2()
  const { settings, update } = useSettings()

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-foreground">设置</h2>
        <p className="mt-1 text-xs text-muted-foreground">个性化你的 Dashboard 体验</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* ═══════════════════════════════════════════════
            Section 1: Appearance
            ═══════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold text-foreground">外观主题</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">切换整体视觉风格</p>
          </div>
          <div className="flex flex-col gap-5 p-5">
            {/* Theme Selector */}
            <div>
              <span className="mb-3 block text-xs font-medium text-muted-foreground">主题风格</span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {([
                  {
                    id: 'light' as ThemeMode,
                    label: '浅色',
                    icon: Sun,
                    desc: '明亮清新',
                    preview: 'bg-white border-slate-200 dark:bg-slate-100 dark:border-slate-300',
                    previewBar: 'bg-slate-100',
                    previewAccent: 'bg-blue-500',
                  },
                  {
                    id: 'dark' as ThemeMode,
                    label: '深色',
                    icon: Moon,
                    desc: '暗夜护眼',
                    preview: 'bg-slate-900 border-slate-700',
                    previewBar: 'bg-slate-800',
                    previewAccent: 'bg-blue-400',
                  },
                  {
                    id: 'blue-pro' as ThemeMode,
                    label: '蓝色专业版',
                    icon: Monitor,
                    desc: '专业沉稳',
                    preview: 'bg-slate-800 border-blue-500/40',
                    previewBar: 'bg-blue-900/60',
                    previewAccent: 'bg-blue-500',
                  },
                ] as const).map((t) => {
                  const Icon = t.icon
                  const isActive = settings.theme === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => update({ theme: t.id })}
                      className={`relative flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 transition-all ${
                        isActive
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-muted-foreground/30 hover:bg-muted/20'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </span>
                      )}
                      <div className={`flex h-16 w-full flex-col gap-1.5 overflow-hidden rounded-lg border p-2 ${t.preview}`}>
                        <div className={`h-2 w-3/4 rounded ${t.previewBar}`} />
                        <div className="flex gap-1">
                          <div className={`h-6 flex-1 rounded ${t.previewBar}`} />
                          <div className={`h-6 flex-1 rounded ${t.previewBar}`} />
                          <div className={`h-6 flex-1 rounded ${t.previewBar}`} />
                        </div>
                        <div className={`h-1 w-1/2 rounded ${t.previewAccent}`} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">{t.label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{t.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* P&L Color Scheme */}
            <div>
              <span className="mb-3 block text-xs font-medium text-muted-foreground">涨跌颜色</span>
              <div className="grid grid-cols-2 gap-3">
                {([
                  {
                    id: 'red-green' as PnLColorScheme,
                    label: '涨红跌绿',
                    desc: 'A股习惯',
                    upColor: 'text-red-500',
                    downColor: 'text-emerald-600',
                    upBg: 'bg-red-500/10',
                    downBg: 'bg-emerald-500/10',
                  },
                  {
                    id: 'green-red' as PnLColorScheme,
                    label: '涨绿跌红',
                    desc: '美股习惯',
                    upColor: 'text-emerald-600',
                    downColor: 'text-red-500',
                    upBg: 'bg-emerald-500/10',
                    downBg: 'bg-red-500/10',
                  },
                ] as const).map((scheme) => {
                  const isActive = settings.pnlColor === scheme.id
                  return (
                    <button
                      key={scheme.id}
                      onClick={() => update({ pnlColor: scheme.id })}
                      className={`relative flex items-center gap-4 rounded-xl border-2 p-4 transition-all ${
                        isActive
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-muted-foreground/30 hover:bg-muted/20'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </span>
                      )}
                      <div className="flex flex-col gap-1.5">
                        <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 ${scheme.upBg}`}>
                          <TrendingUp className={`h-3.5 w-3.5 ${scheme.upColor}`} />
                          <span className={`text-xs font-semibold ${scheme.upColor}`} style={{ fontVariantNumeric: 'tabular-nums' }}>+12.3%</span>
                        </div>
                        <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 ${scheme.downBg}`}>
                          <TrendingDown className={`h-3.5 w-3.5 ${scheme.downColor}`} />
                          <span className={`text-xs font-semibold ${scheme.downColor}`} style={{ fontVariantNumeric: 'tabular-nums' }}>-5.8%</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 text-left">
                        <span className="text-sm font-medium text-foreground">{scheme.label}</span>
                        <span className="text-[11px] text-muted-foreground">{scheme.desc}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            Section 2: Display Preferences
            ═══════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold text-foreground">显示偏好</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">控制数据展示方式</p>
          </div>
          <div className="divide-y divide-border">
            <SettingRow
              label="默认币种"
              desc="影响所有金额的显示单位"
              icon={<Globe className="h-4 w-4 text-blue-500" />}
            >
              <div className="flex gap-1">
                {(['CNY', 'USD', 'HKD'] as CurrencyUnit[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => update({ currency: c })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      settings.currency === c
                        ? 'bg-foreground text-background shadow-sm'
                        : 'border border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {c === 'CNY' ? '¥ CNY' : c === 'USD' ? '$ USD' : 'HK$ HKD'}
                  </button>
                ))}
              </div>
            </SettingRow>

            <SettingRow
              label="金额格式"
              desc="选择金额数字的显示方式"
              icon={<span className="flex h-4 w-4 items-center justify-center text-xs font-bold text-amber-500">#</span>}
            >
              <div className="flex gap-1">
                {([
                  { id: 'compact' as AmountFormat, label: '¥692万' },
                  { id: 'full' as AmountFormat, label: '¥6,920,000' },
                ] as const).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => update({ amountFormat: f.id })}
                    className={`flex flex-col items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      settings.amountFormat === f.id
                        ? 'bg-foreground text-background shadow-sm'
                        : 'border border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{f.label}</span>
                  </button>
                ))}
              </div>
            </SettingRow>

            <SettingRow
              label="默认隐藏金额"
              desc="每次进入时自动遮掩所有金额"
              icon={settings.defaultHidden ? <EyeOff className="h-4 w-4 text-slate-500" /> : <Eye className="h-4 w-4 text-slate-500" />}
            >
              <ToggleSwitch checked={settings.defaultHidden} onChange={(v) => update({ defaultHidden: v })} />
            </SettingRow>

            <SettingRow
              label="默认视图"
              desc="进入 Dashboard 时默认显示"
              icon={<span className="text-xs">👤</span>}
            >
              <div className="flex gap-1">
                {([
                  { id: 'personal' as DefaultView, label: '个人' },
                  { id: 'family' as DefaultView, label: '家庭' },
                ] as const).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => update({ defaultView: v.id })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      settings.defaultView === v.id
                        ? 'bg-foreground text-background shadow-sm'
                        : 'border border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </SettingRow>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            Section 3: Data Settings
            ═══════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold text-foreground">数据设置</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">数据来源与同步配置</p>
          </div>
          <div className="divide-y divide-border">
            <SettingRow
              label="汇率来源"
              desc="自动从 API 获取或手动设定固定汇率"
              icon={<RefreshCw className="h-4 w-4 text-emerald-500" />}
            >
              <div className="flex gap-1">
                {([
                  { id: 'auto' as const, label: '自动获取' },
                  { id: 'manual' as const, label: '手动设定' },
                ] as const).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => update({ exchangeSource: s.id })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      settings.exchangeSource === s.id
                        ? 'bg-foreground text-background shadow-sm'
                        : 'border border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </SettingRow>

            <SettingRow
              label="资产刷新频率"
              desc="控制证券持仓价格自动更新的频率（实时=5分钟，每日=1小时，每周=手动）"
              icon={<RefreshCw className="h-4 w-4 text-blue-500" />}
            >
              <div className="flex gap-1">
                {([
                  { id: 'realtime' as const, label: '实时' },
                  { id: 'daily' as const, label: '每日' },
                  { id: 'weekly' as const, label: '每周' },
                ] as const).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => update({ refreshFreq: f.id })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      settings.refreshFreq === f.id
                        ? 'bg-foreground text-background shadow-sm'
                        : 'border border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </SettingRow>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            Section 4: Notifications
            ═══════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold text-foreground">通知提醒</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">到期与变动的推送设置</p>
          </div>
          <div className="divide-y divide-border">
            <SettingRow
              label="到期提前提醒"
              desc="提前几天推送到期通知"
              icon={<Bell className="h-4 w-4 text-amber-500" />}
            >
              <div className="flex gap-1">
                {([3, 7, 15] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => update({ reminderDays: d })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      settings.reminderDays === d
                        ? 'bg-foreground text-background shadow-sm'
                        : 'border border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {d} 天
                  </button>
                ))}
              </div>
            </SettingRow>

            <SettingRow
              label="大额变动提醒"
              desc={`单日资产变动超过 ${settings.largeChangeThreshold}% 时推送通知`}
              icon={settings.largeChangeAlert ? <Bell className="h-4 w-4 text-red-500" /> : <BellOff className="h-4 w-4 text-slate-400" />}
            >
              <div className="flex flex-wrap items-center gap-2">
                {settings.largeChangeAlert && (
                  <div className="flex items-center gap-1">
                    {[3, 5, 10].map((v) => (
                      <button
                        key={v}
                        onClick={() => update({ largeChangeThreshold: v })}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          settings.largeChangeThreshold === v
                            ? 'bg-foreground text-background shadow-sm'
                            : 'border border-border bg-background text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {v}%
                      </button>
                    ))}
                  </div>
                )}
                <ToggleSwitch checked={settings.largeChangeAlert} onChange={(v) => update({ largeChangeAlert: v })} />
              </div>
            </SettingRow>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            Section 4.5: Notification Sources
            ═══════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold text-foreground">通知来源管理</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">选择需要接收的通知类型，关闭后将不再显示对应通知</p>
          </div>
          {(() => {
            const ns = settings.notificationSources ?? defaultSettings.notificationSources
            const updateNs = (patch: Partial<NotificationSources>) =>
              update({ notificationSources: { ...ns, ...patch } })
            return (
              <div className="divide-y divide-border">
                <SettingRow
                  label="存款/国债到期"
                  desc="定期存款、大额存单、国债到期及付息提醒"
                  icon={<Landmark className="h-4 w-4 text-amber-500" />}
                >
                  <ToggleSwitch
                    checked={ns.maturityReminder ?? true}
                    onChange={(v) => updateNs({ maturityReminder: v })}
                  />
                </SettingRow>

                <SettingRow
                  label="还款日提醒"
                  desc="信用卡还款、贷款还款日临近提醒"
                  icon={<CreditCard className="h-4 w-4 text-orange-500" />}
                >
                  <ToggleSwitch
                    checked={ns.paymentReminder ?? true}
                    onChange={(v) => updateNs({ paymentReminder: v })}
                  />
                </SettingRow>

                <SettingRow
                  label="大额变动通知"
                  desc="总资产单日大幅增值或缩水时通知"
                  icon={<BarChart3 className="h-4 w-4 text-blue-500" />}
                >
                  <ToggleSwitch
                    checked={ns.largeChangeAlert ?? true}
                    onChange={(v) => updateNs({ largeChangeAlert: v })}
                  />
                </SettingRow>

                <SettingRow
                  label="AI 配置建议"
                  desc="资产配置偏离目标时的 AI 风险提示与建议"
                  icon={<Sparkles className="h-4 w-4 text-purple-500" />}
                >
                  <ToggleSwitch
                    checked={ns.aiSuggestion ?? true}
                    onChange={(v) => updateNs({ aiSuggestion: v })}
                  />
                </SettingRow>
              </div>
            )
          })()}
        </section>

        {/* ═══════════════════════════════════════════════
            Section 5: AI Configuration
            ═══════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-purple-200/60 dark:border-purple-800/40 bg-card">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-foreground">AI 智能配置</h3>
              <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-400">
                DeepSeek
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">调整 AI 分析的运行方式</p>
          </div>
          <div className="divide-y divide-border">
            <SettingRow
              label="AI 分析频率"
              desc="自动运行投资健康度评估的频率"
              icon={<Sparkles className="h-4 w-4 text-purple-500" />}
            >
              <div className="flex gap-1">
                {([
                  { id: 'weekly' as const, label: '每周' },
                  { id: 'monthly' as const, label: '每月' },
                  { id: 'manual' as const, label: '手动触发' },
                ] as const).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => update({ aiFrequency: f.id })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      settings.aiFrequency === f.id
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'border border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </SettingRow>
          </div>
        </section>

        {/* ─── Save status ─── */}
        <div className="flex items-center justify-between rounded-xl bg-muted/30 px-5 py-3">
          <span className="text-xs text-muted-foreground">设置修改自动保存到本地</span>
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <Check className="h-3 w-3" />
            已同步
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Reusable Components ──────────────────────────────

function SettingRow({
  label,
  desc,
  icon,
  children,
}: {
  label: string
  desc: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/40">
          {icon}
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-[11px] text-muted-foreground">{desc}</span>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-[52px] shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors ${
        checked
          ? 'border-emerald-500 bg-emerald-500'
          : 'border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-700'
      }`}
    >
      <span
        className={`absolute text-[9px] font-bold leading-none ${
          checked
            ? 'left-1.5 text-white'
            : 'right-1.5 text-gray-400 dark:text-gray-500'
        }`}
      >
        {checked ? 'ON' : 'OFF'}
      </span>
      <span
        className={`pointer-events-none inline-block h-[22px] w-[22px] rounded-full shadow-md ring-0 transition-transform ${
          checked ? 'translate-x-[26px] bg-white' : 'translate-x-0 bg-white dark:bg-gray-300'
        }`}
      />
    </button>
  )
}
