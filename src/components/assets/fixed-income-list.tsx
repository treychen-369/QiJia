'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, ArrowDown, ArrowUp, TrendingUp, TrendingDown, MoreHorizontal, Edit, Trash2, PieChart, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { formatters } from '@/lib/api-client';
import { getPnLColorClass } from '@/lib/user-preferences';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { AddFixedIncomeDialog } from './add-fixed-income-dialog';
import { EditAssetDialog } from './edit-asset-dialog';
import { AssetDetailDialog } from './asset-detail-dialog';
import { DeleteAssetDialog } from './delete-asset-dialog';

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

interface FixedIncomeListProps {
  assets: Asset[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onAddSuccess?: () => void;
}

export function FixedIncomeList({ 
  assets, 
  isLoading = false, 
  onRefresh,
  onAddSuccess 
}: FixedIncomeListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'pnl' | 'yield' | 'maturity'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const preferences = useUserPreferences();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const handleAddSuccess = () => {
    onAddSuccess?.();
    onRefresh?.();
  };

  const handleEditClick = (asset: Asset) => {
    setSelectedAsset(asset);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    onRefresh?.();
  };

  const handleViewDetail = (asset: Asset) => {
    setSelectedAsset(asset);
    setDetailDialogOpen(true);
  };

  const handleDelete = (asset: Asset) => {
    setSelectedAsset(asset);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSuccess = () => {
    onRefresh?.();
  };

  // 过滤资产
  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.assetCategory.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 排序资产
  const sortedAssets = [...filteredAssets].sort((a, b) => {
    let aValue: number, bValue: number;
    
    switch (sortBy) {
      case 'value':
        aValue = a.currentValue;
        bValue = b.currentValue;
        break;
      case 'pnl':
        aValue = a.unrealizedPnl || 0;
        bValue = b.unrealizedPnl || 0;
        break;
      case 'yield':
        aValue = a.unrealizedPnlPercent || 0;
        bValue = b.unrealizedPnlPercent || 0;
        break;
      case 'maturity':
        aValue = a.maturityDate ? new Date(a.maturityDate).getTime() : 0;
        bValue = b.maturityDate ? new Date(b.maturityDate).getTime() : 0;
        break;
      default:
        aValue = a.currentValue;
        bValue = b.currentValue;
    }
    
    return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
  });

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // 计算汇总数据
  const totalValue = filteredAssets.reduce((sum, asset) => sum + asset.currentValue, 0);
  const totalPnl = filteredAssets.reduce((sum, asset) => sum + (asset.unrealizedPnl || 0), 0);
  const totalPnlPercent = totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;

  // 按资产类型分组
  const groupedAssets = sortedAssets.reduce((groups, asset) => {
    const type = asset.assetCategory.code || 'OTHER';
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(asset);
    return groups;
  }, {} as Record<string, Asset[]>);

  const groupInfo = {
    'FIXED_BOND': { name: '债券', icon: PieChart, color: 'bg-orange-500' },
    'FIXED_CONVERTIBLE': { name: '可转债', icon: TrendingUp, color: 'bg-yellow-500' },
    'FIXED_WEALTH': { name: '理财产品', icon: PieChart, color: 'bg-green-500' },
    'OTHER': { name: '其他', icon: MoreHorizontal, color: 'bg-gray-500' }
  };

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-0 shadow-xl">
      {/* 区域1：头部（CardHeader） */}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-slate-800 dark:text-slate-200 text-base sm:text-lg">
            固定收益列表
          </CardTitle>
          <Button 
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 h-7 w-7 sm:h-8 sm:w-auto sm:px-2 p-0"
            size="sm"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      {/* 区域2：内容（CardContent） */}
      <CardContent className="pt-0">
        {/* 2.1 搜索和筛选栏 - 更紧凑 */}
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
          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-[10px] h-5 px-1.5">
            {filteredAssets.length}项
          </Badge>
        </div>

        {/* 2.2 汇总卡片 - 紧凑横向布局 */}
        {filteredAssets.length > 0 && (
          <div className="mb-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            {/* 移动端：横向紧凑布局 */}
            <div className="flex items-center justify-between sm:hidden">
              <div>
                <div className="text-[10px] text-muted-foreground">总价值</div>
                <div className="text-sm font-bold">{formatters.currency(totalValue)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">总收益</div>
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
                <div className="text-base font-bold">{formatters.currency(totalValue)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">总收益</div>
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

        {/* 2.3 排序按钮（有数据时显示） */}
        {filteredAssets.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto scrollbar-hide">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">排序:</span>
            <Button
              variant={sortBy === 'value' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('value')}
              className="h-6 text-[10px] px-2"
            >
              金额
              {sortBy === 'value' && (
                sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />
              )}
            </Button>
            <Button
              variant={sortBy === 'pnl' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('pnl')}
              className="h-6 text-[10px] px-2"
            >
              收益
              {sortBy === 'pnl' && (
                sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />
              )}
            </Button>
            <Button
              variant={sortBy === 'yield' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('yield')}
              className="h-6 text-[10px] px-2"
            >
              收益率
              {sortBy === 'yield' && (
                sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />
              )}
            </Button>
            <Button
              variant={sortBy === 'maturity' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('maturity')}
              className="h-6 text-[10px] px-2"
            >
              到期日
              {sortBy === 'maturity' && (
                sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />
              )}
            </Button>
          </div>
        )}

        {/* 2.4 列表内容 */}
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <PieChart className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">暂无固定收益产品</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm ? '没有找到匹配的资产' : '点击上方按钮添加您的第一笔固定收益投资'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                添加固定收益
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(groupedAssets).map(([type, typeAssets]) => {
              const info = groupInfo[type as keyof typeof groupInfo] || groupInfo.OTHER;
              const IconComponent = info.icon;
              const groupValue = typeAssets.reduce((sum, asset) => sum + asset.currentValue, 0);
              const groupPnl = typeAssets.reduce((sum, asset) => sum + (asset.unrealizedPnl || 0), 0);
              
              return (
                <Collapsible
                  key={type}
                  open={expandedGroups[type] ?? false}
                  onOpenChange={(open) => setExpandedGroups(prev => ({ ...prev, [type]: open }))}
                >
                  <Card className="border-slate-200 dark:border-slate-700">
                    <CollapsibleTrigger className="w-full">
                      <CardContent className="p-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${info.color} text-white`}>
                              <IconComponent className="h-5 w-5" />
                            </div>
                            <div className="text-left">
                              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                {info.name}
                                <span className="text-xs text-muted-foreground">({typeAssets.length})</span>
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
                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                            {expandedGroups[type] ? (
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
                  {typeAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer group bg-white dark:bg-slate-800"
                      onClick={() => handleViewDetail(asset)}
                    >
                      <div className="flex items-center justify-between">
                        {/* 左侧信息 */}
                        <div className="flex-1 min-w-0">
                          {/* 标题行 */}
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                              {asset.name}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {asset.currency}
                            </Badge>
                          </div>
                          
                          {/* 副标题行 */}
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 dark:text-slate-400">
                            {/* 显示票面利率或预期收益率 */}
                            {asset.metadata?.couponRate && (
                              <span>票面利率: {asset.metadata.couponRate}%</span>
                            )}
                            {asset.metadata?.expectedReturn && (
                              <span>预期收益: {asset.metadata.expectedReturn}%</span>
                            )}
                            {asset.maturityDate && (
                              <span>到期: {new Date(asset.maturityDate).toLocaleDateString('zh-CN')}</span>
                            )}
                          </div>
                        </div>

                        {/* 右侧数据 */}
                        <div className="flex items-center gap-4">
                          {/* 主要金额列 */}
                          <div className="text-right">
                            <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                              {formatters.currency(asset.currentValue)}
                            </p>
                            {asset.currency !== 'CNY' && asset.originalValue && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {asset.currency} {asset.originalValue.toLocaleString('zh-CN', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </p>
                            )}
                          </div>

                          {/* 盈亏列 */}
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              {(asset.unrealizedPnl || 0) >= 0 ? (
                                <TrendingUp className={`h-3 w-3 ${getPnLColorClass(1, preferences.colorScheme)}`} />
                              ) : (
                                <TrendingDown className={`h-3 w-3 ${getPnLColorClass(-1, preferences.colorScheme)}`} />
                              )}
                              <p className={`text-sm font-bold ${getPnLColorClass(asset.unrealizedPnl || 0, preferences.colorScheme)}`}>
                                {(asset.unrealizedPnl || 0) >= 0 ? '+' : ''}{formatters.currency(asset.unrealizedPnl || 0)}
                              </p>
                            </div>
                            <p className={`text-xs ${getPnLColorClass(asset.unrealizedPnlPercent || 0, preferences.colorScheme)}`}>
                              {(asset.unrealizedPnlPercent || 0) >= 0 ? '+' : ''}{formatters.percentage(asset.unrealizedPnlPercent || 0)}
                            </p>
                          </div>

                          {/* 操作菜单 */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(asset);
                              }}>
                                <Edit className="h-4 w-4 mr-2" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(asset);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* 添加对话框 */}
      <AddFixedIncomeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={handleAddSuccess}
      />

      {/* 编辑对话框 */}
      {selectedAsset && (
        <EditAssetDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          asset={selectedAsset}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* 详情对话框 */}
      {selectedAsset && (
        <AssetDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          asset={selectedAsset}
        />
      )}

      {/* 删除对话框 */}
      {selectedAsset && (
        <DeleteAssetDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          asset={selectedAsset}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </Card>
  );
}