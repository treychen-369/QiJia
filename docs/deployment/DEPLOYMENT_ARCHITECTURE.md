# 🏗️ QiJia Finance System - 部署架构设计

## 📋 目录

1. [架构概述](#架构概述)
2. [首次部署](#首次部署)
3. [日常部署（CI/CD）](#日常部署cicd)
4. [配置文件管理](#配置文件管理)
5. [故障排查](#故障排查)

---

## 架构概述

### 部署流程图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          部署架构总览                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  开发者本地                    CNB 构建平台                  Lighthouse   │
│  ─────────                    ────────────                  ──────────  │
│                                                                         │
│  ┌─────────┐   git push      ┌─────────────┐   scp/ssh     ┌─────────┐ │
│  │  代码   │ ───────────────→│  构建镜像   │──────────────→│  服务器  │ │
│  └─────────┘                 └─────────────┘               └─────────┘ │
│                                    │                            │       │
│                              1. docker build              4. docker     │
│                              2. docker save                  compose up │
│                              3. scp 镜像 + 配置                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 关键设计原则

| 原则 | 说明 |
|------|------|
| **镜像一致性** | CNB 构建的镜像 = 服务器运行的镜像（通过 `--no-build`） |
| **配置同步** | 每次部署自动同步 `deploy/` 目录到服务器 |
| **环境隔离** | 敏感配置存储在服务器 `.env.prod`，不进入 Git |

---

## 首次部署

### 前置条件

1. Lighthouse 服务器已开通
2. 安装了 Docker 和 TAT
3. SSH 密钥已配置

### 步骤 1：服务器初始化

```bash
# SSH 登录服务器
ssh ubuntu@your-server-ip

# 创建项目目录
sudo mkdir -p /opt/finance-system
sudo chown ubuntu:ubuntu /opt/finance-system
cd /opt/finance-system

# 克隆代码仓库（仅首次需要）
git clone https://your-repo-url.git .
```

### 步骤 2：配置环境变量

```bash
# 创建生产环境配置
mkdir -p deploy/env
cat > deploy/env/.env.prod << 'EOF'
# 数据库
POSTGRES_DB=finance_system
POSTGRES_USER=finance_user
POSTGRES_PASSWORD=<你的安全密码>

# NextAuth
NEXTAUTH_URL=http://your-server-ip
NEXTAUTH_SECRET=<生成的安全密钥>

# 其他
NODE_ENV=production
LOG_LEVEL=WARN
EOF

chmod 600 deploy/env/.env.prod
```

### 步骤 3：首次启动基础服务

```bash
# 启动 PostgreSQL 和 Redis（这些不需要应用镜像）
cd /opt/finance-system
docker compose -f deploy/docker/docker-compose.yml \
  -f deploy/docker/docker-compose.http.yml \
  --env-file deploy/env/.env.prod \
  --project-directory . \
  up -d postgres redis

# 等待数据库就绪
sleep 10
docker logs finance-postgres
```

### 步骤 4：触发首次 CNB 部署

```bash
# 在本地提交任意变更触发 CNB
git commit --allow-empty -m "chore: trigger first deployment"
git push origin master
```

CNB 会自动：
1. 构建镜像
2. 上传镜像到服务器
3. **同步 deploy/ 配置文件**
4. 启动应用和 Nginx

---

## 日常部署（CI/CD）

### 🎯 触发策略（重要！）

**不是每次提交都会触发部署！** 只有 commit message 包含 `[deploy]` 才会触发 CNB 构建。

```bash
# ❌ 不触发部署（日常开发提交）
git commit -m "feat: 添加新功能"
git commit -m "fix: 修复bug"
git commit -m "refactor: 重构代码"

# ✅ 触发部署（需要上线时）
git commit -m "feat: 添加新功能 [deploy]"
git commit -m "[deploy] fix: 修复线上问题"
git commit -m "release: v1.2.0 [deploy]"
```

### 推荐的开发流程

```
日常开发                              需要部署
────────                              ────────
git add .                             git add .
git commit -m "feat: xxx"             git commit -m "feat: xxx [deploy]"
git push                              git push
    ↓                                     ↓
不触发 CNB ✅                          触发 CNB 部署 ✅
继续开发...                            等待部署完成
```

### 部署触发

```bash
# 本地开发完成后
git add .
git commit -m "feat: 新功能"
git push origin master  # 自动触发 CNB
```

### CNB 自动执行流程

```yaml
# .cnb.yml 定义的流程
1. 检查环境
   └─ 验证必要环境变量
   └─ 验证源代码是否正确

2. 构建镜像
   └─ docker build --no-cache -t finance-app:latest

3. 导出镜像
   └─ docker save | gzip > finance-app.tar.gz

4. 上传到服务器
   └─ scp finance-app.tar.gz
   └─ scp -r deploy/docker/    # ⭐ 同步 compose 配置
   └─ scp -r deploy/nginx/     # ⭐ 同步 nginx 配置

5. 远程部署
   └─ docker load < finance-app.tar.gz
   └─ docker compose up -d --no-build --force-recreate
```

### 为什么要同步配置文件？

```
问题场景：
  1. 你修改了 docker-compose.yml（比如添加 image: 配置）
  2. git push 触发 CNB
  3. CNB 构建镜像并上传
  4. ❌ 但服务器上的 docker-compose.yml 还是旧的！
  5. 服务器可能使用错误的配置

解决方案：
  CNB 部署时自动同步 deploy/ 目录
  └─ 服务器配置始终与仓库一致
```

---

## 配置文件管理

### 文件分类

| 类型 | 位置 | 同步方式 | 说明 |
|------|------|----------|------|
| **部署配置** | `deploy/docker/*.yml` | CNB 自动同步 | compose 配置 |
| **Nginx 配置** | `deploy/nginx/*.conf` | CNB 自动同步 | 反向代理配置 |
| **环境变量** | `deploy/env/.env.prod` | 首次手动创建 | 敏感信息，不入 Git |
| **SSL 证书** | 服务器 `/opt/finance-system/certbot/` | 手动管理 | Let's Encrypt |

### 哪些文件会被同步？

```
CNB 每次部署会同步：
  仓库                           服务器
  ────                           ────
  deploy/docker/                 /opt/finance-system/deploy/docker/
  ├── docker-compose.yml    →    ├── docker-compose.yml
  ├── docker-compose.http.yml    ├── docker-compose.http.yml
  ├── docker-compose.prod.yml    ├── docker-compose.prod.yml
  └── Dockerfile            →    └── Dockerfile
  
  deploy/nginx/                  /opt/finance-system/deploy/nginx/
  ├── nginx.http.conf       →    ├── nginx.http.conf
  └── nginx.prod.conf       →    └── nginx.prod.conf
```

### 哪些文件不会被同步？

```
❌ 不同步（需手动管理）：
  - deploy/env/.env.prod     # 包含密码，服务器独立维护
  - certbot/                 # SSL 证书
  - postgres_data/           # 数据库数据
  - redis_data/              # 缓存数据
```

---

## 故障排查

### 问题 1：部署后代码没更新

**检查步骤：**

```bash
# 1. 检查运行的镜像 ID
docker inspect finance-app --format '{{.Image}}'

# 2. 检查 finance-app:latest 的 ID
docker inspect finance-app:latest --format '{{.Id}}'

# 3. 两者应该一致！如果不一致，说明用了错误的镜像
```

**解决方案：**

```bash
# 强制使用正确镜像
docker compose ... up -d --no-build --force-recreate app
```

### 问题 2：配置文件不同步

**检查步骤：**

```bash
# 查看服务器上的 compose 文件是否有 image: 配置
cat /opt/finance-system/deploy/docker/docker-compose.yml | grep "image:"
```

**解决方案：**
- CNB 已配置自动同步，重新触发一次部署即可
- 或手动同步：`scp -r deploy/docker/ ubuntu@server:/opt/finance-system/deploy/`

### 问题 3：环境变量问题

**检查步骤：**

```bash
# 查看容器内的环境变量
docker exec finance-app env | grep -E "NEXTAUTH|DATABASE"
```

**解决方案：**
- 编辑服务器上的 `deploy/env/.env.prod`
- 重启容器：`docker compose ... up -d --force-recreate app`

---

## 📝 Quick Reference

### 常用命令

```bash
# 查看日志
docker logs finance-app --tail 100 -f

# 重启应用
docker compose -f deploy/docker/docker-compose.yml \
  -f deploy/docker/docker-compose.http.yml \
  --env-file deploy/env/.env.prod \
  --project-directory . \
  restart app

# 查看容器状态
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'

# 进入容器调试
docker exec -it finance-app sh
```

### CNB 部署触发

```bash
# 方式 1：正常提交时顺便部署
git add . && git commit -m "feat: 新功能 [deploy]" && git push

# 方式 2：单独触发部署（不改代码）
git commit --allow-empty -m "[deploy] 重新部署" && git push

# 方式 3：多个提交后统一部署
git commit -m "feat: 功能1"
git commit -m "feat: 功能2"
git commit -m "feat: 功能3 [deploy]"  # 最后一个加 [deploy]
git push
```

---

## 🔄 版本历史

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-02-05 | v1.0 | 初始版本，解决配置漂移问题 |

---

## ⏰ 定时任务配置

### 每日快照任务

为了让资产趋势图有数据，需要配置每日快照定时任务。

#### 服务器上配置 crontab

```bash
# SSH 登录服务器
ssh ubuntu@your-server-ip

# 编辑 crontab
crontab -e

# 添加以下行（每日凌晨 0:30 执行）
30 0 * * * curl -s -X POST http://localhost:3000/api/cron/daily-snapshot >> /var/log/finance-snapshot.log 2>&1
```

#### 配置说明

| 时间 | 含义 |
|------|------|
| `30 0 * * *` | 每天凌晨 0:30 |
| `curl -s -X POST` | 静默模式 POST 请求 |
| `http://localhost:3000` | 容器内部地址 |
| `/api/cron/daily-snapshot` | 快照创建 API |

#### 手动测试

```bash
# 在服务器上测试
curl -X POST http://localhost:3000/api/cron/daily-snapshot

# 预期输出
{
  "success": true,
  "message": "每日快照任务完成",
  "data": {
    "successful": 1,
    "failed": 0,
    "errors": [],
    "duration": "0.5s"
  }
}
```

#### 查看日志

```bash
# 查看定时任务日志
tail -f /var/log/finance-snapshot.log

# 查看 crontab 执行情况
grep CRON /var/log/syslog | tail -20
```

#### 验证快照数据

```bash
# 进入数据库容器
docker exec -it finance-postgres psql -U finance_user -d finance_system

# 查看最近快照
SELECT date, total_value, daily_return 
FROM portfolio_history 
ORDER BY date DESC 
LIMIT 7;
```
