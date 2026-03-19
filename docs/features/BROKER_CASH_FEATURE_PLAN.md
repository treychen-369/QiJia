# 券商账户现金余额功能实施计划

## ✅ 实施完成状态（2026-01-31）

### 已完成的工作

#### Phase 1: 数据库Schema更新 ✅
- 在 `InvestmentAccount` 模型中新增了4个字段：
  - `cashBalance` - 现金余额（原币种）
  - `cashBalanceCny` - 现金余额（CNY换算）
  - `cashExchangeRate` - 汇率
  - `cashLastUpdated` - 最后更新时间
- 执行了 `prisma db push` 和 `prisma generate`

#### Phase 2: 服务层更新 ✅
- 新增方法：`updateAccountCashBalance()` - 更新账户现金余额
- 修改方法：`calculateAccountTotalValue()` - 从账户表获取现金
- 修改方法：`getAccountsSummary()` - 返回完整的账户现金信息
- 修改方法：`getPortfolioByAssetType()` - 券商现金从账户表获取
- 更新类型：`AccountSummary` 增加了新字段

#### Phase 3: API更新 ✅
- 新增：`/api/accounts/[id]/cash` - GET/PUT 现金余额
- 修改：`/api/dashboard` - 返回账户的完整现金信息

#### Phase 4: 前端更新 ✅
- 新增：`EditCashBalanceDialog` 组件（备用）
- 修改：`handleSaveCash()` 方法调用新API
- 现有的 `EditCashDialog` 组件继续使用

---

## 📋 需求确认

根据用户决策：
1. **数据来源**：手动输入
2. **现金资产Tab定位**：只管理银行存款和货币基金（不含券商现金）
3. **账户总市值定义**：持仓市值 + 账户现金

---

## 🎯 目标

在证券账户视图中，将现金余额与持仓统一展示，如下图：

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 长桥港股账户                                                   │
│ 1 只股票 • 总市值 HK$553,426.02               ≈ ¥494,130.37  ∧  │
├─────────────────────────────────────────────────────────────────┤
│ 💰 现金余额                                                      │
│    HKD                        HK$8,026.02    ≈ ¥7,166.09        │
├─────────────────────────────────────────────────────────────────┤
│ 📈 腾讯控股   0700   香港                                         │
│    持仓 900  成本 HK$654.11  现价 HK$606                          │
│                     HK$545,400    -¥38,660.63  ↗ +0.00%         │
│                     ≈ ¥486,964.29 • 市值 -7.36%                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 架构影响分析

### 当前架构

```
InvestmentAccount (无现金字段)
     │
     ├── Holding[] (持仓)
     │
     └── AccountBalance[] (快照，含 cashBalanceOriginal)
```

### 目标架构

```
InvestmentAccount (新增现金字段)
     │
     ├── cashBalance (实时现金余额) ← 新增
     ├── cashBalanceCny (CNY换算) ← 新增
     │
     ├── Holding[] (持仓，不变)
     │
     └── AccountBalance[] (快照，保留，用于历史)
```

---

## 🛡️ 安全改造原则

### ✅ 允许的操作
1. **新增字段** - 不影响现有数据
2. **新增方法** - 不修改现有方法签名
3. **扩展返回值** - 向后兼容

### ❌ 禁止的操作
1. **删除字段** - 可能破坏现有功能
2. **修改核心计算方法** - `calculateHoldingDetails` 保持不变
3. **改变API返回结构** - 只能扩展，不能修改

---

## 📋 实施步骤

### Phase 1: 数据库Schema更新

**文件**: `prisma/schema.prisma`

```prisma
model InvestmentAccount {
  // ... 现有字段保持不变 ...
  
  // ✨ 新增：现金余额字段
  cashBalance        Decimal   @default(0) @map("cash_balance") @db.Decimal(15, 2)
  cashBalanceCny     Decimal?  @map("cash_balance_cny") @db.Decimal(15, 2)
  cashExchangeRate   Decimal?  @default(1) @map("cash_exchange_rate") @db.Decimal(10, 6)
  cashLastUpdated    DateTime? @map("cash_last_updated")
}
```

**执行命令**:
```bash
npx prisma db push
npx prisma generate
```

**验证**:
- [ ] 现有数据不受影响
- [ ] 新字段默认值为0
- [ ] Prisma Client 正常生成

---

### Phase 2: 服务层扩展

**文件**: `src/lib/services/portfolio-service.ts`

#### 2.1 新增方法：更新账户现金余额

```typescript
/**
 * 更新账户现金余额
 * @param accountId 账户ID
 * @param cashBalance 现金余额（原币种）
 */
static async updateAccountCashBalance(
  accountId: string, 
  cashBalance: number
): Promise<InvestmentAccount> {
  const account = await prisma.investmentAccount.findUnique({
    where: { id: accountId }
  });
  
  if (!account) {
    throw new Error(`账户不存在: ${accountId}`);
  }
  
  // 获取汇率
  let exchangeRate = 1;
  if (account.currency !== 'CNY') {
    exchangeRate = await exchangeRateService.getRate(account.currency, 'CNY');
  }
  
  const cashBalanceCny = cashBalance * exchangeRate;
  
  return prisma.investmentAccount.update({
    where: { id: accountId },
    data: {
      cashBalance,
      cashBalanceCny,
      cashExchangeRate: exchangeRate,
      cashLastUpdated: new Date()
    }
  });
}
```

#### 2.2 修改方法：获取账户汇总（最小改动）

```typescript
// 在 getAccountsSummary 方法中
// 修改：从账户表直接获取现金，而非从快照

static async getAccountsSummary(userId: string) {
  const accounts = await prisma.investmentAccount.findMany({
    where: { userId, isActive: true },
    include: {
      broker: true,
      holdings: {
        include: { security: true }
      }
    }
  });
  
  const result = [];
  
  for (const account of accounts) {
    // 计算持仓市值
    let holdingsValue = 0;
    let holdingsValueCny = 0;
    
    const exchangeRate = await exchangeRateService.getRate(account.currency, 'CNY');
    
    for (const holding of account.holdings) {
      const calculated = this.calculateHoldingDetails({
        quantity: Number(holding.quantity),
        averageCost: Number(holding.averageCost),
        currentPrice: Number(holding.currentPrice || 0)
      }, exchangeRate);
      
      holdingsValue += calculated.marketValueOriginal;
      holdingsValueCny += calculated.marketValueCny;
    }
    
    // ✨ 修改：从账户表获取现金余额
    const cashBalance = Number(account.cashBalance) || 0;
    const cashBalanceCny = cashBalance * exchangeRate;
    
    // 账户总市值 = 持仓 + 现金
    const totalValue = holdingsValue + cashBalance;
    const totalValueCny = holdingsValueCny + cashBalanceCny;
    
    result.push({
      id: account.id,
      accountName: account.accountName,
      broker: account.broker?.name,
      currency: account.currency,
      holdingCount: account.holdings.length,
      
      // 持仓相关
      holdingsValue,
      holdingsValueCny,
      
      // ✨ 新增：现金相关
      cashBalance,
      cashBalanceCny,
      
      // 账户总市值
      totalValue,
      totalValueCny,
      
      exchangeRate
    });
  }
  
  return result;
}
```

#### 2.3 修改方法：投资组合概览（券商现金部分）

```typescript
// 在 calculatePortfolioOverview 方法中
// 修改券商现金的获取逻辑

// 旧逻辑（从快照获取）：
// const latestBalance = await prisma.accountBalance.findFirst(...)
// brokerCash += Number(latestBalance?.cashBalanceCny || 0);

// ✨ 新逻辑（从账户表获取）：
let totalBrokerCash = 0;
for (const account of accounts) {
  const cashBalance = Number(account.cashBalance) || 0;
  const exchangeRate = await exchangeRateService.getRate(account.currency, 'CNY');
  totalBrokerCash += cashBalance * exchangeRate;
}
```

---

### Phase 3: API 扩展

#### 3.1 新增：更新现金余额 API

**文件**: `src/app/api/accounts/[id]/cash/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PortfolioService } from '@/lib/services/portfolio-service';

// PUT /api/accounts/[id]/cash - 更新账户现金余额
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }
    
    const { cashBalance } = await request.json();
    
    if (typeof cashBalance !== 'number' || cashBalance < 0) {
      return NextResponse.json({ error: '无效的现金余额' }, { status: 400 });
    }
    
    const updated = await PortfolioService.updateAccountCashBalance(
      params.id,
      cashBalance
    );
    
    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        cashBalance: Number(updated.cashBalance),
        cashBalanceCny: Number(updated.cashBalanceCny),
        cashLastUpdated: updated.cashLastUpdated
      }
    });
    
  } catch (error) {
    console.error('[API错误] 更新现金余额:', error);
    return NextResponse.json(
      { error: '更新失败' },
      { status: 500 }
    );
  }
}

// GET /api/accounts/[id]/cash - 获取账户现金余额
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }
    
    const account = await prisma.investmentAccount.findUnique({
      where: { id: params.id, userId: session.user.id }
    });
    
    if (!account) {
      return NextResponse.json({ error: '账户不存在' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        cashBalance: Number(account.cashBalance),
        cashBalanceCny: Number(account.cashBalanceCny),
        currency: account.currency,
        lastUpdated: account.cashLastUpdated
      }
    });
    
  } catch (error) {
    console.error('[API错误] 获取现金余额:', error);
    return NextResponse.json(
      { error: '获取失败' },
      { status: 500 }
    );
  }
}
```

#### 3.2 修改：Dashboard API 扩展账户数据

**文件**: `src/app/api/dashboard/route.ts`

在账户摘要中增加现金余额字段（向后兼容）：

```typescript
// accounts 数组中每个账户增加：
{
  // ... 现有字段 ...
  cashBalance: number,      // ✨ 新增：原币种现金
  cashBalanceCny: number,   // ✨ 新增：CNY现金
}
```

---

### Phase 4: 前端组件扩展

#### 4.1 修改：holdings-list.tsx

**现金余额行的数据来源修改**：

```typescript
// 旧逻辑：从 allHoldings 中筛选 type='cash' 的项
// 新逻辑：从账户摘要中获取 cashBalance

// 在 holdingsByAccount 分组时：
const holdingsByAccount = useMemo(() => {
  const groups: Record<string, AccountGroup> = {};
  
  // 先从 accounts 数据初始化（包含现金）
  for (const account of dashboardData.accounts) {
    groups[account.accountName] = {
      accountId: account.id,
      broker: account.broker,
      currency: account.currency,
      holdings: [],
      cashBalance: account.cashBalance,      // ✨ 从账户数据获取
      cashBalanceCny: account.cashBalanceCny,
      totalValue: account.totalValue,
      totalValueCny: account.totalValueCny
    };
  }
  
  // 再填充持仓
  for (const holding of filteredHoldings) {
    const key = holding.accountName;
    if (groups[key]) {
      groups[key].holdings.push(holding);
    }
  }
  
  return groups;
}, [dashboardData, filteredHoldings]);
```

#### 4.2 新增：编辑现金余额对话框

**文件**: `src/components/dashboard/edit-cash-balance-dialog.tsx`

```typescript
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EditCashBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
  currency: string;
  currentBalance: number;
  onSuccess: () => void;
}

export function EditCashBalanceDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  currency,
  currentBalance,
  onSuccess
}: EditCashBalanceDialogProps) {
  const [balance, setBalance] = useState(currentBalance.toString());
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}/cash`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashBalance: parseFloat(balance) || 0 })
      });
      
      if (response.ok) {
        onSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      console.error('更新现金余额失败:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>编辑现金余额</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-muted-foreground">账户</Label>
            <p className="font-medium">{accountName}</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="balance">现金余额 ({currency})</Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              min="0"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="请输入现金余额"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### 4.3 修改：现金余额行添加编辑按钮

在 holdings-list.tsx 中，现金余额行添加编辑入口：

```tsx
{/* 现金余额行 */}
{group.cashBalance > 0 && (
  <div className="p-3 rounded-lg border ... group">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
          <Wallet className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <span className="font-medium">现金余额</span>
          <span className="text-xs text-muted-foreground ml-2">{group.currency}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-semibold">{formatCurrency(group.cashBalance, group.currency)}</p>
          <p className="text-xs text-muted-foreground">≈ {formatters.currency(group.cashBalanceCny)}</p>
        </div>
        
        {/* ✨ 新增：编辑按钮 */}
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0"
          onClick={() => {
            setEditCashAccount({
              id: group.accountId,
              name: accountName,
              currency: group.currency,
              balance: group.cashBalance
            });
            setEditCashDialogOpen(true);
          }}
        >
          <Edit className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
)}
```

---

## ✅ 测试清单

### Phase 1 测试
- [ ] 数据库迁移成功
- [ ] 现有数据不受影响
- [ ] 新字段默认值正确

### Phase 2 测试
- [ ] `updateAccountCashBalance` 方法正常工作
- [ ] `getAccountsSummary` 返回正确的现金数据
- [ ] `calculatePortfolioOverview` 总资产计算正确
- [ ] 汇率换算正确

### Phase 3 测试
- [ ] PUT /api/accounts/[id]/cash 正常工作
- [ ] GET /api/accounts/[id]/cash 正常工作
- [ ] Dashboard API 返回现金余额

### Phase 4 测试
- [ ] 持仓列表正确显示现金余额
- [ ] 编辑对话框正常打开/关闭
- [ ] 编辑后数据正确更新
- [ ] 账户总市值正确显示（含现金）

### 集成测试
- [ ] Dashboard 页面正常加载
- [ ] 总资产 = 证券市值 + 券商现金 + 现金资产 + 其他资产
- [ ] 现金资产Tab只显示银行存款和货币基金
- [ ] 历史快照功能不受影响

---

## 📊 数据迁移（可选）

如果需要将 AccountBalance 中的历史现金数据迁移到新字段：

```sql
-- 将最新快照的现金余额迁移到账户表
UPDATE investment_accounts ia
SET 
  cash_balance = ab.cash_balance_original,
  cash_balance_cny = ab.cash_balance_cny,
  cash_exchange_rate = ab.exchange_rate
FROM (
  SELECT DISTINCT ON (account_id) 
    account_id, 
    cash_balance_original,
    cash_balance_cny,
    exchange_rate
  FROM account_balances
  ORDER BY account_id, snapshot_date DESC
) ab
WHERE ia.id = ab.account_id;
```

---

## 🔄 回滚方案

如果出现问题，可以快速回滚：

### 方案1：代码回滚
```bash
git checkout HEAD~1 -- prisma/schema.prisma
git checkout HEAD~1 -- src/lib/services/portfolio-service.ts
git checkout HEAD~1 -- src/app/api/dashboard/route.ts
git checkout HEAD~1 -- src/components/dashboard/holdings-list.tsx
```

### 方案2：数据库回滚
新增的字段可以保留（默认值为0，不影响现有功能），服务层可以fallback到从AccountBalance获取：

```typescript
// Fallback逻辑
const cashBalance = account.cashBalance > 0 
  ? account.cashBalance 
  : await this.getCashFromLatestSnapshot(account.id);
```

---

## 📅 时间估算

| Phase | 预计时间 | 风险等级 |
|-------|---------|---------|
| Phase 1: 数据库 | 15分钟 | 低 |
| Phase 2: 服务层 | 45分钟 | 中 |
| Phase 3: API | 30分钟 | 低 |
| Phase 4: 前端 | 60分钟 | 低 |
| 测试验证 | 30分钟 | - |
| **总计** | **约3小时** | - |

---

## 🎯 成功标准

1. ✅ 证券账户视图显示现金余额（如截图所示）
2. ✅ 可以手动编辑现金余额
3. ✅ 账户总市值 = 持仓 + 现金
4. ✅ 总资产计算正确
5. ✅ 现金资产Tab只显示银行存款和货币基金
6. ✅ 所有现有功能正常工作
