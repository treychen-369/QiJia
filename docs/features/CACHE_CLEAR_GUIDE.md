# 清除浏览器缓存指南

## 问题现象

如果你看到以下情况，说明浏览器使用了旧的缓存数据：
- ✅ 代码已修改
- ✅ 服务器已重启
- ❌ 但页面显示的还是旧数据（如：成本显示为 ¥0）

---

## 解决方案

### 方法1：硬刷新页面（推荐）⭐

**Windows/Linux**：
```
Ctrl + Shift + R
或
Ctrl + F5
```

**Mac**：
```
Cmd + Shift + R
或
Cmd + Option + R
```

### 方法2：清除网站数据

1. 打开开发者工具（F12）
2. 右键点击浏览器刷新按钮
3. 选择"清空缓存并硬性重新加载"

### 方法3：手动清除缓存

#### Chrome/Edge
1. 按 `Ctrl + Shift + Delete`
2. 选择"缓存的图片和文件"
3. 时间范围选择"全部"
4. 点击"清除数据"

#### Firefox
1. 按 `Ctrl + Shift + Delete`
2. 勾选"缓存"
3. 点击"立即清除"

### 方法4：使用无痕模式测试

```
Ctrl + Shift + N (Chrome/Edge)
Ctrl + Shift + P (Firefox)
```

无痕模式不使用缓存，可以验证是否是缓存问题。

---

## 开发者选项：禁用缓存

### 开发期间禁用缓存（推荐开发时使用）

1. 打开开发者工具（F12）
2. 切换到 `Network` (网络) 标签
3. 勾选 `Disable cache` (禁用缓存)
4. **保持开发者工具打开**

这样在开发过程中，每次刷新都会获取最新数据。

---

## Next.js 缓存清除

### 清除 Next.js 构建缓存

```bash
# 删除 .next 文件夹
rm -rf .next

# 或 Windows
rmdir /s /q .next

# 重新启动开发服务器
npm run dev
```

### 清除 Node 模块缓存

```bash
# 删除 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

---

## 验证缓存是否清除

### 1. 检查控制台时间戳

打开浏览器控制台（F12 → Console），刷新页面，查看：
- 网络请求的时间戳
- API 响应数据

### 2. 检查网络请求

1. 开发者工具 → Network 标签
2. 刷新页面
3. 查找 `dashboard` 请求
4. 点击查看 Response（响应数据）
5. 确认 `averageCost` 字段的值

### 3. 使用时间戳参数

在URL后添加时间戳强制刷新：
```
http://localhost:3000/dashboard?t=1234567890
```

---

## 常见问题

### Q1: 硬刷新后还是显示旧数据？

**可能原因**：
1. Service Worker 缓存
2. Next.js Server-side 缓存
3. API 响应缓存

**解决方法**：
```bash
# 1. 停止开发服务器 (Ctrl+C)
# 2. 清除 .next 文件夹
rm -rf .next
# 3. 重新启动
npm run dev
```

### Q2: 数据在数据库中是对的，但前端显示错误？

**检查步骤**：
1. 打开控制台查看是否有 JavaScript 错误
2. 检查 Network 标签，查看 API 响应数据
3. 确认前端数据映射逻辑是否正确

**调试代码**（临时添加到 page.tsx）：
```typescript
const holdingsData = dashboardData.topHoldings.map(holding => {
  console.log('原始数据:', {
    name: holding.security.name,
    averageCost: holding.averageCost,
    convertedCost: Number(holding.averageCost || 0)
  });
  // ... 其余映射逻辑
});
```

### Q3: 为什么 averageCost 显示为 0？

**可能原因**：
1. 数据库中 `averageCost` 字段确实为 0 或 NULL
2. API 没有包含 `averageCost` 字段
3. 前端映射逻辑错误
4. 浏览器缓存了旧数据

**验证方法**：
```bash
# 直接查询数据库
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.holding.findFirst({ where: { security: { name: { contains: '腾讯' } } } }).then(h => { console.log('averageCost:', h.averageCost?.toString()); prisma.$disconnect(); });"
```

---

## 最佳实践

### 开发期间

1. ✅ 始终打开开发者工具
2. ✅ 勾选 "Disable cache"
3. ✅ 使用硬刷新（Ctrl + Shift + R）
4. ✅ 定期清除 .next 文件夹

### 调试时

1. ✅ 添加 console.log 查看数据流
2. ✅ 使用 Network 标签检查 API 响应
3. ✅ 对比数据库数据和前端显示
4. ✅ 使用无痕模式验证

### 生产环境

1. ✅ 为静态资源添加版本号或哈希
2. ✅ 设置合理的 Cache-Control 头
3. ✅ 使用 Service Worker 管理缓存
4. ✅ 提供"刷新数据"按钮

---

## 快速检查清单

当遇到数据显示问题时，按以下顺序检查：

- [ ] 1. 硬刷新页面（Ctrl + Shift + R）
- [ ] 2. 清除浏览器缓存
- [ ] 3. 检查开发者工具控制台是否有错误
- [ ] 4. 检查 Network 标签的 API 响应
- [ ] 5. 验证数据库中的实际数据
- [ ] 6. 检查前端数据映射逻辑
- [ ] 7. 重启开发服务器
- [ ] 8. 删除 .next 文件夹并重启

---

## 相关命令

```bash
# 查看持仓数据
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.holding.findFirst({ where: { security: { name: { contains: '腾讯' } } } }).then(h => { console.log('数据:', h); prisma.$disconnect(); });"

# 清除 Next.js 缓存
rm -rf .next

# 重启开发服务器
npm run dev

# 强制重新安装依赖
rm -rf node_modules package-lock.json && npm install
```

---

**当前问题修复状态**：
- ✅ 代码逻辑已修复（市值实时计算）
- ✅ API 返回正确数据（averageCost = 654）
- ⚠️ 需要清除浏览器缓存查看效果

**下一步操作**：
1. 按 `Ctrl + Shift + R` 硬刷新页面
2. 如果还不行，清除浏览器缓存
3. 最后手段：重启开发服务器并清除 .next 文件夹
