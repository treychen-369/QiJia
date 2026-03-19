'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Users,
  TrendingUp, 
  TrendingDown, 
  Eye,
  EyeOff,
  RefreshCw,
  Wallet,
  PieChart,
  Info,
  Target,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  ArrowLeftRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  PiggyBank,
  Receipt,
} from 'lucide-react';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { getPnLColorClassOnDark } from '@/lib/user-preferences';

interface MemberBreakdown {
  userId: string;
  userName: string;
  role: string;
  totalAssets: number;
  percentage: number;
}

interface AssetDistribution {
  category: string;
  categoryName: string;
  value: number;
  percentage: number;
  color: string;
}

interface FamilyOverviewData {
  familyName: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPercent: number;
  todayPnl: number;
  todayPnlPercent: number;
  memberCount: number;
  memberBreakdown: MemberBreakdown[];
  assetDistribution: AssetDistribution[];
}

interface AllocationHealthData {
  score: number;
  topDeviation?: {
    category: string;
    deviation: number;
    status: string;
  };
  alertCount?: number;
  fullAnalysis?: Array<{
    categoryCode: string;
    categoryName: string;
    currentPercent: number;
    targetPercent: number;
    deviation: number;
    deviationStatus: 'NORMAL' | 'WARNING' | 'CRITICAL';
    currentValue: number;
    suggestedAction?: 'HOLD' | 'BUY' | 'SELL' | 'REBALANCE';
    suggestedAmount?: number;
  }>;
  alerts?: Array<{
    type: string;
    categoryCode: string;
    categoryName: string;
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  scoreBreakdown?: {
    deviationScore: number;
    diversityScore: number;
    liquidityScore: number;
    debtScore: number;
  };
  latestAdvice?: {
    id: string;
    summary: string;
    status: string;
    confidence?: number;
    createdAt: string;
    actions?: Array<{
      priority: number;
      category: string;
      categoryName: string;
      action: 'BUY' | 'SELL' | 'HOLD';
      amount?: number;
      reason: string;
      subCategory?: string;
      suggestedProducts?: string[];
    }>;
    fullAnalysis?: string;
    targets?: Array<{
      categoryCode: string;
      categoryName: string;
      currentPercent: number;
      suggestedPercent: number;
      reason: string;
    }>;
    risks?: string[];
  };
}

interface FamilyOverviewCardProps {
  data: FamilyOverviewData;
  isLoading?: boolean;
  onRefresh?: () => void;
  onSelectMember?: (userId: string) => void;
  allocationHealth?: AllocationHealthData;
  onEditTargets?: () => void;
  onRequestAIAdvice?: () => void;
  canRequestAIAdvice?: boolean;
  onTransfer?: () => void;
  // ✨ 底层敞口详情数据（用于图例下拉展开）
  equityByRegion?: {
    total: number;
    count: number;
    byRegion: Array<{
      regionCode: string;
      regionName: string;
      value: number;
      percentage: number;
      count: number;
      color: string;
      holdings: Array<{
        symbol: string;
        name: string;
        marketValue: number;
        percentage: number;
      }>;
    }>;
  };
  groupsSubCategories?: Record<string, {
    groupCode: string;
    groupName: string;
    total: number;
    count: number;
    bySubCategory: Array<{
      categoryCode: string;
      categoryName: string;
      value: number;
      percentage: number;
      count: number;
      color: string;
      items: Array<{
        id: string;
        name: string;
        value: number;
        percentage: number;
      }>;
    }>;
  }>;
}

const roleLabels: Record<string, string> = {
  ADMIN: '管理员',
  MEMBER: '成员',
  VIEWER: '查看者',
};

const roleBadgeStyles: Record<string, string> = {
  ADMIN: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  MEMBER: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  VIEWER: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

// ==================== 辅助函数 ====================

function getDeviationStyle(status: 'NORMAL' | 'WARNING' | 'CRITICAL', deviation: number) {
  const isPositive = deviation > 0;
  let bgClass = 'bg-slate-100 dark:bg-slate-800';
  let textClass = 'text-slate-600 dark:text-slate-400';
  let barColor = '#94A3B8';
  let label = '正常';
  if (status === 'WARNING') {
    bgClass = 'bg-yellow-50 dark:bg-yellow-900/20';
    textClass = 'text-yellow-600 dark:text-yellow-400';
    barColor = '#EAB308';
    label = isPositive ? '超配' : '低配';
  }
  if (status === 'CRITICAL') {
    bgClass = 'bg-red-50 dark:bg-red-900/20';
    textClass = 'text-red-600 dark:text-red-400';
    barColor = '#EF4444';
    label = isPositive ? '严重超配' : '严重低配';
  }
  return { bgClass, textClass, barColor, label };
}

function formatMoney(value: number): string {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(2)}万`;
  }
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ==================== AI分析报告对话框 ====================

function AIReportDialog({ 
  open, onOpenChange, report, createdAt 
}: { 
  open: boolean; onOpenChange: (open: boolean) => void; report: string; createdAt?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            AI 分析报告
          </DialogTitle>
          <DialogDescription>
            {createdAt ? `生成时间：${new Date(createdAt).toLocaleString('zh-CN')}` : '基于您当前资产配置的智能分析'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto mt-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm bg-slate-50 dark:bg-slate-800 p-4 rounded-lg font-sans">
              {report}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== 配置偏离详情面板 ====================

function AllocationDetailPanel({ allocationHealth }: { allocationHealth: AllocationHealthData }) {
  const { fullAnalysis = [], alerts = [], scoreBreakdown, score, latestAdvice } = allocationHealth;
  const significantAlerts = alerts.filter(a => a.severity === 'HIGH' || a.severity === 'MEDIUM');
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const actionsByCategory: Record<string, Array<{
    priority: number;
    action: 'BUY' | 'SELL' | 'HOLD';
    amount?: number;
    reason: string;
    subCategory?: string;
    suggestedProducts?: string[];
  }>> = {};
  
  if (latestAdvice?.actions) {
    for (const action of latestAdvice.actions) {
      if (!actionsByCategory[action.category]) {
        actionsByCategory[action.category] = [];
      }
      actionsByCategory[action.category].push(action);
    }
  }

  return (
    <>
    <Card className="mt-3 border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <CardContent className="p-4">
        {/* 头部：评分 + AI报告按钮 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-14 h-14 rounded-xl ${
                (score || 0) >= 80 
                  ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                  : (score || 0) >= 60 
                    ? 'bg-yellow-100 dark:bg-yellow-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                <span className={`text-2xl font-bold ${
                  (score || 0) >= 80 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : (score || 0) >= 60 
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                }`}>
                  {score || 0}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">目标达成度</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {(score || 0) >= 80 ? '配置健康' : (score || 0) >= 60 ? '需要关注' : '建议调整'}
                </p>
              </div>
            </div>
            
            {scoreBreakdown && (
              <div className="hidden md:flex items-center gap-4 pl-4 border-l border-slate-200 dark:border-slate-700">
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{scoreBreakdown.deviationScore}<span className="text-xs text-slate-400">/40</span></p>
                  <p className="text-xs text-slate-500">偏离度</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{scoreBreakdown.diversityScore}<span className="text-xs text-slate-400">/20</span></p>
                  <p className="text-xs text-slate-500">多样性</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{scoreBreakdown.liquidityScore}<span className="text-xs text-slate-400">/20</span></p>
                  <p className="text-xs text-slate-500">流动性</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{scoreBreakdown.debtScore}<span className="text-xs text-slate-400">/20</span></p>
                  <p className="text-xs text-slate-500">负债</p>
                </div>
              </div>
            )}
          </div>
          
          {latestAdvice?.fullAnalysis && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReportDialogOpen(true)}
              className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/20"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">AI分析报告</span>
            </Button>
          )}
        </div>
        
        {/* 配置偏离进度条列表 */}
        <div className="space-y-3">
          {fullAnalysis.map((item) => {
            const style = getDeviationStyle(item.deviationStatus, item.deviation);
            const Icon = item.deviation > 0 ? TrendingUp : item.deviation < 0 ? TrendingDown : CheckCircle;
            const currentPos = Math.min(item.currentPercent, 100);
            const targetPos = Math.min(item.targetPercent, 100);
            
            return (
              <div key={item.categoryCode} className={`p-3 rounded-lg ${style.bgClass} transition-all`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{item.categoryName}</span>
                    {item.deviationStatus !== 'NORMAL' && (
                      <Badge variant="outline" className={`text-xs ${style.textClass} border-current`}>
                        {style.label}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${style.textClass}`} />
                    <span className={`font-semibold ${style.textClass}`}>
                      {item.deviation > 0 ? '+' : ''}{item.deviation.toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                <div className="relative h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="absolute h-full rounded-full transition-all duration-500"
                    style={{ width: `${currentPos}%`, backgroundColor: style.barColor }}
                  />
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-slate-800 dark:bg-white rounded-full z-10"
                    style={{ left: `calc(${targetPos}% - 2px)` }}
                  >
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      目标
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between mt-2 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-600 dark:text-slate-400">
                      当前 <span className="font-medium text-slate-800 dark:text-slate-200">{item.currentPercent.toFixed(1)}%</span>
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-600 dark:text-slate-400">
                      目标 <span className="font-medium text-slate-800 dark:text-slate-200">{item.targetPercent.toFixed(1)}%</span>
                    </span>
                  </div>
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatMoney(item.currentValue)}
                  </span>
                </div>
                
                {item.suggestedAction && item.suggestedAction !== 'HOLD' && item.suggestedAmount && item.suggestedAmount > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className={`text-xs ${
                      item.suggestedAction === 'BUY' ? 'text-emerald-600' :
                      item.suggestedAction === 'SELL' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      💡 建议{item.suggestedAction === 'BUY' ? '增配' : item.suggestedAction === 'SELL' ? '减配' : '再平衡'} {formatMoney(item.suggestedAmount)}
                    </span>
                    
                    {actionsByCategory[item.categoryCode] && actionsByCategory[item.categoryCode].length > 0 && (
                      <div className="mt-1">
                        {actionsByCategory[item.categoryCode].map((action, actionIndex) => (
                          <div key={actionIndex} className="flex flex-wrap items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                            <span className="text-blue-600 dark:text-blue-400">🎯 二级建议：</span>
                            {action.subCategory && (
                              <Badge variant="outline" className="text-xs py-0 h-5">{action.subCategory}</Badge>
                            )}
                            {action.suggestedProducts && action.suggestedProducts.length > 0 && (
                              <span className="text-slate-500">({action.suggestedProducts.join(', ')})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {(!item.suggestedAction || item.suggestedAction === 'HOLD' || !item.suggestedAmount || item.suggestedAmount <= 0) && 
                  actionsByCategory[item.categoryCode] && actionsByCategory[item.categoryCode].length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    {actionsByCategory[item.categoryCode].map((action, actionIndex) => (
                      <div key={actionIndex} className="flex flex-wrap items-center gap-1 text-xs">
                        <span className="text-blue-600 dark:text-blue-400">🎯 AI二级建议：</span>
                        <span className={`${
                          action.action === 'BUY' ? 'text-emerald-600' :
                          action.action === 'SELL' ? 'text-red-600' : 'text-slate-600'
                        }`}>
                          {action.action === 'BUY' ? '增配' : action.action === 'SELL' ? '减仓' : '维持'}
                        </span>
                        {action.subCategory && (
                          <Badge variant="outline" className="text-xs py-0 h-5">{action.subCategory}</Badge>
                        )}
                        {action.amount && action.amount > 0 && (
                          <span className="text-slate-500">{formatMoney(action.amount)}</span>
                        )}
                        {action.suggestedProducts && action.suggestedProducts.length > 0 && (
                          <span className="text-slate-500 dark:text-slate-400">建议: {action.suggestedProducts.join(', ')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* 告警信息 */}
        {significantAlerts.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              告警信息 ({significantAlerts.length})
            </h4>
            <div className="space-y-2">
              {significantAlerts.slice(0, 3).map((alert, index) => (
                <div 
                  key={index}
                  className={`p-2 rounded-lg text-sm flex items-start gap-2 ${
                    alert.severity === 'HIGH' 
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                      : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                  }`}
                >
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    
    {latestAdvice?.fullAnalysis && (
      <AIReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        report={latestAdvice.fullAnalysis}
        createdAt={latestAdvice.createdAt}
      />
    )}
    </>
  );
}

export function FamilyOverviewCard({ data, isLoading = false, onRefresh, onSelectMember, allocationHealth, onEditTargets, onRequestAIAdvice, onTransfer, equityByRegion, groupsSubCategories }: FamilyOverviewCardProps) {
  const preferences = useUserPreferences();
  const [isVisible, setIsVisible] = useState(true);
  const [allocationDetailExpanded, setAllocationDetailExpanded] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // ✨ 概览分组配置（与 HeroSection 一致）
  const overviewGroupConfig: Record<string, { icon: React.ReactNode; defaultColor: string; label: string }> = {
    EQUITY: { icon: <TrendingUp className="h-4 w-4" />, defaultColor: '#3B82F6', label: '权益类投资' },
    FIXED_INCOME: { icon: <Wallet className="h-4 w-4" />, defaultColor: '#10B981', label: '固定收益' },
    CASH: { icon: <PiggyBank className="h-4 w-4" />, defaultColor: '#6366F1', label: '现金及现金等价物' },
    REAL_ESTATE: { icon: <Target className="h-4 w-4" />, defaultColor: '#06B6D4', label: '不动产类' },
    ALTERNATIVE: { icon: <PieChart className="h-4 w-4" />, defaultColor: '#F59E0B', label: '另类投资' },
    RECEIVABLE: { icon: <Receipt className="h-4 w-4" />, defaultColor: '#0EA5E9', label: '应收款' },
    OTHER: { icon: <Info className="h-4 w-4" />, defaultColor: '#94A3B8', label: '其他' },
  };

  const [animatedValues, setAnimatedValues] = useState({
    totalAssets: 0,
    netWorth: 0,
    todayPnl: 0,
    totalPnl: 0,
  });

  // 数字动画效果（与 HeroSection 保持一致）
  useEffect(() => {
    const duration = 800;
    const steps = 40;
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      setAnimatedValues({
        totalAssets: data.totalAssets * easeOutQuart,
        netWorth: data.netWorth * easeOutQuart,
        todayPnl: data.todayPnl * easeOutQuart,
        totalPnl: data.totalUnrealizedPnl * easeOutQuart,
      });
      
      if (currentStep >= steps) {
        clearInterval(timer);
        setAnimatedValues({
          totalAssets: data.totalAssets,
          netWorth: data.netWorth,
          todayPnl: data.todayPnl,
          totalPnl: data.totalUnrealizedPnl,
        });
      }
    }, stepDuration);
    
    return () => clearInterval(timer);
  }, [data]);

  const formatCurrency = (amount: number) => {
    if (!isVisible) return '****';
    return `¥${amount.toLocaleString('zh-CN', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    })}`;
  };

  const formatCurrencyPrecise = (amount: number) => {
    if (!isVisible) return '****';
    return `¥${amount.toLocaleString('zh-CN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const formatPercent = (percent: number) => {
    if (!isVisible) return '**%';
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  return (
    <div className="space-y-4">
      {/* 主卡片 - 与 HeroSection 一致的深蓝渐变背景 */}
      <Card className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white border-0 shadow-2xl overflow-hidden relative">
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -left-20 -bottom-20 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl" />
        
        <CardContent className="p-6 relative z-10">
          {/* 控制栏 */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white/80 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              {data.familyName}
              <Badge variant="outline" className="text-[10px] px-1.5 border-white/20 text-white/60 font-normal">
                {data.memberCount} 名成员
              </Badge>
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsVisible(!isVisible)}
                className="h-8 text-white/80 hover:text-white hover:bg-white/10"
              >
                {isVisible ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>
              {onRefresh && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="h-8 text-white/80 hover:text-white hover:bg-white/10"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              )}
              {onTransfer && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onTransfer}
                        className="h-8 text-white/80 hover:text-white hover:bg-white/10"
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>家庭资产转移</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* 主指标网格 - 与 HeroSection 一致的4列布局 */}
          <TooltipProvider delayDuration={200}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {/* 家庭总资产 */}
              <div className="col-span-2 lg:col-span-1">
                <div className="text-sm text-white/60 mb-1 flex items-center gap-1">
                  总资产
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-white/40 hover:text-white/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">家庭总资产</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          所有家庭成员的资产总和，包含证券、现金、不动产等
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                  {formatCurrency(animatedValues.totalAssets)}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {data.todayPnlPercent >= 0 ? (
                    <TrendingUp className={`h-3 w-3 ${getPnLColorClassOnDark(1, preferences.colorScheme)}`} />
                  ) : (
                    <TrendingDown className={`h-3 w-3 ${getPnLColorClassOnDark(-1, preferences.colorScheme)}`} />
                  )}
                  <span className={`text-xs ${getPnLColorClassOnDark(data.todayPnlPercent, preferences.colorScheme)}`}>
                    今日 {formatPercent(data.todayPnlPercent)}
                  </span>
                </div>
              </div>

              {/* 今日盈亏 */}
              <div>
                <div className="text-sm text-white/60 mb-1 flex items-center gap-1">
                  今日盈亏
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-white/40 hover:text-white/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        家庭所有成员今日收益总和
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={`text-lg sm:text-xl lg:text-2xl font-bold ${getPnLColorClassOnDark(data.todayPnl, preferences.colorScheme)}`}>
                  {data.todayPnl >= 0 ? '+' : ''}{formatCurrencyPrecise(animatedValues.todayPnl)}
                </div>
                <div className={`text-xs sm:text-sm font-medium ${getPnLColorClassOnDark(data.todayPnlPercent, preferences.colorScheme)}`}>
                  {formatPercent(data.todayPnlPercent)}
                </div>
              </div>

              {/* 累计盈亏 */}
              <div>
                <div className="text-sm text-white/60 mb-1 flex items-center gap-1">
                  累计盈亏
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-white/40 hover:text-white/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        家庭所有成员未实现盈亏总和
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={`text-lg sm:text-xl lg:text-2xl font-bold ${getPnLColorClassOnDark(data.totalUnrealizedPnl, preferences.colorScheme)}`}>
                  {data.totalUnrealizedPnl >= 0 ? '+' : ''}{formatCurrencyPrecise(animatedValues.totalPnl)}
                </div>
                <div className={`text-xs sm:text-sm font-medium ${getPnLColorClassOnDark(data.totalUnrealizedPnlPercent, preferences.colorScheme)}`}>
                  {formatPercent(data.totalUnrealizedPnlPercent)}
                </div>
              </div>

              {/* 家庭净资产 */}
              <div>
                <div className="text-sm text-white/60 mb-1 flex items-center gap-1">
                  净资产
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-white/40 hover:text-white/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">家庭净资产</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          净资产 = 家庭总资产 - 家庭总负债
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold">
                  {formatCurrency(animatedValues.netWorth)}
                </div>
                {data.totalLiabilities > 0 ? (
                  <div className="text-xs text-white/50">
                    负债 {formatCurrency(data.totalLiabilities)}
                  </div>
                ) : (
                  <div className="text-xs text-white/50">
                    无负债
                  </div>
                )}
              </div>
            </div>
          </TooltipProvider>

          {/* 资产分布条 - 与 HeroSection 一致的样式，支持点击展开 */}
          {data.assetDistribution.length > 0 && (
            <div className="mt-6 pt-4 border-t border-white/20">
              <div className="flex h-3 rounded-full overflow-hidden bg-white/20">
                {data.assetDistribution.map((item) => (
                  <div
                    key={item.category}
                    className="transition-all duration-500 cursor-pointer hover:opacity-80"
                    style={{ width: `${item.percentage}%`, backgroundColor: item.color || '#94A3B8' }}
                    title={`${item.categoryName}: ${item.percentage.toFixed(1)}%`}
                    onClick={() => setExpandedGroup(expandedGroup === item.category ? null : item.category)}
                  />
                ))}
              </div>
              {/* 图例 - 带金额、百分比和下拉箭头，支持点击展开详情 */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs sm:text-sm">
                {data.assetDistribution.map((item) => {
                  const color = item.color || '#94A3B8';
                  const config = overviewGroupConfig[item.category];
                  const isExpanded = expandedGroup === item.category;
                  return (
                    <button
                      key={item.category}
                      onClick={() => setExpandedGroup(isExpanded ? null : item.category)}
                      className="flex items-center gap-1.5 sm:gap-2 hover:text-white/80 cursor-pointer transition-colors group"
                    >
                      <div 
                        className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded flex items-center justify-center text-white flex-shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {config?.icon || <div className="h-2 w-2 rounded-full bg-white" />}
                      </div>
                      <span className="hidden sm:inline">
                        {item.categoryName} {isVisible ? `¥${item.value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '****'} ({item.percentage.toFixed(1)}%)
                      </span>
                      <span className="sm:hidden">
                        <span className="text-white/90">{item.categoryName}</span>
                        <span className="text-white/60 ml-1">{item.percentage.toFixed(1)}%</span>
                      </span>
                      <span className={`flex items-center justify-center h-5 w-5 rounded-full transition-colors ${
                        isExpanded ? 'bg-white/30' : 'bg-white/10 group-hover:bg-white/20'
                      }`}>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 成员资产占比 */}
          {data.memberBreakdown.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs text-white/40 mb-2 flex items-center gap-1">
                <Wallet className="h-3 w-3" />
                成员资产占比
              </p>
              <div className="space-y-1.5">
                {data.memberBreakdown.map((member) => (
                  <div
                    key={member.userId}
                    className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${
                      onSelectMember ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''
                    }`}
                    onClick={() => onSelectMember?.(member.userId)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex items-center justify-center">
                        <span className="text-[10px] text-white font-medium">
                          {member.userName.charAt(0)}
                        </span>
                      </div>
                      <span className="text-sm text-white/80">
                        {isVisible ? member.userName : '***'}
                      </span>
                      <Badge className={`text-[10px] px-1.5 border ${roleBadgeStyles[member.role] || roleBadgeStyles.MEMBER}`}>
                        {roleLabels[member.role] || member.role}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white/90">
                        {isVisible ? formatCurrencyPrecise(member.totalAssets) : '****'}
                      </p>
                      <p className="text-[10px] text-white/40">
                        {member.percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 资产配置分析模块 - 家庭视角主阵地（可展开详情） */}
          {allocationHealth?.score !== undefined ? (
            <Collapsible 
              open={allocationDetailExpanded} 
              onOpenChange={setAllocationDetailExpanded}
              className="mt-4 pt-4 border-t border-white/20"
            >
              <div className="p-3 bg-white/10 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  {/* 左侧：目标达成度信息 */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-white/80" />
                      <span className="text-sm text-white/70">目标达成度</span>
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-bold ${
                        allocationHealth.score >= 80 
                          ? 'bg-emerald-500/30 text-emerald-300' 
                          : allocationHealth.score >= 60 
                            ? 'bg-yellow-500/30 text-yellow-300'
                            : 'bg-red-500/30 text-red-300'
                      }`}>
                        {allocationHealth.score >= 80 ? (
                          <CheckCircle className="h-3.5 w-3.5" />
                        ) : allocationHealth.score >= 60 ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5" />
                        )}
                        <span>{allocationHealth.score}分</span>
                      </div>
                    </div>
                    
                    <div className="hidden sm:block h-4 w-px bg-white/20" />
                    
                    {allocationHealth.topDeviation && allocationHealth.topDeviation.status !== 'NORMAL' && (
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${
                          allocationHealth.topDeviation.status === 'CRITICAL' 
                            ? 'text-red-300' 
                            : 'text-yellow-300'
                        }`}>
                          {allocationHealth.topDeviation.deviation > 0 ? (
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">{allocationHealth.topDeviation.category} 超配 </span>
                              <span>+{allocationHealth.topDeviation.deviation.toFixed(0)}%</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <TrendingDown className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">{allocationHealth.topDeviation.category} 低配 </span>
                              <span>{allocationHealth.topDeviation.deviation.toFixed(0)}%</span>
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    
                    {allocationHealth.alertCount !== undefined && allocationHealth.alertCount > 0 && (
                      <>
                        <div className="hidden sm:block h-4 w-px bg-white/20" />
                        <span className="text-sm text-orange-300">
                          {allocationHealth.alertCount} 项告警
                        </span>
                      </>
                    )}
                  </div>
                  
                  {/* 右侧：操作按钮 */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                    {/* 展开/收起详情按钮 */}
                    <CollapsibleTrigger asChild>
                      <button 
                        className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                          allocationDetailExpanded
                            ? 'bg-white/30 text-white hover:bg-white/40'
                            : 'bg-white/15 text-white/90 hover:bg-white/25 hover:text-white'
                        }`}
                      >
                        {allocationDetailExpanded ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span>收起</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span>详情</span>
                          </>
                        )}
                      </button>
                    </CollapsibleTrigger>
                    
                    {onEditTargets && (
                      <button 
                        onClick={onEditTargets}
                        className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-blue-500/80 to-purple-500/80 hover:from-blue-500 hover:to-purple-500 rounded-lg transition-colors whitespace-nowrap shadow-md"
                      >
                        <span>调整配置</span>
                        <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* 展开的配置偏离详情面板 */}
              <CollapsibleContent className="animate-in slide-in-from-top-2 duration-200">
                <AllocationDetailPanel allocationHealth={allocationHealth} />
              </CollapsibleContent>
            </Collapsible>
          ) : (
            /* 未设置配置目标时显示引导入口 */
            onEditTargets && (
              <div className="mt-4 pt-4 border-t border-white/20">
                <button 
                  onClick={onEditTargets}
                  className="block w-full text-left"
                >
                  <div className="flex items-center justify-between p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <PieChart className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-white">设置家庭配置目标</div>
                        <div className="text-xs text-white/60">以终为始，设定目标、分析偏离、获取AI建议</div>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* ✨ 图例展开详情区域 - 与 HeroSection 一致的下拉面板 */}
      {expandedGroup && (() => {
        const groupConfig = overviewGroupConfig[expandedGroup];
        const groupColor = groupConfig?.defaultColor || '#94A3B8';
        const groupDistItem = data.assetDistribution.find(d => d.category === expandedGroup);

        // 权益类：显示按地区细分
        if (expandedGroup === 'EQUITY' && equityByRegion && equityByRegion.byRegion.length > 0) {
          return (
            <Card 
              className="shadow-lg animate-in slide-in-from-top-2 duration-200"
              style={{ 
                background: `linear-gradient(to right, ${groupColor}15, ${groupColor}05)`,
                borderColor: groupColor,
                borderWidth: '1px'
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div 
                    className="h-6 w-6 rounded flex items-center justify-center text-white"
                    style={{ backgroundColor: groupColor }}
                  >
                    {groupConfig?.icon}
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    权益类 按地区细分
                  </h3>
                  <span className="text-xs text-slate-500">
                    ({equityByRegion.byRegion.length} 个地区 · {equityByRegion.count} 项资产)
                  </span>
                  <div className="ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedGroup(null)}
                      className="h-6 w-6 p-0"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {equityByRegion.byRegion.map((region) => (
                    <div
                      key={region.regionCode}
                      className="p-3 bg-white dark:bg-slate-800 rounded-lg border hover:shadow-md transition-all"
                      style={{ borderColor: `${region.color}40` }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: region.color }} />
                          <h4 className="font-medium text-slate-800 dark:text-slate-200 text-sm">{region.regionName}</h4>
                        </div>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {region.count} 项
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-lg font-bold" style={{ color: region.color }}>
                          {formatMoney(region.value)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          占权益类 {region.percentage.toFixed(1)}%
                        </p>
                        {region.holdings.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                            <div className="space-y-1">
                              {region.holdings.slice(0, 3).map((holding, index) => (
                                <div key={`${region.regionCode}-${holding.symbol}-${index}`} className="flex justify-between text-xs">
                                  <span className="text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{holding.name}</span>
                                  <span className="text-slate-800 dark:text-slate-200 font-medium">{formatMoney(holding.marketValue)}</span>
                                </div>
                              ))}
                              {region.holdings.length > 3 && (
                                <p className="text-xs text-slate-400 text-center">+{region.holdings.length - 3} 更多</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        }

        // 其他分组：显示二级分类细分
        const subCategoryData = groupsSubCategories?.[expandedGroup];
        if (subCategoryData && subCategoryData.bySubCategory.length > 0) {
          return (
            <Card 
              className="shadow-lg animate-in slide-in-from-top-2 duration-200"
              style={{ 
                background: `linear-gradient(to right, ${groupColor}15, ${groupColor}05)`,
                borderColor: groupColor,
                borderWidth: '1px'
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div 
                    className="h-6 w-6 rounded flex items-center justify-center text-white"
                    style={{ backgroundColor: groupColor }}
                  >
                    {groupConfig?.icon}
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    {subCategoryData.groupName} 细分
                  </h3>
                  <span className="text-xs text-slate-500">
                    ({subCategoryData.bySubCategory.length} 个类别 · {subCategoryData.count} 项资产)
                  </span>
                  <div className="ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedGroup(null)}
                      className="h-6 w-6 p-0"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {subCategoryData.bySubCategory.map((category) => (
                    <div
                      key={category.categoryCode}
                      className="p-3 bg-white dark:bg-slate-800 rounded-lg border hover:shadow-md transition-all"
                      style={{ borderColor: `${category.color}40` }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
                          <h4 className="font-medium text-slate-800 dark:text-slate-200 text-sm">{category.categoryName}</h4>
                        </div>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {category.count} 项
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-lg font-bold" style={{ color: category.color }}>
                          {formatMoney(category.value)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          占{subCategoryData.groupName} {category.percentage.toFixed(1)}%
                        </p>
                        {category.items.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                            <div className="space-y-1">
                              {category.items.slice(0, 3).map((item, index) => (
                                <div key={`${category.categoryCode}-${item.id}-${index}`} className="flex justify-between text-xs">
                                  <span className="text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{item.name}</span>
                                  <span className="text-slate-800 dark:text-slate-200 font-medium">{formatMoney(item.value)}</span>
                                </div>
                              ))}
                              {category.items.length > 3 && (
                                <p className="text-xs text-slate-400 text-center">+{category.items.length - 3} 更多</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        }

        // 降级：无详情数据时显示简单提示
        if (groupDistItem) {
          return (
            <Card 
              className="shadow-lg animate-in slide-in-from-top-2 duration-200"
              style={{ 
                background: `linear-gradient(to right, ${groupColor}15, ${groupColor}05)`,
                borderColor: groupColor,
                borderWidth: '1px'
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="h-6 w-6 rounded flex items-center justify-center text-white"
                    style={{ backgroundColor: groupColor }}
                  >
                    {groupConfig?.icon}
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    {groupDistItem.categoryName}
                  </h3>
                  <span className="text-sm text-slate-500 ml-2">
                    {formatMoney(groupDistItem.value)} · 占比 {groupDistItem.percentage.toFixed(1)}%
                  </span>
                  <div className="ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedGroup(null)}
                      className="h-6 w-6 p-0"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }

        return null;
      })()}
    </div>
  );
}
