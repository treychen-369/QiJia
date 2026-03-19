/**
 * 建议详情 API
 * 
 * GET /api/allocation/advice-history/[id] - 获取单条AI建议的完整详情
 * 
 * v2.0 更新：返回完整的提示词和原始响应数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET: 获取单条建议的完整详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = params;

    const advice = await prisma.allocationAdvice.findUnique({
      where: { 
        id,
        userId: session.user.id, // 确保只能查看自己的建议
      },
    });

    if (!advice) {
      return NextResponse.json(
        { error: '建议不存在或无权访问' },
        { status: 404 }
      );
    }

    // 解析 advice JSON 字段
    const adviceData = advice.advice as any;

    return NextResponse.json({
      success: true,
      data: {
        id: advice.id,
        summary: advice.summary,
        status: advice.status,
        confidence: Number(advice.confidence),
        createdAt: advice.createdAt.toISOString(),
        expiresAt: advice.expiresAt.toISOString(),
        appliedAt: advice.appliedAt?.toISOString() || null,
        userFeedback: advice.userFeedback,
        
        // 建议内容
        advice: {
          targets: adviceData?.targets || [],
          actions: adviceData?.actions || [],
          risks: adviceData?.risks || [],
          nextReviewDate: adviceData?.nextReviewDate,
          fullAnalysis: adviceData?.fullAnalysis,
        },
        
        // 资产快照
        portfolioSnapshot: advice.portfolioSnapshot,
        
        // ✨ v2.0：完整的提示词（从 adviceData.promptUsed 获取）
        promptUsed: adviceData?.promptUsed || null,
        
        // ✨ v2.0：原始响应数据（如果有）
        rawResponse: adviceData?.rawResponse || null,
        
        // ✨ v2.0：市场和家庭环境上下文
        marketContext: advice.marketContext,
        familyContext: advice.familyContext,
      },
    });
  } catch (error) {
    console.error('[API] 获取建议详情失败:', error);
    return NextResponse.json(
      { error: '获取建议详情失败' },
      { status: 500 }
    );
  }
}
