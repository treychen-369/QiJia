# 🚀 QiJia Finance System 部署指南

## 📋 目录
- [系统要求](#系统要求)
- [开发环境配置](#开发环境配置)
- [验证测试](#验证测试)
- [生产部署](#生产部署)
- [使用指南](#使用指南)
- [故障排除](#故障排除)

## 🔧 系统要求

### 最低要求
- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **PostgreSQL**: >= 13.0
- **内存**: >= 2GB RAM
- **存储**: >= 5GB 可用空间

### 推荐配置
- **Node.js**: 20.x LTS
- **PostgreSQL**: 15.x
- **内存**: >= 4GB RAM
- **存储**: >= 10GB SSD

## 🛠️ 开发环境配置

### 1. 克隆项目
```bash
# 如果是从Git仓库克隆
git clone <repository-url>
cd qijia-finance

# 或者直接使用现有目录
cd "c:/Users/yourname/project-path's finance system"
```

### 2. 安装依赖
```bash
# 安装项目依赖
npm install

# 验证安装
npm run type-check
```

### 3. 环境配置
```bash
# 复制环境配置文件
cp .env.example .env.local

# 编辑环境变量
# 使用你喜欢的编辑器编辑 .env.local
```

### 4. 数据库设置

#### 安装PostgreSQL
```bash
# Windows (使用Chocolatey)
choco install postgresql

# 或下载官方安装包
# https://www.postgresql.org/download/windows/
```

#### 创建数据库
```sql
-- 连接到PostgreSQL
psql -U postgres

-- 创建数据库
CREATE DATABASE finance_system;

-- 创建用户（可选）
CREATE USER finance_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE finance_system TO finance_user;
```

#### 配置数据库连接
```bash
# 在 .env.local 中配置
DATABASE_URL="postgresql://finance_user:your_password@localhost:5432/finance_system"
```

### 5. 初始化数据库
```bash
# 生成Prisma客户端
npm run db:generate

# 推送数据库架构
npm run db:push

# 可选：运行种子数据
npm run db:seed
```

### 6. 启动开发服务器
```bash
npm run dev
```

访问 http://localhost:3000 查看应用。

## ✅ 验证测试

### 1. 基础功能测试

#### 启动测试服务器
```bash
# 启动开发服务器
npm run dev

# 在新终端窗口运行测试
npm test
```

#### 手动测试清单
- [ ] **用户认证**
  - [ ] 注册新用户
  - [ ] 用户登录
  - [ ] 用户登出
  - [ ] 密码重置

- [ ] **投资组合管理**
  - [ ] 创建投资组合
  - [ ] 添加股票持仓
  - [ ] 编辑持仓信息
  - [ ] 删除持仓

- [ ] **数据同步**
  - [ ] 测试数据源连接
  - [ ] 手动同步股票价格
  - [ ] 设置定时同步
  - [ ] 查看同步状态

- [ ] **数据分析**
  - [ ] 查看投资组合总览
  - [ ] 查看收益分析
  - [ ] 导出数据报告

### 2. API测试

#### 使用内置测试工具
```bash
# 运行API测试
npm run test:api

# 运行覆盖率测试
npm run test:coverage
```

#### 手动API测试
```bash
# 测试股票数据同步
curl -X POST http://localhost:3000/api/sync/stocks \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["000001", "000002"]}'

# 测试用户认证
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'
```

### 3. 数据源连接测试

#### 测试同花顺API
```bash
# 在应用中访问
http://localhost:3000/settings/sync

# 点击"测试连接"按钮验证各数据源
```

#### 检查数据库连接
```bash
# 使用Prisma Studio
npm run db:studio

# 访问 http://localhost:5555 查看数据库
```

### 4. 性能测试

#### 负载测试
```bash
# 安装测试工具
npm install -g artillery

# 运行负载测试
artillery quick --count 10 --num 100 http://localhost:3000
```

## 🌐 生产部署

### 1. 云平台部署选项

#### Vercel部署（推荐）
```bash
# 安装Vercel CLI
npm install -g vercel

# 登录Vercel
vercel login

# 部署
vercel --prod

# 配置环境变量
vercel env add DATABASE_URL
vercel env add NEXTAUTH_SECRET
# ... 添加其他环境变量
```

#### Docker部署
```dockerfile
# 创建 Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# 构建镜像
docker build -t qijia-finance .

# 运行容器
docker run -p 3000:3000 \
  -e DATABASE_URL="your-production-db-url" \
  -e NEXTAUTH_SECRET="your-production-secret" \
  qijia-finance
```

#### 传统服务器部署
```bash
# 在服务器上
git clone <repository-url>
cd qijia-finance

# 安装依赖
npm ci --only=production

# 构建应用
npm run build

# 使用PM2管理进程
npm install -g pm2
pm2 start npm --name "finance-system" -- start
pm2 startup
pm2 save
```

### 2. 数据库配置

#### 生产数据库设置
```bash
# 使用云数据库服务（推荐）
# - AWS RDS
# - Google Cloud SQL
# - Azure Database
# - PlanetScale
# - Supabase

# 或自建PostgreSQL
# 确保配置SSL连接
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

#### 数据库迁移
```bash
# 在生产环境运行迁移
npm run db:migrate

# 备份数据库
pg_dump $DATABASE_URL > backup.sql
```

### 3. 安全配置

#### 环境变量
```bash
# 生产环境必须配置
NEXTAUTH_SECRET="strong-random-secret-key"
NEXTAUTH_URL="https://your-domain.com"
NODE_ENV="production"

# 数据库连接
DATABASE_URL="postgresql://..."

# API密钥（从各平台获取）
TONGHUASHUN_API_KEY="..."
EASTMONEY_API_KEY="..."
```

#### SSL/HTTPS配置
```bash
# 使用反向代理（Nginx）
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 4. 监控和日志

#### 应用监控
```bash
# 使用PM2监控
pm2 monit

# 或使用专业监控服务
# - New Relic
# - DataDog
# - Sentry
```

#### 日志管理
```bash
# PM2日志
pm2 logs finance-system

# 或配置日志服务
# - ELK Stack
# - Splunk
# - CloudWatch
```

## 📖 使用指南

### 1. 首次使用

#### 创建管理员账户
1. 访问应用首页
2. 点击"注册"创建第一个用户
3. 该用户自动成为管理员

#### 配置数据源
1. 登录后访问"设置" > "数据同步"
2. 配置各数据源的API密钥
3. 测试连接确保正常工作

#### 创建投资组合
1. 访问"投资组合"页面
2. 点击"创建组合"
3. 添加股票持仓信息

### 2. 日常使用

#### 数据同步
- **自动同步**: 系统会根据设置的计划自动同步
- **手动同步**: 在"设置"页面点击"立即同步"
- **查看状态**: 在"系统状态"页面查看同步情况

#### 数据分析
- **总览**: 首页显示投资组合总体情况
- **详细分析**: 点击具体组合查看详细数据
- **图表**: 查看收益趋势和分布图表

#### 数据导出
- **Excel导出**: 在任意数据页面点击"导出"
- **PDF报告**: 生成专业的投资报告
- **API访问**: 使用API获取数据

### 3. 高级功能

#### 自定义分析
- 创建自定义指标
- 设置预警规则
- 配置自动报告

#### 数据备份
- 定期导出数据
- 云端备份配置
- 恢复数据功能

## 🔧 故障排除

### 常见问题

#### 1. 数据库连接失败
```bash
# 检查数据库状态
pg_isready -h localhost -p 5432

# 检查连接字符串
echo $DATABASE_URL

# 重置数据库连接
npm run db:push
```

#### 2. API同步失败
```bash
# 检查API密钥配置
# 查看网络连接
# 检查API配额限制
```

#### 3. 构建失败
```bash
# 清理缓存
npm run clean
rm -rf .next node_modules
npm install

# 重新构建
npm run build
```

#### 4. 性能问题
```bash
# 检查数据库查询
# 优化图片资源
# 启用缓存
```

### 日志分析

#### 查看应用日志
```bash
# 开发环境
npm run dev

# 生产环境
pm2 logs finance-system

# 数据库日志
tail -f /var/log/postgresql/postgresql.log
```

#### 错误追踪
- 检查浏览器控制台
- 查看服务器日志
- 使用调试工具

### 联系支持

如果遇到问题：
1. 查看本文档的故障排除部分
2. 检查GitHub Issues
3. 联系技术支持

---

## 🎉 部署完成！

恭喜！你已经成功部署了QiJia Finance System。现在可以开始管理你的投资组合了！

记住：
- 🔐 定期更新密钥和证书
- 📊 监控系统性能和状态
- 💾 定期备份重要数据
- 🔄 保持系统和依赖更新