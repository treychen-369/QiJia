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
import { Loader2 } from 'lucide-react';

interface Asset {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  purchasePrice: number;
  currentValue: number;
  currency: string;
  purchaseDate: string | null;
  maturityDate: string | null;
  metadata: any;
  assetCategory: {
    code: string | null;
    name: string;
    parent?: {
      code: string | null;
    };
  };
}

interface EditRealEstateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset;
  onSuccess?: () => void;
}

export function EditRealEstateDialog({ open, onOpenChange, asset, onSuccess }: EditRealEstateDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const metadata = asset.metadata || {};
  const assetType = asset.assetCategory?.code;

  const [formData, setFormData] = useState({
    name: asset.name,
    description: asset.description || '',
    // 基本信息
    address: metadata.address || '',
    area: metadata.area?.toString() || '',
    propertyType: metadata.propertyType || 'residential',
    // 价格信息
    purchasePrice: asset.purchasePrice?.toString() || '',
    currentValue: (asset.currentValue != null ? asset.currentValue : asset.purchasePrice)?.toString() || '',
    unitPrice_perSqm: metadata.unitPrice_perSqm?.toString() || '',
    // 租金收益
    rentalIncome: (metadata.rentalIncome || metadata.monthlyRent || '')?.toString() || '',
    vacancyRate: metadata.vacancyRate?.toString() || '0',
    annualExpenses: metadata.annualExpenses?.toString() || '0',
    // 预期增值
    annualAppreciation: metadata.annualAppreciation?.toString() || '',
    // 日期
    purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
    // REITs 特有字段
    fundCode: metadata.fundCode || '',
    dividendYield: metadata.dividendYield?.toString() || '',
  });

  useEffect(() => {
    if (open) {
      const meta = asset.metadata || {};
      setFormData({
        name: asset.name,
        description: asset.description || '',
        address: meta.address || '',
        area: meta.area?.toString() || '',
        propertyType: meta.propertyType || 'residential',
        purchasePrice: asset.purchasePrice?.toString() || '',
        currentValue: (asset.currentValue != null ? asset.currentValue : asset.purchasePrice)?.toString() || '',
        unitPrice_perSqm: meta.unitPrice_perSqm?.toString() || '',
        rentalIncome: (meta.rentalIncome || meta.monthlyRent || '')?.toString() || '',
        vacancyRate: meta.vacancyRate?.toString() || '0',
        annualExpenses: meta.annualExpenses?.toString() || '0',
        annualAppreciation: meta.annualAppreciation?.toString() || '',
        purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
        fundCode: meta.fundCode || '',
        dividendYield: meta.dividendYield?.toString() || '',
      });
    }
  }, [open, asset]);

  // 当面积或单价变化时，自动计算购买价格
  const calculatePurchasePrice = () => {
    const area = parseFloat(formData.area);
    const unitPrice = parseFloat(formData.unitPrice_perSqm);
    if (area > 0 && unitPrice > 0) {
      return area * unitPrice;
    }
    return null;
  };

  // 计算租金收益率
  const calculateRentalYield = () => {
    const monthlyRent = parseFloat(formData.rentalIncome);
    const currentValue = parseFloat(formData.currentValue);
    if (monthlyRent > 0 && currentValue > 0) {
      return ((monthlyRent * 12) / currentValue) * 100;
    }
    return 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.purchasePrice) {
      toast({
        variant: 'destructive',
        title: '请填写必填项',
      });
      return;
    }

    setIsLoading(true);

    try {
      const updatedMetadata: any = { ...metadata };

      // 更新不动产相关字段
      if (formData.address) updatedMetadata.address = formData.address;
      if (formData.area) updatedMetadata.area = parseFloat(formData.area);
      if (formData.propertyType) updatedMetadata.propertyType = formData.propertyType;
      if (formData.unitPrice_perSqm) updatedMetadata.unitPrice_perSqm = parseFloat(formData.unitPrice_perSqm);
      
      // 租金统一使用 rentalIncome 字段
      if (formData.rentalIncome) {
        updatedMetadata.rentalIncome = parseFloat(formData.rentalIncome);
        updatedMetadata.monthlyRent = parseFloat(formData.rentalIncome); // 兼容旧字段
      }
      
      // 空置率和年度支出（用于净租金收益率计算）
      updatedMetadata.vacancyRate = !isNaN(parseFloat(formData.vacancyRate)) ? parseFloat(formData.vacancyRate) : 0;
      updatedMetadata.annualExpenses = !isNaN(parseFloat(formData.annualExpenses)) ? parseFloat(formData.annualExpenses) : 0;
      
      if (formData.annualAppreciation) updatedMetadata.annualAppreciation = parseFloat(formData.annualAppreciation);

      // REITs 特有字段
      if (assetType === 'RE_REIT') {
        if (formData.fundCode) updatedMetadata.fundCode = formData.fundCode;
        if (formData.dividendYield) updatedMetadata.dividendYield = parseFloat(formData.dividendYield);
      }

      const response = await fetch(`/api/assets/${asset.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          purchasePrice: parseFloat(formData.purchasePrice),
          currentValue: !isNaN(parseFloat(formData.currentValue)) ? parseFloat(formData.currentValue) : parseFloat(formData.purchasePrice),
          originalValue: parseFloat(formData.purchasePrice),
          currency: 'CNY', // 不动产默认人民币
          purchaseDate: formData.purchaseDate || null,
          metadata: updatedMetadata,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '更新失败');
      }

      toast({
        title: '更新成功',
        description: '不动产信息已更新',
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('更新不动产失败:', error);
      toast({
        variant: 'destructive',
        title: '更新失败',
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isREIT = assetType === 'RE_REIT';
  const calculatedPrice = calculatePurchasePrice();
  const rentalYield = calculateRentalYield();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>编辑不动产</DialogTitle>
          <DialogDescription>修改不动产信息</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 基本信息 */}
          <div className="space-y-2">
            <Label htmlFor="name">资产名称 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：北京朝阳区三室公寓"
            />
          </div>

          {/* 不动产类型 */}
          <div className="space-y-2">
            <Label htmlFor="propertyType">物业类型</Label>
            <Select
              value={formData.propertyType}
              onValueChange={(value) => setFormData({ ...formData, propertyType: value })}
            >
              <SelectTrigger id="propertyType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="residential">住宅</SelectItem>
                <SelectItem value="commercial">商铺</SelectItem>
                <SelectItem value="office">写字楼</SelectItem>
                <SelectItem value="industrial">工业厂房</SelectItem>
                <SelectItem value="land">土地</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 地址 */}
          <div className="space-y-2">
            <Label htmlFor="address">地址</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="详细地址"
            />
          </div>

          {/* 面积和单价 */}
          {!isREIT && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="area">面积（平方米）</Label>
                <Input
                  id="area"
                  type="number"
                  step="0.01"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  placeholder="100.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitPrice_perSqm">单价（元/㎡）</Label>
                <Input
                  id="unitPrice_perSqm"
                  type="number"
                  step="1"
                  value={formData.unitPrice_perSqm}
                  onChange={(e) => setFormData({ ...formData, unitPrice_perSqm: e.target.value })}
                  placeholder="50000"
                />
              </div>
            </div>
          )}

          {/* 自动计算参考价格 */}
          {!isREIT && calculatedPrice && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">按面积×单价计算</div>
                  <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    ¥{calculatedPrice.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData({ ...formData, purchasePrice: calculatedPrice.toString() })}
                >
                  使用此价格
                </Button>
              </div>
            </div>
          )}

          {/* 价格信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchasePrice">购买价格 *</Label>
              <Input
                id="purchasePrice"
                type="number"
                step="0.01"
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                placeholder="5000000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentValue">当前估值 *</Label>
              <Input
                id="currentValue"
                type="number"
                step="0.01"
                value={formData.currentValue}
                onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
                placeholder="5500000"
              />
            </div>
          </div>

          {/* 租金收益 */}
          <div className="space-y-2">
            <Label htmlFor="rentalIncome">月租金（元）</Label>
            <Input
              id="rentalIncome"
              type="number"
              step="0.01"
              value={formData.rentalIncome}
              onChange={(e) => setFormData({ ...formData, rentalIncome: e.target.value })}
              placeholder="5000"
            />
          </div>

          {/* 租金收益率显示 */}
          {rentalYield > 0 && (
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950">
              <div className="text-sm text-muted-foreground">租金收益率（年化）</div>
              <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                {rentalYield.toFixed(2)}%
              </div>
              <div className="text-xs text-muted-foreground">
                年租金：¥{(parseFloat(formData.rentalIncome) * 12).toLocaleString('zh-CN')}
              </div>
            </div>
          )}

          {/* 空置率和年度支出（高级设置） */}
          {parseFloat(formData.rentalIncome) > 0 && (
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">收益调整（可选）</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vacancyRate">空置率 (%)</Label>
                  <Input
                    id="vacancyRate"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.vacancyRate}
                    onChange={(e) => setFormData({ ...formData, vacancyRate: e.target.value })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">预估的年均空置比例</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="annualExpenses">年度支出（元）</Label>
                  <Input
                    id="annualExpenses"
                    type="number"
                    step="100"
                    min="0"
                    value={formData.annualExpenses}
                    onChange={(e) => setFormData({ ...formData, annualExpenses: e.target.value })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">物业费、维修费等</p>
                </div>
              </div>
              
              {/* 净租金收益率计算 */}
              {(parseFloat(formData.vacancyRate) > 0 || parseFloat(formData.annualExpenses) > 0) && (
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">净租金收益率</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {(() => {
                        const annualRent = parseFloat(formData.rentalIncome) * 12;
                        const effectiveRent = annualRent * (1 - parseFloat(formData.vacancyRate || '0') / 100);
                        const netIncome = effectiveRent - parseFloat(formData.annualExpenses || '0');
                        const currentVal = parseFloat(formData.currentValue) || parseFloat(formData.purchasePrice);
                        return currentVal > 0 ? (netIncome / currentVal * 100).toFixed(2) : '0.00';
                      })()}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 预期年增值率 */}
          <div className="space-y-2">
            <Label htmlFor="annualAppreciation">预期年增值率 (%)</Label>
            <Input
              id="annualAppreciation"
              type="number"
              step="0.1"
              value={formData.annualAppreciation}
              onChange={(e) => setFormData({ ...formData, annualAppreciation: e.target.value })}
              placeholder="5.0"
            />
          </div>

          {/* REITs 特有字段 */}
          {isREIT && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fundCode">基金代码</Label>
                  <Input
                    id="fundCode"
                    value={formData.fundCode}
                    onChange={(e) => setFormData({ ...formData, fundCode: e.target.value })}
                    placeholder="180101"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dividendYield">股息率 (%)</Label>
                  <Input
                    id="dividendYield"
                    type="number"
                    step="0.01"
                    value={formData.dividendYield}
                    onChange={(e) => setFormData({ ...formData, dividendYield: e.target.value })}
                    placeholder="4.5"
                  />
                </div>
              </div>
            </>
          )}

          {/* 购买日期 */}
          <div className="space-y-2">
            <Label htmlFor="purchaseDate">购买日期</Label>
            <Input
              id="purchaseDate"
              type="date"
              value={formData.purchaseDate}
              onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
            />
          </div>

          {/* 备注 */}
          <div className="space-y-2">
            <Label htmlFor="description">备注</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="其他备注信息"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
