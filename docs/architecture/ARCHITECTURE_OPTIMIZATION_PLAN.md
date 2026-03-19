# 架构优化计划 - 数据一致性改造

## 目标
将系统从"混合快照+实时计算"模式改造为"基础表+API计算+历史快照"的清晰架构，确保数据一致性和准确性。

---

## 当前问题诊断

### ❌ 问题1：AccountBalance 表职责不清
- **现状**：既存储快照数据，又被实时查询用于展示
- **问题**：`totalMarketValueCny` 字段经常过期，与实际持仓不一致
- **影响**：Dashboard 显示错误的总资产

### ❌ 问题2：冗余计算字段
- **现状**：`Holding` 表存储了 `marketValueCny`、`unrealizedPnl` 等派生字段
- **问题**：价格更新时容易忘记重新计算
- **影响**：数据不一致

### ❌ 问题3：缺少历史快照机制
- **现状**：没有定期快照任务
- **问题**：无法查看历史趋势
- **影响**：趋势图只能模拟数据

---

## 🎯 优化方案（5个阶段）

### 阶段1：清理 AccountBalance 表的实时查询 ✅ 已完成
**目标**：API 不再依赖 `totalMarketValueCny`，改为实时计算

**修改内容**：
- ✅ API 层实时计算 `totalMarketValueCny = 持仓市值 + 现金`
- ✅ 前端从 API 获取实时数据
- ✅ 移除 `_debug` 调试字段

**验证**：
- ✅ Dashboard 显示准确的总资产 ¥1,764,816.09
- ✅ 三个账户的市值与持仓列表一致

---

### 阶段2：创建数据服务层（Service Layer）
**目标**：将计算逻辑从 API Route 提取到独立的服务层

**创建文件**：
```
src/lib/services/
  ├── portfolio-service.ts    # 投资组合计算服务
  ├── account-service.ts      # 账户数据服务
  ├── snapshot-service.ts     # 快照服务
  └── exchange-rate-service.ts # 汇率服务（已存在）
```

**修改内容**：
1. 创建 `PortfolioService` 类：
   - `calculateAccountTotalValue(accountId)` - 计算账户总市值
   - `calculatePortfolioOverview(userId)` - 计算投资组合概览
   - `getHoldingsByAccount(userId)` - 获取分账户持仓
   - `getPortfolioDistribution(userId)` - 计算投资组合分布

2. 重构 `/api/dashboard/route.ts` 使用服务层

**验证**：
- API 返回数据不变
- 代码更模块化、可测试

---

### 阶段3：优化 Holding 表字段
**目标**：区分"基础字段"和"派生字段"

**Schema 修改**：
```prisma
model Holding {
  // === 基础字段（手动维护）===
  quantity        Decimal  @db.Decimal(15, 6)
  averageCost     Decimal  @db.Decimal(15, 6)
  currentPrice    Decimal? @db.Decimal(15, 6)  // 从价格API更新
  
  // === 派生字段（自动计算）===
  // 建议：这些字段可以保留用于性能优化，但需明确标记为"缓存字段"
  marketValueCny       Decimal? // 缓存字段
  unrealizedPnl        Decimal? // 缓存字段
  unrealizedPnlPercent Decimal? // 缓存字段
  
  // 添加字段标记最后计算时间
  calculatedAt    DateTime? @map("calculated_at")
}
```

**创建计算触发器**：
- 当 `currentPrice` 更新时，自动重新计算派生字段
- 或在查询时实时计算（取决于性能需求）

**验证**：
- 价格更新后，市值自动更新
- 手动修改持仓数量后，盈亏自动重新计算

---

### 阶段4：建立历史快照机制
**目标**：每日自动生成快照，用于历史趋势分析

**创建快照任务**：
```
scripts/tasks/
  ├── daily-snapshot.js       # 每日快照任务
  └── snapshot-scheduler.js   # 定时调度器
```

**快照内容**：
1. **AccountBalance 快照**（保留，仅用于历史）
   - `snapshotDate` = 当天日期
   - `totalMarketValueCny` = 实时计算值（快照时刻的真实值）
   - `cashBalanceCny` = 当前现金

2. **PortfolioHistory 快照**（新增）
   ```prisma
   model PortfolioHistory {
     id              String   @id @default(uuid())
     userId          String
     snapshotDate    DateTime @db.Date
     totalAssets     Decimal  // 总资产
     totalCash       Decimal  // 现金
     totalHoldings   Decimal  // 持仓市值
     holdingCount    Int      // 持仓数量
     accountCount    Int      // 账户数量
     createdAt       DateTime @default(now())
     
     @@unique([userId, snapshotDate])
     @@map("portfolio_history")
   }
   ```

**定时任务配置**：
- 使用 `node-cron` 或系统 cron job
- 每日 00:00 执行
- 自动计算并存储快照

**验证**：
- 运行快照任务，生成历史数据
- Dashboard 趋势图显示真实历史数据

---

### 阶段5：前端数据源统一
**目标**：前端不做任何业务计算，完全依赖 API

**修改内容**：
1. **移除前端计算逻辑**：
   ```typescript
   // ❌ 删除
   const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
   
   // ✅ 使用 API 数据
   const totalValue = dashboardData.overview.totalAssets;
   ```

2. **统一数据接口**：
   - 所有数字、百分比、颜色从 API 返回
   - 前端只负责展示和交互

3. **数据验证机制**：
   - API 返回数据时附加 `calculatedAt` 时间戳
   - 前端显示数据更新时间

**验证**：
- 前端代码中无业务计算逻辑
- 所有组件使用统一的数据接口

---

## 实施顺序

### ✅ 已完成
- [x] 阶段1：清理 AccountBalance 实时查询

### 🔄 待执行（按顺序）
- [ ] **阶段2**：创建服务层（优先级：高）
- [ ] **阶段3**：优化 Holding 表字段（优先级：中）
- [ ] **阶段4**：建立快照机制（优先级：中）
- [ ] **阶段5**：前端数据源统一（优先级：低）

---

## 每个阶段的验证标准

### 阶段2验证
```bash
# 运行单元测试
npm test src/lib/services/portfolio-service.test.ts

# 对比 API 输出
node scripts/test-dashboard-api.js
```

### 阶段3验证
```sql
-- 检查派生字段与实时计算是否一致
SELECT 
  h.id,
  h.quantity * h.current_price AS calculated_value,
  h.market_value_cny AS stored_value,
  ABS(h.quantity * h.current_price - h.market_value_cny) AS diff
FROM holdings h
WHERE ABS(h.quantity * h.current_price - h.market_value_cny) > 0.01;
```

### 阶段4验证
```bash
# 手动运行快照任务
node scripts/tasks/daily-snapshot.js

# 检查快照数据
psql -d finance_system -c "SELECT * FROM portfolio_history ORDER BY snapshot_date DESC LIMIT 5;"
```

### 阶段5验证
```bash
# 搜索前端计算逻辑
grep -r "reduce.*sum" src/app/ src/components/
# 应该只返回展示相关的求和，不涉及业务逻辑
```

---

## 回滚方案

每个阶段完成后打 Git Tag：
```bash
git tag -a v0.2-phase1 -m "Complete phase 1: Clean AccountBalance queries"
git tag -a v0.2-phase2 -m "Complete phase 2: Create service layer"
# ...
```

如果某阶段出现问题，可以回滚到上一个稳定版本：
```bash
git checkout v0.2-phase1
```

---

## 预期收益

### 数据准确性
- ✅ 消除数据不一致问题
- ✅ 单一数据源（基础表）
- ✅ API 计算保证实时性

### 可维护性
- ✅ 代码模块化（服务层）
- ✅ 逻辑集中管理
- ✅ 易于测试

### 可扩展性
- ✅ 历史数据支持趋势分析
- ✅ 新功能基于服务层开发
- ✅ 性能优化空间（缓存层）

---

## 风险提示

### 阶段2风险
- **风险**：服务层重构可能引入 bug
- **缓解**：保留原 API 代码，并行测试

### 阶段3风险
- **风险**：Schema 修改需要数据迁移
- **缓解**：先添加新字段，验证后再删除旧字段

### 阶段4风险
- **风险**：定时任务失败导致快照缺失
- **缓解**：添加监控和告警机制

---

## 下一步行动

**用户决策**：
1. 是否立即开始阶段2？
2. 是否需要先创建单元测试？
3. 是否需要先备份数据库？

**建议**：
- ✅ 先执行阶段2（服务层），风险最低，收益最大
- ✅ 每个阶段完成后验证并提交代码
- ✅ 保持功能稳定，逐步优化
