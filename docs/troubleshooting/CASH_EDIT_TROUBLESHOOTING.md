# 现金编辑功能 - 故障排除指南

## 问题：编辑后前端不刷新

### 根本原因
浏览器和 Next.js 的多层缓存导致更新后的数据无法立即显示。

### 解决方案
已实施以下修复：

#### 1. 前端 API 客户端禁用缓存
**文件**: `src/lib/api-client.ts`

```typescript
// 添加缓存控制头
headers: {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
}

// 添加时间戳参数防止 URL 缓存
async getDashboardData(): Promise<DashboardData> {
  const timestamp = Date.now();
  return this.request<DashboardData>(`/dashboard?_t=${timestamp}`)
}
```

#### 2. Dashboard API 响应禁用缓存
**文件**: `src/app/api/dashboard/route.ts`

```typescript
return NextResponse.json(dashboardData, {
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
})
```

#### 3. 现金更新 API 禁用缓存
**文件**: `src/app/api/accounts/[id]/cash/route.ts`

```typescript
return NextResponse.json({ success: true, data }, {
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  },
})
```

#### 4. 强制刷新逻辑优化
**文件**: `src/components/dashboard/holdings-list.tsx`

```typescript
// 使用 await 确保刷新完成
if (onRefresh) {
  await onRefresh();
}
```

## 测试步骤

### 1. 清除浏览器缓存
```
Chrome: Ctrl + Shift + Delete
或者硬刷新: Ctrl + Shift + R
```

### 2. 编辑现金余额
1. 进入 Dashboard
2. 鼠标悬停在现金项上
3. 点击"编辑"按钮
4. 修改金额（例如：从 $93,750.41 改为 $100,000.00）
5. 点击"保存"

### 3. 验证更新
- ✅ 显示"更新成功"提示
- ✅ 现金项金额立即更新
- ✅ 资产概览中的总现金同步更新
- ✅ 控制台显示成功日志

### 4. 检查数据库
运行测试脚本：
```bash
node scripts/test-cash-update.js
```

应该看到最新的记录（按 `snapshotDate` 和 `createdAt` 判断）。

## 调试技巧

### 查看网络请求
打开浏览器开发者工具 → Network 标签

**更新现金时应该看到：**
1. `PUT /api/accounts/{id}/cash` - 返回 200
2. `GET /api/dashboard?_t={timestamp}` - 返回最新数据

**检查响应头：**
```
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

### 查看控制台日志
编辑现金后应该看到：
```
现金余额更新成功: { success: true, data: {...} }
```

### 手动刷新测试
点击"同步数据"按钮，应该立即看到最新数据。

## 常见问题

### Q1: 显示"更新成功"但金额没变
**排查：**
1. 检查网络请求是否成功（200状态码）
2. 查看数据库是否真的更新了
3. 清除浏览器缓存
4. 检查是否使用了正确的账户登录

**命令：**
```bash
# 查看数据库最新数据
node scripts/test-cash-update.js

# 查看用户关联
node scripts/debug-user-data.js
```

### Q2: API 返回 404 错误
**原因：** 账户 ID 提取错误

**检查：**
```typescript
// holding.id 格式应该是: "cash-{accountId}"
const accountId = holding.id.replace('cash-', '');
```

### Q3: 刷新后又变回旧值
**原因：** 缓存未清除

**解决：**
1. 硬刷新页面（Ctrl + Shift + R）
2. 清除浏览器缓存
3. 重启开发服务器

### Q4: 多个账户同时显示
**原因：** 未按日期分组

**检查 Dashboard API：**
```typescript
// 应该只取每个账户的最新记录
const latestBalances = accountBalances.reduce((acc, balance) => {
  const accountId = balance.accountId
  if (!acc[accountId] || balance.snapshotDate > acc[accountId].snapshotDate) {
    acc[accountId] = balance
  }
  return acc
}, {})
```

## 性能优化建议

### 1. 局部刷新
当前实现刷新整个 Dashboard，可以优化为只刷新现金项：

```typescript
// 未来优化：只更新特定账户的现金
const updateCashOnly = async (accountId: string) => {
  const response = await fetch(`/api/accounts/${accountId}/balance`);
  // 只更新该账户的现金显示
}
```

### 2. 乐观更新
在 API 响应之前先更新 UI：

```typescript
// 乐观更新
setHoldings(prev => prev.map(h => 
  h.id === cashId ? { ...h, marketValueOriginal: newAmount } : h
));

// 然后发送 API 请求
await updateCash(...);
```

### 3. WebSocket 实时同步
使用 WebSocket 推送更新，避免轮询：

```typescript
// 服务端推送更新
socket.emit('cash-updated', { accountId, newAmount });

// 客户端监听
socket.on('cash-updated', (data) => {
  updateCashDisplay(data);
});
```

## 回滚方案

如果缓存禁用导致性能问题，可以使用以下策略：

### 1. SWR (Stale-While-Revalidate)
```typescript
import useSWR from 'swr';

const { data, mutate } = useSWR('/api/dashboard', fetcher);

// 更新后手动触发重新验证
await mutate();
```

### 2. React Query
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

// 更新后使缓存失效
await queryClient.invalidateQueries(['dashboard']);
```

## 监控和日志

### 添加性能监控
```typescript
console.time('dashboard-load');
const data = await apiClient.getDashboardData();
console.timeEnd('dashboard-load');
```

### 添加错误追踪
```typescript
try {
  await updateCash(...);
} catch (error) {
  // 发送到错误追踪服务
  Sentry.captureException(error);
}
```

## 总结

✅ 已修复缓存导致的刷新问题
✅ 添加了多层缓存控制
✅ 优化了刷新逻辑
✅ 提供了完整的调试工具

现在编辑现金余额后应该能立即看到更新！
