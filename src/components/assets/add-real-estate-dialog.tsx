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
import { Home, Building2, TrendingUp, Loader2 } from 'lucide-react';

interface AddRealEstateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type AssetType = 'RE_RESIDENTIAL' | 'RE_COMMERCIAL' | 'RE_REITS';

interface AssetCategory {
  id: string;
  code: string;
  name: string;
}

export function AddRealEstateDialog({ open, onOpenChange, onSuccess }: AddRealEstateDialogProps) {
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
    // 住宅/商业地产特有字段
    address: '',
    area: '',
    unitPrice_perSqm: '', // 单价（每平米）
    purchaseDate: '',
    propertyType: '', // 住宅：公寓/别墅/townhouse；商业：办公楼/商铺/仓库
    rentalIncome: '', // 月租金
    annualAppreciation: '', // 预期年增值率
    // REITs特有字段
    fundCode: '',
    fundName: '',
    shares: '',
    pricePerShare: '',
    dividendYield: '', // 股息率
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
        // 筛选不动产类二级分类
        const realEstateCategories = data.data.filter(
          (cat: any) => cat.parent?.code === 'REAL_ESTATE' && cat.level === 2
        );
        setCategories(realEstateCategories);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      toast({
        variant: 'destructive',
        title: '加载失败',
        description: '无法加载不动产分类，请刷新页面重试',
      });
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
      address: '',
      area: '',
      unitPrice_perSqm: '',
      purchaseDate: '',
      propertyType: '',
      rentalIncome: '',
      annualAppreciation: '',
      fundCode: '',
      fundName: '',
      shares: '',
      pricePerShare: '',
      dividendYield: '',
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

      if (assetType === 'RE_RESIDENTIAL' || assetType === 'RE_COMMERCIAL') {
        metadata.address = formData.address;
        metadata.area = parseFloat(formData.area || '0');
        metadata.unitPrice_perSqm = parseFloat(formData.unitPrice_perSqm || '0');
        metadata.propertyType = formData.propertyType;
        metadata.rentalIncome = parseFloat(formData.rentalIncome || '0');
        metadata.annualAppreciation = parseFloat(formData.annualAppreciation || '0');
      } else if (assetType === 'RE_REITS') {
        metadata.fundCode = formData.fundCode;
        metadata.fundName = formData.fundName;
        metadata.dividendYield = parseFloat(formData.dividendYield || '0');
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
          quantity: parseFloat(formData.quantity || formData.shares || '1'),
          unitPrice: parseFloat(formData.unitPrice || formData.pricePerShare || formData.amount),
          purchasePrice: parseFloat(formData.amount),
          originalValue: parseFloat(formData.amount),
          currency: formData.currency,
          purchaseDate: formData.purchaseDate || null,
          maturityDate: null,
          metadata,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '创建失败');
      }

      toast({
        title: '创建成功',
        description: '不动产已添加',
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
          variant={assetType === 'RE_RESIDENTIAL' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleAssetTypeChange('RE_RESIDENTIAL')}
        >
          <Home className="h-6 w-6" />
          <span>住宅房产</span>
        </Button>
        <Button
          type="button"
          variant={assetType === 'RE_COMMERCIAL' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleAssetTypeChange('RE_COMMERCIAL')}
        >
          <Building2 className="h-6 w-6" />
          <span>商业地产</span>
        </Button>
        <Button
          type="button"
          variant={assetType === 'RE_REITS' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleAssetTypeChange('RE_REITS')}
        >
          <TrendingUp className="h-6 w-6" />
          <span>房地产信托</span>
        </Button>
      </div>
    </div>
  );

  const renderFormFields = () => {
    if (!assetType) return null;

    return (
      <div className="space-y-4">
        {/* 基础信息 */}
        <div className="space-y-2">
          <Label htmlFor="name">资产名称 *</Label>
          <Input
            id="name"
            placeholder={
              assetType === 'RE_REITS' 
                ? '例如：领展房产基金' 
                : '例如：海淀区公寓'
            }
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">描述</Label>
          <Textarea
            id="description"
            placeholder="补充说明信息"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>

        {/* 住宅/商业地产特有字段 */}
        {(assetType === 'RE_RESIDENTIAL' || assetType === 'RE_COMMERCIAL') && (
          <>
            <div className="space-y-2">
              <Label htmlFor="address">地址</Label>
              <Input
                id="address"
                placeholder="例如：北京市海淀区中关村大街1号"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="area">面积（平米）</Label>
                <Input
                  id="area"
                  type="number"
                  step="0.01"
                  placeholder="100.00"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitPrice_perSqm">单价（元/平米）</Label>
                <Input
                  id="unitPrice_perSqm"
                  type="number"
                  step="0.01"
                  placeholder="50000.00"
                  value={formData.unitPrice_perSqm}
                  onChange={(e) => setFormData({ ...formData, unitPrice_perSqm: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="propertyType">物业类型</Label>
              <Select
                value={formData.propertyType}
                onValueChange={(value) => setFormData({ ...formData, propertyType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择物业类型" />
                </SelectTrigger>
                <SelectContent>
                  {assetType === 'RE_RESIDENTIAL' ? (
                    <>
                      <SelectItem value="apartment">公寓</SelectItem>
                      <SelectItem value="villa">别墅</SelectItem>
                      <SelectItem value="townhouse">联排别墅</SelectItem>
                      <SelectItem value="flat">平层</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="office">办公楼</SelectItem>
                      <SelectItem value="retail">商铺</SelectItem>
                      <SelectItem value="warehouse">仓库</SelectItem>
                      <SelectItem value="hotel">酒店</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rentalIncome">月租金（元）</Label>
                <Input
                  id="rentalIncome"
                  type="number"
                  step="0.01"
                  placeholder="8000.00"
                  value={formData.rentalIncome}
                  onChange={(e) => setFormData({ ...formData, rentalIncome: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="annualAppreciation">预期年增值率（%）</Label>
                <Input
                  id="annualAppreciation"
                  type="number"
                  step="0.01"
                  placeholder="5.00"
                  value={formData.annualAppreciation}
                  onChange={(e) => setFormData({ ...formData, annualAppreciation: e.target.value })}
                />
              </div>
            </div>
          </>
        )}

        {/* REITs特有字段 */}
        {assetType === 'RE_REITS' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fundCode">基金代码</Label>
                <Input
                  id="fundCode"
                  placeholder="例如：0823.HK"
                  value={formData.fundCode}
                  onChange={(e) => setFormData({ ...formData, fundCode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fundName">基金名称</Label>
                <Input
                  id="fundName"
                  placeholder="例如：领展房产基金"
                  value={formData.fundName}
                  onChange={(e) => setFormData({ ...formData, fundName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shares">持有份额</Label>
                <Input
                  id="shares"
                  type="number"
                  step="1"
                  placeholder="1000"
                  value={formData.shares}
                  onChange={(e) => setFormData({ ...formData, shares: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pricePerShare">单价（元/份）</Label>
                <Input
                  id="pricePerShare"
                  type="number"
                  step="0.01"
                  placeholder="50.00"
                  value={formData.pricePerShare}
                  onChange={(e) => setFormData({ ...formData, pricePerShare: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dividendYield">股息率（%）</Label>
              <Input
                id="dividendYield"
                type="number"
                step="0.01"
                placeholder="4.50"
                value={formData.dividendYield}
                onChange={(e) => setFormData({ ...formData, dividendYield: e.target.value })}
              />
            </div>
          </>
        )}

        {/* 通用字段 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount">总金额 *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="5000000.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">币种</Label>
            <Select
              value={formData.currency}
              onValueChange={(value) => setFormData({ ...formData, currency: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CNY">CNY 人民币</SelectItem>
                <SelectItem value="USD">USD 美元</SelectItem>
                <SelectItem value="HKD">HKD 港币</SelectItem>
                <SelectItem value="EUR">EUR 欧元</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加不动产</DialogTitle>
          <DialogDescription className="sr-only">
            添加住宅、商业地产或房地产信托
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {renderAssetTypeSelector()}
          {renderFormFields()}

          <div className="flex justify-end gap-3 pt-4">
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
              {isLoading ? '创建中...' : '创建'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
