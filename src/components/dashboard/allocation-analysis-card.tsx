'use client';

/**
 * 配置分析卡片
 * 显示完整的一级资产配置偏离分析
 * Phase 4: 主页配置分析区
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  PieChart, 
  Target, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Bot
} from 'lucide-react';

interface DeviationItem {
  categoryCode: string;
  categoryName: string;
  currentPercent: number;
  targetPercent: number;
  deviation: number;
  deviationStatus: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

interface AlertItem {
  type: string;
  categoryCode: string;
  categoryName: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface AllocationAnalysisCardProps {
  overallScore?: number;
  deviations?: DeviationItem[];
  alerts?: AlertItem[];
  scoreBreakdown?: {
    deviationScore: number;
    diversityScore: number;
    liquidityScore: number;
    debtScore: number;
  };
  isLoading?: boolean;
  onRequestAIAdvice?: () => void;
  onEditTargets?: () => void;
}

// 获取健康度状态颜色
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

// 获取偏离状态样式
function getDeviationStyle(status: 'NORMAL' | 'WARNING' | 'CRITICAL', deviation: number) {
  const isPositive = deviation > 0;
  
  let colorClass = 'text-slate-600 dark:text-slate-400';
  let bgClass = 'bg-slate-100 dark:bg-slate-800';
  let label = '正常';
  
  if (status === 'WARNING') {
    colorClass = 'text-yellow-600 dark:text-yellow-400';
    bgClass = 'bg-yellow-50 dark:bg-yellow-900/20';
    label = isPositive ? '超配' : '低配';
  }
  if (status === 'CRITICAL') {
    colorClass = 'text-red-600 dark:text-red-400';
    bgClass = 'bg-red-50 dark:bg-red-900/20';
    label = isPositive ? '严重超配' : '严重低配';
  }
  
  return { colorClass, bgClass, label };
}

// 骨架屏
function AllocationAnalysisSkeleton() {
  return (
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-0 shadow-xl">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
}

// 无数据占位
function AllocationAnalysisPlaceholder({ onEditTargets }: { onEditTargets?: () => void }) {
  return (
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-0 shadow-xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200 text-base sm:text-lg">
          <PieChart className="h-5 w-5 text-purple-500" />
          配置分析
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Target className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-base font-semibold mb-2">尚未设置配置目标</h3>
          <p className="text-xs text-muted-foreground mb-4">
            设置您的资产配置目标，系统将自动分析偏离情况并提供建议
          </p>
          <Button onClick={onEditTargets} size="sm" className="bg-gradient-to-r from-blue-500 to-purple-500">
            <Target className="h-4 w-4 mr-2" />
            设置目标配置
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AllocationAnalysisCard({
  overallScore,
  deviations = [],
  alerts = [],
  scoreBreakdown,
  isLoading = false,
  onRequestAIAdvice,
  onEditTargets,
}: AllocationAnalysisCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  if (isLoading) {
    return <AllocationAnalysisSkeleton />;
  }
  
  if (overallScore === undefined || deviations.length === 0) {
    return <AllocationAnalysisPlaceholder onEditTargets={onEditTargets} />;
  }

  // 过滤出有偏离的项目
  const significantDeviations = deviations.filter(d => Math.abs(d.deviation) > 1);
  // 高优先级告警
  const highAlerts = alerts.filter(a => a.severity === 'HIGH' || a.severity === 'MEDIUM');

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-0 shadow-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200 text-base sm:text-lg">
            <PieChart className="h-5 w-5 text-purple-500" />
            配置分析
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={onEditTargets}
              className="h-7 text-xs px-2"
            >
              <Target className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">编辑目标</span>
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 h-7 text-xs px-2"
              onClick={onRequestAIAdvice}
            >
              <Bot className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">AI建议</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 pt-0">
        {/* 健康度评分概览 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {/* 总分 */}
          <div className="p-2.5 sm:p-3 rounded-lg bg-white dark:bg-slate-800 shadow-sm col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">综合健康度</span>
              {overallScore >= 80 ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : overallScore >= 60 ? (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
                {overallScore}
              </span>
              <span className="text-xs text-muted-foreground">分</span>
            </div>
            <Progress 
              value={overallScore} 
              className="h-1.5 mt-1.5"
            />
          </div>
          
          {/* 评分细分 */}
          {scoreBreakdown && (
            <>
              <div className="p-2.5 sm:p-3 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
                <span className="text-[10px] text-muted-foreground">偏离度</span>
                <div className="text-lg font-semibold mt-0.5">
                  {scoreBreakdown.deviationScore}<span className="text-xs text-muted-foreground">/40</span>
                </div>
              </div>
              <div className="p-2.5 sm:p-3 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
                <span className="text-[10px] text-muted-foreground">多样性</span>
                <div className="text-lg font-semibold mt-0.5">
                  {scoreBreakdown.diversityScore}<span className="text-xs text-muted-foreground">/20</span>
                </div>
              </div>
              <div className="p-2.5 sm:p-3 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
                <span className="text-[10px] text-muted-foreground">流动性</span>
                <div className="text-lg font-semibold mt-0.5">
                  {scoreBreakdown.liquidityScore}<span className="text-xs text-muted-foreground">/20</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 告警提示 */}
        {highAlerts.length > 0 && (
          <div className="space-y-1.5">
            {highAlerts.slice(0, 2).map((alert, index) => (
              <div 
                key={index}
                className={`p-2 rounded-lg flex items-start gap-2 ${
                  alert.severity === 'HIGH' 
                    ? 'bg-red-50 dark:bg-red-900/20' 
                    : 'bg-yellow-50 dark:bg-yellow-900/20'
                }`}
              >
                <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${
                  alert.severity === 'HIGH' 
                    ? 'text-red-500' 
                    : 'text-yellow-500'
                }`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{alert.categoryName}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 配置偏离列表 */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-1.5 h-auto hover:bg-slate-100 dark:hover:bg-slate-800">
              <span className="text-sm font-medium">一级资产配置偏离</span>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] h-5">{deviations.length} 项</Badge>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </div>
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-1.5 mt-1.5">
            {deviations.map((item, index) => {
              const style = getDeviationStyle(item.deviationStatus, item.deviation);
              const Icon = item.deviation > 0 ? TrendingUp : TrendingDown;
              
              return (
                <div 
                  key={index}
                  className={`p-2 rounded-lg ${style.bgClass}`}
                >
                  {/* 第一行：名称、状态和偏离值 */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-medium truncate">{item.categoryName}</span>
                      {item.deviationStatus !== 'NORMAL' && (
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] h-4 px-1 ${style.colorClass}`}
                        >
                          {style.label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Icon className={`h-3 w-3 ${style.colorClass}`} />
                      <span className={`text-xs font-semibold ${style.colorClass}`}>
                        {item.deviation > 0 ? '+' : ''}{item.deviation.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  {/* 进度条 */}
                  <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-1">
                    {/* 目标位置标记 */}
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-500 dark:bg-slate-400 z-10"
                      style={{ left: `${Math.min(item.targetPercent, 100)}%` }}
                    />
                    {/* 当前值 */}
                    <div 
                      className={`h-full ${getScoreBgColor(
                        item.deviationStatus === 'NORMAL' ? 80 :
                        item.deviationStatus === 'WARNING' ? 60 : 40
                      )} transition-all`}
                      style={{ width: `${Math.min(item.currentPercent, 100)}%` }}
                    />
                  </div>
                  
                  {/* 数值标签 */}
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>当前 {item.currentPercent.toFixed(1)}%</span>
                    <span>目标 {item.targetPercent.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
