'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Search, ArrowDown, ArrowUp, TrendingUp, TrendingDown, MoreHorizontal, Edit, Trash2, Home, Building2, MapPin, Percent, Calculator, Clock, PiggyBank, Info, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { formatters } from '@/lib/api-client';
import { getPnLColorClass } from '@/lib/user-preferences';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { RealEstateDetailDialog } from './real-estate-detail-dialog';
import { EditRealEstateDialog } from './edit-real-estate-dialog';
import { DeleteAssetDialog } from './delete-asset-dialog';
import { AddRealEstateDialog } from './add-real-estate-dialog';

interface Asset {
  id: string;
  name: string;
  description: string | null;
  assetCategory: {
    id: string;
    name: string;
    code: string | null;
    parent?: {
      id: string;
      name: string;
      code: string | null;
    } | null;
  };
  quantity: number;
  unitPrice: number;
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
}

interface RealEstateListProps {
  assets: Asset[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onAddSuccess?: () => void;
}

export function RealEstateList({ 
  assets, 
  isLoading = false, 
  onRefresh,
  onAddSuccess 
}: RealEstateListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'pnl' | 'yield' | 'rentalYield' | 'priceToRent' | 'area'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const preferences = useUserPreferences();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  
  // 对话框状态
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const handleAddClick = () => {
    setAddDialogOpen(true);
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

  // 过滤资产
  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.assetCategory.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (asset.metadata?.address && asset.metadata.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 获取不动产指标
  const getMetrics = (asset: Asset) => asset.metadata?._realEstateMetrics || {};

  // 排序资产
  const sortedAssets = [...filteredAssets].sort((a, b) => {
    let aValue: number, bValue: number;
    const aMetrics = getMetrics(a);
    const bMetrics = getMetrics(b);
    
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
      case 'rentalYield':
        aValue = aMetrics.grossRentalYield || 0;
        bValue = bMetrics.grossRentalYield || 0;
        break;
      case 'priceToRent':
        // 租售比越低越好，所以反向排序
        aValue = aMetrics.priceToRentRatio || 999;
        bValue = bMetrics.priceToRentRatio || 999;
        return sortOrder === 'desc' ? aValue - bValue : bValue - aValue;
      case 'area':
        aValue = a.metadata?.area || 0;
        bValue = b.metadata?.area || 0;
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

  // 计算汇总数据（使用 useMemo 优化）
  const summaryData = useMemo(() => {
    const totalValue = filteredAssets.reduce((sum, asset) => sum + asset.currentValue, 0);
    const totalPurchaseValue = filteredAssets.reduce((sum, asset) => sum + asset.purchasePrice, 0);
    const totalPnl = filteredAssets.reduce((sum, asset) => sum + (asset.unrealizedPnl || 0), 0);
    const totalPnlPercent = totalPurchaseValue > 0 ? (totalPnl / totalPurchaseValue) * 100 : 0;
    
    // 租金相关汇总
    let totalMonthlyRent = 0;
    let totalAccumulatedRent = 0;
    let totalArea = 0;
    let propertiesWithRent = 0;
    
    filteredAssets.forEach(asset => {
      const metrics = getMetrics(asset);
      if (metrics.monthlyRent > 0) {
        totalMonthlyRent += metrics.monthlyRent;
        propertiesWithRent++;
      }
      if (metrics.accumulatedRent) {
        totalAccumulatedRent += metrics.accumulatedRent;
      }
      if (asset.metadata?.area) {
        totalArea += Number(asset.metadata.area);
      }
    });
    
    // 加权平均租金收益率
    const avgGrossRentalYield = totalValue > 0 ? (totalMonthlyRent * 12 / totalValue) * 100 : 0;
    
    // 综合回报 = 资本增值 + 累计租金
    const totalReturn = totalPnl + totalAccumulatedRent;
    const totalReturnPercent = totalPurchaseValue > 0 ? (totalReturn / totalPurchaseValue) * 100 : 0;
    
    // 平均租售比
    const avgPriceToRent = totalMonthlyRent > 0 ? totalValue / (totalMonthlyRent * 12) : 0;
    
    return {
      totalValue,
      totalPurchaseValue,
      totalPnl,
      totalPnlPercent,
      totalMonthlyRent,
      totalAccumulatedRent,
      totalArea,
      propertiesWithRent,
      avgGrossRentalYield,
      totalReturn,
      totalReturnPercent,
      avgPriceToRent,
    };
  }, [filteredAssets]);

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
    'RE_RESIDENTIAL': { name: '住宅房产', icon: Home, color: 'bg-blue-500' },
    'RE_COMMERCIAL': { name: '商业地产', icon: Building2, color: 'bg-purple-500' },
    'RE_REITS': { name: '房地产信托', icon: MapPin, color: 'bg-green-500' },
    'OTHER': { name: '其他', icon: MoreHorizontal, color: 'bg-gray-500' }
  };

  // 租金收益率颜色分级
  const getRentalYieldColor = (yield_: number) => {
    if (yield_ >= 5) return 'text-green-600 dark:text-green-400';
    if (yield_ >= 3) return 'text-amber-600 dark:text-amber-400';
    if (yield_ > 0) return 'text-orange-600 dark:text-orange-400';
    return 'text-slate-400';
  };

  // 租售比评级
  const getPriceToRentRating = (ratio: number) => {
    if (ratio === 0) return { text: '-', color: 'text-slate-400', desc: '无租金数据' };
    if (ratio <= 15) return { text: '优秀', color: 'text-green-600', desc: '15年内回本' };
    if (ratio <= 25) return { text: '良好', color: 'text-blue-600', desc: '15-25年回本' };
    if (ratio <= 35) return { text: '一般', color: 'text-amber-600', desc: '25-35年回本' };
    return { text: '偏高', color: 'text-red-600', desc: '35年以上回本' };
  };

  return (
    <>
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-0 shadow-xl">
      {/* 区域1：头部（CardHeader） */}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-slate-800 dark:text-slate-200 text-base sm:text-lg">
            不动产列表
          </CardTitle>
          <Button 
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 h-7 w-7 sm:h-8 sm:w-auto sm:px-2 p-0"
            size="sm"
            onClick={handleAddClick}
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
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] h-5 px-1.5">
            {filteredAssets.length}项
          </Badge>
          {summaryData.totalArea > 0 && (
            <Badge className="hidden sm:inline-flex bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 text-[10px] h-5 px-1.5">
              {summaryData.totalArea.toLocaleString()}㎡
            </Badge>
          )}
        </div>

        {/* 2.2 汇总卡片 - 清晰布局 */}
        {filteredAssets.length > 0 && (
          <div className="mb-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            {/* 移动端：横向滑动或两列布局 */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:hidden">
              {/* 第一行：市值和增值 */}
              <div className="min-w-0">
                <div className="text-[10px] text-muted-foreground mb-0.5">总市值</div>
                <div className="text-sm font-bold truncate">{formatters.currency(summaryData.totalValue)}</div>
                <div className="text-[9px] text-muted-foreground truncate">成本 {formatters.currency(summaryData.totalPurchaseValue)}</div>
              </div>
              <div className="min-w-0 text-right">
                <div className="text-[10px] text-muted-foreground mb-0.5">资本增值</div>
                <div className={`text-sm font-bold truncate ${getPnLColorClass(summaryData.totalPnl, preferences.colorScheme)}`}>
                  {summaryData.totalPnl >= 0 ? '+' : ''}{formatters.currency(summaryData.totalPnl)}
                </div>
                <div className={`text-[9px] truncate ${getPnLColorClass(summaryData.totalPnlPercent, preferences.colorScheme)}`}>
                  {summaryData.totalPnlPercent >= 0 ? '+' : ''}{summaryData.totalPnlPercent.toFixed(1)}%
                </div>
              </div>
              {/* 第二行：租金收益和综合回报 */}
              <div className="min-w-0">
                <div className="text-[10px] text-muted-foreground mb-0.5">租金收益率</div>
                <div className={`text-sm font-bold truncate ${getRentalYieldColor(summaryData.avgGrossRentalYield)}`}>
                  {summaryData.avgGrossRentalYield.toFixed(1)}%
                </div>
                <div className="text-[9px] text-muted-foreground truncate">月租 {formatters.currency(summaryData.totalMonthlyRent)}</div>
              </div>
              <div className="min-w-0 text-right">
                <div className="text-[10px] text-purple-600 dark:text-purple-400 mb-0.5">综合回报</div>
                <div className={`text-sm font-bold truncate ${getPnLColorClass(summaryData.totalReturn, preferences.colorScheme)}`}>
                  {summaryData.totalReturn >= 0 ? '+' : ''}{formatters.currency(summaryData.totalReturn)}
                </div>
                <div className={`text-[9px] truncate ${getPnLColorClass(summaryData.totalReturnPercent, preferences.colorScheme)}`}>
                  {summaryData.totalReturnPercent >= 0 ? '+' : ''}{summaryData.totalReturnPercent.toFixed(1)}%
                </div>
              </div>
            </div>
            {/* 桌面端：四列卡片布局 */}
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 总价值 */}
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">总市值</div>
                <div className="text-base font-bold">{formatters.currency(summaryData.totalValue)}</div>
                <div className="text-[10px] text-muted-foreground">成本 {formatters.currency(summaryData.totalPurchaseValue)}</div>
              </div>
              {/* 资本增值 */}
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">资本增值</div>
                <div className={`text-base font-bold ${getPnLColorClass(summaryData.totalPnl, preferences.colorScheme)}`}>
                  {summaryData.totalPnl >= 0 ? '+' : ''}{formatters.currency(summaryData.totalPnl)}
                </div>
                <div className={`text-[10px] ${getPnLColorClass(summaryData.totalPnlPercent, preferences.colorScheme)}`}>
                  {summaryData.totalPnlPercent >= 0 ? '+' : ''}{summaryData.totalPnlPercent.toFixed(2)}%
                </div>
              </div>
              {/* 租金收益率 */}
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">租金收益率</div>
                <div className={`text-base font-bold ${getRentalYieldColor(summaryData.avgGrossRentalYield)}`}>
                  {summaryData.avgGrossRentalYield.toFixed(2)}%
                </div>
                <div className="text-[10px] text-muted-foreground">月租 {formatters.currency(summaryData.totalMonthlyRent)}</div>
              </div>
              {/* 综合回报 */}
              <div className="border-l-2 border-purple-200 dark:border-purple-800 pl-3">
                <div className="text-xs text-purple-600 dark:text-purple-400 mb-0.5">综合回报</div>
                <div className={`text-base font-bold ${getPnLColorClass(summaryData.totalReturn, preferences.colorScheme)}`}>
                  {summaryData.totalReturn >= 0 ? '+' : ''}{formatters.currency(summaryData.totalReturn)}
                </div>
                <div className={`text-[10px] ${getPnLColorClass(summaryData.totalReturnPercent, preferences.colorScheme)}`}>
                  {summaryData.totalReturnPercent >= 0 ? '+' : ''}{summaryData.totalReturnPercent.toFixed(2)}% 回报率
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 2.3 排序按钮 */}
        {filteredAssets.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto scrollbar-hide flex-wrap">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">排序:</span>
            <Button variant={sortBy === 'value' ? 'default' : 'outline'} size="sm" onClick={() => handleSort('value')} className="h-6 text-[10px] px-2">
              市值
              {sortBy === 'value' && (sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />)}
            </Button>
            <Button variant={sortBy === 'pnl' ? 'default' : 'outline'} size="sm" onClick={() => handleSort('pnl')} className="h-6 text-[10px] px-2">
              增值
              {sortBy === 'pnl' && (sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />)}
            </Button>
            <Button variant={sortBy === 'rentalYield' ? 'default' : 'outline'} size="sm" onClick={() => handleSort('rentalYield')} className="h-6 text-[10px] px-2">
              <Percent className="h-2.5 w-2.5 mr-0.5" />
              租金回报
              {sortBy === 'rentalYield' && (sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />)}
            </Button>
            <Button variant={sortBy === 'priceToRent' ? 'default' : 'outline'} size="sm" onClick={() => handleSort('priceToRent')} className="h-6 text-[10px] px-2">
              <Clock className="h-2.5 w-2.5 mr-0.5" />
              租售比
              {sortBy === 'priceToRent' && (sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />)}
            </Button>
            <Button variant={sortBy === 'area' ? 'default' : 'outline'} size="sm" onClick={() => handleSort('area')} className="h-6 text-[10px] px-2">
              面积
              {sortBy === 'area' && (sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />)}
            </Button>
          </div>
        )}

        {/* 2.4 列表内容 */}
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Home className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">暂无不动产</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm ? '没有找到匹配的资产' : '点击上方按钮添加您的第一笔不动产投资'}
            </p>
            {!searchTerm && (
              <Button onClick={handleAddClick}>
                <Plus className="mr-2 h-4 w-4" />
                添加不动产
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
                  {typeAssets.map((asset) => {
                    const metrics = getMetrics(asset);
                    const priceToRentRating = getPriceToRentRating(metrics.priceToRentRatio || 0);
                    
                    return (
                      <div
                        key={asset.id}
                        className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer group bg-white dark:bg-slate-800"
                        onClick={() => handleViewDetail(asset)}
                      >
                        {/* 第一行：标题和收益率 */}
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate flex-1 min-w-0">
                            {asset.name}
                          </h4>
                          {metrics.grossRentalYield > 0 && (
                            <Badge variant="secondary" className={`text-[10px] h-5 px-1.5 shrink-0 ${getRentalYieldColor(metrics.grossRentalYield)}`}>
                              <PiggyBank className="h-3 w-3 mr-0.5" />
                              {metrics.grossRentalYield.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                        
                        {/* 第二行：面积、单价、月租等 */}
                        <div className="flex items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400 flex-wrap mb-3">
                          {asset.metadata?.area && (
                            <span className="shrink-0">{asset.metadata.area}㎡</span>
                          )}
                          {metrics.pricePerSqm > 0 && (
                            <span className="shrink-0">¥{metrics.pricePerSqm.toLocaleString()}/㎡</span>
                          )}
                          {metrics.monthlyRent > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 shrink-0">
                              月租¥{metrics.monthlyRent.toLocaleString()}
                            </span>
                          )}
                          {metrics.priceToRentRatio > 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`${priceToRentRating.color} shrink-0`}>
                                    租售比{metrics.priceToRentRatio.toFixed(0)}年
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{priceToRentRating.desc}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>

                        {/* 第三行：金额和盈亏 */}
                        <div className="flex items-end justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                          {/* 左侧：市值和成本 */}
                          <div>
                            <div className="text-xs text-muted-foreground mb-0.5">市值 / 成本</div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                                {formatters.currency(asset.currentValue)}
                              </span>
                              <span className="text-xs text-slate-500">
                                / {formatters.currency(asset.purchasePrice)}
                              </span>
                            </div>
                          </div>

                          {/* 右侧：盈亏和操作 */}
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="flex items-center gap-1 justify-end">
                                {(asset.unrealizedPnl || 0) >= 0 ? (
                                  <TrendingUp className={`h-3 w-3 ${getPnLColorClass(1, preferences.colorScheme)}`} />
                                ) : (
                                  <TrendingDown className={`h-3 w-3 ${getPnLColorClass(-1, preferences.colorScheme)}`} />
                                )}
                                <span className={`text-sm font-bold ${getPnLColorClass(asset.unrealizedPnl || 0, preferences.colorScheme)}`}>
                                  {(asset.unrealizedPnl || 0) >= 0 ? '+' : ''}{formatters.currency(asset.unrealizedPnl || 0)}
                                </span>
                              </div>
                              <span className={`text-xs ${getPnLColorClass(Number(asset.unrealizedPnlPercent) || 0, preferences.colorScheme)}`}>
                                {(Number(asset.unrealizedPnlPercent) || 0) >= 0 ? '+' : ''}{(Number(asset.unrealizedPnlPercent) || 0).toFixed(2)}%
                              </span>
                            </div>

                            {/* 操作菜单 */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(asset);
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
    </Card>

    {/* 详情对话框 */}
    {selectedAsset && (
      <RealEstateDetailDialog
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
    )}

    {/* 编辑对话框 */}
    {selectedAsset && (
      <EditRealEstateDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        asset={selectedAsset as any}
        onSuccess={() => {
          setEditDialogOpen(false);
          onRefresh?.();
        }}
      />
    )}

    {/* 删除对话框 */}
    {selectedAsset && (
      <DeleteAssetDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        asset={selectedAsset}
        onSuccess={() => {
          setDeleteDialogOpen(false);
          onRefresh?.();
        }}
      />
    )}

    {/* 添加对话框 */}
    <AddRealEstateDialog
      open={addDialogOpen}
      onOpenChange={setAddDialogOpen}
      onSuccess={() => {
        setAddDialogOpen(false);
        onRefresh?.();
        onAddSuccess?.();
      }}
    />
    </>
  );
}