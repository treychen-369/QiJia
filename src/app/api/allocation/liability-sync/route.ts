/**
 * 负债同步 API
 * 
 * GET /api/allocation/liability-sync - 获取负债概览，供家庭概况表单同步使用
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { LiabilityService } from '@/lib/services/liability-service';
import { prisma } from '@/lib/prisma';
import { LiabilityType } from '@prisma/client';

/**
 * GET: 获取负债概览
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 获取负债概览
    const liabilityOverview = await LiabilityService.calculateLiabilityOverview(session.user.id);
    
    // 获取详细负债列表以分类（只获取活跃的负债）
    const liabilities = await prisma.liability.findMany({
      where: { 
        userId: session.user.id,
        isActive: true
      },
    });

    // 分类统计
    let hasHomeLoan = false;
    let homeLoanBalance = 0;
    let homeLoanMonthlyPayment = 0;
    let homeLoanInterestRate = 0;
    let homeLoanCount = 0;
    
    let hasCarLoan = false;
    let carLoanBalance = 0;
    let carLoanMonthlyPayment = 0;
    let carLoanInterestRate = 0;
    let carLoanCount = 0;
    
    let hasOtherLoans = false;
    let otherLoanBalance = 0;
    let otherLoanMonthlyPayment = 0;
    let otherLoanCount = 0;

    for (const liability of liabilities) {
      const type = liability.type;
      const monthlyPayment = Number(liability.monthlyPayment || 0);
      const currentBalance = Number(liability.currentBalance || 0);
      const interestRate = Number(liability.interestRate || 0);

      if (type === LiabilityType.MORTGAGE) {
        hasHomeLoan = true;
        homeLoanBalance += currentBalance;
        homeLoanMonthlyPayment += monthlyPayment;
        homeLoanInterestRate = interestRate; // 取最后一个的利率（或可改为加权平均）
        homeLoanCount++;
      } else if (type === LiabilityType.CAR_LOAN) {
        hasCarLoan = true;
        carLoanBalance += currentBalance;
        carLoanMonthlyPayment += monthlyPayment;
        carLoanInterestRate = interestRate;
        carLoanCount++;
      } else {
        // 其他类型：信用卡、个人贷款、商业贷款、学生贷款、应付款项等
        hasOtherLoans = true;
        otherLoanBalance += currentBalance;
        otherLoanMonthlyPayment += monthlyPayment;
        otherLoanCount++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        // 总览
        totalLiabilities: liabilityOverview.totalLiabilities,
        totalMonthlyPayment: liabilityOverview.totalMonthlyPayment,
        liabilityCount: liabilityOverview.liabilityCount,
        averageInterestRate: liabilityOverview.averageInterestRate,
        
        // 房贷详情
        hasHomeLoan,
        homeLoanBalance,
        homeLoanMonthlyPayment,
        homeLoanInterestRate,
        homeLoanCount,
        
        // 车贷详情
        hasCarLoan,
        carLoanBalance,
        carLoanMonthlyPayment,
        carLoanInterestRate,
        carLoanCount,
        
        // 其他贷款详情
        hasOtherLoans,
        otherLoanBalance,
        otherLoanMonthlyPayment,
        otherLoanCount,
        
        // 按类型分组（从服务层获取）
        byType: liabilityOverview.byType,
      },
    });
  } catch (error) {
    console.error('[API] 获取负债概览失败:', error);
    return NextResponse.json(
      { error: '获取负债概览失败' },
      { status: 500 }
    );
  }
}
