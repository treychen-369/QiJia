'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp,
  TrendingDown,
  Banknote,
  ShieldCheck,
  Home,
  Gem,
  Receipt,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  Users,
  ArrowUpDown,
  Upload,
  ClipboardList,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Wallet,
  CreditCard,
  MoreHorizontal,
  Building2,
  PiggyBank,
  Sparkles,
  Edit,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useDashboardV2 } from '@/app/dashboard-v2/layout'
import { useSettings } from '@/components/dashboard-v2/use-settings'
import { FamilyTransferDialog } from '@/components/family/family-transfer-dialog'
import { ActivityLogDialog } from '@/components/dialogs/activity-log-dialog'
import { AddCashAssetDialog } from '@/components/assets/add-cash-asset-dialog'
import { AddFixedIncomeDialog } from '@/components/assets/add-fixed-income-dialog'
import { AddRealEstateDialog } from '@/components/assets/add-real-estate-dialog'
import { AddAlternativeDialog } from '@/components/assets/add-alternative-dialog'
import { AddReceivableDialog } from '@/components/assets/add-receivable-dialog'
import { AddLiabilityDialog } from '@/components/liabilities/add-liability-dialog'
import { AddHoldingDialog } from '@/components/holdings/add-holding-dialog'
import { EditHoldingDialog, type EditHoldingData } from '@/components/holdings/edit-holding-dialog'
import { DeleteHoldingDialog } from '@/components/holdings/delete-holding-dialog'
import { EditCashDialog, type EditCashData } from '@/components/cash/edit-cash-dialog'
import { EditAssetDialog } from '@/components/assets/edit-asset-dialog'
import { DeleteAssetDialog } from '@/components/assets/delete-asset-dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

// ─── Category definitions ───
interface Category {
  id: string
  label: string
  icon: LucideIcon
  parentCode: string | null // maps to assetCategory.parent.code
  iconColor: string
  iconBg: string
}

const categories: Category[] = [
  { id: 'securities', label: '证券持仓', icon: TrendingUp, parentCode: null, iconColor: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-500/10' },
  { id: 'cash', label: '现金资产', icon: Banknote, parentCode: 'CASH', iconColor: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-500/10' },
  { id: 'fixed', label: '固定收益', icon: ShieldCheck, parentCode: 'FIXED_INCOME', iconColor: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-500/10' },
  { id: 'property', label: '不动产', icon: Home, parentCode: 'REAL_ESTATE', iconColor: 'text-pink-600 dark:text-pink-400', iconBg: 'bg-pink-500/10' },
  { id: 'alternative', label: '另类投资', icon: Gem, parentCode: 'ALTERNATIVE', iconColor: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-500/10' },
  { id: 'receivable', label: '应收款', icon: Receipt, parentCode: 'RECEIVABLE', iconColor: 'text-sky-600 dark:text-sky-400', iconBg: 'bg-sky-500/10' },
]

// ─── Sub-group info for non-securities categories ───
const SUB_GROUP_INFO: Record<string, { name: string; icon: LucideIcon; borderColor: string; iconBg: string }> = {
  CASH_DEMAND: { name: '活期存款', icon: Wallet, borderColor: 'border-l-blue-500', iconBg: 'bg-blue-50 dark:bg-blue-950' },
  CASH_FIXED: { name: '定期存款', icon: PiggyBank, borderColor: 'border-l-green-500', iconBg: 'bg-green-50 dark:bg-green-950' },
  CASH_MONEY_FUND: { name: '货币基金', icon: Sparkles, borderColor: 'border-l-purple-500', iconBg: 'bg-purple-50 dark:bg-purple-950' },
  CASH_BROKER: { name: '券商现金', icon: Building2, borderColor: 'border-l-orange-500', iconBg: 'bg-orange-50 dark:bg-orange-950' },
  FIXED_DEPOSIT: { name: '定期存款', icon: ShieldCheck, borderColor: 'border-l-purple-500', iconBg: 'bg-purple-50 dark:bg-purple-950' },
  FIXED_BOND: { name: '债券', icon: ShieldCheck, borderColor: 'border-l-indigo-500', iconBg: 'bg-indigo-50 dark:bg-indigo-950' },
  FIXED_FUND: { name: '固收基金', icon: ShieldCheck, borderColor: 'border-l-violet-500', iconBg: 'bg-violet-50 dark:bg-violet-950' },
  REAL_ESTATE_RESIDENTIAL: { name: '住宅', icon: Home, borderColor: 'border-l-pink-500', iconBg: 'bg-pink-50 dark:bg-pink-950' },
  REAL_ESTATE_COMMERCIAL: { name: '商业', icon: Home, borderColor: 'border-l-rose-500', iconBg: 'bg-rose-50 dark:bg-rose-950' },
  ALT_PRECIOUS_METAL: { name: '贵金属', icon: Gem, borderColor: 'border-l-amber-500', iconBg: 'bg-amber-50 dark:bg-amber-950' },
  ALT_DIGITAL_ASSET: { name: '数字资产', icon: Gem, borderColor: 'border-l-cyan-500', iconBg: 'bg-cyan-50 dark:bg-cyan-950' },
  ALT_COMMODITY: { name: '大宗商品', icon: Gem, borderColor: 'border-l-yellow-500', iconBg: 'bg-yellow-50 dark:bg-yellow-950' },
  ALT_COLLECTIBLE: { name: '收藏品', icon: Gem, borderColor: 'border-l-teal-500', iconBg: 'bg-teal-50 dark:bg-teal-950' },
  ALT_PHYSICAL: { name: '实物资产', icon: Gem, borderColor: 'border-l-lime-500', iconBg: 'bg-lime-50 dark:bg-lime-950' },
  RECEIVABLE_PERSONAL: { name: '个人借出', icon: Receipt, borderColor: 'border-l-sky-500', iconBg: 'bg-sky-50 dark:bg-sky-950' },
  RECEIVABLE_BUSINESS: { name: '商业应收', icon: Receipt, borderColor: 'border-l-blue-500', iconBg: 'bg-blue-50 dark:bg-blue-950' },
}

// ─── Account colors for securities ───
const ACCOUNT_BORDER_COLORS: Record<string, string> = {
  '平安证券': 'border-l-orange-500',
  '长桥证券': 'border-l-blue-500',
}

const ACCOUNT_ICON_BG: Record<string, string> = {
  '平安证券': 'bg-orange-50 dark:bg-orange-950',
  '长桥证券': 'bg-blue-50 dark:bg-blue-950',
}

const LIABILITY_TYPE_LABELS: Record<string, string> = {
  MORTGAGE: '房贷',
  CREDIT_CARD: '信用卡',
  PERSONAL_LOAN: '个人贷款',
  BUSINESS_LOAN: '经营贷',
  CAR_LOAN: '车贷',
  STUDENT_LOAN: '助学贷款',
  PAYABLE: '应付账款',
  OTHER: '其他负债',
}

const LIABILITY_TYPES = Object.entries(LIABILITY_TYPE_LABELS).map(([value, label]) => ({ value, label }))

// ─── Format helpers ───
const fmtCurrency = (amount: number, currency: string = 'CNY') => {
  if (amount === null || amount === undefined || isNaN(amount)) return '¥0'
  const symbol = currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : '¥'
  const abs = Math.abs(amount)
  const formatted = abs.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`
}

const fmtPercent = (pct: number | null | undefined) => {
  const n = typeof pct === 'number' ? pct : 0
  if (isNaN(n)) return '0.00%'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

export function AssetsTab() {
  const router = useRouter()
  const { amountVisible, viewMode, apiData } = useDashboardV2()
  const { pnlColor, fmt } = useSettings()
  const { toast } = useToast()
  const isFamily = viewMode === 'family'
  const [activeCategory, setActiveCategory] = useState('securities')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  // ─── Activity Log Dialog ───
  const [activityLogOpen, setActivityLogOpen] = useState(false)

  // ─── 编辑/删除持仓对话框状态 ───
  const [editHoldingOpen, setEditHoldingOpen] = useState(false)
  const [deleteHoldingOpen, setDeleteHoldingOpen] = useState(false)
  const [editCashOpen, setEditCashOpen] = useState(false)
  const [selectedHolding, setSelectedHolding] = useState<any>(null)
  const [selectedCashAccount, setSelectedCashAccount] = useState<{
    accountId: string
    accountName: string
    broker: string
    amount: number
    currency: string
  } | null>(null)

  // ─── 编辑/删除非证券资产对话框状态 ───
  const [editAssetOpen, setEditAssetOpen] = useState(false)
  const [deleteAssetOpen, setDeleteAssetOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<any>(null)

  // ─── 添加资产对话框状态 ───
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [addHoldingOpen, setAddHoldingOpen] = useState(false)
  const [addCashOpen, setAddCashOpen] = useState(false)
  const [addFixedOpen, setAddFixedOpen] = useState(false)
  const [addPropertyOpen, setAddPropertyOpen] = useState(false)
  const [addAlternativeOpen, setAddAlternativeOpen] = useState(false)
  const [addReceivableOpen, setAddReceivableOpen] = useState(false)
  const [addLiabilityOpen, setAddLiabilityOpen] = useState(false)

  // ─── 排序状态 ───
  type AssetSortKey = 'value-desc' | 'value-asc' | 'name-asc' | 'pnl-desc' | 'pnl-asc'
  const [sortKey, setSortKey] = useState<AssetSortKey>('value-desc')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)

  // ─── 资产转移状态 ───
  const [familyTransferOpen, setFamilyTransferOpen] = useState(false)
  const [personalTransferOpen, setPersonalTransferOpen] = useState(false)
  const [personalTransferStep, setPersonalTransferStep] = useState<'select' | 'confirm'>('select')
  const [holdingsList, setHoldingsList] = useState<any[]>([])
  const [accountsList, setAccountsList] = useState<any[]>([])
  const [targetAccountId, setTargetAccountId] = useState('')
  const [transferMode, setTransferMode] = useState<'partial' | 'full'>('partial')
  const [transferQty, setTransferQty] = useState('')
  const [transferNotes, setTransferNotes] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)
  const [loadingHoldings, setLoadingHoldings] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [transferSuccess, setTransferSuccess] = useState(false)
  const [assetCategories, setAssetCategories] = useState<any[]>([])
  const [targetCategoryId, setTargetCategoryId] = useState('')
  const [targetLiabilityType, setTargetLiabilityType] = useState('')

  // ─── Derive real data from API (家庭/个人自动切换) ───
  // 家庭模式: familyHoldings 已包含 cash 伪持仓（API 端组装），直接使用
  // 个人模式: 需要从 accounts 提取现金余额合并到 allHoldings
  const allHoldings: any[] = useMemo(() => {
    const rawHoldings: any[] = isFamily
      ? (apiData.familyHoldings || [])
      : (apiData.dashboardData?.allHoldings || [])

    // 家庭模式下 API 已包含 cash 伪持仓，无需再合并
    if (isFamily) return rawHoldings

    // 个人模式：从 accounts 中提取现金余额，组装成 type:'cash' 的伪持仓
    // 用 accountId 映射真实持仓的 accountName，确保分组一致
    const accountNameMap: Record<string, string> = {}
    rawHoldings.forEach((h: any) => {
      if (h.accountId && h.accountName) accountNameMap[h.accountId] = h.accountName
    })

    const accounts = apiData.dashboardData?.accounts || []
    const cashData = accounts
      .filter((account: any) => Number(account.cashBalanceOriginal) > 0)
      .map((account: any) => ({
        id: `cash-${account.id}`,
        type: 'cash' as const,
        symbol: 'CASH',
        name: `现金余额`,
        accountId: account.id,
        accountName: accountNameMap[account.id] || account.name,
        broker: account.broker,
        quantity: 1,
        currentPrice: Number(account.cashBalanceOriginal),
        costBasis: Number(account.cashBalanceOriginal),
        marketValue: Number(account.cashBalance),
        marketValueOriginal: Number(account.cashBalanceOriginal),
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        dayChange: 0,
        dayChangePercent: 0,
        sector: '现金',
        region: account.currency === 'USD' ? '美国' : account.currency === 'HKD' ? '香港' : '中国',
        currency: account.currency,
        lastUpdated: account.cashLastUpdated || account.lastUpdated,
      }))

    return [...rawHoldings, ...cashData]
  }, [isFamily, apiData.familyHoldings, apiData.dashboardData?.allHoldings, apiData.dashboardData?.accounts])
  const allAssets: any[] = isFamily
    ? (apiData.familyAssets || [])
    : (apiData.assets || [])

  // Securities: group by account
  const holdingsByAccount = useMemo(() => {
    const groups: Record<string, {
      accountName: string
      broker: string
      holdings: any[]
      cash: any | null
      totalValueOriginal: number
      totalValueCNY: number
      totalPnL: number
      currency: string
      holdingCount: number
    }> = {}

    const filtered = searchQuery
      ? allHoldings.filter((h: any) =>
          h.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.accountName?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : allHoldings

    filtered.forEach((h: any) => {
      const key = h.accountName || h.broker || 'Unknown'
      if (!groups[key]) {
        groups[key] = {
          accountName: key,
          broker: h.broker || key,
          holdings: [],
          cash: null,
          totalValueOriginal: 0,
          totalValueCNY: 0,
          totalPnL: 0,
          currency: h.currency || 'CNY',
          holdingCount: 0,
        }
      }
      if (h.type === 'cash') {
        groups[key].cash = h
        groups[key].totalValueCNY += h.marketValue || 0
      } else {
        groups[key].holdings.push(h)
        groups[key].totalValueCNY += h.marketValue || 0
        groups[key].totalPnL += h.unrealizedPnL || 0
        groups[key].holdingCount++
      }
      groups[key].totalValueOriginal += h.marketValueOriginal || h.marketValue || 0
    })

    // 对每个账户内的 holdings 排序
    Object.values(groups).forEach(group => {
      group.holdings.sort((a: any, b: any) => {
        switch (sortKey) {
          case 'value-desc': return (b.marketValue || 0) - (a.marketValue || 0)
          case 'value-asc': return (a.marketValue || 0) - (b.marketValue || 0)
          case 'pnl-desc': return (b.unrealizedPnL || 0) - (a.unrealizedPnL || 0)
          case 'pnl-asc': return (a.unrealizedPnL || 0) - (b.unrealizedPnL || 0)
          case 'name-asc': return (a.name || '').localeCompare(b.name || '', 'zh-CN')
          default: return 0
        }
      })
    })

    return groups
  }, [allHoldings, searchQuery, sortKey])

  // Non-securities: group by sub-category
  const assetsByParentCode = useMemo(() => {
    const map: Record<string, any[]> = {}
    const filtered = searchQuery
      ? allAssets.filter((a: any) =>
          a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.assetCategory?.name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : allAssets

    filtered.forEach((a: any) => {
      const parentCode = a.assetCategory?.parent?.code
      if (parentCode) {
        if (!map[parentCode]) map[parentCode] = []
        map[parentCode].push(a)
      }
    })
    return map
  }, [allAssets, searchQuery])

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      securities: allHoldings.filter((h: any) => h.type !== 'cash').length,
    }
    categories.forEach(cat => {
      if (cat.parentCode) {
        counts[cat.id] = (assetsByParentCode[cat.parentCode] || []).length
      }
    })
    return counts
  }, [allHoldings, assetsByParentCode])

  // Category summaries
  const categorySummary = useMemo(() => {
    const summaries: Record<string, { total: number; pnl: number; rate: number }> = {}

    // Securities
    let secTotal = 0, secPnl = 0
    allHoldings.forEach((h: any) => {
      secTotal += h.marketValue ?? 0
      secPnl += h.unrealizedPnL ?? 0
    })
    const secCost = secTotal - secPnl
    summaries.securities = { total: secTotal, pnl: secPnl, rate: secCost > 0 ? (secPnl / secCost) * 100 : 0 }

    // Other categories
    categories.forEach(cat => {
      if (cat.parentCode) {
        const items = assetsByParentCode[cat.parentCode] || []
        let total = 0, pnl = 0
        items.forEach((a: any) => {
          total += Number(a.currentValue) ?? 0
          pnl += Number(a.unrealizedPnl) ?? 0
        })
        const cost = total - pnl
        summaries[cat.id] = { total, pnl, rate: cost > 0 ? (pnl / cost) * 100 : 0 }
      }
    })
    return summaries
  }, [allHoldings, assetsByParentCode])

  // Sub-groups for current non-securities category
  const currentSubGroups = useMemo(() => {
    const activeCat = categories.find(c => c.id === activeCategory)
    if (!activeCat?.parentCode) return null

    const items = assetsByParentCode[activeCat.parentCode] || []
    const groups: Record<string, any[]> = {}
    items.forEach((a: any) => {
      const code = a.assetCategory?.code || 'OTHER'
      if (!groups[code]) groups[code] = []
      groups[code].push(a)
    })

    // 对每个子组内的 items 排序
    Object.values(groups).forEach(groupItems => {
      groupItems.sort((a: any, b: any) => {
        switch (sortKey) {
          case 'value-desc': return (Number(b.currentValue) || 0) - (Number(a.currentValue) || 0)
          case 'value-asc': return (Number(a.currentValue) || 0) - (Number(b.currentValue) || 0)
          case 'pnl-desc': return (Number(b.unrealizedPnl) || 0) - (Number(a.unrealizedPnl) || 0)
          case 'pnl-asc': return (Number(a.unrealizedPnl) || 0) - (Number(b.unrealizedPnl) || 0)
          case 'name-asc': return (a.name || '').localeCompare(b.name || '', 'zh-CN')
          default: return 0
        }
      })
    })

    return groups
  }, [activeCategory, assetsByParentCode, sortKey])

  // ─── Transfer logic (unchanged) ───
  const handleTransferClick = () => {
    if (isFamily) {
      setFamilyTransferOpen(true)
    } else {
      setPersonalTransferOpen(true)
      setPersonalTransferStep('select')
      setSelectedHolding(null)
      setTargetAccountId('')
      setTransferMode('partial')
      setTransferQty('')
      setTransferNotes('')
      setTransferSuccess(false)
      loadTransferHoldings()
    }
  }

  const [transferFilter, setTransferFilter] = useState<'all' | 'holding' | 'asset' | 'liability'>('all')

  const loadTransferHoldings = useCallback(async () => {
    setLoadingHoldings(true)
    setTransferFilter('all')
    try {
      const holdingsSource = isFamily ? (apiData.familyHoldings || []) : (apiData.dashboardData?.allHoldings || [])
      const assetsSource = isFamily ? (apiData.familyAssets || []) : (apiData.assets || [])
      const liabilitiesSource = isFamily ? (apiData.familyLiabilities || []) : (apiData.liabilities || [])
      const allH = holdingsSource.map((h: any) => ({
        ...h, _transferType: 'holding' as const, _displayName: h.name,
        _displaySub: `${h.symbol} · ${h.broker || h.accountName} · ${h.quantity} 股`,
        _displayValue: h.marketValue || 0, _canTransfer: true,
      }))
      const allA = assetsSource.map((a: any) => ({
        ...a, _transferType: 'asset' as const, _displayName: a.name,
        _displaySub: `${a.assetCategory?.parent?.name || a.assetCategory?.name || '资产'} · ${a.currency || 'CNY'}`,
        _displayValue: a.currentValue || a.originalValue || 0, _canTransfer: true,
      }))
      const allL = liabilitiesSource.map((l: any) => ({
        ...l, _transferType: 'liability' as const, _displayName: l.name,
        _displaySub: `${LIABILITY_TYPE_LABELS[l.type] || l.type || '负债'} · ${l.currency || 'CNY'}`,
        _displayValue: l.currentBalanceCny || l.currentBalance || 0, _canTransfer: true,
      }))
      setHoldingsList([...allH, ...allA, ...allL])
    } catch {
      setHoldingsList([])
    } finally {
      setLoadingHoldings(false)
    }
  }, [isFamily, apiData.dashboardData?.allHoldings, apiData.assets, apiData.liabilities, apiData.familyHoldings, apiData.familyAssets, apiData.familyLiabilities])

  const handleSelectHolding = useCallback(async (item: any) => {
    setSelectedHolding(item)
    setPersonalTransferStep('confirm')
    setTargetAccountId('')
    setTargetCategoryId('')
    setTargetLiabilityType('')
    setTransferMode('partial')
    setTransferQty('')
    setLoadingAccounts(true)
    try {
      if (item._transferType === 'holding') {
        const res = await fetch('/api/accounts')
        if (!res.ok) throw new Error()
        const result = await res.json()
        setAccountsList((result.data || []).filter((a: any) => a.id !== item.accountId))
      } else if (item._transferType === 'asset') {
        const res = await fetch('/api/asset-categories')
        if (res.ok) {
          const result = await res.json()
          setAssetCategories((result.data || []).filter((c: any) => c.id !== item.assetCategoryId))
        }
      } else if (item._transferType === 'liability') {
        setTargetLiabilityType(item.type || '')
      }
    } catch {
      setAccountsList([])
      setAssetCategories([])
    } finally {
      setLoadingAccounts(false)
    }
  }, [])

  const handlePersonalTransfer = async () => {
    if (!selectedHolding) return
    setTransferLoading(true)
    try {
      if (selectedHolding._transferType === 'holding') {
        if (!targetAccountId) return
        const qty = transferMode === 'full' ? selectedHolding.quantity : parseFloat(transferQty)
        if (isNaN(qty) || qty <= 0 || qty > selectedHolding.quantity) return
        const res = await fetch('/api/holdings/transfer', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceHoldingId: selectedHolding.id, targetAccountId, quantity: qty, keepCostBasis: true, notes: transferNotes || undefined }),
        })
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || '转移失败') }
      } else if (selectedHolding._transferType === 'asset') {
        if (!targetCategoryId) return
        const res = await fetch(`/api/assets/${selectedHolding.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetCategoryId: targetCategoryId }),
        })
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || '分类变更失败') }
      } else if (selectedHolding._transferType === 'liability') {
        if (!targetLiabilityType || targetLiabilityType === selectedHolding.type) return
        const res = await fetch('/api/liabilities', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedHolding.id, type: targetLiabilityType }),
        })
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || '类型变更失败') }
      }
      setTransferSuccess(true)
      await apiData.refresh(true)
    } catch (e) {
      console.error('[转移失败]', e)
    } finally {
      setTransferLoading(false)
    }
  }

  // ─── Derived values ───
  const familyId = (apiData.session?.user as any)?.familyId || ''
  const familyName = apiData.familyOverview?.familyName || '我的家庭'
  const familyMembersRaw = apiData.familyMembers || []
  const currentUserId = apiData.session?.user?.id || ''

  // ─── 添加成功回调 ───
  const handleAddSuccess = useCallback(() => {
    apiData.refresh(true)
    if (isFamily) apiData.refreshFamily?.()
  }, [apiData, isFamily])

  // ─── 编辑持仓 ───
  const handleEditHolding = (holding: any) => {
    setSelectedHolding(holding)
    setEditHoldingOpen(true)
  }

  const handleSaveEdit = async (holdingId: string, data: EditHoldingData) => {
    const response = await fetch(`/api/holdings/${holdingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error('更新失败')
    toast({ title: '更新成功', description: '持仓信息已更新' })
    apiData.refresh(true)
  }

  // ─── 删除持仓 ───
  const handleDeleteHolding = (holding: any) => {
    setSelectedHolding(holding)
    setDeleteHoldingOpen(true)
  }

  const handleConfirmDelete = async (holdingId: string) => {
    const response = await fetch(`/api/holdings/${holdingId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!response.ok) throw new Error('删除失败')
    toast({ title: '删除成功', description: '持仓记录已删除' })
    apiData.refresh(true)
  }

  // ─── 编辑现金余额 ───
  const handleEditCash = (cashHolding: any) => {
    const accountId = cashHolding.id?.replace('cash-', '') || ''
    setSelectedCashAccount({
      accountId,
      accountName: cashHolding.accountName || '',
      broker: cashHolding.broker || '',
      amount: cashHolding.marketValueOriginal || 0,
      currency: cashHolding.currency || 'CNY',
    })
    setEditCashOpen(true)
  }

  const handleSaveCash = async (accountId: string, data: EditCashData) => {
    const response = await fetch(`/api/accounts/${accountId}/cash`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cashBalance: data.cashBalanceOriginal }),
    })
    if (!response.ok) throw new Error('更新失败')
    toast({ title: '更新成功', description: `现金余额已更新` })
    apiData.refresh(true)
  }

  // ─── 编辑/删除非证券资产 ───
  const handleEditAsset = (asset: any) => {
    setSelectedAsset(asset)
    setEditAssetOpen(true)
  }

  const handleDeleteAsset = (asset: any) => {
    setSelectedAsset(asset)
    setDeleteAssetOpen(true)
  }

  const handleAssetEditSuccess = () => {
    setEditAssetOpen(false)
    setSelectedAsset(null)
    apiData.refresh(true)
    if (isFamily) apiData.refreshFamily?.()
  }

  const handleAssetDeleteSuccess = () => {
    setDeleteAssetOpen(false)
    setSelectedAsset(null)
    apiData.refresh(true)
    if (isFamily) apiData.refreshFamily?.()
  }

  const summary = categorySummary[activeCategory] ?? { total: 0, pnl: 0, rate: 0 }
  const activeCat = categories.find((c) => c.id === activeCategory)

  const quickActions = isFamily
    ? [
        { label: '添加资产', icon: Plus, onClick: () => setAddMenuOpen(true) },
        { label: '资产转移', icon: ArrowLeftRight, onClick: handleTransferClick },
        { label: '家庭档案', icon: Users },
        { label: '导入资产', icon: Upload, onClick: () => router.push('/import') },
        { label: '更新记录', icon: ClipboardList, onClick: () => setActivityLogOpen(true) },
      ]
    : [
        { label: '添加资产', icon: Plus, onClick: () => setAddMenuOpen(true) },
        { label: '资产转移', icon: ArrowLeftRight, onClick: handleTransferClick },
        { label: '导入资产', icon: Upload, onClick: () => router.push('/import') },
        { label: '更新记录', icon: ClipboardList, onClick: () => setActivityLogOpen(true) },
      ]

  // ─── Render helpers ───

  // Render securities account card with expansion
  const renderSecuritiesContent = () => {
    const accountEntries = Object.entries(holdingsByAccount)
    if (accountEntries.length === 0) {
      return renderEmptyState()
    }
    return (
      <div className="space-y-2.5">
        {accountEntries.map(([accountName, group]) => {
          const isExpanded = expandedAccounts[accountName] ?? false
          const borderColor = ACCOUNT_BORDER_COLORS[group.broker] || 'border-l-slate-400'
          const iconBg = ACCOUNT_ICON_BG[group.broker] || 'bg-slate-100 dark:bg-slate-800'

          return (
            <div key={accountName} className="overflow-hidden rounded-xl border border-border">
              {/* Account header */}
              <button
                onClick={() => setExpandedAccounts(prev => ({ ...prev, [accountName]: !prev[accountName] }))}
                className={`flex w-full items-center gap-4 ${borderColor} border-l-[3px] p-4 text-left transition-all hover:bg-muted/30`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{accountName}</span>
                  <span className="text-xs text-muted-foreground">
                    {group.holdingCount}只 · {fmtCurrency(group.totalValueOriginal, group.currency)}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-sm font-semibold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {amountVisible ? fmtCurrency(group.totalValueCNY) : '****'}
                  </span>
                  {group.totalPnL !== 0 && (
                    <span className={`text-xs font-medium ${pnlColor(group.totalPnL)}`}>
                      {group.totalPnL >= 0 ? '+' : ''}{fmtCurrency(group.totalPnL)}
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>

              {/* Expanded holdings */}
              {isExpanded && (
                <div className="space-y-1 border-t border-border bg-muted/10 p-2">
                  {/* Cash row */}
                  {group.cash && (
                    <div className="group flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">💰</span>
                        <div>
                          <div className="text-xs font-medium text-foreground">现金余额</div>
                          <div className="text-[10px] text-muted-foreground">{group.cash.currency}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-xs font-semibold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {amountVisible ? fmtCurrency(group.cash.marketValueOriginal || 0, group.cash.currency) : '****'}
                          </div>
                          {group.cash.currency !== 'CNY' && (
                            <div className="text-[10px] text-muted-foreground">
                              ≈ {fmtCurrency(group.cash.marketValue || 0)}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditCash(group.cash!)
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Stock rows */}
                  {group.holdings.map((h: any) => (
                    <div
                      key={h.id}
                      className="group flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-all hover:shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground truncate">{h.name}</span>
                          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {h.symbol}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>持仓{(h.quantity || 0).toLocaleString()}</span>
                          <span>成本{fmtCurrency(h.averageCost || h.costBasis, h.currency)}</span>
                          <span className="hidden sm:inline">现价{fmtCurrency(h.currentPrice, h.currency)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Market value */}
                        <div className="text-right">
                          <div className="text-sm font-semibold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {amountVisible ? fmtCurrency(h.marketValueOriginal || h.marketValue, h.currency) : '****'}
                          </div>
                          {h.currency !== 'CNY' && (
                            <div className="text-[9px] text-muted-foreground">
                              ≈{fmtCurrency(h.marketValue)}
                            </div>
                          )}
                        </div>

                        {/* PnL */}
                        <div className="text-right min-w-[60px]">
                          <div className={`text-xs font-semibold ${pnlColor(h.unrealizedPnL || 0)}`}>
                            {(h.unrealizedPnL || 0) >= 0 ? '+' : ''}{fmtCurrency(h.unrealizedPnL || 0)}
                          </div>
                          <div className={`text-[9px] ${pnlColor(h.unrealizedPnL || 0)}`}>
                            {fmtPercent(h.unrealizedPnLPercent)}
                          </div>
                        </div>

                        {/* Day change */}
                        <div className="hidden sm:flex items-center gap-0.5">
                          {(h.dayChangePercent || 0) >= 0 ? (
                            <TrendingUp className={`h-2.5 w-2.5 ${pnlColor(h.dayChangePercent || 0)}`} />
                          ) : (
                            <TrendingDown className={`h-2.5 w-2.5 ${pnlColor(h.dayChangePercent || 0)}`} />
                          )}
                          <span className={`text-xs font-medium ${pnlColor(h.dayChangePercent || 0)}`}>
                            {fmtPercent(h.dayChangePercent)}
                          </span>
                        </div>

                        {/* 操作菜单 */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditHolding(h) }}>
                              <Edit className="h-3.5 w-3.5 mr-1.5" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 dark:text-red-400"
                              onClick={(e) => { e.stopPropagation(); handleDeleteHolding(h) }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Render non-securities category with sub-group collapse
  const renderAssetSubGroups = () => {
    if (!currentSubGroups || Object.keys(currentSubGroups).length === 0) {
      return renderEmptyState()
    }

    return (
      <div className="space-y-2.5">
        {Object.entries(currentSubGroups).map(([code, items]) => {
          const info = SUB_GROUP_INFO[code] || {
            name: code,
            icon: activeCat?.icon || Wallet,
            borderColor: 'border-l-slate-400',
            iconBg: 'bg-slate-100 dark:bg-slate-800',
          }
          const GroupIcon = info.icon
          const isExpanded = expandedGroups[code] ?? false
          const groupTotal = items.reduce((sum: number, a: any) => sum + (Number(a.currentValue) || 0), 0)
          const groupPnl = items.reduce((sum: number, a: any) => sum + (Number(a.unrealizedPnl) || 0), 0)

          return (
            <div key={code} className="overflow-hidden rounded-xl border border-border">
              {/* Group header */}
              <button
                onClick={() => setExpandedGroups(prev => ({ ...prev, [code]: !prev[code] }))}
                className={`flex w-full items-center gap-4 ${info.borderColor} border-l-[3px] p-4 text-left transition-all hover:bg-muted/30`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${info.iconBg}`}>
                  <GroupIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{info.name}</span>
                  <span className="text-xs text-muted-foreground">{items.length}笔</span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-sm font-semibold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {amountVisible ? fmtCurrency(groupTotal) : '****'}
                  </span>
                  {groupPnl !== 0 && (
                    <span className={`text-xs font-medium ${pnlColor(groupPnl)}`}>
                      {groupPnl >= 0 ? '+' : ''}{fmtCurrency(groupPnl)}
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>

              {/* Expanded items */}
              {isExpanded && (
                <div className="space-y-1 border-t border-border bg-muted/10 p-2">
                  {items.map((asset: any) => (
                    <div
                      key={asset.id}
                      className="group flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-all hover:shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{asset.name}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{asset.assetCategory?.name || '--'}</span>
                          <span>{asset.currency || 'CNY'}</span>
                          {asset.maturityDate && (
                            <span>到期 {new Date(asset.maturityDate).toLocaleDateString('zh-CN')}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-semibold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {amountVisible ? fmtCurrency(Number(asset.currentValue) || 0, asset.currency) : '****'}
                          </div>
                          {asset.currency !== 'CNY' && asset.currentValue && (
                            <div className="text-[9px] text-muted-foreground">
                              ≈{fmtCurrency(Number(asset.currentValue) || 0)}
                            </div>
                          )}
                        </div>
                        {(Number(asset.unrealizedPnl) || 0) !== 0 && (
                          <div className="text-right min-w-[50px]">
                            <div className={`text-xs font-semibold ${pnlColor(Number(asset.unrealizedPnl) || 0)}`}>
                              {(Number(asset.unrealizedPnl) || 0) >= 0 ? '+' : ''}{fmtCurrency(Number(asset.unrealizedPnl) || 0)}
                            </div>
                            {asset.unrealizedPnlPercent != null && (
                              <div className={`text-[9px] ${pnlColor(Number(asset.unrealizedPnlPercent))}`}>
                                {fmtPercent(Number(asset.unrealizedPnlPercent))}
                              </div>
                            )}
                          </div>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditAsset(asset) }}>
                              <Edit className="h-3.5 w-3.5 mr-1.5" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 dark:text-red-400"
                              onClick={(e) => { e.stopPropagation(); handleDeleteAsset(asset) }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const renderEmptyState = () => (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border">
      {activeCat && <activeCat.icon className="h-8 w-8 text-muted-foreground/40" />}
      <span className="text-sm text-muted-foreground">暂无{activeCat?.label}数据</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Quick Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {quickActions.map((action) => {
          const Icon = action.icon
          const isAddAsset = action.label === '添加资产'
          return (
            <div key={action.label} className={isAddAsset ? 'relative' : ''}>
              <button
                onClick={action.onClick}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                <Icon className="h-4 w-4" />
                <span>{action.label}</span>
              </button>
              {/* 添加资产下拉菜单 */}
              {isAddAsset && addMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setAddMenuOpen(false)} />
                  <div className="absolute left-0 top-full z-40 mt-1 w-48 rounded-xl border border-border bg-card p-1.5 shadow-lg" style={{ animation: 'fadeSlideIn 0.15s ease-out' }}>
                    {[
                      { label: '权益资产', icon: TrendingUp, onClick: () => { setAddHoldingOpen(true); setAddMenuOpen(false) } },
                      { label: '现金资产', icon: Banknote, onClick: () => { setAddCashOpen(true); setAddMenuOpen(false) } },
                      { label: '固定收益', icon: ShieldCheck, onClick: () => { setAddFixedOpen(true); setAddMenuOpen(false) } },
                      { label: '不动产', icon: Home, onClick: () => { setAddPropertyOpen(true); setAddMenuOpen(false) } },
                      { label: '另类投资', icon: Gem, onClick: () => { setAddAlternativeOpen(true); setAddMenuOpen(false) } },
                      { label: '应收款', icon: Receipt, onClick: () => { setAddReceivableOpen(true); setAddMenuOpen(false) } },
                      { label: '负债', icon: CreditCard, onClick: () => { setAddLiabilityOpen(true); setAddMenuOpen(false) } },
                    ].map((item) => {
                      const ItemIcon = item.icon
                      return (
                        <button
                          key={item.label}
                          onClick={item.onClick}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                        >
                          <ItemIcon className="h-4 w-4 text-muted-foreground" />
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Category Tabs */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card scrollbar-hide">
        <div className="flex items-center gap-0 border-b border-border px-1">
          {categories.map((cat) => {
            const Icon = cat.icon
            const isActive = activeCategory === cat.id
            const count = categoryCounts[cat.id] ?? 0
            return (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id); setSearchQuery('') }}
                className={`relative flex shrink-0 items-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{cat.label}</span>
                <span
                  className={`min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold ${
                    isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {count}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="p-5 lg:p-7">
          {/* Title + Actions */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {activeCat && (
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${activeCat.iconBg}`}>
                  <activeCat.icon className={`h-4 w-4 ${activeCat.iconColor}`} />
                </div>
              )}
              <h2 className="text-base font-semibold text-foreground">
                {activeCat?.label ?? '资产'}列表
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {/* 排序按钮 */}
              <div className="relative">
                <button
                  onClick={() => setSortMenuOpen(!sortMenuOpen)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
                    sortKey !== 'value-desc' ? 'border-primary/40 text-primary' : ''
                  }`}
                  aria-label="排序"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </button>
                {sortMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setSortMenuOpen(false)} />
                    <div className="absolute right-0 top-full z-40 mt-1 w-40 rounded-xl border border-border bg-card p-1.5 shadow-lg" style={{ animation: 'fadeSlideIn 0.15s ease-out' }}>
                      {([
                        { key: 'value-desc' as const, label: '市值 高→低' },
                        { key: 'value-asc' as const, label: '市值 低→高' },
                        { key: 'pnl-desc' as const, label: '盈亏 高→低' },
                        { key: 'pnl-asc' as const, label: '盈亏 低→高' },
                        { key: 'name-asc' as const, label: '名称 A→Z' },
                      ]).map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => { setSortKey(opt.key); setSortMenuOpen(false) }}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                            sortKey === opt.key ? 'font-medium text-primary' : 'text-foreground'
                          }`}
                        >
                          {sortKey === opt.key && <CheckCircle2 className="h-3 w-3" />}
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-5 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={`搜索${activeCat?.label ?? '资产'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-3 sm:gap-4 lg:gap-6 lg:p-5">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">总市值</span>
              <span className="text-base font-bold text-foreground lg:text-lg" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {amountVisible ? fmtCurrency(summary.total) : '****'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">总盈亏</span>
              <span
                className={`text-base font-bold lg:text-lg ${pnlColor(summary.pnl)}`}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {amountVisible ? `${summary.pnl >= 0 ? '+' : ''}${fmtCurrency(summary.pnl)}` : '****'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">收益率</span>
              <span className={`text-base font-bold lg:text-lg ${pnlColor(summary.pnl)}`}>
                {fmtPercent(summary.rate)}
              </span>
            </div>
          </div>

          {/* Content by category */}
          {activeCategory === 'securities' ? renderSecuritiesContent() : renderAssetSubGroups()}
        </div>
      </div>

      {/* ─── 活动记录对话框 ─── */}
      <ActivityLogDialog
        open={activityLogOpen}
        onOpenChange={setActivityLogOpen}
      />

      {/* ─── 家庭资产转移对话框 ─── */}
      {isFamily && familyId && (
        <FamilyTransferDialog
          open={familyTransferOpen}
          onOpenChange={setFamilyTransferOpen}
          familyId={familyId}
          familyName={familyName}
          members={familyMembersRaw}
          currentUserId={currentUserId}
          onSuccess={() => {
            apiData.refresh(true)
            apiData.refreshFamily()
          }}
        />
      )}

      {/* ─── 个人持仓转移面板 ─── */}
      {personalTransferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPersonalTransferOpen(false)}>
          <div
            className="relative mx-4 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'fadeSlideIn 0.2s ease-out' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <ArrowLeftRight className="h-4.5 w-4.5 text-primary" />
                  资产转移
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">选择要转移的资产，支持证券持仓、现金、另类资产及负债</p>
              </div>
              <button onClick={() => setPersonalTransferOpen(false)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 转移成功 */}
            {transferSuccess ? (
              <div className="flex flex-col items-center gap-4 p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-foreground">
                    {selectedHolding?._transferType === 'holding' ? '转移成功' : '变更成功'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedHolding?._transferType === 'holding'
                      ? `已将 ${selectedHolding?._displayName} 转移到目标账户`
                      : `已完成 ${selectedHolding?._displayName} 的分类/类型变更`
                    }
                  </p>
                </div>
                <button
                  onClick={() => setPersonalTransferOpen(false)}
                  className="rounded-xl bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  完成
                </button>
              </div>
            ) : personalTransferStep === 'select' ? (
              /* Step 1: 选择资产 */
              <div className="p-5">
                <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-muted/40 p-1">
                  {([
                    { key: 'all', label: '全部', count: holdingsList.length },
                    { key: 'holding', label: '证券持仓', count: holdingsList.filter((h: any) => h._transferType === 'holding').length },
                    { key: 'asset', label: '其他资产', count: holdingsList.filter((h: any) => h._transferType === 'asset').length },
                    { key: 'liability', label: '负债', count: holdingsList.filter((h: any) => h._transferType === 'liability').length },
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setTransferFilter(tab.key)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        transferFilter === tab.key
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab.label}
                      <span className={`min-w-[16px] rounded-full px-1 text-center text-[10px] ${
                        transferFilter === tab.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {loadingHoldings ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">加载中...</span>
                  </div>
                ) : holdingsList.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">暂无可转移资产</div>
                ) : (
                  <div className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
                    {holdingsList
                      .filter((h: any) => transferFilter === 'all' || h._transferType === transferFilter)
                      .map((h: any) => {
                        const isHolding = h._transferType === 'holding'
                        const isAsset = h._transferType === 'asset'
                        const iconBg = isHolding ? 'bg-blue-500/10' : isAsset ? 'bg-emerald-500/10' : 'bg-red-500/10'
                        const IconComp = isHolding ? TrendingUp : isAsset ? Wallet : CreditCard
                        const iconColor = isHolding ? 'text-blue-600' : isAsset ? 'text-emerald-600' : 'text-red-500'

                        return (
                          <button
                            key={`${h._transferType}-${h.id}`}
                            onClick={() => handleSelectHolding(h)}
                            className="flex items-center gap-3 rounded-xl border border-border p-3.5 text-left transition-all hover:bg-muted/30 hover:shadow-sm"
                          >
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
                              <IconComp className={`h-4 w-4 ${iconColor}`} />
                            </div>
                            <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                              <span className="truncate text-sm font-medium text-foreground">{h._displayName}</span>
                              <span className="text-[11px] text-muted-foreground">{h._displaySub}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {amountVisible ? `¥${(h._displayValue || 0).toLocaleString()}` : '****'}
                              </div>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                          </button>
                        )
                      })}
                  </div>
                )}
              </div>
            ) : (
              /* Step 2: 配置转移 */
              <div className="p-5">
                {/* 已选资产信息 */}
                <div className={`mb-4 rounded-xl p-3.5 ${
                  selectedHolding?._transferType === 'holding' ? 'bg-blue-500/5' :
                  selectedHolding?._transferType === 'asset' ? 'bg-emerald-500/5' : 'bg-red-500/5'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-foreground">{selectedHolding?._displayName}</span>
                      {selectedHolding?.symbol && (
                        <span className="ml-2 text-xs text-muted-foreground">{selectedHolding.symbol}</span>
                      )}
                    </div>
                    <button onClick={() => setPersonalTransferStep('select')} className="text-xs text-primary hover:underline">
                      重新选择
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                    {selectedHolding?._transferType === 'holding' ? (
                      <>
                        <div>
                          <span className="text-muted-foreground">账户</span>
                          <p className="mt-0.5 font-medium text-foreground">{selectedHolding?.broker || selectedHolding?.accountName}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">持有</span>
                          <p className="mt-0.5 font-medium text-foreground">{selectedHolding?.quantity} 股</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">成本价</span>
                          <p className="mt-0.5 font-medium text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {amountVisible ? `¥${(selectedHolding?.averageCost || 0).toFixed(2)}` : '****'}
                          </p>
                        </div>
                      </>
                    ) : selectedHolding?._transferType === 'asset' ? (
                      <>
                        <div>
                          <span className="text-muted-foreground">当前分类</span>
                          <p className="mt-0.5 font-medium text-foreground">{selectedHolding?.assetCategory?.parent?.name || selectedHolding?.assetCategory?.name || '--'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">子分类</span>
                          <p className="mt-0.5 font-medium text-foreground">{selectedHolding?.assetCategory?.parent ? selectedHolding?.assetCategory?.name : '--'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">当前价值</span>
                          <p className="mt-0.5 font-medium text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {amountVisible ? `¥${(selectedHolding?._displayValue || 0).toLocaleString()}` : '****'}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-muted-foreground">当前类型</span>
                          <p className="mt-0.5 font-medium text-foreground">{LIABILITY_TYPE_LABELS[selectedHolding?.type] || selectedHolding?.type}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">当前余额</span>
                          <p className="mt-0.5 font-medium text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {amountVisible ? `¥${(selectedHolding?._displayValue || 0).toLocaleString()}` : '****'}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">月供</span>
                          <p className="mt-0.5 font-medium text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {amountVisible ? `¥${(selectedHolding?.monthlyPaymentCny || selectedHolding?.monthlyPayment || 0).toLocaleString()}` : '****'}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 证券持仓：跨账户转移 */}
                {selectedHolding?._transferType === 'holding' && (
                  <>
                    <div className="mb-4">
                      <label className="mb-1.5 block text-xs font-medium text-foreground">
                        目标账户 <span className="text-red-500">*</span>
                      </label>
                      {loadingAccounts ? (
                        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> 加载账户...
                        </div>
                      ) : (
                        <select
                          value={targetAccountId}
                          onChange={(e) => setTargetAccountId(e.target.value)}
                          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
                        >
                          <option value="">选择目标账户</option>
                          {accountsList.map((acc: any) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.accountName} - {acc.broker?.name} ({acc.currency})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="mb-1.5 block text-xs font-medium text-foreground">转移模式</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setTransferMode('partial'); setTransferQty('') }}
                          className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                            transferMode === 'partial'
                              ? 'bg-foreground text-background shadow-sm'
                              : 'border border-border bg-background text-muted-foreground hover:bg-muted/50'
                          }`}
                        >
                          部分转移
                        </button>
                        <button
                          onClick={() => { setTransferMode('full'); setTransferQty(String(selectedHolding?.quantity || 0)) }}
                          className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                            transferMode === 'full'
                              ? 'bg-foreground text-background shadow-sm'
                              : 'border border-border bg-background text-muted-foreground hover:bg-muted/50'
                          }`}
                        >
                          全部转移
                        </button>
                      </div>
                    </div>

                    {transferMode === 'partial' && (
                      <div className="mb-4">
                        <label className="mb-1.5 block text-xs font-medium text-foreground">
                          转移数量 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          placeholder="请输入转移数量"
                          value={transferQty}
                          onChange={(e) => setTransferQty(e.target.value)}
                          max={selectedHolding?.quantity}
                          step="0.01"
                          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">最大可转移：{selectedHolding?.quantity}</p>
                      </div>
                    )}

                    {targetAccountId && (transferMode === 'full' || (transferQty && parseFloat(transferQty) > 0)) && (
                      <div className="mb-4 rounded-xl border border-border p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          转移预览
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-medium text-foreground">{selectedHolding?.broker || selectedHolding?.accountName}</p>
                            <p className="text-xs text-muted-foreground">
                              {transferMode === 'full' ? '全部转出' : `剩余 ${(selectedHolding?.quantity || 0) - (parseFloat(transferQty) || 0)}`}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div className="text-right">
                            <p className="font-medium text-foreground">{accountsList.find((a: any) => a.id === targetAccountId)?.accountName}</p>
                            <p className="text-xs text-muted-foreground">
                              接收 {transferMode === 'full' ? selectedHolding?.quantity : transferQty}
                            </p>
                          </div>
                        </div>
                        {transferMode === 'full' && (
                          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-600">
                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            全部转移后，源账户中的该持仓将被删除
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* 其他资产：分类变更 */}
                {selectedHolding?._transferType === 'asset' && (
                  <div className="mb-4">
                    <label className="mb-1.5 block text-xs font-medium text-foreground">
                      目标分类 <span className="text-red-500">*</span>
                    </label>
                    {loadingAccounts ? (
                      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> 加载分类...
                      </div>
                    ) : (
                      <select
                        value={targetCategoryId}
                        onChange={(e) => setTargetCategoryId(e.target.value)}
                        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
                      >
                        <option value="">选择目标分类</option>
                        {assetCategories.map((cat: any) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.parent ? `${cat.parent.name} › ${cat.name}` : cat.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {targetCategoryId && (
                      <div className="mt-3 rounded-xl border border-border p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          变更预览
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-medium text-foreground">{selectedHolding?.assetCategory?.parent?.name || selectedHolding?.assetCategory?.name}</p>
                            <p className="text-xs text-muted-foreground">当前分类</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div className="text-right">
                            <p className="font-medium text-foreground">
                              {(() => {
                                const cat = assetCategories.find((c: any) => c.id === targetCategoryId)
                                return cat?.parent ? `${cat.parent.name} › ${cat.name}` : cat?.name || ''
                              })()}
                            </p>
                            <p className="text-xs text-muted-foreground">目标分类</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 负债：类型变更 */}
                {selectedHolding?._transferType === 'liability' && (
                  <div className="mb-4">
                    <label className="mb-1.5 block text-xs font-medium text-foreground">
                      目标类型 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={targetLiabilityType}
                      onChange={(e) => setTargetLiabilityType(e.target.value)}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
                    >
                      <option value="">选择目标类型</option>
                      {LIABILITY_TYPES.filter(t => t.value !== selectedHolding?.type).map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    {targetLiabilityType && targetLiabilityType !== selectedHolding?.type && (
                      <div className="mt-3 rounded-xl border border-border p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          变更预览
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-medium text-foreground">{LIABILITY_TYPE_LABELS[selectedHolding?.type] || selectedHolding?.type}</p>
                            <p className="text-xs text-muted-foreground">当前类型</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div className="text-right">
                            <p className="font-medium text-foreground">{LIABILITY_TYPE_LABELS[targetLiabilityType] || targetLiabilityType}</p>
                            <p className="text-xs text-muted-foreground">目标类型</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 备注 */}
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs font-medium text-foreground">备注（可选）</label>
                  <input
                    placeholder="如：账户整合、分类调整等"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setPersonalTransferOpen(false)}
                    className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handlePersonalTransfer}
                    disabled={
                      transferLoading ||
                      (selectedHolding?._transferType === 'holding' && (!targetAccountId || (transferMode === 'partial' && (!transferQty || parseFloat(transferQty) <= 0)))) ||
                      (selectedHolding?._transferType === 'asset' && !targetCategoryId) ||
                      (selectedHolding?._transferType === 'liability' && (!targetLiabilityType || targetLiabilityType === selectedHolding?.type))
                    }
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {transferLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {transferLoading ? '处理中...' : selectedHolding?._transferType === 'holding' ? '确认转移' : '确认变更'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 添加资产对话框 ─── */}
      <AddHoldingDialog
        open={addHoldingOpen}
        onOpenChange={setAddHoldingOpen}
        onSuccess={handleAddSuccess}
      />
      <AddCashAssetDialog
        open={addCashOpen}
        onOpenChange={setAddCashOpen}
        onSuccess={handleAddSuccess}
      />
      <AddFixedIncomeDialog
        open={addFixedOpen}
        onOpenChange={setAddFixedOpen}
        onSuccess={handleAddSuccess}
      />
      <AddRealEstateDialog
        open={addPropertyOpen}
        onOpenChange={setAddPropertyOpen}
        onSuccess={handleAddSuccess}
      />
      <AddAlternativeDialog
        open={addAlternativeOpen}
        onOpenChange={setAddAlternativeOpen}
        onSuccess={handleAddSuccess}
      />
      <AddReceivableDialog
        open={addReceivableOpen}
        onOpenChange={setAddReceivableOpen}
        onSuccess={handleAddSuccess}
      />
      <AddLiabilityDialog
        open={addLiabilityOpen}
        onOpenChange={setAddLiabilityOpen}
        onSuccess={() => {
          setAddLiabilityOpen(false)
          handleAddSuccess()
        }}
      />

      {/* ─── 编辑/删除持仓对话框 ─── */}
      <EditHoldingDialog
        holding={selectedHolding}
        open={editHoldingOpen}
        onOpenChange={setEditHoldingOpen}
        onSave={handleSaveEdit}
      />
      <DeleteHoldingDialog
        holding={selectedHolding}
        open={deleteHoldingOpen}
        onOpenChange={setDeleteHoldingOpen}
        onConfirm={handleConfirmDelete}
      />
      <EditCashDialog
        accountId={selectedCashAccount?.accountId || null}
        accountName={selectedCashAccount?.accountName || null}
        broker={selectedCashAccount?.broker || null}
        initialAmount={selectedCashAccount?.amount || 0}
        initialCurrency={selectedCashAccount?.currency || 'CNY'}
        open={editCashOpen}
        onOpenChange={setEditCashOpen}
        onSave={handleSaveCash}
      />

      {/* ─── 编辑/删除非证券资产对话框 ─── */}
      {selectedAsset && (
        <EditAssetDialog
          asset={selectedAsset}
          open={editAssetOpen}
          onOpenChange={setEditAssetOpen}
          onSuccess={handleAssetEditSuccess}
        />
      )}
      {selectedAsset && (
        <DeleteAssetDialog
          asset={selectedAsset}
          open={deleteAssetOpen}
          onOpenChange={setDeleteAssetOpen}
          onSuccess={handleAssetDeleteSuccess}
        />
      )}
    </div>
  )
}
