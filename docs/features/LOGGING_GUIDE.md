# 日志系统使用指南

## 概述

本项目实现了一个可配置的日志系统，用于：
1. **安全性** - 防止敏感信息（用户邮箱、金额、密码等）在生产环境中泄露
2. **可配置性** - 支持通过环境变量动态调整日志等级
3. **可运维性** - 支持在不修改代码的情况下开启/关闭调试日志

## 环境变量配置

在 `.env.local` 或生产环境配置中添加以下变量：

```bash
# 日志级别: debug, info, warn, error, none
# - debug: 显示所有日志（仅开发环境推荐）
# - info: 显示 info, warn, error 日志
# - warn: 显示 warn, error 日志（生产环境推荐）
# - error: 仅显示 error 日志
# - none: 禁用所有日志
LOG_LEVEL="warn"

# 是否启用日志输出 (true/false)
LOG_ENABLED="true"

# 是否显示敏感信息 (true/false)
# ⚠️ 警告: 生产环境中必须设置为 false
# 设置为 true 时会显示完整的用户信息、金额等敏感数据
# 设置为 false 时会对邮箱、金额等进行脱敏处理
LOG_SENSITIVE="false"
```

## 推荐配置

### 开发环境
```bash
LOG_LEVEL="debug"
LOG_ENABLED="true"
LOG_SENSITIVE="true"   # 仅开发环境可设为 true
```

### 生产环境
```bash
LOG_LEVEL="warn"
LOG_ENABLED="true"
LOG_SENSITIVE="false"  # ⚠️ 必须为 false
```

### 排查问题时临时开启调试
```bash
LOG_LEVEL="debug"      # 临时改为 debug
LOG_ENABLED="true"
LOG_SENSITIVE="false"  # 保持 false
```

## 日志等级说明

| 等级 | 用途 | 示例 |
|------|------|------|
| `debug` | 开发调试信息 | 计算过程、中间变量 |
| `info` | 重要操作记录 | 用户登录、数据同步 |
| `warn` | 警告信息 | 数据缺失、降级处理 |
| `error` | 错误信息 | API错误、数据库异常 |

## 敏感信息脱敏规则

当 `LOG_SENSITIVE="false"` 时：

| 字段类型 | 脱敏方式 | 示例 |
|----------|----------|------|
| 邮箱 | 保留前2字符 + *** + @域名 | `tr***@example.com` |
| 用户ID | 保留前后2字符 | `ab****cd` |
| 金额 | 模糊化显示 | `~123k` (约123,000) |
| 密码/Token | 完全隐藏 | `[REDACTED]` |

## 代码使用方式

### 创建模块级 Logger

```typescript
import { createLogger } from '@/lib/logger';

const logger = createLogger('ModuleName');

// 使用
logger.debug('调试信息', { data: someData });
logger.info('操作记录', { userId: 'xxx' });
logger.warn('警告信息', error);
logger.error('错误信息', error);
```

### 使用默认 Logger

```typescript
import { debug, info, warn, error } from '@/lib/logger';

debug('调试信息');
info('操作记录');
warn('警告信息');
error('错误信息');
```

## 安全注意事项

### ⚠️ 生产环境必须遵守

1. **永远不要**在生产环境设置 `LOG_SENSITIVE="true"`
2. **永远不要**在日志中直接输出密码、Token 等凭证
3. **推荐**使用 `warn` 或更高等级作为生产环境的默认日志等级
4. **定期审计**日志输出，确保没有敏感信息泄露

### 已自动脱敏的字段

以下字段在日志输出时会自动处理：
- `password`, `token`, `secret`, `apiKey` → `[REDACTED]`
- `email`, `phone`, `userId`, `accountNumber` → 部分脱敏
- `amount`, `balance`, `value`, `price` 等金额字段 → 模糊化

## 迁移指南

如果需要将旧代码的 `console.log` 迁移到新的日志系统：

```typescript
// 旧代码
console.log('用户登录:', user.email);
console.error('错误:', error);

// 新代码
import { createLogger } from '@/lib/logger';
const logger = createLogger('Auth');

logger.info('用户登录', { email: user.email });  // email 会自动脱敏
logger.error('错误', error);
```

## 性能考虑

- Logger 会检查当前日志等级，低于阈值的日志不会执行字符串拼接
- 大型数组（>10项）在非敏感模式下只显示长度
- 建议在循环内避免大量 debug 日志

## 问题排查

### 日志不显示？
1. 检查 `LOG_ENABLED` 是否为 `"true"`
2. 检查 `LOG_LEVEL` 是否设置正确
3. 确认使用的是 `logger.xxx()` 而不是 `console.xxx()`

### 日志显示 [REDACTED]？
这是正常的安全行为，敏感字段被自动隐藏。如需查看完整内容：
- 开发环境：设置 `LOG_SENSITIVE="true"`
- 生产环境：**禁止**设置为 true，请通过其他安全方式获取数据

### 金额显示为 ~123k？
这是金额脱敏的结果，表示约 123,000。如需精确数值，请在开发环境启用 `LOG_SENSITIVE="true"`。
