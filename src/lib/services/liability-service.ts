import { PrismaClient, Liability, LiabilityType } from '@prisma/client';
import { exchangeRateService } from '../exchange-rate-service';

const prisma = new PrismaClient();

export interface LiabilityOverview {
  totalLiabilities: number;           // 总负债（CNY）
  totalMonthlyPayment: number;        // 总月供（CNY）
  liabilityCount: number;             // 负债项目数量
  averageInterestRate: number;        // 平均利率
  byType: LiabilityTypeBreakdown[];   // 按类型分组
}

export interface LiabilityTypeBreakdown {
  type: LiabilityType;
  typeName: string;
  count: number;
  totalBalance: number;               // 总余额（CNY）
  totalMonthlyPayment: number;        // 总月供（CNY）
  averageInterestRate: number;        // 平均利率
}

export interface LiabilityDetail extends Omit<Liability, 'interestRate'> {
  interestRate: number;                 // 利率（已转换为数字）
  currentBalanceCny: number;            // 当前余额（CNY）
  monthlyPaymentCny: number;            // 月供（CNY）
  exchangeRate: number;                 // 汇率
  remainingMonths?: number;             // 剩余月数
  totalInterest?: number;               // 总利息
}

export class LiabilityService {
  /**
   * 计算负债概览
   */
  static async calculateLiabilityOverview(userId: string): Promise<LiabilityOverview> {
    const liabilities = await prisma.liability.findMany({
      where: { 
        userId,
        isActive: true 
      }
    });

    if (liabilities.length === 0) {
      return {
        totalLiabilities: 0,
        totalMonthlyPayment: 0,
        liabilityCount: 0,
        averageInterestRate: 0,
        byType: []
      };
    }

    // 计算每个负债的CNY金额
    const liabilityDetails = await Promise.all(
      liabilities.map(liability => this.calculateLiabilityDetails(liability))
    );

    const totalLiabilities = liabilityDetails.reduce((sum, l) => sum + l.currentBalanceCny, 0);
    const totalMonthlyPayment = liabilityDetails.reduce((sum, l) => sum + l.monthlyPaymentCny, 0);
    
    // 计算平均利率（加权平均）
    const totalWeightedRate = liabilityDetails.reduce((sum, l) => {
      const rate = Number(l.interestRate || 0);
      return sum + (rate * l.currentBalanceCny);
    }, 0);
    const averageInterestRate = totalLiabilities > 0 ? totalWeightedRate / totalLiabilities : 0;

    // 按类型分组
    const typeGroups = new Map<LiabilityType, LiabilityDetail[]>();
    liabilityDetails.forEach(liability => {
      const type = liability.type;
      if (!typeGroups.has(type)) {
        typeGroups.set(type, []);
      }
      typeGroups.get(type)!.push(liability);
    });

    const byType: LiabilityTypeBreakdown[] = Array.from(typeGroups.entries()).map(([type, items]) => {
      const totalBalance = items.reduce((sum, item) => sum + item.currentBalanceCny, 0);
      const totalMonthly = items.reduce((sum, item) => sum + item.monthlyPaymentCny, 0);
      const weightedRate = items.reduce((sum, item) => {
        const rate = Number(item.interestRate || 0);
        return sum + (rate * item.currentBalanceCny);
      }, 0);
      const avgRate = totalBalance > 0 ? weightedRate / totalBalance : 0;

      return {
        type,
        typeName: this.getLiabilityTypeName(type),
        count: items.length,
        totalBalance,
        totalMonthlyPayment: totalMonthly,
        averageInterestRate: avgRate
      };
    });

    return {
      totalLiabilities,
      totalMonthlyPayment,
      liabilityCount: liabilities.length,
      averageInterestRate,
      byType: byType.sort((a, b) => b.totalBalance - a.totalBalance)
    };
  }

  /**
   * 获取用户的所有负债详情
   */
  static async getUserLiabilities(userId: string): Promise<LiabilityDetail[]> {
    const liabilities = await prisma.liability.findMany({
      where: { 
        userId,
        isActive: true 
      },
      orderBy: [
        { currentBalance: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return Promise.all(
      liabilities.map(liability => this.calculateLiabilityDetails(liability))
    );
  }

  /**
   * 计算单个负债的详细信息
   */
  static async calculateLiabilityDetails(liability: Liability): Promise<LiabilityDetail> {
    // 获取汇率
    let exchangeRate = 1.0;
    if (liability.currency !== 'CNY') {
      try {
        exchangeRate = await exchangeRateService.getRate(liability.currency, 'CNY');
      } catch (error) {
        console.error(`获取汇率失败 ${liability.currency} -> CNY:`, error);
        // 使用默认汇率
        exchangeRate = liability.currency === 'USD' ? 7.2 
                     : liability.currency === 'HKD' ? 0.92 
                     : liability.currency === 'JPY' ? 0.05 
                     : 1.0;
      }
    }

    const currentBalanceCny = Number(liability.currentBalance) * exchangeRate;
    const monthlyPaymentCny = Number(liability.monthlyPayment || 0) * exchangeRate;
    
    // 确保利率转换为数字
    const interestRate = Number(liability.interestRate || 0);

    // 计算剩余月数和总利息
    let remainingMonths: number | undefined;
    let totalInterest: number | undefined;

    if (liability.maturityDate && liability.monthlyPayment && Number(liability.monthlyPayment) > 0) {
      const now = new Date();
      const maturityDate = new Date(liability.maturityDate);
      
      if (maturityDate > now) {
        const diffTime = maturityDate.getTime() - now.getTime();
        remainingMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30)); // 近似月数
        
        // 计算总利息（简化计算）
        const totalPayments = Number(liability.monthlyPayment) * remainingMonths;
        totalInterest = Math.max(0, totalPayments - Number(liability.currentBalance));
      }
    }

    return {
      ...liability,
      interestRate,  // 覆盖为数字类型
      currentBalanceCny,
      monthlyPaymentCny,
      exchangeRate,
      remainingMonths,
      totalInterest
    };
  }

  /**
   * 创建新负债
   */
  static async createLiability(userId: string, data: {
    name: string;
    type: LiabilityType;
    description?: string;
    principalAmount: number;
    currentBalance: number;
    interestRate?: number;
    monthlyPayment?: number;
    currency?: string;
    startDate?: Date;
    maturityDate?: Date;
    nextPaymentDate?: Date;
    metadata?: any;
  }): Promise<Liability> {
    return prisma.liability.create({
      data: {
        userId,
        name: data.name,
        type: data.type,
        description: data.description,
        principalAmount: data.principalAmount,
        currentBalance: data.currentBalance,
        interestRate: data.interestRate,
        monthlyPayment: data.monthlyPayment,
        currency: data.currency || 'CNY',
        startDate: data.startDate,
        maturityDate: data.maturityDate,
        nextPaymentDate: data.nextPaymentDate,
        metadata: data.metadata
      }
    });
  }

  /**
   * 更新负债信息
   */
  static async updateLiability(
    liabilityId: string, 
    userId: string, 
    data: Partial<{
      name: string;
      description: string;
      currentBalance: number;
      interestRate: number;
      monthlyPayment: number;
      nextPaymentDate: Date;
      metadata: any;
    }>
  ): Promise<Liability> {
    return prisma.liability.update({
      where: { 
        id: liabilityId,
        userId // 确保用户只能更新自己的负债
      },
      data: {
        ...data,
        lastUpdated: new Date()
      }
    });
  }

  /**
   * 删除负债（软删除）
   */
  static async deleteLiability(liabilityId: string, userId: string): Promise<void> {
    await prisma.liability.update({
      where: { 
        id: liabilityId,
        userId
      },
      data: {
        isActive: false,
        lastUpdated: new Date()
      }
    });
  }

  /**
   * 获取负债类型名称
   */
  static getLiabilityTypeName(type: LiabilityType): string {
    const typeNames: Record<LiabilityType, string> = {
      MORTGAGE: '房贷',
      CREDIT_CARD: '信用卡',
      PERSONAL_LOAN: '个人贷款',
      BUSINESS_LOAN: '商业贷款',
      CAR_LOAN: '车贷',
      STUDENT_LOAN: '学生贷款',
      PAYABLE: '应付款项',
      OTHER: '其他'
    };
    return typeNames[type] || '未知';
  }

  /**
   * 获取负债类型图标
   */
  static getLiabilityTypeIcon(type: LiabilityType): string {
    const typeIcons: Record<LiabilityType, string> = {
      MORTGAGE: 'Home',
      CREDIT_CARD: 'CreditCard',
      PERSONAL_LOAN: 'User',
      BUSINESS_LOAN: 'Building2',
      CAR_LOAN: 'Car',
      STUDENT_LOAN: 'GraduationCap',
      PAYABLE: 'Users',
      OTHER: 'MoreHorizontal'
    };
    return typeIcons[type] || 'MoreHorizontal';
  }

  /**
   * 获取负债类型颜色
   */
  static getLiabilityTypeColor(type: LiabilityType): string {
    const typeColors: Record<LiabilityType, string> = {
      MORTGAGE: 'bg-red-500',
      CREDIT_CARD: 'bg-orange-500',
      PERSONAL_LOAN: 'bg-yellow-500',
      BUSINESS_LOAN: 'bg-purple-500',
      CAR_LOAN: 'bg-blue-500',
      STUDENT_LOAN: 'bg-green-500',
      PAYABLE: 'bg-pink-500',
      OTHER: 'bg-gray-500'
    };
    return typeColors[type] || 'bg-gray-500';
  }
}