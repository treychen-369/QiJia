'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, ArrowDown, ArrowUp, MoreHorizontal, Edit, Trash2, ExternalLink, Home, CreditCard, User, Building2, Car, GraduationCap, Users, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { formatters } from '@/lib/api-client';
import { LiabilityType } from '@prisma/client';
import { AddLiabilityDialog } from './add-liability-dialog';
import { LiabilityDetailDialog } from './liability-detail-dialog';
import { useToast } from '@/components/ui/use-toast';

interface LiabilityDetail {
  id: string;
  name: string;
  type: LiabilityType;
  description?: string;
  principalAmount: number;
  currentBalance: number;
  interestRate?: number;
  monthlyPayment?: number;
  currency: string;
  startDate?: string;
  maturityDate?: string;
  nextPaymentDate?: string;
  metadata?: any;
  isActive: boolean;
  lastUpdated: string;
  createdAt: string;
  currentBalanceCny: number;
  monthlyPaymentCny: number;
  exchangeRate: number;
  remainingMonths?: number;
  totalInterest?: number;
}

interface LiabilitiesListProps {
  liabilities: LiabilityDetail[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onAddSuccess?: () => void;
}

export function LiabilitiesList({ 
  liabilities, 
  isLoading = false, 
  onRefresh,
  onAddSuccess 
}: LiabilitiesListProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'balance' | 'payment' | 'rate' | 'remaining'>('balance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  
  // 详情对话框状态
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedLiability, setSelectedLiability] = useState<LiabilityDetail | null>(null);
  
  // 编辑对话框状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLiability, setEditingLiability] = useState<LiabilityDetail | null>(null);
  
  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLiability, setDeletingLiability] = useState<LiabilityDetail | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddClick = () => {
    setAddDialogOpen(true);
  };

  // 点击卡片查看详情
  const handleViewDetail = (liability: LiabilityDetail) => {
    setSelectedLiability(liability);
    setDetailDialogOpen(true);
  };

  // 编辑负债
  const handleEdit = (liability: LiabilityDetail) => {
    setEditingLiability(liability);
    setEditDialogOpen(true);
    // 如果是从详情页触发的编辑，关闭详情页
    setDetailDialogOpen(false);
  };

  // 删除负债
  const handleDelete = (liability: LiabilityDetail) => {
    setDeletingLiability(liability);
    setDeleteDialogOpen(true);
    // 如果是从详情页触发的删除，关闭详情页
    setDetailDialogOpen(false);
  };

  // 确认删除
  const confirmDelete = async () => {
    if (!deletingLiability) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/liabilities?id=${deletingLiability.id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '删除失败');
      }
      
      toast({
        title: '删除成功',
        description: `已删除负债：${deletingLiability.name}`,
      });
      
      setDeleteDialogOpen(false);
      setDeletingLiability(null);
      onRefresh?.();
    } catch (error) {
      console.error('删除负债失败:', error);
      toast({
        variant: 'destructive',
        title: '删除失败',
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // 过滤负债
  const filteredLiabilities = liabilities.filter(liability =>
    liability.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getLiabilityTypeName(liability.type).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 排序负债
  const sortedLiabilities = [...filteredLiabilities].sort((a, b) => {
    let aValue: number, bValue: number;
    
    switch (sortBy) {
      case 'balance':
        aValue = a.currentBalanceCny;
        bValue = b.currentBalanceCny;
        break;
      case 'payment':
        aValue = a.monthlyPaymentCny || 0;
        bValue = b.monthlyPaymentCny || 0;
        break;
      case 'rate':
        aValue = a.interestRate || 0;
        bValue = b.interestRate || 0;
        break;
      case 'remaining':
        aValue = a.remainingMonths || 0;
        bValue = b.remainingMonths || 0;
        break;
      default:
        aValue = a.currentBalanceCny;
        bValue = b.currentBalanceCny;
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
  const totalBalance = filteredLiabilities.reduce((sum, liability) => sum + liability.currentBalanceCny, 0);
  const totalMonthlyPayment = filteredLiabilities.reduce((sum, liability) => sum + (liability.monthlyPaymentCny || 0), 0);
  
  // 计算加权平均利率
  const totalWeightedRate = filteredLiabilities.reduce((sum, liability) => {
    return sum + ((liability.interestRate || 0) * liability.currentBalanceCny);
  }, 0);
  const averageRate = totalBalance > 0 ? totalWeightedRate / totalBalance : 0;

  // 按负债类型分组
  const groupedLiabilities = sortedLiabilities.reduce((groups, liability) => {
    const type = liability.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(liability);
    return groups;
  }, {} as Record<LiabilityType, LiabilityDetail[]>);

  function getLiabilityTypeName(type: LiabilityType): string {
    const typeNames: Record<LiabilityType, string> = {
      MORTGAGE: '房贷',
      CREDIT_CARD: '信用卡',
      PERSONAL_LOAN: '个人贷款',
      BUSINESS_LOAN: '商业贷款',
      CAR_LOAN: '车贷',
      STUDENT_LOAN: '学生贷款',
      PAYABLE: '应付款项',
      OTHER: '其他'
    };
    return typeNames[type] || '未知';
  }

  function getLiabilityTypeIcon(type: LiabilityType) {
    const typeIcons: Record<LiabilityType, any> = {
      MORTGAGE: Home,
      CREDIT_CARD: CreditCard,
      PERSONAL_LOAN: User,
      BUSINESS_LOAN: Building2,
      CAR_LOAN: Car,
      STUDENT_LOAN: GraduationCap,
      PAYABLE: Users,
      OTHER: MoreHorizontal
    };
    return typeIcons[type] || MoreHorizontal;
  }

  function getLiabilityTypeColor(type: LiabilityType): string {
    const typeColors: Record<LiabilityType, string> = {
      MORTGAGE: 'bg-red-500',
      CREDIT_CARD: 'bg-orange-500',
      PERSONAL_LOAN: 'bg-yellow-500',
      BUSINESS_LOAN: 'bg-purple-500',
      CAR_LOAN: 'bg-blue-500',
      STUDENT_LOAN: 'bg-green-500',
      PAYABLE: 'bg-pink-500',
      OTHER: 'bg-gray-500'
    };
    return typeColors[type] || 'bg-gray-500';
  }

  return (
    <>
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-0 shadow-xl">
      {/* 区域1：头部（CardHeader） */}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-slate-800 dark:text-slate-200 text-base sm:text-lg">
            负债管理
          </CardTitle>
          <Button 
            className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 h-7 w-7 sm:h-8 sm:w-auto sm:px-2 p-0"
            size="sm"
            onClick={handleAddClick}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      {/* 区域2：内容（CardContent） */}
      <CardContent className="pt-0">
        {/* 2.1 搜索和筛选栏 */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
            <Input
              placeholder="搜索负债..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-7 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            />
          </div>
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-[10px] h-5 px-1.5">
            {filteredLiabilities.length}项
          </Badge>
        </div>

        {/* 2.2 汇总卡片（有数据时显示） */}
        {filteredLiabilities.length > 0 && (
          <div className="mb-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            {/* 移动端：横向紧凑布局 */}
            <div className="flex items-center justify-between sm:hidden">
              <div>
                <div className="text-[10px] text-muted-foreground">总负债</div>
                <div className="text-sm font-bold text-red-600 dark:text-red-400">
                  {formatters.currency(totalBalance)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">月供总额</div>
                <div className="text-sm font-bold text-orange-600 dark:text-orange-400">
                  {formatters.currency(totalMonthlyPayment)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">平均利率</div>
                <div className="text-sm font-bold text-yellow-600 dark:text-yellow-400">
                  {formatters.percentage(averageRate)}
                </div>
              </div>
            </div>
            {/* 桌面端：三列布局 */}
            <div className="hidden sm:grid sm:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">总负债</div>
                <div className="text-base font-bold text-red-600 dark:text-red-400">
                  {formatters.currency(totalBalance)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">月供总额</div>
                <div className="text-base font-bold text-orange-600 dark:text-orange-400">
                  {formatters.currency(totalMonthlyPayment)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">平均利率</div>
                <div className="text-base font-bold text-yellow-600 dark:text-yellow-400">
                  {formatters.percentage(averageRate)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2.3 排序按钮（有数据时显示） */}
        {filteredLiabilities.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto scrollbar-hide">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">排序:</span>
            <Button
              variant={sortBy === 'balance' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('balance')}
              className="h-6 text-[10px] px-2"
            >
              余额
              {sortBy === 'balance' && (
                sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />
              )}
            </Button>
            <Button
              variant={sortBy === 'payment' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('payment')}
              className="h-6 text-[10px] px-2"
            >
              月供
              {sortBy === 'payment' && (
                sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />
              )}
            </Button>
            <Button
              variant={sortBy === 'rate' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('rate')}
              className="h-6 text-[10px] px-2"
            >
              利率
              {sortBy === 'rate' && (
                sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />
              )}
            </Button>
            <Button
              variant={sortBy === 'remaining' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('remaining')}
              className="h-6 text-[10px] px-2"
            >
              剩余期限
              {sortBy === 'remaining' && (
                sortOrder === 'desc' ? <ArrowDown className="ml-0.5 h-2.5 w-2.5" /> : <ArrowUp className="ml-0.5 h-2.5 w-2.5" />
              )}
            </Button>
          </div>
        )}

        {/* 2.4 列表内容 */}
        {filteredLiabilities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">暂无负债</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm ? '没有找到匹配的负债' : '点击上方按钮添加您的第一笔负债'}
            </p>
            {!searchTerm && (
              <Button onClick={handleAddClick}>
                <Plus className="mr-2 h-4 w-4" />
                添加负债
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(groupedLiabilities).map(([type, typeLiabilities]) => {
              const typeName = getLiabilityTypeName(type as LiabilityType);
              const IconComponent = getLiabilityTypeIcon(type as LiabilityType);
              const color = getLiabilityTypeColor(type as LiabilityType);
              const groupValue = typeLiabilities.reduce((sum, liability) => sum + liability.currentBalanceCny, 0);
              
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
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color} text-white`}>
                              <IconComponent className="h-5 w-5" />
                            </div>
                            <div className="text-left">
                              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                {typeName}
                                <span className="text-xs text-muted-foreground">({typeLiabilities.length})</span>
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
                  {typeLiabilities.map((liability) => (
                    <div
                      key={liability.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer group bg-white dark:bg-slate-800"
                      onClick={() => handleViewDetail(liability)}
                    >
                      <div className="flex items-center justify-between">
                        {/* 左侧信息 */}
                        <div className="flex-1 min-w-0">
                          {/* 标题行 */}
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                              {liability.name}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {liability.currency}
                            </Badge>
                          </div>
                          
                          {/* 副标题行 */}
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 dark:text-slate-400">
                            <span className={(liability.interestRate || 0) > 0 ? 'text-orange-600 dark:text-orange-400 font-medium' : ''}>
                              利率: {(liability.interestRate || 0).toFixed(2)}%
                            </span>
                            {liability.remainingMonths && (
                              <span>剩余: {liability.remainingMonths}个月</span>
                            )}
                            {liability.nextPaymentDate && (
                              <span>下次还款: {new Date(liability.nextPaymentDate).toLocaleDateString('zh-CN')}</span>
                            )}
                          </div>
                        </div>

                        {/* 右侧数据 */}
                        <div className="flex items-center gap-4">
                          {/* 主要金额列 */}
                          <div className="text-right">
                            <p className="text-base font-bold text-red-600 dark:text-red-400">
                              <Minus className="inline h-4 w-4 mr-1" />
                              {formatters.currency(liability.currentBalanceCny)}
                            </p>
                            {liability.currency !== 'CNY' && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {liability.currency} {liability.currentBalance.toLocaleString('zh-CN', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </p>
                            )}
                          </div>

                          {/* 月供列 */}
                          {liability.monthlyPaymentCny > 0 && (
                            <div className="text-right">
                              <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                                {formatters.currency(liability.monthlyPaymentCny)}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                月供
                              </p>
                            </div>
                          )}

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
                                handleViewDetail(liability);
                              }}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                查看详情
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(liability);
                              }}>
                                <Edit className="h-4 w-4 mr-2" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(liability);
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
    </Card>

    {/* 添加对话框 */}
    <AddLiabilityDialog
      open={addDialogOpen}
      onOpenChange={setAddDialogOpen}
      onSuccess={() => {
        setAddDialogOpen(false);
        onRefresh?.();
        onAddSuccess?.();
      }}
    />

    {/* 编辑对话框 */}
    <AddLiabilityDialog
      open={editDialogOpen}
      onOpenChange={setEditDialogOpen}
      editData={editingLiability}
      onSuccess={() => {
        setEditDialogOpen(false);
        setEditingLiability(null);
        onRefresh?.();
      }}
    />

    {/* 详情对话框 */}
    {selectedLiability && (
      <LiabilityDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        liability={selectedLiability}
        onEdit={() => handleEdit(selectedLiability)}
        onDelete={() => handleDelete(selectedLiability)}
      />
    )}

    {/* 删除确认对话框 */}
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除负债「{deletingLiability?.name}」吗？此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? '删除中...' : '确认删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}