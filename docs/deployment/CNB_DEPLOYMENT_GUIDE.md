# CNB (Coding.net) 部署指南

## 概述

本方案使用 CNB (Coding.net) 替代 GitHub，解决国内服务器访问 GitHub 慢的问题。

## 方案对比

| 特性 | GitHub + GHCR | CNB + CNB 镜像仓库 |
|------|---------------|-------------------|
| 代码托管 | GitHub | CNB (Coding.net) |
| 镜像仓库 | GHCR | CNB 镜像仓库 |
| 国内访问速度 | 慢 | 快 ✅ |
| CI/CD | GitHub Actions | CNB CI |
| 费用 | 免费 | 免费额度 |

## 快速开始

### 1. 在 CNB 创建项目

1. 访问 https://coding.net 登录/注册
2. 创建新项目：`qijia-finance`
3. 导入 GitHub 仓库或推送代码

### 2. 配置 CNB CI

创建文件 `.coding/ci.yml`：

```yaml
stages:
  - build

build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker build -t ${CODING_DOCKER_REG_HOST}/${PROJECT_NAME}:${CI_COMMIT_SHA} .
    - docker login -u ${CODING_DOCKER_REG_USER} -p ${CODING_DOCKER_REG_PASSWORD} ${CODING_DOCKER_REG_HOST}
    - docker push ${CODING_DOCKER_REG_HOST}/${PROJECT_NAME}:${CI_COMMIT_SHA}
    - docker tag ${CODING_DOCKER_REG_HOST}/${PROJECT_NAME}:${CI_COMMIT_SHA} ${CODING_DOCKER_REG_HOST}/${PROJECT_NAME}:latest
    - docker push ${CODING_DOCKER_REG_HOST}/${PROJECT_NAME}:latest
```

### 3. 配置环境变量

在 CNB 项目设置 → 持续集成 → 环境变量中添加：

| 变量名 | 说明 | 获取方式 |
|--------|------|---------|
| `CODING_DOCKER_REG_HOST` | 镜像仓库地址 | 制品仓库页面 |
| `CODING_DOCKER_REG_USER` | 仓库用户名 | 个人设置 |
| `CODING_DOCKER_REG_PASSWORD` | 仓库密码/令牌 | 个人设置 → 访问令牌 |

### 4. 服务器部署

#### 4.1 配置镜像仓库认证

```bash
# 在服务器上登录 CNB 镜像仓库
docker login -u your-username -p your-password ccr.ccs.tencentyun.com
# 或使用 CODING 镜像仓库
docker login -u your-username -p your-password your-team-docker.pkg.coding.net
```

#### 4.2 创建 docker-compose.cnb.yml

```yaml
version: '3.8'

services:
  app:
    image: ccr.ccs.tencentyun.com/your-namespace/qijia-finance:latest
    # 或使用 CODING: your-team-docker.pkg.coding.net/your-project/qijia-finance:latest
    ...
```

#### 4.3 部署命令

```bash
# 拉取最新镜像并启动
docker-compose -f docker-compose.cnb.yml pull
docker-compose -f docker-compose.cnb.yml up -d
```

## 两种 CNB 方案

### 方案 A: CNB 持续集成 + 腾讯云镜像仓库 (推荐)

**优点**：
- CNB CI 构建镜像
- 腾讯云镜像仓库 (ccr.ccs.tencentyun.com) 存储
- 国内访问速度最快

**配置步骤**：

1. 在腾讯云创建容器镜像服务
2. 在 CNB 设置镜像仓库凭据
3. CI 推送到腾讯云镜像仓库
4. 服务器从腾讯云拉取镜像

### 方案 B: 纯 CNB 方案

**优点**：
- 代码 + CI + 镜像仓库都在 CNB
- 一站式管理

**配置步骤**：

1. 在 CNB 启用制品仓库
2. CI 推送到 CNB 镜像仓库
3. 服务器配置 CNB 镜像仓库认证

## 配置文件

### CNB CI 配置 (`.coding/ci.yml`)

```yaml
stages:
  - build

variables:
  TENCENT_REGISTRY: ccr.ccs.tencentyun.com
  NAMESPACE: your-namespace

build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    # 构建镜像
    - docker build -t ${TENCENT_REGISTRY}/${NAMESPACE}/qijia-finance:${CI_COMMIT_SHA} .
    - docker tag ${TENCENT_REGISTRY}/${NAMESPACE}/qijia-finance:${CI_COMMIT_SHA} ${TENCENT_REGISTRY}/${NAMESPACE}/qijia-finance:latest
    
    # 登录腾讯云镜像仓库
    - docker login -u ${TENCENT_REGISTRY_USER} -p ${TENCENT_REGISTRY_PASSWORD} ${TENCENT_REGISTRY}
    
    # 推送镜像
    - docker push ${TENCENT_REGISTRY}/${NAMESPACE}/qijia-finance:${CI_COMMIT_SHA}
    - docker push ${TENCENT_REGISTRY}/${NAMESPACE}/qijia-finance:latest
```

### 服务器 docker-compose 配置

```yaml
version: '3.8'

services:
  app:
    image: ccr.ccs.tencentyun.com/your-namespace/qijia-finance:latest
    container_name: finance-app
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://finance_user:${DB_PASSWORD}@postgres:5432/finance_system
      - NEXTAUTH_URL=https://your-domain.example.com
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    ...
```

## 迁移步骤

### 从 GitHub 迁移到 CNB

1. **代码迁移**
   ```bash
   # 添加 CNB 远程仓库
   git remote add cnb https://e.coding.net/your-team/qijia-finance.git
   
   # 推送代码
   git push cnb master
   ```

2. **启用 CNB CI**
   - 在 CNB 项目设置中启用持续集成
   - 创建 `.coding/ci.yml` 文件

3. **配置镜像仓库**
   - 在腾讯云创建容器镜像服务
   - 获取访问凭据

4. **更新服务器配置**
   - 创建 `docker-compose.cnb.yml`
   - 配置镜像仓库登录

5. **测试部署**
   - 推送代码触发 CI 构建
   - 服务器拉取新镜像部署

## 常见问题

### Q: CNB 免费额度够用吗？

A: CNB 免费额度通常包括：
- 代码仓库: 免费
- CI 构建: 每月 1000 分钟
- 镜像仓库: 10GB 存储

对于个人项目足够使用。

### Q: 腾讯云镜像仓库费用？

A: 腾讯云个人版容器镜像服务：
- 免费额度: 10GB 存储 + 100GB 流量/月
- 超出部分按量付费

### Q: 如何备份数据？

A: 数据保存在服务器本地 volumes 中：
```bash
# 备份数据库
docker-compose exec postgres pg_dump -U finance_user finance_system > backup.sql

# 备份 volumes
tar -czvf finance-backup.tar.gz ~/finance-system/postgres_data
```

## 参考文档

- [CNB 持续集成文档](https://help.coding.net/docs/ci/)
- [腾讯云容器镜像服务](https://cloud.tencent.com/document/product/1141)
- [Docker 登录私有仓库](https://docs.docker.com/engine/reference/commandline/login/)
