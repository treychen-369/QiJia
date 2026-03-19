# 🔐 密钥管理指南

> ⚠️ **重要**：此文件仅作为指南，**不要在此文件中填写真实密钥**！

---

## 📋 密钥清单

### 1️⃣ 应用运行密钥（存储在服务器 .env.prod）

| 密钥名 | 用途 | 生成方式 | 示例格式 |
|--------|------|---------|---------|
| `POSTGRES_PASSWORD` | 数据库密码 | 自己设置强密码 | `MyStr0ng!P@ssw0rd` |
| `NEXTAUTH_SECRET` | 用户会话加密 | `openssl rand -base64 32` | `K7x9...长字符串...` |
| `DEEPSEEK_API_KEY` | AI功能（可选） | DeepSeek官网申请 | `sk-...` |

**配置位置**：服务器上的 `deploy/env/.env.prod` 文件

```bash
# 在服务器上操作
cp deploy/env/.env.prod.example deploy/env/.env.prod
nano deploy/env/.env.prod  # 编辑填入真实值
```

---

### 2️⃣ CI/CD 部署密钥（存储在 CNB 密钥仓库）

| 密钥名 | 用途 | 获取方式 |
|--------|------|---------|
| `LIGHTHOUSE_HOST` | 服务器IP | 腾讯云控制台查看 |
| `POSTGRES_PASSWORD` | 数据库密码 | 与服务器 .env.prod 一致 |
| `NEXTAUTH_SECRET` | 会话加密 | 与服务器 .env.prod 一致 |

**配置方式**：CNB 使用「密钥仓库」管理敏感信息

#### 📋 密钥仓库配置步骤

1️⃣ **创建密钥仓库**
   - 访问：https://cnb.cool/new
   - 创建一个**私有仓库**，命名为 `secrets`
   - ⚠️ **必须设为私有！**

2️⃣ **在密钥仓库创建配置文件**
   
   创建文件 `finance-system.yml`，内容如下：
   
   ```yaml
   # QiJia Finance System 部署密钥
   # ⚠️ 此仓库必须保持私有！
   
   # 腾讯云轻量服务器 IP
   LIGHTHOUSE_HOST: "your-server-ip"
   
   # 数据库密码（与服务器 .env.prod 一致）
   POSTGRES_PASSWORD: "你的数据库密码"
   
   # NextAuth 密钥（与服务器 .env.prod 一致）
   NEXTAUTH_SECRET: "你的NextAuth密钥"
   
   # DeepSeek API（可选）
   DEEPSEEK_API_KEY: ""
   ```

3️⃣ **修改项目 .cnb.yml**
   
   确保 imports 路径指向你的密钥仓库：
   ```yaml
   imports:
     - https://cnb.cool/your-username/secrets/-/blob/main/finance-system.yml
   ```

#### 🔐 密钥仓库 vs 项目设置

```
┌────────────────────────────────────────────────────────────┐
│  ❌ 旧方式：项目设置 → 密钥管理                             │
│     CNB 不支持在项目设置中配置环境变量                      │
├────────────────────────────────────────────────────────────┤
│  ✅ 新方式：密钥仓库 + imports                              │
│     1. 创建私有仓库存放密钥                                 │
│     2. 在 .cnb.yml 中用 imports 引用                       │
│     3. CNB 构建时自动注入为环境变量                         │
└────────────────────────────────────────────────────────────┘
```

---

## 🔧 密钥生成方法

### NEXTAUTH_SECRET（必须）

```bash
# 方法1: 使用 openssl
openssl rand -base64 32

# 方法2: 使用 node
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 输出示例: K7x9mQ2bN8vF3hL1pR6wT4yU0oI5aS7d
```

### POSTGRES_PASSWORD（必须）

建议规则：
- 长度 >= 16 字符
- 包含大小写字母、数字、特殊字符
- 不要用默认的 `finance_password`

```bash
# 生成随机密码
openssl rand -base64 24
# 输出示例: xK9mN2vB8fH3lP1rW6tY4uO0iA5sD7gJ
```

### SSH_PRIVATE_KEY（服务器免密登录）

CNB 构建机需要 SSH 连接到你的服务器，有两种方式：

**方式 A：使用 CNB 构建机的公钥（推荐）**

CNB 构建时会自动使用平台提供的 SSH 密钥，你只需要：

1. 查看 CNB 构建日志获取构建机公钥
2. 将公钥添加到服务器的 `~/.ssh/authorized_keys`

**方式 B：在密钥仓库配置私钥**

如果需要自定义密钥对：

```bash
# 1. 在本地生成密钥对
ssh-keygen -t ed25519 -C "deploy@qijia-finance" -f deploy_key

# 2. 将公钥添加到服务器
ssh-copy-id -i deploy_key.pub root@your-server-ip

# 3. 将私钥内容添加到密钥仓库的 yml 文件
# 注意：私钥需要用引号包裹，保留换行
SSH_PRIVATE_KEY: |
  -----BEGIN OPENSSH PRIVATE KEY-----
  ...私钥内容...
  -----END OPENSSH PRIVATE KEY-----
```

---

## 📁 文件说明

```
deploy/env/
├── .env.example        # 通用模板（提交到Git）
├── .env.dev.example    # 开发环境模板（提交到Git）
├── .env.prod.example   # 生产环境模板（提交到Git）
├── .env.dev            # 开发环境配置（❌ 不提交）
├── .env.prod           # 生产环境配置（❌ 不提交）
└── SECRETS_GUIDE.md    # 本指南（提交到Git）
```

---

## ✅ 配置检查清单

### 首次部署前

- [ ] 生成 `NEXTAUTH_SECRET`
- [ ] 设置 `POSTGRES_PASSWORD`（强密码）
- [ ] 在服务器创建 `deploy/env/.env.prod`
- [ ] 填入所有必需的密钥值

### 设置 CI/CD 自动部署前

- [ ] 在 CNB 创建私有密钥仓库（如 `secrets`）
- [ ] 在密钥仓库创建 `finance-system.yml` 配置文件
- [ ] 填入服务器IP、数据库密码等信息
- [ ] 修改项目 `.cnb.yml` 的 imports 路径
- [ ] 确保服务器已配置 SSH 公钥（允许 CNB 免密登录）
- [ ] 测试自动部署流程

---

## 🔒 安全建议

### ✅ 推荐做法

1. **使用密码管理器**（如 1Password, Bitwarden）统一保存所有密钥
2. **定期轮换密钥**（建议每3-6个月）
3. **生产和开发使用不同密钥**
4. **备份密钥到安全位置**

### ❌ 禁止操作

1. **不要把密钥提交到 Git**
2. **不要在聊天/邮件中明文发送密钥**
3. **不要在文档中写真实密钥**
4. **不要多人共享同一个密钥**

---

## 💡 常见问题

### Q: 我忘记了 NEXTAUTH_SECRET 怎么办？

重新生成一个，但用户需要重新登录（session会失效）。

### Q: 我忘记了 POSTGRES_PASSWORD 怎么办？

如果容器还在运行，可以进入容器查看：
```bash
docker exec -it finance-app printenv POSTGRES_PASSWORD
```

如果完全忘记，需要重置数据库（会丢失数据）。

### Q: 密钥放哪里最安全？

推荐顺序：
1. **密码管理器**（最推荐）
2. **加密笔记**（如 Apple Notes 锁定笔记）
3. **离线加密文件**（如 7z 加密压缩）

---

## 📞 我的密钥记录位置

> 在下方记录你的密钥存储位置（不要写密钥本身！）

```
我的密钥保存在: ____________________
备份位置: ____________________
最后更新: ____________________
```
