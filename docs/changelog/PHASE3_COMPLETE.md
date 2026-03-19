# Phase 3: 智能资产配置目标系统 - 完成报告

## 📋 完成日期
2026-01-29

## 🎯 目标概述
创建一个智能的资产配置目标管理系统，支持：
- 细化到二级分类的目标配置
- AI 投资顾问 Sub-Agent
- 实时对比分析
- 偏离告警机制

---

## ✅ 完成内容

### 1. 数据模型 (Prisma Schema)

新增3个表：

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `user_allocation_targets` | 用户配置目标 | categoryCode, targetPercent, minPercent, maxPercent, alertThreshold |
| `family_financial_profiles` | 家庭财务概况 | householdMembers, monthlyIncome, riskTolerance, investmentHorizon |
| `allocation_advices` | AI建议记录 | advice, summary, confidence, status |

### 2. 服务层 (AllocationService)

**文件**: `src/lib/services/allocation-service.ts`

**核心方法**:
- `getAllocationTargets(userId)` - 获取配置目标
- `updateAllocationTargets(userId, targets)` - 更新配置目标
- `getAnalysis(userId)` - 获取配置分析（含偏离计算）
- `getFamilyProfile(userId)` - 获取家庭概况
- `updateFamilyProfile(userId, data)` - 更新家庭概况
- `saveAIAdvice(userId, advice)` - 保存AI建议
- `getLatestAdvice(userId)` - 获取最新建议

### 3. API Routes

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/allocation/targets` | GET | 获取配置目标 |
| `/api/allocation/targets` | PUT | 更新配置目标 |
| `/api/allocation/targets` | POST | 重置为默认 |
| `/api/allocation/analysis` | GET | 获取配置分析 |
| `/api/allocation/ai-advice` | GET | 获取最新AI建议 |
| `/api/allocation/ai-advice` | POST | 请求新的AI建议 |
| `/api/allocation/family-profile` | GET | 获取家庭概况 |
| `/api/allocation/family-profile` | PUT | 更新家庭概况 |

### 4. AI 投资顾问 Sub-Agent

**定义文件**: `.codebuddy/agents/asset-allocation-advisor.md`

**核心能力**:
- CFP（注册理财规划师）专业背景
- 中国大陆、香港、美国市场了解
- 现代投资组合理论支持
- 基于家庭情况的个性化建议

**输入数据**:
- 家庭财务概况（收入、支出、风险偏好等）
- 当前资产配置（按类型、地区分布）
- 市场环境（可选）

**输出格式**:
- 配置建议摘要
- 详细调仓建议（优先级、金额、理由）
- 风险提示
- 下次复盘建议

### 5. 前端组件

| 组件 | 文件 | 功能 |
|------|------|------|
| AllocationOverview | `allocation-overview.tsx` | 配置概览、健康度评分、偏离分析、告警列表 |
| FamilyProfileForm | `family-profile-form.tsx` | 家庭概况表单（收入、风险偏好、保障情况） |
| AllocationPage | `app/allocation/page.tsx` | 资产配置管理页面（Tab布局） |

### 6. 偏离分析逻辑

```typescript
// 偏离状态判断
const absDeviation = Math.abs(currentPercent - targetPercent);
if (absDeviation >= alertThreshold * 2) {
  deviationStatus = 'CRITICAL';  // 严重偏离
} else if (absDeviation >= alertThreshold) {
  deviationStatus = 'WARNING';   // 需关注
} else {
  deviationStatus = 'NORMAL';    // 正常
}

// 建议操作判断
if (currentPercent > maxPercent) {
  suggestedAction = 'SELL';      // 减仓
} else if (currentPercent < minPercent) {
  suggestedAction = 'BUY';       // 增配
} else if (deviationStatus !== 'NORMAL') {
  suggestedAction = 'REBALANCE'; // 再平衡
} else {
  suggestedAction = 'HOLD';      // 维持
}
```

### 7. 健康度评分算法

```typescript
let score = 100;

// 根据偏离程度扣分
for (const item of analysis) {
  if (item.deviationStatus === 'CRITICAL') score -= 15;
  else if (item.deviationStatus === 'WARNING') score -= 5;
  else if (Math.abs(item.deviation) > 2) score -= 2;
}

// 集中风险扣分
if (hasConcentrationRisk) score -= 10;

return Math.max(0, Math.min(100, score));
```

---

## 📁 新增文件列表

```
.codebuddy/
└── agents/
    └── asset-allocation-advisor.md      # AI顾问定义

src/
├── app/
│   ├── allocation/
│   │   └── page.tsx                      # 配置管理页面
│   └── api/
│       └── allocation/
│           ├── targets/route.ts          # 目标API
│           ├── analysis/route.ts         # 分析API
│           ├── ai-advice/route.ts        # AI建议API
│           └── family-profile/route.ts   # 家庭概况API
│
├── components/
│   └── allocation/
│       ├── index.ts                      # 导出文件
│       ├── allocation-overview.tsx       # 配置概览组件
│       └── family-profile-form.tsx       # 家庭概况表单
│
└── lib/
    └── services/
        └── allocation-service.ts         # 配置服务

prisma/
└── schema.prisma                         # 新增3个表
```

---

## 🔧 使用说明

### 1. 访问配置管理页面

```
http://localhost:3000/allocation
```

### 2. 配置流程

1. **填写家庭概况** → "家庭概况"Tab
2. **查看配置分析** → "配置分析"Tab
3. **请求AI建议** → 点击"请求AI建议"按钮
4. **调整目标** → 点击"编辑目标"按钮

### 3. API 调用示例

```bash
# 获取配置分析
curl http://localhost:3000/api/allocation/analysis

# 请求AI建议
curl -X POST http://localhost:3000/api/allocation/ai-advice \
  -H "Content-Type: application/json" \
  -d '{}'

# 更新配置目标
curl -X PUT http://localhost:3000/api/allocation/targets \
  -H "Content-Type: application/json" \
  -d '{"targets":[{"categoryCode":"EQUITY","targetPercent":40},...]}'
```

---

## 📊 功能特性

### 已实现 ✅

| 功能 | 状态 | 说明 |
|------|------|------|
| 6大类资产目标配置 | ✅ | EQUITY, CASH, FIXED_INCOME, FUND, REAL_ESTATE, ALTERNATIVE |
| 偏离分析 | ✅ | NORMAL/WARNING/CRITICAL 三级状态 |
| 健康度评分 | ✅ | 0-100分 |
| 偏离告警 | ✅ | 按严重程度排序 |
| AI建议生成 | ✅ | 基于规则的模拟建议（可升级为真实AI） |
| 家庭概况管理 | ✅ | 收入、支出、风险偏好、保障情况 |
| 目标编辑 | ✅ | 滑块调整，实时验证总和 |

### 待优化 ⏳

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 二级分类目标 | P1 | 当前只支持一级分类 |
| 真实AI调用 | P1 | 接入 Claude/GPT 等 |
| 历史建议查看 | P2 | API已有，前端需完善 |
| 目标模板 | P2 | 预设配置方案（保守/稳健/激进） |
| 定期检查提醒 | P3 | 每月自动分析并推送 |

---

## 🚀 后续计划

### Phase 4: 投资建议引擎
- 具体调仓建议（到证券级别）
- 交易成本估算
- 税务优化建议

### 接入真实 AI

当前使用基于规则的模拟建议，可升级为：

1. **调用 Claude API**
```typescript
const response = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  system: agentPrompt,
  messages: [{ role: 'user', content: userContext }],
});
```

2. **使用 CodeBuddy Sub-Agent**
```typescript
// 通过 MCP 调用内置 Agent
const advice = await mcp.invoke('asset-allocation-advisor', inputData);
```

---

## ✅ 验证步骤

1. 启动开发服务器: `npm run dev`
2. 访问: `http://localhost:3000/allocation`
3. 填写家庭概况
4. 查看配置分析和偏离告警
5. 请求AI建议
6. 编辑配置目标

---

## 📝 注意事项

1. **Prisma Generate**: 如果遇到锁定错误，重启 IDE 或终端后重试
2. **数据库同步**: `npx prisma db push` 已执行，表结构已创建
3. **导航**: 需要手动访问 `/allocation`，或在 Dashboard 添加入口

---

**Phase 3 完成！** 🎉
