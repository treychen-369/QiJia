# 涨跌颜色方案配置功能

## 功能概述

添加了用户可配置的涨跌颜色方案功能，支持两种颜色方案：
- **涨红跌绿**（默认）- 中国大陆股市习惯
- **涨绿跌红** - 国际股市习惯（美股、港股）

## 文件结构

### 新增文件

1. **`src/lib/user-preferences.ts`** - 用户偏好设置管理
   - `getUserPreferences()` - 获取用户偏好
   - `saveUserPreferences()` - 保存用户偏好
   - `getPnLColorClass()` - 获取涨跌文字颜色类名
   - `getPnLBgColorClass()` - 获取涨跌背景颜色类名
   - `getColorSchemeName()` - 获取颜色方案显示名称

2. **`src/hooks/use-user-preferences.ts`** - React Hook
   - 自动监听偏好设置变化
   - 实时更新组件显示

3. **`src/components/settings/preferences-dialog.tsx`** - 设置对话框
   - 可视化颜色方案选择
   - 实时预览效果
   - 保存/恢复默认功能

### 修改的文件

1. **`src/app/dashboard/page.tsx`**
   - 导入 `PreferencesDialog` 和 `useUserPreferences`
   - 在顶部导航栏添加设置按钮

2. **`src/components/dashboard/asset-overview.tsx`**
   - 使用 `getPnLColorClass()` 替换硬编码颜色
   - 今日收益和累计收益动态颜色显示

3. **`src/components/dashboard/holdings-list.tsx`**
   - 持仓列表中的盈亏、今日涨跌使用动态颜色

4. **`src/app/holdings/[id]/page.tsx`**
   - 持仓详情页面的盈亏显示使用动态颜色

5. **`src/components/holdings/edit-holding-dialog.tsx`**
   - 输入框体验优化（聚焦时自动全选）

## 使用方法

### 用户操作

1. **打开设置**
   - 点击仪表板顶部的 "偏好设置" 按钮

2. **选择颜色方案**
   - 点击 "涨红跌绿"（默认）或 "涨绿跌红"
   - 查看实时预览效果

3. **保存设置**
   - 点击 "保存" 按钮
   - 设置立即生效，所有页面自动更新

4. **恢复默认**
   - 点击 "恢复默认" 恢复为涨红跌绿

### 开发者使用

在任何组件中使用颜色方案：

```typescript
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { getPnLColorClass } from '@/lib/user-preferences';

export function MyComponent() {
  const preferences = useUserPreferences();
  
  return (
    <div className={getPnLColorClass(someValue, preferences.colorScheme)}>
      {someValue > 0 ? '+' : ''}{someValue}%
    </div>
  );
}
```

## 数据存储

- 偏好设置存储在浏览器的 `localStorage` 中
- 键名：`finance-app-preferences`
- 格式：JSON 对象
  ```json
  {
    "colorScheme": "red-green"  // 或 "green-red"
  }
  ```

## 颜色映射表

### 涨红跌绿（red-green）

| 场景 | 颜色 |
|------|------|
| 上涨 | 红色（text-red-600 / dark:text-red-400） |
| 下跌 | 绿色（text-green-600 / dark:text-green-400） |
| 持平 | 灰色（text-slate-600 / dark:text-slate-400） |

### 涨绿跌红（green-red）

| 场景 | 颜色 |
|------|------|
| 上涨 | 绿色（text-green-600 / dark:text-green-400） |
| 下跌 | 红色（text-red-600 / dark:text-red-400） |
| 持平 | 灰色（text-slate-600 / dark:text-slate-400） |

## 生效范围

颜色方案应用于以下所有涨跌显示位置：

✅ **仪表板**
- 今日收益卡片
- 累计收益卡片
- 持仓列表中的盈亏
- 持仓列表中的今日涨跌

✅ **持仓详情页**
- 未实现盈亏卡片
- 盈亏图标

✅ **实时更新**
- 切换设置后所有页面立即更新
- 无需刷新页面

## 技术实现

### 事件驱动更新

使用自定义事件 `preferences-changed` 实现跨组件通信：

```typescript
// 保存时触发
window.dispatchEvent(new CustomEvent('preferences-changed', { 
  detail: updatedPreferences 
}));

// 组件中监听
window.addEventListener('preferences-changed', handler);
```

### 类型安全

完整的 TypeScript 类型定义：

```typescript
export type ColorScheme = 'red-green' | 'green-red';

export interface UserPreferences {
  colorScheme: ColorScheme;
}
```

## 未来扩展

可以轻松添加更多偏好设置：

```typescript
export interface UserPreferences {
  colorScheme: ColorScheme;
  theme: 'light' | 'dark' | 'auto';       // 主题设置
  currency: 'CNY' | 'USD' | 'HKD';        // 默认货币
  language: 'zh-CN' | 'en-US';            // 语言设置
  numberFormat: 'compact' | 'full';       // 数字格式
}
```

## 测试建议

1. **功能测试**
   - 切换颜色方案后检查所有页面
   - 验证 localStorage 正确存储
   - 刷新页面后设置保持

2. **跨浏览器测试**
   - Chrome、Edge、Firefox、Safari
   - 验证 localStorage 兼容性

3. **暗色模式测试**
   - 验证两种颜色方案在暗色模式下的显示效果

## 注意事项

- 设置仅存储在本地浏览器，不同设备/浏览器需要重新设置
- 清除浏览器数据会导致设置丢失
- 未来可考虑将设置同步到后端数据库

## 用户反馈

如果用户希望添加新的颜色方案或自定义颜色，可以在 `user-preferences.ts` 中扩展：

```typescript
export type ColorScheme = 'red-green' | 'green-red' | 'custom';

// 添加自定义颜色配置
export const colorSchemeConfig = {
  'red-green': { up: 'text-red-600', down: 'text-green-600' },
  'green-red': { up: 'text-green-600', down: 'text-red-600' },
  'custom': { up: 'text-blue-600', down: 'text-orange-600' },
};
```
