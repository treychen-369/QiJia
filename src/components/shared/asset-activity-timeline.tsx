/**
 * 资产更新记录时间线组件
 * 
 * 用于在资产详情对话框中展示单个资产的操作历史
 * 支持分页加载
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Clock,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  ArrowRightLeft,
  FileUp,
  TrendingUp,
  TrendingDown,
  Loader2,
  ChevronDown,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// 操作类型配置
const ACTION_CONFIG: Record<string, {
  icon: typeof Plus;
  label: string;
  color: string;
  bgColor: string;
}> = {
  CREATE: {
    icon: Plus,
    label: '创建',
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  UPDATE: {
    icon: Edit,
    label: '更新',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  DELETE: {
    icon: Trash2,
    label: '删除',
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  PRICE_UPDATE: {
    icon: RefreshCw,
    label: '价格更新',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  TRANSFER: {
    icon: ArrowRightLeft,
    label: '转移',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  IMPORT: {
    icon: FileUp,
    label: '导入',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
  },
};

// 日志条目类型
interface ActivityLog {
  id: string;
  assetId: string;
  assetType: string;
  assetName: string;
  assetSymbol?: string;
  action: string;
  description?: string;
  previousValue?: Record<string, any>;
  newValue?: Record<string, any>;
  amountChange?: number;
  currency: string;
  source?: string;
  createdAt: string;
}

interface AssetActivityTimelineProps {
  assetId: string;
  assetType?: string;  // 可选，用于展示
  className?: string;
}

export function AssetActivityTimeline({ 
  assetId, 
  assetType,
  className 
}: AssetActivityTimelineProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 10;

  // 加载数据
  const fetchLogs = useCallback(async (loadMore = false) => {
    if (!assetId) return;

    try {
      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const currentOffset = loadMore ? offset : 0;
      const response = await fetch(
        `/api/activity-logs?assetId=${assetId}&limit=${limit}&offset=${currentOffset}`
      );

      if (!response.ok) {
        throw new Error('获取更新记录失败');
      }

      const result = await response.json();
      
      if (result.success) {
        if (loadMore) {
          setLogs(prev => [...prev, ...result.data.logs]);
        } else {
          setLogs(result.data.logs);
        }
        setTotal(result.data.total);
        setOffset(currentOffset + result.data.logs.length);
      } else {
        throw new Error(result.error || '获取数据失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [assetId, offset, limit]);

  // 初始加载
  useEffect(() => {
    setOffset(0);
    fetchLogs(false);
  }, [assetId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 加载更多
  const handleLoadMore = () => {
    fetchLogs(true);
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `今天 ${format(date, 'HH:mm')}`;
    } else if (diffDays === 1) {
      return `昨天 ${format(date, 'HH:mm')}`;
    } else if (diffDays < 7) {
      return format(date, 'EEEE HH:mm', { locale: zhCN });
    } else {
      return format(date, 'MM-dd HH:mm');
    }
  };

  // 格式化金额变动
  const formatAmountChange = (amount: number | undefined | null, currency: string) => {
    if (amount === undefined || amount === null) return null;
    
    const prefix = amount >= 0 ? '+' : '';
    const formatted = new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: currency === 'CNY' ? 'CNY' : currency,
      minimumFractionDigits: 2,
    }).format(Math.abs(amount));
    
    return `${prefix}${amount >= 0 ? '' : '-'}${formatted}`;
  };

  // 渲染单个日志条目
  const renderLogItem = (log: ActivityLog, index: number) => {
    const config = ACTION_CONFIG[log.action] || ACTION_CONFIG.UPDATE;
    const Icon = config.icon;
    const isPositive = log.amountChange && log.amountChange > 0;
    const isNegative = log.amountChange && log.amountChange < 0;

    return (
      <div 
        key={log.id} 
        className={cn(
          "relative pl-8 pb-6 last:pb-0",
          index !== logs.length - 1 && "border-l-2 border-slate-200 dark:border-slate-700 ml-3"
        )}
      >
        {/* 时间线节点 */}
        <div className={cn(
          "absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full",
          config.bgColor,
          "-translate-x-1/2"
        )}>
          <Icon className={cn("h-3 w-3", config.color)} />
        </div>

        {/* 内容 */}
        <div className="ml-4 space-y-1">
          {/* 标题行 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn("text-xs", config.color)}>
              {config.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatTime(log.createdAt)}
            </span>
            {log.source && log.source !== 'manual' && (
              <Badge variant="secondary" className="text-xs">
                {log.source === 'api' ? 'API' : log.source === 'import' ? '导入' : log.source}
              </Badge>
            )}
          </div>

          {/* 描述 */}
          {log.description && (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {log.description}
            </p>
          )}

          {/* 金额变动 */}
          {log.amountChange !== null && log.amountChange !== undefined && (
            <div className="flex items-center gap-1 text-sm">
              {isPositive ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : isNegative ? (
                <TrendingDown className="h-3 w-3 text-red-600" />
              ) : null}
              <span className={cn(
                "font-medium",
                isPositive && "text-green-600",
                isNegative && "text-red-600"
              )}>
                {formatAmountChange(log.amountChange, log.currency)}
              </span>
            </div>
          )}

          {/* 变更详情（展开式） */}
          {(log.previousValue || log.newValue) && (
            <div className="mt-2 text-xs text-muted-foreground bg-slate-50 dark:bg-slate-800/50 rounded-md p-2">
              {log.previousValue && Object.keys(log.previousValue).length > 0 && (
                <div className="mb-1">
                  <span className="font-medium">变更前：</span>
                  {Object.entries(log.previousValue).map(([key, value]) => (
                    <span key={key} className="ml-1">
                      {key}={typeof value === 'number' ? value.toFixed(2) : String(value)}
                    </span>
                  ))}
                </div>
              )}
              {log.newValue && Object.keys(log.newValue).length > 0 && (
                <div>
                  <span className="font-medium">变更后：</span>
                  {Object.entries(log.newValue).map(([key, value]) => (
                    <span key={key} className="ml-1">
                      {key}={typeof value === 'number' ? value.toFixed(2) : String(value)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 加载中状态
  if (isLoading) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="mt-2 text-sm text-muted-foreground">加载更新记录...</span>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8", className)}>
        <p className="text-sm text-red-600">{error}</p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-2"
          onClick={() => fetchLogs(false)}
        >
          重试
        </Button>
      </div>
    );
  }

  // 空状态
  if (logs.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8", className)}>
        <History className="h-10 w-10 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">暂无更新记录</p>
        <p className="text-xs text-muted-foreground mt-1">
          资产的创建、修改、删除操作都会记录在这里
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* 统计信息 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>共 {total} 条更新记录</span>
        </div>
      </div>

      {/* 时间线列表 */}
      <div className="relative">
        {logs.map((log, index) => renderLogItem(log, index))}
      </div>

      {/* 加载更多 */}
      {logs.length < total && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                加载中...
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                加载更多 ({total - logs.length} 条)
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
