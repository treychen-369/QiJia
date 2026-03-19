/**
 * 定期存款收益计算工具
 */

export interface FixedDepositData {
  principal: number; // 本金
  interestRate: number; // 年利率（百分比，如 2.75）
  startDate: Date | string; // 存入日期
  maturityDate: Date | string; // 到期日期
  actualMaturityAmount?: number; // 实际到期本息（可选，到期后填写）
}

export interface DepositInterest {
  principal: number; // 本金
  currentInterest: number; // 当前累计利息
  expectedTotalInterest: number; // 预计总利息
  currentValue: number; // 当前价值（本金+当前利息）
  expectedMaturityValue: number; // 预计到期本息
  daysHeld: number; // 已持有天数
  totalDays: number; // 总天数
  progressPercent: number; // 进度百分比
  isMatured: boolean; // 是否已到期
}

/**
 * 计算定期存款收益
 * @param data 存款数据
 * @param asOfDate 计算截止日期，默认为今天
 * @returns 收益详情
 */
export function calculateFixedDepositInterest(
  data: FixedDepositData,
  asOfDate: Date = new Date()
): DepositInterest {
  const principal = data.principal;
  const rate = data.interestRate / 100; // 转换为小数
  const startDate = new Date(data.startDate);
  const maturityDate = new Date(data.maturityDate);
  
  // 计算总天数
  const totalDays = Math.max(0, Math.ceil(
    (maturityDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ));
  
  // 计算已持有天数（不超过总天数）
  const daysHeld = Math.max(0, Math.min(
    totalDays,
    Math.ceil((asOfDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  ));
  
  // 判断是否已到期
  const isMatured = asOfDate >= maturityDate;
  
  // 计算预计总利息（单利）
  const expectedTotalInterest = principal * rate * totalDays / 365;
  
  // 计算当前累计利息（按持有天数比例）
  const currentInterest = isMatured 
    ? expectedTotalInterest 
    : principal * rate * daysHeld / 365;
  
  // 如果已到期且有实际到期金额，使用实际金额
  const actualInterest = data.actualMaturityAmount 
    ? data.actualMaturityAmount - principal 
    : null;
  
  const currentValue = principal + (isMatured && actualInterest !== null ? actualInterest : currentInterest);
  const expectedMaturityValue = principal + expectedTotalInterest;
  
  const progressPercent = totalDays > 0 ? (daysHeld / totalDays) * 100 : 0;
  
  return {
    principal,
    currentInterest: isMatured && actualInterest !== null ? actualInterest : currentInterest,
    expectedTotalInterest,
    currentValue,
    expectedMaturityValue,
    daysHeld,
    totalDays,
    progressPercent,
    isMatured,
  };
}

/**
 * 格式化存款状态标签
 */
export function getDepositStatusLabel(interest: DepositInterest): {
  label: string;
  color: 'green' | 'blue' | 'orange' | 'gray';
} {
  if (interest.isMatured) {
    return { label: '已到期', color: 'green' };
  }
  if (interest.progressPercent >= 80) {
    return { label: '即将到期', color: 'orange' };
  }
  if (interest.progressPercent >= 50) {
    return { label: '持有中', color: 'blue' };
  }
  return { label: '新开立', color: 'gray' };
}
