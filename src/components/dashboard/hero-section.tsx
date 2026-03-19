'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Eye,
  EyeOff,
  RefreshCw,
  Wallet,
  PiggyBank,
  Target,
  ChevronDown,
  ChevronUp,
  PieChart,
  ArrowRight,
  Info,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  X,
  FileText,
  Receipt,
  Users
} from 'lucide-react';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { getPnLColorClass, getPnLColorClassOnDark } from '@/lib/user-preferences';

interface HeroSectionData {
  totalAssets: number;
  netWorth: number;
  totalLiabilities?: number;  // ✅ Phase 1.2: 总负债
  cashBalance: number;        // 流动现金（证券账户现金+活期存款）
  investedAmount: number;     // 证券持仓市值
  totalCashAssets?: number;   // ✅ 现金资产总值（活期+定期+货币基金）
  totalOtherAssets?: number;  // ✅ 其他资产总值（不动产、贵金属等）
  todayChange: number;
  todayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
}

interface AssetTypeDistribution {
  type: string;       // 分类代码 (EQUITY, CASH, FIXED_INCOME, REAL_ESTATE, ALTERNATIVE)
  typeName: string;   // 分类名称
  value: number;      // 金额
  percentage: number; // 百分比
  count: number;      // 项目数量
  color: string;      // 颜色
}

// ✨ Phase 2: 底层敞口分布数据
interface UnderlyingTypeDistribution {
  code: string;       // 底层敞口代码 (EQUITY, BOND, GOLD, CASH 等)
  name: string;       // 显示名称
  value: number;      // 金额（CNY）
  percentage: number; // 占比
  count: number;      // 项目数量
  color: string;      // 颜色
  includeInNetWorth: boolean; // 是否计入净资产
  details?: {
    holdings: number;     // 证券持仓金额
    cashAssets: number;   // 现金资产金额
    otherAssets: number;  // 其他资产金额
  };
}

// ✨ Phase 2: 底层敞口的概览分组
interface OverviewGroupDistribution {
  code: string;       // 分组代码 (EQUITY, FIXED_INCOME, CASH, REAL_ESTATE, ALTERNATIVE, OTHER)
  name: string;       // 显示名称
  value: number;      // 金额（CNY）
  percentage: number; // 占比
  count: number;      // 项目数量
  color: string;      // 颜色
  includeInNetWorth: boolean;
  details?: {
    holdings: number;
    cashAssets: number;
    otherAssets: number;
  };
}

interface AccountCash {
  id: string;
  name: string;
  broker: string;
  currency: string;
  cashBalance: number;
  cashBalanceOriginal: number;
}

// ✨ 目标配置健康度数据
interface AllocationHealthData {
  score?: number;  // 综合健康度评分 0-100
  topDeviation?: {
    category: string;
    deviation: number;  // 正数=超配，负数=低配
    status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  };
  alertCount?: number;  // 告警数量
  // ✨ 完整偏离数据（用于展开详情）
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
  // ✨ 新增：最近AI建议（包含二级资产建议和详细报告）
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

interface HeroSectionProps {
  data: HeroSectionData;
  accounts?: AccountCash[];
  assetTypeDistribution?: AssetTypeDistribution[];  // 旧版：按资产类型的分布数据
  // ✨ Phase 2: 底层敞口数据
  underlyingTypeDistribution?: {
    byUnderlyingType: UnderlyingTypeDistribution[];  // 细化的底层敞口
    byOverviewGroup: OverviewGroupDistribution[];    // 聚合的概览分组
    // ✨ Phase 2.1: 权益类按地区细分
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
    // ✨ Phase 2.2: 各资产分组的二级分类细分
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
  };
  // ✨ 目标配置健康度数据
  allocationHealth?: AllocationHealthData;
  isLoading?: boolean;
  onRefresh?: () => void;
  onEditTargets?: () => void;  // 打开编辑配置目标对话框
  onViewAllocationDetail?: () => void;  // 查看配置分析详情（弃用，改用展开）
  onRequestAIAdvice?: () => void;  // 请求AI建议
  hasFamilyId?: boolean;  // 是否有家庭（用于引导切换家庭视角）
  onSwitchToFamily?: () => void;  // 切换到家庭视角
}

// ==================== 配置偏离详情面板组件 ====================

interface AllocationDetailPanelProps {
  allocationHealth: AllocationHealthData;
}

// 获取偏离状态样式
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

// 格式化金额
function formatMoney(value: number): string {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(2)}万`;
  }
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ✨ AI分析报告对话框组件
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function AIReportDialog({ 
  open, 
  onOpenChange, 
  report, 
  createdAt 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  report: string;
  createdAt?: string;
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

function AllocationDetailPanel({ 
  allocationHealth 
}: AllocationDetailPanelProps) {
  const { fullAnalysis = [], alerts = [], scoreBreakdown, score, latestAdvice } = allocationHealth;
  
  // 过滤有意义的告警（中高优先级）
  const significantAlerts = alerts.filter(a => a.severity === 'HIGH' || a.severity === 'MEDIUM');
  
  // ✨ 报告对话框状态
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  
  // ✨ 按一级资产分类整理AI建议的actions
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
      const categoryCode = action.category;
      if (!actionsByCategory[categoryCode]) {
        actionsByCategory[categoryCode] = [];
      }
      actionsByCategory[categoryCode].push(action);
    }
  }
  
  return (
    <>
    <Card className="mt-3 border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <CardContent className="p-4">
        {/* 头部：评分 + 操作按钮 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {/* 综合评分 */}
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
            
            {/* 评分细分 */}
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
          
          {/* ✨ 新增：查看AI分析报告按钮 */}
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
            
            // 计算进度条位置
            const currentPos = Math.min(item.currentPercent, 100);
            const targetPos = Math.min(item.targetPercent, 100);
            
            return (
              <div 
                key={item.categoryCode}
                className={`p-3 rounded-lg ${style.bgClass} transition-all`}
              >
                {/* 标题行 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{item.categoryName}</span>
                    {item.deviationStatus !== 'NORMAL' && (
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${style.textClass} border-current`}
                      >
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
                
                {/* 进度条 */}
                <div className="relative h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  {/* 当前配置（彩色填充） */}
                  <div 
                    className="absolute h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${currentPos}%`,
                      backgroundColor: style.barColor
                    }}
                  />
                  {/* 目标位置标记线 */}
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-slate-800 dark:bg-white rounded-full z-10"
                    style={{ left: `calc(${targetPos}% - 2px)` }}
                  >
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      目标
                    </div>
                  </div>
                </div>
                
                {/* 数值标签 */}
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
                
                {/* 建议操作（如果有） */}
                {item.suggestedAction && item.suggestedAction !== 'HOLD' && item.suggestedAmount && item.suggestedAmount > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className={`text-xs ${
                      item.suggestedAction === 'BUY' ? 'text-emerald-600' :
                      item.suggestedAction === 'SELL' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      💡 建议{item.suggestedAction === 'BUY' ? '增配' : item.suggestedAction === 'SELL' ? '减配' : '再平衡'} {formatMoney(item.suggestedAmount)}
                    </span>
                    
                    {/* ✨ 新增：二级资产建议（来自AI） */}
                    {actionsByCategory[item.categoryCode] && actionsByCategory[item.categoryCode].length > 0 && (
                      <div className="mt-1">
                        {actionsByCategory[item.categoryCode].map((action, actionIndex) => (
                          <div key={actionIndex} className="flex flex-wrap items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                            <span className="text-blue-600 dark:text-blue-400">
                              🎯 二级建议：
                            </span>
                            {action.subCategory && (
                              <Badge variant="outline" className="text-xs py-0 h-5">
                                {action.subCategory}
                              </Badge>
                            )}
                            {action.suggestedProducts && action.suggestedProducts.length > 0 && (
                              <span className="text-slate-500">
                                ({action.suggestedProducts.join(', ')})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* ✨ 即使没有建议操作，也显示二级资产建议（如果有） */}
                {(!item.suggestedAction || item.suggestedAction === 'HOLD' || !item.suggestedAmount || item.suggestedAmount <= 0) && 
                  actionsByCategory[item.categoryCode] && actionsByCategory[item.categoryCode].length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    {actionsByCategory[item.categoryCode].map((action, actionIndex) => (
                      <div key={actionIndex} className="flex flex-wrap items-center gap-1 text-xs">
                        <span className="text-blue-600 dark:text-blue-400">
                          🎯 AI二级建议：
                        </span>
                        <span className={`${
                          action.action === 'BUY' ? 'text-emerald-600' :
                          action.action === 'SELL' ? 'text-red-600' : 'text-slate-600'
                        }`}>
                          {action.action === 'BUY' ? '增配' : action.action === 'SELL' ? '减仓' : '维持'}
                        </span>
                        {action.subCategory && (
                          <Badge variant="outline" className="text-xs py-0 h-5">
                            {action.subCategory}
                          </Badge>
                        )}
                        {action.amount && action.amount > 0 && (
                          <span className="text-slate-500">
                            {formatMoney(action.amount)}
                          </span>
                        )}
                        {action.suggestedProducts && action.suggestedProducts.length > 0 && (
                          <span className="text-slate-500 dark:text-slate-400">
                            建议: {action.suggestedProducts.join(', ')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* 告警信息（如果有） */}
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
    
    {/* ✨ AI分析报告对话框 */}
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

// ==================== 主组件 ====================

/**
 * 核心指标区 - Hero Section
 * 设计目标：3秒内获取资产全貌
 * 
 * 布局：
 * - 总资产（超大字体 + 迷你趋势）
 * - 今日收益 + 累计收益 + 净资产
 * - 资产构成条（现金/持仓比例）
 */
export function HeroSection({ 
  data, 
  accounts = [], 
  assetTypeDistribution = [], 
  underlyingTypeDistribution,
  allocationHealth,
  isLoading = false, 
  onRefresh,
  onEditTargets,
  onViewAllocationDetail,
  onRequestAIAdvice,
  hasFamilyId = false,
  onSwitchToFamily,
}: HeroSectionProps) {
  const preferences = useUserPreferences();
  const [isVisible, setIsVisible] = useState(true);
  const [showCashDetail, setShowCashDetail] = useState(false);
  // ✨ Phase 2: 展开的底层敞口分组
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  // ✨ 配置分析详情展开状态
  const [allocationDetailExpanded, setAllocationDetailExpanded] = useState(false);
  const [animatedValues, setAnimatedValues] = useState({
    totalAssets: 0,
    netWorth: 0,
    todayChange: 0,
    totalReturn: 0,
  });

  // 资产类型图标和颜色配置 - 专业协调的配色方案
  const assetTypeConfig: Record<string, { icon: React.ReactNode; defaultColor: string }> = {
    EQUITY: { icon: <TrendingUp className="h-4 w-4" />, defaultColor: '#60A5FA' },       // 蓝色系 - 权益类
    CASH: { icon: <PiggyBank className="h-4 w-4" />, defaultColor: '#34D399' },          // 绿色系 - 现金类
    FIXED_INCOME: { icon: <Wallet className="h-4 w-4" />, defaultColor: '#A78BFA' },     // 紫色系 - 固定收益
    REAL_ESTATE: { icon: <Target className="h-4 w-4" />, defaultColor: '#F9A8D4' },      // 粉色系 - 不动产
    ALTERNATIVE: { icon: <PieChart className="h-4 w-4" />, defaultColor: '#FBBF24' },    // 金色系 - 另类投资
    RECEIVABLE: { icon: <Receipt className="h-4 w-4" />, defaultColor: '#0EA5E9' },     // 天蓝色 - 应收款
  };

  // ✨ Phase 2: 底层敞口概览分组的图标配置
  const overviewGroupConfig: Record<string, { icon: React.ReactNode; defaultColor: string; label: string }> = {
    EQUITY: { icon: <TrendingUp className="h-4 w-4" />, defaultColor: '#3B82F6', label: '权益类投资' },
    FIXED_INCOME: { icon: <Wallet className="h-4 w-4" />, defaultColor: '#10B981', label: '固定收益' },
    CASH: { icon: <PiggyBank className="h-4 w-4" />, defaultColor: '#6366F1', label: '现金及现金等价物' },
    REAL_ESTATE: { icon: <Target className="h-4 w-4" />, defaultColor: '#06B6D4', label: '不动产类' },
    ALTERNATIVE: { icon: <PieChart className="h-4 w-4" />, defaultColor: '#F59E0B', label: '另类投资' },
    RECEIVABLE: { icon: <Receipt className="h-4 w-4" />, defaultColor: '#0EA5E9', label: '应收款' },
    OTHER: { icon: <Info className="h-4 w-4" />, defaultColor: '#94A3B8', label: '其他' },
  };

  // 数字动画效果
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
        todayChange: data.todayChange * easeOutQuart,
        totalReturn: data.totalReturn * easeOutQuart,
      });
      
      if (currentStep >= steps) {
        clearInterval(timer);
        setAnimatedValues({
          totalAssets: data.totalAssets,
          netWorth: data.netWorth,
          todayChange: data.todayChange,
          totalReturn: data.totalReturn,
        });
      }
    }, stepDuration);
    
    return () => clearInterval(timer);
  }, [data]);

  const formatCurrency = (amount: number, currency: string = 'CNY') => {
    if (!isVisible) return '****';
    const symbol = currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : '¥';
    return `${symbol}${amount.toLocaleString('zh-CN', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    })}`;
  };

  const formatCurrencyPrecise = (amount: number, currency: string = 'CNY') => {
    if (!isVisible) return '****';
    const symbol = currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : '¥';
    return `${symbol}${amount.toLocaleString('zh-CN', { 
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
      {/* 主卡片 - 专业深蓝渐变背景 */}
      <Card className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white border-0 shadow-2xl overflow-hidden relative">
        {/* 背景装饰 - 柔和的蓝色光晕 */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -left-20 -bottom-20 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl" />
        
        <CardContent className="p-6 relative z-10">
          {/* 控制栏 */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white/80">资产概览</h2>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-8 text-white/80 hover:text-white hover:bg-white/10"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* 主指标网格 */}
          <TooltipProvider delayDuration={200}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {/* 总资产 - 最大权重 */}
              <div className="col-span-2 lg:col-span-1">
                <div className="text-sm text-white/60 mb-1 flex items-center gap-1">
                  总资产
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-white/40 hover:text-white/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">计算公式</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          总资产 = 证券持仓市值 + 证券账户现金 + 现金资产（存款/理财）+ 其他资产（不动产/贵金属）
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          所有外币资产已按实时汇率换算为人民币
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                  {formatCurrency(animatedValues.totalAssets)}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {data.todayChangePercent >= 0 ? (
                    <TrendingUp className={`h-3 w-3 ${getPnLColorClassOnDark(1, preferences.colorScheme)}`} />
                  ) : (
                    <TrendingDown className={`h-3 w-3 ${getPnLColorClassOnDark(-1, preferences.colorScheme)}`} />
                  )}
                  <span className={`text-xs ${getPnLColorClassOnDark(data.todayChangePercent, preferences.colorScheme)}`}>
                    今日 {formatPercent(data.todayChangePercent)}
                  </span>
                </div>
              </div>

              {/* 今日收益 */}
              <div>
                <div className="text-sm text-white/60 mb-1 flex items-center gap-1">
                  今日收益
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-white/40 hover:text-white/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">计算公式</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          今日收益 = 今日总资产 - 昨日总资产（快照）
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          今日收益率 = 今日收益 ÷ 昨日总资产 × 100%
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          注：基于历史快照对比，包含全量家庭资产
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={`text-lg sm:text-xl lg:text-2xl font-bold ${getPnLColorClassOnDark(data.todayChange, preferences.colorScheme)}`}>
                  {data.todayChange >= 0 ? '+' : ''}{formatCurrencyPrecise(animatedValues.todayChange)}
                </div>
                <div className={`text-xs sm:text-sm font-medium ${getPnLColorClassOnDark(data.todayChangePercent, preferences.colorScheme)}`}>
                  {formatPercent(data.todayChangePercent)}
                </div>
              </div>

              {/* 累计收益 */}
              <div>
                <div className="text-sm text-white/60 mb-1 flex items-center gap-1">
                  累计收益
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-white/40 hover:text-white/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">计算公式</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          累计收益 = 证券收益 + 现金收益（利息）+ 其他资产收益
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          • 证券收益 = Σ(现价 - 成本) × 持仓数量 × 汇率
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          • 现金收益 = 定期利息 + 货币基金收益
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          • 其他资产收益 = 当前估值 - 购买成本
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          收益率 = 累计收益 ÷ 总成本 × 100%
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={`text-lg sm:text-xl lg:text-2xl font-bold ${getPnLColorClassOnDark(data.totalReturn, preferences.colorScheme)}`}>
                  {data.totalReturn >= 0 ? '+' : ''}{formatCurrencyPrecise(animatedValues.totalReturn)}
                </div>
                <div className={`text-xs sm:text-sm font-medium ${getPnLColorClassOnDark(data.totalReturnPercent, preferences.colorScheme)}`}>
                  {formatPercent(data.totalReturnPercent)}
                </div>
              </div>

              {/* 净资产 */}
              <div>
                <div className="text-sm text-white/60 mb-1 flex items-center gap-1">
                  净资产
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-white/40 hover:text-white/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">计算公式</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          净资产 = 总资产 - 总负债
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          • 总资产包含：证券、现金、不动产、贵金属等
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          • 负债包含：房贷、车贷、消费贷等
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold">
                  {formatCurrency(animatedValues.netWorth)}
                </div>
                {/* ✅ Phase 1.2: 显示实际负债金额 */}
                {(data.totalLiabilities ?? 0) > 0 ? (
                  <div className="text-xs text-white/50">
                    负债 {formatCurrency(data.totalLiabilities ?? 0)}
                  </div>
                ) : (
                  <div className="text-xs text-white/50">
                    无负债
                  </div>
                )}
              </div>
            </div>
          </TooltipProvider>

          {/* ✨ Phase 2: 资产构成条 - 使用底层敞口数据 */}
          <div className="mt-6 pt-4 border-t border-white/20">
            {/* 进度条 */}
            <div className="flex h-3 rounded-full overflow-hidden bg-white/20">
              {underlyingTypeDistribution?.byOverviewGroup && underlyingTypeDistribution.byOverviewGroup.length > 0 ? (
                // ✨ Phase 2: 使用底层敞口的概览分组数据
                underlyingTypeDistribution.byOverviewGroup.map((item) => (
                  <div 
                    key={item.code}
                    className="transition-all duration-500 cursor-pointer hover:opacity-80" 
                    style={{ 
                      width: `${item.percentage}%`,
                      backgroundColor: item.color || overviewGroupConfig[item.code]?.defaultColor || '#94A3B8'
                    }}
                    title={`${item.name}: ${item.percentage.toFixed(1)}%`}
                    onClick={() => setExpandedGroup(expandedGroup === item.code ? null : item.code)}
                  />
                ))
              ) : assetTypeDistribution.length > 0 ? (
                // 降级方案：使用旧的资产类型分布数据
                assetTypeDistribution.map((item) => (
                  <div 
                    key={item.type}
                    className="transition-all duration-500" 
                    style={{ 
                      width: `${item.percentage}%`,
                      backgroundColor: item.color || assetTypeConfig[item.type]?.defaultColor || '#94A3B8'
                    }}
                    title={`${item.typeName}: ${item.percentage.toFixed(1)}%`}
                  />
                ))
              ) : (
                // 最终降级：使用基础计算逻辑
                <>
                  <div 
                    className="bg-emerald-400 transition-all duration-500" 
                    style={{ width: `${(data.cashBalance / (data.totalAssets || 1)) * 100}%` }}
                    title={`流动现金: ${((data.cashBalance / (data.totalAssets || 1)) * 100).toFixed(1)}%`}
                  />
                  <div 
                    className="bg-amber-400 transition-all duration-500" 
                    style={{ width: `${(data.investedAmount / (data.totalAssets || 1)) * 100}%` }}
                    title={`证券持仓: ${((data.investedAmount / (data.totalAssets || 1)) * 100).toFixed(1)}%`}
                  />
                </>
              )}
            </div>
            
            {/* ✨ Phase 2: 图例 - 使用底层敞口的概览分组数据，支持下拉展开 */}
            <div className="flex items-center justify-between mt-3 text-xs sm:text-sm flex-wrap gap-x-4 gap-y-2">
              {underlyingTypeDistribution?.byOverviewGroup && underlyingTypeDistribution.byOverviewGroup.length > 0 ? (
                // ✨ Phase 2: 使用底层敞口的概览分组数据
                underlyingTypeDistribution.byOverviewGroup.map((item) => {
                  const config = overviewGroupConfig[item.code];
                  const color = item.color || config?.defaultColor || '#94A3B8';
                  const isExpanded = expandedGroup === item.code;
                  
                  return (
                    <button
                      key={item.code}
                      onClick={() => setExpandedGroup(isExpanded ? null : item.code)}
                      className="flex items-center gap-1.5 sm:gap-2 hover:text-white/80 cursor-pointer transition-colors group"
                    >
                      <div 
                        className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded flex items-center justify-center text-white flex-shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {config?.icon || <div className="h-2 w-2 rounded-full bg-white" />}
                      </div>
                      {/* 移动端：简化显示，优先展示百分比 */}
                      <span className="hidden sm:inline">
                        {item.name} {formatCurrency(item.value)} ({item.percentage.toFixed(1)}%)
                      </span>
                      <span className="sm:hidden">
                        <span className="text-white/90">{item.name.replace('及现金等价物', '').replace('投资', '')}</span>
                        <span className="text-white/60 ml-1">{item.percentage.toFixed(1)}%</span>
                      </span>
                      {/* 展开图标 - 添加背景圆圈使其更突出 */}
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
                })
              ) : assetTypeDistribution.length > 0 ? (
                // 降级方案：使用旧的资产类型分布数据
                assetTypeDistribution.map((item) => {
                  const config = assetTypeConfig[item.type];
                  const color = item.color || config?.defaultColor || '#94A3B8';
                  const isCashType = item.type === 'CASH';
                  
                  return (
                    <button
                      key={item.type}
                      onClick={() => isCashType && accounts.length > 0 && setShowCashDetail(!showCashDetail)}
                      className={`flex items-center gap-1.5 sm:gap-2 ${isCashType && accounts.length > 0 ? 'hover:text-white/80 cursor-pointer' : ''} transition-colors group`}
                    >
                      <div 
                        className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded flex items-center justify-center text-white flex-shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {config?.icon || <div className="h-2 w-2 rounded-full bg-white" />}
                      </div>
                      <span className="hidden sm:inline">
                        {item.typeName} {formatCurrency(item.value)} ({item.percentage.toFixed(1)}%)
                      </span>
                      <span className="sm:hidden">
                        <span className="text-white/90">{item.typeName}</span>
                        <span className="text-white/60 ml-1">{item.percentage.toFixed(1)}%</span>
                      </span>
                      {isCashType && accounts.length > 0 && (
                        <span className={`flex items-center justify-center h-5 w-5 rounded-full transition-colors ${
                          showCashDetail ? 'bg-white/30' : 'bg-white/10 group-hover:bg-white/20'
                        }`}>
                          {showCashDetail ? (
                            <ChevronUp className="h-3.5 w-3.5 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                          )}
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                // 最终降级方案
                <>
                  <button
                    onClick={() => accounts.length > 0 && setShowCashDetail(!showCashDetail)}
                    className={`flex items-center gap-1.5 sm:gap-2 ${accounts.length > 0 ? 'hover:text-emerald-300 cursor-pointer' : ''} transition-colors group`}
                  >
                    <PiggyBank className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400 flex-shrink-0" />
                    <span className="hidden sm:inline">
                      流动现金 {formatCurrency(data.cashBalance)} ({((data.cashBalance / (data.totalAssets || 1)) * 100).toFixed(1)}%)
                    </span>
                    <span className="sm:hidden">
                      <span className="text-white/90">现金</span>
                      <span className="text-white/60 ml-1">{((data.cashBalance / (data.totalAssets || 1)) * 100).toFixed(1)}%</span>
                    </span>
                    {accounts.length > 0 && (
                      <span className={`flex items-center justify-center h-5 w-5 rounded-full transition-colors ${
                        showCashDetail ? 'bg-white/30' : 'bg-white/10 group-hover:bg-white/20'
                      }`}>
                        {showCashDetail ? (
                          <ChevronUp className="h-3.5 w-3.5 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                        )}
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400 flex-shrink-0" />
                    <span className="hidden sm:inline">
                      证券 {formatCurrency(data.investedAmount)} ({((data.investedAmount / (data.totalAssets || 1)) * 100).toFixed(1)}%)
                    </span>
                    <span className="sm:hidden">
                      <span className="text-white/90">证券</span>
                      <span className="text-white/60 ml-1">{((data.investedAmount / (data.totalAssets || 1)) * 100).toFixed(1)}%</span>
                    </span>
                  </div>
                </>
              )}
            </div>
            
            {/* ✨ 目标达成度指示行 - 以终为始 (可展开) */}
            {/* 个人+有家庭时隐藏AI区域，引导切换家庭视角 */}
            {allocationHealth?.score !== undefined && !hasFamilyId && (
              <Collapsible 
                open={allocationDetailExpanded} 
                onOpenChange={setAllocationDetailExpanded}
                className="mt-4"
              >
                <div className="p-3 bg-white/10 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* 左侧：目标达成度信息 - 移动端垂直堆叠，桌面端水平排列 */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      {/* 目标达成度分数 */}
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
                      
                      {/* 分隔符 - 移动端隐藏 */}
                      <div className="hidden sm:block h-4 w-px bg-white/20" />
                      
                      {/* 主要偏离告警 - 移动端简化显示 */}
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
                      
                      {/* 告警数量 */}
                      {allocationHealth.alertCount !== undefined && allocationHealth.alertCount > 0 && (
                        <>
                          <div className="hidden sm:block h-4 w-px bg-white/20" />
                          <span className="text-sm text-orange-300">
                            {allocationHealth.alertCount} 项告警
                          </span>
                        </>
                      )}
                    </div>
                    
                    {/* 操作按钮区 - 移动端右对齐，确保不被截断 */}
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
                      
                      {/* 有家庭时引导切换家庭视角，无家庭时保留调整配置按钮 */}
                      {hasFamilyId && onSwitchToFamily ? (
                        <button 
                          onClick={onSwitchToFamily}
                          className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-white/90 bg-white/15 hover:bg-white/25 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span>家庭视角</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      ) : (
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
                  
                  {/* 有家庭时显示引导提示 */}
                  {hasFamilyId && (
                    <div className="mt-2 text-[11px] text-white/40 text-right">
                      个人视角仅展示您名下资产配置概览，完整分析与AI建议请使用家庭视角
                    </div>
                  )}
                </div>
                
                {/* ✨ 展开的配置偏离详情面板 */}
                <CollapsibleContent className="animate-in slide-in-from-top-2 duration-200">
                  <AllocationDetailPanel 
                    allocationHealth={allocationHealth}
                  />
                </CollapsibleContent>
              </Collapsible>
            )}
            
            {/* 资产配置快捷入口 - 无配置目标 或 个人+有家庭（引导切换） */}
            {(allocationHealth?.score === undefined || hasFamilyId) && (
              <button 
                onClick={hasFamilyId && onSwitchToFamily ? onSwitchToFamily : onEditTargets}
                className="block mt-4 w-full text-left"
              >
                <div className="flex items-center justify-between p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <PieChart className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-white">{hasFamilyId ? '查看家庭资产配置' : '设置配置目标'}</div>
                      <div className="text-xs text-white/60">{hasFamilyId ? '切换至家庭视角查看完整配置分析与AI建议' : '以终为始，设定目标、分析偏离、获取AI建议'}</div>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ✨ Phase 2: 底层敞口细化数据展开区域 */}
      {expandedGroup && underlyingTypeDistribution?.byUnderlyingType && (() => {
        // 获取当前展开分组的配置
        const groupConfig = overviewGroupConfig[expandedGroup];
        const groupColor = groupConfig?.defaultColor || '#94A3B8';
        
        // ✨ Phase 2.1: 如果是权益类，显示按地区细分
        if (expandedGroup === 'EQUITY' && underlyingTypeDistribution.equityByRegion) {
          const equityData = underlyingTypeDistribution.equityByRegion;
          
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
                {/* 分组标题 */}
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
                    ({equityData.byRegion.length} 个地区 · {equityData.count} 项资产)
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
                
                {/* 按地区细分数据 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {equityData.byRegion.map((region) => (
                    <div
                      key={region.regionCode}
                      className="p-3 bg-white dark:bg-slate-800 rounded-lg border hover:shadow-md transition-all"
                      style={{ borderColor: `${region.color}40` }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: region.color }}
                          />
                          <h4 className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                            {region.regionName}
                          </h4>
                        </div>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {region.count} 项
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-lg font-bold" style={{ color: region.color }}>
                          {formatCurrency(region.value)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          占权益类 {region.percentage.toFixed(1)}%
                        </p>
                        {/* 持仓列表（前3个） */}
                        {region.holdings.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                            <div className="space-y-1">
                              {region.holdings.slice(0, 3).map((holding, index) => (
                                <div key={`${region.regionCode}-${holding.symbol}-${index}`} className="flex justify-between text-xs">
                                  <span className="text-slate-600 dark:text-slate-400 truncate max-w-[100px]">
                                    {holding.name}
                                  </span>
                                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                                    {formatCurrency(holding.marketValue)}
                                  </span>
                                </div>
                              ))}
                              {region.holdings.length > 3 && (
                                <p className="text-xs text-slate-400 text-center">
                                  +{region.holdings.length - 3} 更多
                                </p>
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
        
        // ✨ Phase 2.2: 其他分组优先显示二级分类细分（现金、固定收益、不动产、另类投资等）
        const subCategoryData = underlyingTypeDistribution.groupsSubCategories?.[expandedGroup];
        
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
                {/* 分组标题 */}
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
                
                {/* 二级分类细分数据 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {subCategoryData.bySubCategory.map((category) => (
                    <div
                      key={category.categoryCode}
                      className="p-3 bg-white dark:bg-slate-800 rounded-lg border hover:shadow-md transition-all"
                      style={{ borderColor: `${category.color}40` }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          <h4 className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                            {category.categoryName}
                          </h4>
                        </div>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {category.count} 项
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-lg font-bold" style={{ color: category.color }}>
                          {formatCurrency(category.value)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          占{subCategoryData.groupName} {category.percentage.toFixed(1)}%
                        </p>
                        {/* 资产列表（前3个） */}
                        {category.items.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                            <div className="space-y-1">
                              {category.items.slice(0, 3).map((item, index) => (
                                <div key={`${category.categoryCode}-${item.id}-${index}`} className="flex justify-between text-xs">
                                  <span className="text-slate-600 dark:text-slate-400 truncate max-w-[100px]">
                                    {item.name}
                                  </span>
                                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                                    {formatCurrency(item.value)}
                                  </span>
                                </div>
                              ))}
                              {category.items.length > 3 && (
                                <p className="text-xs text-slate-400 text-center">
                                  +{category.items.length - 3} 更多
                                </p>
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
        
        // 降级：如果没有二级分类数据，显示底层敞口细分
        // 底层敞口类型到概览分组的映射
        const underlyingToGroupMap: Record<string, string> = {
          'EQUITY': 'EQUITY',
          'BOND': 'FIXED_INCOME',
          'FIXED_INCOME': 'FIXED_INCOME',
          'CASH': 'CASH',
          'GOLD': 'ALTERNATIVE',
          'COMMODITY': 'ALTERNATIVE',
          'CRYPTO': 'ALTERNATIVE',
          'COLLECTIBLE': 'ALTERNATIVE',
          'REAL_ESTATE': 'REAL_ESTATE',
          'RECEIVABLE': 'RECEIVABLE',
          'DEPRECIATING': 'OTHER',
          'MIXED': 'OTHER',
          'OTHER': 'OTHER',
        };
        
        // 筛选属于当前分组的细化数据
        const groupDetails = underlyingTypeDistribution.byUnderlyingType.filter(
          item => underlyingToGroupMap[item.code] === expandedGroup
        );
        
        // 获取该分组的概览数据
        const groupOverview = underlyingTypeDistribution.byOverviewGroup.find(
          g => g.code === expandedGroup
        );
        
        if (groupDetails.length === 0) return null;
        
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
              {/* 分组标题 */}
              <div className="flex items-center gap-2 mb-4">
                <div 
                  className="h-6 w-6 rounded flex items-center justify-center text-white"
                  style={{ backgroundColor: groupColor }}
                >
                  {groupConfig?.icon}
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                  {groupOverview?.name || groupConfig?.label || expandedGroup} 细分
                </h3>
                <span className="text-xs text-slate-500">
                  ({groupDetails.length} 个类别 · {groupOverview?.count || 0} 项资产)
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
              
              {/* 细化数据列表 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupDetails.map((item) => (
                  <div
                    key={item.code}
                    className="p-3 bg-white dark:bg-slate-800 rounded-lg border hover:shadow-md transition-all"
                    style={{ borderColor: `${item.color}40` }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <h4 className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                          {item.name}
                        </h4>
                      </div>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {item.count} 项
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-bold" style={{ color: item.color }}>
                        {formatCurrency(item.value)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        占该分组 {groupOverview?.value && groupOverview.value > 0 
                          ? ((item.value / groupOverview.value) * 100).toFixed(1) 
                          : '0.0'}% · 
                        占总资产 {item.percentage.toFixed(1)}%
                      </p>
                      {/* 资产来源明细 */}
                      {item.details && (
                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                          {item.details.holdings > 0 && (
                            <span className="mr-2">证券: {formatCurrency(item.details.holdings)}</span>
                          )}
                          {item.details.cashAssets > 0 && (
                            <span className="mr-2">现金: {formatCurrency(item.details.cashAssets)}</span>
                          )}
                          {item.details.otherAssets > 0 && (
                            <span>其他: {formatCurrency(item.details.otherAssets)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* 现金详情展开区域 */}
      {showCashDetail && accounts.length > 0 && (
        <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 border-emerald-200 dark:border-emerald-800 shadow-lg animate-in slide-in-from-top-2 duration-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                证券账户现金明细
              </h3>
              <span className="text-xs text-slate-500">
                ({accounts.filter(a => Number(a.cashBalanceOriginal) > 0).length}个账户)
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {accounts.filter(acc => Number(acc.cashBalanceOriginal) > 0).map((account) => (
                <div
                  key={account.id}
                  className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-emerald-100 dark:border-emerald-800 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">
                        {account.broker}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {account.name}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs rounded-full ml-2 flex-shrink-0">
                      {account.currency}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                      {formatCurrencyPrecise(Number(account.cashBalanceOriginal), account.currency)}
                    </p>
                    {account.currency !== 'CNY' && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        ≈ {formatCurrencyPrecise(Number(account.cashBalance), 'CNY')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
