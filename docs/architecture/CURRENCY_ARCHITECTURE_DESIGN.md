# 货币汇率管理架构设计

## 📋 问题分析

### 当前架构的问题

#### 1. **汇率数据分散**
```
❌ 当前状态：汇率存储在多个地方
- AccountBalance.exchangeRate (快照表)
- SystemConfig.EXCHANGE_RATES (系统配置)
- 代码硬编码的默认值 (多个文件)
```

#### 2. **计算逻辑不一致**
```
❌ 问题代码片段：

// portfolio-service.ts 第207行
const exchangeRate = balance ? Number(balance.exchangeRate || 1) : 1;

// holdings/transfer/route.ts 第8-14行
function getExchangeRate(currency: string): number {
  switch (currency) {
    case 'USD': return 7.2;
    case 'HKD': return 0.92;
    case 'CNY': default: return 1.0;
  }
}
```

#### 3. **货币视角切换不支持**
```
❌ 当前限制：
- 所有金额硬编码转换为CNY
- 无法切换到USD或HKD视角
- 前端组件假设货币为CNY
```

---

## 🎯 设计目标

### 1. **统一汇率管理**
- ✅ 单一可信数据源
- ✅ 自动同步到所有计算层
- ✅ 支持历史汇率查询

### 2. **灵活的货币视角**
- ✅ 支持CNY/USD/HKD视角切换
- ✅ 所有金额按目标货币显示
- ✅ 用户偏好设置持久化

### 3. **清晰的数据流**
```
数据库(原币) → 服务层(汇率转换) → API层(目标货币) → 前端(显示)
```

---

## 🏗️ 新架构设计

### 核心原则

```
原子数据原则：
数据库存储原币值 (USD/HKD/CNY)
↓
服务层应用汇率
↓
统一转换为目标货币
↓
前端展示
```

---

## 📦 组件设计

### 1. 汇率服务 (CurrencyService)

**职责**：统一管理所有汇率相关操作

```typescript
// src/lib/services/currency-service.ts

export class CurrencyService {
  /**
   * 获取最新汇率（优先级：数据库 > API > 默认值）
   */
  static async getLatestRates(): Promise<ExchangeRates> {
    // 从数据库读取
    const cached = await prisma.systemConfig.findUnique({
      where: { configKey: 'EXCHANGE_RATES' }
    })
    
    if (cached) {
      return cached.configValue as ExchangeRates
    }
    
    // 返回默认值
    return DEFAULT_RATES
  }

  /**
   * 获取特定货币对的汇率
   */
  static async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1.0
    
    const rates = await this.getLatestRates()
    
    // from → CNY → to
    const fromRate = rates.rates[from] || 1
    const toRate = rates.rates[to] || 1
    
    return fromRate / toRate
  }

  /**
   * 转换金额
   */
  static async convert(
    amount: number,
    from: string,
    to: string
  ): Promise<number> {
    const rate = await this.getRate(from, to)
    return amount * rate
  }

  /**
   * 批量转换（优化性能）
   */
  static async convertBatch(
    items: Array<{ amount: number; from: string }>,
    to: string
  ): Promise<number[]> {
    const rates = await this.getLatestRates()
    
    return items.map(item => {
      const rate = this.calculateRate(item.from, to, rates)
      return item.amount * rate
    })
  }

  /**
   * 计算汇率（内部方法，避免重复查询）
   */
  private static calculateRate(
    from: string,
    to: string,
    rates: ExchangeRates
  ): number {
    if (from === to) return 1.0
    
    const fromRate = rates.rates[from] || 1
    const toRate = rates.rates[to] || 1
    
    return fromRate / toRate
  }
}
```

---

### 2. 用户货币偏好

**数据库Schema扩展**：

```prisma
// prisma/schema.prisma

model UserPreference {
  id                 String   @id @default(cuid())
  userId             String   @unique @map("user_id")
  
  // 新增字段
  baseCurrency       String   @default("CNY") @map("base_currency") // CNY/USD/HKD
  
  colorScheme        String   @default("semantic") @map("color_scheme")
  // ... 其他字段
  
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("user_preferences")
}
```

**Context Provider**：

```typescript
// src/contexts/currency-context.tsx

export const CurrencyProvider = ({ children }) => {
  const [baseCurrency, setBaseCurrency] = useState<'CNY' | 'USD' | 'HKD'>('CNY')
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null)

  // 加载用户偏好
  useEffect(() => {
    loadUserPreference()
    loadExchangeRates()
  }, [])

  // 转换金额
  const convert = useCallback((amount: number, from: string) => {
    if (!exchangeRates) return amount
    // 转换逻辑
  }, [exchangeRates, baseCurrency])

  return (
    <CurrencyContext.Provider value={{ baseCurrency, setBaseCurrency, convert }}>
      {children}
    </CurrencyContext.Provider>
  )
}
```

---

### 3. 服务层改造

**PortfolioService 统一使用 CurrencyService**：

```typescript
// src/lib/services/portfolio-service.ts

export class PortfolioService {
  /**
   * 获取账户摘要（支持目标货币）
   */
  static async getAccountsSummary(
    userId: string,
    targetCurrency: string = 'CNY'
  ): Promise<AccountSummary[]> {
    // 获取所有账户
    const accounts = await prisma.investmentAccount.findMany({
      where: { userId },
      include: { broker: true },
    })

    // 获取最新汇率
    const rates = await CurrencyService.getLatestRates()

    // 获取所有持仓
    const holdings = await prisma.holding.findMany({
      where: { userId },
      include: { account: true }
    })

    // 按账户分组计算
    const summaries: AccountSummary[] = []

    for (const account of accounts) {
      const accountHoldings = holdings.filter(h => h.accountId === account.id)
      
      // 计算持仓市值（原币）
      let holdingsValueOriginal = accountHoldings.reduce((sum, h) => {
        return sum + Number(h.quantity) * Number(h.currentPrice || 0)
      }, 0)

      // 转换为目标货币
      const holdingsValue = await CurrencyService.convert(
        holdingsValueOriginal,
        account.currency,
        targetCurrency
      )

      // 现金余额转换
      const latestBalance = await prisma.accountBalance.findFirst({
        where: { accountId: account.id },
        orderBy: { snapshotDate: 'desc' }
      })

      const cashBalanceOriginal = latestBalance 
        ? Number(latestBalance.cashBalanceOriginal) 
        : 0

      const cashBalance = await CurrencyService.convert(
        cashBalanceOriginal,
        account.currency,
        targetCurrency
      )

      summaries.push({
        id: account.id,
        name: account.accountName,
        broker: account.broker.name,
        currency: account.currency,
        holdingsValue,
        holdingsValueOriginal,
        cashBalance,
        cashBalanceOriginal,
        totalValue: holdingsValue + cashBalance,
        targetCurrency,
        lastUpdated: latestBalance?.snapshotDate || new Date(),
      })
    }

    return summaries
  }

  /**
   * 计算投资组合概览（支持目标货币）
   */
  static async calculatePortfolioOverview(
    userId: string,
    targetCurrency: string = 'CNY'
  ): Promise<PortfolioOverview> {
    const accounts = await this.getAccountsSummary(userId, targetCurrency)

    const totalAssets = accounts.reduce((sum, acc) => sum + acc.totalValue, 0)
    const totalCash = accounts.reduce((sum, acc) => sum + acc.cashBalance, 0)

    // ... 其他计算

    return {
      totalAssets,
      totalCash,
      // ...
      targetCurrency,
    }
  }
}
```

---

### 4. API层改造

**Dashboard API 支持货币参数**：

```typescript
// src/app/api/dashboard/route.ts

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授权访问' }, { status: 401 })
  }

  const userId = session.user.id
  
  // 获取用户货币偏好
  const userPref = await prisma.userPreference.findUnique({
    where: { userId }
  })
  
  const targetCurrency = userPref?.baseCurrency || 'CNY'

  // 使用目标货币计算所有数据
  const overview = await PortfolioService.calculatePortfolioOverview(
    userId, 
    targetCurrency
  )
  
  const accountsSummary = await PortfolioService.getAccountsSummary(
    userId, 
    targetCurrency
  )

  // ... 其他数据

  return NextResponse.json({
    overview,
    accounts: accountsSummary,
    targetCurrency,
    // ...
  })
}
```

---

### 5. 前端组件改造

**货币切换器组件**：

```typescript
// src/components/currency/currency-switcher.tsx

export function CurrencySwitcher() {
  const { baseCurrency, setBaseCurrency } = useCurrency()
  
  const currencies = [
    { code: 'CNY', name: '人民币', symbol: '¥' },
    { code: 'USD', name: '美元', symbol: '$' },
    { code: 'HKD', name: '港币', symbol: 'HK$' },
  ]

  const handleSwitch = async (currency: string) => {
    // 保存偏好到后端
    await fetch('/api/user/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ baseCurrency: currency })
    })
    
    // 更新本地状态
    setBaseCurrency(currency)
    
    // 刷新页面数据
    window.location.reload()
  }

  return (
    <Select value={baseCurrency} onValueChange={handleSwitch}>
      {currencies.map(c => (
        <SelectItem key={c.code} value={c.code}>
          {c.symbol} {c.name}
        </SelectItem>
      ))}
    </Select>
  )
}
```

**金额显示组件**：

```typescript
// src/components/currency/currency-amount.tsx

export function CurrencyAmount({ 
  amount, 
  currency,
  showOriginal = false 
}: Props) {
  const { baseCurrency } = useCurrency()
  
  // 如果显示原币值
  if (showOriginal) {
    return (
      <div>
        <span className="font-bold">
          {formatCurrency(amount, currency)}
        </span>
        {currency !== baseCurrency && (
          <span className="text-sm text-muted">
            ≈ {formatCurrency(convertedAmount, baseCurrency)}
          </span>
        )}
      </div>
    )
  }

  // 否则只显示目标货币
  return (
    <span className="font-bold">
      {formatCurrency(amount, baseCurrency)}
    </span>
  )
}
```

---

## 🔄 数据流示例

### 场景：显示中银国际账户总值（HKD账户）

#### 1. **数据库层**（原子数据）
```sql
-- holding表
quantity: 1930
currentPrice: 450.00 (HKD)
currency: HKD

-- account_balance表
cashBalanceOriginal: 100000 (HKD)
currency: HKD
```

#### 2. **服务层**（汇率转换）
```typescript
// 用户选择：CNY视角

// 持仓市值计算
holdingsValueOriginal = 1930 * 450 = 868,500 HKD
holdingsValueCNY = await CurrencyService.convert(868500, 'HKD', 'CNY')
// = 868,500 * 0.92 = 799,020 CNY

// 现金余额转换
cashBalanceCNY = await CurrencyService.convert(100000, 'HKD', 'CNY')
// = 100,000 * 0.92 = 92,000 CNY

// 账户总值
totalValue = 799,020 + 92,000 = 891,020 CNY
```

#### 3. **API层**（返回目标货币）
```json
{
  "accounts": [
    {
      "id": "xxx",
      "name": "中银国际",
      "currency": "HKD",
      "holdingsValue": 799020,
      "holdingsValueOriginal": 868500,
      "cashBalance": 92000,
      "cashBalanceOriginal": 100000,
      "totalValue": 891020,
      "targetCurrency": "CNY"
    }
  ]
}
```

#### 4. **前端层**（展示）
```tsx
<AccountCard>
  <h3>中银国际</h3>
  <p className="text-xl">¥891,020</p>
  <p className="text-sm text-muted">
    原值: HK$968,500
  </p>
</AccountCard>
```

---

## 📊 架构对比

### 修复前 ❌

```
[数据库]
  └─ Holding.marketValueCny (存储CNY值，可能过期)
  └─ AccountBalance.exchangeRate (快照汇率，不同步)

[服务层]
  └─ 使用过期的exchangeRate计算
  └─ 硬编码汇率值 (USD: 7.2, HKD: 0.92)

[API层]
  └─ 返回不一致的CNY值

[前端]
  └─ 假设所有金额都是CNY
  └─ 无法切换货币视角
```

### 修复后 ✅

```
[数据库]
  └─ Holding: quantity, currentPrice, currency (原币值)
  └─ SystemConfig.EXCHANGE_RATES (实时汇率)

[服务层]
  └─ CurrencyService (统一汇率管理)
  └─ PortfolioService (使用CurrencyService转换)

[API层]
  └─ 接收targetCurrency参数
  └─ 返回统一转换后的金额

[前端]
  └─ useCurrency() Hook
  └─ CurrencySwitcher 组件
  └─ CurrencyAmount 组件
```

---

## 🚀 实施计划

### Phase 1: 基础架构 (1-2天)
- [ ] 创建 `CurrencyService`
- [ ] 扩展 `UserPreference` 表
- [ ] 创建 `useCurrency` Hook
- [ ] 创建 `CurrencyContext`

### Phase 2: 服务层改造 (2-3天)
- [ ] 重构 `PortfolioService.getAccountsSummary`
- [ ] 重构 `PortfolioService.calculatePortfolioOverview`
- [ ] 重构 `PortfolioService.getPortfolioByAccount`
- [ ] 添加单元测试

### Phase 3: API层改造 (1-2天)
- [ ] Dashboard API支持货币参数
- [ ] Holdings API支持货币参数
- [ ] 添加货币偏好API

### Phase 4: 前端组件 (2-3天)
- [ ] 创建 `CurrencySwitcher` 组件
- [ ] 创建 `CurrencyAmount` 组件
- [ ] 改造 Dashboard 页面
- [ ] 改造 Holdings 页面

### Phase 5: 测试与优化 (1-2天)
- [ ] 端到端测试
- [ ] 性能优化（批量转换）
- [ ] 边界条件处理
- [ ] 文档完善

---

## 📈 性能优化

### 1. 汇率缓存策略

```typescript
// 内存缓存（5分钟）
class CurrencyService {
  private static ratesCache: ExchangeRates | null = null
  private static cacheTime: number = 0
  private static CACHE_TTL = 5 * 60 * 1000 // 5分钟

  static async getLatestRates(): Promise<ExchangeRates> {
    const now = Date.now()
    
    // 使用内存缓存
    if (this.ratesCache && (now - this.cacheTime) < this.CACHE_TTL) {
      return this.ratesCache
    }

    // 从数据库读取
    const cached = await prisma.systemConfig.findUnique({
      where: { configKey: 'EXCHANGE_RATES' }
    })

    if (cached) {
      this.ratesCache = cached.configValue as ExchangeRates
      this.cacheTime = now
      return this.ratesCache
    }

    // 返回默认值
    return DEFAULT_RATES
  }
}
```

### 2. 批量转换优化

```typescript
// 避免重复查询汇率
const items = [
  { amount: 1000, from: 'HKD' },
  { amount: 2000, from: 'USD' },
  { amount: 3000, from: 'HKD' },
]

// ❌ 低效：每次转换都查询汇率
for (const item of items) {
  const converted = await CurrencyService.convert(item.amount, item.from, 'CNY')
}

// ✅ 高效：批量转换
const converted = await CurrencyService.convertBatch(items, 'CNY')
```

---

## 🔒 数据一致性保证

### 1. 汇率更新策略

```typescript
// 汇率更新时，触发数据重算
export async function POST(request: NextRequest) {
  // 更新汇率
  const rates = await fetchLiveExchangeRates()
  
  await prisma.systemConfig.upsert({
    where: { configKey: 'EXCHANGE_RATES' },
    update: { configValue: rates },
    create: { configKey: 'EXCHANGE_RATES', configValue: rates }
  })

  // 清除缓存
  CurrencyService.clearCache()

  // 触发前端刷新（可选）
  // await notifyClients('exchange-rates-updated')

  return NextResponse.json({ success: true })
}
```

### 2. 事务处理

```typescript
// 转移持仓时同步更新汇率
await prisma.$transaction(async (tx) => {
  // 1. 更新源持仓
  await tx.holding.update({ ... })

  // 2. 更新目标持仓
  await tx.holding.create({ ... })

  // 3. 获取最新汇率
  const rates = await CurrencyService.getLatestRates()

  // 4. 使用统一汇率计算
  // ...
})
```

---

## 🎯 预期效果

### 解决的问题

1. ✅ **统一汇率管理**
   - 单一数据源
   - 自动同步
   - 实时更新

2. ✅ **灵活货币视角**
   - 支持CNY/USD/HKD切换
   - 用户偏好持久化
   - 所有模块统一应用

3. ✅ **数据一致性**
   - 原子数据存储
   - 统一转换逻辑
   - 消除硬编码

4. ✅ **可扩展性**
   - 易于添加新货币
   - 支持历史汇率
   - 支持多种汇率源

### 用户体验提升

- 🎨 货币切换器（一键切换视角）
- 📊 双货币显示（原币 + 目标货币）
- 🔄 实时汇率更新
- ⚡ 性能优化（批量转换）

---

## 📝 代码迁移指南

### 查找需要修改的代码

```bash
# 查找硬编码的汇率
grep -r "7\.2\|0\.92" src/

# 查找marketValueCny直接使用
grep -r "marketValueCny" src/

# 查找exchangeRate字段使用
grep -r "exchangeRate" src/
```

### 迁移模式

#### 旧代码模式 ❌
```typescript
// 硬编码汇率
const usdRate = 7.2
const hkdRate = 0.92

// 直接使用marketValueCny
const value = holding.marketValueCny

// 从快照读取汇率
const rate = balance.exchangeRate || 1
```

#### 新代码模式 ✅
```typescript
// 使用CurrencyService
const rate = await CurrencyService.getRate('HKD', 'CNY')

// 原币计算 + 转换
const valueOriginal = holding.quantity * holding.currentPrice
const valueCNY = await CurrencyService.convert(
  valueOriginal, 
  holding.account.currency, 
  'CNY'
)

// 批量转换
const rates = await CurrencyService.getLatestRates()
const converted = CurrencyService.convertBatch(items, 'CNY')
```

---

## 📚 API文档

### CurrencyService API

```typescript
class CurrencyService {
  // 获取最新汇率
  static async getLatestRates(): Promise<ExchangeRates>

  // 获取特定货币对汇率
  static async getRate(from: string, to: string): Promise<number>

  // 转换金额
  static async convert(amount: number, from: string, to: string): Promise<number>

  // 批量转换
  static async convertBatch(
    items: Array<{ amount: number; from: string }>,
    to: string
  ): Promise<number[]>

  // 格式化金额显示
  static formatAmount(amount: number, currency: string): string

  // 获取货币符号
  static getSymbol(currency: string): string

  // 清除缓存
  static clearCache(): void
}
```

### useCurrency Hook

```typescript
interface CurrencyContextValue {
  baseCurrency: 'CNY' | 'USD' | 'HKD'
  setBaseCurrency: (currency: string) => Promise<void>
  exchangeRates: ExchangeRates | null
  convert: (amount: number, from: string) => number
  formatAmount: (amount: number, currency: string) => string
}

const useCurrency = (): CurrencyContextValue
```

---

## 🔍 监控与日志

### 关键指标

```typescript
// 汇率转换监控
logger.info('Currency conversion', {
  from: 'HKD',
  to: 'CNY',
  amount: 1000,
  rate: 0.92,
  result: 920,
  source: 'cache', // cache | database | api | fallback
  duration: 5, // ms
})

// 性能监控
logger.info('Batch conversion', {
  itemCount: 100,
  targetCurrency: 'CNY',
  duration: 15, // ms
  cacheHit: true,
})
```

---

## ✅ 总结

### 核心改进

1. **统一汇率管理** - CurrencyService
2. **灵活货币视角** - 用户偏好 + Context
3. **清晰的数据流** - 原币 → 转换 → 展示
4. **高性能** - 缓存 + 批量转换
5. **可扩展** - 易于添加新货币/汇率源

### 下一步

1. 开始Phase 1实施
2. 创建CurrencyService
3. 编写单元测试
4. 逐步迁移现有代码

---

**文档版本**: v1.0  
**创建时间**: 2026-01-25  
**作者**: AI Assistant
