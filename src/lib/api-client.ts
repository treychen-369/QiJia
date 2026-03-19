// API客户端 - 统一管理前端API调用

export interface DashboardData {
  overview: {
    totalAssets: number
    totalCash: number
    totalInvestmentValue: number
    totalCashAssets?: number       // ✅ 新增：现金资产总值
    totalOtherAssets?: number      // ✅ 新增：其他资产总值
    totalUnrealizedPnl: number
    totalUnrealizedPnlPercent: number
    todayPnl: number
    todayPnlPercent: number
    accountCount: number
    holdingCount: number
    // ✅ Phase 1.2: 新增净资产和负债字段
    totalLiabilities?: number
    netWorth?: number
  }
  accounts: Array<{
    id: string
    name: string
    broker: string
    currency: string
    totalValue: number
    cashBalance: number
    cashBalanceOriginal: number // 原币种金额
    investableAmount: number
    lastUpdated: string
  }>
  portfolio: {
    byRegion: Array<{
      name: string
      value: number
      percentage: number
      count: number
    }>
    byCategory: Array<{
      name: string
      value: number
      percentage: number
      count: number
    }>
  }
  topHoldings: Array<{
    id: string
    type: 'holding'
    symbol: string
    name: string
    accountId: string
    accountName: string
    broker: string
    quantity: number
    averageCost: number
    currentPrice: number
    costBasis: number
    marketValue: number
    marketValueOriginal: number
    unrealizedPnL: number
    unrealizedPnLPercent: number
    dayChange: number
    dayChangePercent: number
    sector: string
    region: string
    currency: string
    lastUpdated: string
    percentage: number
  }>
  allHoldings: Array<{
    id: string
    type: 'holding'
    symbol: string
    name: string
    accountId: string
    accountName: string
    broker: string
    quantity: number
    averageCost: number
    currentPrice: number
    costBasis: number
    marketValue: number
    marketValueOriginal: number
    unrealizedPnL: number
    unrealizedPnLPercent: number
    dayChange: number
    dayChangePercent: number
    sector: string
    region: string
    currency: string
    lastUpdated: string
    percentage: number
  }>
  investmentPlans: Array<{
    id: string
    date: string
    totalValue: number
    investmentRatio: number
    plannedAmount: number
    cashReserve: number
  }>
  dualViewPortfolio?: {
    byAccount: Array<any>
    byAssetType: Array<any>
  }
  // ✨ Phase 2: 底层敞口投资组合数据（新增）
  underlyingTypePortfolio?: {
    byUnderlyingType: Array<{
      code: string
      name: string
      value: number
      percentage: number
      color: string
      count: number
      includeInNetWorth: boolean
      details?: {
        holdings: number
        cashAssets: number
        otherAssets: number
      }
    }>
    byOverviewGroup: Array<{
      code: string
      name: string
      value: number
      percentage: number
      color: string
      count: number
      includeInNetWorth: boolean
      details?: {
        holdings: number
        cashAssets: number
        otherAssets: number
      }
    }>
    // ✨ 权益类按地区细分
    equityByRegion?: {
      total: number
      count: number
      byRegion: Array<{
        regionCode: string
        regionName: string
        value: number
        percentage: number
        count: number
        color?: string
      }>
    }
    // ✨ 各资产分组的二级分类细分
    groupsSubCategories?: Record<string, {
      groupCode: string
      groupName: string
      total: number
      count: number
      bySubCategory: Array<{
        categoryCode: string
        categoryName: string
        value: number
        percentage: number
        count: number
        color?: string
      }>
    }>
  }
  
  // ✅ Phase 2 侧边栏优化: 配置分析数据（新增）
  allocationData?: {
    overallScore: number
    topDeviations: Array<{
      categoryCode: string
      categoryName: string
      currentPercent: number
      targetPercent: number
      deviation: number
      deviationStatus: 'NORMAL' | 'WARNING' | 'CRITICAL'
    }>
    liabilityInfo?: {
      totalLiabilities: number
      liabilityRatio: number
      dti?: number
      monthlyPayment?: number
      debtHealthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL'
      // ✨ 新增：完整负债数据，用于AI建议
      liabilityCount?: number
      averageInterestRate?: number
      byType?: Array<{
        type: string
        typeName: string
        balance: number
        percentage: number
      }>
    }
    scoreBreakdown?: {
      deviationScore: number
      diversityScore: number
      liquidityScore: number
      debtScore: number
    }
    keyMetrics?: {
      liquidityRatio: number
      liquidityMonths?: number
      diversityIndex: number
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
      equityRatio?: number
    }
    latestAdvice?: {
      id: string
      summary: string
      status: string
      confidence?: number
      createdAt: string
      // ✨ 新增：二级资产调仓建议
      actions?: Array<{
        priority: number
        category: string
        categoryName: string
        action: 'BUY' | 'SELL' | 'HOLD'
        amount?: number
        reason: string
        subCategory?: string
        suggestedProducts?: string[]
      }>
      // ✨ 新增：详细分析报告
      fullAnalysis?: string
      targets?: Array<{
        categoryCode: string
        categoryName: string
        currentPercent: number
        suggestedPercent: number
        reason: string
      }>
      risks?: string[]
    }
    fullAnalysis?: Array<any>
    alerts?: Array<any>
  }
}

export interface PortfolioData {
  type: 'all' | 'region' | 'category' | 'account'
  totalValue: number
  totalUnrealizedPnl?: number
  totalUnrealizedPnlPercent?: number
  count?: number
  holdings?: Array<any>
  groups?: Array<any>
}

class ApiClient {
  private getBaseUrl(): string {
    // 客户端使用相对路径，服务端使用环境变量
    // 在浏览器中使用空字符串（相对路径），请求会自动发到当前域名
    if (typeof window !== 'undefined') {
      return '' // 客户端：使用相对路径，自动使用当前域名
    } else {
      // 服务端：运行时读取环境变量（不在构造函数中缓存，避免构建时烘焙）
      return process.env.NEXTAUTH_URL || ''
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.getBaseUrl()}/api${endpoint}`
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...options.headers,
      },
      credentials: 'include', // 确保发送cookies（用于NextAuth会话）
      cache: 'no-store', // 禁用 fetch 缓存
      ...options,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  // 获取仪表板数据（添加时间戳防止缓存）
  async getDashboardData(): Promise<DashboardData> {
    const timestamp = Date.now();
    return this.request<DashboardData>(`/dashboard?_t=${timestamp}`)
  }

  // 获取投资组合数据
  async getPortfolioData(type: 'all' | 'region' | 'category' | 'account' = 'all'): Promise<PortfolioData> {
    return this.request<PortfolioData>(`/portfolio?type=${type}`)
  }

  // 获取账户列表
  async getAccounts(): Promise<DashboardData['accounts']> {
    const data = await this.getDashboardData()
    return data.accounts
  }

  // 获取持仓列表
  async getHoldings(): Promise<PortfolioData['holdings']> {
    const data = await this.getPortfolioData('all')
    return data.holdings || []
  }

  // 获取投资计划
  async getInvestmentPlans(): Promise<DashboardData['investmentPlans']> {
    const data = await this.getDashboardData()
    return data.investmentPlans
  }

  // ===== 持仓管理增强API =====
  
  // 获取券商列表
  async getBrokers(): Promise<Array<{ id: string; name: string; isActive: boolean }>> {
    return this.request('/brokers')
  }

  // 获取资产类别列表
  async getAssetCategories(): Promise<Array<{ id: string; name: string; description?: string }>> {
    return this.request('/asset-categories')
  }

  // 获取地区列表
  async getRegions(): Promise<Array<{ id: string; name: string; countryCode?: string }>> {
    return this.request('/regions')
  }

  // 获取证券列表
  async getSecurities(params?: { search?: string; assetTypeId?: string; regionId?: string }): Promise<Array<{
    id: string
    symbol: string
    name: string
    assetTypeId: string
    assetTypeName: string
    regionId: string
    regionName: string
    sector?: string
    currency: string
    holdingsCount: number
  }>> {
    const queryParams = new URLSearchParams()
    if (params?.search) queryParams.append('search', params.search)
    if (params?.assetTypeId) queryParams.append('assetTypeId', params.assetTypeId)
    if (params?.regionId) queryParams.append('regionId', params.regionId)
    
    const query = queryParams.toString()
    return this.request(`/securities${query ? `?${query}` : ''}`)
  }

  // 创建新证券
  async createSecurity(data: {
    symbol: string
    name: string
    assetTypeId: string
    regionId: string
    sector?: string
    currency: string
  }): Promise<{ id: string; symbol: string; name: string }> {
    return this.request('/securities', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  // 获取投资账户列表
  async getInvestmentAccounts(): Promise<Array<{
    id: string
    name: string
    brokerId: string
    brokerName: string
    accountType: string
    currency: string
    totalValue: number
    cashBalance: number
    isActive: boolean
  }>> {
    return this.request('/accounts')
  }

  // 创建新账户
  async createAccount(data: {
    name: string
    brokerId: string
    accountType: string
    currency: string
    cashBalance?: number
    isActive?: boolean
  }): Promise<{ id: string; name: string }> {
    return this.request('/accounts', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  // 创建新持仓
  async createHolding(data: {
    securityId: string
    accountId: string
    quantity: number
    averageCost: number
    currentPrice?: number
  }): Promise<{ id: string }> {
    return this.request('/holdings', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  // 转移持仓
  async transferHolding(data: {
    sourceHoldingId: string
    targetAccountId: string
    quantity: number
    transferType: 'partial' | 'full'
    reason?: string
  }): Promise<{ 
    success: boolean
    sourceHolding: { id: string; quantity: number }
    targetHolding: { id: string; quantity: number }
    transferLog: { id: string; transferDate: string }
  }> {
    return this.request('/holdings/transfer', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  // 获取持仓转移历史
  async getTransferHistory(params?: { 
    holdingId?: string
    accountId?: string
    startDate?: string
    endDate?: string
  }): Promise<Array<{
    id: string
    sourceHoldingId: string
    targetHoldingId: string
    securitySymbol: string
    securityName: string
    quantity: number
    transferType: string
    transferDate: string
    reason?: string
  }>> {
    const queryParams = new URLSearchParams()
    if (params?.holdingId) queryParams.append('holdingId', params.holdingId)
    if (params?.accountId) queryParams.append('accountId', params.accountId)
    if (params?.startDate) queryParams.append('startDate', params.startDate)
    if (params?.endDate) queryParams.append('endDate', params.endDate)
    
    const query = queryParams.toString()
    return this.request(`/holdings/transfer${query ? `?${query}` : ''}`)
  }
}

// 导出单例实例
export const apiClient = new ApiClient()

// 便捷的钩子函数，用于React组件
export const useApiClient = () => apiClient

// 错误处理工具
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// 数据格式化工具
export const formatters = {
  currency: (amount: number, currency: string = 'CNY'): string => {
    const numAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    const formatter = new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: currency === 'CNY' ? 'CNY' : currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return formatter.format(numAmount)
  },

  percentage: (value: number, decimals: number = 2): string => {
    const numValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    return `${numValue.toFixed(decimals)}%`
  },

  number: (value: number, decimals: number = 2): string => {
    const numValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    return new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(numValue)
  },

  date: (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  },

  datetime: (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
}

// 数据验证工具
export const validators = {
  isValidNumber: (value: any): boolean => {
    return typeof value === 'number' && !isNaN(value) && isFinite(value)
  },

  isValidDate: (value: any): boolean => {
    const date = new Date(value)
    return date instanceof Date && !isNaN(date.getTime())
  },

  isValidCurrency: (currency: string): boolean => {
    const validCurrencies = ['CNY', 'USD', 'HKD', 'JPY', 'EUR', 'GBP']
    return validCurrencies.includes(currency.toUpperCase())
  }
}