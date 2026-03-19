/**
 * 资产配置目标 API
 * 
 * GET: 获取用户的配置目标
 * PUT: 批量更新配置目标
 * POST: 重置为默认配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AllocationService } from '@/lib/services/allocation-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const targets = await AllocationService.getAllocationTargets(session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        targets,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] 获取配置目标失败:', error);
    return NextResponse.json(
      { error: '获取配置目标失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { targets, source, adviceId } = body;

    if (!Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json(
        { error: '请提供有效的配置目标列表' },
        { status: 400 }
      );
    }

    // 验证目标百分比总和（仅在非AI建议来源时严格验证）
    const totalPercent = targets.reduce((sum: number, t: { targetPercent?: number }) => sum + (t.targetPercent || 0), 0);
    
    // 如果是AI建议来源，允许不完整的目标（AI可能只返回部分类别的建议）
    if (source !== 'AI_ADVICE') {
      if (Math.abs(totalPercent - 100) > 1) {
        return NextResponse.json(
          { error: `配置目标总和应为100%，当前为${totalPercent.toFixed(1)}%` },
          { status: 400 }
        );
      }
    } else {
      console.log(`[API] AI建议采纳 - adviceId: ${adviceId}, 目标数: ${targets.length}, 总和: ${totalPercent.toFixed(1)}%`);
    }

    // 更新配置目标
    await AllocationService.updateAllocationTargets(session.user.id, targets);
    
    // ✨ 如果是采纳 AI 建议，同时更新建议状态为"已采纳"
    if (source === 'AI_ADVICE' && adviceId) {
      try {
        await AllocationService.updateAdviceFeedback(adviceId, {
          status: 'ACCEPTED',
          userFeedback: '用户采纳了AI建议的配置目标',
        });
        console.log(`[API] AI建议状态已更新为 ACCEPTED - adviceId: ${adviceId}`);
      } catch (feedbackError) {
        // 更新建议状态失败不影响主流程
        console.error('[API] 更新AI建议状态失败:', feedbackError);
      }
    }

    return NextResponse.json({
      success: true,
      message: source === 'AI_ADVICE' ? 'AI建议已采纳，配置目标已更新' : '配置目标已更新',
    });
  } catch (error) {
    console.error('[API] 更新配置目标失败:', error);
    return NextResponse.json(
      { error: '更新配置目标失败', details: error instanceof Error ? error.message : '未知错误' },
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
    const { action } = body;

    if (action === 'reset') {
      await AllocationService.resetToDefaults(session.user.id);
      const defaultTargets = await AllocationService.getDefaultTargets();

      return NextResponse.json({
        success: true,
        message: '已重置为默认配置',
        data: { targets: defaultTargets },
      });
    }

    return NextResponse.json(
      { error: '未知操作' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] 重置配置目标失败:', error);
    return NextResponse.json(
      { error: '重置配置目标失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
