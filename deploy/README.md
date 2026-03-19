# 📦 QiJia Finance System - 部署指南

## 🎯 核心概念

### 部署场景分类

| 场景 | 脚本 | 数据影响 | 使用频率 |
|------|------|---------|---------|
| **首次安装** | `deploy.sh` | 创建新数据卷 | 一次性 |
| **日常更新** | `update.sh` | ✅ 保留数据 | 频繁 |
| **数据备份** | `backup.sh` | 只读 | 定期 |
| **数据恢复** | `restore.sh` | 覆盖数据 | 按需 |

> ⚠️ **重要提示**：日常代码更新请使用 `update.sh`，它只会重启应用容器，不会影响 PostgreSQL 和 Redis 数据。

---

## 📁 目录结构

```
deploy/
├── docker/                    # Docker 配置
│   ├── docker-compose.yml     # 基础配置（共享服务定义）
│   ├── docker-compose.dev.yml # 开发环境覆盖
│   ├── docker-compose.prod.yml# 生产环境覆盖（HTTPS）
│   ├── docker-compose.http.yml# HTTP 模式覆盖
│   └── Dockerfile             # Docker 构建文件
│
├── nginx/                     # Nginx 配置
│   ├── nginx.prod.conf        # 生产环境（HTTPS）
│   ├── nginx.http.conf        # HTTP 模式
│   └── nginx.dev.conf         # 开发环境
│
├── env/                       # 环境变量模板
│   ├── .env.example           # 通用模板
│   ├── .env.dev.example       # 开发环境模板
│   └── .env.prod.example      # 生产环境模板
│
├── scripts/                   # 部署脚本
│   ├── deploy.sh              # 🆕 首次安装脚本
│   ├── update.sh              # 🆕 日常更新脚本
│   ├── backup.sh              # 🆕 数据备份脚本
│   ├── restore.sh             # 🆕 数据恢复脚本
│   ├── health-check.sh        # 健康检查脚本
│   └── setup-ssl.sh           # SSL 证书设置脚本
│
└── README.md                  # 本文档
```

---

## 🚀 快速开始

### 1. 首次安装

```bash
# 1. 配置环境变量
cp deploy/env/.env.prod.example deploy/env/.env.prod
# 编辑 deploy/env/.env.prod，填入真实配置

# 2. 执行首次安装
./deploy/scripts/deploy.sh prod
```

### 2. 日常更新（推荐）

```bash
# 更新代码后，执行：
./deploy/scripts/update.sh

# 跳过自动备份（快速更新）
./deploy/scripts/update.sh --no-backup

# 强制重建镜像
./deploy/scripts/update.sh --force
```

### 3. 数据备份

```bash
# 手动备份
./deploy/scripts/backup.sh

# 查看备份
ls -la backups/db/
```

### 4. 数据恢复

```bash
# 列出所有备份
./deploy/scripts/restore.sh --list

# 恢复最新备份
./deploy/scripts/restore.sh --latest

# 恢复指定备份
./deploy/scripts/restore.sh backups/db/postgres_20260205_120000.sql.gz
```

---

## 📋 脚本详解

### deploy.sh - 首次安装脚本

用于**首次部署**或**全新安装**。

```bash
# 生产环境（HTTPS）
./deploy/scripts/deploy.sh prod

# HTTP 模式（无 SSL）
./deploy/scripts/deploy.sh http

# 开发环境
./deploy/scripts/deploy.sh dev

# 保留数据重新安装
./deploy/scripts/deploy.sh prod --keep-data

# 全新安装（删除所有数据）⚠️ 危险
./deploy/scripts/deploy.sh prod --clean --force
```

**选项说明**：
| 选项 | 说明 |
|------|------|
| `--clean` | 删除所有容器和数据卷（⚠️ 危险） |
| `--keep-data` | 保留已有的数据卷 |
| `--force` | 跳过确认提示 |

### update.sh - 日常更新脚本

用于**代码更新**后的部署，只重启应用容器，**不影响数据库**。

```bash
# 标准更新（含自动备份）
./deploy/scripts/update.sh

# 快速更新（跳过备份）
./deploy/scripts/update.sh --no-backup

# 强制重建镜像
./deploy/scripts/update.sh --force
```

**工作流程**：
1. ✅ 检查数据容器状态
2. ✅ 自动备份数据库
3. ✅ 拉取最新代码（如果是 git 仓库）
4. ✅ 重建 App 镜像
5. ✅ 只重启 App 和 Nginx 容器
6. ✅ 执行健康检查

### backup.sh - 数据备份脚本

```bash
# 交互式备份
./deploy/scripts/backup.sh

# 自动模式（更新脚本调用）
./deploy/scripts/backup.sh --auto

# 指定备份目录
./deploy/scripts/backup.sh --output /data/backups

# 只备份数据库
./deploy/scripts/backup.sh --db-only
```

**备份内容**：
- PostgreSQL 数据库（SQL dump，gzip 压缩）
- Redis 数据（RDB 文件）
- 备份清单文件

### restore.sh - 数据恢复脚本

```bash
# 列出所有备份
./deploy/scripts/restore.sh --list

# 恢复最新备份
./deploy/scripts/restore.sh --latest

# 恢复指定文件
./deploy/scripts/restore.sh backups/db/postgres_20260205_120000.sql.gz

# 强制恢复（跳过确认）
./deploy/scripts/restore.sh --latest --force
```

**安全机制**：
- 恢复前自动备份当前数据
- 提供回滚命令

---

## 🔧 部署模式说明

### 🔒 生产环境（HTTPS）

```bash
# 首次部署前，申请 SSL 证书
./deploy/scripts/setup-ssl.sh your-domain.example.com

# 部署
./deploy/scripts/deploy.sh prod
```

### 🌐 HTTP 模式

适用于：测试环境、内网部署、IP 直接访问

```bash
./deploy/scripts/deploy.sh http
```

### 💻 开发环境

```bash
./deploy/scripts/deploy.sh dev
```

---

## 🔐 环境变量说明

| 变量 | 必须 | 说明 |
|------|------|------|
| `POSTGRES_DB` | 是 | 数据库名称 |
| `POSTGRES_USER` | 是 | 数据库用户名 |
| `POSTGRES_PASSWORD` | 是 | 数据库密码（生产环境使用强密码） |
| `NEXTAUTH_URL` | 是 | 应用访问地址 |
| `NEXTAUTH_SECRET` | 是 | NextAuth 密钥（`openssl rand -base64 32`） |
| `DEEPSEEK_API_KEY` | 否 | DeepSeek AI API 密钥 |
| `LOG_LEVEL` | 否 | 日志级别（DEBUG/INFO/WARN/ERROR） |

---

## 📊 容器架构

```
┌─────────────────────────────────────────────────────────────┐
│                         Nginx (:80/:443)                     │
│                     (反向代理 + SSL 终止)                     │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                     App (Next.js :3000)                      │
│                        (无状态容器)                           │
│              ↑ 每次更新重建，不影响数据 ↑                    │
└─────────────┬───────────────────────────────┬───────────────┘
              │                               │
┌─────────────▼───────────────┐ ┌─────────────▼───────────────┐
│     PostgreSQL (:5432)      │ │       Redis (:6379)          │
│        (有状态容器)          │ │        (有状态容器)          │
│    ⚠️ 数据卷需要保护 ⚠️      │ │     ⚠️ 数据卷需要保护 ⚠️    │
│   [finance-postgres-data]   │ │   [finance-redis-data]       │
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## 🔍 故障排查

### 常用命令

```bash
# 查看容器状态
docker ps -a

# 查看日志
docker logs -f finance-app
docker logs -f finance-nginx
docker logs -f finance-postgres

# 进入容器
docker exec -it finance-app sh
docker exec -it finance-postgres psql -U finance_user -d finance_system

# 健康检查
./deploy/scripts/health-check.sh
```

### 常见问题

#### 更新后数据丢失？

**原因**：使用了 `deploy.sh --clean` 或 `docker-compose down -v`

**预防**：
- 日常更新使用 `update.sh`
- 定期执行 `backup.sh`

**恢复**：
```bash
./deploy/scripts/restore.sh --latest
```

#### 容器无法启动？

```bash
# 查看日志
docker logs finance-app

# 检查数据库连接
docker exec finance-postgres pg_isready

# 重启服务
docker-compose -f deploy/docker/docker-compose.yml \
               -f deploy/docker/docker-compose.http.yml restart
```

---

## 🏗️ CI/CD 配置

项目根目录的 `.cnb.yml` 配置了腾讯云 CNB 自动部署。

### 密钥存储位置说明

```
┌────────────────────────────────────────────────────────────┐
│  📁 服务器上 (deploy/env/.env.prod)                         │
│  ├─ POSTGRES_PASSWORD    ← 数据库密码                       │
│  ├─ NEXTAUTH_SECRET      ← 登录加密密钥                     │
│  └─ DEEPSEEK_API_KEY     ← AI功能（可选）                   │
├────────────────────────────────────────────────────────────┤
│  ☁️ CNB 平台密钥配置 (项目设置 → 密钥管理)                   │
│  ├─ LIGHTHOUSE_HOST      ← 服务器IP                         │
│  └─ SSH_PRIVATE_KEY      ← SSH私钥（用于自动登录）           │
└────────────────────────────────────────────────────────────┘
```

> 📖 详细的密钥生成和管理指南请查看: `deploy/env/SECRETS_GUIDE.md`

### 自动部署流程

```
Push 代码 → CNB 触发 → SSH 到服务器 → 执行 update.sh
```

---

## 📝 最佳实践

### ✅ 推荐做法

1. **日常更新使用 `update.sh`**
2. **定期执行 `backup.sh`**
3. **重要更新前手动备份**
4. **敏感信息不要提交到 Git**

### ❌ 避免操作

1. **不要用 `deploy.sh` 做日常更新**
2. **不要用 `docker-compose down -v`**
3. **不要直接删除数据卷**
4. **不要在生产环境使用默认密码**

---

## 🔗 相关文档

- [项目主文档](../README.md)
- [架构设计](../docs/architecture/)
- [故障排查](../docs/troubleshooting/)
