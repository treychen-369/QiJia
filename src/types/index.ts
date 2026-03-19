// 注意：NextAuth 类型定义在 src/types/next-auth.d.ts 中，这里不再重复定义
// 导入 Prisma 生成的类型
import type { 
  User, 
  Holding, 
  Transaction
} from '@prisma/client'

// 本地定义不存在于 Prisma schema 的类型
export interface Portfolio {
  id: string;
  name: string;
  userId: string;
}

export interface Stock {
  id: string;
  symbol: string;
  name: string;
}

// 基础类型
export type Currency = 'CNY' | 'USD' | 'HKD' | 'JPY'
export type AccountType = 'investment' | 'cash' | 'margin'
export type TransactionType = 'BUY' | 'SELL' | 'DIVIDEND' | 'SPLIT' | 'TRANSFER'
export type SyncType = 'manual' | 'api' | 'file_import'
export type SyncStatus = 'running' | 'success' | 'failed' | 'partial'

// Phase 4: 家庭资产管理类型
export type FamilyRole = 'ADMIN' | 'MEMBER' | 'VIEWER'
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'

export interface Family {
  id: string
  name: string
  description?: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface FamilyMemberInfo {
  id: string
  userId: string
  familyId: string
  role: FamilyRole
  joinedAt: Date
  user: {
    id: string
    name: string
    email: string
    avatarUrl?: string | null
  }
}

export interface FamilyInvitationInfo {
  id: string
  familyId: string
  email: string
  role: FamilyRole
  status: InvitationStatus
  inviterId: string
  token: string
  expiresAt: Date
  createdAt: Date
  inviter?: {
    name: string
    email: string
  }
}

export interface FamilyOverview {
  family: Family
  members: FamilyMemberInfo[]
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  totalUnrealizedPnl: number
  totalUnrealizedPnlPercent: number
  memberBreakdown: Array<{
    userId: string
    userName: string
    role: FamilyRole
    totalAssets: number
    percentage: number
  }>
  assetDistribution: Array<{
    category: string
    categoryName: string
    value: number
    percentage: number
  }>
  calculatedAt: Date
}

// Dashboard 视角类型
export type DashboardView = 'personal' | 'family'
export interface ViewSwitcherState {
  currentView: DashboardView
  selectedMemberId?: string  // 管理员选择查看某个成员的资产
}

// 扩展的用户类型
export interface ExtendedUser extends User {
  portfolios?: Portfolio[]
  familyMember?: {
    id: string
    familyId: string
    role: FamilyRole
    family: Family
  } | null
}

// 持仓详情类型
export interface HoldingWithDetails extends Holding {
  stock: Stock
  portfolio: Portfolio
}

// 交易记录详情类型
export interface TransactionWithDetails extends Transaction {
  stock: Stock
  portfolio: Portfolio
}

// 账户余额快照类型
export interface AccountBalanceSnapshot {
  id: string
  userId: string
  accountId: string
  snapshotDate: Date
  cashBalanceOriginal: number
  cashBalanceCny: number
  totalMarketValueOriginal: number
  totalMarketValueCny: number
  investableRatio: number
  investableAmountCny: number
  totalPortfolioRatio: number
  exchangeRate: number
  notes?: string
}

// 投资组合摘要类型
export interface PortfolioSummary {
  totalValue: number
  totalCash: number
  totalInvested: number
  unrealizedPnl: number
  realizedPnl: number
  totalReturn: number
  totalReturnPercent: number
  dayChange: number
  dayChangePercent: number
}

// 资产配置类型
export interface AssetAllocation {
  category: string
  currentValue: number
  currentRatio: number
  targetRatio: number
  deviation: number
  recommendedAction: 'BUY' | 'SELL' | 'HOLD'
  notes?: string
}

// 市场数据类型
export interface MarketDataPoint {
  id: string
  indexId: string
  dataDate: Date
  currentLevel: number
  peRatio?: number
  historicalPeMedian?: number
  valuationPercentile?: number
  valuationStatus?: 'LOW' | 'FAIR' | 'HIGH'
  signalWeight: number
}

// 投资计划类型
export interface InvestmentPlan {
  id: string
  userId: string
  planDate: Date
  totalPortfolioValue: number
  availableCash: number
  investmentRatio: number
  plannedInvestmentAmount: number
  allocations: {
    sp500: number
    gold: number
    japan: number
    china: number
    cash: number
  }
  notes?: string
}

// 同步配置类型
export interface SyncConfiguration {
  id: string
  userId: string
  brokerId: string
  syncType: SyncType
  isEnabled: boolean
  syncFrequency: string
  lastSyncTime?: Date
  nextSyncTime?: Date
  apiCredentialsEncrypted?: string
  syncSettings?: Record<string, any>
}

// 同步日志类型
export interface SyncLog {
  id: string
  syncConfigId: string
  syncStartTime: Date
  syncEndTime?: Date
  syncStatus: SyncStatus
  recordsProcessed: number
  recordsUpdated: number
  recordsFailed: number
  errorMessage?: string
  syncDetails?: Record<string, any>
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 分页类型
export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// 筛选类型
export interface HoldingFilters {
  accountId?: string
  securityId?: string
  minValue?: number
  maxValue?: number
  hasPosition?: boolean
}

export interface TransactionFilters {
  accountId?: string
  securityId?: string
  transactionType?: TransactionType
  startDate?: Date
  endDate?: Date
  minAmount?: number
  maxAmount?: number
}

// 图表数据类型
export interface ChartDataPoint {
  date: string
  value: number
  label?: string
}

export interface PortfolioChartData {
  totalValue: ChartDataPoint[]
  allocation: {
    category: string
    value: number
    color: string
  }[]
  performance: {
    period: string
    return: number
    benchmark: number
  }[]
}

// Excel导入类型
export interface ExcelImportResult {
  success: boolean
  totalRows: number
  processedRows: number
  errorRows: number
  errors: {
    row: number
    field: string
    message: string
  }[]
  data?: any[]
}

// 文件上传类型
export interface FileUploadConfig {
  maxSize: number // bytes
  allowedTypes: string[]
  maxFiles: number
}

// 通知类型
export interface Notification {
  id: string
  userId: string
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS'
  title: string
  message: string
  isRead: boolean
  createdAt: Date
  expiresAt?: Date
}

// 系统设置类型
export interface SystemSettings {
  currency: Currency
  language: 'zh-CN' | 'en-US'
  theme: 'light' | 'dark' | 'system'
  notifications: {
    email: boolean
    push: boolean
    syncErrors: boolean
    marketAlerts: boolean
  }
  privacy: {
    shareData: boolean
    analytics: boolean
  }
}

// 错误类型
export interface AppError {
  code: string
  message: string
  details?: Record<string, any>
  timestamp: Date
}

// 表单验证类型
export interface ValidationError {
  field: string
  message: string
}

export interface FormState<T = any> {
  data: T
  errors: ValidationError[]
  isValid: boolean
  isSubmitting: boolean
}