import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { LiabilityService } from '@/lib/services/liability-service';
import { LiabilityType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'overview') {
      // 获取负债概览
      const overview = await LiabilityService.calculateLiabilityOverview(session.user.id);
      return NextResponse.json({
        success: true,
        data: overview,
        calculatedAt: new Date().toISOString()
      });
    } else {
      // 获取所有负债详情
      const liabilities = await LiabilityService.getUserLiabilities(session.user.id);
      return NextResponse.json({
        success: true,
        data: liabilities,
        calculatedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('[API错误] /api/liabilities GET:', error);
    return NextResponse.json(
      { error: '获取负债数据失败' },
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
      name,
      type,
      description,
      principalAmount,
      currentBalance,
      interestRate,
      monthlyPayment,
      currency,
      startDate,
      maturityDate,
      nextPaymentDate,
      metadata
    } = body;

    // 验证必填字段
    if (!name || !type || !principalAmount || !currentBalance) {
      return NextResponse.json(
        { error: '缺少必填字段：name, type, principalAmount, currentBalance' },
        { status: 400 }
      );
    }

    // 验证并转换负债类型
    // 支持两种格式：大写枚举值(MORTGAGE)和小写映射值(mortgage)
    const typeMapping: Record<string, LiabilityType> = {
      'mortgage': LiabilityType.MORTGAGE,
      'credit_card': LiabilityType.CREDIT_CARD,
      'personal_loan': LiabilityType.PERSONAL_LOAN,
      'business_loan': LiabilityType.BUSINESS_LOAN,
      'car_loan': LiabilityType.CAR_LOAN,
      'student_loan': LiabilityType.STUDENT_LOAN,
      'payable': LiabilityType.PAYABLE,
      'other': LiabilityType.OTHER,
      // 大写格式也支持
      'MORTGAGE': LiabilityType.MORTGAGE,
      'CREDIT_CARD': LiabilityType.CREDIT_CARD,
      'PERSONAL_LOAN': LiabilityType.PERSONAL_LOAN,
      'BUSINESS_LOAN': LiabilityType.BUSINESS_LOAN,
      'CAR_LOAN': LiabilityType.CAR_LOAN,
      'STUDENT_LOAN': LiabilityType.STUDENT_LOAN,
      'PAYABLE': LiabilityType.PAYABLE,
      'OTHER': LiabilityType.OTHER,
    };
    
    const normalizedType = typeMapping[type];
    if (!normalizedType) {
      return NextResponse.json(
        { error: `无效的负债类型: ${type}` },
        { status: 400 }
      );
    }

    // 验证金额
    if (principalAmount <= 0 || currentBalance < 0) {
      return NextResponse.json(
        { error: '金额必须为正数' },
        { status: 400 }
      );
    }

    const liability = await LiabilityService.createLiability(session.user.id, {
      name,
      type: normalizedType,
      description,
      principalAmount: Number(principalAmount),
      currentBalance: Number(currentBalance),
      interestRate: interestRate ? Number(interestRate) : undefined,
      monthlyPayment: monthlyPayment ? Number(monthlyPayment) : undefined,
      currency: currency || 'CNY',
      startDate: startDate ? new Date(startDate) : undefined,
      maturityDate: maturityDate ? new Date(maturityDate) : undefined,
      nextPaymentDate: nextPaymentDate ? new Date(nextPaymentDate) : undefined,
      metadata
    });

    console.log('💳 [API] 负债创建成功:', {
      userId: session.user.id,
      liabilityId: liability.id,
      name: liability.name,
      type: liability.type,
      currentBalance: liability.currentBalance
    });

    return NextResponse.json({
      success: true,
      data: liability
    });
  } catch (error) {
    console.error('[API错误] /api/liabilities POST:', error);
    return NextResponse.json(
      { error: '创建负债失败' },
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
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少负债ID' },
        { status: 400 }
      );
    }

    // 处理数值字段
    const processedData: any = {};
    if (updateData.currentBalance !== undefined) {
      processedData.currentBalance = Number(updateData.currentBalance);
    }
    if (updateData.interestRate !== undefined) {
      processedData.interestRate = Number(updateData.interestRate);
    }
    if (updateData.monthlyPayment !== undefined) {
      processedData.monthlyPayment = Number(updateData.monthlyPayment);
    }
    if (updateData.nextPaymentDate) {
      processedData.nextPaymentDate = new Date(updateData.nextPaymentDate);
    }

    // 复制其他字段
    ['name', 'description', 'metadata'].forEach(field => {
      if (updateData[field] !== undefined) {
        processedData[field] = updateData[field];
      }
    });

    // 支持类型变更（资产转移）
    if (updateData.type) {
      const typeMapping: Record<string, LiabilityType> = {
        'mortgage': LiabilityType.MORTGAGE,
        'credit_card': LiabilityType.CREDIT_CARD,
        'personal_loan': LiabilityType.PERSONAL_LOAN,
        'business_loan': LiabilityType.BUSINESS_LOAN,
        'car_loan': LiabilityType.CAR_LOAN,
        'student_loan': LiabilityType.STUDENT_LOAN,
        'payable': LiabilityType.PAYABLE,
        'other': LiabilityType.OTHER,
        'MORTGAGE': LiabilityType.MORTGAGE,
        'CREDIT_CARD': LiabilityType.CREDIT_CARD,
        'PERSONAL_LOAN': LiabilityType.PERSONAL_LOAN,
        'BUSINESS_LOAN': LiabilityType.BUSINESS_LOAN,
        'CAR_LOAN': LiabilityType.CAR_LOAN,
        'STUDENT_LOAN': LiabilityType.STUDENT_LOAN,
        'PAYABLE': LiabilityType.PAYABLE,
        'OTHER': LiabilityType.OTHER,
      };
      const normalizedType = typeMapping[updateData.type];
      if (normalizedType) {
        processedData.type = normalizedType;
      }
    }

    const liability = await LiabilityService.updateLiability(
      id,
      session.user.id,
      processedData
    );

    console.log('💳 [API] 负债更新成功:', {
      userId: session.user.id,
      liabilityId: liability.id,
      name: liability.name
    });

    return NextResponse.json({
      success: true,
      data: liability
    });
  } catch (error) {
    console.error('[API错误] /api/liabilities PUT:', error);
    return NextResponse.json(
      { error: '更新负债失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '缺少负债ID' },
        { status: 400 }
      );
    }

    await LiabilityService.deleteLiability(id, session.user.id);

    console.log('💳 [API] 负债删除成功:', {
      userId: session.user.id,
      liabilityId: id
    });

    return NextResponse.json({
      success: true,
      message: '负债删除成功'
    });
  } catch (error) {
    console.error('[API错误] /api/liabilities DELETE:', error);
    return NextResponse.json(
      { error: '删除负债失败' },
      { status: 500 }
    );
  }
}