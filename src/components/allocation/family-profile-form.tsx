'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Users, Wallet, Shield, Target, RefreshCw, Link2, Info, Crosshair, AlertCircle, CheckCircle2, Clock, TrendingUp, GraduationCap, Home, Umbrella, Heart, PiggyBank, Plane } from 'lucide-react';

// ==================== 财务目标类型定义 ====================


// 推荐目标类型
type GoalType = 
  | 'EMERGENCY_FUND'      // 应急储备金
  | 'RETIREMENT'          // 退休养老
  | 'CHILD_EDUCATION'     // 子女教育
  | 'ELDERLY_CARE'        // 父母养老储备
  | 'HOME_PURCHASE'       // 购房首付
  | 'HOME_UPGRADE'        // 换房升级
  | 'EARLY_REPAYMENT'     // 提前还贷
  | 'LIFE_INSURANCE'      // 寿险保障
  | 'TRAVEL'              // 家庭旅游
  | 'CAR_PURCHASE'        // 购车基金
  | 'PASSIVE_INCOME';     // 被动收入

// 目标优先级
type GoalPriority = 'ESSENTIAL' | 'IMPORTANT' | 'OPTIONAL';

// 单个财务目标
interface FinancialGoal {
  type: GoalType;
  name: string;
  description: string;
  targetAmount: number;        // 目标金额
  currentAmount: number;       // 当前进度（从资产中计算）
  targetYear: number;          // 目标年份
  priority: GoalPriority;
  enabled: boolean;            // 是否启用
  icon: React.ReactNode;
  customTargetAmount?: number; // 用户自定义金额（覆盖系统计算）
}

// 新的财务目标结构
interface FinancialGoals {
  goals: {
    [key in GoalType]?: {
      enabled: boolean;
      customTargetAmount?: number;
      customTargetYear?: number;
    };
  };
  notes?: string;
}

interface FamilyProfile {
  householdMembers: number;
  primaryEarnerAge?: number;
  childrenCount: number;      // 子女数量
  elderlyCount: number;       // 赡养老人数量
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
  financialGoals?: FinancialGoals;
}

interface LiabilityTypeBreakdown {
  type: string;
  typeName: string;
  count: number;
  totalBalance: number;
  totalMonthlyPayment: number;
  averageInterestRate: number;
}

interface LiabilityOverview {
  // 总览
  totalLiabilities: number;
  totalMonthlyPayment: number;
  liabilityCount: number;
  averageInterestRate: number;
  
  // 房贷详情
  hasHomeLoan: boolean;
  homeLoanBalance: number;
  homeLoanMonthlyPayment: number;
  homeLoanInterestRate: number;
  homeLoanCount: number;
  
  // 车贷详情
  hasCarLoan: boolean;
  carLoanBalance: number;
  carLoanMonthlyPayment: number;
  carLoanInterestRate: number;
  carLoanCount: number;
  
  // 其他贷款详情
  hasOtherLoans: boolean;
  otherLoanBalance: number;
  otherLoanMonthlyPayment: number;
  otherLoanCount: number;
  
  // 按类型分组
  byType: LiabilityTypeBreakdown[];
}

interface FamilyProfileFormProps {
  onSave?: () => void;
}

export function FamilyProfileForm({ onSave }: FamilyProfileFormProps = {}) {
  const [profile, setProfile] = useState<FamilyProfile>({
    householdMembers: 1,
    childrenCount: 0,
    elderlyCount: 0,
    emergencyFundMonths: 6,
    riskTolerance: 'MODERATE',
    investmentHorizon: 'MEDIUM',
    hasHomeLoan: false,
    hasCarLoan: false,
    hasOtherLoans: false,
    hasLifeInsurance: false,
    hasHealthInsurance: false,
    hasCriticalIllnessInsurance: false,
    financialGoals: {
      goals: {},
      notes: '',
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // 负债同步相关状态
  const [liabilityOverview, setLiabilityOverview] = useState<LiabilityOverview | null>(null);
  const [loadingLiability, setLoadingLiability] = useState(false);
  const [liabilitySynced, setLiabilitySynced] = useState(false);
  
  // 资产数据（用于计算目标进度）
  const [totalAssets, setTotalAssets] = useState(0);
  const [cashAssets, setCashAssets] = useState(0);

  // ==================== 财务目标计算逻辑 ====================
  
  const currentYear = new Date().getFullYear();
  
  // 格式化货币（需要在 recommendedGoals 之前定义）
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  // 基于用户档案计算推荐目标
  const recommendedGoals = useMemo((): FinancialGoal[] => {
    const age = profile.primaryEarnerAge || 35;
    const monthlyIncome = profile.monthlyIncome || 30000;
    const monthlyExpenses = profile.monthlyExpenses || 15000;
    const annualIncome = monthlyIncome * 12;
    const childrenCount = profile.childrenCount || 0;
    const elderlyCount = profile.elderlyCount || 0;
    const retirementAge = profile.retirementAge || 60;
    const yearsToRetirement = Math.max(retirementAge - age, 5);
    
    const goals: FinancialGoal[] = [];
    
    // ==================== 资金分层模型 ====================
    // 按优先级从总资产中依次划拨，避免重复计算
    let remainingAssets = totalAssets;  // 剩余可分配资产
    let remainingCash = cashAssets;     // 剩余现金类资产
    
    // 1. 应急储备金（必要）- 6个月支出，优先从现金划拨
    const emergencyTarget = monthlyExpenses * 6;
    const emergencyAllocated = Math.min(remainingCash, emergencyTarget);
    remainingCash -= emergencyAllocated;
    remainingAssets -= emergencyAllocated;
    
    goals.push({
      type: 'EMERGENCY_FUND',
      name: '应急储备金',
      description: `建议储备6个月支出（${formatCurrency(monthlyExpenses)}/月）`,
      targetAmount: emergencyTarget,
      currentAmount: emergencyAllocated,
      targetYear: currentYear + 1,
      priority: 'ESSENTIAL',
      enabled: true,
      icon: <Umbrella className="h-4 w-4" />,
    });
    
    // 2. 子女教育金（如有子女）- 从剩余资产中划拨
    if (childrenCount > 0) {
      const yearsToCollege = 12;
      const collegeCostPerYear = 80000;
      const futureCollegeCost = collegeCostPerYear * 4 * Math.pow(1.04, yearsToCollege);
      const educationTarget = Math.round(futureCollegeCost * childrenCount);
      // 教育金从剩余资产中划拨（可以是现金+投资的组合）
      const educationAllocated = Math.min(remainingAssets, educationTarget);
      remainingAssets -= educationAllocated;
      
      goals.push({
        type: 'CHILD_EDUCATION',
        name: '子女教育金',
        description: `${childrenCount}个子女大学教育基金（含通胀预估）`,
        targetAmount: educationTarget,
        currentAmount: educationAllocated,
        targetYear: currentYear + yearsToCollege,
        priority: 'ESSENTIAL',
        enabled: true,
        icon: <GraduationCap className="h-4 w-4" />,
      });
    }
    
    // 2.5 父母养老/医疗储备（如有赡养老人）- 从剩余资产中划拨
    if (elderlyCount > 0) {
      // 每位老人预计需要的医疗+养老储备（10年期）
      const elderlyReservePerPerson = 200000; // 每人20万
      const elderlyTarget = elderlyReservePerPerson * elderlyCount;
      const elderlyAllocated = Math.min(remainingAssets, elderlyTarget);
      remainingAssets -= elderlyAllocated;
      
      goals.push({
        type: 'ELDERLY_CARE' as GoalType,
        name: '父母养老储备',
        description: `${elderlyCount}位老人的医疗和养老储备`,
        targetAmount: elderlyTarget,
        currentAmount: elderlyAllocated,
        targetYear: currentYear + 10,
        priority: 'ESSENTIAL',
        enabled: true,
        icon: <Heart className="h-4 w-4" />,
      });
    }
    
    // 3. 退休养老金（必要）- 4%法则，使用剩余资产
    const retirementAnnualSpending = monthlyExpenses * 12 * 0.8;
    const retirementTarget = Math.round(retirementAnnualSpending * 25);
    // 退休金使用所有剩余资产（扣除应急和教育后）
    const retirementAllocated = Math.max(remainingAssets, 0);
    
    goals.push({
      type: 'RETIREMENT',
      name: '退休养老金',
      description: `${retirementAge}岁退休，基于4%安全提取率`,
      targetAmount: retirementTarget,
      currentAmount: retirementAllocated,
      targetYear: currentYear + yearsToRetirement,
      priority: 'ESSENTIAL',
      enabled: true,
      icon: <PiggyBank className="h-4 w-4" />,
    });
    
    // 4. 提前还贷（如有房贷）- 不占用已分配资产
    if (liabilityOverview?.hasHomeLoan && liabilityOverview.homeLoanBalance > 0) {
      goals.push({
        type: 'EARLY_REPAYMENT',
        name: '提前还贷',
        description: '提前偿还房贷本金，减少利息支出',
        targetAmount: liabilityOverview.homeLoanBalance,
        currentAmount: 0, // 需要额外储蓄
        targetYear: currentYear + 5,
        priority: 'IMPORTANT',
        enabled: false,
        icon: <Home className="h-4 w-4" />,
      });
    }
    
    // 5. 寿险保障（重要）- 年收入10倍
    if (!profile.hasLifeInsurance) {
      goals.push({
        type: 'LIFE_INSURANCE',
        name: '寿险保障',
        description: '建议保额为年收入的10倍',
        targetAmount: annualIncome * 10,
        currentAmount: 0, // 需要购买保险
        targetYear: currentYear + 1,
        priority: 'IMPORTANT',
        enabled: true,
        icon: <Shield className="h-4 w-4" />,
      });
    }
    
    // 6. 换房升级（可选）
    goals.push({
      type: 'HOME_UPGRADE',
      name: '换房升级',
      description: '改善居住条件的首付款储备',
      targetAmount: 2000000,
      currentAmount: 0, // 需要额外储蓄
      targetYear: currentYear + 5,
      priority: 'OPTIONAL',
      enabled: false,
      icon: <Home className="h-4 w-4" />,
    });
    
    // 7. 家庭旅游（可选）
    goals.push({
      type: 'TRAVEL',
      name: '家庭旅游',
      description: '每年家庭旅游预算',
      targetAmount: 50000,
      currentAmount: 0, // 需要从收入中预留
      targetYear: currentYear + 1,
      priority: 'OPTIONAL',
      enabled: false,
      icon: <Plane className="h-4 w-4" />,
    });
    
    // 8. 被动收入（可选）- 用总资产衡量（与退休目标类似但目标更高）
    const passiveIncomeTarget = monthlyExpenses * 12 * 25;
    goals.push({
      type: 'PASSIVE_INCOME',
      name: '被动收入',
      description: `实现年度被动收入覆盖基本支出`,
      targetAmount: passiveIncomeTarget,
      currentAmount: totalAssets, // 用总资产衡量FIRE进度
      targetYear: currentYear + 10,
      priority: 'OPTIONAL',
      enabled: false,
      icon: <TrendingUp className="h-4 w-4" />,
    });
    
    return goals;
  }, [profile, liabilityOverview, totalAssets, cashAssets, currentYear]);
  
  // 获取目标的启用状态和自定义值
  const getGoalConfig = (goalType: GoalType): { enabled?: boolean; customTargetAmount?: number; customTargetYear?: number } => {
    return profile.financialGoals?.goals?.[goalType] || { enabled: undefined };
  };
  
  // 更新目标配置
  const updateGoalConfig = (goalType: GoalType, config: { enabled?: boolean; customTargetAmount?: number; customTargetYear?: number }) => {
    setProfile(prev => ({
      ...prev,
      financialGoals: {
        ...prev.financialGoals,
        goals: {
          ...prev.financialGoals?.goals,
          [goalType]: {
            ...prev.financialGoals?.goals?.[goalType],
            ...config,
          },
        },
      },
    }));
  };
  
  // 判断目标是否启用
  const isGoalEnabled = (goal: FinancialGoal) => {
    const config = getGoalConfig(goal.type);
    return config.enabled !== undefined ? config.enabled : goal.enabled;
  };
  
  // 获取目标金额（优先使用用户自定义）
  const getGoalTargetAmount = (goal: FinancialGoal) => {
    const config = getGoalConfig(goal.type);
    return config.customTargetAmount || goal.targetAmount;
  };
  
  // 计算进度百分比
  const calculateProgress = (goal: FinancialGoal) => {
    const target = getGoalTargetAmount(goal);
    if (target <= 0) return 0;
    return Math.min(Math.round((goal.currentAmount / target) * 100), 100);
  };

  // 获取现有数据
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/allocation/family-profile');
        const result = await response.json();
        
        if (result.success && result.data) {
          setProfile(prev => ({ ...prev, ...result.data }));
        }
      } catch (error) {
        console.error('获取家庭概况失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
    // 同时获取负债概览
    fetchLiabilityOverview();
    // 获取资产数据
    fetchAssetData();
  }, []);
  
  // 获取资产数据用于计算目标进度
  const fetchAssetData = async () => {
    try {
      const response = await fetch('/api/dashboard');
      const result = await response.json();
      // Dashboard API 直接返回数据对象，不是 {success, data} 格式
      if (result.overview) {
        setTotalAssets(result.overview.totalAssets || 0);
        setCashAssets(result.overview.totalCashAssets || 0);
      }
    } catch (error) {
      console.error('获取资产数据失败:', error);
    }
  };

  // 获取负债概览
  const fetchLiabilityOverview = async () => {
    try {
      setLoadingLiability(true);
      const response = await fetch('/api/allocation/liability-sync');
      const result = await response.json();
      
      if (result.success) {
        setLiabilityOverview(result.data);
      }
    } catch (error) {
      console.error('获取负债概览失败:', error);
    } finally {
      setLoadingLiability(false);
    }
  };

  // 同步负债数据到表单
  const syncLiabilityData = () => {
    if (!liabilityOverview) return;
    
    setProfile(prev => ({
      ...prev,
      hasHomeLoan: liabilityOverview.hasHomeLoan,
      homeLoanMonthlyPayment: liabilityOverview.homeLoanMonthlyPayment || undefined,
      hasCarLoan: liabilityOverview.hasCarLoan,
      hasOtherLoans: liabilityOverview.hasOtherLoans,
    }));
    
    setLiabilitySynced(true);
    setMessage({ type: 'success', text: '负债数据已同步，请检查并保存' });
  };


  // 保存数据
  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      
      // 🔧 构建完整的财务目标数据（包含所有启用的目标 + 计算金额）
      const completeGoals: FinancialGoals['goals'] = {};
      
      // 遍历所有推荐目标，将启用状态和计算金额写入 goals 对象
      for (const goal of recommendedGoals) {
        const config = profile.financialGoals?.goals?.[goal.type];
        // 检查是否启用：用户显式设置 > 目标默认值
        const isEnabled = config?.enabled !== undefined ? config.enabled : goal.enabled;
        
        if (isEnabled) {
          completeGoals[goal.type] = {
            enabled: true,
            // 使用用户自定义金额，否则使用系统计算的金额
            customTargetAmount: config?.customTargetAmount || goal.targetAmount,
            // 使用用户自定义年份，否则使用系统计算的年份
            customTargetYear: config?.customTargetYear || goal.targetYear,
          };
        }
      }
      
      // 构建完整的 profile 数据
      const profileToSave = {
        ...profile,
        financialGoals: {
          ...profile.financialGoals,
          goals: completeGoals,
        },
      };
      
      const response = await fetch('/api/allocation/family-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileToSave),
      });
      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: '保存成功！AI建议将基于最新信息生成。' });
        setLiabilitySynced(false);
        // 同步更新本地状态
        setProfile(profileToSave);
      } else {
        setMessage({ type: 'error', text: result.error || '保存失败' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '保存失败，请重试' });
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof FamilyProfile>(field: K, value: FamilyProfile[K]) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  // 更新财务目标备注
  const updateFinancialNotes = (notes: string) => {
    setProfile(prev => ({
      ...prev,
      financialGoals: {
        ...prev.financialGoals,
        notes,
      },
    } as FamilyProfile));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            家庭基本信息
          </CardTitle>
          <CardDescription>
            这些信息将帮助AI提供更个性化的资产配置建议
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="householdMembers">家庭成员数</Label>
              <Input
                id="householdMembers"
                type="number"
                min={1}
                value={profile.householdMembers}
                onChange={(e) => updateField('householdMembers', parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryEarnerAge">主要收入者年龄</Label>
              <Input
                id="primaryEarnerAge"
                type="number"
                min={18}
                max={100}
                value={profile.primaryEarnerAge || ''}
                onChange={(e) => updateField('primaryEarnerAge', e.target.value ? parseInt(e.target.value) : undefined)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="childrenCount">子女数量</Label>
              <Input
                id="childrenCount"
                type="number"
                min={0}
                value={profile.childrenCount}
                onChange={(e) => updateField('childrenCount', parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">用于计算教育金目标</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="elderlyCount">赡养老人数</Label>
              <Input
                id="elderlyCount"
                type="number"
                min={0}
                value={profile.elderlyCount}
                onChange={(e) => updateField('elderlyCount', parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">用于计算父母养老储备</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="retirementAge">计划退休年龄</Label>
              <Input
                id="retirementAge"
                type="number"
                min={40}
                max={80}
                value={profile.retirementAge || ''}
                onChange={(e) => updateField('retirementAge', e.target.value ? parseInt(e.target.value) : undefined)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 收入情况 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            收入与支出
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthlyIncome">家庭月收入（税后）</Label>
              <Input
                id="monthlyIncome"
                type="number"
                min={0}
                placeholder="如：50000"
                value={profile.monthlyIncome || ''}
                onChange={(e) => updateField('monthlyIncome', e.target.value ? parseFloat(e.target.value) : undefined)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyExpenses">家庭月支出</Label>
              <Input
                id="monthlyExpenses"
                type="number"
                min={0}
                placeholder="如：25000"
                value={profile.monthlyExpenses || ''}
                onChange={(e) => updateField('monthlyExpenses', e.target.value ? parseFloat(e.target.value) : undefined)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="incomeStability">收入稳定性</Label>
              <Select
                value={profile.incomeStability || ''}
                onValueChange={(value) => updateField('incomeStability', value)}
              >
                <SelectTrigger id="incomeStability">
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VERY_STABLE">非常稳定（如公务员、国企）</SelectItem>
                  <SelectItem value="STABLE">稳定（如大型私企）</SelectItem>
                  <SelectItem value="VARIABLE">波动较大（如销售提成）</SelectItem>
                  <SelectItem value="UNSTABLE">不稳定（如自由职业）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyFundMonths">应急资金目标（月数）</Label>
              <Select
                value={profile.emergencyFundMonths.toString()}
                onValueChange={(value) => updateField('emergencyFundMonths', parseInt(value))}
              >
                <SelectTrigger id="emergencyFundMonths">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3个月</SelectItem>
                  <SelectItem value="6">6个月（推荐）</SelectItem>
                  <SelectItem value="9">9个月</SelectItem>
                  <SelectItem value="12">12个月</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">建议保持6个月支出的应急资金</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 风险偏好 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            投资偏好
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="riskTolerance">风险承受能力</Label>
              <Select
                value={profile.riskTolerance}
                onValueChange={(value) => updateField('riskTolerance', value)}
              >
                <SelectTrigger id="riskTolerance">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSERVATIVE">保守型（优先保本）</SelectItem>
                  <SelectItem value="MODERATE">稳健型（平衡风险收益）</SelectItem>
                  <SelectItem value="AGGRESSIVE">积极型（追求高收益）</SelectItem>
                  <SelectItem value="VERY_AGGRESSIVE">激进型（可接受大幅波动）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="investmentHorizon">投资期限</Label>
              <Select
                value={profile.investmentHorizon}
                onValueChange={(value) => updateField('investmentHorizon', value)}
              >
                <SelectTrigger id="investmentHorizon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHORT">短期（3年以内）</SelectItem>
                  <SelectItem value="MEDIUM">中期（3-10年）</SelectItem>
                  <SelectItem value="LONG">长期（10年以上）</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 负债情况 - 带同步功能 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                负债情况
              </CardTitle>
              <CardDescription className="mt-1">
                可从资产详情的负债数据自动同步
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {liabilityOverview && liabilityOverview.liabilityCount > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={syncLiabilityData}
                        disabled={loadingLiability}
                        className="flex items-center gap-2"
                      >
                        {loadingLiability ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Link2 className="h-4 w-4" />
                        )}
                        同步负债数据
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>从资产详情中的负债记录自动填充</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchLiabilityOverview}
                disabled={loadingLiability}
              >
                <RefreshCw className={`h-4 w-4 ${loadingLiability ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 系统负债概览 - 只读展示 */}
          {liabilityOverview && liabilityOverview.liabilityCount > 0 && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  系统检测到 {liabilityOverview.liabilityCount} 笔负债记录
                </span>
                {liabilitySynced && (
                  <Badge className="bg-green-100 text-green-700">已同步</Badge>
                )}
              </div>
              
              {/* 总览信息 */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">总负债</p>
                  <p className="font-semibold text-red-600">{formatCurrency(liabilityOverview.totalLiabilities)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">月供总额</p>
                  <p className="font-semibold">{formatCurrency(liabilityOverview.totalMonthlyPayment)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">平均利率</p>
                  <p className="font-semibold text-orange-600">{liabilityOverview.averageInterestRate.toFixed(2)}%</p>
                </div>
              </div>

              {/* 分类汇总 - 更简洁的展示 */}
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                {liabilityOverview.hasHomeLoan && (
                  <Badge variant="outline" className="bg-white dark:bg-gray-800">
                    房贷 {liabilityOverview.homeLoanCount}笔 · {formatCurrency(liabilityOverview.homeLoanBalance)}
                  </Badge>
                )}
                {liabilityOverview.hasCarLoan && (
                  <Badge variant="outline" className="bg-white dark:bg-gray-800">
                    车贷 {liabilityOverview.carLoanCount}笔 · {formatCurrency(liabilityOverview.carLoanBalance)}
                  </Badge>
                )}
                {liabilityOverview.hasOtherLoans && (
                  <Badge variant="outline" className="bg-white dark:bg-gray-800">
                    其他 {liabilityOverview.otherLoanCount}笔 · {formatCurrency(liabilityOverview.otherLoanBalance)}
                  </Badge>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground mt-3">
                💡 负债数据已从资产详情自动同步，如需修改请前往「负债管理」页面
              </p>
            </div>
          )}

          {/* 无负债时的空状态 */}
          {(!liabilityOverview || liabilityOverview.liabilityCount === 0) && (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">暂无负债记录</p>
              <p className="text-xs mt-1">如有负债，请在「负债管理」页面添加</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 保障情况 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            保险保障
          </CardTitle>
          <CardDescription>
            完善的保险保障是资产配置的基础
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="hasLifeInsurance">寿险</Label>
                <p className="text-xs text-muted-foreground">定期寿险或终身寿险</p>
              </div>
              <Switch
                id="hasLifeInsurance"
                checked={profile.hasLifeInsurance}
                onCheckedChange={(checked) => updateField('hasLifeInsurance', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="hasHealthInsurance">医疗险</Label>
                <p className="text-xs text-muted-foreground">百万医疗险或高端医疗险</p>
              </div>
              <Switch
                id="hasHealthInsurance"
                checked={profile.hasHealthInsurance}
                onCheckedChange={(checked) => updateField('hasHealthInsurance', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="hasCriticalIllnessInsurance">重疾险</Label>
                <p className="text-xs text-muted-foreground">重大疾病保险</p>
              </div>
              <Switch
                id="hasCriticalIllnessInsurance"
                checked={profile.hasCriticalIllnessInsurance}
                onCheckedChange={(checked) => updateField('hasCriticalIllnessInsurance', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>


      {/* 财务目标规划 - 基于生命周期的智能推荐 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5" />
            财务目标规划
          </CardTitle>
          <CardDescription>
            基于您的家庭档案，系统为您推荐以下财务目标
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 提示信息 */}
          {(!profile.monthlyIncome || !profile.monthlyExpenses) && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-800 dark:text-amber-300">
                  请先填写「收支情况」中的月收入和月支出，以便系统计算更精准的目标金额
                </span>
              </div>
            </div>
          )}

          {/* 必要目标 */}
          {(() => {
            const essentialGoals = recommendedGoals.filter(g => g.priority === 'ESSENTIAL');
            if (essentialGoals.length === 0) return null;
            return (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                    🔴 必要目标
                  </Badge>
                  <span className="text-xs text-muted-foreground">建议优先完成</span>
                </div>
                <div className="space-y-3">
                  {essentialGoals.map((goal) => {
                    const enabled = isGoalEnabled(goal);
                    const targetAmount = getGoalTargetAmount(goal);
                    const progress = calculateProgress(goal);
                    return (
                      <div
                        key={goal.type}
                        className={`p-4 rounded-lg border transition-all ${
                          enabled 
                            ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' 
                            : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`p-2 rounded-lg ${enabled ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                              {goal.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{goal.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {goal.targetYear}年
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{goal.description}</p>
                              {enabled && (
                                <>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm">
                                      目标: <span className="font-semibold text-red-600">{formatCurrency(targetAmount)}</span>
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      当前: {formatCurrency(goal.currentAmount)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full transition-all ${progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-blue-500' : 'bg-red-400'}`}
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                    <span className={`text-xs font-medium ${progress >= 100 ? 'text-green-600' : progress >= 50 ? 'text-blue-600' : 'text-gray-500'}`}>
                                      {progress}%
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          <Switch
                            checked={enabled}
                            onCheckedChange={(checked) => updateGoalConfig(goal.type, { enabled: checked })}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* 重要目标 */}
          {(() => {
            const importantGoals = recommendedGoals.filter(g => g.priority === 'IMPORTANT');
            if (importantGoals.length === 0) return null;
            return (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                    🟡 重要目标
                  </Badge>
                  <span className="text-xs text-muted-foreground">根据情况选择</span>
                </div>
                <div className="space-y-3">
                  {importantGoals.map((goal) => {
                    const enabled = isGoalEnabled(goal);
                    const targetAmount = getGoalTargetAmount(goal);
                    const progress = calculateProgress(goal);
                    return (
                      <div
                        key={goal.type}
                        className={`p-4 rounded-lg border transition-all ${
                          enabled 
                            ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' 
                            : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`p-2 rounded-lg ${enabled ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                              {goal.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{goal.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {goal.targetYear}年
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{goal.description}</p>
                              {enabled && (
                                <>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm">
                                      目标: <span className="font-semibold text-amber-600">{formatCurrency(targetAmount)}</span>
                                    </span>
                                    {goal.currentAmount > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        当前: {formatCurrency(goal.currentAmount)}
                                      </span>
                                    )}
                                  </div>
                                  {goal.currentAmount > 0 && (
                                    <div className="flex items-center gap-2">
                                      <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full transition-all ${progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
                                          style={{ width: `${progress}%` }}
                                        />
                                      </div>
                                      <span className={`text-xs font-medium ${progress >= 100 ? 'text-green-600' : progress >= 50 ? 'text-blue-600' : 'text-gray-500'}`}>
                                        {progress}%
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <Switch
                            checked={enabled}
                            onCheckedChange={(checked) => updateGoalConfig(goal.type, { enabled: checked })}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* 可选目标 */}
          {(() => {
            const optionalGoals = recommendedGoals.filter(g => g.priority === 'OPTIONAL');
            if (optionalGoals.length === 0) return null;
            return (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    🟢 可选目标
                  </Badge>
                  <span className="text-xs text-muted-foreground">提升生活品质</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {optionalGoals.map((goal) => {
                    const enabled = isGoalEnabled(goal);
                    const config = getGoalConfig(goal.type);
                    const customAmount = config.customTargetAmount;
                    return (
                      <div
                        key={goal.type}
                        className={`p-4 rounded-lg border transition-all ${
                          enabled 
                            ? 'bg-white dark:bg-gray-800 border-green-200 dark:border-green-800' 
                            : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className={`p-1.5 rounded ${enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                              {goal.icon}
                            </div>
                            <span className="font-medium text-sm">{goal.name}</span>
                          </div>
                          <Switch
                            checked={enabled}
                            onCheckedChange={(checked) => updateGoalConfig(goal.type, { enabled: checked })}
                          />
                        </div>
                        {enabled && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">目标金额:</span>
                              <Input
                                type="number"
                                min={0}
                                placeholder={goal.targetAmount.toString()}
                                value={customAmount || ''}
                                onChange={(e) => {
                                  const value = e.target.value ? parseFloat(e.target.value) : undefined;
                                  updateGoalConfig(goal.type, { customTargetAmount: value });
                                }}
                                className="h-8 text-sm"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {customAmount ? formatCurrency(customAmount) : `默认: ${formatCurrency(goal.targetAmount)}`}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* 计算说明 */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                <p className="font-medium">目标金额计算说明</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
                  <li>应急储备金：月支出 × 6个月</li>
                  <li>退休养老金：基于4%安全提取率（年支出×25）</li>
                  <li>子女教育金：大学4年费用，含通胀预估</li>
                  <li>寿险保障：年收入的10倍</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 补充说明 */}
          <div className="space-y-2">
            <Label htmlFor="financialNotes">补充说明</Label>
            <Textarea
              id="financialNotes"
              placeholder="其他财务目标或特殊情况说明..."
              value={profile.financialGoals?.notes || ''}
              onChange={(e) => updateFinancialNotes(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex items-center justify-between">
        {message && (
          <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}
        <div className="flex-1" />
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          保存家庭概况
        </Button>
      </div>
    </div>
  );
}
