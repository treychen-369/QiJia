'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown,
  MoreVertical,
  Search,
  Wallet,
  Building2,
  PiggyBank,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { AddCashAssetDialog } from '@/components/assets/add-cash-asset-dialog';
import { AssetDetailDialog } from '@/components/assets/asset-detail-dialog';
import { EditAssetDialog } from '@/components/assets/edit-asset-dialog';
import { DeleteAssetDialog } from '@/components/assets/delete-asset-dialog';
import { formatters } from '@/lib/api-client';
import { calculateFixedDepositInterest } from '@/lib/fixed-deposit-calculator';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { getPnLColorClass } from '@/lib/user-preferences';

interface Asset {
  id: string;
  name: string;
  description: string | null;
  assetCategory: {
    id: string;
    name: string;
    code: string | null;
    parent: {
      id: string;
      name: string;
      code: string | null;
    } | null;
  };
  quantity: number;
  purchasePrice: number;
  currentValue: number;
  originalValue: number | null;
  currency: string;
  unrealizedPnl: number | null;
  unrealizedPnlPercent: number | null;
  purchaseDate: string | null;
  maturityDate: string | null;
  metadata: any;
  lastUpdated: string;
  createdAt: string;
  underlyingType?: string | null;
}

interface CashAssetsListProps {
  assets: Asset[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onAddSuccess?: () => void; // ✅ 新增：添加成功后的回调
}

// 资产类型图标映射
const getAssetIcon = (code: string | null) => {
  switch (code) {
    case 'CASH_DEMAND':
      return <Wallet className="h-4 w-4" />;
    case 'CASH_FIXED':
      return <PiggyBank className="h-4 w-4" />;
    case 'CASH_MONEY_FUND':
      return <Sparkles className="h-4 w-4" />;
    case 'CASH_BROKER':
      return <Building2 className="h-4 w-4" />;
    default:
      return <Wallet className="h-4 w-4" />;
  }
};

export function CashAssetsList({ assets, isLoading = false, onRefresh, onAddSuccess }: CashAssetsListProps) {
  const preferences = useUserPreferences();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'value' | 'yield'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  
  // ✅ 分组展开状态（默认全部收起，与证券持仓一致）
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'CASH_DEMAND': false,
    'CASH_FIXED': false,
    'CASH_MONEY_FUND': false,
    'CASH_BROKER': false,
  });

  // 过滤资产
  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.assetCategory.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ✅ 排序和分组资产
  const groupedAndSortedAssets = useMemo(() => {
    // 按类型分组
    const groups: Record<string, Asset[]> = {
      'CASH_DEMAND': [],
      'CASH_FIXED': [],
      'CASH_MONEY_FUND': [],
      'CASH_BROKER': [],
    };

    filteredAssets.forEach(asset => {
      const code = asset.assetCategory.code;
      if (code && groups[code]) {
        groups[code].push(asset);
      }
    });

    // 对每个分组内的资产进行排序
    Object.keys(groups).forEach(key => {
      const groupAssets = groups[key];
      if (!groupAssets) return;
      groupAssets.sort((a, b) => {
        let aValue: number, bValue: number;
        
        switch (sortBy) {
          case 'name':
            return sortOrder === 'asc' 
              ? a.name.localeCompare(b.name, 'zh-CN')
              : b.name.localeCompare(a.name, 'zh-CN');
          case 'value':
            aValue = Number(a.currentValue);
            bValue = Number(b.currentValue);
            break;
          case 'yield':
            aValue = Number(a.unrealizedPnlPercent || 0);
            bValue = Number(b.unrealizedPnlPercent || 0);
            break;
          default:
            return 0;
        }
        
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      });
    });

    return groups;
  }, [filteredAssets, sortBy, sortOrder]);

  // ⭐ 计算总计：直接使用API返回的实时计算结果
  const { totalValue, totalPnl } = filteredAssets.reduce((acc, asset) => {
    // API已经完成了实时计算（货币基金、定期存款等）
    // 前端直接使用返回的 currentValue 和 unrealizedPnl
    const assetValue = Number(asset.currentValue);
    const assetPnl = Number(asset.unrealizedPnl || 0);
    
    return {
      totalValue: acc.totalValue + assetValue,
      totalPnl: acc.totalPnl + assetPnl,
    };
  }, { totalValue: 0, totalPnl: 0 });
  
  const totalPnlPercent = totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;

  // ✅ 排序切换
  const toggleSort = (newSortBy: 'name' | 'value' | 'yield') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  // ✅ 分组信息
  const groupInfo = {
    'CASH_DEMAND': { name: '活期存款', icon: Wallet, color: 'bg-blue-500' },
    'CASH_FIXED': { name: '定期存款', icon: PiggyBank, color: 'bg-green-500' },
    'CASH_MONEY_FUND': { name: '货币基金', icon: Sparkles, color: 'bg-purple-500' },
    'CASH_BROKER': { name: '券商现金', icon: Building2, color: 'bg-orange-500' },
  };

  const handleViewDetail = (asset: Asset) => {
    setSelectedAsset(asset);
    setDetailDialogOpen(true);
  };

  const handleEdit = (asset: Asset) => {
    setSelectedAsset(asset);
    setEditDialogOpen(true);
  };

  const handleDelete = (asset: Asset) => {
    setSelectedAsset(asset);
    setDeleteDialogOpen(true);
  };

  const handleRefresh = () => {
    onRefresh?.();
    onAddSuccess?.(); // ✅ 通知父组件切换到 cash Tab
  };

  if (isLoading) {
    return (
      <CardContent className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </CardContent>
    );
  }

  return (
    <>
      {/* 头部 */}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-slate-800 dark:text-slate-200 text-base sm:text-lg">
            现金资产列表
          </CardTitle>
          <Button 
            onClick={() => setAddDialogOpen(true)}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 h-7 w-7 sm:h-8 sm:w-auto sm:px-2 p-0"
            size="sm"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* 搜索和筛选栏 - 更紧凑 */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
            <Input
              placeholder="搜索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-7 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            />
          </div>
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] h-5 px-1.5">
            {filteredAssets.length}项
          </Badge>
        </div>

        {/* 汇总卡片 */}
        {filteredAssets.length > 0 && (
          <div className="mb-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            {/* 移动端：横向紧凑布局 */}
            <div className="flex items-center justify-between sm:hidden">
              <div>
                <div className="text-[10px] text-muted-foreground">总价值</div>
                <div className="text-sm font-bold">
                  {formatters.currency(totalValue)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">收益</div>
                <div className={`text-sm font-bold ${getPnLColorClass(totalPnl, preferences.colorScheme)}`}>
                  {totalPnl >= 0 ? '+' : ''}{formatters.currency(totalPnl)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">收益率</div>
                <div className={`text-sm font-bold ${getPnLColorClass(totalPnlPercent, preferences.colorScheme)}`}>
                  {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(1)}%
                </div>
              </div>
            </div>
            {/* 桌面端：三列布局 */}
            <div className="hidden sm:grid sm:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">总价值</div>
                <div className="text-base font-bold">
                  {formatters.currency(totalValue)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">收益</div>
                <div className={`text-base font-bold ${getPnLColorClass(totalPnl, preferences.colorScheme)}`}>
                  {totalPnl >= 0 ? '+' : ''}{formatters.currency(totalPnl)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">收益率</div>
                <div className={`text-base font-bold ${getPnLColorClass(totalPnlPercent, preferences.colorScheme)}`}>
                  {totalPnlPercent >= 0 ? '+' : ''}{formatters.percentage(totalPnlPercent)}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 排序按钮 - 更紧凑 */}
        {filteredAssets.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto scrollbar-hide">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">排序:</span>
            <Button
              variant={sortBy === 'value' ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleSort('value')}
              className="h-6 text-[10px] px-2"
            >
              金额
              {sortBy === 'value' && (
                sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />
              )}
            </Button>
            <Button
              variant={sortBy === 'yield' ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleSort('yield')}
              className="h-6 text-[10px] px-2"
            >
              收益
              {sortBy === 'yield' && (
                sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />
              )}
            </Button>
            <Button
              variant={sortBy === 'name' ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleSort('name')}
              className="h-6 text-[10px] px-2"
            >
              名称
              {sortBy === 'name' && (
                sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />
              )}
            </Button>
          </div>
        )}

        {/* 资产列表（分组显示） */}
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">暂无现金资产</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm ? '没有找到匹配的资产' : '点击上方按钮添加您的第一笔现金资产'}
            </p>
            {!searchTerm && (
              <Button 
                onClick={() => setAddDialogOpen(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                size="sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                添加现金资产
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* 遍历每个资产类型分组 */}
            {(Object.keys(groupedAndSortedAssets) as Array<keyof typeof groupedAndSortedAssets>).map((groupKey) => {
              const groupAssets = groupedAndSortedAssets[groupKey];
              if (!groupAssets || groupAssets.length === 0) return null;

              const info = (groupInfo as any)[groupKey];
              const IconComponent = info.icon;
              const groupValue = groupAssets.reduce((sum, asset) => sum + Number(asset.currentValue), 0);
              const groupPnl = groupAssets.reduce((sum, asset) => sum + Number(asset.unrealizedPnl || 0), 0);

              return (
                <Collapsible
                  key={groupKey}
                  open={expandedGroups[groupKey]}
                  onOpenChange={(open) => setExpandedGroups(prev => ({ ...prev, [groupKey]: open }))}
                >
                  <Card className="border-slate-200 dark:border-slate-700">
                    <CollapsibleTrigger className="w-full">
                      <CardContent className="p-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          {/* 左侧：分组信息 */}
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${info.color} text-white`}>
                              <IconComponent className="h-5 w-5" />
                            </div>
                            <div className="text-left">
                              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                {info.name}
                                <span className="text-xs text-muted-foreground">({groupAssets.length})</span>
                              </h3>
                              <div className="text-xs text-slate-600 dark:text-slate-400">
                                {formatters.currency(groupValue)}
                                {groupPnl !== 0 && (
                                  <span className={`ml-1.5 ${groupPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {groupPnl >= 0 ? '+' : ''}{formatters.currency(groupPnl)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 右侧：展开图标 */}
                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                            {expandedGroups[groupKey] ? (
                              <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t border-slate-100 dark:border-slate-700 p-1.5 space-y-1.5">
                        {groupAssets.map((asset) => {
                          // ⭐ 直接使用API返回的实时计算结果（无需前端重复计算）
                          const displayValue = Number(asset.currentValue); // API已换算为CNY
                          const displayPnl = Number(asset.unrealizedPnl ?? 0); // API已计算收益
                          const displayPnlPercent = Number(asset.unrealizedPnlPercent ?? 0); // API已计算收益率
                          const originalValue = asset.originalValue != null ? Number(asset.originalValue) : Number(asset.purchasePrice); // 原币种金额
                          
                          return (
                            <div
                              key={asset.id}
                              className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer group bg-white dark:bg-slate-800"
                              onClick={() => handleViewDetail(asset)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                {/* 左侧：资产名称 */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate flex-1 min-w-0">
                                      {asset.name}
                                    </h4>
                                    <span className="text-[10px] text-slate-400 shrink-0">{asset.currency}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                                    {asset.maturityDate && (
                                      <span>到期 {new Date(asset.maturityDate).toLocaleDateString('zh-CN', {month:'numeric', day:'numeric'})}</span>
                                    )}
                                  </div>
                                </div>

                                {/* 右侧：金额和收益 */}
                                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                  {/* 主要金额列 */}
                                  <div className="text-right">
                                    <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                                      {formatters.currency(displayValue)}
                                    </p>
                                    {asset.currency !== 'CNY' && (
                                      <p className="text-[9px] text-slate-500 dark:text-slate-400">
                                        {asset.currency} {originalValue.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                      </p>
                                    )}
                                  </div>

                                  {/* 盈亏列 */}
                                  {displayPnl !== null && displayPnl !== 0 && (
                                    <div className="text-right min-w-[50px]">
                                      <p className={`text-xs font-semibold ${getPnLColorClass(displayPnl, preferences.colorScheme)}`}>
                                        {displayPnl >= 0 ? '+' : ''}{formatters.currency(Math.abs(displayPnl))}
                                      </p>
                                      <p className={`text-[9px] ${getPnLColorClass(displayPnl, preferences.colorScheme)}`}>
                                        {formatters.percentage(displayPnlPercent ?? 0)}
                                      </p>
                                    </div>
                                  )}

                                  {/* 操作菜单 */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                                      >
                                        <MoreVertical className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(asset);
                                      }}>
                                        <Edit className="h-3.5 w-3.5 mr-1.5" />
                                        编辑
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-red-600"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(asset);
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
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* 对话框 */}
      <AddCashAssetDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={handleRefresh}
      />

      {selectedAsset && (
        <>
          <AssetDetailDialog
            open={detailDialogOpen}
            onOpenChange={setDetailDialogOpen}
            asset={selectedAsset}
            onEdit={() => {
              setDetailDialogOpen(false);
              setEditDialogOpen(true);
            }}
            onDelete={() => {
              setDetailDialogOpen(false);
              setDeleteDialogOpen(true);
            }}
          />

          <EditAssetDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            asset={selectedAsset}
            onSuccess={handleRefresh}
          />

          <DeleteAssetDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            asset={selectedAsset}
            onSuccess={handleRefresh}
          />
        </>
      )}
    </>
  );
}
