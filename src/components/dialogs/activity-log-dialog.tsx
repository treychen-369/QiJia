'use client';

/**
 * 资产更新记录对话框
 * 通过快捷操作按钮打开，显示完整的资产更新历史
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  ArrowRightLeft,
  Download,
  ChevronLeft,
  ChevronRight,
  Filter,
  ExternalLink,
} from 'lucide-react';

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

interface ActivityLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewDetail?: (assetId: string, assetType: string, assetName: string) => void;
}

const ACTION_CONFIG = {
  CREATE: { label: '新建', icon: Plus, color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  UPDATE: { label: '更新', icon: Pencil, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  DELETE: { label: '删除', icon: Trash2, color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  PRICE_UPDATE: { label: '价格更新', icon: RefreshCw, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  TRANSFER: { label: '转移', icon: ArrowRightLeft, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  IMPORT: { label: '导入', icon: Download, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' },
};

const ASSET_TYPE_CONFIG = {
  HOLDING: { label: '证券持仓', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  CASH_ASSET: { label: '现金资产', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  REAL_ESTATE: { label: '不动产', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' },
  OTHER_ASSET: { label: '其他资产', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300' },
  LIABILITY: { label: '负债', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  ACCOUNT: { label: '账户', color: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300' },
};

export function ActivityLogDialog({ 
  open, 
  onOpenChange,
  onViewDetail
}: ActivityLogDialogProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [filterAssetType, setFilterAssetType] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const limit = 10;

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });
      
      if (filterAssetType !== 'all') {
        params.append('assetType', filterAssetType);
      }
      if (filterAction !== 'all') {
        params.append('action', filterAction);
      }
      
      const response = await fetch(`/api/activity-logs?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setLogs(data.data.logs);
        setTotal(data.data.total);
      } else {
        setError(data.error || '获取记录失败');
      }
    } catch (err) {
      setError('网络错误');
    } finally {
      setIsLoading(false);
    }
  }, [offset, filterAssetType, filterAction, limit]);

  useEffect(() => {
    if (open) {
      fetchLogs();
    }
  }, [open, fetchLogs]);

  // 重置分页当筛选条件改变
  useEffect(() => {
    setOffset(0);
  }, [filterAssetType, filterAction]);

  const formatCurrency = (amount: number, currency: string = 'CNY') => {
    const symbol = currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : '¥';
    return `${symbol}${Math.abs(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const handleViewDetail = (log: ActivityLog) => {
    if (onViewDetail && log.assetId) {
      onViewDetail(log.assetId, log.assetType, log.assetName);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            资产更新记录
          </DialogTitle>
          <DialogDescription>
            查看所有资产的操作历史记录
          </DialogDescription>
        </DialogHeader>

        {/* 筛选器 */}
        <div className="flex items-center gap-3 py-2 border-b">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterAssetType} onValueChange={setFilterAssetType}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="资产类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="HOLDING">证券持仓</SelectItem>
              <SelectItem value="CASH_ASSET">现金资产</SelectItem>
              <SelectItem value="REAL_ESTATE">不动产</SelectItem>
              <SelectItem value="OTHER_ASSET">其他资产</SelectItem>
              <SelectItem value="LIABILITY">负债</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="操作类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部操作</SelectItem>
              <SelectItem value="CREATE">新建</SelectItem>
              <SelectItem value="UPDATE">更新</SelectItem>
              <SelectItem value="DELETE">删除</SelectItem>
              <SelectItem value="PRICE_UPDATE">价格更新</SelectItem>
              <SelectItem value="TRANSFER">转移</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchLogs}
            disabled={isLoading}
            className="ml-auto"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          
          <Badge variant="outline">
            {total} 条记录
          </Badge>
        </div>

        {/* 记录列表 */}
        <div className="flex-1 overflow-hidden">
          {error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : isLoading ? (
            <div className="space-y-3 p-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-8 h-8 bg-muted rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无操作记录
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2 p-2">
                {logs.map((log) => {
                  const actionConfig = ACTION_CONFIG[log.action as keyof typeof ACTION_CONFIG] || ACTION_CONFIG.UPDATE;
                  const assetTypeConfig = ASSET_TYPE_CONFIG[log.assetType as keyof typeof ASSET_TYPE_CONFIG] || ASSET_TYPE_CONFIG.OTHER_ASSET;
                  const ActionIcon = actionConfig.icon;
                  
                  return (
                    <div
                      key={log.id}
                      className={`p-3 rounded-lg border hover:shadow-md transition-all group ${
                        onViewDetail ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-600' : ''
                      }`}
                      onClick={() => handleViewDetail(log)}
                      title={onViewDetail ? '点击查看资产详情' : undefined}
                    >
                      <div className="flex items-start gap-3">
                        {/* 图标 */}
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${actionConfig.color}`}>
                          <ActionIcon className="h-4 w-4" />
                        </div>
                        
                        {/* 内容 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">
                              {log.assetName}
                            </span>
                            {log.assetSymbol && (
                              <Badge variant="outline" className="text-xs">
                                {log.assetSymbol}
                              </Badge>
                            )}
                            <Badge className={`text-xs ${assetTypeConfig.color}`}>
                              {assetTypeConfig.label}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground truncate">
                            {log.description || `${actionConfig.label}操作`}
                          </p>
                          
                          {/* 金额变动 */}
                          {log.amountChange !== null && log.amountChange !== undefined && log.amountChange !== 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              {log.amountChange > 0 ? (
                                <TrendingUp className="h-3 w-3 text-green-500" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-red-500" />
                              )}
                              <span className={`text-xs font-medium ${log.amountChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {log.amountChange > 0 ? '+' : ''}{formatCurrency(log.amountChange, log.currency)}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* 时间和跳转图标 */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                          {formatTime(log.createdAt)}
                          {onViewDetail && log.assetId && (
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              上一页
            </Button>
            
            <span className="text-sm text-muted-foreground">
              第 {currentPage} / {totalPages} 页
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(offset + limit)}
              disabled={currentPage >= totalPages}
            >
              下一页
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
