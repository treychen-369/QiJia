/**
 * DeepSeek AI 服务
 * 
 * 提供与 DeepSeek API 的集成，用于生成资产配置建议
 */

import { createLogger } from '@/lib/logger';

const logger = createLogger('DeepSeek');

// ==================== 配置 ====================

/**
 * DeepSeek API 配置
 * 
 * 关于参数选择：
 * 
 * 1. Model 选择：
 *    - deepseek-chat: DeepSeek-V3.2 非思考模式，响应快，适合标准分析任务
 *    - deepseek-reasoner: DeepSeek-R1 思考模式，多步推理，适合复杂财务决策分析
 *    资产配置分析涉及多约束条件博弈，默认使用 reasoner 深度推理
 * 
 * 2. Temperature 选择（根据官方建议）：
 *    - 代码生成/数学解题: 0.0
 *    - 数据抽取/分析: 1.0
 *    - 通用对话: 1.3
 *    - 创意写作: 1.5
 *    财务建议属于"数据分析+决策建议"，使用 0.8 在稳定性和表达能力间平衡
 *    注意：deepseek-reasoner 不支持 temperature 参数
 */
const DEEPSEEK_CONFIG = {
  apiKey: process.env.DEEPSEEK_API_KEY || '',  // 必须通过环境变量配置
  baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  model: process.env.DEEPSEEK_MODEL || 'deepseek-reasoner',  // 默认使用思考模式
  chatModel: 'deepseek-chat',  // 快速分析用
  reasonerModel: 'deepseek-reasoner',  // 深度分析用
  maxTokens: 8192,  // reasoner 输出更多内容，增大 token 上限
  temperature: 0.8,  // 仅 chat 模式使用
};

// API Key 验证
function validateApiKey(): boolean {
  if (!DEEPSEEK_CONFIG.apiKey) {
    logger.error('DEEPSEEK_API_KEY 未配置，请在环境变量中设置');
    return false;
  }
  return true;
}

// ==================== 类型定义 ====================

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      reasoning_content?: string;  // reasoner 模式的思维链
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens?: number;  // reasoner 模式的推理 token
  };
}

export interface AIAdviceResult {
  summary: string;
  confidence: number;
  targets: Array<{
    categoryCode: string;
    categoryName: string;
    currentPercent: number;
    suggestedPercent: number;
    reason: string;
  }>;
  actions: Array<{
    priority: number;
    category: string;
    categoryName: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    amount?: number;
    reason: string;
  }>;
  rebalanceStrategy: {
    periodType: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
    totalPeriods: number;
    firstPeriodRatio: number;
    reasoning: string;
    urgentCategories: string[];
  };
  risks: string[];
  nextReviewDate: string;
  fullAnalysis: string;
}

// 财务目标类型
export interface FinancialGoalsForPrompt {
  primaryGoal?: string;          // 主要目标
  shortTermGoals?: string[];     // 短期目标（1-3年）
  mediumTermGoals?: string[];    // 中期目标（3-10年）
  longTermGoals?: string[];      // 长期目标（10年以上）
  targetNetWorth?: number;       // 目标净资产
  targetDate?: string;           // 目标达成时间
  notes?: string;                // 其他说明
  goals?: Record<string, {
    enabled?: boolean;
    customTargetAmount?: number;
    customTargetYear?: number;
  }>;
}


export interface FamilyProfileForPrompt {
  householdMembers: number;
  primaryEarnerAge?: number;
  childrenCount: number;
  elderlyCount: number;
  monthlyIncome?: number;
  incomeStability?: string;
  monthlyExpenses?: number;
  emergencyFundMonths: number;
  riskTolerance: string;
  investmentHorizon: string;
  retirementAge?: number;
  hasHomeLoan: boolean;
  homeLoanMonthlyPayment?: number;
  hasCarLoan: boolean;
  hasOtherLoans: boolean;
  hasLifeInsurance: boolean;
  hasHealthInsurance: boolean;
  hasCriticalIllnessInsurance: boolean;
  financialGoals?: FinancialGoalsForPrompt;  // 财务目标
}

/**
 * 负债数据（用于提示词生成）
 * ⚠️ 2026-02-01新增：使用实际负债数据，与负债管理模块保持一致
 */
export interface LiabilityDataForPrompt {
  totalLiabilities: number;       // 总负债余额
  totalMonthlyPayment: number;    // 总月供
  liabilityCount: number;         // 负债笔数
  averageInterestRate: number;    // 平均利率
  byType: Array<{
    type: string;
    typeName: string;
    totalBalance: number;
    count: number;
  }>;
}

/**
 * 二级资产分类（子分类）
 */
export interface SubCategoryDataForPrompt {
  categoryCode: string;
  categoryName: string;
  value: number;
  percentage: number;  // 在该分组内的占比
  count: number;
}

/**
 * 资产分组的二级分类详情
 */
export interface GroupSubCategoriesForPrompt {
  groupCode: string;
  groupName: string;
  total: number;
  count: number;
  bySubCategory: SubCategoryDataForPrompt[];
}

/**
 * 权益类按地区细分数据
 * ⚠️ 2026-02-01新增：用于AI提示词中展示权益资产的地区分布
 */
export interface EquityByRegionForPrompt {
  total: number;
  count: number;
  byRegion: Array<{
    regionCode: string;
    regionName: string;
    value: number;
    percentage: number;
    count: number;
  }>;
}

export interface PortfolioDataForPrompt {
  totalAssets: number;
  netWorth?: number;           // ✨ 新增：净资产（总资产 - 总负债）
  totalLiabilities?: number;   // ✨ 新增：总负债
  currentAllocation: Array<{
    type: string;
    typeName: string;
    value: number;
    percentage: number;
  }>;
  regionAllocation: Array<{
    name: string;
    percentage: number;
  }>;
  // ✨ 新增：实际负债数据
  liabilityData?: LiabilityDataForPrompt;
  // ✨ 新增：各资产分组的二级分类细分
  groupsSubCategories?: Record<string, GroupSubCategoriesForPrompt>;
  // ✨ 新增：权益类按地区细分（因为权益资产是按地区而非子分类划分）
  equityByRegion?: EquityByRegionForPrompt;
}

// ==================== 提示词模板 ====================

/**
 * 系统提示词 - 定义 AI 的角色和行为规范
 * ⚠️ 2026-02-01更新：新增二级资产细分说明，让AI能够给出更具体的建议
 * ⚠️ 2026-02-01优化：增强输出格式要求，确保建议细化到二级资产
 * ⚠️ 2026-02-01修复：消除与用户提示词的重合和矛盾
 */
export const SYSTEM_PROMPT = `你是一位专业的家庭财务规划顾问，拥有 CFA（特许金融分析师）和 CFP（注册理财规划师）双重认证资质。

## 你的职责

1. **资产配置分析**：评估家庭当前的资产配置情况，找出潜在风险和优化空间
2. **个性化建议**：根据家庭的具体情况（年龄、收入、风险偏好、财务目标等）提供定制化的配置建议
3. **操作指导**：给出具体的调仓建议（买入/卖出/持有），细化到二级资产
4. **再平衡策略**：根据偏离程度、资金规模和市场环境，制定合理的分期调仓计划（周期类型、期数、首期比例）
5. **风险提示**：识别并提醒可能的风险因素
6. **目标导向**：所有建议应围绕用户的财务目标展开

## 核心原则

1. **安全第一**：确保应急资金充足，以用户设定的目标月数为准（若未设定则默认6个月支出）
2. **风险匹配**：配置方案必须同时匹配风险偏好和投资期限，使用以下交叉约束表：

### 风险偏好 × 投资期限 → 权益类配置上限
| 风险偏好 \\ 投资期限 | 短期(1-3年) | 中期(3-10年) | 长期(10年+) |
|---|---|---|---|
| 保守型(CONSERVATIVE) | ≤15% | ≤30% | ≤40% |
| 稳健型(MODERATE) | ≤25% | ≤50% | ≤60% |
| 进取型(AGGRESSIVE) | ≤40% | ≤65% | ≤75% |

**重要**：即使风险偏好是进取型，短期投资也不应超过40%权益配置，因为短期波动可能导致本金亏损。

3. **现金流导向**：你的建议不能仅靠存量资产的重新配置来达成目标。必须综合考虑：
   - **月可投资额** = 月收入 - 月支出 - 月供贷款（如有）
   - **年新增投资能力** = 月可投资额 × 12
   - 目标达成路径 = 存量资产配置优化 + 未来现金流的持续投入
   - 如果月可投资额为正，应在 actions 和 fullAnalysis 中建议定投方向和金额

4. **保障优先**：如果家庭缺少核心保险保障（寿险、医疗险、重疾险），必须：
   - 在 risks 中明确提示"保障缺口风险"
   - 在 fullAnalysis 中建议优先配置保险再增加投资
   - 全部缺失时，将保险配置列为最高优先级 action

5. **分散投资**：避免单一资产类别或地区过度集中（单一地区占比不宜超过70%）
6. **长期视角**：建议基于长期财务目标，避免短期投机
7. **保守稳健**：在不确定时倾向于更保守的建议

## 资产分类体系（两级结构）

### 一级分类（大类资产）
| 代码 | 名称 | 说明 |
|------|------|------|
| EQUITY | 权益类 | 股票、股票型基金、ETF等 |
| FIXED_INCOME | 固定收益类 | 债券、定期存款等 |
| CASH | 现金等价物 | 活期存款、货币基金等 |
| REAL_ESTATE | 不动产类 | 房产、REITs等 |
| ALTERNATIVE | 另类投资 | 黄金、大宗商品等 |

### 二级分类（细分资产）
| 一级分类 | 二级分类 | 说明 |
|----------|----------|------|
| 权益类 | 中国证券/香港证券/美国证券/日本证券 | 按地区细分 |
| 固定收益 | 债券/定期存款 | - |
| 现金等价物 | 活期存款/货币基金/券商现金 | - |
| 另类投资 | 黄金/大宗商品/实物资产 | - |

## 用户提示词特殊章节说明

### 关于"🎯 分析重点"
如果用户提示词包含此章节，你必须在回答中**优先且详细地**回应这些问题。

### 关于"关键指标速览"
此章节是系统根据用户数据自动生成的预判结果，包含：
- ⚠️ 警告：需要你在建议中重点回应的问题
- 💡 提示：值得关注但非紧急的优化点
- ✅ 正常：无需特别关注

你应该：
1. 参考这些预判，但需自行验证其合理性
2. 对所有"⚠️"标记的问题，必须在 fullAnalysis 中给出具体建议
3. 可以补充系统未检测到的其他问题

## 输出格式要求

返回 JSON 格式，结构如下：

\`\`\`json
{
  "summary": "总体评估摘要（100字以内）",
  "confidence": 0.85,
  "targets": [
    {
      "categoryCode": "EQUITY",
      "categoryName": "权益类投资",
      "currentPercent": 40.7,
      "suggestedPercent": 50.0,
      "reason": "调整原因"
    }
  ],
  "actions": [
    {
      "priority": 1,
      "category": "EQUITY",
      "categoryName": "权益类投资",
      "action": "BUY",
      "amount": 150000,
      "reason": "具体到二级资产的操作原因",
      "subCategory": "美国证券",
      "suggestedProducts": ["纳斯达克100ETF"]
    }
  ],
  "rebalanceStrategy": {
    "periodType": "WEEKLY|BIWEEKLY|MONTHLY",
    "totalPeriods": 6,
    "firstPeriodRatio": 0.3,
    "reasoning": "基于偏离程度和资金规模的策略说明",
    "urgentCategories": ["EQUITY"]
  },
  "risks": ["具体风险提示，引用用户数据"],
  "nextReviewDate": "YYYY-MM-DD",
  "fullAnalysis": "Markdown格式的详细报告"
}
\`\`\`

### rebalanceStrategy 字段说明

再平衡策略用于指导系统自动生成分期调仓计划。你需要综合考虑以下因素：

1. **periodType 选择依据**：
   - WEEKLY（每周）：偏离度 >15% 或市场波动较大，需要快速调仓
   - BIWEEKLY（每两周）：偏离度 8-15%，中等调整节奏
   - MONTHLY（每月）：偏离度 <8%，慢节奏温和调整

2. **totalPeriods（期数）选择依据**：
   - 调仓金额 >50万 或涉及多个资产类别：建议 4-6 期
   - 调仓金额 10-50万：建议 3-4 期
   - 调仓金额 <10万：建议 2-3 期

3. **firstPeriodRatio（首期比例）选择依据**：
   - 有紧急需求（如应急资金不足）：首期 0.3-0.5
   - 常规调仓：首期 0.15-0.25
   - 市场不确定性高：首期 0.1-0.15（谨慎入场）

4. **urgentCategories**：需要优先调整的资产类别代码列表（偏离最大或风险最高的）

### fullAnalysis 结构模板

\`\`\`markdown
## 详细分析报告

### 一、整体评估
（优势和不足）

### 二、一级资产配置建议
| 资产类别 | 当前 | 建议 | 调整 | 优先级 |
|----------|------|------|------|--------|

### 三、二级资产细化建议
（针对每个一级资产的内部配置优化）

### 四、具体操作步骤
（可执行的操作，具体到产品）

### 五、再平衡计划
- 建议调仓节奏（每周/每两周/每月）及原因
- 分期策略说明（为什么选择这个期数和首期比例）
- 优先调整事项

### 六、风险提示
（引用用户数据）

### 七、复盘建议
\`\`\`

## 关键约束

1. \`actions.amount\` 必须是具体金额（人民币），基于总资产和配置差异计算
2. \`actions.reason\` 必须具体到二级资产
3. 风险提示必须引用用户的实际数据
4. 所有建议应可执行，可包含具体产品示例
5. \`rebalanceStrategy\` 必须根据实际偏离度和资金规模给出合理的周期建议，不要机械套用规则
6. 再平衡的总调仓金额应取单边（增配或减配中较大的一方），因为卖出的资金用于买入

## 最终输出要求

你必须且只能输出一个合法的 JSON 对象，不要在 JSON 前后添加任何文字说明、Markdown 标记或代码块标记。直接以 { 开头，以 } 结尾。`;

/**
 * 分析重点配置接口
 * ⚠️ 2026-02-01新增：让用户可以指定分析的关注点
 */
export interface AnalysisFocusConfig {
  /** 用户关心的具体问题（可选） */
  questions?: string[];
  /** 是否关注负债优化 */
  focusDebt?: boolean;
  /** 是否关注现金流动性 */
  focusLiquidity?: boolean;
  /** 是否关注地区分散 */
  focusRegionDiversity?: boolean;
  /** 是否关注二级资产细分 */
  focusSubCategories?: boolean;
}

/**
 * 动态生成用户提示词
 * ⚠️ 2026-02-01优化：增加分析重点配置和财务目标自动推断
 */
export function generateUserPrompt(
  familyProfile: FamilyProfileForPrompt | null,
  portfolioData: PortfolioDataForPrompt,
  userNotes?: string,
  analysisFocus?: AnalysisFocusConfig
): string {
  // ✨ 防御性检查：确保关键数据存在
  if (!portfolioData) {
    logger.error('portfolioData is undefined');
    return '# 错误：资产数据缺失\n\n无法生成建议，请刷新页面后重试。';
  }
  
  // 确保 totalAssets 是数字
  const totalAssets = typeof portfolioData.totalAssets === 'number' ? portfolioData.totalAssets : 0;
  const netWorth = typeof portfolioData.netWorth === 'number' ? portfolioData.netWorth : totalAssets;
  const totalLiabilities = typeof portfolioData.totalLiabilities === 'number' ? portfolioData.totalLiabilities : 0;
  
  // 替换原始数据为安全值
  const safePortfolioData = {
    ...portfolioData,
    totalAssets,
    netWorth,
    totalLiabilities,
    currentAllocation: portfolioData.currentAllocation || [],
    regionAllocation: portfolioData.regionAllocation || [],
  };
  
  let prompt = `# 资产配置建议请求\n\n`;
  
  // ==================== 0. 分析重点（如果有） ====================
  if (analysisFocus && (analysisFocus.questions?.length || analysisFocus.focusDebt || analysisFocus.focusLiquidity || analysisFocus.focusRegionDiversity || analysisFocus.focusSubCategories)) {
    prompt += `## 🎯 分析重点\n\n`;
    prompt += `请在分析中**重点关注**以下问题：\n\n`;
    
    if (analysisFocus.questions?.length) {
      analysisFocus.questions.forEach((q, i) => {
        prompt += `${i + 1}. ${q}\n`;
      });
    }
    
    const focuses: string[] = [];
    if (analysisFocus.focusDebt) focuses.push('负债优化策略（是否应优先还款）');
    if (analysisFocus.focusLiquidity) focuses.push('流动性管理（现金类资产是否过多/过少）');
    if (analysisFocus.focusRegionDiversity) focuses.push('地区分散（权益类资产的地区配置）');
    if (analysisFocus.focusSubCategories) focuses.push('二级资产优化（各大类内部的细分配置）');
    
    if (focuses.length) {
      prompt += `\n**额外关注点**：${focuses.join('、')}\n`;
    }
    prompt += `\n`;
  }
  
  // ==================== 家庭财务概况 ====================
  prompt += `## 一、家庭财务概况\n\n`;
  
  if (familyProfile) {
    // 基本信息
    prompt += `### 1. 家庭基本信息\n`;
    prompt += `| 项目 | 内容 |\n`;
    prompt += `|------|------|\n`;
    prompt += `| 家庭成员数 | ${familyProfile.householdMembers}人 |\n`;
    prompt += `| 主要收入者年龄 | ${familyProfile.primaryEarnerAge || '未填写'}岁 |\n`;
    prompt += `| 子女数量 | ${familyProfile.childrenCount || 0}人 |\n`;
    prompt += `| 赡养老人数 | ${familyProfile.elderlyCount || 0}人 |\n`;
    if (familyProfile.retirementAge) {
      prompt += `| 计划退休年龄 | ${familyProfile.retirementAge}岁 |\n`;
      const yearsToRetirement = familyProfile.retirementAge - (familyProfile.primaryEarnerAge || 35);
      prompt += `| 距退休年限 | 约${yearsToRetirement}年 |\n`;
    }
    prompt += `\n`;
    
    // 收入与支出
    prompt += `### 2. 收入与支出\n`;
    prompt += `| 项目 | 金额/状态 |\n`;
    prompt += `|------|------|\n`;
    if (familyProfile.monthlyIncome) {
      prompt += `| 月收入 | ¥${familyProfile.monthlyIncome.toLocaleString()} |\n`;
      prompt += `| 年收入估算 | ¥${(familyProfile.monthlyIncome * 12).toLocaleString()} |\n`;
    }
    if (familyProfile.monthlyExpenses) {
      prompt += `| 月支出 | ¥${familyProfile.monthlyExpenses.toLocaleString()} |\n`;
      if (familyProfile.monthlyIncome) {
        const savingsRate = ((familyProfile.monthlyIncome - familyProfile.monthlyExpenses) / familyProfile.monthlyIncome * 100).toFixed(1);
        prompt += `| 储蓄率 | ${savingsRate}% |\n`;
      }
    }
    prompt += `| 收入稳定性 | ${getIncomeStabilityText(familyProfile.incomeStability)} |\n`;
    prompt += `| 应急资金目标 | ${familyProfile.emergencyFundMonths}个月支出 |\n`;
    prompt += `\n`;
    
    // 风险偏好
    prompt += `### 3. 投资偏好\n`;
    prompt += `| 项目 | 内容 |\n`;
    prompt += `|------|------|\n`;
    prompt += `| 风险承受能力 | ${getRiskToleranceText(familyProfile.riskTolerance)} |\n`;
    prompt += `| 投资期限 | ${getInvestmentHorizonText(familyProfile.investmentHorizon)} |\n`;
    prompt += `\n`;
    
    // 负债情况 - 优先使用实际负债数据（portfolioData.liabilityData）
    // 如果没有实际负债数据，则回退到家庭概况中的静态字段
    prompt += `### 4. 负债情况\n`;
    if (portfolioData.liabilityData && portfolioData.liabilityData.liabilityCount > 0) {
      // ✨ 使用实际负债数据（与负债管理模块一致）
      prompt += `| 指标 | 数值 |\n`;
      prompt += `|------|------|\n`;
      prompt += `| 总负债余额 | ¥${portfolioData.liabilityData.totalLiabilities.toLocaleString()} |\n`;
      prompt += `| 负债笔数 | ${portfolioData.liabilityData.liabilityCount}笔 |\n`;
      prompt += `| 总月供 | ¥${portfolioData.liabilityData.totalMonthlyPayment.toLocaleString()} |\n`;
      if (portfolioData.liabilityData.averageInterestRate > 0) {
        prompt += `| 平均利率 | ${portfolioData.liabilityData.averageInterestRate.toFixed(2)}% |\n`;
      }
      // 计算负债率
      if (safePortfolioData.totalAssets > 0) {
        const liabilityRatio = (portfolioData.liabilityData.totalLiabilities / safePortfolioData.totalAssets) * 100;
        prompt += `| 负债率 | ${liabilityRatio.toFixed(1)}% |\n`;
      }
      // 计算DTI（如果有月收入数据）
      if (familyProfile.monthlyIncome && familyProfile.monthlyIncome > 0) {
        const dti = (portfolioData.liabilityData.totalMonthlyPayment / familyProfile.monthlyIncome) * 100;
        prompt += `| 负债收入比(DTI) | ${dti.toFixed(1)}% |\n`;
      }
      prompt += `\n`;
      
      // 负债明细
      if (portfolioData.liabilityData.byType && portfolioData.liabilityData.byType.length > 0) {
        prompt += `**负债明细：**\n`;
        prompt += `| 负债类型 | 余额(¥) | 笔数 |\n`;
        prompt += `|----------|---------|------|\n`;
        for (const item of portfolioData.liabilityData.byType) {
          prompt += `| ${item.typeName} | ${item.totalBalance.toLocaleString()} | ${item.count}笔 |\n`;
        }
        prompt += `\n`;
      }
    } else {
      // 回退到家庭概况中的静态字段
      const hasAnyLoan = familyProfile.hasHomeLoan || familyProfile.hasCarLoan || familyProfile.hasOtherLoans;
      if (hasAnyLoan) {
        prompt += `| 负债类型 | 状态 | 备注 |\n`;
        prompt += `|----------|------|------|\n`;
        if (familyProfile.hasHomeLoan) {
          prompt += `| 房贷 | ✅ 有 | ${familyProfile.homeLoanMonthlyPayment ? `月供¥${familyProfile.homeLoanMonthlyPayment.toLocaleString()}` : ''} |\n`;
        }
        if (familyProfile.hasCarLoan) {
          prompt += `| 车贷 | ✅ 有 | |\n`;
        }
        if (familyProfile.hasOtherLoans) {
          prompt += `| 其他贷款 | ✅ 有 | |\n`;
        }
      } else {
        prompt += `- 无负债 ✅\n`;
      }
      prompt += `\n`;
    }
    
    // 保险保障
    prompt += `### 5. 保险保障\n`;
    prompt += `| 保险类型 | 状态 |\n`;
    prompt += `|----------|------|\n`;
    prompt += `| 寿险 | ${familyProfile.hasLifeInsurance ? '✅ 已购买' : '❌ 未购买'} |\n`;
    prompt += `| 医疗险 | ${familyProfile.hasHealthInsurance ? '✅ 已购买' : '❌ 未购买'} |\n`;
    prompt += `| 重疾险 | ${familyProfile.hasCriticalIllnessInsurance ? '✅ 已购买' : '❌ 未购买'} |\n`;
    prompt += `\n`;
    
    // ✨ 财务目标（2026-02-02新增）
    const financialGoals = familyProfile.financialGoals;
    if (financialGoals && (financialGoals.primaryGoal || financialGoals.shortTermGoals?.length || financialGoals.mediumTermGoals?.length || financialGoals.longTermGoals?.length || financialGoals.targetNetWorth)) {
      prompt += `### 6. 财务目标 🎯\n\n`;
      
      // 主要目标
      if (financialGoals.primaryGoal) {
        const primaryGoalText = getPrimaryGoalText(financialGoals.primaryGoal);
        prompt += `**主要财务目标**：${primaryGoalText}\n\n`;
      }
      
      // 目标净资产
      if (financialGoals.targetNetWorth) {
        prompt += `**目标净资产**：¥${financialGoals.targetNetWorth.toLocaleString()}`;
        if (financialGoals.targetDate) {
          prompt += `（目标时间：${financialGoals.targetDate}）`;
        }
        // 计算目标达成进度
        if (netWorth > 0) {
          const progress = (netWorth / financialGoals.targetNetWorth) * 100;
          prompt += ` - 当前进度：${progress.toFixed(1)}%`;
        }
        prompt += `\n\n`;
      }
      
      // 短期目标
      if (financialGoals.shortTermGoals && financialGoals.shortTermGoals.length > 0) {
        prompt += `**短期目标（1-3年）**：${financialGoals.shortTermGoals.join('、')}\n`;
      }
      
      // 中期目标
      if (financialGoals.mediumTermGoals && financialGoals.mediumTermGoals.length > 0) {
        prompt += `**中期目标（3-10年）**：${financialGoals.mediumTermGoals.join('、')}\n`;
      }
      
      // 长期目标
      if (financialGoals.longTermGoals && financialGoals.longTermGoals.length > 0) {
        prompt += `**长期目标（10年以上）**：${financialGoals.longTermGoals.join('、')}\n`;
      }
      
      // ✨ 详细财务目标（包含具体金额和目标年份）
      if (financialGoals.goals && Object.keys(financialGoals.goals).length > 0) {
        prompt += `\n**详细财务目标规划**：\n`;
        prompt += `| 目标类型 | 目标金额(¥) | 目标年份 | 状态 |\n`;
        prompt += `|----------|-------------|----------|------|\n`;
        
        const goalNameMap: Record<string, string> = {
          'EMERGENCY_FUND': '🛡️ 应急储备金',
          'RETIREMENT': '🏖️ 退休养老金',
          'CHILD_EDUCATION': '🎓 子女教育金',
          'ELDERLY_CARE': '👴 父母养老储备',
          'TRAVEL': '✈️ 家庭旅游',
          'HOME_UPGRADE': '🏠 换房升级',
          'PASSIVE_INCOME': '💰 被动收入/财务自由',
        };
        
        for (const [goalType, goalConfig] of Object.entries(financialGoals.goals)) {
          if (goalConfig && goalConfig.enabled) {
            const goalName = goalNameMap[goalType] || goalType;
            const amount = goalConfig.customTargetAmount ? `¥${goalConfig.customTargetAmount.toLocaleString()}` : '待定';
            const year = goalConfig.customTargetYear || '待定';
            prompt += `| ${goalName} | ${amount} | ${year} | ✅ 启用 |\n`;
          }
        }
        prompt += `\n`;
      }
      
      // 补充说明
      if (financialGoals.notes && financialGoals.notes.trim()) {
        prompt += `**补充说明**：${financialGoals.notes}\n`;
      }
      
      prompt += `\n`;
    }
    
  } else {
    prompt += `⚠️ 用户尚未填写家庭财务概况，请基于以下默认假设进行分析：\n`;
    prompt += `- 家庭成员：3人（夫妻+1个孩子）\n`;
    prompt += `- 主要收入者年龄：35岁\n`;
    prompt += `- 风险承受能力：中等（MODERATE）\n`;
    prompt += `- 投资期限：中长期（5-10年）\n\n`;
  }
  
  // ==================== 当前资产配置 ====================
  prompt += `## 二、当前资产配置\n\n`;
  
  prompt += `### 1. 资产总览\n`;
  prompt += `| 指标 | 金额(¥) |\n`;
  prompt += `|------|----------|\n`;
  prompt += `| 总资产 | ${safePortfolioData.totalAssets.toLocaleString()} |\n`;
  if (safePortfolioData.totalLiabilities > 0) {
    prompt += `| 总负债 | ${safePortfolioData.totalLiabilities.toLocaleString()} |\n`;
  }
  if (safePortfolioData.netWorth !== undefined) {
    prompt += `| 净资产 | ${safePortfolioData.netWorth.toLocaleString()} |\n`;
    // 计算负债率
    if (safePortfolioData.totalAssets > 0 && safePortfolioData.totalLiabilities) {
      const debtRatio = (safePortfolioData.totalLiabilities / safePortfolioData.totalAssets) * 100;
      prompt += `| 资产负债率 | ${debtRatio.toFixed(1)}% |\n`;
    }
  }
  prompt += `\n`;
  
  prompt += `### 2. 按资产类型分布（一级分类）\n`;
  prompt += `| 资产类型 | 金额(¥) | 占比 |\n`;
  prompt += `|----------|---------|------|\n`;
  for (const asset of safePortfolioData.currentAllocation) {
    const value = typeof asset.value === 'number' ? asset.value : 0;
    const percentage = typeof asset.percentage === 'number' ? asset.percentage : 0;
    prompt += `| ${asset.typeName || '未知'} | ${value.toLocaleString()} | ${percentage.toFixed(1)}% |\n`;
  }
  prompt += `\n`;
  
  // ✨ 新增：各资产分组的二级分类细分
  if (portfolioData.groupsSubCategories || portfolioData.equityByRegion) {
    prompt += `### 3. 资产二级分类明细\n\n`;
    
    // ⚠️ 权益类特殊处理：按地区细分（而非子分类）
    if (portfolioData.equityByRegion && portfolioData.equityByRegion.byRegion.length > 0) {
      prompt += `**权益类**（合计 ¥${portfolioData.equityByRegion.total.toLocaleString()}）\n`;
      prompt += `| 地区/市场 | 金额(¥) | 占比 |\n`;
      prompt += `|-----------|---------|------|\n`;
      for (const region of portfolioData.equityByRegion.byRegion) {
        prompt += `| ${region.regionName} | ${region.value.toLocaleString()} | ${region.percentage.toFixed(1)}% |\n`;
      }
      prompt += `\n`;
    }
    
    // 其他资产分组：按子分类细分
    if (portfolioData.groupsSubCategories) {
      // 按照资产分组顺序遍历（不包含EQUITY，因为已经单独处理）
      const groupOrder = ['FIXED_INCOME', 'CASH', 'REAL_ESTATE', 'ALTERNATIVE', 'OTHER'];
      const groupNameMap: Record<string, string> = {
        'FIXED_INCOME': '固定收益',
        'CASH': '现金等价物',
        'REAL_ESTATE': '不动产',
        'ALTERNATIVE': '另类投资',
        'OTHER': '其他',
      };
      
      for (const groupCode of groupOrder) {
        const groupData = portfolioData.groupsSubCategories[groupCode];
        if (groupData && groupData.bySubCategory && groupData.bySubCategory.length > 0) {
          prompt += `**${groupNameMap[groupCode] || groupData.groupName}**（合计 ¥${groupData.total.toLocaleString()}）\n`;
          prompt += `| 子分类 | 金额(¥) | 占比 |\n`;
          prompt += `|--------|---------|------|\n`;
          for (const sub of groupData.bySubCategory) {
            prompt += `| ${sub.categoryName} | ${sub.value.toLocaleString()} | ${sub.percentage.toFixed(1)}% |\n`;
          }
          prompt += `\n`;
        }
      }
    }
  }
  
  // ⚠️ 2026-02-01移除：按地区分布部分已删除，因为权益类二级分类已包含地区分布信息
  
  // ==================== 用户补充说明 ====================
  if (userNotes) {
    prompt += `## 三、用户补充说明\n\n`;
    prompt += `${userNotes}\n\n`;
  }
  
  // ==================== 关键指标快速解读（帮助AI快速定位问题） ====================
  let sectionNum = userNotes ? 4 : 3;
  prompt += `## ${sectionNum}、关键指标速览\n\n`;
  
  // 自动计算一些关键指标，帮助AI快速理解
  const keyInsights: string[] = [];
  
  // 应急资金评估
  if (familyProfile?.monthlyExpenses && portfolioData.groupsSubCategories?.['CASH']) {
    const cashTotal = portfolioData.groupsSubCategories['CASH'].total;
    const emergencyMonths = cashTotal / familyProfile.monthlyExpenses;
    const targetMonths = familyProfile.emergencyFundMonths || 6;
    if (emergencyMonths < targetMonths) {
      keyInsights.push(`⚠️ 应急资金不足：当前现金可覆盖 ${emergencyMonths.toFixed(1)} 个月支出，目标是 ${targetMonths} 个月`);
    } else if (emergencyMonths > targetMonths * 2) {
      keyInsights.push(`💡 现金可能过多：可覆盖 ${emergencyMonths.toFixed(1)} 个月支出，远超 ${targetMonths} 个月目标，资金效率偏低`);
    } else {
      keyInsights.push(`✅ 应急资金充足：可覆盖 ${emergencyMonths.toFixed(1)} 个月支出，达到目标`);
    }
  }
  
  // 权益类地区集中度
  if (portfolioData.equityByRegion && portfolioData.equityByRegion.byRegion.length > 0) {
    const topRegion = portfolioData.equityByRegion.byRegion[0];
    if (topRegion.percentage > 70) {
      keyInsights.push(`⚠️ 权益类地区集中：${topRegion.regionName}占比 ${topRegion.percentage.toFixed(1)}%，单一市场风险较高`);
    }
  }
  
  // 负债健康度
  if (portfolioData.liabilityData && familyProfile?.monthlyIncome) {
    const dti = (portfolioData.liabilityData.totalMonthlyPayment / familyProfile.monthlyIncome) * 100;
    if (dti > 50) {
      keyInsights.push(`🔴 负债压力大：DTI（负债收入比）${dti.toFixed(1)}%，超过50%警戒线`);
    } else if (dti > 35) {
      keyInsights.push(`🟡 负债偏高：DTI ${dti.toFixed(1)}%，接近35%建议线`);
    } else {
      keyInsights.push(`✅ 负债健康：DTI ${dti.toFixed(1)}%，在健康范围内`);
    }
    
    // 高息负债检查
    if (portfolioData.liabilityData.averageInterestRate > 5) {
      keyInsights.push(`💡 存在较高利率负债（平均 ${portfolioData.liabilityData.averageInterestRate.toFixed(2)}%），可考虑优先偿还`);
    }
  }
  
  // 配置偏离度（使用交叉约束表）
  const equityAlloc = portfolioData.currentAllocation.find(a => a.type === 'EQUITY');
  if (equityAlloc && familyProfile?.riskTolerance) {
    // 交叉约束表：风险偏好 × 投资期限
    const crossConstraints: Record<string, Record<string, number>> = {
      'CONSERVATIVE': { 'SHORT': 15, 'MEDIUM': 30, 'LONG': 40 },
      'MODERATE':     { 'SHORT': 25, 'MEDIUM': 50, 'LONG': 60 },
      'AGGRESSIVE':   { 'SHORT': 40, 'MEDIUM': 65, 'LONG': 75 },
    };
    const horizon = familyProfile.investmentHorizon || 'MEDIUM';
    const target = crossConstraints[familyProfile.riskTolerance]?.[horizon] || 50;
    const diff = equityAlloc.percentage - target;
    if (Math.abs(diff) > 10) {
      keyInsights.push(`⚠️ 权益配置偏离：当前 ${equityAlloc.percentage.toFixed(1)}%，${familyProfile.riskTolerance}+${horizon} 交叉约束建议上限 ${target}%，偏差 ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`);
    }
  }

  // 月可投资额（现金流分析）
  if (familyProfile?.monthlyIncome && familyProfile?.monthlyExpenses) {
    const monthlyLoanPayment = portfolioData.liabilityData?.totalMonthlyPayment || 0;
    const monthlyInvestable = familyProfile.monthlyIncome - familyProfile.monthlyExpenses - monthlyLoanPayment;
    const annualInvestable = monthlyInvestable * 12;
    if (monthlyInvestable > 0) {
      keyInsights.push(`💰 月可投资额：¥${monthlyInvestable.toLocaleString()}（年 ¥${annualInvestable.toLocaleString()}），建议规划定投方向`);
    } else {
      keyInsights.push(`⚠️ 月现金流为负：收入 ¥${familyProfile.monthlyIncome.toLocaleString()} - 支出 ¥${familyProfile.monthlyExpenses.toLocaleString()} - 月供 ¥${monthlyLoanPayment.toLocaleString()} = ¥${monthlyInvestable.toLocaleString()}，无余力新增投资`);
    }
  }

  // 保险保障缺口
  if (familyProfile) {
    const missingInsurance: string[] = [];
    if (!familyProfile.hasLifeInsurance) missingInsurance.push('寿险');
    if (!familyProfile.hasHealthInsurance) missingInsurance.push('医疗险');
    if (!familyProfile.hasCriticalIllnessInsurance) missingInsurance.push('重疾险');
    if (missingInsurance.length === 3) {
      keyInsights.push(`🔴 保障严重缺失：未配置任何保险（${missingInsurance.join('、')}），建议优先配置保险再增加投资`);
    } else if (missingInsurance.length > 0) {
      keyInsights.push(`⚠️ 保障缺口：缺少${missingInsurance.join('、')}，建议补齐核心保障`);
    } else {
      keyInsights.push(`✅ 核心保险已配齐（寿险、医疗险、重疾险）`);
    }
  }
  
  if (keyInsights.length > 0) {
    keyInsights.forEach(insight => {
      prompt += `- ${insight}\n`;
    });
  } else {
    prompt += `- 暂无自动检测到的突出问题\n`;
  }
  prompt += `\n`;
  
  // ==================== 分析要求（简化版，避免与系统提示词重复） ====================
  sectionNum++;
  prompt += `## ${sectionNum}、请求\n\n`;
  prompt += `请根据上述家庭财务数据和关键指标速览，按系统提示词中的格式返回资产配置建议。\n\n`;
  prompt += `**特别注意**：\n`;
  prompt += `- 回应所有"⚠️"标记的问题\n`;
  prompt += `- 总资产 ¥${safePortfolioData.totalAssets.toLocaleString()}，请据此计算具体调仓金额`;
  
  return prompt;
}

/**
 * 生成完整的提示词（用于前端显示和编辑）
 * ⚠️ 2026-02-01优化：增加分析重点配置参数
 */
export function generateFullPrompt(
  familyProfile: FamilyProfileForPrompt | null,
  portfolioData: PortfolioDataForPrompt,
  userNotes?: string,
  analysisFocus?: AnalysisFocusConfig
): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: generateUserPrompt(familyProfile, portfolioData, userNotes, analysisFocus),
  };
}

// ==================== 辅助函数 ====================

function getRiskToleranceText(level?: string): string {
  const map: Record<string, string> = {
    'CONSERVATIVE': '保守型 - 追求资产安全，可接受较低收益',
    'MODERATE': '稳健型 - 平衡风险与收益',
    'AGGRESSIVE': '进取型 - 追求高收益，可承受较大波动',
  };
  return map[level || 'MODERATE'] || '未知';
}

function getInvestmentHorizonText(horizon?: string): string {
  const map: Record<string, string> = {
    'SHORT': '短期（1-3年）',
    'MEDIUM': '中期（3-5年）',
    'LONG': '长期（5年以上）',
  };
  return map[horizon || 'MEDIUM'] || '未知';
}

function getIncomeStabilityText(stability?: string): string {
  const map: Record<string, string> = {
    'STABLE': '稳定（固定工资收入）',
    'VARIABLE': '波动（有绩效/奖金成分）',
    'UNSTABLE': '不稳定（自由职业/创业）',
  };
  return map[stability || 'STABLE'] || '未知';
}

function getPrimaryGoalText(goal?: string): string {
  const map: Record<string, string> = {
    'RETIREMENT': '退休养老 - 积累足够的养老金，保障退休生活品质',
    'EDUCATION': '子女教育 - 为子女教育储备资金',
    'HOUSE': '购房置业 - 购买或升级住房',
    'WEALTH_GROWTH': '财富增值 - 追求资产的长期增值',
    'PASSIVE_INCOME': '被动收入 - 建立稳定的投资收益现金流',
    'FINANCIAL_FREEDOM': '财务自由 - 达到不依赖工作收入的状态',
    'PRESERVE_CAPITAL': '资产保值 - 抵御通胀，保持购买力',
    'OTHER': '其他目标',
  };
  return map[goal || ''] || goal || '未设定';
}

// ==================== DeepSeek API 调用 ====================

// ✨ 新增：包含原始响应元数据的返回类型
export interface AIAdviceResultWithMeta extends AIAdviceResult {
  rawResponse?: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    reasoningTokens?: number;
    responseTime: number;
    rawJson: string;
    reasoningContent?: string;  // 思维链内容（reasoner 模式）
  };
}

export class DeepSeekService {
  
  /**
   * 从文本中提取 JSON（容错解析）
   * reasoner 模式不支持 response_format: json_object，
   * 所以需要从自由文本中提取 JSON 块
   */
  static extractJSON(text: string): string | null {
    // 1. 尝试直接解析（整个文本就是 JSON）
    try {
      JSON.parse(text);
      return text;
    } catch {
      // 继续尝试其他方式
    }
    
    // 2. 尝试提取 ```json ... ``` 代码块
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      try {
        JSON.parse(codeBlockMatch[1].trim());
        return codeBlockMatch[1].trim();
      } catch {
        // 继续
      }
    }
    
    // 3. 尝试找到最大的 { ... } 块
    let depth = 0;
    let start = -1;
    let bestStart = -1;
    let bestEnd = -1;
    let bestLen = 0;
    
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (text[i] === '}') {
        depth--;
        if (depth === 0 && start >= 0) {
          const len = i - start + 1;
          if (len > bestLen) {
            bestStart = start;
            bestEnd = i;
            bestLen = len;
          }
        }
      }
    }
    
    if (bestStart >= 0) {
      const candidate = text.substring(bestStart, bestEnd + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // JSON 不完整，尝试修复常见问题
        const fixed = candidate
          .replace(/,\s*}/g, '}')  // 尾逗号
          .replace(/,\s*]/g, ']');  // 数组尾逗号
        try {
          JSON.parse(fixed);
          return fixed;
        } catch {
          // 无法修复
        }
      }
    }
    
    return null;
  }

  /**
   * 调用 DeepSeek API 生成资产配置建议
   * 支持 chat 和 reasoner 两种模式
   * 
   * @param useReasoner - 是否使用思考模式（默认 true）
   */
  static async generateAdvice(
    systemPrompt: string,
    userPrompt: string,
    useReasoner: boolean = true
  ): Promise<AIAdviceResultWithMeta> {
    // 验证 API Key
    if (!validateApiKey()) {
      throw new Error('DeepSeek API Key 未配置，请在环境变量中设置 DEEPSEEK_API_KEY');
    }
    
    const model = useReasoner ? DEEPSEEK_CONFIG.reasonerModel : DEEPSEEK_CONFIG.chatModel;
    logger.debug('开始调用 DeepSeek API', { model, useReasoner });
    
    const messages: DeepSeekMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    
    // reasoner 模式不支持 response_format，通过 prompt 引导 JSON 输出
    // chat 模式可以强制 JSON 输出
    const requestBody: Record<string, any> = {
      model,
      messages,
      max_tokens: DEEPSEEK_CONFIG.maxTokens,
    };
    
    if (!useReasoner) {
      // chat 模式：强制 JSON 输出 + temperature
      requestBody.temperature = DEEPSEEK_CONFIG.temperature;
      requestBody.response_format = { type: 'json_object' };
    }
    // reasoner 模式不设置 temperature 和 response_format（不支持）
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${DEEPSEEK_CONFIG.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      const responseTime = Date.now() - startTime;
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error('API 错误', { status: response.status, error: errorText });
        throw new Error(`DeepSeek API 错误: ${response.status} - ${errorText}`);
      }
      
      const data: DeepSeekResponse = await response.json();
      logger.debug('API 响应成功', { 
        model: data.model,
        totalTokens: data.usage.total_tokens,
        reasoningTokens: data.usage.reasoning_tokens,
        responseTime,
      });
      
      const content = data.choices[0]?.message?.content;
      const reasoningContent = data.choices[0]?.message?.reasoning_content;
      
      if (!content) {
        throw new Error('DeepSeek 返回空内容');
      }
      
      // 解析 JSON 响应（reasoner 模式需要容错解析）
      let jsonStr: string | null;
      if (useReasoner) {
        jsonStr = DeepSeekService.extractJSON(content);
        if (!jsonStr) {
          logger.error('无法从 reasoner 输出中提取 JSON', { 
            contentLength: content.length,
            contentPreview: content.substring(0, 500),
          });
          throw new Error('无法解析 AI 返回的 JSON 数据，请重试');
        }
      } else {
        jsonStr = content;
      }
      
      const advice = JSON.parse(jsonStr) as AIAdviceResult;
      
      // 验证必要字段
      if (!advice.summary || !advice.targets || !advice.actions) {
        throw new Error('DeepSeek 返回格式不完整');
      }
      
      // 返回包含原始响应元数据的结果
      return {
        ...advice,
        rawResponse: {
          model: data.model,
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
          reasoningTokens: data.usage.reasoning_tokens,
          responseTime,
          rawJson: jsonStr,
          reasoningContent: reasoningContent || undefined,
        },
      };
      
    } catch (error) {
      logger.error('调用失败', error);
      throw error;
    }
  }
  
  /**
   * 检查 API 配置是否有效
   */
  static isConfigured(): boolean {
    return !!DEEPSEEK_CONFIG.apiKey && DEEPSEEK_CONFIG.apiKey.length > 10;
  }
  
  /**
   * 获取当前配置（不含敏感信息）
   */
  static getConfig(): { model: string; chatModel: string; reasonerModel: string; maxTokens: number; temperature: number } {
    return {
      model: DEEPSEEK_CONFIG.model,
      chatModel: DEEPSEEK_CONFIG.chatModel,
      reasonerModel: DEEPSEEK_CONFIG.reasonerModel,
      maxTokens: DEEPSEEK_CONFIG.maxTokens,
      temperature: DEEPSEEK_CONFIG.temperature,
    };
  }
}

export default DeepSeekService;
