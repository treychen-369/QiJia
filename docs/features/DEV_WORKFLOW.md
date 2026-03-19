# 开发工作流指南

## 🎯 开发模式选择

| 模式 | 命令 | 数据库 | 适用场景 |
|------|------|--------|---------|
| **本地开发** | `npm run dev` | 本地 PostgreSQL | 开发新功能、破坏性测试 |
| **连接生产数据库** | 见下方 | 生产 PostgreSQL | 调试生产问题、验证功能 |

---

## 🚀 模式1：本地开发（默认）

```bash
# 使用本地数据库
npm run dev
# 访问 http://localhost:3000
```

**数据库**：本地 `localhost:5432`
**账号密码**：本地数据库的测试账号

---

## 🔗 模式2：连接生产数据库开发

### 步骤1：建立SSH隧道

在一个终端窗口运行（保持不关闭）：

```bash
ssh -L 5433:localhost:5432 root@your-server-ip
```

输入服务器密码后，隧道就建立了。

### 步骤2：启动开发服务器

在另一个终端运行：

**Windows PowerShell:**
```powershell
$env:DATABASE_URL="postgresql://postgres:123456@localhost:5433/finance_system"
$env:NEXTAUTH_SECRET="your-nextauth-secret-here"
npm run dev
```

**或者使用配置文件：**
```powershell
# 复制 .env.production.local 到 .env.local（临时）
copy .env.production.local .env.local
npm run dev
# 记得改回来：copy .env.local.backup .env.local
```

### 步骤3：访问

打开 http://localhost:3000，使用**生产环境的账号**登录。

---

## 📦 部署到生产环境

### 方式1：通过 CodeBuddy 部署（推荐）

在 CodeBuddy 中说：
> "帮我部署最新代码到生产环境"

### 方式2：手动部署

```bash
# 1. SSH 到服务器
ssh root@your-server-ip

# 2. 进入部署目录
cd /root/deploy_https_20260202133858

# 3. 停止服务
docker-compose -f docker-compose.https.yml down

# 4. 更新代码（上传新代码或 git pull）

# 5. 重新构建并启动
docker-compose -f docker-compose.https.yml up -d --build

# 6. 查看日志
docker logs -f finance-app
```

---

## 🗄️ 数据库操作

### Schema 变更

当修改 `prisma/schema.prisma` 后：

```bash
# 1. 本地应用
npx prisma db push

# 2. 生产环境应用（SSH到服务器后）
docker exec finance-app npx prisma db push
```

### 数据同步（本地 → 生产）

```bash
# 在 CodeBuddy 中说：
> "帮我把本地数据库的 [表名] 同步到生产环境"
```

---

## 🔐 环境变量对照

| 变量 | 本地开发 | 生产环境 |
|------|---------|---------|
| DATABASE_URL | localhost:5432 | finance-postgres:5432 |
| NEXTAUTH_URL | http://localhost:3000 | https://your-domain.example.com |
| NEXTAUTH_SECRET | your-secret-key... | your-nextauth-secret-here |

---

## ⚠️ 注意事项

1. **SSH隧道必须保持连接** - 关闭隧道窗口会断开数据库连接
2. **不要在生产数据库做破坏性操作** - 删除、清空等操作要谨慎
3. **Schema变更要两边都执行** - 否则会报错

---

## 🛠️ 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器IP | your-server-ip |
| 域名 | https://your-domain.example.com |
| SSH用户 | root |
| 部署目录 | /root/deploy_https_20260202133858 |
| PostgreSQL端口 | 5432（仅本地访问） |

---

## 📋 常用命令速查

```bash
# 本地开发
npm run dev

# 查看生产日志
ssh root@your-server-ip "docker logs -f finance-app"

# 生产数据库操作
ssh root@your-server-ip "docker exec -it finance-postgres psql -U postgres -d finance_system"

# 重启生产服务
ssh root@your-server-ip "cd /root/deploy_https_* && docker-compose -f docker-compose.https.yml restart"
```
