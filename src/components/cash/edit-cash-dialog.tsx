'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Wallet } from 'lucide-react';

export interface EditCashData {
  cashBalanceOriginal: number;
  currency: string;
}

interface EditCashDialogProps {
  accountId: string | null;
  accountName: string | null;
  broker: string | null;
  initialAmount: number;
  initialCurrency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (accountId: string, data: EditCashData) => Promise<void>;
}

export function EditCashDialog({
  accountId,
  accountName,
  broker,
  initialAmount,
  initialCurrency,
  open,
  onOpenChange,
  onSave,
}: EditCashDialogProps) {
  const [amount, setAmount] = useState(initialAmount.toString());
  const [currency, setCurrency] = useState(initialCurrency);
  const [isSaving, setIsSaving] = useState(false);

  // 当对话框打开或初始值改变时，重置表单
  useEffect(() => {
    if (open) {
      setAmount(initialAmount.toString());
      setCurrency(initialCurrency);
    }
  }, [open, initialAmount, initialCurrency]);

  // 处理金额输入
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // 只允许数字和小数点
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  // 自动选中输入框内容
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  // 提交保存
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accountId) {
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      alert('请输入有效的金额');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(accountId, {
        cashBalanceOriginal: numAmount,
        currency,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (curr: string) => {
    switch (curr) {
      case 'USD':
        return '美元 (USD)';
      case 'HKD':
        return '港元 (HKD)';
      case 'CNY':
        return '人民币 (CNY)';
      default:
        return curr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-xl">编辑现金余额</DialogTitle>
              <DialogDescription className="text-sm mt-1">
                {accountName} - {broker}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* 金额输入 */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm font-medium">
                现金余额 *
              </Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={handleAmountChange}
                onFocus={handleInputFocus}
                placeholder="请输入金额"
                className="text-lg"
                required
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                请输入账户的可用现金余额
              </p>
            </div>

            {/* 币种选择 */}
            <div className="space-y-2">
              <Label htmlFor="currency" className="text-sm font-medium">
                货币类型 *
              </Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency" className="text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNY">
                    <div className="flex items-center gap-2">
                      <span>💴</span>
                      <span>{formatCurrency('CNY')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="USD">
                    <div className="flex items-center gap-2">
                      <span>💵</span>
                      <span>{formatCurrency('USD')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="HKD">
                    <div className="flex items-center gap-2">
                      <span>💶</span>
                      <span>{formatCurrency('HKD')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                选择账户使用的货币类型
              </p>
            </div>

            {/* 预览 */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">更新后余额：</span>
                <span className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                  {currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : '¥'}
                  {amount || '0'}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              取消
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
