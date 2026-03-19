'use client';

/**
 * 编辑账户现金余额对话框
 * 
 * 功能：
 * - 显示当前现金余额
 * - 允许用户手动输入新的现金余额
 * - 自动计算CNY换算值
 * 
 * 2026-01-31 新增
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, RefreshCw, TrendingUp } from 'lucide-react';
import { formatters } from '@/lib/api-client';

interface EditCashBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
  broker: string;
  currency: string;
  currentBalance: number;
  exchangeRate: number;
  onSuccess: () => void;
}

export function EditCashBalanceDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  broker,
  currency,
  currentBalance,
  exchangeRate,
  onSuccess
}: EditCashBalanceDialogProps) {
  const [balance, setBalance] = useState(currentBalance.toString());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 当对话框打开时，重置状态
  useEffect(() => {
    if (open) {
      setBalance(currentBalance.toString());
      setError(null);
    }
  }, [open, currentBalance]);

  // 计算CNY预览值
  const balanceNum = parseFloat(balance) || 0;
  const balanceCny = balanceNum * exchangeRate;

  const handleSave = async () => {
    const numBalance = parseFloat(balance);
    
    if (isNaN(numBalance) || numBalance < 0) {
      setError('请输入有效的金额');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/accounts/${accountId}/cash`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashBalance: numBalance })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '更新失败');
      }

      console.log('✅ 现金余额更新成功:', data);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('更新现金余额失败:', err);
      setError(err instanceof Error ? err.message : '更新失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 格式化货币显示
  const formatCurrency = (value: number, curr: string) => {
    const symbols: Record<string, string> = {
      CNY: '¥',
      USD: '$',
      HKD: 'HK$',
      JPY: '¥',
      EUR: '€',
      GBP: '£'
    };
    const symbol = symbols[curr] || curr + ' ';
    return `${symbol}${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-amber-500" />
            编辑现金余额
          </DialogTitle>
          <DialogDescription>
            更新 {accountName} 账户的现金余额
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 账户信息 */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">账户</span>
              <span className="font-medium">{accountName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">券商</span>
              <span>{broker}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">币种</span>
              <span>{currency}</span>
            </div>
            {currency !== 'CNY' && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">汇率</span>
                <span>1 {currency} = {exchangeRate.toFixed(4)} CNY</span>
              </div>
            )}
          </div>

          {/* 当前余额 */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">当前余额</span>
            <span className="font-medium">{formatCurrency(currentBalance, currency)}</span>
          </div>

          {/* 输入框 */}
          <div className="space-y-2">
            <Label htmlFor="balance">新的现金余额 ({currency})</Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              min="0"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder={`请输入 ${currency} 金额`}
              className="text-lg"
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          {/* CNY换算预览 */}
          {currency !== 'CNY' && balanceNum > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">换算为人民币：</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {formatters.currency(balanceCny)}
              </span>
            </div>
          )}

          {/* 变化提示 */}
          {balanceNum !== currentBalance && (
            <div className={`text-sm ${balanceNum > currentBalance ? 'text-green-600' : 'text-red-600'}`}>
              {balanceNum > currentBalance ? '📈' : '📉'} 
              {' '}变化: {balanceNum > currentBalance ? '+' : ''}
              {formatCurrency(balanceNum - currentBalance, currency)}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading || parseFloat(balance) < 0}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              '保存'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
