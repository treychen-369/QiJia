# 部署模式对比分析

## 概述

本项目支持两种部署模式，各有优缺点：

| 特性 | 模式1: 服务器本地构建 | 模式2: GitHub Actions + GHCR |
|------|---------------------|---------------------------|
| 构建位置 | 生产服务器 | GitHub Actions (云端) |
| 部署速度 | 慢 (需构建) | 快 (仅拉取镜像) |
| 服务器资源 | 要求高 (编译需要内存/CPU) | 要求低 |
| 一致性 | 依赖服务器环境 | 环境一致 |
| 复杂性 | 简单 | 稍复杂 |
| 适用场景 | 快速迭代/测试 | 生产环境 |

---

## 模式1: 服务器本地构建 (docker-compose.prod.yml)

### 工作原理
```
代码推送 → 服务器拉取代码 → 服务器构建镜像 → 启动容器
```

### 优点
- ✅ 简单直接，无需额外配置
- ✅ 不依赖外部服务 (GitHub Actions)
- ✅ 构建失败可以立即在服务器上调试

### 缺点
- ❌ 服务器需要较多资源 (内存/CPU) 进行编译
- ❌ 部署时间长 (每次都要重新构建)
- ❌ 构建环境可能不一致

### 使用方式
```bash
# 在服务器上
git pull
docker-compose -f docker-compose.prod.yml up -d --build
```

---

## 模式2: GitHub Actions + GHCR (docker-compose.ghcr.yml)

### 工作原理
```
代码推送 → GitHub Actions构建 → 推送到GHCR → 服务器拉取镜像 → 启动容器
```

### 优点
- ✅ 服务器资源占用低 (无需编译)
- ✅ 部署速度快 (只需拉取镜像)
- ✅ 构建环境一致
- ✅ 支持多架构 (amd64/arm64)
- ✅ 可以启用构建缓存，加速构建

### 缺点
- ❌ 需要配置 GHCR 认证
- ❌ 构建失败需要在 GitHub Actions 中查看日志
- ❌ 依赖 GitHub 服务可用性

### 使用方式

#### 1. 配置 GHCR 权限

确保 GitHub 仓库的 Package 是公开的，或者服务器有权限拉取：

```bash
# 在服务器上登录 GHCR
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

Token 需要 `read:packages` 权限。

#### 2. 部署命令
```bash
# 使用辅助脚本
chmod +x scripts/deploy-server.sh
./scripts/deploy-server.sh

# 或手动执行
docker-compose -f docker-compose.ghcr.yml pull
docker-compose -f docker-compose.ghcr.yml up -d
```

---

## 常见问题排查

### 问题1: "unauthorized: authentication required" 拉取镜像失败

**原因**: GHCR 镜像是私有的，需要认证

**解决**:
```bash
# 1. 在 GitHub 创建 Personal Access Token
#    - 访问 https://github.com/settings/tokens
#    - 选择 "read:packages" 权限

# 2. 在服务器上登录
echo YOUR_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# 3. 重新拉取
docker-compose -f docker-compose.ghcr.yml pull
```

### 问题2: "connection refused" 数据库连接失败

**原因**: 两个模式的默认数据库配置不一致

**解决**: 统一使用 `docker-compose.ghcr.yml` 中修复后的配置 (数据库用户: `finance_user`)

### 问题3: 容器启动后立即退出

**排查步骤**:
```bash
# 查看日志
docker-compose -f docker-compose.ghcr.yml logs app

# 常见原因:
# 1. 环境变量缺失 (NEXTAUTH_SECRET 等)
# 2. 数据库连接失败
# 3. 端口冲突
```

### 问题4: GitHub Actions 构建失败

**排查步骤**:
1. 访问 GitHub 仓库 → Actions 标签页
2. 查看失败的 workflow 日志
3. 常见问题:
   - 依赖安装失败 → 检查 package.json
   - 构建内存不足 → 使用更大 runner 或优化构建
   - Prisma 生成失败 → 检查 schema.prisma

---

## 推荐方案

### 开发/测试环境
使用 **模式1** (服务器本地构建)
- 快速迭代
- 方便调试

### 生产环境
使用 **模式2** (GitHub Actions + GHCR)
- 部署快速
- 服务器资源占用低
- 适合自动化

### 混合方案
- 日常开发: 模式1
- 正式发布: 模式2

---

## 迁移指南

### 从模式1迁移到模式2

1. **确保 GitHub Actions 正常工作**
   - 推送代码到 master 分支
   - 检查 Actions 是否成功构建镜像
   - 确认镜像出现在 Packages 中

2. **配置服务器认证**
   ```bash
   echo YOUR_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
   ```

3. **更新服务器配置**
   ```bash
   # 备份数据
   docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U finance_user finance_system > backup.sql

   # 切换到新模式
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.ghcr.yml up -d

   # 恢复数据 (如需要)
   docker-compose -f docker-compose.ghcr.yml exec -T postgres psql -U finance_user -d finance_system < backup.sql
   ```

### 从模式2回滚到模式1

```bash
# 停止 GHCR 模式
docker-compose -f docker-compose.ghcr.yml down

# 启动本地构建模式
git pull
docker-compose -f docker-compose.prod.yml up -d --build
```

---

## 配置文件说明

| 文件 | 用途 |
|------|------|
| `docker-compose.prod.yml` | 服务器本地构建模式 |
| `docker-compose.ghcr.yml` | GHCR 镜像模式 |
| `.github/workflows/deploy.yml` | GitHub Actions 构建配置 |
| `scripts/deploy-server.sh` | 服务器部署辅助脚本 |
