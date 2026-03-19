# 📊 QiJia Finance System 使用指南

## 🎯 快速开始

### 🚀 立即体验（推荐）

**最简单的方式 - 一键设置：**

```bash
# Windows用户
npm run setup

# 或者手动步骤
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

**首次使用：**
- 访问 http://localhost:3000 注册您的账户
- 或运行 `npm run db:seed` 创建测试账户（仅开发环境）

访问 http://localhost:3000 开始使用！

---

## 📋 目录
- [系统概览](#系统概览)
- [核心功能](#核心功能)
- [详细使用教程](#详细使用教程)
- [API使用指南](#api使用指南)
- [高级配置](#高级配置)
- [故障排除](#故障排除)

---

## 🌟 系统概览

QiJia Finance System 是一个现代化的个人财务管理系统，专为投资者设计，提供：

### ✨ 核心特性
- 🏦 **多投资组合管理** - 创建和管理多个投资组合
- 📈 **实时数据同步** - 自动获取最新股票价格和市场数据
- 📊 **智能分析报告** - 收益分析、风险评估、趋势预测
- 🔄 **多数据源支持** - 同花顺、东方财富、雪球等主流平台
- 📱 **响应式设计** - 完美适配桌面和移动设备
- 🔐 **安全可靠** - 企业级安全保护和数据加密

### 🎨 界面预览
- **现代化UI** - 基于最新设计趋势的直观界面
- **深色模式** - 支持明暗主题切换
- **图表可视化** - 丰富的图表展示投资数据
- **实时更新** - 数据变化实时反映在界面上

---

## 🔧 核心功能

### 1. 👤 用户管理

#### 注册新账户
1. 访问系统首页
2. 点击"注册"按钮
3. 填写邮箱、姓名、密码
4. 验证邮箱（如果启用）
5. 完成注册并自动登录

#### 登录系统
- **邮箱登录** - 使用注册邮箱和密码
- **记住登录** - 选择保持登录状态
- **密码重置** - 忘记密码时的重置功能

### 2. 💼 投资组合管理

#### 创建投资组合
```
导航：首页 → 投资组合 → 创建新组合
```

**步骤：**
1. 点击"创建投资组合"按钮
2. 填写组合信息：
   - 📝 组合名称（如：成长型组合）
   - 📄 描述信息（投资策略说明）
   - 💰 初始资金
   - 🎯 投资目标
3. 选择投资策略：
   - 稳健型（低风险）
   - 平衡型（中等风险）
   - 成长型（高风险）
4. 保存并创建

#### 添加股票持仓
```
导航：投资组合 → 选择组合 → 添加持仓
```

**步骤：**
1. 在组合详情页点击"添加持仓"
2. 搜索股票：
   - 输入股票代码（如：000001）
   - 或输入股票名称（如：平安银行）
3. 填写持仓信息：
   - 📊 持仓数量
   - 💵 买入价格
   - 📅 买入日期
   - 📝 备注信息
4. 确认添加

#### 编辑持仓
- **修改数量** - 调整持仓股数
- **更新成本** - 修改平均成本价
- **添加备注** - 记录投资理由
- **设置止损** - 配置风险控制

### 3. 📈 数据同步管理

#### 配置数据源
```
导航：设置 → 数据同步 → 数据源管理
```

**支持的数据源：**

1. **东方财富** 🥇
   - ✅ 免费使用
   - ✅ 数据准确
   - ✅ 更新及时
   - 📊 支持A股全市场

2. **同花顺** 🥈
   - 🔑 需要API密钥
   - ✅ 专业数据
   - ✅ 多市场支持
   - 📊 包含技术指标

3. **雪球** 🥉
   - 🍪 需要Cookie认证
   - ✅ 社区数据
   - ✅ 港美股支持
   - 📊 投资组合分析

**配置步骤：**
1. 选择数据源
2. 输入API密钥或认证信息
3. 测试连接
4. 保存配置

#### 设置自动同步
```
导航：设置 → 数据同步 → 定时同步
```

**同步选项：**
- ⏰ **同步频率**：1分钟 - 24小时
- 📊 **同步范围**：全部持仓 / 指定股票
- 🔄 **同步策略**：实时 / 定时 / 手动
- 📱 **通知设置**：同步完成通知

**推荐配置：**
- 交易时间：每5分钟同步
- 非交易时间：每小时同步
- 节假日：每日同步一次

#### 手动同步
```
导航：设置 → 数据同步 → 手动同步
```

**操作步骤：**
1. 选择要同步的股票
2. 选择数据源（可多选）
3. 点击"立即同步"
4. 查看同步结果

### 4. 📊 数据分析

#### 投资组合总览
```
导航：首页 → 投资组合总览
```

**关键指标：**
- 💰 **总资产** - 当前投资组合总价值
- 📈 **总收益** - 累计盈亏金额
- 📊 **收益率** - 投资回报率百分比
- 📉 **今日盈亏** - 当日收益变化
- 🎯 **资产配置** - 各股票占比分布

#### 收益分析报告
```
导航：分析 → 收益分析
```

**分析维度：**
1. **时间维度**
   - 日收益趋势
   - 周收益对比
   - 月度收益统计
   - 年度收益回顾

2. **股票维度**
   - 个股收益贡献
   - 行业收益分布
   - 风险收益散点图
   - 相关性分析

3. **风险维度**
   - 波动率分析
   - 最大回撤
   - 夏普比率
   - VaR风险价值

#### 自定义报告
```
导航：分析 → 自定义报告
```

**报告类型：**
- 📊 **图表报告** - 可视化数据展示
- 📄 **表格报告** - 详细数据列表
- 📈 **趋势报告** - 时间序列分析
- 🎯 **对比报告** - 多组合对比分析

### 5. 📤 数据导出

#### Excel导出
```
导航：任意数据页面 → 导出 → Excel格式
```

**导出内容：**
- 📊 持仓明细
- 📈 交易记录
- 💰 收益统计
- 📉 历史数据

#### PDF报告
```
导航：分析 → 生成PDF报告
```

**报告内容：**
- 📋 投资组合概况
- 📊 收益分析图表
- 📈 风险评估报告
- 🎯 投资建议

---

## 🔌 API使用指南

### 认证方式

所有API请求都需要用户认证：

```javascript
// 获取认证Token
const response = await fetch('/api/auth/signin', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'your-email@example.com',
    password: 'your-password'
  })
});
```

### 核心API端点

#### 1. 投资组合API

**获取投资组合列表**
```http
GET /api/portfolios
Authorization: Bearer <token>
```

**创建投资组合**
```http
POST /api/portfolios
Content-Type: application/json

{
  "name": "成长型组合",
  "description": "专注成长股投资",
  "initialValue": 100000
}
```

**获取组合详情**
```http
GET /api/portfolios/{id}
Authorization: Bearer <token>
```

#### 2. 股票数据API

**获取股票价格**
```http
GET /api/stocks/{symbol}
Authorization: Bearer <token>
```

**批量获取股票数据**
```http
POST /api/stocks/batch
Content-Type: application/json

{
  "symbols": ["000001", "600036", "600519"]
}
```

#### 3. 数据同步API

**手动同步股票数据**
```http
POST /api/sync/stocks
Content-Type: application/json

{
  "symbols": ["000001", "600036"],
  "force": true
}
```

**获取同步状态**
```http
GET /api/sync/status
Authorization: Bearer <token>
```

**配置同步计划**
```http
POST /api/sync/schedule
Content-Type: application/json

{
  "interval": 300,
  "autoSync": true,
  "dataSources": ["eastmoney", "tonghuashun"]
}
```

### JavaScript SDK示例

```javascript
class FinanceAPI {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.token = null;
  }

  async login(email, password) {
    const response = await fetch(`${this.baseURL}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (response.ok) {
      const data = await response.json();
      this.token = data.token;
      return data;
    }
    throw new Error('登录失败');
  }

  async getPortfolios() {
    const response = await fetch(`${this.baseURL}/api/portfolios`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return response.json();
  }

  async syncStocks(symbols) {
    const response = await fetch(`${this.baseURL}/api/sync/stocks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ symbols })
    });
    return response.json();
  }
}

// 使用示例
const api = new FinanceAPI();
await api.login('your-email@example.com', 'your-password');
const portfolios = await api.getPortfolios();
await api.syncStocks(['000001', '600036']);
```

---

## ⚙️ 高级配置

### 1. 环境变量配置

创建 `.env.local` 文件：

```bash
# 数据库配置
DATABASE_URL="postgresql://user:pass@localhost:5432/finance_system"

# 认证配置
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# 数据源API配置
TONGHUASHUN_API_KEY="your-api-key"
EASTMONEY_API_KEY="your-api-key"
XUEQIU_COOKIE="your-cookie"

# 邮件服务
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT=587
EMAIL_FROM="noreply@yourfinance.com"

# Redis缓存（可选）
REDIS_URL="redis://localhost:6379"
```

### 2. 数据库优化

#### 索引优化
```sql
-- 为常用查询添加索引
CREATE INDEX idx_holdings_portfolio_id ON holdings(portfolio_id);
CREATE INDEX idx_stocks_symbol ON stocks(symbol);
CREATE INDEX idx_transactions_date ON transactions(date);
```

#### 定期维护
```bash
# 数据库备份
pg_dump $DATABASE_URL > backup.sql

# 数据库清理
npm run db:cleanup

# 重建索引
npm run db:reindex
```

### 3. 性能优化

#### 缓存配置
```javascript
// Redis缓存配置
const cacheConfig = {
  stockPrices: { ttl: 300 }, // 5分钟
  marketData: { ttl: 600 },  // 10分钟
  userSessions: { ttl: 3600 } // 1小时
};
```

#### 数据同步优化
```javascript
// 批量同步配置
const syncConfig = {
  batchSize: 50,        // 每批处理50只股票
  concurrency: 3,       // 并发3个请求
  retryAttempts: 3,     // 重试3次
  retryDelay: 1000      // 重试间隔1秒
};
```

### 4. 监控和日志

#### 应用监控
```bash
# 使用PM2监控
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

#### 自定义日志
```javascript
// 配置日志级别
const logConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: 'json',
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
};
```

---

## 🔧 故障排除

### 常见问题解决

#### 1. 数据同步失败

**问题：** 股票数据无法同步

**解决方案：**
```bash
# 检查网络连接
curl -I https://quote.eastmoney.com

# 检查API配置
echo $TONGHUASHUN_API_KEY

# 重置同步服务
npm run sync:reset

# 查看同步日志
npm run logs:sync
```

#### 2. 数据库连接问题

**问题：** 无法连接到数据库

**解决方案：**
```bash
# 检查数据库状态
pg_isready -h localhost -p 5432

# 测试连接
psql $DATABASE_URL -c "SELECT 1;"

# 重置数据库连接
npm run db:reset-connection
```

#### 3. 登录认证问题

**问题：** 无法登录或会话过期

**解决方案：**
```bash
# 清除浏览器缓存和Cookie
# 检查NEXTAUTH_SECRET配置
echo $NEXTAUTH_SECRET

# 重置用户密码
npm run user:reset-password admin@finance.com
```

#### 4. 性能问题

**问题：** 页面加载缓慢

**解决方案：**
```bash
# 检查数据库查询性能
npm run db:analyze

# 清理缓存
npm run cache:clear

# 优化图片资源
npm run optimize:images

# 检查内存使用
npm run monitor:memory
```

### 日志分析

#### 查看应用日志
```bash
# 实时日志
npm run logs:tail

# 错误日志
npm run logs:error

# 同步日志
npm run logs:sync

# 性能日志
npm run logs:performance
```

#### 调试模式
```bash
# 启用调试模式
DEBUG=finance:* npm run dev

# 数据库调试
DEBUG=prisma:* npm run dev

# API调试
DEBUG=api:* npm run dev
```

---

## 📞 技术支持

### 获取帮助

1. **文档查阅**
   - 📖 [部署指南](./DEPLOYMENT.md)
   - 🔧 [API文档](./API.md)
   - 🎯 [最佳实践](./BEST_PRACTICES.md)

2. **社区支持**
   - 💬 GitHub Issues
   - 📧 邮件支持
   - 💭 用户论坛

3. **专业服务**
   - 🛠️ 定制开发
   - 📊 数据迁移
   - 🔧 系统集成

### 联系方式

- 📧 **技术支持**: support@treyfinance.com
- 🐛 **Bug报告**: https://github.com/your-repo/issues
- 💡 **功能建议**: feature-request@treyfinance.com

---

## 🎉 开始使用

现在你已经了解了系统的全部功能，可以开始管理你的投资组合了！

**推荐使用流程：**

1. 🚀 **快速开始** - 使用 `npm run setup` 一键配置
2. 👤 **创建账户** - 注册并登录系统
3. 💼 **创建组合** - 建立你的第一个投资组合
4. 📈 **添加持仓** - 录入你的股票投资
5. 🔄 **配置同步** - 设置自动数据更新
6. 📊 **分析收益** - 查看投资表现和分析报告

**记住：**
- 💾 定期备份重要数据
- 🔐 保护好你的登录信息
- 📊 关注市场变化和风险控制
- 🔄 保持系统和数据的及时更新

祝你投资顺利！📈✨