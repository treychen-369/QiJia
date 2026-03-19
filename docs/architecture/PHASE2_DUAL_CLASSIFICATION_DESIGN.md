# 阶段2：双重分类架构设计文档

## 📋 目标

实现"双重分类"架构，使资产可以同时拥有：
1. **存放分类（AssetCategory）** - 资产从哪里购买/存放
2. **底层敞口（UnderlyingType）** - 资产的本质属性

## ✅ 完成状态

| 阶段 | 描述 | 状态 |
|------|------|------|
| Phase 2.1 | 数据库Schema更新 | ✅ 完成 |
| Phase 2.2 | 数据迁移脚本 | ✅ 完成 |
| Phase 2.3 | 服务层更新 | ✅ 完成 |
| Phase 2.4 | API更新 | ✅ 完成 |
| Phase 2.5 | 前端更新 | ✅ 完成 |
| Phase 2.6 | 测试验证 | ✅ 完成 |

### 测试结果摘要

```
=== 合并后概览分组 ===
总资产价值: ¥6,020,685.06

权益类: 9 项 | ¥2,308,878.51 (38.35%)
固定收益: 1 项 | ¥509,914.52 (8.47%)
现金等价物: 6 项 | ¥1,157,533.23 (19.23%)
不动产: 1 项 | ¥1,500,000.00 (24.91%)
另类投资: 13 项 | ¥224,358.80 (3.73%)
其他: 1 项 | ¥320,000.00 (5.32%)

=== 验证关键映射 ===
✅ 黄金ETF (518880): 底层敞口=GOLD (期望: GOLD)
✅ 定期存款: 底层敞口=FIXED_INCOME (期望: FIXED_INCOME)
✅ 货币基金: 底层敞口=CASH (期望: CASH)
```

## 🎯 核心概念

### 存放分类 vs 底层敞口

| 资产 | 存放分类 | 底层敞口 | 概览归类 |
|------|---------|---------|---------|
| 贵州茅台（股票） | EQUITY_CN | EQUITY | 权益类 |
| 华安黄金ETF | EQUITY_CN | GOLD | 另类-黄金 |
| 南方原油QDII | EQUITY_US | COMMODITY | 另类-大宗商品 |
| 国债ETF | EQUITY_CN | BOND | 固定收益 |
| 招商中证红利ETF | EQUITY_CN | EQUITY | 权益类 |
| 余额宝 | CASH_MONEY_FUND | CASH | 现金等价物 |
| 定期存款 | CASH_FIXED | FIXED_INCOME | 固定收益 |
| 活期存款 | CASH_DEMAND | CASH | 现金等价物 |
| 住宅 | RE_RESIDENTIAL | REAL_ESTATE | 不动产 |
| 黄金实物 | ALT_GOLD | GOLD | 另类-黄金 |
| 比特币 | ALT_CRYPTO | CRYPTO | 另类-数字资产 |
| 汽车 | ALT_PHYSICAL | DEPRECIATING | 消耗性资产（不纳入净资产） |

---

## 🗂️ 底层敞口类型枚举

```typescript
enum UnderlyingType {
  // 权益类
  EQUITY = 'EQUITY',           // 股票/股票型基金/股票ETF
  
  // 固定收益类
  BOND = 'BOND',               // 债券/债券基金/债券ETF
  FIXED_INCOME = 'FIXED_INCOME', // 定期存款/理财产品
  
  // 现金等价物
  CASH = 'CASH',               // 活期存款/货币基金
  
  // 另类投资
  GOLD = 'GOLD',               // 黄金/黄金ETF/黄金基金
  COMMODITY = 'COMMODITY',     // 大宗商品/商品基金
  CRYPTO = 'CRYPTO',           // 数字资产
  COLLECTIBLE = 'COLLECTIBLE', // 收藏品
  
  // 不动产
  REAL_ESTATE = 'REAL_ESTATE', // 房产/REITs
  
  // 特殊类型
  DEPRECIATING = 'DEPRECIATING', // 消耗性资产（汽车等）
  MIXED = 'MIXED',             // 混合型（平衡型基金等）
  OTHER = 'OTHER',             // 其他
}
```

---

## 📊 数据库Schema变更

### 1. Security表添加底层敞口字段

```prisma
model Security {
  // ... 现有字段 ...
  
  // 新增：底层资产敞口类型
  underlyingType    String?   @map("underlying_type") @db.VarChar(30)
  
  // 新增：底层敞口详细描述
  underlyingDetail  String?   @map("underlying_detail") @db.VarChar(100)
}
```

### 2. Asset表添加底层敞口字段

```prisma
model Asset {
  // ... 现有字段 ...
  
  // 新增：底层资产敞口类型
  underlyingType    String?   @map("underlying_type") @db.VarChar(30)
}
```

---

## 🔧 映射规则

### 自动映射规则（按AssetCategory推断）

```typescript
const DEFAULT_UNDERLYING_MAPPING: Record<string, string> = {
  // 权益类 → 默认是权益敞口
  'EQUITY_CN': 'EQUITY',
  'EQUITY_US': 'EQUITY',
  'EQUITY_HK': 'EQUITY',
  'EQUITY_JP': 'EQUITY',
  'EQUITY_OTHER': 'EQUITY',
  
  // 固定收益类
  'FIXED_BOND': 'BOND',
  'FIXED_CONVERTIBLE': 'BOND',  // 可转债本质是债券
  'FIXED_WEALTH': 'FIXED_INCOME',
  
  // 现金类
  'CASH_DEMAND': 'CASH',
  'CASH_MONEY_FUND': 'CASH',
  'CASH_BROKER': 'CASH',
  'CASH_FIXED': 'FIXED_INCOME',  // 定期存款归入固定收益
  
  // 另类投资
  'ALT_GOLD': 'GOLD',
  'ALT_CRYPTO': 'CRYPTO',
  'ALT_COMMODITY': 'COMMODITY',
  'ALT_COLLECTIBLE': 'COLLECTIBLE',
  'ALT_PHYSICAL': 'DEPRECIATING',
  
  // 不动产
  'RE_RESIDENTIAL': 'REAL_ESTATE',
  'RE_COMMERCIAL': 'REAL_ESTATE',
  'RE_REITS': 'REAL_ESTATE',
};
```

### 特殊证券的手动映射

某些证券需要手动设置 `underlyingType`：

| 证券名称 | 默认推断 | 实际敞口 | 需手动设置 |
|---------|---------|---------|-----------|
| 华安黄金ETF | EQUITY | GOLD | ✅ |
| 南方原油QDII | EQUITY | COMMODITY | ✅ |
| 国债ETF | EQUITY | BOND | ✅ |
| 纳指科技ETF | EQUITY | EQUITY | ❌ 默认即可 |

---

## 📈 资产概览聚合逻辑

### 聚合层级设计

```
资产概览卡片
├── 权益类 (EQUITY)
│   ├── 来源：所有 underlyingType='EQUITY' 的持仓
│   └── 计算：sum(marketValueCny)
├── 固定收益 (FIXED_INCOME + BOND)
│   ├── 来源：underlyingType IN ('BOND', 'FIXED_INCOME') 的持仓 + 现金资产
│   └── 包含：债券ETF、可转债、定期存款、理财产品
├── 现金等价物 (CASH)
│   ├── 来源：underlyingType='CASH' 的现金资产
│   └── 包含：活期存款、货币基金、券商现金
├── 不动产 (REAL_ESTATE)
│   ├── 来源：underlyingType='REAL_ESTATE' 的资产
│   └── 包含：住宅、商业、REITs
├── 另类投资
│   ├── 黄金 (GOLD) - 黄金ETF + 实物黄金
│   ├── 数字资产 (CRYPTO)
│   ├── 大宗商品 (COMMODITY)
│   └── 收藏品 (COLLECTIBLE)
└── 消耗性资产 (DEPRECIATING) - 可选是否纳入
```

---

## 🚀 实施步骤

### Phase 2.1: 数据库Schema更新 ✅
1. ✅ 添加 `underlyingType` 字段到 Security 表
2. ✅ 添加 `underlyingType` 字段到 Asset 表
3. ✅ 运行 `prisma migrate`

### Phase 2.2: 数据迁移脚本 ✅
1. ✅ 创建迁移脚本 `scripts/migrate-underlying-type.js`
2. ✅ 迁移 102 条证券数据（1条特殊映射：黄金ETF）
3. ✅ 迁移 21 条资产数据

### Phase 2.3: 服务层更新 ✅
1. ✅ 创建 `src/lib/underlying-type.ts` - 底层敞口类型定义和映射
2. ✅ 更新 `PortfolioService.getPortfolioByUnderlyingType()` - 按底层敞口聚合
3. ✅ 添加 `PortfolioService.getPortfolioByOverviewGroup()` - 按概览分组聚合

### Phase 2.4: API更新 ✅
1. ✅ 更新 `/api/dashboard` 返回 `underlyingTypePortfolio` 数据
   - `byUnderlyingType`: 细分的底层敞口（EQUITY, BOND, GOLD, CASH等）
   - `byOverviewGroup`: 聚合的概览分组（权益类、固定收益、现金等）

### Phase 2.5: 前端更新 ✅
1. ✅ 更新 `dual-view-portfolio-chart.tsx` - 添加"底层敞口"视图按钮
2. ✅ 更新 `charts-grid.tsx` - 传递底层敞口数据
3. ✅ 更新 `dashboard/page.tsx` - 传递底层敞口数据
4. ✅ 更新 `api-client.ts` - 添加类型定义

### Phase 2.6: 测试验证 ✅
1. ✅ 创建测试脚本 `scripts/test-underlying-type.js`
2. ✅ 创建聚合测试脚本 `scripts/test-underlying-aggregation.js`
3. ✅ 验证关键映射：黄金ETF → GOLD, 定期存款 → FIXED_INCOME

---

## ✅ 验收标准

1. ✅ 所有现有功能正常工作
2. ✅ 资产概览按底层敞口正确聚合
3. ✅ 黄金ETF被归入"黄金"而非"权益类"
4. ✅ 定期存款被归入"固定收益"而非"现金"
5. ✅ 汽车等消耗性资产可选择是否纳入统计

---

## 📝 回滚计划

如果出现问题：
1. `underlyingType` 字段是可选的 (`String?`)
2. 所有旧逻辑继续使用 `assetCategoryId`
3. 新功能可通过功能开关禁用

---

## 📁 更新的文件清单

### 数据库层
- `prisma/schema.prisma` - 添加 underlyingType 字段

### 服务层
- `src/lib/underlying-type.ts` ✨ **新文件** - 底层敞口类型定义和映射
- `src/lib/services/portfolio-service.ts` - 添加底层敞口聚合方法

### API层
- `src/app/api/dashboard/route.ts` - 返回底层敞口数据

### 前端层
- `src/components/charts/dual-view-portfolio-chart.tsx` - 三视图切换
- `src/components/charts/charts-grid.tsx` - 传递底层敞口数据
- `src/app/dashboard/page.tsx` - 传递底层敞口数据
- `src/lib/api-client.ts` - 类型定义

### 脚本
- `scripts/migrate-underlying-type.js` ✨ **新文件** - 数据迁移脚本
- `scripts/test-underlying-type.js` ✨ **新文件** - 数据验证脚本
- `scripts/test-underlying-aggregation.js` ✨ **新文件** - 聚合测试脚本

---

## 🎮 使用指南

### 投资组合分布图表

图表现在支持三种视图：

1. **底层敞口** (默认) - 按资产的真实底层属性分类
   - 权益类、固定收益、现金等价物、不动产、另类投资、其他
   
2. **账户视角** - 按证券账户分类
   
3. **存放分类** - 按资产的存放位置分类

### 如何设置特殊证券的底层敞口

对于需要手动设置底层敞口的证券（如黄金ETF、债券ETF），可以：

1. 在数据库中直接更新：
```sql
UPDATE securities 
SET underlying_type = 'GOLD' 
WHERE symbol = '518880';
```

2. 或使用迁移脚本的特殊映射：
```javascript
// scripts/migrate-underlying-type.js
const SPECIAL_SECURITIES = {
  '518880': 'GOLD',      // 黄金ETF
  '511010': 'BOND',      // 国债ETF
  // ... 更多
};
```

---

## 📅 完成时间

- 开始时间：2026年2月1日
- 完成时间：2026年2月1日
