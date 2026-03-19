# 🚀 生产环境部署检查清单

在部署到生产环境之前，请确保完成以下所有检查项。

---

## 🔐 安全检查（必须）

### 1. 环境变量配置

```bash
# 检查生产环境配置文件
# ⚠️ 确保以下变量已正确设置

# 数据库（必须使用强密码）
DATABASE_URL="postgresql://user:STRONG_PASSWORD@host:5432/db?sslmode=require"

# NextAuth（必须生成强随机密钥）
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="https://your-domain.com"

# 日志配置（生产环境推荐）
LOG_LEVEL="warn"
LOG_SENSITIVE="false"  # ⚠️ 必须为 false

# DeepSeek（如需 AI 功能）
DEEPSEEK_API_KEY="your-api-key"
```

### 2. 敏感信息检查清单

- [ ] **数据库密码** - 使用强密码（16位以上，包含特殊字符）
- [ ] **NEXTAUTH_SECRET** - 使用 `openssl rand -base64 32` 生成
- [ ] **API Keys** - 所有 API Key 从环境变量读取，无硬编码
- [ ] **日志** - `LOG_SENSITIVE=false` 已设置
- [ ] **调试模式** - `NODE_ENV=production` 已设置

### 3. 代码安全检查

```bash
# 运行安全检查脚本
npm audit                    # 检查依赖漏洞
npx eslint src/ --ext .ts,.tsx  # 代码规范检查
```

---

## ⚙️ 配置检查

### 1. next.config.js 优化（已配置）

```javascript
// ✅ 已配置项
compiler: {
  removeConsole: process.env.NODE_ENV === 'production',  // 自动移除 console.log
},
reactStrictMode: true,
swcMinify: true,
```

### 2. 数据库配置

```bash
# 确保启用 SSL
DATABASE_URL="...?sslmode=require"

# 运行数据库迁移
npx prisma migrate deploy
```

### 3. CORS 配置

```bash
# .env.production
CORS_ORIGIN="https://your-domain.com"
```

---

## 🖥️ Lighthouse 服务器配置

### 1. 服务器要求

| 配置 | 最低要求 | 推荐配置 |
|-----|---------|---------|
| CPU | 1 核 | 2 核 |
| 内存 | 2GB | 4GB |
| 存储 | 20GB SSD | 40GB SSD |
| 系统 | Ubuntu 20.04+ | Ubuntu 22.04 |

### 2. 安装 Docker

```bash
# Ubuntu
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 3. 配置防火墙

```bash
# 开放必要端口
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 22/tcp    # SSH
sudo ufw enable
```

---

## 📦 部署步骤

### 方式一：Docker Compose 部署（推荐）

```bash
# 1. 克隆代码
git clone https://github.com/your-org/qijia-finance
cd treys-finance-system

# 2. 创建生产环境配置
cp .env.example .env.production
vim .env.production  # 编辑配置

# 3. 构建并启动
docker-compose -f docker-compose.yml up -d --build

# 4. 检查状态
docker-compose ps
docker-compose logs -f app
```

### 方式二：手动部署

```bash
# 1. 安装依赖
npm ci --only=production

# 2. 生成 Prisma 客户端
npx prisma generate

# 3. 构建应用
npm run build

# 4. 数据库迁移
npx prisma migrate deploy

# 5. 使用 PM2 启动
pm2 start npm --name "finance-system" -- start
pm2 save
pm2 startup
```

---

## 🔍 部署后验证

### 1. 健康检查

```bash
# 检查应用状态
curl -I https://your-domain.com/api/health

# 检查数据库连接
curl https://your-domain.com/api/health/db
```

### 2. 功能验证清单

- [ ] 用户注册/登录正常
- [ ] Dashboard 数据加载正常
- [ ] 资产添加/编辑/删除正常
- [ ] AI 建议功能正常（如已配置）
- [ ] 日志无敏感信息泄露

### 3. 性能检查

```bash
# 响应时间检查（应 < 500ms）
curl -w "@curl-format.txt" -o /dev/null -s https://your-domain.com/api/dashboard
```

---

## 🛡️ 安全加固

### 1. Nginx 配置（可选）

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL 配置
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. 定期维护任务

```bash
# 添加到 crontab
# 每日备份数据库
0 2 * * * pg_dump $DATABASE_URL > /backups/db-$(date +\%Y\%m\%d).sql

# 每周清理日志
0 3 * * 0 find /var/log/app -name "*.log" -mtime +7 -delete

# 每月更新依赖
0 4 1 * * cd /app && npm audit fix
```

---

## ❌ 常见问题排查

### 1. 数据库连接失败

```bash
# 检查数据库状态
docker-compose exec postgres pg_isready

# 检查连接字符串
echo $DATABASE_URL | grep -o "//.*@"  # 不显示密码
```

### 2. 应用启动失败

```bash
# 查看日志
docker-compose logs app --tail=100

# 检查环境变量
docker-compose exec app env | grep -E "NODE_ENV|DATABASE|NEXTAUTH"
```

### 3. SSL 证书问题

```bash
# 使用 Let's Encrypt 免费证书
sudo apt install certbot
certbot certonly --standalone -d your-domain.com
```

---

## ✅ 最终检查清单

### 部署前

- [ ] 所有环境变量已配置
- [ ] 数据库使用强密码
- [ ] NEXTAUTH_SECRET 已更新
- [ ] LOG_SENSITIVE=false
- [ ] NODE_ENV=production
- [ ] 代码无硬编码密钥

### 部署后

- [ ] 应用正常启动
- [ ] 数据库连接正常
- [ ] 用户登录正常
- [ ] API 响应正常
- [ ] 日志无敏感信息
- [ ] SSL 证书有效

---

## 📞 需要帮助？

如果遇到部署问题：
1. 查看本文档的常见问题排查
2. 检查 `docker-compose logs`
3. 查看 `/var/log/nginx/error.log`

---

*最后更新：2026-02-02*
