<div align="center">

# 🏠 QiJia 齐家

### 家庭资产管理系统 · Family Finance Management System

**修身齐家治国平天下 —— 资产是力量源泉，管理资产就是管理人生。**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-Apache%202.0-green)](./LICENSE)

[简体中文](#-功能特性) · [English](#-features)

</div>

---

## ✨ 功能特性

### 📊 资产总览
- **一站式仪表板** — 总资产、净资产、负债、盈亏一目了然
- **多维度资产分布** — 按类别（权益/现金/固收/另类/不动产）、地区、账户分布展示
- **实时行情** — 接入证券数据 API，自动更新持仓市值和盈亏
- **本月资产变动** — 追踪月度资产变化趋势

### 💼 投资管理
- **证券持仓** — A股、港股、美股多市场持仓管理
- **现金管理** — 活期存款、定期存单、货币基金
- **固定收益** — 国债、债券、保险理财
- **另类投资** — 黄金等贵金属投资
- **负债管理** — 房贷、车贷、信用贷等负债跟踪

### 👨‍👩‍👧‍👦 家庭协作
- **家庭视角** — 汇总家庭成员资产，全面掌握家庭财务状况
- **角色权限** — 管理员/成员分级管理
- **邀请机制** — 通过邀请码/链接添加家庭成员

### 🤖 AI 智能分析
- **资产配置建议** — AI 根据风险偏好和投资目标提供配置建议
- **再平衡提醒** — 当资产偏离目标配置时自动提醒
- **投资洞察** — 基于持仓数据的智能分析

### 📥 数据导入
- **Excel 批量导入** — 支持账户余额、资产明细、投资计划等 5 种数据类型
- **智能解析** — 自动识别工作表类型和字段映射
- **预览确认** — 导入前可预览数据并确认

### ⚙️ 个性化设置
- **深色/浅色主题** — 护眼夜间模式
- **涨跌颜色** — 支持"涨红跌绿"和"涨绿跌红"两种配色
- **金额格式** — 简洁(¥692万)或完整(¥6,920,000)显示
- **隐私模式** — 一键隐藏金额，保护隐私

---

## 🛠 技术架构

| 层级 | 技术栈 |
|------|--------|
| **前端** | Next.js 14, TypeScript, Tailwind CSS, Radix UI, Recharts |
| **后端** | Next.js API Routes, NextAuth.js (认证) |
| **数据库** | PostgreSQL 16, Prisma ORM (30 个数据模型) |
| **AI 引擎** | DeepSeek API |
| **证券数据** | Tushare API (A股/港股) |
| **部署** | Docker, Nginx, 支持任何云服务商 |

### 架构原则

- **服务层架构** — 所有业务逻辑在 `src/lib/services/` 实现，API 只做数据转发
- **前端零计算** — 前端不做任何金融计算（市值、盈亏、汇率），所有数值由服务端完成
- **API 数据完整** — API 返回扁平化、已计算的完整数据

---

## 🚀 快速开始

### 前置要求

- Node.js >= 18
- PostgreSQL >= 15
- npm >= 8

### 1. 克隆项目

```bash
git clone https://github.com/your-username/qijia-finance.git
cd qijia-finance
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件，至少配置以下必需项：

```env
# 数据库连接
DATABASE_URL="postgresql://username:password@localhost:5432/finance_system"

# NextAuth 配置
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"  # 生成: openssl rand -base64 32
```

### 4. 初始化数据库

```bash
# 生成 Prisma 客户端
npm run db:generate

# 创建数据库表
npm run db:push

# 导入演示数据
npm run db:seed
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

**演示账户：**
- 管理员：`admin@example.com` / `admin123456`
- 普通用户：`demo@example.com` / `demo123456`

### Docker 部署

```bash
# 一键启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

详细部署文档参见 [deploy/README.md](./deploy/README.md)

---

## 📁 项目结构

```
qijia-finance/
├── src/
│   ├── app/                  # Next.js App Router (页面和API)
│   │   ├── api/              # API 路由 (49个接口)
│   │   ├── dashboard/        # V1 仪表板
│   │   ├── dashboard-v2/     # V2 仪表板 (推荐)
│   │   └── auth/             # 认证页面
│   ├── components/           # React 组件 (100+)
│   ├── lib/
│   │   ├── services/         # 服务层 (核心业务逻辑)
│   │   └── utils/            # 工具函数
│   └── types/                # TypeScript 类型定义
├── prisma/                   # Prisma Schema + 种子数据
├── deploy/                   # 部署配置 (Docker/Nginx/脚本)
├── e2e/                      # E2E 测试 (Playwright)
└── docs/                     # 项目文档
```

---

## 📸 Screenshots

> 🚧 截图即将添加

---

## 🤝 参与贡献

我们欢迎所有形式的贡献！请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解：

- 如何搭建开发环境
- 代码规范和提交约定
- PR 提交流程

---

## 📄 开源许可

本项目采用 [Apache License 2.0](./LICENSE) 开源许可。

---

## 🔐 安全政策

如果您发现安全漏洞，请查阅 [SECURITY.md](./SECURITY.md) 了解负责任的漏洞披露流程。

---

<div align="center">

## ✨ Features

</div>

### 📊 Portfolio Overview
- **All-in-one Dashboard** — Total assets, net worth, liabilities, and P&L at a glance
- **Multi-dimensional Distribution** — View by category (equity/cash/fixed income/alternatives/property), region, and account
- **Real-time Quotes** — Auto-update holdings with live market data
- **Monthly Changes** — Track month-over-month asset changes

### 💼 Investment Management
- **Securities Holdings** — A-shares, Hong Kong stocks, US stocks
- **Cash Management** — Demand deposits, fixed deposits, money market funds
- **Fixed Income** — Government bonds, insurance products
- **Alternatives** — Gold and precious metals
- **Liability Tracking** — Mortgages, car loans, credit lines

### 👨‍👩‍👧‍👦 Family Collaboration
- **Family View** — Aggregate family members' assets for a complete picture
- **Role-based Access** — Admin and member roles with different permissions
- **Invitation System** — Add family members via invitation code or link

### 🤖 AI-Powered Insights
- **Asset Allocation Advice** — AI-driven recommendations based on risk profile
- **Rebalancing Alerts** — Notifications when portfolio drifts from targets
- **Investment Analysis** — Data-driven insights from your holdings

### Quick Start

```bash
git clone https://github.com/your-username/qijia-finance.git
cd qijia-finance
cp .env.example .env.local   # Edit with your config
npm install
npm run db:generate && npm run db:push && npm run db:seed
npm run dev                   # Visit http://localhost:3000
```

**Demo credentials:** `admin@example.com` / `admin123456`

---

<div align="center">

**QiJia 齐家** — 让每个家庭都能轻松管理财富

</div>
