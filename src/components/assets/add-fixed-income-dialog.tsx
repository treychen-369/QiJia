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
import { Shield, FileText, TrendingUp, Loader2 } from 'lucide-react';

interface AddFixedIncomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type AssetType = 'FIXED_BOND' | 'FIXED_CONVERTIBLE' | 'FIXED_WEALTH';

interface AssetCategory {
  id: string;
  code: string;
  name: string;
}

export function AddFixedIncomeDialog({ open, onOpenChange, onSuccess }: AddFixedIncomeDialogProps) {
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
    quantity: '',
    unitPrice: '',
    // 债券特有字段
    bondCode: '',
    issuer: '',
    couponRate: '',
    maturityYield: '',
    issueDate: '',
    maturityDate: '',
    bondType: '', // 国债/地方债/公司债
    // 可转债特有字段
    conversionPrice: '',
    stockCode: '',
    // 理财产品特有字段
    productCode: '',
    institution: '',
    expectedReturn: '',
    riskLevel: '', // R1-R5
    purchaseDate: '',
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
      if (data.success) {
        // 筛选固定收益类二级分类
        const fixedIncomeCategories = data.data.filter(
          (cat: any) => cat.parent?.code === 'FIXED_INCOME' && cat.level === 2
        );
        setCategories(fixedIncomeCategories);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  };

  const handleAssetTypeChange = (type: AssetType) => {
    setAssetType(type);
    // 根据类型自动选择分类
    const category = categories.find(c => c.code === type);
    if (category) {
      setSelectedCategoryId(category.id);
    }
    // 重置表单
    setFormData({
      name: '',
      description: '',
      amount: '',
      currency: 'CNY',
      quantity: '',
      unitPrice: '',
      bondCode: '',
      issuer: '',
      couponRate: '',
      maturityYield: '',
      issueDate: '',
      maturityDate: '',
      bondType: '',
      conversionPrice: '',
      stockCode: '',
      productCode: '',
      institution: '',
      expectedReturn: '',
      riskLevel: '',
      purchaseDate: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

      if (assetType === 'FIXED_BOND') {
        metadata.bondCode = formData.bondCode;
        metadata.issuer = formData.issuer;
        metadata.couponRate = parseFloat(formData.couponRate || '0');
        // ⭐ API期望的字段名
        metadata.annualYield = parseFloat(formData.couponRate || '0');
        metadata.maturityYield = parseFloat(formData.maturityYield || '0');
        metadata.bondType = formData.bondType;
      } else if (assetType === 'FIXED_CONVERTIBLE') {
        metadata.bondCode = formData.bondCode;
        metadata.issuer = formData.issuer;
        metadata.couponRate = parseFloat(formData.couponRate || '0');
        // ⭐ API期望的字段名
        metadata.annualYield = parseFloat(formData.couponRate || '0');
        metadata.conversionPrice = parseFloat(formData.conversionPrice || '0');
        metadata.stockCode = formData.stockCode;
      } else if (assetType === 'FIXED_WEALTH') {
        metadata.productCode = formData.productCode;
        metadata.institution = formData.institution;
        metadata.expectedReturn = parseFloat(formData.expectedReturn || '0');
        // ⭐ API期望的字段名
        metadata.annualYield = parseFloat(formData.expectedReturn || '0');
        metadata.riskLevel = formData.riskLevel;
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
          quantity: parseFloat(formData.quantity || '1'),
          unitPrice: parseFloat(formData.unitPrice || formData.amount),
          purchasePrice: parseFloat(formData.amount),
          originalValue: parseFloat(formData.amount),
          currency: formData.currency,
          purchaseDate: formData.purchaseDate || formData.issueDate || null,
          maturityDate: formData.maturityDate || null,
          metadata,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '创建失败');
      }

      toast({
        title: '创建成功',
        description: '固定收益产品已添加',
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
          variant={assetType === 'FIXED_BOND' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleAssetTypeChange('FIXED_BOND')}
        >
          <Shield className="h-6 w-6" />
          <span>债券</span>
        </Button>
        <Button
          type="button"
          variant={assetType === 'FIXED_CONVERTIBLE' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleAssetTypeChange('FIXED_CONVERTIBLE')}
        >
          <TrendingUp className="h-6 w-6" />
          <span>可转债</span>
        </Button>
        <Button
          type="button"
          variant={assetType === 'FIXED_WEALTH' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleAssetTypeChange('FIXED_WEALTH')}
        >
          <FileText className="h-6 w-6" />
          <span>理财产品</span>
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
          <Label htmlFor="name">产品名称 *</Label>
          <Input
            id="name"
            placeholder={
              assetType === 'FIXED_BOND' ? '例如：2024年国债01' :
              assetType === 'FIXED_CONVERTIBLE' ? '例如：平安转债' :
              '例如：招银理财月月享'
            }
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount">购买金额 *</Label>
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

        {/* 债券特有字段 */}
        {assetType === 'FIXED_BOND' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bondCode">债券代码</Label>
                <Input
                  id="bondCode"
                  placeholder="例如：019666"
                  value={formData.bondCode}
                  onChange={(e) => setFormData({ ...formData, bondCode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bondType">债券类型</Label>
                <Select value={formData.bondType} onValueChange={(value) => setFormData({ ...formData, bondType: value })}>
                  <SelectTrigger id="bondType">
                    <SelectValue placeholder="选择类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="国债">国债</SelectItem>
                    <SelectItem value="地方债">地方债</SelectItem>
                    <SelectItem value="公司债">公司债</SelectItem>
                    <SelectItem value="企业债">企业债</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issuer">发行人</Label>
              <Input
                id="issuer"
                placeholder="例如：中华人民共和国财政部"
                value={formData.issuer}
                onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="couponRate">票面利率 (%)</Label>
                <Input
                  id="couponRate"
                  type="number"
                  step="0.01"
                  placeholder="2.75"
                  value={formData.couponRate}
                  onChange={(e) => setFormData({ ...formData, couponRate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maturityYield">到期收益率 (%)</Label>
                <Input
                  id="maturityYield"
                  type="number"
                  step="0.01"
                  placeholder="3.00"
                  value={formData.maturityYield}
                  onChange={(e) => setFormData({ ...formData, maturityYield: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issueDate">发行日期</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
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

            {/* 债券收益预估 */}
            {formData.amount && formData.couponRate && formData.issueDate && formData.maturityDate && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950 p-4 space-y-2">
                <div className="text-sm font-medium text-amber-900 dark:text-amber-100">收益预估</div>
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
                        const rate = parseFloat(formData.couponRate) / 100;
                        const start = new Date(formData.issueDate);
                        const end = new Date(formData.maturityDate);
                        const years = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
                        const interest = principal * rate * years;
                        return interest.toFixed(2);
                      })()}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-600 dark:text-slate-400">到期本息</div>
                    <div className="font-medium text-amber-600">
                      ¥{(() => {
                        const principal = parseFloat(formData.amount);
                        const rate = parseFloat(formData.couponRate) / 100;
                        const start = new Date(formData.issueDate);
                        const end = new Date(formData.maturityDate);
                        const years = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
                        const interest = principal * rate * years;
                        return (principal + interest).toFixed(2);
                      })()}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  * 以票面利率计算，不考虑买卖价差，实际收益以到期收益率为准
                </div>
              </div>
            )}
          </>
        )}

        {/* 可转债特有字段 */}
        {assetType === 'FIXED_CONVERTIBLE' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bondCode">转债代码</Label>
                <Input
                  id="bondCode"
                  placeholder="例如：113050"
                  value={formData.bondCode}
                  onChange={(e) => setFormData({ ...formData, bondCode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stockCode">正股代码</Label>
                <Input
                  id="stockCode"
                  placeholder="例如：600000"
                  value={formData.stockCode}
                  onChange={(e) => setFormData({ ...formData, stockCode: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issuer">发行公司</Label>
              <Input
                id="issuer"
                placeholder="例如：平安银行"
                value={formData.issuer}
                onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="couponRate">票面利率 (%)</Label>
                <Input
                  id="couponRate"
                  type="number"
                  step="0.01"
                  placeholder="0.50"
                  value={formData.couponRate}
                  onChange={(e) => setFormData({ ...formData, couponRate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conversionPrice">转股价格 (元)</Label>
                <Input
                  id="conversionPrice"
                  type="number"
                  step="0.01"
                  placeholder="15.50"
                  value={formData.conversionPrice}
                  onChange={(e) => setFormData({ ...formData, conversionPrice: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchaseDate">购买日期</Label>
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
          </>
        )}

        {/* 理财产品特有字段 */}
        {assetType === 'FIXED_WEALTH' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="productCode">产品代码</Label>
                <Input
                  id="productCode"
                  placeholder="例如：CMB001"
                  value={formData.productCode}
                  onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="riskLevel">风险等级</Label>
                <Select value={formData.riskLevel} onValueChange={(value) => setFormData({ ...formData, riskLevel: value })}>
                  <SelectTrigger id="riskLevel">
                    <SelectValue placeholder="选择等级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R1">R1 - 低风险</SelectItem>
                    <SelectItem value="R2">R2 - 中低风险</SelectItem>
                    <SelectItem value="R3">R3 - 中风险</SelectItem>
                    <SelectItem value="R4">R4 - 中高风险</SelectItem>
                    <SelectItem value="R5">R5 - 高风险</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="institution">发行机构</Label>
              <Input
                id="institution"
                placeholder="例如：招商银行"
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expectedReturn">预期年化收益率 (%)</Label>
                <Input
                  id="expectedReturn"
                  type="number"
                  step="0.01"
                  placeholder="4.50"
                  value={formData.expectedReturn}
                  onChange={(e) => setFormData({ ...formData, expectedReturn: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchaseDate">购买日期</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maturityDate">到期日期（可选）</Label>
              <Input
                id="maturityDate"
                type="date"
                value={formData.maturityDate}
                onChange={(e) => setFormData({ ...formData, maturityDate: e.target.value })}
              />
            </div>

            {/* 理财收益预估 */}
            {formData.amount && formData.expectedReturn && formData.purchaseDate && formData.maturityDate && (
              <div className="rounded-lg bg-purple-50 dark:bg-purple-950 p-4 space-y-2">
                <div className="text-sm font-medium text-purple-900 dark:text-purple-100">收益预估</div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-slate-600 dark:text-slate-400">本金</div>
                    <div className="font-medium">¥{parseFloat(formData.amount).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-slate-600 dark:text-slate-400">预期收益</div>
                    <div className="font-medium text-green-600">
                      ¥{(() => {
                        const principal = parseFloat(formData.amount);
                        const rate = parseFloat(formData.expectedReturn) / 100;
                        const start = new Date(formData.purchaseDate);
                        const end = new Date(formData.maturityDate);
                        const days = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                        const income = principal * rate * days / 365;
                        return income.toFixed(2);
                      })()}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-600 dark:text-slate-400">到期本息</div>
                    <div className="font-medium text-purple-600">
                      ¥{(() => {
                        const principal = parseFloat(formData.amount);
                        const rate = parseFloat(formData.expectedReturn) / 100;
                        const start = new Date(formData.purchaseDate);
                        const end = new Date(formData.maturityDate);
                        const days = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                        const income = principal * rate * days / 365;
                        return (principal + income).toFixed(2);
                      })()}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  * 预期收益非保证收益，实际收益可能高于或低于预期
                </div>
              </div>
            )}
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
          <DialogTitle>添加固定收益产品</DialogTitle>
          <DialogDescription>
            选择产品类型并填写相关信息
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
