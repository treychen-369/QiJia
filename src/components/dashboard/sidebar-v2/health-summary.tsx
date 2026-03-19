'use client';

/**
 * 配置健康度面板
 * 显示配置健康分数和主要偏离项
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  PieChart, 
  Target, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  ChevronRight
} from 'lucide-react';
import type { HealthSummaryPanelProps, DeviationItem } from './types';

// 获取健康度状态颜色
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

// 获取偏离状态图标和颜色
function getDeviationStyle(item: DeviationItem) {
  const isPositive = item.deviation > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  
  let colorClass = 'text-slate-500';
  if (item.status === 'WARNING') colorClass = 'text-yellow-500';
  if (item.status === 'CRITICAL') colorClass = 'text-red-500';
  
  return { Icon, colorClass };
}

// 骨架屏
function HealthSummarySkeleton() {
  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-2 px-0 pt-0">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="px-0 pb-0 space-y-3">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

// 无数据占位
function HealthSummaryPlaceholder({ onEditTargets }: { onEditTargets?: () => void }) {
  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-2 px-0 pt-0">
        <div className="flex items-center gap-2">
          <PieChart className="h-4 w-4 text-purple-500" />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            配置健康度
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-3">
            暂无配置数据
          </p>
          <Button size="sm" variant="outline" onClick={onEditTargets}>
            <Target className="h-4 w-4 mr-2" />
            设置目标配置
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function HealthSummaryPanel({
  data,
  onEditTargets,
  onViewDetail,
  isLoading = false,
}: HealthSummaryPanelProps) {
  if (isLoading) {
    return <HealthSummarySkeleton />;
  }

  if (!data) {
    return <HealthSummaryPlaceholder onEditTargets={onEditTargets} />;
  }

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-2 px-0 pt-0">
        <div className="flex items-center gap-2">
          <PieChart className="h-4 w-4 text-purple-500" />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            配置健康度
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 space-y-3">
        {/* 健康度分数 */}
        <div className="p-3 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">综合评分</span>
            <div className="flex items-center gap-1">
              {data.score >= 80 ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : data.score >= 60 ? (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-2xl font-bold ${getScoreColor(data.score)}`}>
                {data.score}
              </span>
              <span className="text-sm text-muted-foreground">分</span>
            </div>
          </div>
          <Progress 
            value={data.score} 
            className="h-2"
          />
        </div>

        {/* 偏离项列表 */}
        {data.deviations.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">主要偏离</span>
            {data.deviations.slice(0, 3).map((item, index) => {
              const { Icon, colorClass } = getDeviationStyle(item);
              return (
                <div 
                  key={index}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/30"
                >
                  <span className="text-sm">{item.category}</span>
                  <div className="flex items-center gap-1">
                    <Icon className={`h-3 w-3 ${colorClass}`} />
                    <span className={`text-sm font-medium ${colorClass}`}>
                      {item.deviation > 0 ? '+' : ''}{item.deviation.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1"
            onClick={onEditTargets}
          >
            <Target className="h-4 w-4 mr-1" />
            编辑目标
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onViewDetail}
          >
            详情
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
