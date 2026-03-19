# 🐛 历史趋势图错误修复

**日期**: 2026-01-25  
**问题**: `TypeError: Cannot read properties of undefined (reading 'toLocaleString')`  
**状态**: ✅ 已修复

---

## 问题描述

刷新Dashboard页面1秒后报错：

```
TypeError: Cannot read properties of undefined (reading 'toLocaleString')
  at src/components/charts/historical-trend-chart.tsx (262:49)
```

错误发生在尝试访问 `data.totalCash.toLocaleString('zh-CN')` 时。

---

## 根本原因

**API与前端类型定义不匹配**

1. **API返回的字段名** (来自 `SnapshotService.getHistoricalTrend`):
   ```typescript
   {
     date: Date,
     totalValue: number,
     cashBalance: number,        // ✅
     investedValue: number,      // ✅
     unrealizedPnl: number,
     dailyReturn: number
   }
   ```

2. **前端期望的字段名** (historical-trend-chart.tsx):
   ```typescript
   {
     date: string,
     totalValue: number,
     totalCash: number,          // ❌ 不存在
     totalInvestment: number,    // ❌ 不存在
     unrealizedPnl: number,
     unrealizedPnlPercent: number
   }
   ```

3. **问题**:
   - API返回 `cashBalance`，前端期望 `totalCash`
   - API返回 `investedValue`，前端期望 `totalInvestment`
   - 前端期望 `unrealizedPnlPercent`，但API没有返回（需要前端计算）

---

## 修复方案

### 1. 更新TypeScript类型定义

```typescript
// 修改前
interface HistoricalDataPoint {
  date: string;
  totalValue: number;
  totalCash: number;
  totalInvestment: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

// 修改后（匹配API字段名）
interface HistoricalDataPoint {
  date: string;
  totalValue: number;
  cashBalance: number;        // 匹配API
  investedValue: number;      // 匹配API
  unrealizedPnl: number;
  dailyReturn?: number;
}
```

### 2. 添加数据转换层

确保API数据格式化后再使用：

```typescript
const result = await response.json();

if (result.success && result.data?.trend) {
  // 转换API数据格式
  const formattedData: HistoricalDataPoint[] = result.data.trend.map((item: any) => ({
    date: item.date,
    totalValue: Number(item.totalValue || 0),
    cashBalance: Number(item.cashBalance || 0),      // API字段
    investedValue: Number(item.investedValue || 0),  // API字段
    unrealizedPnl: Number(item.unrealizedPnl || 0),
    dailyReturn: Number(item.dailyReturn || 0),
  }));
  setData(formattedData);
}
```

### 3. 更新UI显示逻辑

修复Tooltip中的字段引用：

```typescript
// 修改前
¥{data.totalCash.toLocaleString('zh-CN')}
¥{data.totalInvestment.toLocaleString('zh-CN')}
{data.unrealizedPnlPercent.toFixed(2)}%

// 修改后
¥{data.cashBalance.toLocaleString('zh-CN')}
¥{data.investedValue.toLocaleString('zh-CN')}
{data.investedValue > 0 && (
  <> ({((data.unrealizedPnl / data.investedValue) * 100).toFixed(2)}%)</>
)}
```

---

## 数据流完整路径

```
数据库 (PortfolioHistory)
  ↓
  字段: totalValueCny, cashBalanceCny, investedAmountCny
  ↓
SnapshotService.getHistoricalTrend()
  ↓
  映射为: totalValue, cashBalance, investedValue
  ↓
API (/api/portfolio/history)
  ↓
  返回: { trend: [...], metrics: {...} }
  ↓
HistoricalTrendChart 组件
  ↓
  转换为: HistoricalDataPoint[]
  ↓
Recharts 渲染
```

---

## 验证步骤

### 1. 运行测试脚本

```bash
node scripts/test-history-api.js
```

**期望输出**:
```
✅ 用户: QiJia Contributors (user@example.com)
📊 数据库快照数量: 31
✅ 字段映射关系:
  数据库字段 → API字段 → 前端类型
  totalValueCny → totalValue → totalValue
  cashBalanceCny → cashBalance → cashBalance
  investedAmountCny → investedValue → investedValue
```

### 2. 生成测试数据（如果需要）

```bash
node scripts/generate-historical-snapshots.js
```

### 3. 访问Dashboard

1. 登录系统: http://localhost:3000
2. 查看Dashboard页面
3. 历史趋势图应正常显示
4. 切换时间范围（7d/30d/90d/1y）
5. Hover查看Tooltip数据

---

## 修复文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/components/charts/historical-trend-chart.tsx` | ✅ 更新类型定义、数据转换、UI显示 |
| `scripts/test-history-api.js` | ✅ 新建测试脚本 |
| `scripts/generate-historical-snapshots.js` | ✅ 新建数据生成脚本 |

---

## 关键经验教训

### 1. **类型安全的重要性**

当API和前端使用不同的字段名时，TypeScript可以帮助发现问题，但前提是：
- API响应有明确的类型定义
- 组件props有严格的类型约束
- 避免使用 `any` 类型

### 2. **数据转换层**

在API响应和组件状态之间添加显式的数据转换层：
```typescript
const formattedData = apiResponse.map(transformToComponentFormat);
```

好处：
- 解耦API和UI
- 集中处理数据格式
- 易于调试和维护

### 3. **命名一致性**

理想情况下，整个数据流应使用一致的字段名：
```
Database → Service → API → Frontend
   ↓         ↓        ↓       ↓
totalValue → totalValue → totalValue → totalValue
```

但现实中可能需要妥协（如数据库字段加了Cny后缀）。此时应：
- 在服务层统一转换
- 文档化字段映射关系
- 创建测试脚本验证

### 4. **防御性编程**

使用 Optional Chaining 和 Nullish Coalescing：
```typescript
Number(item.cashBalance || 0)
{data.investedValue > 0 && <PercentageDisplay />}
```

---

## 后续优化建议

### 短期（本周）

1. ✅ 修复类型定义
2. ✅ 添加数据转换
3. ✅ 创建测试脚本
4. 🔄 完善错误处理（显示友好的错误消息）

### 中期（本月）

1. 统一API响应类型定义
2. 添加单元测试
3. 添加E2E测试
4. 性能优化（缓存、分页）

### 长期（未来）

1. 考虑使用Schema验证库（如Zod）
2. API响应自动验证
3. 生成TypeScript类型从OpenAPI规范
4. 完整的类型安全数据流

---

## 相关文档

- [PHASE_6_HISTORICAL_DATA_SUMMARY.md](./PHASE_6_HISTORICAL_DATA_SUMMARY.md) - 历史数据功能总结
- [PHASE_6_TEST_GUIDE.md](./PHASE_6_TEST_GUIDE.md) - 测试指南
- [ARCHITECTURE_PROGRESS.md](./ARCHITECTURE_PROGRESS.md) - 架构优化进度

---

**修复完成时间**: 2026-01-25 14:05  
**修复耗时**: ~15分钟  
**状态**: ✅ 已验证通过
