# 资产更新记录时间线功能

## 📋 功能概述

实现了**方案C：汇总视图 + 详情链接**，将资产更新记录分散到各资产详情页面中，同时保留 Dashboard 的汇总列表并支持点击跳转。

---

## ✅ 已完成的工作

### 1. API 扩展

**文件**: `src/app/api/activity-logs/route.ts`
- ✨ 新增 `assetId` 查询参数，支持按单个资产筛选
- ✨ 返回数据新增 `assetId` 字段，用于前端跳转

**文件**: `src/lib/services/activity-log-service.ts`
- ✨ `getActivityLogs()` 方法新增 `assetId` 筛选支持
- ✨ 新增 `getAssetActivityLogs()` 便捷方法

---

### 2. 新增组件

**文件**: `src/components/shared/asset-activity-timeline.tsx`

资产更新记录时间线组件，特性：
- 📜 时间线样式展示
- 📊 支持分页加载
- 🎨 不同操作类型有不同颜色和图标
- 💰 显示金额变动和趋势图标
- 📝 展示变更详情（变更前/变更后）
- ⏳ 智能时间格式化（今天/昨天/星期X/日期）
- 🔄 加载更多功能
- 📭 空状态友好提示

---

### 3. 详情对话框改造

所有详情对话框都添加了 **Tabs 切换**：

| 组件 | 文件 | Tab 1 | Tab 2 |
|------|------|-------|-------|
| 证券持仓详情 | `holding-detail-dialog.tsx` | 基本信息 | 更新记录 |
| 现金资产详情 | `asset-detail-dialog.tsx` | 基本信息 | 更新记录 |
| 不动产详情 | `real-estate-detail-dialog.tsx` | 基本信息 | 更新记录 |

---

### 4. 汇总列表优化

**文件**: `src/components/dashboard/activity-log-list.tsx`

- ✨ 新增 `onViewDetail` 回调属性
- ✨ 列表项可点击，hover 时显示蓝色边框和跳转图标
- ✨ 点击后触发回调，传递 `assetId`、`assetType`、`assetName`

**文件**: `src/app/dashboard/page.tsx`

- ✨ 实现点击跳转逻辑：
  - 自动切换到对应的资产 Tab（证券/现金/不动产）
  - 平滑滚动到资产列表区域
  - 显示 Toast 提示用户

---

## 📊 架构设计

```
Dashboard 页面
├── 汇总列表（ActivityLogList）
│   └── 点击条目 → 切换Tab + 滚动 + Toast提示
│
├── 资产列表（AssetsTabNavigation）
│   ├── 证券持仓（HoldingsList）
│   │   └── 点击资产 → HoldingDetailDialog
│   │       ├── Tab1: 基本信息
│   │       └── Tab2: 更新记录（AssetActivityTimeline）
│   │
│   ├── 现金资产（CashAssetsList）
│   │   └── 点击资产 → AssetDetailDialog
│   │       ├── Tab1: 基本信息
│   │       └── Tab2: 更新记录（AssetActivityTimeline）
│   │
│   └── 不动产（RealEstateList）
│       └── 点击资产 → RealEstateDetailDialog
│           ├── Tab1: 基本信息
│           └── Tab2: 更新记录（AssetActivityTimeline）
```

---

## 🎨 UI 规范

### 时间线节点样式

| 操作类型 | 图标 | 颜色 |
|---------|------|------|
| CREATE | Plus | 绿色 |
| UPDATE | Edit | 蓝色 |
| DELETE | Trash2 | 红色 |
| PRICE_UPDATE | RefreshCw | 紫色 |
| TRANSFER | ArrowRightLeft | 橙色 |
| IMPORT | FileUp | 青色 |

### 时间格式化

| 时间差 | 显示 |
|-------|------|
| 同一天 | 今天 HH:mm |
| 昨天 | 昨天 HH:mm |
| 7天内 | 星期X HH:mm |
| 更早 | MM-dd HH:mm |

---

## 📝 API 使用示例

### 获取单个资产的更新记录

```typescript
// 请求
GET /api/activity-logs?assetId=xxx-xxx-xxx&limit=10&offset=0

// 响应
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log-id",
        "assetId": "asset-id",
        "assetType": "HOLDING",
        "assetName": "腾讯控股",
        "assetSymbol": "0700",
        "action": "UPDATE",
        "description": "更新持仓数量",
        "previousValue": { "quantity": 800 },
        "newValue": { "quantity": 900 },
        "amountChange": 60600,
        "currency": "HKD",
        "createdAt": "2026-01-31T10:00:00.000Z"
      }
    ],
    "total": 15,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## 🧪 测试指南

### 测试详情对话框的更新记录 Tab

1. 打开 Dashboard 页面
2. 点击任意资产查看详情
3. 在对话框中切换到"更新记录" Tab
4. 验证：
   - 显示该资产的操作历史
   - 时间线样式正确
   - 可以加载更多
   - 空状态显示友好提示

### 测试汇总列表点击跳转

1. 找到 Dashboard 的"资产更新记录"区域
2. 点击任意一条记录
3. 验证：
   - 自动切换到对应的资产 Tab
   - 页面平滑滚动到资产列表
   - 显示 Toast 提示

---

## 🔧 后续优化建议

1. **高亮定位**：点击汇总列表后，不仅切换 Tab，还能自动展开并高亮对应的资产卡片
2. **搜索过滤**：在更新记录 Tab 中添加搜索和操作类型筛选
3. **导出功能**：支持导出资产的更新记录为 Excel/PDF
4. **图表分析**：添加操作频率图表，可视化资产的变更趋势

---

## 📁 涉及文件列表

```
src/
├── app/
│   ├── api/
│   │   └── activity-logs/route.ts        # API 扩展
│   └── dashboard/page.tsx                 # 页面集成
│
├── components/
│   ├── shared/
│   │   └── asset-activity-timeline.tsx    # ✨ 新增：时间线组件
│   │
│   ├── dashboard/
│   │   └── activity-log-list.tsx          # 汇总列表优化
│   │
│   ├── holdings/
│   │   └── holding-detail-dialog.tsx      # 添加 Tabs
│   │
│   └── assets/
│       ├── asset-detail-dialog.tsx        # 添加 Tabs
│       └── real-estate-detail-dialog.tsx  # 添加 Tabs
│
└── lib/
    └── services/
        └── activity-log-service.ts        # 服务层扩展
```

---

## 🎉 总结

本次实现完成了**方案C：汇总视图 + 详情链接**：

1. ✅ Dashboard 保留汇总列表，快速概览全局活动
2. ✅ 点击汇总列表可跳转到对应的资产 Tab
3. ✅ 每个资产详情对话框都有独立的"更新记录" Tab
4. ✅ 时间线组件支持分页加载，展示完整历史

用户体验流程：
- **快速概览**：Dashboard 汇总列表查看最近活动
- **深入查看**：点击跳转到对应资产 Tab，再点击资产查看详情
- **完整历史**：在详情对话框的"更新记录" Tab 查看该资产的所有操作
