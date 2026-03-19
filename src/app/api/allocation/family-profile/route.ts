/**
 * 家庭财务概况 API
 * 
 * Phase 4 迁移：从 userId 维度改为 familyId 维度
 * 向后兼容：如果用户未加入家庭，通过 userId 桥接查询
 * 
 * GET: 获取家庭财务概况
 * PUT: 更新家庭财务概况
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AllocationService } from '@/lib/services/allocation-service';
import { FamilyService } from '@/lib/services/family-service';
import { createLogger } from '@/lib/logger';

const logger = createLogger('FamilyProfileAPI');

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 优先通过 familyId 查询
    const userFamily = await FamilyService.getUserFamily(session.user.id);
    let profile;
    if (userFamily) {
      profile = await AllocationService.getFamilyProfileByFamilyId(userFamily.family.id);
    } else {
      // 向后兼容：用户未加入家庭时返回 null
      profile = null;
    }

    return NextResponse.json({
      success: true,
      data: profile,
      familyId: userFamily?.family.id || null,
    });
  } catch (error) {
    logger.error('获取家庭概况失败', error);
    return NextResponse.json(
      { error: '获取家庭概况失败', details: error instanceof Error ? error.message : '未知错误' },
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

    // 权限校验：必须是家庭管理员
    const userFamily = await FamilyService.getUserFamily(session.user.id);
    if (!userFamily) {
      return NextResponse.json({ error: '未加入家庭，请先创建或加入家庭' }, { status: 404 });
    }

    await FamilyService.checkPermission(session.user.id, userFamily.family.id, 'MANAGE_PROFILE');

    const body = await request.json();
    logger.debug('更新家庭概况 - 接收到的数据', body);
    
    // 验证必填字段
    const allowedFields = [
      'householdMembers',
      'primaryEarnerAge',
      'childrenCount',
      'elderlyCount',
      'monthlyIncome',
      'incomeStability',
      'monthlyExpenses',
      'emergencyFundMonths',
      'riskTolerance',
      'investmentHorizon',
      'retirementAge',
      'majorGoals',
      'financialGoals',
      'hasHomeLoan',
      'homeLoanMonthlyPayment',
      'hasCarLoan',
      'hasOtherLoans',
      'hasLifeInsurance',
      'hasHealthInsurance',
      'hasCriticalIllnessInsurance',
    ];
    
    // 过滤只允许的字段
    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    const profile = await AllocationService.updateFamilyProfileByFamilyId(
      userFamily.family.id,
      data
    );

    return NextResponse.json({
      success: true,
      message: '家庭概况已更新',
      data: profile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新家庭概况失败';
    logger.error('更新家庭概况失败', error);
    const status = message.includes('仅管理员') ? 403 : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
