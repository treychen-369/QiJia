# 贡献指南 | Contributing Guide

感谢你对 QiJia（齐家）的关注！我们欢迎所有形式的贡献。

## 🚀 快速开始

### 1. Fork 并克隆

```bash
git clone https://github.com/your-username/qijia-finance.git
cd qijia-finance
```

### 2. 搭建开发环境

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，配置 DATABASE_URL、NEXTAUTH_SECRET 等

# 初始化数据库
npm run db:generate
npm run db:push
npm run db:seed

# 启动开发服务器
npm run dev
```

### 3. 创建分支

```bash
git checkout -b feature/your-feature-name
```

## 📝 代码规范

### 架构原则

- **服务层架构**：所有业务逻辑在 `src/lib/services/` 实现
- **前端零计算**：前端不做任何金融计算（市值、盈亏、汇率）
- **API 数据完整**：API 返回扁平化、已计算的完整数据

### TypeScript

- 使用严格类型，避免 `any`
- 所有 API 响应使用类型定义

### 命名规范

```typescript
// 服务层方法
calculatePortfolioOverview(userId: string)
getAccountsSummary(userId: string)

// API 返回格式
return NextResponse.json({
  success: true,
  data: result,
  calculatedAt: new Date().toISOString()
})
```

### 提交信息

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
feat: 添加港股持仓导入功能
fix: 修复汇率计算精度问题
docs: 更新部署文档
refactor: 重构投资组合服务
```

## 🔍 提交 PR

1. 确保代码通过 TypeScript 检查：`npm run type-check`
2. 确保代码通过 Lint：`npm run lint`
3. 在本地验证功能正常：`npm run dev`
4. 提交 PR 并描述你的修改

## 🐛 报告 Bug

请通过 [GitHub Issues](https://github.com/your-username/qijia-finance/issues) 提交，包含：

- 问题描述
- 复现步骤
- 期望行为
- 实际行为
- 截图（如适用）

## 💡 功能建议

欢迎通过 Issues 提交功能建议！请描述：

- 使用场景
- 期望的功能
- 为什么这个功能对用户有价值

---

感谢你的贡献！🎉
