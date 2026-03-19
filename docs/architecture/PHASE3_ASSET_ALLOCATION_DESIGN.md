# Phase 3: 智能资产配置目标系统设计

## 🎯 系统目标

创建一个智能的资产配置目标管理系统，核心特性：

1. **细化到二级分类** - 不仅支持6大类目标，还支持20+二级分类的精细化目标
2. **AI 投资顾问 Sub-Agent** - 结合家庭情况和宏观环境，给出专业配置建议
3. **实时对比分析** - 当前配置 vs 目标配置的可视化对比
4. **偏离告警** - 超出阈值自动提醒

---

## 📊 数据模型设计

### 1. 用户配置目标表 (UserAllocationTarget)

```prisma
model UserAllocationTarget {
  id              String   @id @default(uuid())
  userId          String
  categoryCode    String   // 资产分类代码 (如 EQUITY, CASH_DEMAND)
  targetPercent   Decimal  @db.Decimal(5, 2)  // 目标占比 (0-100)
  minPercent      Decimal? @db.Decimal(5, 2)  // 允许最低占比
  maxPercent      Decimal? @db.Decimal(5, 2)  // 允许最高占比
  alertThreshold  Decimal? @db.Decimal(5, 2)  // 偏离告警阈值 (默认5%)
  priority        Int      @default(0)        // 调仓优先级 (0=低, 1=中, 2=高)
  notes           String?                     // 备注
  isActive        Boolean  @default(true)     // 是否启用
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user            User     @relation(fields: [userId], references: [id])
  category        AssetCategory @relation(fields: [categoryCode], references: [code])
  
  @@unique([userId, categoryCode])
  @@index([userId])
  @@map("user_allocation_targets")
}
```

### 2. 家庭财务状况表 (FamilyFinancialProfile)

```prisma
model FamilyFinancialProfile {
  id                    String   @id @default(uuid())
  userId                String   @unique
  
  // 基本信息
  householdMembers      Int      @default(1)        // 家庭成员数
  primaryEarnerAge      Int?                        // 主要收入者年龄
  dependentsCount       Int      @default(0)        // 受抚养人数
  
  // 收入情况
  monthlyIncome         Decimal? @db.Decimal(15, 2) // 家庭月收入
  incomeStability       String?  // VERY_STABLE/STABLE/VARIABLE/UNSTABLE
  monthlyExpenses       Decimal? @db.Decimal(15, 2) // 月支出
  emergencyFundMonths   Int      @default(6)        // 应急资金月数目标
  
  // 风险偏好
  riskTolerance         String   @default("MODERATE") // CONSERVATIVE/MODERATE/AGGRESSIVE/VERY_AGGRESSIVE
  investmentHorizon     String   @default("MEDIUM")   // SHORT(<3年)/MEDIUM(3-10年)/LONG(>10年)
  
  // 财务目标
  retirementAge         Int?                        // 计划退休年龄
  majorGoals            Json?                       // 重大财务目标 [{name, targetAmount, targetDate}]
  
  // 负债情况
  hasHomeLoan           Boolean  @default(false)
  homeLoanMonthlyPayment Decimal? @db.Decimal(15, 2)
  hasCarLoan            Boolean  @default(false)
  hasOtherLoans         Boolean  @default(false)
  
  // 保障情况
  hasLifeInsurance      Boolean  @default(false)
  hasHealthInsurance    Boolean  @default(false)
  hasCriticalIllnessInsurance Boolean @default(false)
  
  // 更新时间
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  user                  User     @relation(fields: [userId], references: [id])
  
  @@map("family_financial_profiles")
}
```

### 3. AI 建议记录表 (AllocationAdvice)

```prisma
model AllocationAdvice {
  id              String   @id @default(uuid())
  userId          String
  
  // 建议内容
  advice          Json     // 详细建议 JSON
  summary         String   @db.Text  // 摘要
  confidence      Decimal  @db.Decimal(3, 2)  // 置信度 (0-1)
  
  // 环境因素
  marketContext   Json?    // 市场环境分析
  familyContext   Json?    // 家庭情况分析
  
  // 状态
  status          String   @default("PENDING") // PENDING/ACCEPTED/REJECTED/PARTIAL
  userFeedback    String?  @db.Text  // 用户反馈
  
  createdAt       DateTime @default(now())
  expiresAt       DateTime // 建议有效期
  
  user            User     @relation(fields: [userId], references: [id])
  
  @@index([userId, createdAt])
  @@map("allocation_advices")
}
```

---

## 🤖 资产配置顾问 Sub-Agent 设计

### Agent 定义文件

**位置**: `.codebuddy/agents/asset-allocation-advisor.md`

```markdown
# Asset Allocation Advisor

## 角色定义
你是一位专业的家庭资产配置顾问，具有CFP（注册理财规划师）资质，
拥有20年以上的财富管理经验。你的职责是根据客户的家庭财务状况、
风险承受能力和当前市场环境，提供个性化的资产配置建议。

## 专业背景
- 熟悉中国大陆、香港、美国市场
- 精通多元资产配置理论（现代投资组合理论、风险平价策略等）
- 了解税务优化和遗产规划
- 关注宏观经济和政策变化

## 输入信息
1. **家庭财务概况**
   - 家庭成员和收入结构
   - 资产和负债情况
   - 月支出和储蓄率
   
2. **当前资产配置**
   - 各类资产的市值和占比
   - 按地区分布
   - 按风险等级分布

3. **风险偏好**
   - 风险承受能力评估
   - 投资期限
   - 流动性需求

4. **市场环境** (可选)
   - 当前经济周期阶段
   - 主要市场估值水平
   - 利率和通胀预期

## 输出格式

### 1. 配置建议摘要
简明扼要的3-5点核心建议。

### 2. 详细配置目标
```json
{
  "targets": [
    {
      "category": "EQUITY",
      "subcategories": [
        {"code": "EQUITY_STOCK", "targetPercent": 25, "reason": "..."}
      ],
      "totalTargetPercent": 40,
      "minPercent": 35,
      "maxPercent": 45,
      "rationale": "..."
    }
  ]
}
```

### 3. 调仓建议
具体的增持/减持建议，按优先级排序。

### 4. 风险提示
关键风险和应对措施。

### 5. 下次复盘建议
建议的复盘时间和关注点。

## 工作原则
1. **保守原则**: 宁可错过机会，不可承担过高风险
2. **分散原则**: 不把鸡蛋放在一个篮子里
3. **流动性原则**: 保持足够的应急资金
4. **个性化原则**: 配置方案因人而异
5. **动态调整原则**: 随生命周期和市场变化调整
```

### Agent 工具接口

Sub-Agent 可调用的工具：

```typescript
// 1. 获取当前资产配置
interface GetCurrentAllocation {
  input: { userId: string }
  output: {
    totalAssets: number
    netWorth: number
    allocation: Array<{
      categoryCode: string
      categoryName: string
      value: number
      percent: number
      riskLevel: string
    }>
    byRegion: Array<{ region: string; percent: number }>
    byRiskLevel: Array<{ level: string; percent: number }>
  }
}

// 2. 获取家庭财务概况
interface GetFamilyProfile {
  input: { userId: string }
  output: FamilyFinancialProfile | null
}

// 3. 获取历史配置趋势
interface GetAllocationHistory {
  input: { userId: string; days: number }
  output: Array<{
    date: string
    allocation: Record<string, number>
  }>
}

// 4. 保存配置建议
interface SaveAllocationAdvice {
  input: {
    userId: string
    advice: AllocationAdvice
  }
  output: { success: boolean; adviceId: string }
}

// 5. 获取市场数据 (可选)
interface GetMarketContext {
  input: {}
  output: {
    economicCycle: string  // EXPANSION/PEAK/CONTRACTION/TROUGH
    interestRateTrend: string  // RISING/STABLE/FALLING
    inflationLevel: string  // LOW/MODERATE/HIGH
    majorIndices: Array<{ name: string; pe: number; trend: string }>
  }
}
```

---

## 🖥️ API 设计

### 1. 配置目标 CRUD

```typescript
// GET /api/allocation/targets
// 获取用户的资产配置目标
interface GetAllocationTargetsResponse {
  targets: Array<{
    categoryCode: string
    categoryName: string
    level: number  // 1=一级分类, 2=二级分类
    parentCode?: string
    targetPercent: number
    minPercent: number
    maxPercent: number
    alertThreshold: number
    isActive: boolean
  }>
  lastUpdated: string
}

// PUT /api/allocation/targets
// 批量更新配置目标
interface UpdateAllocationTargetsRequest {
  targets: Array<{
    categoryCode: string
    targetPercent: number
    minPercent?: number
    maxPercent?: number
    alertThreshold?: number
  }>
}

// POST /api/allocation/targets/reset
// 重置为默认配置（基于数据库的 suggestedMinPercent/suggestedMaxPercent）
```

### 2. 配置分析

```typescript
// GET /api/allocation/analysis
// 获取当前配置与目标的对比分析
interface AllocationAnalysisResponse {
  analysis: Array<{
    categoryCode: string
    categoryName: string
    currentValue: number
    currentPercent: number
    targetPercent: number
    deviation: number  // 偏离度 (currentPercent - targetPercent)
    deviationStatus: 'NORMAL' | 'WARNING' | 'CRITICAL'
    suggestedAction: 'HOLD' | 'BUY' | 'SELL' | 'REBALANCE'
    suggestedAmount: number  // 建议调整金额
  }>
  overallScore: number  // 配置健康度评分 (0-100)
  alerts: Array<{
    type: 'OVERWEIGHT' | 'UNDERWEIGHT' | 'MISSING_CATEGORY'
    categoryCode: string
    message: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
  }>
  lastUpdated: string
}
```

### 3. AI 建议

```typescript
// POST /api/allocation/ai-advice
// 请求 AI 配置建议
interface RequestAIAdviceRequest {
  includeMarketContext?: boolean  // 是否包含市场环境分析
  focusCategories?: string[]      // 重点关注的分类
  userNotes?: string              // 用户补充说明
}

interface RequestAIAdviceResponse {
  adviceId: string
  summary: string
  confidence: number
  targets: Array<{
    categoryCode: string
    currentPercent: number
    suggestedPercent: number
    reason: string
  }>
  actions: Array<{
    priority: number
    category: string
    action: 'BUY' | 'SELL' | 'HOLD'
    amount?: number
    reason: string
  }>
  risks: string[]
  nextReviewDate: string
  fullAnalysis: string  // 完整分析文本
}

// PUT /api/allocation/ai-advice/:id/feedback
// 用户反馈
interface AdviceFeedbackRequest {
  status: 'ACCEPTED' | 'REJECTED' | 'PARTIAL'
  feedback?: string
  appliedChanges?: Array<{ categoryCode: string; newTarget: number }>
}
```

### 4. 家庭财务概况

```typescript
// GET /api/family-profile
// PUT /api/family-profile
// 管理家庭财务概况（用于 AI 建议）
```

---

## 🎨 UI 设计

### 1. 配置目标管理页面

```
┌─────────────────────────────────────────────────────────────────┐
│  资产配置目标管理                              [请求AI建议] [保存] │
├─────────────────────────────────────────────────────────────────┤
│  配置健康度评分: 78/100  [██████████░░░]                         │
│                                                                  │
│  ┌── 一级分类目标 ─────────────────────────────────────────────┐ │
│  │                                                              │ │
│  │  [现金] ████████████░░░░░░░░░░ 12%  目标: 10%  偏离: +2%    │ │
│  │  [权益] ████████████████████░░ 45%  目标: 40%  偏离: +5% ⚠️  │ │
│  │  [固收] ████████░░░░░░░░░░░░░░ 18%  目标: 25%  偏离: -7% ⚠️  │ │
│  │  [基金] ██████░░░░░░░░░░░░░░░░ 15%  目标: 15%  偏离: 0%     │ │
│  │  [不动产] ████░░░░░░░░░░░░░░░░ 8%   目标: 10%  偏离: -2%    │ │
│  │  [另类] ██░░░░░░░░░░░░░░░░░░░░ 2%   目标: 0%   偏离: +2%    │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌── 二级分类细化 (展开: 权益类) ──────────────────────────────┐ │
│  │                                                              │ │
│  │  [股票]     ████████████████░░ 35%  目标: 30%  偏离: +5%    │ │
│  │  [私募股权] ████░░░░░░░░░░░░░░ 8%   目标: 5%   偏离: +3%    │ │
│  │  [期权]     ██░░░░░░░░░░░░░░░░ 2%   目标: 5%   偏离: -3%    │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌── 告警列表 ──────────────────────────────────────────────────┐ │
│  │  🔴 权益类资产占比偏高 (+5%)，建议适当减仓                    │ │
│  │  🟡 固收类资产不足，建议增配债券或理财产品                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2. AI 建议对话框

```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 AI 资产配置建议                                      [关闭] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  基于您的家庭财务状况和当前市场环境，我为您提供以下配置建议：     │
│                                                                  │
│  📊 核心建议                                                     │
│  ────────────────────────────────────────────────────────────── │
│  1. 适当降低股票仓位，从35%减至30%，锁定部分收益                 │
│  2. 增配债券型基金，利率下行周期有利于债券价格                   │
│  3. 保持6个月应急资金，当前仅4.5个月，建议补充                   │
│                                                                  │
│  📈 具体调整方案                                                 │
│  ────────────────────────────────────────────────────────────── │
│  │ 分类     │ 当前  │ 建议  │ 调整  │ 金额(估)  │                │
│  │──────────│───────│───────│───────│───────────│                │
│  │ 股票     │ 35%   │ 30%   │ -5%   │ -¥30万    │                │
│  │ 债券基金 │ 8%    │ 15%   │ +7%   │ +¥42万    │                │
│  │ 现金     │ 10%   │ 12%   │ +2%   │ +¥12万    │                │
│                                                                  │
│  ⚠️ 风险提示                                                     │
│  ────────────────────────────────────────────────────────────── │
│  - 当前股票估值处于历史中位数上方，回调风险较大                  │
│  - 经济复苏不确定性仍存在                                        │
│                                                                  │
│  置信度: 85%  |  建议复盘时间: 2026年4月                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  [采纳建议并应用]    [部分采纳]    [暂不采纳]    [提供反馈]  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 文件结构

```
src/
├── app/
│   └── api/
│       └── allocation/
│           ├── targets/
│           │   └── route.ts           # 配置目标 CRUD
│           ├── analysis/
│           │   └── route.ts           # 配置分析
│           ├── ai-advice/
│           │   ├── route.ts           # AI 建议
│           │   └── [id]/
│           │       └── feedback/
│           │           └── route.ts   # 反馈
│           └── family-profile/
│               └── route.ts           # 家庭概况
│
├── components/
│   └── allocation/
│       ├── allocation-target-card.tsx     # 单个分类目标卡片
│       ├── allocation-overview.tsx        # 配置概览
│       ├── allocation-comparison-chart.tsx # 对比图表
│       ├── deviation-alert-list.tsx       # 偏离告警列表
│       ├── ai-advice-dialog.tsx           # AI 建议对话框
│       ├── family-profile-form.tsx        # 家庭概况表单
│       └── target-editor.tsx              # 目标编辑器
│
├── lib/
│   └── services/
│       ├── allocation-service.ts          # 配置分析服务
│       └── ai-advisor-service.ts          # AI 顾问服务
│
└── types/
    └── allocation.ts                      # 类型定义

.codebuddy/
└── agents/
    └── asset-allocation-advisor.md        # AI 顾问 Agent 定义

prisma/
└── schema.prisma                          # 新增表定义
```

---

## 🚀 实现计划

### Phase 3.1: 数据模型和API (1天)
- [x] 设计完成
- [ ] 更新 Prisma Schema
- [ ] 实现基础 API

### Phase 3.2: Sub-Agent 创建 (1天)
- [ ] 创建 Agent 定义文件
- [ ] 实现 AI 调用接口
- [ ] 测试 Agent 功能

### Phase 3.3: 目标管理 UI (1天)
- [ ] 配置目标编辑器
- [ ] 家庭概况表单

### Phase 3.4: 分析和对比 (1天)
- [ ] 配置分析服务
- [ ] 对比可视化

### Phase 3.5: 告警机制 (0.5天)
- [ ] 偏离检测
- [ ] 告警展示

---

## ✅ 成功标准

1. ✅ 用户可以设置和管理6大类+20+二级分类的配置目标
2. ✅ AI 顾问能根据家庭情况给出个性化建议
3. ✅ 实时显示当前配置与目标的偏离
4. ✅ 超出阈值自动告警
5. ✅ 建议可追溯、可反馈
