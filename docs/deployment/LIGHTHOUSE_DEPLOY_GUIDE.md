# 腾讯云 Lighthouse 部署指南

> 本指南总结了部署过程中踩过的所有坑，帮你避免重复踩坑。

## 📋 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    腾讯云 CNB（CI/CD）                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ 代码推送    │ →  │ Docker 构建 │ →  │ 上传镜像    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└──────────────────────────────┬──────────────────────────────┘
                               │ SCP
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 腾讯云 Lighthouse 服务器                     │
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ Nginx   │ ←→ │ App     │ ←→ │ Postgres │   │ Redis   │  │
│  │ :80/443 │    │ :3000   │    │ :5432   │    │ :6379   │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│       ↑                                                     │
│       │ 公网访问                                             │
└───────┼─────────────────────────────────────────────────────┘
        │
   用户浏览器
```

## ⚠️ 踩坑记录与解决方案

### 坑 1：Google Fonts 超时导致构建失败

**现象**：
```
request to https://fonts.gstatic.com/... failed, reason: connect ETIMEDOUT
```

**原因**：国内服务器无法访问 Google Fonts

**解决方案**：
- 已修改 `src/app/layout.tsx`，移除 Google Fonts 依赖
- 已修改 `tailwind.config.ts`，使用系统字体栈

```typescript
// 修改前
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'] })

// 修改后（使用系统字体）
// 无需导入，直接使用 Tailwind 配置的系统字体栈
```

---

### 坑 2：Lighthouse 配置不足导致编译超时

**现象**：类型检查卡住、构建超时、内存不足

**原因**：轻量服务器 CPU/内存有限

**解决方案**：**在 CNB 上构建，只上传镜像到服务器**

```yaml
# .cnb.yml
- docker build -t finance-app:latest -f deploy/docker/Dockerfile .
- docker save finance-app:latest | gzip > /tmp/finance-app.tar.gz
- scp /tmp/finance-app.tar.gz root@$LIGHTHOUSE_HOST:/tmp/
```

---

### 坑 3：503 Service Temporarily Unavailable

**现象**：登录时返回 503 错误

**原因**：Nginx 限流配置过严

**解决方案**：调整 `deploy/nginx/nginx.http.conf`

```nginx
# 修改前
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
limit_req zone=login burst=5 nodelay;

# 修改后
limit_req_zone $binary_remote_addr zone=login:10m rate=30r/m;
limit_req zone=login burst=20 nodelay;
```

---

### 坑 4：数据库连接失败（密码特殊字符）

**现象**：
```
error: password authentication failed for user "finance_user"
```

**原因**：数据库密码包含 `?!@#$` 等特殊字符，导致 DATABASE_URL 解析错误

**解决方案**：使用纯字母数字密码

```bash
# 生成安全密码（避免特殊字符）
openssl rand -base64 24 | tr -dc 'a-zA-Z0-9'
```

---

### 坑 5：登录成功但无法保持会话（HTTP 模式）

**现象**：登录成功后跳转到首页，而不是 dashboard

**原因**：Cookie 的 `secure` 属性在 HTTP 下阻止了 session 写入

**解决方案**：通过环境变量控制 Cookie secure

```typescript
// src/lib/auth.ts
cookies: {
  sessionToken: {
    options: {
      // 使用环境变量控制，HTTP 模式设置 COOKIE_SECURE=false
      secure: process.env.COOKIE_SECURE === 'true',
    },
  },
},
```

```env
# deploy/env/.env.prod
COOKIE_SECURE=false  # HTTP 模式
# COOKIE_SECURE=true  # HTTPS 模式
```

---

### 坑 6：NEXTAUTH_URL 配置错误

**现象**：登录后跳转到错误的域名

**原因**：NEXTAUTH_URL 配置为域名，但域名未解析

**解决方案**：HTTP 模式使用 IP 地址

```env
# HTTP 模式
NEXTAUTH_URL=http://your-server-ip

# HTTPS 模式（域名解析后）
NEXTAUTH_URL=https://your-domain.example.com
```

---

## 🚀 完整部署流程

### 第一步：服务器初始化（只需一次）

```bash
# 1. SSH 登录服务器
ssh root@your-server-ip

# 2. 安装 Docker（如未安装）
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# 3. 创建项目目录
mkdir -p /opt/finance-system
cd /opt/finance-system

# 4. 上传代码（方式一：Git Clone）
git clone https://your-repo-url.git .

# 或方式二：本地 SCP 上传
# scp -r /path/to/project/* root@your-server-ip:/opt/finance-system/

# 5. 配置环境变量
cp deploy/env/.env.prod.example deploy/env/.env.prod
vim deploy/env/.env.prod  # 填入真实配置

# 6. 启动数据库容器（只需一次，数据持久化）
docker compose --env-file deploy/env/.env.prod \
  -f deploy/docker/docker-compose.yml \
  --project-directory . up -d postgres redis

# 7. 等待数据库就绪
sleep 10
docker logs finance-postgres
```

### 第二步：配置 CNB 密钥仓库

在 CNB 创建私有密钥仓库 `secrets`，添加文件 `finance-system.yml`：

```yaml
LIGHTHOUSE_HOST: "your-server-ip"
POSTGRES_PASSWORD: "your-secure-password"
NEXTAUTH_SECRET: "your-nextauth-secret"
DEPLOY_MODE: "http"
DEEPSEEK_API_KEY: ""
```

### 第三步：推送代码触发部署

```bash
git add .
git commit -m "deploy: update config"
git push origin master
```

CNB 会自动：
1. 在 CNB 服务器上构建 Docker 镜像
2. 上传镜像到 Lighthouse
3. 重启 App 和 Nginx 容器
4. 保留数据库数据

---

## 🐛 常见问题排查

### 登录后跳转到 localhost:3000

**问题现象**：在生产环境登录成功后，页面跳转到 `http://localhost:3000` 而不是服务器地址。

**根本原因**：Next.js 在构建时会将 `NEXTAUTH_URL` 环境变量"烘焙"到客户端 JavaScript 中。如果 Dockerfile 中设置了 `ENV NEXTAUTH_URL=http://localhost:3000`，即使运行时覆盖了正确的值，客户端代码仍会使用构建时的值。

**解决方案**：
1. Dockerfile 中使用 `ARG` 传入构建时的 URL：
```dockerfile
ARG NEXTAUTH_URL_BUILD=http://your-server-ip
ENV NEXTAUTH_URL=${NEXTAUTH_URL_BUILD}
```

2. CNB 配置中传入正确的构建参数：
```yaml
docker build --build-arg NEXTAUTH_URL_BUILD=http://$LIGHTHOUSE_HOST -t finance-app:latest -f deploy/docker/Dockerfile .
```

3. 重新构建并部署后生效。

---

## 📝 日常维护命令

### 查看服务状态
```bash
cd /opt/finance-system
docker compose --env-file deploy/env/.env.prod \
  -f deploy/docker/docker-compose.yml \
  -f deploy/docker/docker-compose.http.yml \
  --project-directory . ps
```


### 查看应用日志
```bash
docker logs -f finance-app --tail 100
```

### 手动重启应用
```bash
docker compose --env-file deploy/env/.env.prod \
  -f deploy/docker/docker-compose.yml \
  -f deploy/docker/docker-compose.http.yml \
  --project-directory . restart app nginx
```

### 数据库备份
```bash
docker exec finance-postgres pg_dump -U finance_user finance_system > backup_$(date +%Y%m%d).sql
```

### 数据库恢复
```bash
cat backup_20260205.sql | docker exec -i finance-postgres psql -U finance_user finance_system
```

---

## 🔄 HTTP 切换到 HTTPS

当域名备案完成后：

1. **上传 SSL 证书到服务器**
```bash
mkdir -p /opt/finance-system/ssl
scp your-cert.crt root@服务器:/opt/finance-system/ssl/
scp your-key.key root@服务器:/opt/finance-system/ssl/
```

2. **修改环境变量**
```env
NEXTAUTH_URL=https://your-domain.example.com
COOKIE_SECURE=true
```

3. **修改 CNB 密钥仓库**
```yaml
DEPLOY_MODE: "https"
```

4. **推送代码触发重新部署**

---

## 📁 相关文件清单

| 文件 | 说明 |
|------|------|
| `.cnb.yml` | CNB CI/CD 配置 |
| `deploy/docker/Dockerfile` | Docker 构建文件 |
| `deploy/docker/docker-compose.yml` | 基础 Compose 配置 |
| `deploy/docker/docker-compose.http.yml` | HTTP 模式覆盖 |
| `deploy/docker/docker-compose.prod.yml` | HTTPS 模式覆盖 |
| `deploy/nginx/nginx.http.conf` | Nginx HTTP 配置 |
| `deploy/env/.env.prod.example` | 环境变量模板 |
| `src/lib/auth.ts` | NextAuth 配置（Cookie secure） |
| `src/app/layout.tsx` | 字体配置（系统字体） |
| `tailwind.config.ts` | Tailwind 字体栈配置 |
