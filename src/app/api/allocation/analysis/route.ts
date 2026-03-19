/**
 * 资产配置分析 API
 * 
 * GET: 获取当前配置与目标的对比分析
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AllocationService } from '@/lib/services/allocation-service';
import { createLogger } from '@/lib/logger';

const logger = createLogger('API:AllocationAnalysis');

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    logger.debug('获取配置分析');
    const analysis = await AllocationService.getAnalysis(session.user.id);

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    logger.error('获取配置分析失败', error);
    return NextResponse.json(
      { error: '获取配置分析失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
