'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge as UIBadge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  MoreHorizontal,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Edit,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input as UIInput } from '@/components/ui/input';
import { HoldingDetailDialog } from '@/components/holdings/holding-detail-dialog';
import { EditHoldingDialog, type EditHoldingData } from '@/components/holdings/edit-holding-dialog';
import { DeleteHoldingDialog } from '@/components/holdings/delete-holding-dialog';
import { EditCashDialog, type EditCashData } from '@/components/cash/edit-cash-dialog';
import { useToast } from '@/components/ui/use-toast';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { getPnLColorClass } from '@/lib/user-preferences';

interface Holding {
  id: string;
  type?: 'holding' | 'cash'; // 类型标识
  symbol: string;
  name: string;
  accountName?: string; // 账户名称（现金项专用）
  broker?: string; // 券商名称（现金项专用）
  marketValueOriginal?: number; // 原币种金额（现金项专用）
  quantity: number;
  currentPrice: number;
  costBasis: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  sector: string;
  region: string;
  currency: string;
  lastUpdated: string;
}

interface HoldingsListProps {
  holdings: Holding[];
  isLoading?: boolean;
  onHoldingClick?: (holding: Holding) => void;
  onRefresh?: () => void;
}

export function HoldingsList({ holdings, isLoading = false, onHoldingClick, onRefresh }: HoldingsListProps) {
  const preferences = useUserPreferences(); // 获取用户偏好
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'marketValue' | 'unrealizedPnL' | 'dayChange'>('marketValue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  
  // 对话框状态
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editCashDialogOpen, setEditCashDialogOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [selectedCashAccount, setSelectedCashAccount] = useState<{
    accountId: string;
    accountName: string;
    broker: string;
    amount: number;
    currency: string;
  } | null>(null);
  
  const { toast } = useToast();

  // 过滤和排序数据
  const filteredAndSortedHoldings = holdings
    .filter(holding => {
      const matchesSearch = holding.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           holding.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRegion = filterRegion === 'all' || holding.region === filterRegion;
      return matchesSearch && matchesRegion;
    })
    .sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
    });

  const regions = Array.from(new Set(holdings.map(h => h.region)));

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatCurrency = (amount: number, currency: string = 'CNY') => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return currency === 'USD' ? '$0.00' : currency === 'HKD' ? 'HK$0.00' : '¥0.00';
    }
    const symbol = currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : '¥';
    const absAmount = Math.abs(amount);
    const formattedAmount = absAmount.toLocaleString('zh-CN', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2 
    });
    // 保留负号，但正号由调用方决定
    return amount < 0 ? `-${symbol}${formattedAmount}` : `${symbol}${formattedAmount}`;
  };

  const formatPercent = (percent: number | string | null | undefined) => {
    const numPercent = typeof percent === 'number' ? percent : parseFloat(String(percent || 0));
    if (isNaN(numPercent)) return '0.00%';
    return `${numPercent >= 0 ? '+' : ''}${numPercent.toFixed(2)}%`;
  };

  // 处理查看详情
  const handleViewDetail = (holding: Holding) => {
    setSelectedHolding(holding);
    setDetailDialogOpen(true);
  };

  // 处理编辑持仓
  const handleEdit = (holding: Holding) => {
    setSelectedHolding(holding);
    setEditDialogOpen(true);
  };

  // 处理删除持仓
  const handleDelete = (holding: Holding) => {
    setSelectedHolding(holding);
    setDeleteDialogOpen(true);
  };

  // 处理编辑现金
  const handleEditCash = (holding: Holding) => {
    // 从 holding.id 中提取真实的 accountId
    const accountId = holding.id.replace('cash-', '');
    setSelectedCashAccount({
      accountId,
      accountName: holding.accountName || '',
      broker: holding.broker || '',
      amount: holding.marketValueOriginal || 0,
      currency: holding.currency,
    });
    setEditCashDialogOpen(true);
  };

  // 保存编辑
  const handleSaveEdit = async (holdingId: string, data: EditHoldingData) => {
    try {
      const response = await fetch(`/api/holdings/${holdingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('更新失败');
      }

      toast({
        title: '更新成功',
        description: '持仓信息已更新',
      });

      // 刷新列表
      onRefresh?.();
    } catch (error) {
      console.error('更新持仓失败:', error);
      toast({
        title: '更新失败',
        description: '无法更新持仓信息，请重试',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // 确认删除
  const handleConfirmDelete = async (holdingId: string) => {
    try {
      const response = await fetch(`/api/holdings/${holdingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('删除失败');
      }

      toast({
        title: '删除成功',
        description: '持仓记录已删除',
      });

      // 刷新列表
      onRefresh?.();
    } catch (error) {
      console.error('删除持仓失败:', error);
      toast({
        title: '删除失败',
        description: '无法删除持仓记录，请重试',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // 保存现金编辑
  const handleSaveCash = async (accountId: string, data: EditCashData) => {
    console.log('=== 开始保存现金编辑 ===');
    console.log('账户ID:', accountId);
    console.log('更新数据:', data);
    
    try {
      const url = `/api/accounts/${accountId}/cash`;
      console.log('请求 URL:', url);
      console.log('请求数据:', JSON.stringify(data));
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      console.log('响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API 返回错误:', errorData);
        throw new Error(errorData.error || '更新失败');
      }

      const result = await response.json();
      console.log('✅ 现金余额更新成功:', result);

      toast({
        title: '更新成功',
        description: `现金余额已更新为 ${data.cashBalanceOriginal} ${data.currency}`,
      });

      // 强制刷新列表
      console.log('开始刷新 Dashboard 数据...');
      if (onRefresh) {
        await onRefresh();
        console.log('✅ Dashboard 刷新完成');
      }
    } catch (error) {
      console.error('❌ 更新现金余额失败:', error);
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '无法更新现金余额，请重试',
        variant: 'destructive',
      });
      throw error;
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-0 shadow-xl">
        <CardHeader>
          <CardTitle>持仓列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // 分离现金和股票
  const cashHoldings = filteredAndSortedHoldings.filter(h => h.type === 'cash');
  const stockHoldings = filteredAndSortedHoldings.filter(h => h.type !== 'cash');

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-0 shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-800 dark:text-slate-200">
            持仓列表
          </CardTitle>
          <UIBadge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {stockHoldings.length} 只股票
          </UIBadge>
        </div>
        
        {/* 搜索和过滤栏 */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <UIInput
              placeholder="搜索股票名称或代码..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="whitespace-nowrap">
                <Filter className="h-4 w-4 mr-2" />
                {filterRegion === 'all' ? '全部地区' : filterRegion}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterRegion('all')}>
                全部地区
              </DropdownMenuItem>
              {regions.map(region => (
                <DropdownMenuItem key={region} onClick={() => setFilterRegion(region)}>
                  {region}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* 现金余额区域 - 紧凑显示 */}
        {cashHoldings.length > 0 && (
          <div className="mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                💰 现金余额
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {cashHoldings.map((cash) => {
                const currencySymbol = cash.currency === 'CNY' ? '¥' : 
                                      cash.currency === 'USD' ? '$' : 
                                      'HK$';
                
                return (
                  <div
                    key={cash.id}
                    className="group relative flex items-center justify-between px-3 py-2 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {cash.broker}
                      </div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        {currencySymbol}{cash.marketValueOriginal?.toLocaleString('en-US', { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                      </div>
                    </div>
                    
                    {/* 编辑按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditCash(cash);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 排序按钮 */}
        <div className="flex gap-2 mb-3 overflow-x-auto">
          <Button
            variant={sortBy === 'marketValue' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleSort('marketValue')}
            className="whitespace-nowrap"
          >
            市值
            <ArrowUpDown className="h-3 w-3 ml-1" />
          </Button>
          <Button
            variant={sortBy === 'unrealizedPnL' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleSort('unrealizedPnL')}
            className="whitespace-nowrap"
          >
            盈亏
            <ArrowUpDown className="h-3 w-3 ml-1" />
          </Button>
          <Button
            variant={sortBy === 'dayChange' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleSort('dayChange')}
            className="whitespace-nowrap"
          >
            今日涨跌
            <ArrowUpDown className="h-3 w-3 ml-1" />
          </Button>
        </div>

        {/* 股票持仓列表 */}
        <div className="space-y-3">
          {stockHoldings.map((holding) => {
            return (
              <div
                key={holding.id}
                className="p-4 rounded-lg border transition-all duration-200 cursor-pointer group bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-md"
                onClick={() => onHoldingClick?.(holding)}
              >
                <div className="flex items-center justify-between">
                  {/* 左侧：信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate text-slate-800 dark:text-slate-200">
                            {holding.name}
                          </h3>
                          <UIBadge variant="outline" className="text-xs">
                            {holding.symbol}
                          </UIBadge>
                          <UIBadge variant="secondary" className="text-xs">
                            {holding.region}
                          </UIBadge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-600 dark:text-slate-400">
                          <span>持仓: {holding.quantity.toLocaleString()}</span>
                          <span>成本: {formatCurrency(holding.costBasis, holding.currency)}</span>
                          <span>现价: {formatCurrency(holding.currentPrice, holding.currency)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 右侧：数据和操作 */}
                  <div className="flex items-center gap-6">
                    {/* 市值 */}
                    <div className="text-right">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(holding.marketValue, holding.currency)}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        市值
                      </p>
                    </div>

                    {/* 盈亏 */}
                    <div className="text-right">
                      <p className={`font-semibold ${getPnLColorClass(holding.unrealizedPnL, preferences.colorScheme)}`}>
                        {holding.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(holding.unrealizedPnL, holding.currency)}
                      </p>
                      <p className={`text-sm ${getPnLColorClass(holding.unrealizedPnL, preferences.colorScheme)}`}>
                        {formatPercent(holding.unrealizedPnLPercent)}
                      </p>
                    </div>

                    {/* 今日涨跌 */}
                    <div className="flex items-center gap-1">
                      {holding.dayChangePercent >= 0 ? (
                        <TrendingUp className={`h-4 w-4 ${getPnLColorClass(1, preferences.colorScheme)}`} />
                      ) : (
                        <TrendingDown className={`h-4 w-4 ${getPnLColorClass(-1, preferences.colorScheme)}`} />
                      )}
                      <div className="text-right">
                        <p className={`font-semibold ${getPnLColorClass(holding.dayChangePercent, preferences.colorScheme)}`}>
                          {formatPercent(holding.dayChangePercent)}
                        </p>
                        <p className={`text-sm ${getPnLColorClass(holding.dayChangePercent, preferences.colorScheme)}`}>
                          {holding.dayChange >= 0 ? '+' : ''}{formatCurrency(holding.dayChange, holding.currency)}
                        </p>
                      </div>
                    </div>

                    {/* 操作菜单 */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetail(holding);
                        }}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(holding);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          编辑持仓
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(holding);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除记录
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {stockHoldings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500 dark:text-slate-400">
              {searchTerm || filterRegion !== 'all' ? '没有找到匹配的持仓' : '暂无持仓数据'}
            </p>
          </div>
        )}
      </CardContent>

      {/* 对话框 */}
      <HoldingDetailDialog
        holding={selectedHolding}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />

      <EditHoldingDialog
        holding={selectedHolding}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSaveEdit}
      />

      <DeleteHoldingDialog
        holding={selectedHolding}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
      />

      <EditCashDialog
        accountId={selectedCashAccount?.accountId || null}
        accountName={selectedCashAccount?.accountName || null}
        broker={selectedCashAccount?.broker || null}
        initialAmount={selectedCashAccount?.amount || 0}
        initialCurrency={selectedCashAccount?.currency || 'CNY'}
        open={editCashDialogOpen}
        onOpenChange={setEditCashDialogOpen}
        onSave={handleSaveCash}
      />
    </Card>
  );
}