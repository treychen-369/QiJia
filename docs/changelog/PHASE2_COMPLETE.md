# Phase 2 数据完整性增强 - 完成报告

## 📅 完成日期
2026-01-29

## 🎯 Phase 2 目标
确保历史数据完整、准确，为后续分析功能（目标配置、投资建议）打基础。

---

## ✅ 已完成任务

### 2.1 更新快照创建脚本，集成负债计算 ✅

**文件**: `scripts/create-daily-snapshot-v2.js`

**功能**:
- 计算证券持仓市值（实时汇率）
- 计算证券账户现金
- 计算现金资产（活期、定期、货币基金）
- 计算其他资产（不动产、贵金属）
- ✅ 新增：计算负债
- 创建包含全量资产的快照

**快照数据字段**:
```javascript
{
  // 向后兼容字段
  totalValueCny,        // 证券+券商现金
  investedAmountCny,    // 证券成本
  cashBalanceCny,       // 流动现金
  unrealizedPnl,        // 证券未实现盈亏
  
  // ✅ Phase 2 新增
  totalAssets,          // 全量家庭资产
  totalCashAssets,      // 现金资产总值
  totalOtherAssets,     // 其他资产总值
  totalLiabilities,     // 总负债
  netWorth              // 净资产
}
```

---

### 2.2 创建 Windows 定时任务脚本 ✅

**文件**: 
- `scripts/setup-daily-snapshot-task.ps1` - PowerShell 安装脚本
- `scripts/run-daily-snapshot.bat` - 批处理执行脚本
- `scripts/run-snapshot-now.bat` - 手动执行脚本

**用法**:
```powershell
# 以管理员身份运行 PowerShell
.\scripts\setup-daily-snapshot-task.ps1
```

**任务配置**:
- 任务名称: `QiJiaFinance_DailySnapshot`
- 执行时间: 每天凌晨 01:00
- 日志位置: `logs/snapshot.log`

---

### 2.3 重构 Dashboard API，消除重复计算 ✅

**修改文件**: 
- `src/lib/services/portfolio-service.ts`
- `src/app/api/dashboard/route.ts`

**新增方法**:
```typescript
// portfolio-service.ts
static async getHoldingsWithCalculations(userId: string): Promise<HoldingWithCalculations[]>
```

**效果**:
- ✅ API 层不再有计算逻辑
- ✅ 统一使用服务层方法
- ✅ 代码更简洁，维护更方便

---

### 2.4 更新历史快照数据（补充全量资产字段） ✅

**文件**: `scripts/migrate-historical-snapshots.js`

**迁移策略**:
- 旧快照使用 `totalValueCny`（仅证券）作为 `totalAssets` 的估计值
- 其他字段设为 0（因为历史数据无法重建）

**迁移结果**:
```
✅ 成功: 1 条 (2026-01-25)
```

---

### 2.5 添加快照数据完整性检查 ✅

**文件**: `scripts/verify-snapshot-integrity.js`

**检查内容**:
1. 全量资产字段完整性
2. 日期连续性（检测缺失日期）
3. 今日收益计算验证

**用法**:
```bash
node scripts/verify-snapshot-integrity.js
```

---

## 📁 新增文件列表

| 文件 | 描述 |
|------|------|
| `scripts/create-daily-snapshot-v2.js` | 全量资产快照脚本 V2 |
| `scripts/setup-daily-snapshot-task.ps1` | Windows 定时任务安装脚本 |
| `scripts/run-daily-snapshot.bat` | 定时任务执行脚本 |
| `scripts/run-snapshot-now.bat` | 手动执行脚本 |
| `scripts/migrate-historical-snapshots.js` | 历史数据迁移脚本 |
| `scripts/verify-snapshot-integrity.js` | 数据完整性检查脚本 |

---

## 📊 数据结构变更

### PortfolioHistory 表（已存在，Phase 2 开始使用）

```prisma
model PortfolioHistory {
  // 原有字段（向后兼容）
  totalValueCny     Decimal  // 证券+券商现金
  cashBalanceCny    Decimal  // 流动现金
  investedAmountCny Decimal  // 证券成本
  unrealizedPnl     Decimal  // 证券盈亏
  
  // ✅ Phase 2 新增字段
  totalAssets       Decimal? // 全量家庭资产
  totalCashAssets   Decimal? // 现金资产总值
  totalOtherAssets  Decimal? // 其他资产总值
  totalLiabilities  Decimal? // 总负债
  netWorth          Decimal? // 净资产
}
```

---

## 🔧 服务层变更

### PortfolioService

**新增方法**:
```typescript
/**
 * 获取持仓列表（包含完整计算数据）
 * 统一持仓计算逻辑，避免 API 层和服务层重复代码
 */
static async getHoldingsWithCalculations(userId: string): Promise<HoldingWithCalculations[]>
```

**新增类型**:
```typescript
export interface HoldingWithCalculations {
  id: string;
  type: 'holding';
  symbol: string;
  name: string;
  accountId: string;
  accountName: string;
  broker: string;
  quantity: number;
  currentPrice: number;
  averageCost: number;
  costBasis: number;
  marketValue: number;          // CNY市值
  marketValueOriginal: number;  // 原币种市值
  unrealizedPnL: number;        // CNY盈亏
  unrealizedPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  sector: string;
  region: string;
  currency: string;
  exchangeRate: number;
  lastUpdated: string;
  percentage: number;
}
```

---

## 📋 使用指南

### 日常操作

```bash
# 手动创建今日快照
node scripts/create-daily-snapshot-v2.js

# 或双击运行
scripts/run-snapshot-now.bat

# 检查数据完整性
node scripts/verify-snapshot-integrity.js
```

### 设置定时任务（一次性）

```powershell
# 以管理员身份运行 PowerShell
.\scripts\setup-daily-snapshot-task.ps1

# 验证任务
Get-ScheduledTask -TaskName QiJiaFinance_DailySnapshot

# 手动触发测试
Start-ScheduledTask -TaskName QiJiaFinance_DailySnapshot
```

### 迁移历史数据（一次性）

```bash
# 已执行完成，无需重复运行
node scripts/migrate-historical-snapshots.js
```

---

## ⚠️ 注意事项

### 1. 旧快照数据局限性
旧快照（2026-01-25之前）的 `totalAssets` 使用 `totalValueCny`（仅证券）作为估计值，这意味着：
- 今日收益计算对于旧数据可能不够准确
- 全量资产趋势图可能有断层

### 2. 定时任务依赖
- 需要电脑在凌晨1点处于开机状态
- 如果错过执行，下次开机时会自动补执行（`StartWhenAvailable` 设置）

### 3. 汇率服务依赖
快照脚本使用 `exchangerate-api.com` 获取实时汇率，如果网络不通会使用默认汇率。

---

## 🎯 后续计划

### Phase 3: 目标配置体系 (建议2-3天)
- 设计目标配置数据模型
- 创建目标配置 API
- 目标配置 UI 页面
- 实时对比当前 vs 目标
- 偏离告警机制

### Phase 4: 投资建议引擎 (建议3-4天)
- 调仓建议算法设计
- 交易成本估算
- 再平衡策略选择
- 建议展示 UI

---

## ✅ Phase 2 验证清单

- [x] PortfolioHistory 表包含 totalAssets, totalCashAssets, totalOtherAssets, totalLiabilities, netWorth
- [x] 快照脚本支持全量资产和负债
- [x] 定时任务脚本创建完成
- [x] 旧快照数据已迁移
- [x] API/Service 层无重复计算
- [x] 数据完整性检查脚本可用

---

## 📝 相关文档

- [PHASE1_CALCULATION_FIX.md](./PHASE1_CALCULATION_FIX.md) - Phase 1 计算逻辑修复
- [PHASE2_OPTIMIZATION_ASSESSMENT.md](./PHASE2_OPTIMIZATION_ASSESSMENT.md) - Phase 2 评估报告
- [ARCHITECTURE_PROGRESS.md](./ARCHITECTURE_PROGRESS.md) - 架构进度总览
