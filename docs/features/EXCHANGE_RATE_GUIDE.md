# 汇率管理功能指南

## 功能概述

系统集成了实时汇率管理功能，支持自动获取和手动刷新汇率数据，确保多币种资产计算的准确性。

## 核心功能

### 1. 实时汇率显示
- **位置**：仪表板页面 - 图表区域右侧
- **显示内容**：
  - USD/CNY（美元兑人民币）汇率
  - HKD/CNY（港币兑人民币）汇率
  - 更新时间
  - 数据来源（实时/默认）

### 2. 自动刷新机制
- **刷新频率**：每小时自动刷新一次
- **缓存机制**：
  - API调用时优先使用缓存（1小时内有效）
  - 缓存过期后自动获取最新数据
  - 数据保存到数据库 `system_config` 表

### 3. 手动刷新功能
- **操作方式**：点击汇率组件右上角的刷新按钮 🔄
- **效果**：
  - 立即获取最新汇率
  - 更新显示和数据库
  - 显示加载动画
  - 刷新后显示最新更新时间

## 技术实现

### 数据库表结构

```sql
CREATE TABLE system_config (
  config_key VARCHAR(100) PRIMARY KEY,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 汇率数据格式

```json
{
  "baseCurrency": "CNY",
  "rates": {
    "USD": 7.2,
    "HKD": 0.92,
    "CNY": 1
  },
  "lastUpdated": "2026-01-24T12:00:00.000Z",
  "source": "exchangerate-api.com"
}
```

### API端点

#### 获取汇率
```
GET /api/exchange-rates
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "baseCurrency": "CNY",
    "rates": {
      "USD": 7.2534,
      "HKD": 0.9265,
      "CNY": 1
    },
    "lastUpdated": "2026-01-24T12:00:00.000Z",
    "source": "exchangerate-api.com"
  },
  "cached": false
}
```

#### 刷新汇率
```
POST /api/exchange-rates
```

**响应示例**：
```json
{
  "success": true,
  "data": { /* 汇率数据 */ },
  "message": "汇率已更新"
}
```

## 汇率服务 API

### 导入和使用

```typescript
import { 
  getExchangeRates,
  refreshExchangeRates,
  convertCurrency,
  formatCurrencyAmount,
  type ExchangeRates
} from '@/lib/exchange-rate-service'

// 获取汇率
const rates = await getExchangeRates()

// 手动刷新
const newRates = await refreshExchangeRates()

// 货币转换
const amountInCNY = convertCurrency(100, 'USD', 'CNY', rates)
// 100 USD = 720 CNY

// 格式化金额
const formatted = formatCurrencyAmount(12345.67, 'USD')
// 输出: "$12,345.67"
```

### 核心方法

| 方法 | 说明 | 参数 | 返回值 |
|------|------|------|--------|
| `getExchangeRates()` | 获取当前汇率 | 无 | `Promise<ExchangeRates>` |
| `refreshExchangeRates()` | 手动刷新汇率 | 无 | `Promise<ExchangeRates>` |
| `convertCurrency()` | 货币转换 | amount, from, to, rates | `number` |
| `formatExchangeRate()` | 格式化汇率 | rate, decimals | `string` |
| `formatCurrencyAmount()` | 格式化金额 | amount, currency, showSymbol | `string` |
| `getCurrencySymbol()` | 获取货币符号 | currency | `string` |

## 汇率数据源

### 主数据源
- **API**: exchangerate-api.com
- **免费版限制**：每月1500次请求
- **更新频率**：每24小时更新一次
- **支持币种**：160+种货币

### 备用方案
当API请求失败时，系统使用默认汇率：
- USD/CNY: 7.2
- HKD/CNY: 0.92

## 在其他模块中使用汇率

### 账户余额计算
```typescript
import { getExchangeRates, convertCurrency } from '@/lib/exchange-rate-service'

// 获取汇率
const rates = await getExchangeRates()

// 转换USD余额为CNY
const usdBalance = 10000
const cnyBalance = convertCurrency(usdBalance, 'USD', 'CNY', rates)
// 结果: 72000 CNY（假设汇率为7.2）
```

### 持仓市值计算
```typescript
// 持仓原始货币
const holdings = [
  { symbol: 'AAPL', amount: 1000, currency: 'USD' },
  { symbol: '0700.HK', amount: 5000, currency: 'HKD' },
]

// 转换为CNY
const rates = await getExchangeRates()
const totalCNY = holdings.reduce((sum, h) => {
  return sum + convertCurrency(h.amount, h.currency, 'CNY', rates)
}, 0)
```

## 配置和维护

### 更换汇率数据源

如需更换汇率API，修改 `src/app/api/exchange-rates/route.ts` 中的 `fetchLiveExchangeRates` 函数：

```typescript
async function fetchLiveExchangeRates() {
  // 更换为新的API地址
  const response = await fetch('YOUR_NEW_API_URL', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY', // 如需要
    },
  })
  
  const data = await response.json()
  
  // 转换为统一格式
  return {
    baseCurrency: 'CNY',
    rates: {
      USD: data.usd_cny_rate,
      HKD: data.hkd_cny_rate,
      CNY: 1,
    },
    lastUpdated: new Date().toISOString(),
    source: 'your-api-name',
  }
}
```

### 调整刷新频率

修改 `src/components/dashboard/exchange-rate-widget.tsx` 中的自动刷新间隔：

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    loadRates()
  }, 30 * 60 * 1000) // 改为30分钟
  
  return () => clearInterval(interval)
}, [])
```

### 添加新货币

1. 修改汇率API获取逻辑：
```typescript
return {
  baseCurrency: 'CNY',
  rates: {
    USD: ...,
    HKD: ...,
    EUR: ..., // 新增欧元
    CNY: 1,
  },
  ...
}
```

2. 在汇率组件中显示：
```tsx
<div className="flex items-center justify-between">
  <span className="font-medium">EUR/CNY</span>
  <span className="font-mono">{rates.rates.EUR}</span>
</div>
```

## 故障排查

### 问题1：汇率显示"默认"
**原因**：API请求失败，使用备用汇率
**解决**：
1. 检查网络连接
2. 查看浏览器控制台错误日志
3. 手动点击刷新按钮重试

### 问题2：汇率组件不显示
**原因**：组件加载失败或权限问题
**解决**：
1. 确认已登录系统
2. 检查浏览器控制台错误
3. 清空浏览器缓存重试

### 问题3：汇率更新失败
**原因**：数据库写入失败
**解决**：
```sql
-- 检查system_config表
SELECT * FROM system_config WHERE config_key = 'EXCHANGE_RATES';

-- 手动插入默认汇率
INSERT INTO system_config (config_key, config_value, description)
VALUES (
  'EXCHANGE_RATES',
  '{"baseCurrency":"CNY","rates":{"USD":7.2,"HKD":0.92,"CNY":1}}'::jsonb,
  '汇率配置'
)
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;
```

### 问题4：API返回401错误
**原因**：未登录或session过期
**解决**：重新登录系统

## 最佳实践

### 1. 定期监控
- 每天检查汇率更新是否正常
- 对比实际汇率与系统汇率，误差应在0.5%以内

### 2. 缓存策略
- 保持1小时缓存时间，平衡实时性和API请求次数
- 避免短时间内多次刷新

### 3. 错误处理
- 始终提供默认汇率作为备用
- 在关键操作中显示汇率来源，让用户知道使用的是实时还是默认数据

### 4. 数据验证
- 检查汇率范围（USD/CNY应在6-8之间，HKD/CNY应在0.8-1.0之间）
- 异常汇率应记录日志并使用上次有效值

## 未来改进计划

- [ ] 支持更多货币对（EUR, JPY, GBP等）
- [ ] 历史汇率查询功能
- [ ] 汇率变化趋势图表
- [ ] 汇率预警（大幅波动时通知）
- [ ] 多数据源对比和验证
- [ ] 离线模式支持

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/app/api/exchange-rates/route.ts` | 汇率API端点 |
| `src/lib/exchange-rate-service.ts` | 汇率服务工具函数 |
| `src/components/dashboard/exchange-rate-widget.tsx` | 汇率显示组件 |
| `scripts/create-system-config-table.js` | 数据库表创建脚本 |

## 支持和联系

如有问题或建议，请：
1. 查看本文档的"故障排查"部分
2. 检查浏览器控制台和服务器日志
3. 联系系统管理员

---

**最后更新**: 2026-01-24  
**版本**: 1.0.0
