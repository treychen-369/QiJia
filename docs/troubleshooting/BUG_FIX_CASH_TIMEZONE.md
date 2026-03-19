# 现金编辑功能时区 Bug 修复

## 🐛 问题描述

用户编辑现金余额后，前端显示"更新成功"，但实际页面数据没有变化。

## 🔍 问题分析

### 现象
- ✅ 前端显示 API 返回 200 OK 和成功消息
- ✅ API 确实创建/更新了数据库记录
- ❌ Dashboard 页面数据没有更新

### 根本原因：**时区问题**

API 使用的日期查询逻辑有误：

```javascript
// 错误的代码
const today = new Date();
today.setHours(0, 0, 0, 0);  // 这是本地时间的零点！
```

**问题：**
1. 北京时间 `2026-01-24 00:00:00` 
2. 转换为 UTC 后变成 `2026-01-23 16:00:00Z`
3. 数据库中存储的是 `2026-01-24 00:00:00Z` (UTC)
4. 日期不匹配，导致 API 创建了新的 `2026-01-23` 记录，而不是更新 `2026-01-24` 的记录
5. Dashboard API 读取的是最新日期 (`2026-01-24`) 的记录，所以看不到变化

### 数据库证据

```
所有记录的日期:
  - 2026-01-24T00:00:00.000Z 现金: 93750.41  ← Dashboard 读取这条
  - 2026-01-23T00:00:00.000Z 现金: 1642      ← API 错误创建的
```

## ✅ 修复方案

### 1. 修复日期处理逻辑

**文件**: `src/app/api/accounts/[id]/cash/route.ts`

```javascript
// 修复后的代码
const today = new Date();
const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
console.log('今天的日期 (UTC):', todayUTC.toISOString());
```

**说明**：
- 使用 `Date.UTC()` 创建 UTC 时间的零点
- 例如：北京时间 2026-01-24 → `2026-01-24T00:00:00.000Z` (UTC)
- 与数据库中的日期格式完全一致

### 2. 清理重复记录

运行清理脚本删除错误创建的历史记录：

```bash
node scripts/cleanup-duplicate-records.js
```

## 🧪 测试验证

### 测试步骤

1. **刷新浏览器**: `Ctrl + Shift + R`

2. **编辑现金余额**:
   - 鼠标悬停在任意现金项上
   - 点击"编辑"按钮
   - 输入新金额（例如 `1642`）
   - 点击"保存"

3. **检查结果**:
   - ✅ 应该立即看到金额更新
   - ✅ 刷新页面后数据保持不变

### 验证日志

**前端控制台**应该显示：
```
=== 开始保存现金编辑 ===
账户ID: f398f384-1516-426f-9867-ace5deacd2ff
更新数据: {cashBalanceOriginal: 1642, currency: "USD"}
响应状态: 200 OK
✅ 现金余额更新成功: {success: true, data: {...}}
开始刷新 Dashboard 数据...
✅ Dashboard 刷新完成
```

**后端日志**应该显示：
```
=== 现金更新 API 被调用 ===
账户ID: f398f384-1516-426f-9867-ace5deacd2ff
用户ID: 3f6692cd-ddc6-4e08-b5b3-05f5929a0962
请求数据: { cashBalanceOriginal: 1642, currency: 'USD' }
今天的日期 (UTC): 2026-01-24T00:00:00.000Z
找到现有记录: ID: 82acad8c-06eb-448b-9fd9-f67b2ae69743
✅ 更新现有记录 ID: 82acad8c-06eb-448b-9fd9-f67b2ae69743
  旧值: 93750.41 -> 新值: 1642
✅ 更新成功！
```

### 数据库验证

运行查询确认数据已更新：

```bash
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); (async () => { const balance = await prisma.accountBalance.findFirst({ where: { accountId: 'f398f384-1516-426f-9867-ace5deacd2ff' }, orderBy: { snapshotDate: 'desc' } }); console.log('现金:', balance.cashBalanceOriginal); console.log('日期:', balance.snapshotDate.toISOString()); await prisma.$disconnect(); })()"
```

应该显示：
```
现金: 1642
日期: 2026-01-24T00:00:00.000Z
```

## 📝 相关文件

- `src/app/api/accounts/[id]/cash/route.ts` - 现金更新 API
- `src/components/dashboard/holdings-list.tsx` - 现金编辑 UI
- `src/components/cash/edit-cash-dialog.tsx` - 编辑对话框
- `scripts/cleanup-duplicate-records.js` - 清理脚本

## 🎯 经验教训

1. **时区处理**：处理日期时始终明确使用 UTC 时间
2. **数据库日期**：Prisma 存储的 `DateTime` 字段是 UTC 时间
3. **日志调试**：添加详细的日志对排查此类问题至关重要
4. **测试验证**：不仅要检查 API 响应，还要验证数据库实际变化

## ✅ 修复状态

- [x] 识别问题根源（时区不匹配）
- [x] 修复日期处理逻辑
- [x] 清理重复记录
- [x] 添加调试日志
- [x] 文档记录

---

**修复日期**: 2026-01-24  
**负责人**: AI Assistant  
**状态**: ✅ 已完成
