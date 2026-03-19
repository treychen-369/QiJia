'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Building2,
  TrendingUp,
  Wallet,
  Loader2,
  Users,
  CreditCard,
} from 'lucide-react';

// ==================== 类型定义 ====================

interface FamilyMember {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

interface TransferableHolding {
  id: string;
  securityName: string;
  symbol: string;
  quantity: number;
  currentPrice: number;
  valueCny: number;
  accountName: string;
  accountId: string;
}

interface TransferableAsset {
  id: string;
  name: string;
  categoryName: string;
  categoryId: string;
  currentValue: number;
  currency: string;
  isTransferable: boolean;
  isSplittable: boolean;
}

interface TransferableLiability {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
  principalAmount: number;
  currency: string;
  interestRate: number | null;
  monthlyPayment: number | null;
}

interface TargetAccount {
  id: string;
  accountName: string;
  broker: { name: string };
  currency: string;
}

interface FamilyTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: string;
  familyName: string;
  members: FamilyMember[];
  currentUserId: string;
  onSuccess?: () => void;
}

// ==================== 组件 ====================

export function FamilyTransferDialog({
  open,
  onOpenChange,
  familyId,
  familyName,
  members,
  currentUserId,
  onSuccess,
}: FamilyTransferDialogProps) {
  const { toast } = useToast();

  // 步骤管理
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1=选成员 2=选资产 3=确认

  // 选择状态
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [assetTab, setAssetTab] = useState('holdings');
  const [selectedHoldingId, setSelectedHoldingId] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedLiabilityId, setSelectedLiabilityId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [transferAll, setTransferAll] = useState(false);
  const [targetAccountId, setTargetAccountId] = useState('');
  const [notes, setNotes] = useState('');

  // 数据
  const [holdings, setHoldings] = useState<TransferableHolding[]>([]);
  const [assets, setAssets] = useState<TransferableAsset[]>([]);
  const [liabilities, setLiabilities] = useState<TransferableLiability[]>([]);
  const [targetAccounts, setTargetAccounts] = useState<TargetAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 重置状态
  const resetState = useCallback(() => {
    setStep(1);
    setFromUserId('');
    setToUserId('');
    setAssetTab('holdings');
    setSelectedHoldingId('');
    setSelectedAssetId('');
    setSelectedLiabilityId('');
    setQuantity('');
    setTransferAll(false);
    setTargetAccountId('');
    setNotes('');
    setHoldings([]);
    setAssets([]);
    setLiabilities([]);
    setTargetAccounts([]);
  }, []);

  useEffect(() => {
    if (open) resetState();
  }, [open, resetState]);

  // 加载可转移资产
  const loadTransferableAssets = useCallback(async (userId: string) => {
    setLoadingAssets(true);
    try {
      const res = await fetch(
        `/api/family/transfer/assets?familyId=${familyId}&userId=${userId}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '加载失败');
      }
      const { data } = await res.json();
      setHoldings(data.holdings || []);
      setAssets(data.assets || []);
      setLiabilities(data.liabilities || []);
    } catch (error) {
      toast({
        title: '加载可转移资产失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setLoadingAssets(false);
    }
  }, [familyId, toast]);

  // 加载目标用户的投资账户
  const loadTargetAccounts = useCallback(async (userId: string) => {
    setLoadingAccounts(true);
    try {
      // 使用现有账户 API，但需要以目标用户身份获取
      // 由于是管理员操作，通过 family member-assets 间接获取
      const res = await fetch(
        `/api/family/transfer/assets?familyId=${familyId}&userId=${userId}`
      );
      if (!res.ok) throw new Error('加载目标账户失败');
      const { data } = await res.json();
      // 从 holdings 中提取唯一的账户信息
      const accountMap = new Map<string, TargetAccount>();
      (data.holdings || []).forEach((h: TransferableHolding) => {
        if (!accountMap.has(h.accountId)) {
          accountMap.set(h.accountId, {
            id: h.accountId,
            accountName: h.accountName,
            broker: { name: '' },
            currency: 'CNY',
          });
        }
      });
      setTargetAccounts(Array.from(accountMap.values()));
    } catch {
      // 目标用户可能没有投资账户，不报错
      setTargetAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  }, [familyId]);

  // 当选择转出方后，加载其资产
  useEffect(() => {
    if (fromUserId && step === 2) {
      loadTransferableAssets(fromUserId);
    }
  }, [fromUserId, step, loadTransferableAssets]);

  // 当选择转入方后，加载其投资账户（用于 Holding 转移）
  useEffect(() => {
    if (toUserId && assetTab === 'holdings') {
      loadTargetAccounts(toUserId);
    }
  }, [toUserId, assetTab, loadTargetAccounts]);

  // 获取选中的项目
  const selectedHolding = holdings.find((h) => h.id === selectedHoldingId);
  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  const selectedLiability = liabilities.find((l) => l.id === selectedLiabilityId);
  const fromMember = members.find((m) => m.userId === fromUserId);
  const toMember = members.find((m) => m.userId === toUserId);

  // 可选的目标成员（排除转出方）
  const availableToMembers = members.filter((m) => m.userId !== fromUserId);

  // 确定资产类型
  const getAssetType = () => {
    if (assetTab === 'holdings') return 'HOLDING';
    if (assetTab === 'liabilities') return 'LIABILITY';
    if (selectedAsset?.isSplittable) return 'CASH_ACCOUNT';
    return 'ASSET';
  };

  // 负债类型中文映射
  const liabilityTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      MORTGAGE: '房贷',
      CREDIT_CARD: '信用卡',
      PERSONAL_LOAN: '个人贷款',
      BUSINESS_LOAN: '商业贷款',
      CAR_LOAN: '车贷',
      STUDENT_LOAN: '学生贷款',
      PAYABLE: '应付款',
      OTHER: '其他',
    };
    return map[type] || type;
  };

  // 计算转移价值
  const getTransferValue = () => {
    if (assetTab === 'holdings' && selectedHolding) {
      const qty = transferAll ? selectedHolding.quantity : parseFloat(quantity) || 0;
      return qty * selectedHolding.currentPrice;
    }
    if (assetTab === 'assets' && selectedAsset) {
      if (selectedAsset.isSplittable) {
        return parseFloat(quantity) || 0;
      }
      return selectedAsset.currentValue;
    }
    if (assetTab === 'liabilities' && selectedLiability) {
      return selectedLiability.currentBalance;
    }
    return 0;
  };

  // 验证是否可以进入下一步
  const canProceedStep1 = fromUserId && toUserId;
  const canProceedStep2 = (() => {
    if (assetTab === 'holdings') {
      if (!selectedHoldingId) return false;
      if (!targetAccountId) return false;
      if (!transferAll && (!quantity || parseFloat(quantity) <= 0)) return false;
      if (!transferAll && selectedHolding && parseFloat(quantity) > selectedHolding.quantity) return false;
      return true;
    }
    if (assetTab === 'assets') {
      if (!selectedAssetId) return false;
      if (selectedAsset?.isSplittable && (!quantity || parseFloat(quantity) <= 0)) return false;
      return true;
    }
    if (assetTab === 'liabilities') {
      return !!selectedLiabilityId;
    }
    return false;
  })();

  // 提交转移
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const assetType = getAssetType();
      const body: Record<string, any> = {
        familyId,
        fromUserId,
        toUserId,
        assetType,
        notes: notes || undefined,
      };

      if (assetType === 'HOLDING') {
        body.holdingId = selectedHoldingId;
        body.targetAccountId = targetAccountId;
        body.transferAll = transferAll;
        if (!transferAll) body.quantity = parseFloat(quantity);
      } else if (assetType === 'ASSET') {
        body.assetId = selectedAssetId;
      } else if (assetType === 'CASH_ACCOUNT') {
        body.assetId = selectedAssetId;
        body.quantity = parseFloat(quantity);
      } else if (assetType === 'LIABILITY') {
        body.liabilityId = selectedLiabilityId;
      }

      const res = await fetch('/api/family/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '转移失败');
      }

      const result = await res.json();
      toast({
        title: '转移成功',
        description: result.message,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: '转移失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val: number, currency?: string) => {
    const symbol = currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : '¥';
    return `${symbol}${val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            家庭资产转移
          </DialogTitle>
          <DialogDescription>
            在「{familyName}」家庭成员间转移资产
          </DialogDescription>
        </DialogHeader>

        {/* 步骤指示器 */}
        <div className="flex items-center gap-2 px-2">
          {[
            { num: 1, label: '选择成员' },
            { num: 2, label: '选择资产' },
            { num: 3, label: '确认转移' },
          ].map(({ num, label }, i) => (
            <div key={num} className="flex items-center gap-2 flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  step >= num
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
              >
                {step > num ? <CheckCircle2 className="w-4 h-4" /> : num}
              </div>
              <span
                className={`text-xs ${
                  step >= num ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'
                }`}
              >
                {label}
              </span>
              {i < 2 && (
                <div
                  className={`flex-1 h-px ${
                    step > num ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: 选择成员 */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>转出方（资产来源）<span className="text-red-500">*</span></Label>
              <Select value={fromUserId} onValueChange={(v) => {
                setFromUserId(v);
                if (toUserId === v) setToUserId('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="选择转出方成员" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={5}>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      <div className="flex items-center gap-2">
                        <span>{m.user.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {m.role === 'ADMIN' ? '管理员' : m.role === 'MEMBER' ? '成员' : '观察者'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="w-5 h-5 text-slate-400 rotate-90" />
            </div>

            <div className="space-y-2">
              <Label>转入方（资产接收）<span className="text-red-500">*</span></Label>
              <Select
                value={toUserId}
                onValueChange={setToUserId}
                disabled={!fromUserId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={fromUserId ? '选择转入方成员' : '请先选择转出方'} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={5}>
                  {availableToMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      <div className="flex items-center gap-2">
                        <span>{m.user.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {m.role === 'ADMIN' ? '管理员' : m.role === 'MEMBER' ? '成员' : '观察者'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {fromUserId && toUserId && (
              <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg text-sm flex items-center gap-3">
                <span className="font-medium text-blue-700 dark:text-blue-300">
                  {fromMember?.user.name}
                </span>
                <ArrowRight className="w-4 h-4 text-blue-400" />
                <span className="font-medium text-blue-700 dark:text-blue-300">
                  {toMember?.user.name}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: 选择资产 */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg text-sm flex items-center gap-3">
              <span className="font-medium">{fromMember?.user.name}</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span className="font-medium">{toMember?.user.name}</span>
            </div>

            {loadingAssets ? (
              <div className="flex items-center justify-center py-8 gap-2 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>加载资产中...</span>
              </div>
            ) : (
              <Tabs value={assetTab} onValueChange={(v) => {
                setAssetTab(v);
                setSelectedHoldingId('');
                setSelectedAssetId('');
                setSelectedLiabilityId('');
                setQuantity('');
                setTransferAll(false);
              }}>
                <TabsList className="w-full">
                  <TabsTrigger value="holdings" className="flex-1 gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    证券持仓 ({holdings.length})
                  </TabsTrigger>
                  <TabsTrigger value="assets" className="flex-1 gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    其他资产 ({assets.length})
                  </TabsTrigger>
                  <TabsTrigger value="liabilities" className="flex-1 gap-1">
                    <CreditCard className="w-3.5 h-3.5" />
                    负债 ({liabilities.length})
                  </TabsTrigger>
                </TabsList>

                {/* 证券持仓 Tab */}
                <TabsContent value="holdings" className="space-y-3 mt-3">
                  {holdings.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-sm">
                      该成员没有证券持仓
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>选择持仓 <span className="text-red-500">*</span></Label>
                        <Select value={selectedHoldingId} onValueChange={(v) => {
                          setSelectedHoldingId(v);
                          setTransferAll(false);
                          setQuantity('');
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择要转移的持仓" />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={5}>
                            {holdings.map((h) => (
                              <SelectItem key={h.id} value={h.id}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{h.symbol}</span>
                                  <span className="text-slate-500">{h.securityName}</span>
                                  <Badge variant="outline" className="text-xs ml-auto">
                                    {h.quantity} 股
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedHolding && (
                        <>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg text-sm grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-slate-500">持有数量：</span>
                              <span className="font-medium ml-1">{selectedHolding.quantity}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">当前价格：</span>
                              <span className="font-medium ml-1">{formatCurrency(selectedHolding.currentPrice)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">市值：</span>
                              <span className="font-medium ml-1">{formatCurrency(selectedHolding.valueCny)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">账户：</span>
                              <span className="font-medium ml-1">{selectedHolding.accountName}</span>
                            </div>
                          </div>

                          {/* 转移模式 */}
                          <div className="space-y-2">
                            <Label>转移模式</Label>
                            <div className="flex gap-3">
                              <Button
                                type="button"
                                variant={!transferAll ? 'default' : 'outline'}
                                onClick={() => { setTransferAll(false); setQuantity(''); }}
                                className="flex-1"
                                size="sm"
                              >
                                部分转移
                              </Button>
                              <Button
                                type="button"
                                variant={transferAll ? 'default' : 'outline'}
                                onClick={() => {
                                  setTransferAll(true);
                                  setQuantity(selectedHolding.quantity.toString());
                                }}
                                className="flex-1"
                                size="sm"
                              >
                                全部转移
                              </Button>
                            </div>
                          </div>

                          {!transferAll && (
                            <div className="space-y-2">
                              <Label>转移数量 <span className="text-red-500">*</span></Label>
                              <Input
                                type="number"
                                placeholder="请输入数量"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                max={selectedHolding.quantity}
                                step="0.01"
                              />
                              <p className="text-xs text-slate-500">
                                最大: {selectedHolding.quantity}
                              </p>
                            </div>
                          )}

                          {/* 目标账户 */}
                          <div className="space-y-2">
                            <Label>
                              目标投资账户（{toMember?.user.name}）
                              <span className="text-red-500">*</span>
                            </Label>
                            {loadingAccounts ? (
                              <div className="text-sm text-slate-500 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                加载中...
                              </div>
                            ) : targetAccounts.length === 0 ? (
                              <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{toMember?.user.name} 没有投资账户，请先为其创建账户</span>
                              </div>
                            ) : (
                              <Select value={targetAccountId} onValueChange={setTargetAccountId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="选择目标账户" />
                                </SelectTrigger>
                                <SelectContent position="popper" sideOffset={5}>
                                  {targetAccounts.map((acc) => (
                                    <SelectItem key={acc.id} value={acc.id}>
                                      {acc.accountName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* 其他资产 Tab */}
                <TabsContent value="assets" className="space-y-3 mt-3">
                  {assets.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-sm">
                      该成员没有其他资产
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>选择资产 <span className="text-red-500">*</span></Label>
                        <Select value={selectedAssetId} onValueChange={(v) => {
                          setSelectedAssetId(v);
                          setQuantity('');
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择要转移的资产" />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={5}>
                            {assets.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                <div className="flex items-center gap-2">
                                  {a.isSplittable ? (
                                    <Wallet className="w-3.5 h-3.5 text-green-500" />
                                  ) : (
                                    <Building2 className="w-3.5 h-3.5 text-purple-500" />
                                  )}
                                  <span>{a.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {a.categoryName}
                                  </Badge>
                                  <span className="text-slate-500 ml-auto">
                                    {formatCurrency(a.currentValue, a.currency)}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedAsset && (
                        <div className="space-y-3">
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">资产名称：</span>
                              <span className="font-medium">{selectedAsset.name}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-slate-500">分类：</span>
                              <span className="font-medium">{selectedAsset.categoryName}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-slate-500">当前价值：</span>
                              <span className="font-medium">{formatCurrency(selectedAsset.currentValue, selectedAsset.currency)}</span>
                            </div>
                          </div>

                          {selectedAsset.isSplittable ? (
                            <div className="space-y-2">
                              <Label>转移金额 <span className="text-red-500">*</span></Label>
                              <Input
                                type="number"
                                placeholder="请输入转移金额"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                max={selectedAsset.currentValue}
                                step="0.01"
                              />
                              <p className="text-xs text-slate-500">
                                可用余额: {formatCurrency(selectedAsset.currentValue, selectedAsset.currency)}
                              </p>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
                              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              <span>该资产将整体转移到 {toMember?.user.name} 名下</span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* 负债 Tab */}
                <TabsContent value="liabilities" className="space-y-3 mt-3">
                  {liabilities.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-sm">
                      该成员没有负债
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>选择负债 <span className="text-red-500">*</span></Label>
                        <Select value={selectedLiabilityId} onValueChange={setSelectedLiabilityId}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择要转移的负债" />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={5}>
                            {liabilities.map((l) => (
                              <SelectItem key={l.id} value={l.id}>
                                <div className="flex items-center gap-2">
                                  <CreditCard className="w-3.5 h-3.5 text-red-500" />
                                  <span>{l.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {liabilityTypeLabel(l.type)}
                                  </Badge>
                                  <span className="text-red-500 ml-auto">
                                    {formatCurrency(l.currentBalance, l.currency)}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedLiability && (
                        <div className="space-y-3">
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">负债名称：</span>
                              <span className="font-medium">{selectedLiability.name}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-slate-500">类型：</span>
                              <span className="font-medium">{liabilityTypeLabel(selectedLiability.type)}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-slate-500">当前余额：</span>
                              <span className="font-medium text-red-600 dark:text-red-400">
                                {formatCurrency(selectedLiability.currentBalance, selectedLiability.currency)}
                              </span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-slate-500">本金：</span>
                              <span className="font-medium">
                                {formatCurrency(selectedLiability.principalAmount, selectedLiability.currency)}
                              </span>
                            </div>
                            {selectedLiability.interestRate != null && (
                              <div className="flex justify-between mt-1">
                                <span className="text-slate-500">利率：</span>
                                <span className="font-medium">{selectedLiability.interestRate}%</span>
                              </div>
                            )}
                            {selectedLiability.monthlyPayment != null && (
                              <div className="flex justify-between mt-1">
                                <span className="text-slate-500">月供：</span>
                                <span className="font-medium">
                                  {formatCurrency(selectedLiability.monthlyPayment, selectedLiability.currency)}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-start gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>该负债将整体转移到 {toMember?.user.name} 名下</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}

            {/* 备注 */}
            <div className="space-y-2">
              <Label>备注（可选）</Label>
              <Input
                placeholder="如：家庭资产重新分配、赠与等"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step 3: 确认转移 */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                转移确认
              </h4>

              {/* 成员方向 */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex-1">
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {fromMember?.user.name}
                  </div>
                  <div className="text-slate-500 text-xs">转出方</div>
                </div>
                <ArrowRight className="w-5 h-5 text-blue-400 mx-4" />
                <div className="flex-1 text-right">
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {toMember?.user.name}
                  </div>
                  <div className="text-slate-500 text-xs">转入方</div>
                </div>
              </div>

              {/* 资产详情 */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">类型：</span>
                  <Badge className={
                    assetTab === 'holdings'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : assetTab === 'liabilities'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  }>
                    {assetTab === 'holdings' ? '证券持仓' : assetTab === 'liabilities' ? '负债转移' : '整体资产'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">名称：</span>
                  <span className="font-medium">
                    {assetTab === 'holdings'
                      ? `${selectedHolding?.symbol} - ${selectedHolding?.securityName}`
                      : assetTab === 'liabilities'
                        ? selectedLiability?.name
                        : selectedAsset?.name}
                  </span>
                </div>
                {(assetTab === 'holdings' || selectedAsset?.isSplittable) && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {assetTab === 'holdings' ? '转移数量：' : '转移金额：'}
                    </span>
                    <span className="font-medium">
                      {assetTab === 'holdings'
                        ? `${transferAll ? selectedHolding?.quantity : quantity} 股`
                        : formatCurrency(parseFloat(quantity) || 0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="text-slate-500">
                    {assetTab === 'liabilities' ? '负债余额：' : '预估价值：'}
                  </span>
                  <span className={`font-semibold ${assetTab === 'liabilities' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    {formatCurrency(
                      getTransferValue(),
                      assetTab === 'liabilities' ? selectedLiability?.currency : undefined
                    )}
                  </span>
                </div>
                {notes && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">备注：</span>
                    <span className="text-slate-700 dark:text-slate-300">{notes}</span>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  转移操作将立即生效，资产所有权将变更。请确认以上信息无误。
                </span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              disabled={submitting}
            >
              上一步
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>

          {step === 1 && (
            <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
              下一步
            </Button>
          )}
          {step === 2 && (
            <Button onClick={() => setStep(3)} disabled={!canProceedStep2}>
              下一步
            </Button>
          )}
          {step === 3 && (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  转移中...
                </>
              ) : (
                '确认转移'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
