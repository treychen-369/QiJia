'use client';

/**
 * 负债健康度面板
 * 显示负债率、DTI等核心指标
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CreditCard, 
  AlertTriangle,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import type { LiabilityHealthPanelProps } from './types';

// 获取状态样式
function getStatusStyle(status: 'HEALTHY' | 'WARNING' | 'CRITICAL') {
  switch (status) {
    case 'HEALTHY':
      return {
        Icon: CheckCircle,
        colorClass: 'text-green-600 dark:text-green-400',
        bgClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        label: '健康'
      };
    case 'WARNING':
      return {
        Icon: AlertTriangle,
        colorClass: 'text-yellow-600 dark:text-yellow-400',
        bgClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        label: '注意'
      };
    case 'CRITICAL':
      return {
        Icon: AlertCircle,
        colorClass: 'text-red-600 dark:text-red-400',
        bgClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        label: '警告'
      };
  }
}

// 骨架屏
function LiabilityHealthSkeleton() {
  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-2 px-0 pt-0">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Skeleton className="h-20 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

// 无负债占位
function NoLiabilityPlaceholder() {
  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-2 px-0 pt-0">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-orange-500" />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            负债健康度
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
          <CheckCircle className="h-6 w-6 mx-auto mb-1 text-green-500" />
          <p className="text-sm text-green-700 dark:text-green-400">
            无负债，财务状况良好
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function LiabilityHealthPanel({
  data,
  isLoading = false,
}: LiabilityHealthPanelProps) {
  if (isLoading) {
    return <LiabilityHealthSkeleton />;
  }

  // 无负债或负债率为0
  if (!data || data.liabilityRatio === 0) {
    return <NoLiabilityPlaceholder />;
  }

  const statusStyle = getStatusStyle(data.status);
  const StatusIcon = statusStyle.Icon;

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-2 px-0 pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              负债健康度
            </CardTitle>
          </div>
          <Badge className={statusStyle.bgClass}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusStyle.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-2">
          {/* 负债率 - 服务层已返回百分比值，无需再乘100 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">负债率</span>
            <span className={`text-sm font-semibold ${statusStyle.colorClass}`}>
              {data.liabilityRatio.toFixed(1)}%
            </span>
          </div>
          
          {/* DTI（月供收入比）- 服务层已返回百分比值，无需再乘100 */}
          {data.dti !== undefined && data.dti > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">月供收入比</span>
              <span className={`text-sm font-semibold ${
                data.dti <= 30 ? 'text-green-600 dark:text-green-400' :
                data.dti <= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {data.dti.toFixed(1)}%
              </span>
            </div>
          )}

          {/* 月供总额 */}
          {data.monthlyPayment !== undefined && data.monthlyPayment > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">月供总额</span>
              <span className="text-sm font-semibold">
                ¥{data.monthlyPayment.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
