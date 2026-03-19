/**
 * AI 配置建议 API
 * 
 * GET: 获取最新的AI建议 / 获取提示词预览 / 查询异步分析状态
 * POST: 请求新的AI建议（异步模式：立即返回，后台处理）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AllocationService } from '@/lib/services/allocation-service';
import { 
  DeepSeekService, 
  generateFullPrompt, 
  SYSTEM_PROMPT,
  type FamilyProfileForPrompt,
  type PortfolioDataForPrompt,
} from '@/lib/services/deepseek-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const scope = searchParams.get('scope'); // 'family' = 家庭级别数据

    // 查询异步分析状态（轮询用）
    if (action === 'status') {
      const adviceId = searchParams.get('adviceId');
      if (!adviceId) {
        return NextResponse.json({ error: '缺少 adviceId' }, { status: 400 });
      }
      
      const status = await AllocationService.getAdviceStatus(adviceId, session.user.id);
      if (!status) {
        return NextResponse.json({ error: '未找到该建议' }, { status: 404 });
      }
      
      // PROCESSING 状态只返回基本信息，不返回 advice 内容
      if (status.status === 'PROCESSING') {
        return NextResponse.json({
          success: true,
          data: {
            id: status.id,
            status: status.status,
            summary: status.summary,
            modelUsed: status.modelUsed,
            createdAt: status.createdAt,
          },
        });
      }
      
      // 完成状态返回完整数据
      return NextResponse.json({
        success: true,
        data: {
          id: status.id,
          status: status.status,
          summary: status.summary,
          confidence: status.confidence,
          modelUsed: status.modelUsed,
          errorMessage: status.errorMessage,
          createdAt: status.createdAt,
          ...(status.advice as object || {}),
          adviceId: status.id,
        },
      });
    }

    // 获取提示词预览
    if (action === 'preview-prompt') {
      let inputData;
      
      if (scope === 'family' && session.user.familyId) {
        // 家庭级别：聚合所有成员数据
        inputData = await AllocationService.prepareAIAdviceInputForFamily(session.user.familyId, session.user.id);
      } else {
        // 个人级别
        inputData = await AllocationService.prepareAIAdviceInput(session.user.id);
      }
      
      // 计算净资产
      const totalLiabilities = inputData.liabilityOverview?.totalLiabilities || 0;
      const netWorth = inputData.portfolioOverview.totalAssets - totalLiabilities;
      
      const portfolioData: PortfolioDataForPrompt = {
        totalAssets: inputData.portfolioOverview.totalAssets,
        netWorth,
        totalLiabilities,
        currentAllocation: inputData.currentAllocation.map(a => ({
          type: a.code || '',
          typeName: a.name || '',
          value: a.value,
          percentage: a.percentage,
        })),
        regionAllocation: inputData.regionAllocation.map(r => ({
          name: r.name,
          percentage: r.percentage,
        })),
        liabilityData: inputData.liabilityOverview ? {
          totalLiabilities: inputData.liabilityOverview.totalLiabilities,
          totalMonthlyPayment: inputData.liabilityOverview.totalMonthlyPayment,
          liabilityCount: inputData.liabilityOverview.liabilityCount,
          averageInterestRate: inputData.liabilityOverview.averageInterestRate,
          byType: inputData.liabilityOverview.byType || [],
        } : undefined,
        groupsSubCategories: inputData.groupsSubCategories ? Object.fromEntries(
          Object.entries(inputData.groupsSubCategories).map(([key, value]) => [
            key,
            {
              groupCode: value.groupCode,
              groupName: value.groupName,
              total: value.total,
              count: value.count,
              bySubCategory: value.bySubCategory.map(sub => ({
                categoryCode: sub.categoryCode,
                categoryName: sub.categoryName,
                value: sub.value,
                percentage: sub.percentage,
                count: sub.count,
              })),
            },
          ])
        ) : undefined,
        equityByRegion: inputData.equityByRegion ? {
          total: inputData.equityByRegion.total,
          count: inputData.equityByRegion.count,
          byRegion: inputData.equityByRegion.byRegion.map(r => ({
            regionCode: r.regionCode,
            regionName: r.regionName,
            value: r.value,
            percentage: r.percentage,
            count: r.count,
          })),
        } : undefined,
      };

      const { systemPrompt, userPrompt } = generateFullPrompt(
        inputData.familyProfile as FamilyProfileForPrompt | null,
        portfolioData
      );

      return NextResponse.json({
        success: true,
        data: {
          systemPrompt,
          userPrompt,
          aiConfig: DeepSeekService.getConfig(),
        },
      });
    }

    // 默认：获取最新的AI建议
    let advice;
    if (scope === 'family' && session.user.familyId) {
      advice = await AllocationService.getLatestAdviceForFamily(session.user.familyId);
    } else {
      advice = await AllocationService.getLatestAdvice(session.user.id);
    }

    if (!advice) {
      return NextResponse.json({
        success: true,
        data: null,
        message: '暂无AI建议，请点击"请求AI建议"获取',
      });
    }

    return NextResponse.json({
      success: true,
      data: advice,
    });
  } catch (error) {
    console.error('[API] 获取AI建议失败:', error);
    return NextResponse.json(
      { error: '获取AI建议失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      userNotes, 
      customSystemPrompt,
      customUserPrompt,
      useMock = false,
      previewOnly = false,
      cachedData,
      scope,
    } = body;

    // 家庭级AI建议：仅管理员可发起（非预览）
    if (scope === 'family' && !previewOnly) {
      if (!session.user.familyId) {
        return NextResponse.json({ error: '未加入家庭' }, { status: 400 });
      }
      if (session.user.familyRole !== 'ADMIN') {
        return NextResponse.json({ error: '仅家庭管理员可发起AI建议' }, { status: 403 });
      }
    }

    let inputData;
    
    // 如果有缓存数据，直接使用，避免重新获取（包括汇率API调用）
    const isCachedDataValid = cachedData && 
      cachedData.overview && 
      typeof cachedData.overview.totalAssets === 'number';
    
    if (isCachedDataValid) {
      console.log('[API] 使用前端传入的缓存数据，跳过数据获取');
      
      const { overview, allocationData, portfolio, underlyingTypePortfolio } = cachedData;
      
      const familyProfile = await AllocationService.getFamilyProfile(session.user.id);
      
      let currentAllocation: Array<{ code: string; name: string; type: string; typeName: string; value: number; percentage: number }> = [];
      
      if (underlyingTypePortfolio?.byOverviewGroup && underlyingTypePortfolio.byOverviewGroup.length > 0) {
        currentAllocation = underlyingTypePortfolio.byOverviewGroup.map((item: { code: string; name: string; value: number; percentage: number }) => ({
          code: item.code,
          name: item.name,
          type: item.code,
          typeName: item.name,
          value: item.value ?? 0,
          percentage: item.percentage ?? 0,
        }));
      } else if (allocationData?.fullAnalysis && allocationData.fullAnalysis.length > 0) {
        currentAllocation = allocationData.fullAnalysis.map((item: { categoryCode?: string; code?: string; categoryName?: string; name?: string; currentValue?: number; value?: number; currentPercent?: number; percentage?: number }) => ({
          code: item.categoryCode || item.code || '',
          name: item.categoryName || item.name || '',
          type: item.categoryCode || item.code || '',
          typeName: item.categoryName || item.name || '',
          value: item.currentValue ?? item.value ?? 0,
          percentage: item.currentPercent ?? item.percentage ?? 0,
        }));
      } else if (portfolio?.byCategory && portfolio.byCategory.length > 0) {
        currentAllocation = portfolio.byCategory.map((item: { name: string; value: number; percentage: number }) => ({
          code: item.name,
          name: item.name,
          type: item.name,
          typeName: item.name,
          value: item.value ?? 0,
          percentage: item.percentage ?? 0,
        }));
      }
      
      const regionAllocation = portfolio?.byRegion?.map((r: { name: string; value?: number; percentage: number }) => ({
        name: r.name,
        value: r.value ?? 0,
        percentage: r.percentage ?? 0,
      })) || [];
      
      inputData = {
        portfolioOverview: {
          totalAssets: overview.totalAssets ?? 0,
          totalCash: overview.totalCash ?? 0,
          totalInvestmentValue: overview.totalInvestmentValue ?? 0,
          totalCashAssets: overview.totalCashAssets ?? 0,
          totalOtherAssets: overview.totalOtherAssets ?? 0,
        },
        familyProfile,
        currentAllocation,
        regionAllocation,
        liabilityOverview: allocationData?.liabilityInfo ? {
          totalLiabilities: allocationData.liabilityInfo.totalLiabilities ?? 0,
          totalMonthlyPayment: allocationData.liabilityInfo.monthlyPayment ?? 0,
          liabilityCount: allocationData.liabilityInfo.liabilityCount ?? 0,
          averageInterestRate: allocationData.liabilityInfo.averageInterestRate ?? 0,
          byType: allocationData.liabilityInfo.byType?.map((item: { type: string; typeName: string; balance: number; percentage: number }) => ({
            type: item.type,
            typeName: item.typeName,
            totalBalance: item.balance,
            count: 1,
          })) || [],
        } : undefined,
        groupsSubCategories: underlyingTypePortfolio?.groupsSubCategories || undefined,
        equityByRegion: underlyingTypePortfolio?.equityByRegion || undefined,
      };
    } else {
      if (cachedData) {
        console.log('[API] 缓存数据无效，回退到重新获取');
      } else {
        console.log('[API] 没有缓存数据，重新获取数据');
      }
      if (scope === 'family' && session.user.familyId) {
        inputData = await AllocationService.prepareAIAdviceInputForFamily(session.user.familyId, session.user.id);
      } else {
        inputData = await AllocationService.prepareAIAdviceInput(session.user.id);
      }
    }
    
    // 计算净资产
    const totalLiabilities = inputData.liabilityOverview?.totalLiabilities || 0;
    const netWorth = inputData.portfolioOverview.totalAssets - totalLiabilities;
    
    // 构建提示词
    const portfolioData: PortfolioDataForPrompt = {
      totalAssets: inputData.portfolioOverview.totalAssets,
      netWorth,
      totalLiabilities,
      currentAllocation: inputData.currentAllocation.map((a: { code?: string; type?: string; name?: string; typeName?: string; value: number; percentage: number }) => ({
        type: a.code || a.type || '',
        typeName: a.name || a.typeName || '',
        value: a.value,
        percentage: a.percentage,
      })),
      regionAllocation: inputData.regionAllocation.map((r: { name: string; percentage: number }) => ({
        name: r.name,
        percentage: r.percentage,
      })),
      liabilityData: inputData.liabilityOverview ? {
        totalLiabilities: inputData.liabilityOverview.totalLiabilities,
        totalMonthlyPayment: inputData.liabilityOverview.totalMonthlyPayment,
        liabilityCount: inputData.liabilityOverview.liabilityCount,
        averageInterestRate: inputData.liabilityOverview.averageInterestRate,
        byType: inputData.liabilityOverview.byType || [],
      } : undefined,
      groupsSubCategories: inputData.groupsSubCategories ? Object.fromEntries(
        Object.entries(inputData.groupsSubCategories).map(([key, value]: [string, any]) => [
          key,
          {
            groupCode: value.groupCode,
            groupName: value.groupName,
            total: value.total,
            count: value.count,
            bySubCategory: value.bySubCategory.map((sub: any) => ({
              categoryCode: sub.categoryCode,
              categoryName: sub.categoryName,
              value: sub.value,
              percentage: sub.percentage,
              count: sub.count,
            })),
          },
        ])
      ) : undefined,
      equityByRegion: inputData.equityByRegion ? {
        total: inputData.equityByRegion.total,
        count: inputData.equityByRegion.count,
        byRegion: inputData.equityByRegion.byRegion.map((r: any) => ({
          regionCode: r.regionCode,
          regionName: r.regionName,
          value: r.value,
          percentage: r.percentage,
          count: r.count,
        })),
      } : undefined,
    };

    const { systemPrompt: defaultSystemPrompt, userPrompt: defaultUserPrompt } = generateFullPrompt(
      inputData.familyProfile as FamilyProfileForPrompt | null,
      portfolioData,
      userNotes
    );

    // 如果只是预览提示词，直接返回
    if (previewOnly) {
      return NextResponse.json({
        success: true,
        data: {
          systemPrompt: defaultSystemPrompt,
          userPrompt: defaultUserPrompt,
          aiConfig: DeepSeekService.getConfig(),
        },
      });
    }

    // 使用用户自定义的提示词，或使用默认生成的
    const finalSystemPrompt = customSystemPrompt || defaultSystemPrompt;
    const finalUserPrompt = customUserPrompt || defaultUserPrompt;

    // Mock 模式：同步返回
    if (useMock || !DeepSeekService.isConfigured()) {
      console.log('[API] 使用模拟建议');
      const advice = generateMockAdvice(inputData);
      
      const adviceId = await AllocationService.saveAIAdvice(session.user.id, {
        summary: advice.summary,
        confidence: advice.confidence,
        advice: {
          ...advice,
          promptUsed: { systemPrompt: finalSystemPrompt, userPrompt: finalUserPrompt },
        },
        portfolioSnapshot: {
          totalAssets: inputData.portfolioOverview.totalAssets,
          allocation: inputData.currentAllocation,
        },
        modelUsed: 'mock',
        expiresInDays: 30,
        scope: scope === 'family' ? 'family' : 'personal',
      });

      return NextResponse.json({
        success: true,
        data: {
          adviceId,
          ...advice,
          promptUsed: { systemPrompt: finalSystemPrompt, userPrompt: finalUserPrompt },
        },
      });
    }

    // ========== 异步模式：立即返回 adviceId，后台调用 AI ==========
    
    const useReasoner = true;  // 默认使用思考模式
    const modelName = useReasoner ? 'deepseek-reasoner' : 'deepseek-chat';
    
    // 1. 创建 PROCESSING 状态的占位记录
    const adviceId = await AllocationService.createProcessingAdvice(
      session.user.id,
      scope === 'family' ? 'family' : 'personal',
      modelName,
      {
        totalAssets: inputData.portfolioOverview.totalAssets,
        allocation: inputData.currentAllocation,
      },
    );
    
    console.log(`[API] 异步分析已创建: ${adviceId}, model: ${modelName}`);
    
    // 2. Fire-and-forget: 后台调用 DeepSeek
    const userId = session.user.id;
    const adviceScope = scope === 'family' ? 'family' : 'personal';
    
    // 使用 Promise 不阻塞响应
    (async () => {
      try {
        console.log(`[API:async] 开始调用 DeepSeek (${modelName}), adviceId: ${adviceId}`);
        const advice = await DeepSeekService.generateAdvice(finalSystemPrompt, finalUserPrompt, useReasoner);
        
        // 更新记录为完成（含审计数据：prompt + 思维链 + token 用量）
        await AllocationService.updateAdviceResult(adviceId, {
          summary: advice.summary,
          confidence: advice.confidence,
          advice: {
            ...advice,
            promptUsed: {
              systemPrompt: finalSystemPrompt,
              userPrompt: finalUserPrompt,
              reasoningContent: advice.rawResponse?.reasoningContent || null,
              tokenUsage: advice.rawResponse ? {
                promptTokens: advice.rawResponse.promptTokens,
                completionTokens: advice.rawResponse.completionTokens,
                totalTokens: advice.rawResponse.totalTokens,
                reasoningTokens: advice.rawResponse.reasoningTokens,
                responseTime: advice.rawResponse.responseTime,
              } : null,
            },
          },
          status: 'PENDING',  // PENDING = 已完成待用户处理
          modelUsed: advice.rawResponse?.model || modelName,
        });
        
        console.log(`[API:async] 分析完成: ${adviceId}, tokens: ${advice.rawResponse?.totalTokens}, time: ${advice.rawResponse?.responseTime}ms`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[API:async] 分析失败: ${adviceId}`, errorMessage);
        
        // 解析错误类型
        let userFriendlyError: string;
        if (errorMessage.includes('Insufficient Balance')) {
          userFriendlyError = 'DeepSeek API 余额不足，请充值后重试';
        } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
          userFriendlyError = 'DeepSeek API Key 无效';
        } else if (errorMessage.includes('无法解析')) {
          userFriendlyError = 'AI 返回格式异常，请重试';
        } else {
          userFriendlyError = `分析出错: ${errorMessage.substring(0, 200)}`;
        }
        
        // 降级：尝试用 mock 建议 + 错误标记
        try {
          const mockAdvice = generateMockAdvice({
            familyProfile: null,
            currentAllocation: [],
            portfolioOverview: { totalAssets: 0 },
          });
          
          await AllocationService.updateAdviceResult(adviceId, {
            summary: `[分析失败] ${userFriendlyError}`,
            confidence: 0,
            advice: mockAdvice,
            status: 'ERROR',
            modelUsed: modelName,
            errorMessage: userFriendlyError,
          });
        } catch (updateError) {
          console.error(`[API:async] 更新失败记录也出错:`, updateError);
        }
      }
    })();
    
    // 3. 立即返回 adviceId，前端轮询状态
    return NextResponse.json({
      success: true,
      data: {
        adviceId,
        status: 'PROCESSING',
        modelUsed: modelName,
        message: '分析已开始，请稍候查看结果',
      },
    });

  } catch (error) {
    console.error('[API] 生成AI建议失败:', error);
    return NextResponse.json(
      { error: '生成AI建议失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * 生成模拟的AI建议（实际应调用真实AI模型）
 */
function generateMockAdvice(
  inputData: {
    familyProfile?: any;
    currentAllocation: Array<{
      code?: string;
      type?: string;
      name?: string;
      typeName?: string;
      value: number;
      percentage: number;
    }>;
    portfolioOverview: {
      totalAssets: number;
      [key: string]: any;
    };
    [key: string]: any;
  }
) {
  const { familyProfile, currentAllocation, portfolioOverview } = inputData;
  
  // 基于简单规则生成建议
  const targets: Array<{
    categoryCode: string;
    categoryName: string;
    currentPercent: number;
    suggestedPercent: number;
    reason: string;
  }> = [];
  
  const actions: Array<{
    priority: number;
    category: string;
    categoryName: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    amount?: number;
    reason: string;
  }> = [];
  
  const riskTolerance = familyProfile?.riskTolerance || 'MODERATE';
  const age = familyProfile?.primaryEarnerAge || 35;
  
  let suggestedEquity = 50;
  let suggestedCash = 10;
  let suggestedFixed = 25;
  let suggestedRealEstate = 10;
  let suggestedAlternative = 5;
  
  if (age < 30) {
    suggestedEquity = 60;
    suggestedCash = 5;
  } else if (age > 50) {
    suggestedEquity = 30;
    suggestedFixed = 40;
    suggestedCash = 15;
  }
  
  if (riskTolerance === 'CONSERVATIVE') {
    suggestedEquity -= 15;
    suggestedFixed += 10;
    suggestedCash += 5;
  } else if (riskTolerance === 'AGGRESSIVE') {
    suggestedEquity += 10;
    suggestedFixed -= 10;
  }
  
  const categoryMap: Record<string, { suggested: number; name: string }> = {
    'EQUITY': { suggested: suggestedEquity, name: '权益类投资' },
    'CASH': { suggested: suggestedCash, name: '现金及现金等价物' },
    'FIXED_INCOME': { suggested: suggestedFixed, name: '固定收益类' },
    'REAL_ESTATE': { suggested: suggestedRealEstate, name: '不动产类' },
    'ALTERNATIVE': { suggested: suggestedAlternative, name: '另类投资' },
  };
  
  let priority = 1;
  
  for (const asset of currentAllocation) {
    const assetCode = asset.type || asset.code;
    const assetName = asset.typeName || asset.name;
    
    if (!assetCode) continue;
    
    const config = categoryMap[assetCode];
    if (!config) continue;
    
    const diff = asset.percentage - config.suggested;
    
    targets.push({
      categoryCode: assetCode,
      categoryName: assetName || assetCode,
      currentPercent: asset.percentage,
      suggestedPercent: config.suggested,
      reason: diff > 5 
        ? `当前占比偏高，建议适当减仓` 
        : diff < -5 
          ? `当前占比偏低，建议增配`
          : `配置合理，建议维持`,
    });
    
    if (Math.abs(diff) > 5) {
      actions.push({
        priority: priority++,
        category: assetCode,
        categoryName: assetName || assetCode,
        action: diff > 5 ? 'SELL' : 'BUY',
        amount: Math.abs(diff) / 100 * portfolioOverview.totalAssets,
        reason: diff > 5 
          ? `减仓${diff.toFixed(1)}%，降低风险敞口` 
          : `增配${Math.abs(diff).toFixed(1)}%，优化配置`,
      });
    }
  }
  
  for (const [code, config] of Object.entries(categoryMap)) {
    const exists = targets.find(t => t.categoryCode === code);
    if (!exists && config.suggested > 0) {
      targets.push({
        categoryCode: code,
        categoryName: config.name,
        currentPercent: 0,
        suggestedPercent: config.suggested,
        reason: `当前未配置，建议配置${config.suggested}%`,
      });
      
      actions.push({
        priority: priority++,
        category: code,
        categoryName: config.name,
        action: 'BUY',
        amount: config.suggested / 100 * portfolioOverview.totalAssets,
        reason: `增配${config.suggested}%，完善资产配置`,
      });
    }
  }
  
  const cashAsset = currentAllocation.find(a => (a.type || a.code) === 'CASH');
  const monthlyExpenses = familyProfile?.monthlyExpenses || 30000;
  const emergencyMonths = familyProfile?.emergencyFundMonths || 6;
  const requiredEmergency = monthlyExpenses * emergencyMonths;
  
  if (cashAsset && cashAsset.value < requiredEmergency) {
    actions.unshift({
      priority: 1,
      category: 'CASH',
      categoryName: '现金类',
      action: 'BUY',
      amount: requiredEmergency - cashAsset.value,
      reason: `应急资金不足，当前仅覆盖${(cashAsset.value / monthlyExpenses).toFixed(1)}个月支出，建议补足至${emergencyMonths}个月`,
    });
    actions.sort((a, b) => a.priority - b.priority);
  }
  
  const firstAction = actions[0];
  const summary = `基于您的家庭情况（${age}岁，风险偏好${riskTolerance}），建议将权益类资产占比调整至${suggestedEquity}%，固收类${suggestedFixed}%，现金类${suggestedCash}%。${
    firstAction
      ? `当前主要建议：${firstAction.action === 'BUY' ? '增配' : '减仓'}${firstAction.categoryName}。`
      : '当前配置较为合理，建议维持。'
  }`;
  
  const nextReviewDate = new Date();
  nextReviewDate.setMonth(nextReviewDate.getMonth() + 3);
  
  const maxDeviation = Math.max(...targets.map(t => Math.abs(t.currentPercent - t.suggestedPercent)), 0)
  const totalAdjustAmount = actions.reduce((sum, a) => sum + (a.amount || 0), 0) / 2
  const urgentCategories = actions.filter(a => a.priority <= 2).map(a => a.category)
  
  let mockPeriodType: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' = 'MONTHLY'
  let mockTotalPeriods = 3
  let mockFirstPeriodRatio = 0.2
  let mockReasoning = ''
  
  if (maxDeviation > 15) {
    mockPeriodType = 'WEEKLY'
    mockTotalPeriods = totalAdjustAmount > 500000 ? 6 : 4
    mockFirstPeriodRatio = 0.25
    mockReasoning = `最大偏离度${maxDeviation.toFixed(1)}%较高，建议每周调整，${mockTotalPeriods}期完成`
  } else if (maxDeviation > 8) {
    mockPeriodType = 'BIWEEKLY'
    mockTotalPeriods = totalAdjustAmount > 300000 ? 5 : 3
    mockFirstPeriodRatio = 0.2
    mockReasoning = `偏离度${maxDeviation.toFixed(1)}%适中，建议每两周调整，${mockTotalPeriods}期完成`
  } else {
    mockPeriodType = 'MONTHLY'
    mockTotalPeriods = totalAdjustAmount > 200000 ? 3 : 2
    mockFirstPeriodRatio = 0.3
    mockReasoning = `偏离度${maxDeviation.toFixed(1)}%较小，建议每月调整，${mockTotalPeriods}期完成`
  }

  return {
    summary,
    confidence: 0.85,
    targets,
    actions,
    rebalanceStrategy: {
      periodType: mockPeriodType,
      totalPeriods: mockTotalPeriods,
      firstPeriodRatio: mockFirstPeriodRatio,
      reasoning: mockReasoning,
      urgentCategories,
    },
    risks: [
      '全球经济增长放缓可能影响权益类资产表现',
      '利率变动可能影响债券价格',
      '建议定期复盘，根据市场变化调整',
    ],
    nextReviewDate: nextReviewDate.toISOString().split('T')[0],
    fullAnalysis: `
## 详细分析

### 1. 家庭财务状况评估
${familyProfile ? `
- 您的家庭有${familyProfile.householdMembers}位成员，${familyProfile.childrenCount || 0}位子女，${familyProfile.elderlyCount || 0}位赡养老人
- 主要收入者${age}岁，${familyProfile.investmentHorizon === 'LONG' ? '距离退休还有较长时间' : '建议开始考虑退休规划'}
- 风险承受能力为${riskTolerance}，${riskTolerance === 'CONSERVATIVE' ? '建议以稳健配置为主' : riskTolerance === 'AGGRESSIVE' ? '可以适当增加权益类配置' : '建议均衡配置'}
` : '未提供家庭财务信息，使用默认假设进行分析。'}

### 2. 当前配置分析
${currentAllocation.map(a => `- ${a.name}: ${a.percentage.toFixed(1)}%`).join('\n')}

### 3. 建议配置
- 权益类: ${suggestedEquity}%
- 固收类: ${suggestedFixed}%
- 现金类: ${suggestedCash}%
- 不动产: ${suggestedRealEstate}%
- 另类投资: ${suggestedAlternative}%

### 4. 调仓建议
${actions.map((a, i) => `${i + 1}. ${a.action === 'BUY' ? '增配' : a.action === 'SELL' ? '减仓' : '维持'}${a.categoryName}${a.amount ? `，金额约¥${a.amount.toLocaleString()}` : ''}`).join('\n')}

### 5. 风险提示
- 以上建议仅供参考，不构成投资建议
- 建议在做出重大调整前咨询持牌顾问
- 市场有风险，投资需谨慎
    `,
  };
}
