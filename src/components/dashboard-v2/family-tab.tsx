'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  UserPlus,
  Settings,
  Shield,
  TrendingUp,
  ArrowRight,
  Crown,
  Mail,
  Phone,
  Calendar,
  ChevronUp,
  ChevronDown,
  Target,
  PiggyBank,
  Wallet,
  Home,
  GraduationCap,
  Gift,
  Pencil,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  Check,
  AlertTriangle,
  Car,
  Umbrella,
  Heart,
  TrendingDown,
  Plane,
  Sparkles,
  DollarSign,
  ShieldCheck,
  Baby,
  UserCheck,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useDashboardV2 } from '@/app/dashboard-v2/layout'
import { useToast } from '@/components/ui/use-toast'

// ─── Types ───────────────────────────────────────

interface MemberData {
  id: string
  name: string
  email: string | null
  role: string
  joinedAt: string
}

interface MemberAssets {
  totalAssets: number
  netWorth: number
  totalLiabilities: number
  topHoldings: Array<{ name: string; value: number; type: string }>
}

interface GoalConfig {
  enabled: boolean
  customTargetAmount?: number
  customTargetYear?: number
}

interface FinancialGoals {
  goals: Record<string, GoalConfig>
  notes?: string
}

interface FamilyProfileData {
  householdMembers?: number
  primaryEarnerAge?: number
  childrenCount?: number
  elderlyCount?: number
  monthlyIncome?: number
  monthlyExpenses?: number
  incomeStability?: string
  emergencyFundMonths?: number
  riskTolerance?: string
  investmentHorizon?: string
  retirementAge?: number
  hasLifeInsurance?: boolean
  hasHealthInsurance?: boolean
  hasCriticalIllnessInsurance?: boolean
  financialGoals?: FinancialGoals
}

// ─── Goal type config ───

const GOAL_TYPE_MAP: Record<string, { name: string; icon: typeof Shield; color: string }> = {
  EMERGENCY_FUND:  { name: '应急储备金', icon: Shield,        color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
  RETIREMENT:      { name: '退休养老金', icon: Umbrella,      color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
  CHILD_EDUCATION: { name: '子女教育基金', icon: GraduationCap, color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10' },
  ELDERLY_CARE:    { name: '父母养老储备', icon: Heart,        color: 'text-pink-600 dark:text-pink-400 bg-pink-500/10' },
  HOME_PURCHASE:   { name: '购房首付', icon: Home,          color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
  HOME_UPGRADE:    { name: '换房升级', icon: Home,          color: 'text-orange-600 dark:text-orange-400 bg-orange-500/10' },
  EARLY_REPAYMENT: { name: '提前还贷', icon: TrendingDown,  color: 'text-red-600 dark:text-red-400 bg-red-500/10' },
  LIFE_INSURANCE:  { name: '寿险保障', icon: Shield,        color: 'text-teal-600 dark:text-teal-400 bg-teal-500/10' },
  TRAVEL:          { name: '家庭旅行', icon: Plane,         color: 'text-sky-600 dark:text-sky-400 bg-sky-500/10' },
  CAR_PURCHASE:    { name: '购车计划', icon: Car,           color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10' },
  PASSIVE_INCOME:  { name: '被动收入', icon: Sparkles,      color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
}

function fmtAmount(v: number): string {
  if (v >= 10000) return `¥${(v / 10000).toFixed(1)}万`
  return `¥${v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}

function fmtCurrency(v: number): string {
  return `¥${v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}

function getInitials(name: string): string {
  if (!name) return '?'
  if (/^[a-zA-Z]/.test(name)) return name.charAt(0).toUpperCase()
  return name.charAt(name.length > 1 ? name.length - 1 : 0)
}

const MEMBER_COLORS = ['bg-blue-500', 'bg-pink-500', 'bg-amber-500', 'bg-emerald-500', 'bg-purple-500']

// ─── Component ───────────────────────────────────

export function FamilyTab() {
  const { amountVisible, familyMembers, selectedMemberId, setSelectedMemberId, apiData } = useDashboardV2()
  const { toast } = useToast()
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'members' | 'goals' | 'settings'>('members')

  // ─── Members state ───
  const [membersData, setMembersData] = useState<MemberData[]>([])
  const [memberAssets, setMemberAssets] = useState<Record<string, MemberAssets>>({})
  const [membersLoading, setMembersLoading] = useState(false)
  const [assetsLoading, setAssetsLoading] = useState<Record<string, boolean>>({})

  // ─── Goals state ───
  const [familyProfile, setFamilyProfile] = useState<FamilyProfileData | null>(null)
  const [goalsLoading, setGoalsLoading] = useState(false)
  const [goalsSaving, setGoalsSaving] = useState(false)
  const [editingGoalType, setEditingGoalType] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editYear, setEditYear] = useState('')
  const [addGoalOpen, setAddGoalOpen] = useState(false)

  // ─── Invite state ───
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER')
  const [inviteSending, setInviteSending] = useState(false)

  // ─── Settings state ───
  const [confirmAction, setConfirmAction] = useState<'dissolve' | 'transfer' | null>(null)
  const [editingSetting, setEditingSetting] = useState<string | null>(null)
  const [settingValue, setSettingValue] = useState('')
  const [settingSaving, setSettingSaving] = useState(false)

  // ─── Generic profile field save ───
  const saveProfileField = useCallback(async (fields: Record<string, unknown>) => {
    setSettingSaving(true)
    try {
      const res = await fetch('/api/allocation/family-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!res.ok) throw new Error((await res.json()).error || '更新失败')
      const data = await res.json().catch(() => ({}))
      setFamilyProfile(prev => prev ? { ...prev, ...fields } as FamilyProfileData : prev)
      toast({ title: '已保存' })
      setEditingSetting(null)
      return data
    } catch (err: any) {
      toast({ title: '保存失败', description: err.message, variant: 'destructive' })
    } finally {
      setSettingSaving(false)
    }
  }, [toast])

  // ─── Derived ───
  const familyName = apiData.familyOverview?.familyName || '家庭财务管理'
  const totalAssets = apiData.familyOverview?.totalAssets || 0
  const totalLiabilities = apiData.familyOverview?.totalLiabilities || 0
  const netWorth = totalAssets - totalLiabilities

  // ─── Load members ───
  const loadMembers = useCallback(async () => {
    setMembersLoading(true)
    try {
      const res = await fetch('/api/family/members')
      const data = await res.json()
      if (res.ok && data.members) {
        // API returns { family, members, role }
        setMembersData(data.members.map((m: any) => ({
          id: m.userId || m.id,
          name: m.user?.name || m.name || '未知',
          email: m.user?.email || m.email || null,
          role: m.role || 'MEMBER',
          joinedAt: m.joinedAt || m.createdAt || '',
        })))
      }
    } catch {
      // Use familyMembers from context as fallback
    } finally {
      setMembersLoading(false)
    }
  }, [])

  // ─── Load member assets ───
  const loadMemberAssets = useCallback(async (userId: string) => {
    if (memberAssets[userId]) return // already loaded
    setAssetsLoading(prev => ({ ...prev, [userId]: true }))
    try {
      const res = await fetch(`/api/family/member-assets/${userId}`)
      const data = await res.json()
      if (res.ok && data.portfolio) {
        // API returns { portfolio, liability, member }
        const portfolio = data.portfolio
        const liability = data.liability
        const ta = portfolio?.totalAssets || 0
        const tl = liability?.totalLiabilities || 0
        setMemberAssets(prev => ({
          ...prev,
          [userId]: {
            totalAssets: ta,
            netWorth: ta - tl,
            totalLiabilities: tl,
            topHoldings: (portfolio?.holdings || [])
              .sort((a: any, b: any) => (b.marketValueCNY || b.marketValue || 0) - (a.marketValueCNY || a.marketValue || 0))
              .slice(0, 3)
              .map((h: any) => ({
                name: h.securityName || h.name || h.symbol || '',
                value: h.marketValueCNY || h.marketValue || 0,
                type: h.market === 'HK' ? '港股' : h.market === 'US' ? '美股' : '证券',
              })),
          },
        }))
      }
    } catch {
      // ignore
    } finally {
      setAssetsLoading(prev => ({ ...prev, [userId]: false }))
    }
  }, [memberAssets])

  // ─── Load family profile & goals ───
  const loadFamilyProfile = useCallback(async () => {
    setGoalsLoading(true)
    try {
      const res = await fetch('/api/allocation/family-profile')
      const data = await res.json()
      if (data.success && data.data) {
        setFamilyProfile(data.data)
      }
    } catch {
      // ignore
    } finally {
      setGoalsLoading(false)
    }
  }, [])

  // ─── Save goals ───
  const saveGoals = useCallback(async (updatedGoals: FinancialGoals) => {
    setGoalsSaving(true)
    try {
      const res = await fetch('/api/allocation/family-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialGoals: updatedGoals }),
      })
      const data = await res.json()
      if (data.success) {
        setFamilyProfile(prev => prev ? { ...prev, financialGoals: updatedGoals } : prev)
        toast({ title: '目标已保存', description: '财务目标已更新，AI 分析时将使用最新目标数据' })
      } else {
        toast({ title: '保存失败', description: data.error || '请稍后重试', variant: 'destructive' })
      }
    } catch {
      toast({ title: '保存失败', description: '网络错误', variant: 'destructive' })
    } finally {
      setGoalsSaving(false)
    }
  }, [toast])

  // ─── Invite member ───
  const sendInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return
    setInviteSending(true)
    try {
      const res = await fetch('/api/family/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: '邀请已发送', description: `已向 ${inviteEmail} 发送邀请` })
        setInviteOpen(false)
        setInviteEmail('')
      } else {
        toast({ title: '邀请失败', description: data.error || '请检查邮箱地址', variant: 'destructive' })
      }
    } catch {
      toast({ title: '邀请失败', description: '网络错误', variant: 'destructive' })
    } finally {
      setInviteSending(false)
    }
  }, [inviteEmail, inviteRole, toast])

  // ─── Initial data load ───
  useEffect(() => {
    loadMembers()
    loadFamilyProfile()
  }, [loadMembers, loadFamilyProfile])

  // ─── Load member assets when expanded ───
  useEffect(() => {
    if (expandedMember) {
      loadMemberAssets(expandedMember)
    }
  }, [expandedMember, loadMemberAssets])

  // ─── Members display data ───
  const displayMembers = membersData.length > 0 ? membersData : familyMembers.map((fm: any) => ({
    id: fm.id || fm.userId,
    name: fm.name || '未知',
    email: null,
    role: fm.role || 'MEMBER',
    joinedAt: '',
  }))

  // ─── Goals from profile ───
  const goals = familyProfile?.financialGoals?.goals || {}
  const enabledGoals = Object.entries(goals)
    .filter(([, config]) => config.enabled)
    .map(([type, config]) => ({
      type,
      ...(GOAL_TYPE_MAP[type] || { name: type, icon: Target, color: 'text-gray-600 bg-gray-500/10' }),
      targetAmount: config.customTargetAmount || 0,
      targetYear: config.customTargetYear || new Date().getFullYear() + 5,
      config,
    }))

  // ─── Goal editing helpers ───
  const startEditGoal = (type: string, config: GoalConfig) => {
    setEditingGoalType(type)
    setEditAmount(String(config.customTargetAmount || ''))
    setEditYear(String(config.customTargetYear || new Date().getFullYear() + 5))
  }

  const confirmEditGoal = () => {
    if (!editingGoalType) return
    const current = familyProfile?.financialGoals || { goals: {} }
    const updatedGoals: FinancialGoals = {
      ...current,
      goals: {
        ...current.goals,
        [editingGoalType]: {
          ...current.goals[editingGoalType],
          enabled: true,
          customTargetAmount: Number(editAmount) || 0,
          customTargetYear: Number(editYear) || new Date().getFullYear() + 5,
        },
      },
    }
    saveGoals(updatedGoals)
    setEditingGoalType(null)
  }

  const deleteGoal = (type: string) => {
    const current = familyProfile?.financialGoals || { goals: {} }
    const updatedGoals: FinancialGoals = {
      ...current,
      goals: {
        ...current.goals,
        [type]: { ...current.goals[type], enabled: false },
      },
    }
    saveGoals(updatedGoals)
  }

  const addGoal = (type: string) => {
    const current = familyProfile?.financialGoals || { goals: {} }
    const updatedGoals: FinancialGoals = {
      ...current,
      goals: {
        ...current.goals,
        [type]: { enabled: true, customTargetAmount: 0, customTargetYear: new Date().getFullYear() + 5 },
      },
    }
    saveGoals(updatedGoals)
    setAddGoalOpen(false)
    // Open edit immediately
    startEditGoal(type, { enabled: true, customTargetAmount: 0, customTargetYear: new Date().getFullYear() + 5 })
  }

  // Available goal types (not yet added)
  const availableGoalTypes = Object.entries(GOAL_TYPE_MAP)
    .filter(([type]) => !goals[type]?.enabled)

  return (
    <div className="flex flex-col gap-6">
      {/* Family Header */}
      <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 dark:border-amber-800/40 p-5 lg:p-7">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
              <Home className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{familyName}</h2>
              <p className="text-sm text-muted-foreground">
                {displayMembers.length} 名成员
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-white/80 dark:bg-amber-900/30 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 transition-colors hover:bg-white dark:hover:bg-amber-900/50"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">邀请成员</span>
            </button>
          </div>
        </div>

        {/* Family stats from real data */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: '家庭总资产', value: fmtAmount(totalAssets), icon: Wallet },
            { label: '家庭净资产', value: fmtAmount(netWorth), icon: PiggyBank },
            { label: '成员数', value: `${displayMembers.length} 人`, icon: Users },
            { label: '风险偏好', value: familyProfile?.riskTolerance === 'CONSERVATIVE' ? '稳健型' : familyProfile?.riskTolerance === 'AGGRESSIVE' ? '进取型' : '均衡型', icon: Target },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="rounded-xl bg-white/70 dark:bg-card/80 p-3.5">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-[11px] text-muted-foreground">{stat.label}</span>
                </div>
                <div className="mt-1.5">
                  <span className="text-base font-bold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {amountVisible ? stat.value : '****'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
        {[
          { id: 'members' as const, label: '成员管理', icon: Users },
          { id: 'goals' as const, label: '家庭目标', icon: Target },
          { id: 'settings' as const, label: '家庭设置', icon: Settings },
        ].map((section) => {
          const Icon = section.icon
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-medium transition-colors sm:gap-2 sm:text-sm ${
                activeSection === section.id
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {section.label}
            </button>
          )
        })}
      </div>

      {/* ═══════ Members Section ═══════ */}
      {activeSection === 'members' && (
        <div className="flex flex-col gap-4">
          {membersLoading ? (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">加载成员数据...</span>
            </div>
          ) : (
            displayMembers.map((member: any, idx: number) => {
              const isExpanded = expandedMember === member.id
              const assets = memberAssets[member.id]
              const isLoadingAssets = assetsLoading[member.id]
              return (
                <div
                  key={member.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
                >
                  {/* Member Header */}
                  <button
                    onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                    className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-muted/30"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className={`${MEMBER_COLORS[idx % MEMBER_COLORS.length]} text-base font-semibold text-white`}>
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-foreground">{member.name}</span>
                        {member.role === 'ADMIN' && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                            <Crown className="h-2.5 w-2.5" />
                            管理员
                          </span>
                        )}
                        {member.role === 'MEMBER' && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            成员
                          </span>
                        )}
                      </div>
                      {member.email && (
                        <span className="text-xs text-muted-foreground">{member.email}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedMemberId(member.id) }}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        查看视角
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/10 p-5">
                      {isLoadingAssets ? (
                        <div className="flex items-center gap-2 py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">加载资产数据...</span>
                        </div>
                      ) : assets ? (
                        <>
                          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                            {[
                              { label: '总资产', value: fmtCurrency(assets.totalAssets) },
                              { label: '净资产', value: fmtCurrency(assets.netWorth) },
                              { label: '总负债', value: fmtCurrency(assets.totalLiabilities) },
                            ].map((item) => (
                              <div key={item.label} className="flex flex-col gap-0.5">
                                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                                <span className="text-sm font-semibold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                  {amountVisible ? item.value : '****'}
                                </span>
                              </div>
                            ))}
                          </div>

                          {assets.topHoldings.length > 0 && (
                            <div className="mt-4">
                              <span className="text-xs font-medium text-muted-foreground">主要资产</span>
                              <div className="mt-2 flex flex-col gap-2">
                                {assets.topHoldings.map((asset) => (
                                  <div key={asset.name} className="flex items-center justify-between rounded-lg bg-card p-3">
                                    <div className="flex items-center gap-3">
                                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                        {asset.type}
                                      </span>
                                      <span className="text-sm text-foreground">{asset.name}</span>
                                    </div>
                                    <span className="text-sm font-semibold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                      {amountVisible ? fmtCurrency(asset.value) : '****'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">暂无资产数据</p>
                      )}

                      {member.email && (
                        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5" />
                            {member.email}
                          </div>
                          {member.joinedAt && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              加入于 {new Date(member.joinedAt).toLocaleDateString('zh-CN')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ═══════ Goals Section ═══════ */}
      {activeSection === 'goals' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">家庭财务目标</h3>
              <span className="text-[11px] text-muted-foreground">
                ({enabledGoals.length} 个目标)
              </span>
            </div>
            <div className="relative">
              <button
                onClick={() => setAddGoalOpen(!addGoalOpen)}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/20"
                disabled={goalsSaving}
              >
                <Plus className="h-3.5 w-3.5" />
                新增目标
              </button>
              {/* Add goal dropdown */}
              {addGoalOpen && availableGoalTypes.length > 0 && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setAddGoalOpen(false)} />
                  <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg" style={{ animation: 'fadeSlideIn 0.15s ease-out' }}>
                    {availableGoalTypes.map(([type, config]) => {
                      const Icon = config.icon
                      return (
                        <button
                          key={type}
                          onClick={() => addGoal(type)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                        >
                          <Icon className={`h-4 w-4 ${config.color.split(' ')[0]}`} />
                          {config.name}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
              {addGoalOpen && availableGoalTypes.length === 0 && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setAddGoalOpen(false)} />
                  <div className="absolute right-0 top-full z-40 mt-1 w-48 rounded-xl border border-border bg-card p-4 shadow-lg">
                    <p className="text-xs text-muted-foreground">所有目标类型已添加</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* AI Linkage hint */}
          <div className="flex items-center gap-2 rounded-xl border border-purple-200/60 dark:border-purple-800/40 bg-purple-50/20 dark:bg-purple-950/20 px-4 py-2.5">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-purple-500" />
            <span className="text-[11px] text-purple-700 dark:text-purple-400">
              家庭目标数据会自动同步到 AI 资产配置顾问，作为分析输入
            </span>
          </div>

          {goalsLoading ? (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">加载目标数据...</span>
            </div>
          ) : enabledGoals.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-12">
              <Target className="h-10 w-10 text-muted-foreground/30" />
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">暂无财务目标</p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  点击「新增目标」开始规划家庭财务目标
                </p>
              </div>
            </div>
          ) : (
            enabledGoals.map((goal) => {
              const Icon = goal.icon
              const isEditing = editingGoalType === goal.type
              // 暂无 currentAmount 数据，不显示进度条

              return (
                <div key={goal.type} className="rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-sm">
                  {isEditing ? (
                    /* Edit mode */
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${goal.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-semibold text-foreground">{goal.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-muted-foreground">目标金额 (¥)</label>
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
                            placeholder="输入目标金额"
                            data-testid="goal-edit-amount"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-muted-foreground">目标年份</label>
                          <input
                            type="number"
                            value={editYear}
                            onChange={(e) => setEditYear(e.target.value)}
                            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
                            placeholder="如 2030"
                            data-testid="goal-edit-year"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingGoalType(null)}
                          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                        >
                          <X className="h-3 w-3" />
                          取消
                        </button>
                        <button
                          onClick={confirmEditGoal}
                          disabled={goalsSaving}
                          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                          data-testid="goal-save-btn"
                        >
                          {goalsSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          保存
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display mode */
                    <>
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${goal.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex flex-1 flex-col gap-1">
                          <span className="text-sm font-medium text-foreground">{goal.name}</span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {goal.targetAmount > 0 ? (
                              <>
                                <span>目标 {amountVisible ? fmtCurrency(goal.targetAmount) : '****'}</span>
                                <span>·</span>
                                <span>{goal.targetYear}年</span>
                              </>
                            ) : (
                              <span className="text-amber-600">待设定目标金额</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEditGoal(goal.type, goal.config)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label={`编辑${goal.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteGoal(goal.type)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                            aria-label={`删除${goal.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ═══════ Settings Section ═══════ */}
      {activeSection === 'settings' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-card p-5 lg:p-7">
            <h3 className="mb-5 text-base font-semibold text-foreground">家庭设置</h3>
            <div className="flex flex-col gap-4">
              {/* Family Name */}
              <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">家庭名称</span>
                  <span className="text-xs text-muted-foreground">用于展示和标识家庭</span>
                </div>
                {editingSetting === 'name' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={settingValue}
                      onChange={(e) => setSettingValue(e.target.value)}
                      className="h-8 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 sm:w-44"
                      autoFocus
                      maxLength={100}
                    />
                    <button
                      disabled={settingSaving || !settingValue.trim()}
                      onClick={async () => {
                        setSettingSaving(true)
                        try {
                          const res = await fetch('/api/family/settings', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: settingValue.trim() }),
                          })
                          if (!res.ok) throw new Error((await res.json()).error || '更新失败')
                          toast({ title: '已更新家庭名称' })
                          setEditingSetting(null)
                        } catch (err: any) {
                          toast({ title: '更新失败', description: err.message, variant: 'destructive' })
                        } finally {
                          setSettingSaving(false)
                        }
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {settingSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => setEditingSetting(null)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary">{familyName}</span>
                    <button
                      onClick={() => { setEditingSetting('name'); setSettingValue(familyName) }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Risk Tolerance */}
              <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">风险偏好</span>
                  <span className="text-xs text-muted-foreground">影响 AI 配置建议的风格</span>
                </div>
                {editingSetting === 'riskTolerance' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'] as const).map((level) => {
                      const labelMap = { CONSERVATIVE: '稳健型', MODERATE: '均衡型', AGGRESSIVE: '进取型' }
                      return (
                        <button
                          key={level}
                          disabled={settingSaving}
                          onClick={async () => {
                            setSettingSaving(true)
                            try {
                              const res = await fetch('/api/allocation/family-profile', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ riskTolerance: level }),
                              })
                              if (!res.ok) throw new Error((await res.json()).error || '更新失败')
                              setFamilyProfile(prev => prev ? { ...prev, riskTolerance: level } : prev)
                              toast({ title: `风险偏好已设为${labelMap[level]}` })
                              setEditingSetting(null)
                            } catch (err: any) {
                              toast({ title: '更新失败', description: err.message, variant: 'destructive' })
                            } finally {
                              setSettingSaving(false)
                            }
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            familyProfile?.riskTolerance === level
                              ? 'bg-primary text-white'
                              : 'border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                          } disabled:opacity-50`}
                        >
                          {settingSaving ? '...' : labelMap[level]}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setEditingSetting(null)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary">
                      {familyProfile?.riskTolerance === 'CONSERVATIVE' ? '稳健型' : familyProfile?.riskTolerance === 'AGGRESSIVE' ? '进取型' : '均衡型'}
                    </span>
                    <button
                      onClick={() => setEditingSetting('riskTolerance')}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Investment Horizon */}
              <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">投资期限</span>
                  <span className="text-xs text-muted-foreground">影响资产配置策略</span>
                </div>
                {editingSetting === 'investmentHorizon' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {(['SHORT', 'MEDIUM', 'LONG'] as const).map((h) => {
                      const labelMap = { SHORT: '短期(1-3年)', MEDIUM: '中期(3-10年)', LONG: '长期(10年+)' }
                      return (
                        <button
                          key={h}
                          disabled={settingSaving}
                          onClick={async () => {
                            setSettingSaving(true)
                            try {
                              const res = await fetch('/api/allocation/family-profile', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ investmentHorizon: h }),
                              })
                              if (!res.ok) throw new Error((await res.json()).error || '更新失败')
                              setFamilyProfile(prev => prev ? { ...prev, investmentHorizon: h } : prev)
                              toast({ title: `投资期限已设为${labelMap[h]}` })
                              setEditingSetting(null)
                            } catch (err: any) {
                              toast({ title: '更新失败', description: err.message, variant: 'destructive' })
                            } finally {
                              setSettingSaving(false)
                            }
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            familyProfile?.investmentHorizon === h
                              ? 'bg-primary text-white'
                              : 'border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                          } disabled:opacity-50`}
                        >
                          {settingSaving ? '...' : labelMap[h]}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setEditingSetting(null)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary">
                      {familyProfile?.investmentHorizon === 'SHORT' ? '短期(1-3年)' : familyProfile?.investmentHorizon === 'LONG' ? '长期(10年+)' : '中期(3-10年)'}
                    </span>
                    <button
                      onClick={() => setEditingSetting('investmentHorizon')}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─── 家庭基本信息 ─── */}
          <div className="rounded-2xl border border-border bg-card p-5 lg:p-7">
            <div className="mb-5 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <h3 className="text-base font-semibold text-foreground">家庭基本信息</h3>
            </div>
            <div className="flex flex-col gap-4">
              {/* Household Members */}
              {([
                { key: 'householdMembers', label: '家庭成员数', desc: '影响应急资金和保障需求评估', icon: Users, suffix: '人', type: 'number' as const },
                { key: 'primaryEarnerAge', label: '主要收入者年龄', desc: '影响投资期限和退休规划', icon: UserCheck, suffix: '岁', type: 'number' as const },
                { key: 'childrenCount', label: '子女数量', desc: '影响教育金目标计算', icon: Baby, suffix: '人', type: 'number' as const },
                { key: 'elderlyCount', label: '赡养老人数', desc: '影响养老储备需求', icon: Heart, suffix: '人', type: 'number' as const },
                { key: 'retirementAge', label: '计划退休年龄', desc: '影响投资期限和退休金计算', icon: Calendar, suffix: '岁', type: 'number' as const },
              ] as const).map((item) => {
                const Icon = item.icon
                const fieldValue = familyProfile?.[item.key as keyof FamilyProfileData]
                return (
                  <div key={item.key} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">{item.label}</span>
                        <span className="text-xs text-muted-foreground">{item.desc}</span>
                      </div>
                    </div>
                    {editingSetting === item.key ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={settingValue}
                          onChange={(e) => setSettingValue(e.target.value)}
                          className="h-8 w-24 rounded-lg border border-border bg-background px-3 text-sm text-foreground text-right focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
                          autoFocus
                          min={0}
                        />
                        <span className="text-xs text-muted-foreground">{item.suffix}</span>
                        <button
                          disabled={settingSaving}
                          onClick={() => saveProfileField({ [item.key]: Number(settingValue) || 0 })}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                          {settingSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => setEditingSetting(null)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {fieldValue != null ? `${fieldValue} ${item.suffix}` : '未设置'}
                        </span>
                        <button
                          onClick={() => { setEditingSetting(item.key); setSettingValue(String(fieldValue ?? '')) }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ─── 收入与支出 ─── */}
          <div className="rounded-2xl border border-border bg-card p-5 lg:p-7">
            <div className="mb-5 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <h3 className="text-base font-semibold text-foreground">收入与支出</h3>
            </div>
            <div className="flex items-center gap-2 mb-5 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/20 dark:bg-emerald-950/20 px-4 py-2.5">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                收支数据直接影响 AI 分析中的储蓄率、应急资金评估和目标达成路径
              </span>
            </div>
            <div className="flex flex-col gap-4">
              {/* Monthly Income */}
              <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">家庭月收入</span>
                    <span className="text-xs text-muted-foreground">所有成员税后收入总和</span>
                  </div>
                </div>
                {editingSetting === 'monthlyIncome' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">¥</span>
                    <input
                      type="number"
                      value={settingValue}
                      onChange={(e) => setSettingValue(e.target.value)}
                      className="h-8 w-32 rounded-lg border border-border bg-background px-3 text-sm text-foreground text-right focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
                      autoFocus
                      min={0}
                      step={1000}
                    />
                    <button
                      disabled={settingSaving}
                      onClick={() => saveProfileField({ monthlyIncome: Number(settingValue) || 0 })}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {settingSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => setEditingSetting(null)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {familyProfile?.monthlyIncome ? (amountVisible ? fmtCurrency(familyProfile.monthlyIncome) : '****') : '未设置'}
                    </span>
                    <button
                      onClick={() => { setEditingSetting('monthlyIncome'); setSettingValue(String(familyProfile?.monthlyIncome ?? '')) }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Monthly Expenses */}
              <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Wallet className="h-4 w-4 shrink-0 text-amber-500" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">家庭月支出</span>
                    <span className="text-xs text-muted-foreground">日常生活开销（不含房贷车贷）</span>
                  </div>
                </div>
                {editingSetting === 'monthlyExpenses' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">¥</span>
                    <input
                      type="number"
                      value={settingValue}
                      onChange={(e) => setSettingValue(e.target.value)}
                      className="h-8 w-32 rounded-lg border border-border bg-background px-3 text-sm text-foreground text-right focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
                      autoFocus
                      min={0}
                      step={1000}
                    />
                    <button
                      disabled={settingSaving}
                      onClick={() => saveProfileField({ monthlyExpenses: Number(settingValue) || 0 })}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {settingSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => setEditingSetting(null)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {familyProfile?.monthlyExpenses ? (amountVisible ? fmtCurrency(familyProfile.monthlyExpenses) : '****') : '未设置'}
                    </span>
                    <button
                      onClick={() => { setEditingSetting('monthlyExpenses'); setSettingValue(String(familyProfile?.monthlyExpenses ?? '')) }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Income Stability */}
              <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 shrink-0 text-blue-500" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">收入稳定性</span>
                    <span className="text-xs text-muted-foreground">影响应急资金规模和投资激进度</span>
                  </div>
                </div>
                {editingSetting === 'incomeStability' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {(['VERY_STABLE', 'STABLE', 'VARIABLE', 'UNSTABLE'] as const).map((level) => {
                      const labelMap = { VERY_STABLE: '非常稳定', STABLE: '稳定', VARIABLE: '波动较大', UNSTABLE: '不稳定' }
                      return (
                        <button
                          key={level}
                          disabled={settingSaving}
                          onClick={() => saveProfileField({ incomeStability: level })}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            familyProfile?.incomeStability === level
                              ? 'bg-primary text-white'
                              : 'border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                          } disabled:opacity-50`}
                        >
                          {settingSaving ? '...' : labelMap[level]}
                        </button>
                      )
                    })}
                    <button onClick={() => setEditingSetting(null)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary">
                      {{ VERY_STABLE: '非常稳定', STABLE: '稳定', VARIABLE: '波动较大', UNSTABLE: '不稳定' }[familyProfile?.incomeStability || ''] || '未设置'}
                    </span>
                    <button
                      onClick={() => setEditingSetting('incomeStability')}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Emergency Fund Months */}
              <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <PiggyBank className="h-4 w-4 shrink-0 text-amber-500" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">应急资金目标</span>
                    <span className="text-xs text-muted-foreground">建议覆盖 3-12 个月支出</span>
                  </div>
                </div>
                {editingSetting === 'emergencyFundMonths' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {[3, 6, 9, 12].map((m) => (
                      <button
                        key={m}
                        disabled={settingSaving}
                        onClick={() => saveProfileField({ emergencyFundMonths: m })}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          familyProfile?.emergencyFundMonths === m
                            ? 'bg-primary text-white'
                            : 'border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        } disabled:opacity-50`}
                      >
                        {settingSaving ? '...' : `${m} 个月`}
                      </button>
                    ))}
                    <button onClick={() => setEditingSetting(null)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary">
                      {familyProfile?.emergencyFundMonths ? `${familyProfile.emergencyFundMonths} 个月` : '未设置'}
                    </span>
                    <button
                      onClick={() => setEditingSetting('emergencyFundMonths')}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Savings Rate Display (read-only computed) */}
              {familyProfile?.monthlyIncome && familyProfile?.monthlyExpenses && (
                <div className="flex items-center justify-between rounded-xl border border-dashed border-border p-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">月储蓄率</span>
                      <span className="text-xs text-muted-foreground">自动计算 = (收入 - 支出) / 收入</span>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${
                    ((familyProfile.monthlyIncome - familyProfile.monthlyExpenses) / familyProfile.monthlyIncome) >= 0.3
                      ? 'text-emerald-600' : 'text-amber-600'
                  }`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {amountVisible
                      ? `${(((familyProfile.monthlyIncome - familyProfile.monthlyExpenses) / familyProfile.monthlyIncome) * 100).toFixed(1)}%`
                      : '****'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ─── 保险保障 ─── */}
          <div className="rounded-2xl border border-border bg-card p-5 lg:p-7">
            <div className="mb-5 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-500" />
              <h3 className="text-base font-semibold text-foreground">保险保障</h3>
            </div>
            <div className="flex items-center gap-2 mb-5 rounded-xl border border-teal-200/60 dark:border-teal-800/40 bg-teal-50/20 dark:bg-teal-950/20 px-4 py-2.5">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-teal-500" />
              <span className="text-[11px] text-teal-700 dark:text-teal-400">
                保险缺口会影响 AI 的风险提示，缺少核心保障时建议优先配置保险
              </span>
            </div>
            <div className="flex flex-col gap-4">
              {([
                { key: 'hasLifeInsurance' as const, label: '寿险', desc: '家庭经济支柱保障', icon: Shield, color: 'text-teal-500' },
                { key: 'hasHealthInsurance' as const, label: '医疗险', desc: '大额医疗费用保障', icon: Heart, color: 'text-pink-500' },
                { key: 'hasCriticalIllnessInsurance' as const, label: '重疾险', desc: '重大疾病收入替代', icon: ShieldCheck, color: 'text-blue-500' },
              ]).map((item) => {
                const Icon = item.icon
                const isOn = familyProfile?.[item.key] === true
                return (
                  <div key={item.key} className="flex items-center justify-between rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 shrink-0 ${item.color}`} />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">{item.label}</span>
                        <span className="text-xs text-muted-foreground">{item.desc}</span>
                      </div>
                    </div>
                    <button
                      disabled={settingSaving}
                      onClick={() => saveProfileField({ [item.key]: !isOn })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-50 ${
                        isOn ? 'bg-primary' : 'bg-muted'
                      }`}
                      role="switch"
                      aria-checked={isOn}
                      aria-label={item.label}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isOn ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                )
              })}

              {/* Insurance gap warning */}
              {familyProfile && !familyProfile.hasLifeInsurance && !familyProfile.hasHealthInsurance && !familyProfile.hasCriticalIllnessInsurance && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/20 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                  <span className="text-xs text-red-600 dark:text-red-400">
                    未配置任何保险保障，AI 分析将提示保障缺口风险
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/20 p-5 lg:p-7">
            <h3 className="mb-3 text-base font-semibold text-red-600 dark:text-red-400">危险操作</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              以下操作不可逆，请谨慎执行
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirmAction('dissolve')}
                className="rounded-xl border border-red-200 dark:border-red-900/50 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/10"
              >
                解散家庭
              </button>
              <button
                onClick={() => setConfirmAction('transfer')}
                className="rounded-xl border border-red-200 dark:border-red-900/50 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/10"
              >
                转让管理权
              </button>
            </div>
            {confirmAction && (
              <div className="mt-4 rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  {confirmAction === 'dissolve' ? '确认要解散家庭吗？' : '确认要转让管理权吗？'}
                </div>
                <p className="mt-1 text-xs text-red-500/80">
                  {confirmAction === 'dissolve'
                    ? '解散后所有成员关系将解除，此操作不可撤销。'
                    : '转让后你将成为普通成员，管理权限将转移给指定成员。'}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => {
                      toast({ title: '功能开发中', description: '此功能暂未开放，请联系管理员', variant: 'destructive' })
                      setConfirmAction(null)
                    }}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
                  >
                    确认{confirmAction === 'dissolve' ? '解散' : '转让'}
                  </button>
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ Invite Dialog ═══════ */}
      {inviteOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setInviteOpen(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6" role="dialog" aria-label="邀请成员">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">邀请家庭成员</h3>
              <button onClick={() => setInviteOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">邮箱地址</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-background px-4 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
                  placeholder="输入受邀者邮箱"
                  data-testid="invite-email"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">角色</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setInviteRole('MEMBER')}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      inviteRole === 'MEMBER' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    普通成员
                  </button>
                  <button
                    onClick={() => setInviteRole('ADMIN')}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      inviteRole === 'ADMIN' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    管理员
                  </button>
                </div>
              </div>
              <button
                onClick={sendInvite}
                disabled={!inviteEmail.trim() || inviteSending}
                className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                {inviteSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                发送邀请
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
