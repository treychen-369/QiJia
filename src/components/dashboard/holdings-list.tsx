'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  MoreHorizontal,
  Search,
  Filter,
  ArrowUpDown,
  Edit,
  Trash2,
  LayoutGrid,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Building2,
  ArrowLeftRight,
  Users,
  Plus,
  RefreshCw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { HoldingDetailDialog } from '@/components/holdings/holding-detail-dialog';
import { EditHoldingDialog, type EditHoldingData } from '@/components/holdings/edit-holding-dialog';
import { DeleteHoldingDialog } from '@/components/holdings/delete-holding-dialog';
import { EditCashDialog, type EditCashData } from '@/components/cash/edit-cash-dialog';
import { TransferHoldingDialog } from '@/components/holdings/transfer-holding-dialog';
import { useToast } from '@/components/ui/use-toast';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { getPnLColorClass } from '@/lib/user-preferences';
import { formatters } from '@/lib/api-client';

interface Holding {
  id: string;
  type?: 'holding' | 'cash'; // 类型标识
  symbol: string;
  name: string;
  accountName?: string; // 账户名称（现金项专用）
  broker?: string; // 券商名称（现金项专用）
  marketValueOriginal?: number; // 原币种市值
  quantity: number;
  currentPrice: number;
  costBasis: number;
  averageCost?: number; // 成本单价（原币种）
  marketValue: number; // CNY市值（统一标准）
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
  onAddHolding?: () => void;
  onManageAccounts?: () => void;
}

type ViewMode = 'account' | 'unified';

// 账户配色
const ACCOUNT_COLORS: Record<string, { bg: string; text: string; border: string; badge: string; iconBg: string }> = {
  '平安证券': { 
    bg: 'bg-orange-50 dark:bg-orange-950', 
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    iconBg: 'bg-orange-500',
  },
  '长桥证券': { 
    bg: 'bg-blue-50 dark:bg-blue-950', 
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    iconBg: 'bg-blue-500',
  },
};

export function HoldingsList({ holdings, isLoading = false, onHoldingClick, onRefresh, onAddHolding, onManageAccounts }: HoldingsListProps) {
  const preferences = useUserPreferences();
  
  // 视图模式 - 从 LocalStorage 读取，默认为按账户
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('holdingsViewMode') as ViewMode) || 'account';
    }
    return 'account';
  });

  // 保存视图模式到 LocalStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('holdingsViewMode', viewMode);
    }
  }, [viewMode]);

  // 账户折叠状态
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'marketValue' | 'unrealizedPnL' | 'dayChange'>('marketValue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  
  // 对话框状态
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editCashDialogOpen, setEditCashDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [selectedCashAccount, setSelectedCashAccount] = useState<{
    accountId: string;
    accountName: string;
    broker: string;
    amount: number;
    currency: string;
  } | null>(null);
  
  // 价格刷新状态
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  
  const { toast } = useToast();
  
  // 刷新证券价格
  const handleRefreshPrices = async () => {
    setIsRefreshingPrices(true);
    try {
      const response = await fetch('/api/prices/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await response.json();
      
      if (data.success) {
        const updatedCount = data.data?.totalUpdated ?? 0;
        const failedCount = data.data?.totalFailed ?? 0;
        const errors = data.errors || [];
        
        if (updatedCount > 0) {
          toast({
            title: '价格更新成功',
            description: `已更新 ${updatedCount} 个证券的价格`,
          });
        } else if (failedCount > 0 || errors.length > 0) {
          toast({
            title: '价格更新完成',
            description: errors.length > 0 ? errors[0] : '部分证券价格无法获取',
            variant: 'destructive',
          });
        } else {
          toast({
            title: '价格已是最新',
            description: '所有证券价格无变化',
          });
        }
        // 刷新持仓数据
        onRefresh?.();
      } else {
        throw new Error(data.error || '更新失败');
      }
    } catch (error) {
      console.error('刷新价格失败:', error);
      toast({
        title: '刷新失败',
        description: error instanceof Error ? error.message : '无法更新证券价格',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshingPrices(false);
    }
  };

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

  // 按账户分组数据（使用 accountName 作为唯一标识）
  const holdingsByAccount = useMemo(() => {
    const groups: Record<string, { 
      accountName: string;
      broker: string; 
      holdings: Holding[]; 
      cash: Holding | null;
      totalValue: number;
      totalValueCNY: number;
      currency: string;
    }> = {};

    filteredAndSortedHoldings.forEach(holding => {
      // 使用 accountName 作为分组 key，如果没有则用 broker
      const key = holding.accountName || holding.broker || 'Unknown';
      
      if (!groups[key]) {
        groups[key] = {
          accountName: key,
          broker: holding.broker || key,
          holdings: [],
          cash: null,
          totalValue: 0,
          totalValueCNY: 0,
          currency: holding.currency,
        };
      }

      if (holding.type === 'cash') {
        groups[key].cash = holding;
        groups[key].totalValueCNY += holding.marketValue || 0;
      } else {
        groups[key].holdings.push(holding);
        groups[key].totalValueCNY += holding.marketValue || 0;
      }
    });

    // 计算每个账户的原币种总市值
    Object.keys(groups).forEach(key => {
      const group = groups[key];
      // 现金原币种金额
      const cashValue = group.cash?.marketValueOriginal || 0;
      // 持仓原币种市值总和
      const holdingsValue = group.holdings.reduce((sum, h) => {
        return sum + (h.marketValueOriginal || 0);
      }, 0);
      // 账户总值（原币种）
      group.totalValue = cashValue + holdingsValue;
    });

    return groups;
  }, [filteredAndSortedHoldings]); // ✅ 移除了不需要的 getExchangeRate 依赖

  // 切换账户展开状态
  const toggleAccountExpanded = (broker: string) => {
    setExpandedAccounts(prev => ({
      ...prev,
      [broker]: !prev[broker]
    }));
  };

  // 初始化新增账户为折叠状态（默认折叠，优化体验）
  useEffect(() => {
    setExpandedAccounts(prev => {
      const newAccounts: Record<string, boolean> = { ...prev };
      let hasChanges = false;
      
      Object.keys(holdingsByAccount).forEach(broker => {
        if (!(broker in prev)) {
          newAccounts[broker] = false;  // 默认折叠
          hasChanges = true;
        }
      });
      
      return hasChanges ? newAccounts : prev;
    });
  }, [Object.keys(holdingsByAccount).join(',')]);

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

  // 处理转移持仓
  const handleTransfer = (holding: Holding) => {
    setSelectedHolding(holding);
    setTransferDialogOpen(true);
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

  // 保存现金编辑 - 调用新的账户现金余额API
  const handleSaveCash = async (accountId: string, data: EditCashData) => {
    console.log('=== 开始保存现金编辑 ===');
    console.log('账户ID:', accountId);
    console.log('更新数据:', data);
    
    try {
      const url = `/api/accounts/${accountId}/cash`;
      console.log('请求 URL:', url);
      
      // ✨ 2026-01-31: 使用新的API接口，只传递 cashBalance
      const requestData = { cashBalance: data.cashBalanceOriginal };
      console.log('请求数据:', JSON.stringify(requestData));
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
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

  // 保存持仓转移
  const handleSaveTransfer = async (data: {
    sourceHoldingId: string
    targetAccountId: string
    quantity: number
    transferType: 'partial' | 'full'
    reason?: string
  }) => {
    try {
      const response = await fetch('/api/holdings/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('转移失败');
      }

      toast({
        title: '转移成功',
        description: '持仓已成功转移到目标账户',
      });

      // 刷新列表
      onRefresh?.();
    } catch (error) {
      console.error('转移持仓失败:', error);
      toast({
        title: '转移失败',
        description: '无法转移持仓，请重试',
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
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-slate-800 dark:text-slate-200 text-base sm:text-lg">
            持仓列表
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {/* 刷新价格按钮 */}
            <Button 
              onClick={handleRefreshPrices}
              size="sm"
              variant="outline"
              disabled={isRefreshingPrices}
              title="刷新证券实时价格"
              className="h-7 w-7 sm:h-8 sm:w-auto sm:px-2 p-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingPrices ? 'animate-spin' : ''}`} />
            </Button>
            {/* 添加持仓按钮 */}
            {onAddHolding && (
              <Button 
                onClick={onAddHolding}
                size="sm"
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 h-7 w-7 sm:h-8 sm:w-auto sm:px-2 p-0"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
            {/* 账户管理按钮 */}
            {onManageAccounts && (
              <Button 
                onClick={onManageAccounts}
                size="sm"
                variant="outline"
                className="h-7 w-7 sm:h-8 sm:w-auto sm:px-2 p-0"
              >
                <Users className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        
        {/* 第二行：视图切换和统计 */}
        <div className="flex items-center justify-between mt-2">
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
            <TabsList className="grid w-[120px] sm:w-[160px] grid-cols-2 h-7">
              <TabsTrigger value="account" className="text-[10px] sm:text-xs px-1">
                <Building2 className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">按</span>账户
              </TabsTrigger>
              <TabsTrigger value="unified" className="text-[10px] sm:text-xs px-1">
                <BarChart3 className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">按</span>市值
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] h-5 px-1.5">
            {stockHoldings.length}只
          </Badge>
        </div>
        
        {/* 搜索和过滤栏 - 更紧凑 */}
        <div className="flex items-center gap-1.5 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
            <Input
              placeholder="搜索股票..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-7 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] whitespace-nowrap">
                <Filter className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">{filterRegion === 'all' ? '全部' : filterRegion}</span>
                <span className="sm:hidden">筛</span>
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
      
      <CardContent className="pt-0">
        {/* 汇总卡片 */}
        {filteredAndSortedHoldings.length > 0 && (() => {
          const totalMarketValue = filteredAndSortedHoldings.reduce((sum, h) => sum + h.marketValue, 0);
          const totalUnrealizedPnL = filteredAndSortedHoldings.reduce((sum, h) => sum + h.unrealizedPnL, 0);
          // 总成本 = 总市值 - 总盈亏（costBasis字段是单价，不能直接求和）
          const totalCostBasis = totalMarketValue - totalUnrealizedPnL;
          const totalPnLPercent = totalCostBasis > 0 ? (totalUnrealizedPnL / totalCostBasis) * 100 : 0;
          
          return (
            <div className="mb-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              {/* 移动端：横向紧凑布局 */}
              <div className="flex items-center justify-between sm:hidden">
                <div>
                  <div className="text-[10px] text-muted-foreground">总市值</div>
                  <div className="text-sm font-bold">
                    {formatters.currency(totalMarketValue)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">盈亏</div>
                  <div className={`text-sm font-bold ${getPnLColorClass(totalUnrealizedPnL, preferences.colorScheme)}`}>
                    {totalUnrealizedPnL >= 0 ? '+' : ''}{formatters.currency(totalUnrealizedPnL)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">收益率</div>
                  <div className={`text-sm font-bold ${getPnLColorClass(totalPnLPercent, preferences.colorScheme)}`}>
                    {totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(1)}%
                  </div>
                </div>
              </div>
              {/* 桌面端：三列布局 */}
              <div className="hidden sm:grid sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">总市值</div>
                  <div className="text-base font-bold">
                    {formatters.currency(totalMarketValue)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">总盈亏</div>
                  <div className={`text-base font-bold ${getPnLColorClass(totalUnrealizedPnL, preferences.colorScheme)}`}>
                    {totalUnrealizedPnL >= 0 ? '+' : ''}{formatters.currency(totalUnrealizedPnL)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">收益率</div>
                  <div className={`text-base font-bold ${getPnLColorClass(totalPnLPercent, preferences.colorScheme)}`}>
                    {totalPnLPercent >= 0 ? '+' : ''}{formatters.percentage(totalPnLPercent)}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        
        {/* 排序按钮 - 仅在统一视图显示 */}
        {viewMode === 'unified' && (
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto scrollbar-hide">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">排序:</span>
            <Button
              variant={sortBy === 'marketValue' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('marketValue')}
              className="h-6 text-[10px] px-2 whitespace-nowrap"
            >
              市值
              {sortBy === 'marketValue' && (
                sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />
              )}
            </Button>
            <Button
              variant={sortBy === 'unrealizedPnL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('unrealizedPnL')}
              className="h-6 text-[10px] px-2 whitespace-nowrap"
            >
              盈亏
              {sortBy === 'unrealizedPnL' && (
                sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />
              )}
            </Button>
            <Button
              variant={sortBy === 'dayChange' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('dayChange')}
              className="h-6 text-[10px] px-2 whitespace-nowrap"
            >
              今日
              {sortBy === 'dayChange' && (
                sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />
              )}
            </Button>
          </div>
        )}

        {/* 按账户视图 */}
        {viewMode === 'account' && (
          <div className="space-y-4">
            {Object.entries(holdingsByAccount).map(([accountName, group]) => {
              const isExpanded = expandedAccounts[accountName] ?? false;  // 默认折叠
              const accountColor = ACCOUNT_COLORS[group.broker] || {
                bg: 'bg-slate-50 dark:bg-slate-900',
                text: 'text-slate-700 dark:text-slate-300',
                border: 'border-slate-200 dark:border-slate-700',
                badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                iconBg: 'bg-slate-500',
              };

              return (
                <div 
                  key={accountName} 
                  className={`rounded-lg border overflow-hidden ${accountColor.border}`}
                >
                  {/* 账户头部 - 更紧凑 */}
                  <div 
                    className={`px-2.5 py-2 ${accountColor.bg} cursor-pointer flex items-center justify-between`}
                    onClick={() => toggleAccountExpanded(accountName)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accountColor.iconBg} text-white`}>
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className={`text-base font-semibold truncate ${accountColor.text}`}>
                          {accountName}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                          {group.holdings.length}只 • {formatCurrency(group.totalValue, group.currency)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-xs font-semibold ${accountColor.text}`}>
                        {formatCurrency(group.totalValueCNY, 'CNY')}
                      </span>
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 账户内容 */}
                  {isExpanded && (
                    <div className="p-1.5 space-y-1.5 bg-white dark:bg-slate-800">
                      {/* 现金行 - 更紧凑 */}
                      {group.cash && (
                        <div className="group flex items-center justify-between px-2 py-1.5 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">💰</span>
                            <div>
                              <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                现金余额
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                {group.cash.currency}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                {formatCurrency(group.cash.marketValueOriginal || 0, group.cash.currency)}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                ≈ {formatCurrency(group.cash.marketValue || 0, 'CNY')}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditCash(group.cash!);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* 股票列表 */}
                      {group.holdings.map((holding) => (
                          <div
                          key={holding.id}
                          className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer group bg-white dark:bg-slate-800"
                          onClick={() => handleViewDetail(holding)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            {/* 左侧信息 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                  {holding.name}
                                </h4>
                                <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
                                  {holding.symbol}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0 hidden sm:inline-flex">
                                  {holding.region}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                                <span>持仓{holding.quantity.toLocaleString()}</span>
                                <span>成本{formatCurrency(holding.costBasis, holding.currency)}</span>
                                <span className="hidden sm:inline">现价{formatCurrency(holding.currentPrice, holding.currency)}</span>
                              </div>
                            </div>

                            {/* 右侧数据 */}
                            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                              {/* 市值 */}
                              <div className="text-right">
                                <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                                  {formatCurrency(holding.marketValueOriginal || holding.marketValue, holding.currency)}
                                </p>
                                <p className="text-[9px] text-slate-500 dark:text-slate-400">
                                  {holding.currency !== 'CNY' && (
                                    <span>≈{formatCurrency(holding.marketValue, 'CNY')}</span>
                                  )}
                                </p>
                              </div>

                              {/* 盈亏 */}
                              <div className="text-right min-w-[60px]">
                                <p className={`text-xs font-semibold ${getPnLColorClass(holding.unrealizedPnL, preferences.colorScheme)}`}>
                                  {holding.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(holding.unrealizedPnL, 'CNY')}
                                </p>
                                <p className={`text-[9px] ${getPnLColorClass(holding.unrealizedPnL, preferences.colorScheme)}`}>
                                  {formatPercent(holding.unrealizedPnLPercent)}
                                </p>
                              </div>

                              {/* 今日涨跌 */}
                              <div className="hidden sm:flex items-center gap-0.5">
                                {holding.dayChangePercent >= 0 ? (
                                  <TrendingUp className={`h-2.5 w-2.5 ${getPnLColorClass(1, preferences.colorScheme)}`} />
                                ) : (
                                  <TrendingDown className={`h-2.5 w-2.5 ${getPnLColorClass(-1, preferences.colorScheme)}`} />
                                )}
                                <div className="text-right min-w-[50px]">
                                  <p className={`text-xs font-medium ${getPnLColorClass(holding.dayChangePercent, preferences.colorScheme)}`}>
                                    {formatPercent(holding.dayChangePercent)}
                                  </p>
                                </div>
                              </div>

                              {/* 操作菜单 */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(holding);
                                  }}>
                                    <Edit className="h-3.5 w-3.5 mr-1.5" />
                                    编辑
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    handleTransfer(holding);
                                  }}>
                                    <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />
                                    转移
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(holding);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                    删除
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {Object.keys(holdingsByAccount).length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">
                  暂无账户数据
                </p>
              </div>
            )}
          </div>
        )}

        {/* 按市值统一视图 */}
        {viewMode === 'unified' && (
          <div className="space-y-1.5">
            {stockHoldings.map((holding) => (
              <div
                key={holding.id}
                className="p-3 rounded-lg border transition-all duration-200 cursor-pointer group bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-md"
                onClick={() => handleViewDetail(holding)}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* 左侧：信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-medium truncate text-slate-800 dark:text-slate-200">
                        {holding.name}
                      </h3>
                      <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
                        {holding.symbol}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0 hidden sm:inline-flex">
                        {holding.region}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                      <span>持仓{holding.quantity.toLocaleString()}</span>
                      <span>成本{formatCurrency(holding.costBasis, holding.currency)}</span>
                      <span className="hidden sm:inline">现价{formatCurrency(holding.currentPrice, holding.currency)}</span>
                    </div>
                  </div>

                  {/* 右侧：数据和操作 */}
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    {/* 市值（CNY） */}
                    <div className="text-right">
                      <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                        {formatCurrency(holding.marketValue, 'CNY')}
                      </p>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400">
                        市值
                      </p>
                    </div>

                    {/* 盈亏 */}
                    <div className="text-right min-w-[60px]">
                      <p className={`text-xs font-semibold ${getPnLColorClass(holding.unrealizedPnL, preferences.colorScheme)}`}>
                        {holding.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(holding.unrealizedPnL, 'CNY')}
                      </p>
                      <p className={`text-[9px] ${getPnLColorClass(holding.unrealizedPnL, preferences.colorScheme)}`}>
                        {formatPercent(holding.unrealizedPnLPercent)}
                      </p>
                    </div>

                    {/* 今日涨跌 - 桌面端显示 */}
                    <div className="hidden sm:flex items-center gap-0.5">
                      {holding.dayChangePercent >= 0 ? (
                        <TrendingUp className={`h-2.5 w-2.5 ${getPnLColorClass(1, preferences.colorScheme)}`} />
                      ) : (
                        <TrendingDown className={`h-2.5 w-2.5 ${getPnLColorClass(-1, preferences.colorScheme)}`} />
                      )}
                      <div className="text-right min-w-[50px]">
                        <p className={`text-xs font-medium ${getPnLColorClass(holding.dayChangePercent, preferences.colorScheme)}`}>
                          {formatPercent(holding.dayChangePercent)}
                        </p>
                      </div>
                    </div>

                    {/* 操作菜单 */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(holding);
                        }}>
                          <Edit className="h-3.5 w-3.5 mr-1.5" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleTransfer(holding);
                        }}>
                          <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />
                          转移
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(holding);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}

            {stockHoldings.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">
                  {searchTerm || filterRegion !== 'all' ? '没有找到匹配的持仓' : '暂无持仓数据'}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* 对话框 */}
      <HoldingDetailDialog
        holding={selectedHolding}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onRefresh={onRefresh}
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

      <TransferHoldingDialog
        holding={selectedHolding ? {
          id: selectedHolding.id,
          securityName: selectedHolding.name,
          symbol: selectedHolding.symbol,
          quantity: selectedHolding.quantity,
          averageCost: selectedHolding.averageCost ?? selectedHolding.costBasis,
          accountId: selectedHolding.id, // 需要从API获取真实的accountId
          accountName: selectedHolding.accountName || '',
        } : null}
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onSuccess={() => {
          // 转移成功后刷新持仓列表
          onRefresh?.();
        }}
      />
    </Card>
  );
}