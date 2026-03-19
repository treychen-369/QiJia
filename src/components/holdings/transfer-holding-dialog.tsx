'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

interface TransferHoldingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holding: {
    id: string;
    securityName: string;
    symbol: string;
    quantity: number;
    averageCost: number;
    accountId: string;
    accountName: string;
  } | null;
  onSuccess?: () => void;
}

interface Account {
  id: string;
  accountName: string;
  broker: {
    id: string;
    name: string;
    code: string;
    country: string;
  };
  currency: string;
}

export function TransferHoldingDialog({ open, onOpenChange, holding, onSuccess }: TransferHoldingDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  
  const [targetAccountId, setTargetAccountId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [transferMode, setTransferMode] = useState<'partial' | 'full'>('partial');

  // 加载账户列表
  useEffect(() => {
    if (open) {
      loadAccounts();
      // 默认部分转移
      setTransferMode('partial');
      setQuantity('');
      setNotes('');
      setTargetAccountId('');
    }
  }, [open, holding]);

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const response = await fetch('/api/accounts');
      if (!response.ok) throw new Error('加载账户列表失败');
      
      const result = await response.json();
      // 修复：API返回的字段是 data 而不是 accounts
      const allAccounts = result.data || [];
      
      // 过滤掉源账户
      const filteredAccounts = allAccounts.filter(
        (acc: Account) => acc.id !== holding?.accountId
      );
      
      setAccounts(filteredAccounts);
    } catch (error) {
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleTransfer = async () => {
    if (!holding) return;

    // 验证
    if (!targetAccountId) {
      toast({
        title: '请选择目标账户',
        variant: 'destructive',
      });
      return;
    }

    const transferQuantity = transferMode === 'full' 
      ? holding.quantity 
      : parseFloat(quantity);

    if (isNaN(transferQuantity) || transferQuantity <= 0) {
      toast({
        title: '请输入有效的转移数量',
        variant: 'destructive',
      });
      return;
    }

    if (transferQuantity > holding.quantity) {
      toast({
        title: '转移数量不能超过持有数量',
        description: `最多可转移 ${holding.quantity}`,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/holdings/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceHoldingId: holding.id, // 修复：字段名从 holdingId 改为 sourceHoldingId
          targetAccountId,
          quantity: transferQuantity,
          keepCostBasis: true, // 保持原成本价
          notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '转移失败');
      }

      const data = await response.json();
      
      toast({
        title: '转移成功',
        description: `已将 ${transferQuantity} 股 ${holding.securityName} 转移到目标账户`,
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
      setLoading(false);
    }
  };

  if (!holding) return null;

  const targetAccount = accounts.find(acc => acc.id === targetAccountId);
  const transferQuantityNum = transferMode === 'full' 
    ? holding.quantity 
    : parseFloat(quantity) || 0;
  const remainingQuantity = holding.quantity - transferQuantityNum;
  const transferCost = transferQuantityNum * holding.averageCost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>转移持仓</DialogTitle>
          <DialogDescription>
            将持仓转移到另一个投资账户
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 持仓信息 */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">当前持仓</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">证券：</span>
                <span className="font-medium ml-2">{holding.symbol} - {holding.securityName}</span>
              </div>
              <div>
                <span className="text-gray-600">账户：</span>
                <span className="font-medium ml-2">{holding.accountName}</span>
              </div>
              <div>
                <span className="text-gray-600">持有数量：</span>
                <span className="font-medium ml-2">{holding.quantity}</span>
              </div>
              <div>
                <span className="text-gray-600">平均成本：</span>
                <span className="font-medium ml-2">¥{holding.averageCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 转移设置 */}
          <div className="space-y-4">
            {/* 目标账户 */}
            <div className="space-y-2">
              <Label htmlFor="targetAccount">
                目标账户 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={targetAccountId}
                onValueChange={setTargetAccountId}
                disabled={loadingAccounts}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingAccounts ? '加载中...' : '选择目标账户'} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={5}>
                  {accounts.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500 text-center">
                      {loadingAccounts ? '加载中...' : '暂无其他账户'}
                    </div>
                  ) : (
                    accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.accountName} - {account.broker.name} ({account.currency})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 转移模式 */}
            <div className="space-y-2">
              <Label>转移模式</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={transferMode === 'partial' ? 'default' : 'outline'}
                  onClick={() => setTransferMode('partial')}
                  className="flex-1"
                >
                  部分转移
                </Button>
                <Button
                  type="button"
                  variant={transferMode === 'full' ? 'default' : 'outline'}
                  onClick={() => {
                    setTransferMode('full');
                    setQuantity(holding.quantity.toString());
                  }}
                  className="flex-1"
                >
                  全部转移
                </Button>
              </div>
            </div>

            {/* 转移数量 */}
            {transferMode === 'partial' && (
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  转移数量 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder="请输入转移数量"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  max={holding.quantity}
                  step="0.01"
                />
                <p className="text-xs text-gray-500">
                  最大可转移数量：{holding.quantity}
                </p>
              </div>
            )}

            {/* 备注 */}
            <div className="space-y-2">
              <Label htmlFor="notes">备注（可选）</Label>
              <Input
                id="notes"
                placeholder="如：账户整合、税务规划等"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* 转移预览 */}
          {targetAccountId && transferQuantityNum > 0 && (
            <div className="border rounded-lg p-4 space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                转移预览
              </h4>
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex-1">
                  <div className="font-medium">{holding.accountName}</div>
                  <div className="text-gray-600">
                    {transferMode === 'full' ? '全部转出' : `剩余 ${remainingQuantity}`}
                  </div>
                </div>
                
                <ArrowRight className="w-5 h-5 text-gray-400 mx-4" />
                
                <div className="flex-1 text-right">
                  <div className="font-medium">{targetAccount?.accountName}</div>
                  <div className="text-gray-600">
                    接收 {transferQuantityNum}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">转移数量：</span>
                  <span className="font-medium">{transferQuantityNum}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">平均成本：</span>
                  <span className="font-medium">¥{holding.averageCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="text-gray-600">转移成本价值：</span>
                  <span className="font-medium">¥{transferCost.toFixed(2)}</span>
                </div>
              </div>

              {transferMode === 'full' && (
                <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    全部转移后，源账户中的该持仓将被删除
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button 
            onClick={handleTransfer} 
            disabled={loading || !targetAccountId || (transferMode === 'partial' && !quantity)}
          >
            {loading ? '转移中...' : '确认转移'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
