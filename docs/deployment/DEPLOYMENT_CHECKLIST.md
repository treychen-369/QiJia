# 部署检查清单 - QiJia Finance System

## 📋 部署时机建议

### 当前状态（2025-01-29）
- ✅ Phase 1 完成：计算逻辑修复
  - 今日收益基于历史快照
  - 净资产扣除负债
  - 总资产包含所有资产类型

### 建议部署时间节点

| 阶段 | 功能 | 适合部署 | 说明 |
|------|------|---------|------|
| **Phase 1** ✅ | 计算逻辑修复 | ⚠️ 可以 | 核心计算已正确，但缺少历史数据 |
| **Phase 2** | 目标配置体系 | ✅ 推荐 | 完整的资产管理功能 |
| **Phase 3** | 投资建议引擎 | ⭐ 最佳 | 功能完整，用户体验最好 |

---

## 🖥️ 本地 vs 服务器方案对比

### 本地开发环境（当前）

**优点**：
- 即时修改和测试
- 数据完全可控

**缺点**：
- ❌ 定时任务不稳定（电脑关机）
- ❌ 网络不稳定
- ❌ 数据库需要本地维护

---

### 类生产服务器（推荐）

**优点**：
- ✅ 稳定的定时快照任务（cron）
- ✅ 24/7 运行
- ✅ 多端访问
- ✅ 数据库统一管理
- ✅ 自动备份

**推荐配置**：
- VPS/云服务器（2核4G起步）
- PostgreSQL（云数据库或Docker）
- Docker Compose 部署

---

## 🔧 本地定时快照方案

### Windows 任务计划程序设置

1. **打开任务计划程序**
   ```
   Win + R → taskschd.msc
   ```

2. **创建基本任务**
   - 名称：`Finance System Daily Snapshot`
   - 触发器：每天 00:00
   - 操作：启动程序

3. **程序设置**
   ```
   程序: node
   参数: C:\Users\yourname\project-path's finance system\scripts\create-daily-snapshots.js
   起始于: C:\Users\yourname\project-path's finance system
   ```

4. **高级设置**
   - ✅ 唤醒计算机运行此任务
   - ✅ 如果任务失败，重新启动间隔 10 分钟

### 本地方案的局限性

| 场景 | 会发生什么 |
|------|-----------|
| 电脑关机 | ❌ 任务不执行，今日收益数据缺失 |
| 网络断开 | ❌ 数据库连接失败 |
| 系统更新重启 | ⚠️ 可能错过执行时间 |

---

## 🚀 服务器部署方案

### 方案A：Docker Compose 全栈部署

```yaml
# docker-compose.yml (生产版)
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/finance
    depends_on:
      - db
    restart: always

  db:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=finance
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    restart: always

  # 定时任务服务
  cron:
    build:
      context: .
      dockerfile: Dockerfile.cron
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/finance
    depends_on:
      - db
    restart: always

volumes:
  pgdata:
```

### 方案B：云数据库 + 轻量服务器

**架构**：
```
[用户] → [云服务器 App] → [云数据库 PostgreSQL]
```

**优点**：
- 数据库自动备份
- 服务器可随时更换
- 成本更可控

### 定时快照 Cron 设置

```bash
# /etc/crontab 或 crontab -e
# 每天 00:05 执行快照（避开整点）
5 0 * * * cd /app && node scripts/create-daily-snapshots.js >> /var/log/snapshot.log 2>&1
```

---

## 📊 部署前检查清单

### 功能完整性

- [x] 总资产计算正确（包含所有资产类型）
- [x] 净资产计算正确（扣除负债）
- [x] 今日收益基于历史快照
- [x] 现金流动性正确显示（含活期存款）
- [ ] 目标配置体系（Phase 2）
- [ ] 投资建议引擎（Phase 3）

### 数据迁移

- [ ] 导出本地数据库
- [ ] 验证数据完整性
- [ ] 导入服务器数据库
- [ ] 验证API响应一致

### 安全配置

- [ ] 环境变量配置（不要提交 .env）
- [ ] 数据库密码强度
- [ ] HTTPS 证书
- [ ] NextAuth SECRET 更换

### 监控配置

- [ ] 日志收集
- [ ] 错误告警
- [ ] 性能监控

---

## 💡 建议

### 短期（Phase 1 完成后）

1. **可以继续本地开发**
   - 手动创建历史快照测试今日收益
   - 验证计算逻辑正确性

2. **准备服务器环境**
   - 选择云服务商
   - 配置 Docker 环境
   - 测试部署流程

### 中期（Phase 2 完成后）

1. **部署到测试服务器**
   - 验证所有功能
   - 启用定时快照
   - 积累历史数据

2. **本地继续开发 Phase 3**

### 长期（Phase 3 完成后）

1. **正式上线**
   - 完整功能
   - 稳定运行

---

## 🔗 数据库直连配置

部署后，本地开发可以直连服务器数据库：

```env
# .env.local
DATABASE_URL="postgresql://user:password@your-server-ip:5432/finance_system"
```

**注意**：
- 确保服务器防火墙开放 5432 端口（仅限开发IP）
- 或使用 SSH 隧道更安全

```bash
# SSH 隧道
ssh -L 5433:localhost:5432 user@your-server-ip

# 本地连接
DATABASE_URL="postgresql://user:password@localhost:5433/finance_system"
```

---

## 📁 相关文件

- `docker-compose.yml` - 本地开发版
- `Dockerfile` - 应用镜像
- `scripts/create-daily-snapshots.js` - 快照脚本
- `SCHEDULED_TASK_SETUP.md` - 定时任务详细设置
