'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, ArrowDown, ArrowUp, MoreHorizontal, Edit, Trash2, Receipt, User, Building2, Briefcase, Clock, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { formatters } from '@/lib/api-client';
import { AssetDetailDialog } from './asset-detail-dialog';
import { EditAssetDialog } from './edit-asset-dialog';
import { DeleteAssetDialog } from './delete-asset-dialog';
import { AddReceivableDialog } from './add-receivable-dialog';

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

interface ReceivablesListProps {
  assets: Asset[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onAddSuccess?: () => void;
}

export function ReceivablesList({ 
  assets, 
  isLoading = false, 
  onRefresh,
  onAddSuccess 
}: ReceivablesListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'date' | 'debtor'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
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
    (asset.metadata?.debtorName && asset.metadata.debtorName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 排序资产
  const sortedAssets = [...filteredAssets].sort((a, b) => {
    let aValue: number | string, bValue: number | string;
    
    switch (sortBy) {
      case 'value':
        aValue = a.currentValue;
        bValue = b.currentValue;
        break;
      case 'date':
        aValue = a.maturityDate ? new Date(a.maturityDate).getTime() : 0;
        bValue = b.maturityDate ? new Date(b.maturityDate).getTime() : 0;
        break;
      case 'debtor':
        aValue = a.metadata?.debtorName || '';
        bValue = b.metadata?.debtorName || '';
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'desc' 
            ? bValue.localeCompare(aValue, 'zh-CN') 
            : aValue.localeCompare(bValue, 'zh-CN');
        }
        return 0;
      default:
        aValue = a.currentValue;
        bValue = b.currentValue;
    }
    
    return sortOrder === 'desc' 
      ? (bValue as number) - (aValue as number) 
      : (aValue as number) - (bValue as number);
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
  const overdueCount = filteredAssets.filter(asset => {
    if (!asset.maturityDate) return false;
    return new Date(asset.maturityDate) < new Date() && asset.metadata?.repaymentStatus !== 'paid';
  }).length;
  const overdueAmount = filteredAssets
    .filter(asset => {
      if (!asset.maturityDate) return false;
      return new Date(asset.maturityDate) < new Date() && asset.metadata?.repaymentStatus !== 'paid';
    })
    .reduce((sum, asset) => sum + asset.currentValue, 0);

  // 按资产类型分组
  const groupedAssets = sortedAssets.reduce((groups, asset) => {
    const type = asset.assetCategory.code || 'OTHER';
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(asset);
    return groups;
  }, {} as Record<string, Asset[]>);

  const groupInfo: Record<string, { name: string; icon: typeof Receipt; color: string }> = {
    'REC_PERSONAL_LOAN': { name: '个人借款', icon: User, color: 'bg-blue-500' },
    'REC_DEPOSIT': { name: '押金/保证金', icon: Building2, color: 'bg-green-500' },
    'REC_SALARY': { name: '薪资/报销', icon: Briefcase, color: 'bg-amber-500' },
    'REC_BUSINESS': { name: '商业应收', icon: Building2, color: 'bg-purple-500' },
    'REC_OTHER': { name: '其他应收', icon: HelpCircle, color: 'bg-slate-500' },
    'OTHER': { name: '其他', icon: MoreHorizontal, color: 'bg-gray-500' }
  };

  // 获取还款状态文本和样式
  const getRepaymentStatus = (asset: Asset) => {
    const status = asset.metadata?.repaymentStatus;
    const dueDate = asset.maturityDate ? new Date(asset.maturityDate) : null;
    const isOverdue = dueDate && dueDate < new Date() && status !== 'paid';

    if (status === 'paid') {
      return { text: '已收回', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' };
    }
    if (isOverdue) {
      return { text: '已逾期', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' };
    }
    if (status === 'partial') {
      return { text: '部分收回', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' };
    }
    return { text: '待收回', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' };
  };

  return (
    <>
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-0 shadow-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-slate-800 dark:text-slate-200 text-base sm:text-lg">
            应收款列表
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

      <CardContent className="pt-0">
        {/* 搜索栏 */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
            <Input
              placeholder="搜索名称、欠款人..."
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
            {/* 移动端 */}
            <div className="flex items-center justify-between sm:hidden">
              <div>
                <div className="text-[10px] text-muted-foreground">总应收</div>
                <div className="text-sm font-bold">{formatters.currency(totalValue)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">逾期</div>
                <div className={`text-sm font-bold ${overdueCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {overdueCount}笔
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">逾期金额</div>
                <div className={`text-sm font-bold ${overdueAmount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {formatters.currency(overdueAmount)}
                </div>
              </div>
            </div>
            {/* 桌面端 */}
            <div className="hidden sm:grid sm:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">总应收金额</div>
                <div className="text-base font-bold">{formatters.currency(totalValue)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">逾期笔数</div>
                <div className={`text-base font-bold ${overdueCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {overdueCount}笔
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">逾期金额</div>
                <div className={`text-base font-bold ${overdueAmount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {formatters.currency(overdueAmount)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 排序按钮 */}
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
              variant={sortBy === 'date' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('date')}
              className="h-6 text-[10px] px-2"
            >
              到期日
              {sortBy === 'date' && (
                sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />
              )}
            </Button>
            <Button
              variant={sortBy === 'debtor' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('debtor')}
              className="h-6 text-[10px] px-2"
            >
              欠款人
              {sortBy === 'debtor' && (
                sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />
              )}
            </Button>
          </div>
        )}

        {/* 列表内容 */}
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">暂无应收款</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm ? '没有找到匹配的应收款' : '点击上方按钮添加您的第一笔应收款'}
            </p>
            {!searchTerm && (
              <Button onClick={handleAddClick}>
                <Plus className="mr-2 h-4 w-4" />
                添加应收款
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(groupedAssets).map(([type, typeAssets]) => {
              const info = groupInfo[type as keyof typeof groupInfo] || groupInfo.OTHER;
              const IconComponent = info.icon;
              const groupValue = typeAssets.reduce((sum, asset) => sum + asset.currentValue, 0);
              
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
                    const repaymentStatus = getRepaymentStatus(asset);
                    
                    return (
                      <div
                        key={asset.id}
                        className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer group bg-white dark:bg-slate-800"
                        onClick={() => handleViewDetail(asset)}
                      >
                        {/* 第一行：名称和状态 */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate flex-1 min-w-0">
                            {asset.name}
                          </h4>
                          <Badge className={`text-[10px] h-5 px-1.5 shrink-0 ${repaymentStatus.className}`}>
                            {repaymentStatus.text}
                          </Badge>
                        </div>
                        
                        {/* 第二行：欠款人和到期日 */}
                        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 mb-3">
                          {asset.metadata?.debtorName && (
                            <span className="flex items-center gap-1 shrink-0">
                              <User className="h-3 w-3" />
                              {asset.metadata.debtorName}
                            </span>
                          )}
                          {asset.maturityDate && (
                            <span className="flex items-center gap-1 shrink-0">
                              <Clock className="h-3 w-3" />
                              到期 {new Date(asset.maturityDate).toLocaleDateString('zh-CN')}
                            </span>
                          )}
                          {asset.metadata?.interestRate && (
                            <span className="text-slate-400 shrink-0">利率 {asset.metadata.interestRate}%</span>
                          )}
                        </div>

                        {/* 第三行：金额和操作 */}
                        <div className="flex items-end justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                          <div>
                            <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                              {formatters.currency(asset.currentValue)}
                            </span>
                            {asset.currency !== 'CNY' && asset.originalValue && (
                              <span className="text-xs text-slate-500 ml-2">
                                {asset.currency} {asset.originalValue.toLocaleString('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </span>
                            )}
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
    )}

    {/* 编辑对话框 */}
    {selectedAsset && (
      <EditAssetDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        asset={selectedAsset}
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
    <AddReceivableDialog
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
