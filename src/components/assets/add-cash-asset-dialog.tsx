'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Wallet, PiggyBank, Sparkles, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface AddCashAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type AssetType = 'CASH_DEMAND' | 'CASH_FIXED' | 'CASH_MONEY_FUND';

interface AssetCategory {
  id: string;
  code: string;
  name: string;
}

export function AddCashAssetDialog({ open, onOpenChange, onSuccess }: AddCashAssetDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [assetType, setAssetType] = useState<AssetType | ''>('');
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    currency: 'CNY',
    // 活期存款
    bankName: '',
    accountNumber: '',
    // 定期存款
    interestRate: '',
    purchaseDate: '',
    maturityDate: '',
    autoRenewal: false,
    // 货币基金
    fundCode: '',
    dailyYield: '',
    yield7Day: '',
  });

  // 加载资产分类
  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/asset-categories');
      const data = await response.json();
      console.log('API返回的所有分类:', data);
      if (data.success) {
        // 筛选现金类二级分类
        const cashCategories = data.data.filter(
          (cat: any) => cat.parent?.code === 'CASH' && cat.level === 2
        );
        console.log('筛选后的现金类分类:', cashCategories);
        setCategories(cashCategories);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  };

  const handleAssetTypeChange = (type: AssetType) => {
    setAssetType(type);
    // 根据类型自动选择分类
    const category = categories.find(c => c.code === type);
    console.log('选择的资产类型:', type);
    console.log('可用分类:', categories);
    console.log('匹配到的分类:', category);
    if (category) {
      setSelectedCategoryId(category.id);
      console.log('设置分类ID:', category.id);
    } else {
      console.warn('未找到匹配的分类！');
    }
    // 重置表单
    setFormData({
      name: '',
      description: '',
      amount: '',
      currency: 'CNY',
      bankName: '',
      accountNumber: '',
      interestRate: '',
      purchaseDate: '',
      maturityDate: '',
      autoRenewal: false,
      fundCode: '',
      dailyYield: '',
      yield7Day: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('提交表单 - 资产类型:', assetType);
    console.log('提交表单 - 分类ID:', selectedCategoryId);
    console.log('提交表单 - 表单数据:', formData);
    
    if (!assetType) {
      toast({
        variant: 'destructive',
        title: '请选择资产类型',
      });
      return;
    }

    if (!formData.name || !formData.amount) {
      toast({
        variant: 'destructive',
        title: '请填写必填项',
        description: '资产名称和金额为必填项',
      });
      return;
    }
    
    if (!selectedCategoryId) {
      toast({
        variant: 'destructive',
        title: '分类错误',
        description: '未能识别资产分类，请重新选择资产类型',
      });
      return;
    }

    setIsLoading(true);

    try {
      // 构建元数据
      const metadata: any = {};

      if (assetType === 'CASH_DEMAND') {
        metadata.bankName = formData.bankName;
        metadata.accountNumber = formData.accountNumber;
      } else if (assetType === 'CASH_FIXED') {
        metadata.bankName = formData.bankName;
        metadata.accountNumber = formData.accountNumber;
        metadata.interestRate = parseFloat(formData.interestRate || '0');
        metadata.autoRenewal = formData.autoRenewal;
      } else if (assetType === 'CASH_MONEY_FUND') {
        metadata.fundCode = formData.fundCode;
        metadata.dailyYield = parseFloat(formData.dailyYield || '0');
        metadata.yield7Day = parseFloat(formData.yield7Day || '0');
      }

      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          assetCategoryId: selectedCategoryId,
          purchasePrice: parseFloat(formData.amount),
          originalValue: parseFloat(formData.amount),
          currency: formData.currency,
          purchaseDate: formData.purchaseDate || null,
          maturityDate: formData.maturityDate || null,
          metadata,
        }),
      });
      
      console.log('发送的数据:', {
        name: formData.name,
        description: formData.description,
        assetCategoryId: selectedCategoryId,
        purchasePrice: parseFloat(formData.amount),
        originalValue: parseFloat(formData.amount),
        currency: formData.currency,
        purchaseDate: formData.purchaseDate || null,
        maturityDate: formData.maturityDate || null,
        metadata,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '创建失败');
      }

      toast({
        title: '创建成功',
        description: '现金资产已添加',
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('创建资产失败:', error);
      toast({
        variant: 'destructive',
        title: '创建失败',
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderAssetTypeSelector = () => (
    <div className="space-y-4">
      <Label>选择资产类型 *</Label>
      <div className="grid grid-cols-3 gap-3">
        <Button
          type="button"
          variant={assetType === 'CASH_DEMAND' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleAssetTypeChange('CASH_DEMAND')}
        >
          <Wallet className="h-6 w-6" />
          <span>活期存款</span>
        </Button>
        <Button
          type="button"
          variant={assetType === 'CASH_FIXED' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleAssetTypeChange('CASH_FIXED')}
        >
          <PiggyBank className="h-6 w-6" />
          <span>定期存款</span>
        </Button>
        <Button
          type="button"
          variant={assetType === 'CASH_MONEY_FUND' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleAssetTypeChange('CASH_MONEY_FUND')}
        >
          <Sparkles className="h-6 w-6" />
          <span>货币基金</span>
        </Button>
      </div>
    </div>
  );

  const renderForm = () => {
    if (!assetType) return null;

    return (
      <div className="space-y-4">
        {/* 基本信息 */}
        <div className="space-y-2">
          <Label htmlFor="name">资产名称 *</Label>
          <Input
            id="name"
            placeholder="例如：招商银行活期"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount">金额 *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">货币</Label>
            <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CNY">人民币 (CNY)</SelectItem>
                <SelectItem value="USD">美元 (USD)</SelectItem>
                <SelectItem value="HKD">港币 (HKD)</SelectItem>
                <SelectItem value="JPY">日元 (JPY)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 活期存款特有字段 */}
        {assetType === 'CASH_DEMAND' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="bankName">银行名称</Label>
              <Input
                id="bankName"
                placeholder="例如：招商银行"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountNumber">账户后四位（可选）</Label>
              <Input
                id="accountNumber"
                placeholder="例如：1234"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              />
            </div>
          </>
        )}

        {/* 定期存款特有字段 */}
        {assetType === 'CASH_FIXED' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="bankName">银行名称</Label>
              <Input
                id="bankName"
                placeholder="例如：招商银行"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="interestRate">年利率 (%)</Label>
                <Input
                  id="interestRate"
                  type="number"
                  step="0.01"
                  placeholder="2.75"
                  value={formData.interestRate}
                  onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">账户后四位（可选）</Label>
                <Input
                  id="accountNumber"
                  placeholder="1234"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchaseDate">存入日期</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maturityDate">到期日期</Label>
                <Input
                  id="maturityDate"
                  type="date"
                  value={formData.maturityDate}
                  onChange={(e) => setFormData({ ...formData, maturityDate: e.target.value })}
                />
              </div>
            </div>
            
            {/* 预计收益显示 */}
            {formData.amount && formData.interestRate && formData.purchaseDate && formData.maturityDate && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 space-y-2">
                <div className="text-sm font-medium text-blue-900 dark:text-blue-100">收益预估</div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-slate-600 dark:text-slate-400">本金</div>
                    <div className="font-medium">¥{parseFloat(formData.amount).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-slate-600 dark:text-slate-400">预计利息</div>
                    <div className="font-medium text-green-600">
                      ¥{(() => {
                        const principal = parseFloat(formData.amount);
                        const rate = parseFloat(formData.interestRate) / 100;
                        const start = new Date(formData.purchaseDate);
                        const end = new Date(formData.maturityDate);
                        const days = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                        const interest = principal * rate * days / 365;
                        return interest.toFixed(2);
                      })()}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-600 dark:text-slate-400">到期本息</div>
                    <div className="font-medium text-blue-600">
                      ¥{(() => {
                        const principal = parseFloat(formData.amount);
                        const rate = parseFloat(formData.interestRate) / 100;
                        const start = new Date(formData.purchaseDate);
                        const end = new Date(formData.maturityDate);
                        const days = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                        const interest = principal * rate * days / 365;
                        return (principal + interest).toFixed(2);
                      })()}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  * 以单利方式计算，实际收益以银行结算为准
                </div>
              </div>
            )}
          </>
        )}

        {/* 货币基金特有字段 */}
        {assetType === 'CASH_MONEY_FUND' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="fundCode">基金代码（可选）</Label>
              <Input
                id="fundCode"
                placeholder="例如：000001"
                value={formData.fundCode}
                onChange={(e) => setFormData({ ...formData, fundCode: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dailyYield">每日万份收益</Label>
                <Input
                  id="dailyYield"
                  type="number"
                  step="0.0001"
                  placeholder="0.5000"
                  value={formData.dailyYield}
                  onChange={(e) => setFormData({ ...formData, dailyYield: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yield7Day">7日年化收益率 (%)</Label>
                <Input
                  id="yield7Day"
                  type="number"
                  step="0.01"
                  placeholder="1.85"
                  value={formData.yield7Day}
                  onChange={(e) => setFormData({ ...formData, yield7Day: e.target.value })}
                />
              </div>
            </div>
          </>
        )}

        {/* 备注 */}
        <div className="space-y-2">
          <Label htmlFor="description">备注（可选）</Label>
          <Textarea
            id="description"
            placeholder="添加备注信息..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>添加现金资产</DialogTitle>
          <DialogDescription>
            选择资产类型并填写相关信息
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {renderAssetTypeSelector()}
          {renderForm()}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading || !assetType}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
