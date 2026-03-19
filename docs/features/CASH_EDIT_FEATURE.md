# 现金编辑功能说明

## 功能概述
为现金账户添加了直接编辑功能，用户可以快速更新账户现金余额和币种。

## 新增组件

### 1. EditCashDialog (编辑现金对话框)
**位置**: `src/components/cash/edit-cash-dialog.tsx`

**功能**:
- 编辑账户现金余额
- 选择货币类型（CNY/USD/HKD）
- 实时预览更新后的余额
- 输入框自动选中优化体验

**字段**:
- `cashBalanceOriginal`: 原币种金额
- `currency`: 货币类型

### 2. 后端API
**位置**: `src/app/api/accounts/[id]/cash/route.ts`

**端点**: `PUT /api/accounts/{accountId}/cash`

**功能**:
- 验证用户权限
- 更新账户余额记录（AccountBalance表）
- 自动计算CNY折算值
- 更新总市值（现金 + 持仓）

**请求体**:
```json
{
  "cashBalanceOriginal": 93750.41,
  "currency": "USD"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "cashBalanceOriginal": 93750.41,
    "cashBalanceCny": 675003.00,
    "totalMarketValueCny": 1234567.89,
    "exchangeRate": 7.2
  }
}
```

## 更新的组件

### HoldingsList 组件
**位置**: `src/components/dashboard/holdings-list.tsx`

**新增功能**:
1. 现金项显示"编辑"按钮（hover时可见）
2. 点击编辑按钮打开现金编辑对话框
3. 保存后自动刷新列表

**UI变化**:
- 现金项：显示"编辑"按钮
- 持仓项：保持原有下拉菜单

## 使用流程

1. **查看现金项**
   - 登录系统（使用 user@example.com）
   - 进入Dashboard
   - 在持仓列表底部看到现金项（蓝色渐变卡片）

2. **编辑现金余额**
   - 鼠标悬停在现金项上
   - 点击右侧出现的"编辑"按钮
   - 在对话框中输入新的金额
   - 选择货币类型（如需修改）
   - 点击"保存"

3. **自动更新**
   - 保存成功后显示提示
   - 页面自动刷新显示最新数据
   - 资产概览中的总现金也会同步更新

## 数据流程

```
用户编辑
    ↓
EditCashDialog 收集数据
    ↓
调用 PUT /api/accounts/{id}/cash
    ↓
验证权限 + 计算汇率
    ↓
更新 AccountBalance 表
    ↓
返回成功响应
    ↓
刷新 Dashboard 数据
    ↓
现金项显示更新后的金额
```

## 汇率处理

当前使用固定汇率（简化实现）：
- USD: 7.2
- HKD: 0.92
- CNY: 1.0

**计算公式**:
```
cashBalanceCny = cashBalanceOriginal × exchangeRate
totalMarketValueCny = cashBalanceCny + holdingsValueCny
```

## 注意事项

1. **权限验证**: 只能编辑自己的账户
2. **数据验证**: 金额必须 ≥ 0
3. **币种限制**: 仅支持 CNY/USD/HKD
4. **自动刷新**: 编辑后会自动刷新整个Dashboard
5. **日期处理**: 使用当天日期创建/更新余额快照

## 测试场景

### 场景1: 编辑美元账户
- 账户: 长桥美股账户
- 原金额: $93,750.41
- 新金额: $100,000.00
- 预期: 显示 $100,000.00，CNY约 ¥720,000

### 场景2: 修改币种
- 账户: 平安证券账户
- 原币种: CNY
- 新币种: USD
- 需要同时修改金额以匹配实际情况

### 场景3: 清零现金
- 输入金额: 0
- 预期: 该现金项从列表中消失（过滤条件：> 0）

## 未来优化建议

1. **实时汇率**: 集成汇率API获取实时汇率
2. **历史记录**: 保留现金余额的历史变更记录
3. **批量编辑**: 支持同时编辑多个账户现金
4. **货币转换**: 提供币种转换计算器
5. **自动同步**: 与券商API对接自动同步余额

## 相关文件

- `src/components/cash/edit-cash-dialog.tsx` - 编辑对话框
- `src/components/dashboard/holdings-list.tsx` - 持仓列表（含现金项）
- `src/app/api/accounts/[id]/cash/route.ts` - 现金更新API
- `src/app/dashboard/page.tsx` - Dashboard主页面

## 开发者注意

修改现金相关逻辑时，请注意：
1. 同步更新 `AccountBalance` 表的所有相关字段
2. 确保 `totalMarketValueCny` = 现金 + 持仓
3. 保持与Dashboard API的数据格式一致
4. 测试不同币种的显示和计算
