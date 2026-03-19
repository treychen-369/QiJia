# 🔄 CI/CD 配置指南

本指南帮助你配置 GitHub Actions，实现自动部署到腾讯云 Lighthouse 服务器。

---

## 📋 前提条件

- ✅ GitHub 仓库
- ✅ 腾讯云 Lighthouse 服务器
- ✅ 服务器已安装 Docker 和 Docker Compose
- ✅ 服务器可通过 SSH 访问

---

## 🔑 配置 GitHub Secrets

在 GitHub 仓库中配置以下 Secrets（Settings → Secrets and variables → Actions → New repository secret）：

### 必需的 Secrets

| Secret 名称 | 说明 | 示例 |
|-------------|------|------|
| `SSH_PRIVATE_KEY` | 服务器的 SSH 私钥 | `-----BEGIN RSA PRIVATE KEY-----...` |
| `SERVER_HOST` | 服务器 IP 地址或域名 | `your-server-ip` 或 `example.com` |
| `DATABASE_URL` | 数据库连接字符串 | `postgresql://finance_user:PASSWORD@postgres:5432/finance_system` |
| `NEXTAUTH_URL` | 应用的访问地址 | `http://your-server-ip` |
| `NEXTAUTH_SECRET` | NextAuth 密钥（生成方法见下文） | `a1b2c3d4e5f6...` |

### 可选的 Secrets

| Secret 名称 | 说明 | 示例 |
|-------------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | `sk-xxxxx` |

---

## 🔐 生成 SSH 密钥

### 1. 在本地生成密钥对

```bash
# 生成 RSA 密钥对
ssh-keygen -t rsa -b 4096 -C "github-actions@finance-system" -f ~/.ssh/finance-system-key

# 不要设置密码（直接回车）
```

### 2. 将公钥添加到服务器

```bash
# 复制公钥到服务器
ssh-copy-id -i ~/.ssh/finance-system-key.pub root@YOUR_SERVER_IP

# 或手动添加
cat ~/.ssh/finance-system-key.pub | ssh root@YOUR_SERVER_IP 'cat >> ~/.ssh/authorized_keys'
```

### 3. 将私钥添加到 GitHub Secrets

```bash
# 复制私钥内容
cat ~/.ssh/finance-system-key

# 复制输出（包括 BEGIN 和 END 行）并添加到 GitHub Secret: SSH_PRIVATE_KEY
```

---

## 🔐 生成 NEXTAUTH_SECRET

```bash
# 生成随机密钥
openssl rand -base64 32

# 输出示例：a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e
```

将输出添加到 GitHub Secret: `NEXTAUTH_SECRET`

---

## 🗄️ 配置数据库 URL

### 生成数据库密码

```bash
# 生成随机密码
openssl rand -base64 16

# 输出示例：xYz123AbC456DefGhiJ789
```

### 构建 DATABASE_URL

```
postgresql://finance_user:YOUR_PASSWORD@postgres:5432/finance_system
```

示例：
```
postgresql://finance_user:xYz123AbC456DefGhiJ789@postgres:5432/finance_system
```

将完整的 URL 添加到 GitHub Secret: `DATABASE_URL`

---

## 🌐 配置 NEXTAUTH_URL

### 如果使用 IP 地址

```
http://YOUR_SERVER_IP
```

示例：
```
http://your-server-ip
```

### 如果使用域名

```
https://your-domain.com
```

---

## ✅ 验证配置

### 1. 测试 SSH 连接

```bash
# 使用私钥测试 SSH 连接
ssh -i ~/.ssh/finance-system-key root@YOUR_SERVER_IP

# 应该能够成功登录，无需输入密码
```

### 2. 测试 GitHub Actions

#### 方法1：推送代码触发

```bash
git add .
git commit -m "test: trigger CI/CD"
git push origin master
```

#### 方法2：手动触发

1. 进入 GitHub 仓库
2. 点击 "Actions" 标签
3. 选择 "Deploy to Lighthouse"
4. 点击 "Run workflow" 按钮

---

## 📊 查看 CI/CD 状态

### 1. GitHub Actions 页面

进入仓库 → Actions 标签 → 查看工作流运行状态

### 2. 查看部署日志

点击具体的工作流运行 → 查看每个步骤的详细日志

---

## 🔧 工作流说明

### Build and Test 工作流

触发条件：每次 push 和 Pull Request

**包含的步骤**：
1. **Lint** - 代码检查
   - 运行 ESLint
   - TypeScript 类型检查

2. **Build** - 构建测试
   - 安装依赖
   - 构建 Next.js 应用

3. **Docker Build** - Docker 构建测试
   - 构建 Docker 镜像
   - 测试镜像运行

### Deploy to Lighthouse 工作流

触发条件：
- 推送到 master/main 分支
- 手动触发

**包含的步骤**：
1. 检出代码
2. 配置 SSH
3. 部署到服务器
4. 健康检查

---

## 🎯 自动部署流程

```
代码推送
  ↓
GitHub Actions 触发
  ↓
运行 Build and Test
  ├─ Lint 检查
  ├─ 构建 Next.js
  └─ Docker 构建
  ↓
运行 Deploy to Lighthouse
  ├─ SSH 连接服务器
  ├─ 拉取最新代码
  ├─ 重新构建 Docker 镜像
  ├─ 重启服务
  ├─ 初始化数据库
  └─ 健康检查
  ↓
部署成功 ✅
```

---

## 🐛 常见问题

### 问题1：SSH 连接失败

**症状**：GitHub Actions 日志显示 `Permission denied (publickey)`

**解决**：
1. 检查 SSH_PRIVATE_KEY 是否正确（包含完整的密钥）
2. 检查公钥是否已添加到服务器的 `~/.ssh/authorized_keys`
3. 检查 `~/.ssh/authorized_keys` 文件权限（应为 600）

```bash
# 在服务器上检查权限
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

---

### 问题2：Docker 构建失败

**症状**：`docker-compose up -d` 失败

**解决**：
1. 检查服务器是否安装 Docker 和 Docker Compose
2. 检查 `.dockerignore` 文件是否正确
3. 查看详细日志定位问题

```bash
# 在服务器上手动测试
docker-compose -f docker-compose.http.yml build
```

---

### 问题3：数据库连接失败

**症状**：应用无法连接数据库

**解决**：
1. 检查 DATABASE_URL 格式是否正确
2. 确保数据库密码与配置一致
3. 等待数据库容器启动

```bash
# 检查数据库状态
docker ps | grep postgres
docker logs finance-postgres
```

---

### 问题4：健康检查失败

**症状**：部署成功但健康检查失败

**解决**：
1. 增加健康检查等待时间（修改 workflow 中的 `sleep` 时间）
2. 检查 Nginx 配置
3. 查看应用日志

```bash
# 手动测试健康检查
curl http://YOUR_SERVER_IP/health
```

---

## 🔧 自定义配置

### 修改部署脚本

编辑 `.github/workflows/deploy-to-lighthouse.yml`，可以自定义：
- 部署命令
- 健康检查 URL
- 清理策略
- 通知方式

### 添加通知

可以在工作流最后添加通知步骤：

```yaml
- name: Send notification
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: '部署完成'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 📚 相关文档

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [GitHub Secrets 文档](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- [QUICKSTART_DEPLOYMENT.md](./QUICKSTART_DEPLOYMENT.md)

---

## ✅ 部署成功检查

CI/CD 部署成功后：

- [ ] GitHub Actions 工作流显示绿色 ✅
- [ ] 所有步骤通过
- [ ] 健康检查成功
- [ ] 能够访问应用
- [ ] 功能正常

---

**祝你的 CI/CD 配置顺利！** 🚀
