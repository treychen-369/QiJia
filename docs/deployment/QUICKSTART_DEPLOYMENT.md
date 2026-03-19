# 🚀 Lighthouse 快速部署指南

本指南帮助你快速将 QiJia Finance System 部署到腾讯云 Lighthouse 轻量应用服务器。

---

## ⚡ 5分钟快速部署（推荐新手）

### 前提条件

- ✅ 已有腾讯云 Lighthouse 服务器
- ✅ 服务器已安装 Docker 和 Docker Compose
- ✅ 已安装 TAT（腾讯云自动化助手）
- ✅ 本地有 SSH 访问权限

---

### 步骤1：连接服务器

```bash
# SSH 连接到服务器
ssh root@YOUR_SERVER_IP
```

---

### 步骤2：安装 Docker（如果未安装）

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 安装 Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

---

### 步骤3：克隆项目

```bash
# 克隆项目
git clone https://github.com/YOUR_USERNAME/treys-finance-system.git
cd treys-finance-system
```

---

### 步骤4：配置环境变量

```bash
# 复制环境变量模板
cp .env.production.example .env.production

# 生成随机密码
DB_PASSWORD=$(openssl rand -base64 16)
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# 更新配置文件
cat > .env.production << EOF
DATABASE_URL="postgresql://finance_user:${DB_PASSWORD}@postgres:5432/finance_system"
NEXTAUTH_URL="http://$(curl -s ifconfig.me)"  # 自动获取公网IP
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
DEEPSEEK_API_KEY=""
LOG_LEVEL=WARN
EOF

# 显示配置（敏感信息已隐藏）
echo "✓ 环境变量配置完成"
echo "✓ NEXTAUTH_URL: $(grep NEXTAUTH_URL .env.production | cut -d'=' -f2)"
```

---

### 步骤5：选择部署模式

#### 模式A：HTTP模式（最快，无需SSL）

```bash
# 使用HTTP配置启动
docker-compose -f docker-compose.http.yml up -d

# 查看日志
docker-compose -f docker-compose.http.yml logs -f app
```

**访问地址**：`http://YOUR_SERVER_IP`

---

#### 模式B：HTTPS模式（需要域名和SSL证书）

```bash
# 1. 准备SSL证书
# 将证书文件放到 ./ssl/ 目录：
# - ssl/cert.pem（证书文件）
# - ssl/key.pem（私钥文件）

# 2. 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f app
```

**访问地址**：`https://YOUR_DOMAIN`

---

### 步骤6：初始化数据库

```bash
# 等待服务启动
sleep 10

# 生成 Prisma 客户端
docker-compose -f docker-compose.http.yml exec app npx prisma generate

# 推送数据库 Schema
docker-compose -f docker-compose.http.yml exec app npx prisma db push

# （可选）创建种子数据
docker-compose -f docker-compose.http.yml exec app npm run db:seed
```

---

### 步骤7：验证部署

```bash
# 检查容器状态
docker-compose -f docker-compose.http.yml ps

# 检查健康状态
curl http://localhost:80/health

# 应该返回：healthy
```

---

### 步骤8：访问应用

打开浏览器访问：
- **HTTP模式**：`http://YOUR_SERVER_IP`
- **应用直连**：`http://YOUR_SERVER_IP:333`

---

## 🎯 部署后操作

### 更新应用

```bash
# 拉取最新代码
git pull origin master

# 重新构建和启动
docker-compose -f docker-compose.http.yml up -d --build

# 清理旧镜像
docker image prune -f
```

### 查看日志

```bash
# 所有服务日志
docker-compose -f docker-compose.http.yml logs -f

# 仅应用日志
docker-compose -f docker-compose.http.yml logs -f app

# 仅数据库日志
docker-compose -f docker-compose.http.yml logs -f postgres
```

### 停止服务

```bash
docker-compose -f docker-compose.http.yml down
```

### 重启服务

```bash
docker-compose -f docker-compose.http.yml restart
```

---

## 🔧 使用部署脚本（高级）

项目提供了自动化部署脚本：

```bash
# 赋予执行权限
chmod +x scripts/deploy-production.sh

# 首次部署
./scripts/deploy-production.sh build
./scripts/deploy-production.sh start

# 查看日志
./scripts/deploy-production.sh logs

# 健康检查
./scripts/deploy-production.sh health

# 重启服务
./scripts/deploy-production.sh restart

# 停止服务
./scripts/deploy-production.sh stop

# 查看帮助
./scripts/deploy-production.sh help
```

---

## 📊 常见问题

### 问题：容器启动失败

**解决**：
```bash
# 查看日志
docker-compose -f docker-compose.http.yml logs app

# 检查配置
docker-compose -f docker-compose.http.yml config

# 删除旧容器重新启动
docker-compose -f docker-compose.http.yml down
docker-compose -f docker-compose.http.yml up -d
```

---

### 问题：数据库连接失败

**解决**：
```bash
# 等待数据库启动
sleep 15

# 检查数据库状态
docker-compose -f docker-compose.http.yml ps postgres

# 重新推送数据库 Schema
docker-compose -f docker-compose.http.yml exec app npx prisma db push
```

---

### 问题：无法访问应用

**解决**：
```bash
# 检查防火墙
# 在 Lighthouse 控制台确保开放 80 和 333 端口

# 检查 Nginx 状态
docker-compose -f docker-compose.http.yml logs nginx

# 重启 Nginx
docker-compose -f docker-compose.http.yml restart nginx
```

---

## 🔐 安全建议

1. **修改默认密码**
   ```bash
   # 编辑 .env.production
   nano .env.production
   # 修改 DB_PASSWORD 为强密码
   ```

2. **配置防火墙**
   - 在 Lighthouse 控制台配置安全组
   - 只开放必要端口（80, 443, 333）
   - 限制 SSH 访问IP

3. **启用 HTTPS（生产环境）**
   - 购买域名并备案
   - 申请SSL证书（Let's Encrypt或腾讯云）
   - 使用 `docker-compose.prod.yml` 启动

4. **定期备份数据**
   ```bash
   # 备份数据库
   docker-compose -f docker-compose.http.yml exec postgres pg_dump -U finance_user finance_system > backup_$(date +%Y%m%d).sql
   ```

---

## 📚 更多文档

- **完整部署清单**：[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- **部署规范**：[DEPLOYMENT.md](./DEPLOYMENT.md)
- **项目架构**：[ARCHITECTURE_PROGRESS.md](./ARCHITECTURE_PROGRESS.md)

---

## ✅ 部署成功检查

- [ ] 所有容器状态为 `running`
- [ ] 访问首页正常显示
- [ ] 能够注册新用户
- [ ] 能够登录并查看仪表板
- [ ] 数据加载正常
- [ ] 健康检查返回 `healthy`

---

**祝你部署顺利！** 🎉

如有问题，请查看 [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) 的常见问题排查部分。
