# Phase 1 计算逻辑修复报告

## 📅 修复日期
2025-01-29 ~ 2026-01-29

## 🎯 修复目标

### 问题1：今日收益使用模拟数据 ❌
**修复前**：`todayPnl = totalUnrealizedPnl × 0.1`（固定10%模拟）
**修复后**：`todayPnl = currentTotalAssets - yesterdayTotalAssets`（真实快照对比）

### 问题2：净资产未扣除负债 ❌
**修复前**：`netWorth = totalAssets`
**修复后**：`netWorth = totalAssets - totalLiabilities`

### 问题3：总资产缺失部分资产类型 ❌（第二次修复）
**修复前**：`totalAssets = 证券持仓 + 证券账户现金`
**修复后**：`totalAssets = 证券持仓 + 证券账户现金 + 现金资产 + 其他资产`

### 问题4：现金定义不清晰 ❌（第二次修复）
**修复前**：`totalCash = 证券账户现金`
**修复后**：`totalCash = 证券账户现金 + 活期存款`（高流动性）

### 问题5：今日收益率异常过高 ❌（第三次修复 - 2026-01-29）
**根本原因**：统计口径不一致
- 历史快照（`PortfolioHistory`）只包含：证券持仓 + 证券账户现金
- 但计算今日收益时用的是：全部资产（含不动产、现金资产等）

**修复前**：`todayPnl = totalAssets - snapshotTotalValue`（口径不一致，收益率异常高达400%+）
**修复后**：`todayPnl = securitiesValue - snapshotTotalValue`（口径一致，收益率正常约3%）

### 问题6：不动产数据显示不准确 ❌（第三次修复 - 2026-01-29）
**根本原因**：metadata 字段不兼容
- 代码只查找 `marketValue` 和 `appraisalValue`
- 但实际数据使用了 `currentMarketPrice`

**修复后**：支持多种 metadata 字段优先级：
```
marketValue > currentMarketPrice > appraisalValue > currentValue > purchasePrice
```

---

## 📊 正确的资产计算公式

### 总资产（totalAssets）
```
总资产 = 证券持仓市值 + 证券账户现金 + 现金资产 + 其他资产
       = totalInvestmentValue + brokerCash + totalCashAssets + totalOtherAssets
```

**组成部分**：
| 类型 | 来源 | 说明 |
|------|------|------|
| 证券持仓 | Holding表 | 股票、基金、ETF等 |
| 证券账户现金 | AccountBalance表 | 券商账户中的可用余额 |
| 现金资产 | Asset表(CASH_*) | 活期、定期、货币基金、券商现金 |
| 其他资产 | Asset表(RE_*, METAL_*, FIXED_*) | 不动产、贵金属、理财等 |

### 流动现金（totalCash）
```
流动现金 = 证券账户现金 + 活期存款
         = brokerCash + demandDeposits
```

**设计理念**：只计算可以立即使用的资金
- ✅ 证券账户现金 - 可立即交易
- ✅ 活期存款 - 可随时取用
- ❌ 定期存款 - 有锁定期
- ❌ 货币基金 - 需要T+1赎回

### 净资产（netWorth）
```
净资产 = 总资产 - 总负债
       = totalAssets - totalLiabilities
```

---

## 🔧 修改的文件

### 1. `src/lib/services/portfolio-service.ts`

**新增方法**：
- `calculateTodayPnl()` - 基于历史快照计算今日收益
- `calculateCashAssets()` - 计算现金资产总值
- `calculateOtherAssets()` - 计算其他资产总值

**修改方法**：
- `calculatePortfolioOverview()` - 完整重写，包含所有资产类型

**新增字段**：
```typescript
interface PortfolioOverview {
  // ... 原有字段
  totalCashAssets: number;   // 现金资产总值
  totalOtherAssets: number;  // 其他资产总值
}
```

### 2. `src/app/api/dashboard/route.ts`
- 引入 `LiabilityService`
- 计算真实净资产
- API响应新增 `totalLiabilities`、`netWorth`、`totalCashAssets`、`totalOtherAssets`

### 3. `src/lib/api-client.ts`
- 更新类型定义

### 4. `src/app/dashboard/page.tsx`
- 使用新的API字段

### 5. `src/components/dashboard/hero-section.tsx`
- 显示更详细的资产构成
- 资产构成条分为：流动现金、证券、存款/理财、其他

---

## 📈 数据流

```
PortfolioService.calculatePortfolioOverview()
  ├── getAccountsSummary() → 证券账户现金
  ├── Holding表查询 → 证券持仓市值
  ├── calculateCashAssets() → 现金资产(含活期存款)
  └── calculateOtherAssets() → 其他资产

Dashboard API
  ├── calculatePortfolioOverview() → overview
  ├── LiabilityService → 总负债
  └── netWorth = totalAssets - totalLiabilities

HeroSection
  ├── 总资产（大字显示）
  ├── 今日收益（真实计算）
  ├── 累计收益
  ├── 净资产（含负债显示）
  └── 资产构成条（4类）
```

---

## ⚠️ 重要：统计口径一致性

### 今日收益计算的关键约束

**历史快照（`PortfolioHistory` 表）存储的数据**：
- `totalValueCny` = 证券持仓市值 + 证券账户现金
- **不包含**：现金资产（Asset表）、不动产、贵金属等

**因此，今日收益计算必须**：
```typescript
// ⚠️ 关键：使用与快照相同的口径
const securitiesValue = totalInvestmentValue + brokerCash;
const { todayPnl, todayPnlPercent } = await this.calculateTodayPnl(userId, securitiesValue);

// ❌ 错误：使用不同口径会导致收益率异常
// const { todayPnl, todayPnlPercent } = await this.calculateTodayPnl(userId, totalAssets);
```

### 两个不同的"总资产"概念

| 概念 | 计算公式 | 用途 |
|------|---------|------|
| **总资产** (totalAssets) | 证券 + 证券账户现金 + 现金资产 + 其他资产 | Dashboard 显示 |
| **证券总值** (securitiesValue) | 证券 + 证券账户现金 | 今日收益计算（与快照口径一致） |

---

## ⚠️ 重要依赖

### 今日收益准确性

今日收益计算依赖 `PortfolioHistory` 表中的历史快照：

```sql
-- 查询最近的快照
SELECT * FROM portfolio_history 
WHERE user_id = ? 
AND snapshot_date < CURRENT_DATE
ORDER BY snapshot_date DESC
LIMIT 1;
```

**如果没有历史数据**：
- 今日收益显示 ¥0 (0.00%)
- 控制台警告：`⚠️ [PortfolioService] 无历史快照数据`

**解决方案**：
1. 手动创建历史快照：`node scripts/create-daily-snapshots.js`
2. 部署服务器后启用定时任务

---

## 📊 验证方法

### 1. 检查API响应
```bash
curl http://localhost:3000/api/dashboard | jq '.overview'
```

预期输出：
```json
{
  "totalAssets": 1234567.89,
  "totalCash": 100000.00,
  "totalInvestmentValue": 900000.00,
  "totalCashAssets": 200000.00,
  "totalOtherAssets": 34567.89,
  "totalLiabilities": 50000.00,
  "netWorth": 1184567.89,
  "todayPnl": 1234.56,
  "todayPnlPercent": 0.10
}
```

### 2. 验证总资产计算
```
totalAssets == totalInvestmentValue + brokerCash + totalCashAssets + totalOtherAssets
```

### 3. 验证净资产计算
```
netWorth == totalAssets - totalLiabilities
```

### 4. 验证今日收益率（第三次修复验证）
```
# 正常收益率应该在 -10% ~ +10% 范围内
# 如果超过这个范围，可能存在统计口径问题

# 验证命令（需要启动开发服务器）：
node scripts/create-daily-snapshots.js
# 然后刷新 Dashboard 查看今日收益
```

**验证结果示例**（2026-01-29 修复后）：
```
📊 今日收益计算:
  快照值: 2821560.96
  当前值: 2913471.30
  今日收益: 91910.34
  今日收益率: 3.2574%
  
✅ 收益率在正常范围内！修复成功！
```

---

## 🔍 详细调试日志

修复后添加了详细的调试日志，可在服务器控制台查看：

### 现金资产计算日志
```
💵 [PortfolioService] 现金资产计算明细:
  - 南洋银行-定期 (CASH_FIXED): ¥500000.00 [定期存款 (rate=2.18%, days=365, earnings=10900.00)]
  - 招商银行活期存款 (CASH_DEMAND): ¥50000.00 [CASH_DEMAND (原值换算)]
  💰 现金资产合计: ¥550000.00, 活期存款: ¥50000.00
```

### 其他资产计算日志
```
🏠 [PortfolioService] 其他资产计算明细:
  - 深圳南山住宅 (RE_RESIDENTIAL): ¥8500000.00 [RE_ (currentMarketPrice=8500000)]
  - 上海写字楼投资 (RE_COMMERCIAL): ¥3000000.00 [RE_ (currentValue=3000000)]
  💰 其他资产合计: ¥11500000.00
```

### 今日收益计算日志
```
📊 [PortfolioService] 今日收益计算（口径：证券+现金）:
  previousDate: 2026-01-25
  previousValue: 2821560.96
  currentSecuritiesValue: 2913471.30
  todayPnl: 91910.34
  todayPnlPercent: 3.2574%
```

### 总资产汇总日志
```
📊 [PortfolioService] 总资产计算明细: {
  证券持仓: 2603560.00,
  证券账户现金: 309911.30,
  证券合计_快照口径: 2913471.30,
  现金资产: 550000.00,
  其中活期存款: 50000.00,
  其他资产: 11500000.00,
  总资产: 14963471.30,
  总现金流动性: 359911.30,
  今日收益: 91910.34,
  今日收益率: 3.2574%
}
```

---

## 🔄 后续任务

- [ ] Phase 2：目标配置体系
- [ ] Phase 3：投资建议引擎
- [ ] 部署到类生产服务器
- [ ] 启用定时快照任务
- [ ] 扩展 PortfolioHistory 表，增加 totalCashAssets 和 totalOtherAssets 字段（可选）

---

## 📝 修复历史

| 日期 | 问题 | 修复内容 |
|------|------|---------|
| 2025-01-29 | 今日收益使用模拟数据 | 改用历史快照对比 |
| 2025-01-29 | 净资产未扣除负债 | 新增 LiabilityService |
| 2025-01-29 | 总资产缺失资产类型 | 添加 Asset 表资产 |
| 2025-01-29 | 现金定义不清晰 | 流动现金 = 券商现金 + 活期存款 |
| 2026-01-29 | 今日收益率异常（400%+）| 修复统计口径一致性 |
| 2026-01-29 | 不动产数据显示不准 | 兼容多种 metadata 字段 |
