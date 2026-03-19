'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar,
  DollarSign, 
  Home,
  CreditCard,
  Car,
  Building2,
  GraduationCap,
  User,
  Users,
  MoreHorizontal,
  Info,
  TrendingDown,
  Percent,
  Clock,
  Minus
} from 'lucide-react';
import { formatters } from '@/lib/api-client';
import { LiabilityType } from '@prisma/client';

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

interface LiabilityDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liability: LiabilityDetail;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function LiabilityDetailDialog({
  open,
  onOpenChange,
  liability,
  onEdit,
  onDelete,
}: LiabilityDetailDialogProps) {
  const metadata = liability.metadata || {};

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
      MORTGAGE: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      CREDIT_CARD: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
      PERSONAL_LOAN: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      BUSINESS_LOAN: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
      CAR_LOAN: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      STUDENT_LOAN: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      PAYABLE: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
      OTHER: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
    };
    return typeColors[type] || 'bg-gray-100 text-gray-700';
  }

  const formatCurrency = (amount: number) => {
    const symbol = liability.currency === 'USD' ? '$' : 
                   liability.currency === 'HKD' ? 'HK$' : 
                   liability.currency === 'EUR' ? '€' : '¥';
    return `${symbol}${Math.abs(amount).toLocaleString('zh-CN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const IconComponent = getLiabilityTypeIcon(liability.type);

  // 计算已还金额
  const paidAmount = liability.principalAmount - liability.currentBalance;
  const paidPercent = liability.principalAmount > 0 
    ? (paidAmount / liability.principalAmount) * 100 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${getLiabilityTypeColor(liability.type).split(' ')[0]} text-white`}>
              <IconComponent className="h-5 w-5" />
            </div>
            {liability.name}
          </DialogTitle>
          <DialogDescription>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={getLiabilityTypeColor(liability.type)}>
                {getLiabilityTypeName(liability.type)}
              </Badge>
              <Badge variant="outline">{liability.currency}</Badge>
              {!liability.isActive && (
                <Badge variant="secondary">已结清</Badge>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* 核心指标 */}
          <div className="grid grid-cols-3 gap-4">
            {/* 当前余额 */}
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950">
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mb-1">
                <Minus className="h-4 w-4" />
                <span>当前余额</span>
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatters.currency(liability.currentBalanceCny)}
              </p>
              {liability.currency !== 'CNY' && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(liability.currentBalance)}
                </p>
              )}
            </div>

            {/* 月供 */}
            <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950">
              <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 mb-1">
                <DollarSign className="h-4 w-4" />
                <span>月供</span>
              </div>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {liability.monthlyPaymentCny > 0 
                  ? formatters.currency(liability.monthlyPaymentCny)
                  : '--'}
              </p>
            </div>

            {/* 年利率 */}
            <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950">
              <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 mb-1">
                <Percent className="h-4 w-4" />
                <span>年利率</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {liability.interestRate ? `${liability.interestRate.toFixed(2)}%` : '--'}
              </p>
            </div>
          </div>

          {/* 还款进度 */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">还款进度</span>
              <span className="text-sm text-muted-foreground">
                {paidPercent.toFixed(1)}%
              </span>
            </div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all"
                style={{ width: `${Math.min(paidPercent, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>已还：{formatters.currency(paidAmount * (liability.currency === 'CNY' ? 1 : liability.exchangeRate))}</span>
              <span>本金：{formatters.currency(liability.principalAmount * (liability.currency === 'CNY' ? 1 : liability.exchangeRate))}</span>
            </div>
          </div>

          {/* 剩余期限 */}
          {liability.remainingMonths && liability.remainingMonths > 0 && (
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">剩余期限</span>
                </div>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {liability.remainingMonths} 个月
                </span>
              </div>
              {liability.remainingMonths >= 12 && (
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  约 {Math.floor(liability.remainingMonths / 12)} 年 {liability.remainingMonths % 12} 个月
                </p>
              )}
            </div>
          )}

          <Separator />

          {/* 详细信息 */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Info className="h-5 w-5" />
              详细信息
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div className="text-sm text-muted-foreground">本金总额</div>
              <div className="text-sm font-medium">
                {formatCurrency(liability.principalAmount)}
              </div>

              {liability.startDate && (
                <>
                  <div className="text-sm text-muted-foreground">开始日期</div>
                  <div className="text-sm font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(liability.startDate).toLocaleDateString('zh-CN')}
                  </div>
                </>
              )}

              {liability.maturityDate && (
                <>
                  <div className="text-sm text-muted-foreground">到期日期</div>
                  <div className="text-sm font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(liability.maturityDate).toLocaleDateString('zh-CN')}
                  </div>
                </>
              )}

              {liability.nextPaymentDate && (
                <>
                  <div className="text-sm text-muted-foreground">下次还款日</div>
                  <div className="text-sm font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(liability.nextPaymentDate).toLocaleDateString('zh-CN')}
                  </div>
                </>
              )}

              {/* 房贷特有字段 */}
              {metadata.propertyAddress && (
                <>
                  <div className="text-sm text-muted-foreground">房产地址</div>
                  <div className="text-sm font-medium">{metadata.propertyAddress}</div>
                </>
              )}

              {metadata.loanToValue && (
                <>
                  <div className="text-sm text-muted-foreground">贷款价值比</div>
                  <div className="text-sm font-medium">{metadata.loanToValue}%</div>
                </>
              )}

              {/* 车贷特有字段 */}
              {metadata.vehicleMake && (
                <>
                  <div className="text-sm text-muted-foreground">车辆信息</div>
                  <div className="text-sm font-medium">
                    {metadata.vehicleMake} {metadata.vehicleModel} {metadata.vehicleYear}
                  </div>
                </>
              )}

              {/* 信用卡特有字段 */}
              {metadata.bank && (
                <>
                  <div className="text-sm text-muted-foreground">发卡银行</div>
                  <div className="text-sm font-medium">{metadata.bank}</div>
                </>
              )}

              {metadata.cardNumber && (
                <>
                  <div className="text-sm text-muted-foreground">卡号后四位</div>
                  <div className="text-sm font-medium">****{metadata.cardNumber}</div>
                </>
              )}

              {metadata.creditLimit && (
                <>
                  <div className="text-sm text-muted-foreground">信用额度</div>
                  <div className="text-sm font-medium">{formatCurrency(metadata.creditLimit)}</div>
                </>
              )}

              {/* 个人贷款特有字段 */}
              {metadata.lender && (
                <>
                  <div className="text-sm text-muted-foreground">出借方</div>
                  <div className="text-sm font-medium">{metadata.lender}</div>
                </>
              )}

              {metadata.loanPurpose && (
                <>
                  <div className="text-sm text-muted-foreground">贷款用途</div>
                  <div className="text-sm font-medium">
                    {metadata.loanPurpose === 'renovation' ? '装修' :
                     metadata.loanPurpose === 'education' ? '教育' :
                     metadata.loanPurpose === 'medical' ? '医疗' :
                     metadata.loanPurpose === 'business' ? '经营' : '其他'}
                  </div>
                </>
              )}

              {liability.currency !== 'CNY' && (
                <>
                  <div className="text-sm text-muted-foreground">汇率</div>
                  <div className="text-sm font-medium">1 {liability.currency} = {liability.exchangeRate.toFixed(4)} CNY</div>
                </>
              )}

              <div className="text-sm text-muted-foreground">创建时间</div>
              <div className="text-sm font-medium">
                {new Date(liability.createdAt).toLocaleString('zh-CN')}
              </div>

              <div className="text-sm text-muted-foreground">最后更新</div>
              <div className="text-sm font-medium">
                {new Date(liability.lastUpdated).toLocaleString('zh-CN')}
              </div>
            </div>
          </div>

          {/* 备注 */}
          {liability.description && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">备注</h3>
                <p className="text-sm text-muted-foreground">{liability.description}</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          {onEdit && (
            <Button variant="outline" onClick={onEdit}>
              编辑
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              删除
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
