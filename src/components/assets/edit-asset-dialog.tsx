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
import { Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { ASSET_OVERVIEW_GROUPS, getDefaultUnderlyingType, getOverviewGroupByUnderlyingType } from '@/lib/underlying-type';

interface Asset {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  purchasePrice: number;
  currency: string;
  purchaseDate: string | null;
  maturityDate: string | null;
  metadata: any;
  underlyingType: string | null;
  assetCategory: {
    code: string | null;
    name: string;
  };
}

interface EditAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset;
  onSuccess?: () => void;
}

export function EditAssetDialog({ open, onOpenChange, asset, onSuccess }: EditAssetDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const metadata = asset.metadata || {};
  const assetType = asset.assetCategory?.code;

  // 统计分类：计算默认值和当前值
  const defaultUnderlyingType = getDefaultUnderlyingType(assetType || '');
  const defaultGroup = getOverviewGroupByUnderlyingType(defaultUnderlyingType);
  const currentGroup = asset.underlyingType
    ? getOverviewGroupByUnderlyingType(asset.underlyingType)
    : defaultGroup;
  const isOverridden = !!asset.underlyingType && asset.underlyingType !== defaultUnderlyingType;

  // 6大组 → 主要 UnderlyingType 的映射
  const GROUP_TO_PRIMARY_TYPE: Record<string, string> = {
    equity: 'EQUITY',
    fixed_income: 'FIXED_INCOME',
    cash: 'CASH',
    real_estate: 'REAL_ESTATE',
    alternative: 'OTHER',
    receivable: 'RECEIVABLE',
  };

  // 金价相关状态（贵金属资产用）
  const [goldPriceData, setGoldPriceData] = useState<{
    spotPrice: number;
    brandPrices: Record<string, number>;
    timestamp: string;
  } | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);

  const [formData, setFormData] = useState({
    name: asset.name,
    description: asset.description || '',
    amount: asset.purchasePrice.toString(),
    currency: asset.currency,
    underlyingTypeGroup: currentGroup.id,
    bankName: metadata.bankName || '',
    accountNumber: metadata.accountNumber || '',
    interestRate: metadata.interestRate?.toString() || '',
    purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
    maturityDate: asset.maturityDate ? asset.maturityDate.split('T')[0] : '',
    dailyYield: metadata.dailyYield?.toString() || '',
    yield7Day: metadata.yield7Day?.toString() || '',
    // 固定收益字段
    bondCode: metadata.bondCode || '',
    issuer: metadata.issuer || '',
    couponRate: metadata.couponRate?.toString() || '',
    expectedReturn: metadata.expectedReturn?.toString() || '',
    conversionPrice: metadata.conversionPrice?.toString() || '',
    stockCode: metadata.stockCode || '',
    productCode: metadata.productCode || '',
    institution: metadata.institution || '',
    riskLevel: metadata.riskLevel || '',
    // 贵金属字段
    metalType: metadata.metalType || '',
    goldCategory: metadata.goldCategory || '',
    jewelryBrand: metadata.jewelryBrand || '',
    purity: metadata.purity || '',
    weight: metadata.weight?.toString() || '',
    unitPrice: metadata.unitPrice?.toString() || '',
    certificate: metadata.certificate || '',
    // 实物资产字段
    physicalType: metadata.physicalType || '',
    brand: metadata.brand || '',
    model: metadata.model || '',
    purchaseYear: metadata.purchaseYear || '',
    estimatedValue: metadata.estimatedValue?.toString() || '',
    // 应收款字段
    debtorName: metadata.debtorName || '',
    debtorContact: metadata.debtorContact || '',
    repaymentStatus: metadata.repaymentStatus || 'pending',
    depositType: metadata.depositType || '',
    depositAddress: metadata.depositAddress || '',
    employer: metadata.employer || '',
    salaryMonth: metadata.salaryMonth || '',
    invoiceNumber: metadata.invoiceNumber || '',
    contractNumber: metadata.contractNumber || '',
  });

  useEffect(() => {
    if (open) {
      setFormData({
        name: asset.name,
        description: asset.description || '',
        amount: asset.purchasePrice.toString(),
        currency: asset.currency,
        underlyingTypeGroup: currentGroup.id,
        bankName: metadata.bankName || '',
        accountNumber: metadata.accountNumber || '',
        interestRate: metadata.interestRate?.toString() || '',
        purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
        maturityDate: asset.maturityDate ? asset.maturityDate.split('T')[0] : '',
        dailyYield: metadata.dailyYield?.toString() || '',
        yield7Day: metadata.yield7Day?.toString() || '',
        // 固定收益字段
        bondCode: metadata.bondCode || '',
        issuer: metadata.issuer || '',
        couponRate: metadata.couponRate?.toString() || '',
        expectedReturn: metadata.expectedReturn?.toString() || '',
        conversionPrice: metadata.conversionPrice?.toString() || '',
        stockCode: metadata.stockCode || '',
        productCode: metadata.productCode || '',
        institution: metadata.institution || '',
        riskLevel: metadata.riskLevel || '',
        // 贵金属字段
        metalType: metadata.metalType || '',
        goldCategory: metadata.goldCategory || '',
        jewelryBrand: metadata.jewelryBrand || '',
        purity: metadata.purity || '',
        weight: metadata.weight?.toString() || '',
        unitPrice: metadata.unitPrice?.toString() || '',
        certificate: metadata.certificate || '',
        // 实物资产字段
        physicalType: metadata.physicalType || '',
        brand: metadata.brand || '',
        model: metadata.model || '',
        purchaseYear: metadata.purchaseYear || '',
        estimatedValue: metadata.estimatedValue?.toString() || '',
        // 应收款字段
        debtorName: metadata.debtorName || '',
        debtorContact: metadata.debtorContact || '',
        repaymentStatus: metadata.repaymentStatus || 'pending',
        depositType: metadata.depositType || '',
        depositAddress: metadata.depositAddress || '',
        employer: metadata.employer || '',
        salaryMonth: metadata.salaryMonth || '',
        invoiceNumber: metadata.invoiceNumber || '',
        contractNumber: metadata.contractNumber || '',
      });
      
      // 如果是贵金属，获取实时金价
      if (assetType === 'ALT_GOLD' && metadata.metalType) {
        fetchGoldPrice(metadata.metalType);
      }
    }
  }, [open, asset]);

  // 获取实时金价
  const fetchGoldPrice = async (metalType: string) => {
    if (!metalType) return;
    
    setIsLoadingPrice(true);
    try {
      const response = await fetch(`/api/gold-price?metalType=${metalType}`);
      const data = await response.json();
      if (data.success) {
        setGoldPriceData({
          spotPrice: data.data.spotPrice,
          brandPrices: data.data.brandPrices,
          timestamp: data.data.timestamp,
        });
      }
    } catch (error) {
      console.error('获取金价失败:', error);
    } finally {
      setIsLoadingPrice(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.amount) {
      toast({
        variant: 'destructive',
        title: '请填写必填项',
      });
      return;
    }

    setIsLoading(true);

    try {
      const updatedMetadata: any = {};

      // 通用字段
      if (formData.bankName) updatedMetadata.bankName = formData.bankName;
      if (formData.accountNumber) updatedMetadata.accountNumber = formData.accountNumber;
      
      // 根据资产类型保存对应字段
      if (assetType === 'CASH_FIXED' && formData.interestRate) {
        updatedMetadata.interestRate = parseFloat(formData.interestRate);
      }
      
      if (assetType === 'CASH_MONEY_FUND') {
        if (formData.yield7Day) updatedMetadata.yield7Day = parseFloat(formData.yield7Day);
        if (formData.dailyYield) updatedMetadata.dailyYield = parseFloat(formData.dailyYield);
      }
      
      // 贵金属类型
      if (assetType === 'ALT_GOLD') {
        updatedMetadata.metalType = formData.metalType;
        updatedMetadata.goldCategory = formData.goldCategory;
        updatedMetadata.jewelryBrand = formData.jewelryBrand;
        updatedMetadata.purity = formData.purity;
        if (formData.weight) updatedMetadata.weight = parseFloat(formData.weight);
        if (formData.unitPrice) updatedMetadata.unitPrice = parseFloat(formData.unitPrice);
        if (formData.certificate) updatedMetadata.certificate = formData.certificate;
      }
      
      // 固定收益类型
      if (assetType === 'FIXED_BOND' || assetType === 'FIXED_CONVERTIBLE') {
        if (formData.bondCode) updatedMetadata.bondCode = formData.bondCode;
        if (formData.issuer) updatedMetadata.issuer = formData.issuer;
        if (formData.couponRate) {
          updatedMetadata.couponRate = parseFloat(formData.couponRate);
          updatedMetadata.annualYield = parseFloat(formData.couponRate); // API期望字段
        }
        if (assetType === 'FIXED_CONVERTIBLE') {
          if (formData.conversionPrice) updatedMetadata.conversionPrice = parseFloat(formData.conversionPrice);
          if (formData.stockCode) updatedMetadata.stockCode = formData.stockCode;
        }
      }
      
      if (assetType === 'FIXED_WEALTH') {
        if (formData.productCode) updatedMetadata.productCode = formData.productCode;
        if (formData.institution) updatedMetadata.institution = formData.institution;
        if (formData.expectedReturn) {
          updatedMetadata.expectedReturn = parseFloat(formData.expectedReturn);
          updatedMetadata.annualYield = parseFloat(formData.expectedReturn); // API期望字段
        }
        if (formData.riskLevel) updatedMetadata.riskLevel = formData.riskLevel;
      }

      // 实物资产类型
      if (assetType === 'ALT_PHYSICAL') {
        if (formData.physicalType) updatedMetadata.physicalType = formData.physicalType;
        if (formData.brand) updatedMetadata.brand = formData.brand;
        if (formData.model) updatedMetadata.model = formData.model;
        if (formData.purchaseYear) updatedMetadata.purchaseYear = formData.purchaseYear;
        if (formData.estimatedValue) updatedMetadata.estimatedValue = parseFloat(formData.estimatedValue);
      }

      // 应收款类型
      if (['REC_PERSONAL_LOAN', 'REC_DEPOSIT', 'REC_SALARY', 'REC_BUSINESS', 'REC_OTHER'].includes(assetType || '')) {
        if (formData.debtorName) updatedMetadata.debtorName = formData.debtorName;
        if (formData.debtorContact) updatedMetadata.debtorContact = formData.debtorContact;
        updatedMetadata.repaymentStatus = formData.repaymentStatus;
        if (formData.interestRate) updatedMetadata.interestRate = parseFloat(formData.interestRate);
        if (formData.depositType) updatedMetadata.depositType = formData.depositType;
        if (formData.depositAddress) updatedMetadata.depositAddress = formData.depositAddress;
        if (formData.employer) updatedMetadata.employer = formData.employer;
        if (formData.salaryMonth) updatedMetadata.salaryMonth = formData.salaryMonth;
        if (formData.invoiceNumber) updatedMetadata.invoiceNumber = formData.invoiceNumber;
        if (formData.contractNumber) updatedMetadata.contractNumber = formData.contractNumber;
      }

      // 贵金属资产使用重量×单价计算总金额
      const finalAmount = assetType === 'ALT_GOLD' && formData.weight && formData.unitPrice
        ? parseFloat(formData.weight) * parseFloat(formData.unitPrice)
        : parseFloat(formData.amount);

      // 计算 underlyingType 覆盖值
      // 如果选择的组和默认组一致，清除覆盖（设为 null）；否则设为该组的主要 UnderlyingType
      const selectedGroupId = formData.underlyingTypeGroup;
      const underlyingTypeOverride = selectedGroupId !== defaultGroup.id
        ? GROUP_TO_PRIMARY_TYPE[selectedGroupId] || null
        : null;

      const response = await fetch(`/api/assets/${asset.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          purchasePrice: finalAmount,
          originalValue: finalAmount,
          currentValue: finalAmount,
          currency: formData.currency,
          purchaseDate: formData.purchaseDate || null,
          maturityDate: formData.maturityDate || null,
          metadata: updatedMetadata,
          underlyingType: underlyingTypeOverride,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '更新失败');
      }

      toast({
        title: '更新成功',
        description: '资产信息已更新',
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('更新资产失败:', error);
      toast({
        variant: 'destructive',
        title: '更新失败',
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>编辑资产</DialogTitle>
          <DialogDescription>修改资产信息</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">资产名称 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">金额 *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
          </div>

          {/* ⭐ 新增：币种选择器 */}
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

          {/* ⭐ 统计分类覆盖 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="underlyingTypeGroup">统计分类</Label>
              {formData.underlyingTypeGroup !== defaultGroup.id && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, underlyingTypeGroup: defaultGroup.id })}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  恢复默认
                </button>
              )}
            </div>
            <Select
              value={formData.underlyingTypeGroup}
              onValueChange={(value) => setFormData({ ...formData, underlyingTypeGroup: value })}
            >
              <SelectTrigger id="underlyingTypeGroup">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_OVERVIEW_GROUPS.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                    {group.id === defaultGroup.id ? ' (默认)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {formData.underlyingTypeGroup !== defaultGroup.id
                ? `已自定义：该资产将按「${ASSET_OVERVIEW_GROUPS.find(g => g.id === formData.underlyingTypeGroup)?.name}」归类统计`
                : `按存放分类「${asset.assetCategory?.name}」自动归入「${defaultGroup.name}」`}
            </p>
          </div>

          {/* 贵金属专用字段 */}
          {assetType === 'ALT_GOLD' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="metalType">贵金属类型 *</Label>
                  <Select
                    value={formData.metalType}
                    onValueChange={(value) => {
                      setFormData({ ...formData, metalType: value });
                      fetchGoldPrice(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gold">黄金</SelectItem>
                      <SelectItem value="silver">白银</SelectItem>
                      <SelectItem value="platinum">铂金</SelectItem>
                      <SelectItem value="palladium">钯金</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goldCategory">投资类型 *</Label>
                  <Select
                    value={formData.goldCategory}
                    onValueChange={(value) => setFormData({ ...formData, goldCategory: value, jewelryBrand: value === 'investment' ? '' : formData.jewelryBrand })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="investment">投资金（金条/金块）</SelectItem>
                      <SelectItem value="jewelry">首饰金（项链/戒指等）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 首饰金需要选择品牌 */}
              {formData.goldCategory === 'jewelry' && (
                <div className="space-y-2">
                  <Label htmlFor="jewelryBrand">首饰品牌</Label>
                  <Select
                    value={formData.jewelryBrand}
                    onValueChange={(value) => setFormData({ ...formData, jewelryBrand: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择品牌" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chow_tai_fook">周大福</SelectItem>
                      <SelectItem value="lao_feng_xiang">老凤祥</SelectItem>
                      <SelectItem value="chow_sang_sang">周生生</SelectItem>
                      <SelectItem value="luk_fook">六福珠宝</SelectItem>
                      <SelectItem value="other">其他品牌</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 实时金价显示 */}
              {formData.metalType && goldPriceData && (
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      实时金价参考
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => fetchGoldPrice(formData.metalType)}
                      disabled={isLoadingPrice}
                    >
                      <RefreshCw className={`h-3 w-3 ${isLoadingPrice ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">国际现货价</div>
                      <div className="text-lg font-semibold text-amber-700 dark:text-amber-300">
                        ¥{goldPriceData.spotPrice.toFixed(2)}/克
                      </div>
                    </div>
                    {formData.goldCategory === 'jewelry' && formData.jewelryBrand && formData.jewelryBrand !== 'other' && (
                      <div>
                        <div className="text-muted-foreground">
                          {formData.jewelryBrand === 'chow_tai_fook' ? '周大福金价' :
                           formData.jewelryBrand === 'lao_feng_xiang' ? '老凤祥金价' :
                           formData.jewelryBrand === 'chow_sang_sang' ? '周生生金价' :
                           formData.jewelryBrand === 'luk_fook' ? '六福金价' : '品牌金价'}
                        </div>
                        <div className="text-lg font-semibold text-amber-700 dark:text-amber-300">
                          ¥{(goldPriceData.brandPrices[formData.jewelryBrand] || goldPriceData.spotPrice).toFixed(2)}/克
                        </div>
                      </div>
                    )}
                    {formData.goldCategory === 'investment' && (
                      <div>
                        <div className="text-muted-foreground">金条参考价</div>
                        <div className="text-lg font-semibold text-amber-700 dark:text-amber-300">
                          ¥{(goldPriceData.brandPrices['investment'] || goldPriceData.spotPrice * 1.25).toFixed(2)}/克
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    更新时间：{new Date(goldPriceData.timestamp).toLocaleString('zh-CN')}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purity">纯度</Label>
                  <Select
                    value={formData.purity}
                    onValueChange={(value) => setFormData({ ...formData, purity: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择纯度" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9999">9999（万足金）</SelectItem>
                      <SelectItem value="999">999（千足金）</SelectItem>
                      <SelectItem value="990">990（足金）</SelectItem>
                      <SelectItem value="925">925（银饰）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">重量（克）*</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.01"
                    placeholder="100.00"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitPrice">购买单价（元/克）*</Label>
                <div className="flex gap-2">
                  <Input
                    id="unitPrice"
                    type="number"
                    step="0.01"
                    placeholder="680.00"
                    value={formData.unitPrice}
                    onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                    className="flex-1"
                  />
                  {goldPriceData && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="whitespace-nowrap"
                      onClick={() => {
                        let price = goldPriceData.spotPrice;
                        if (formData.goldCategory === 'jewelry' && formData.jewelryBrand && formData.jewelryBrand !== 'other') {
                          price = goldPriceData.brandPrices[formData.jewelryBrand] || goldPriceData.spotPrice;
                        } else if (formData.goldCategory === 'investment') {
                          price = goldPriceData.brandPrices['investment'] || goldPriceData.spotPrice * 1.25;
                        }
                        setFormData({ ...formData, unitPrice: price.toFixed(2) });
                      }}
                    >
                      使用参考价
                    </Button>
                  )}
                </div>
              </div>

              {/* 自动计算的总金额显示 */}
              {formData.weight && formData.unitPrice && (
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
                  <div className="text-sm text-muted-foreground mb-1">购买总金额（自动计算）</div>
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    ¥{(parseFloat(formData.weight) * parseFloat(formData.unitPrice)).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="certificate">证书编号</Label>
                <Input
                  id="certificate"
                  placeholder="例如：GC-2024-001"
                  value={formData.certificate}
                  onChange={(e) => setFormData({ ...formData, certificate: e.target.value })}
                />
              </div>
            </>
          )}

          {/* 实物资产专用字段 */}
          {assetType === 'ALT_PHYSICAL' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="physicalType">实物类型</Label>
                  <Select
                    value={formData.physicalType}
                    onValueChange={(value) => setFormData({ ...formData, physicalType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="car">汽车</SelectItem>
                      <SelectItem value="watch">手表</SelectItem>
                      <SelectItem value="jewelry">珠宝</SelectItem>
                      <SelectItem value="electronics">电子设备</SelectItem>
                      <SelectItem value="furniture">家具</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchaseYear">购买年份</Label>
                  <Input
                    id="purchaseYear"
                    placeholder="例如：2023"
                    value={formData.purchaseYear}
                    onChange={(e) => setFormData({ ...formData, purchaseYear: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brand">品牌</Label>
                  <Input
                    id="brand"
                    placeholder="例如：特斯拉"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">型号</Label>
                  <Input
                    id="model"
                    placeholder="例如：Model Y"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimatedValue">当前估值 *</Label>
                <Input
                  id="estimatedValue"
                  type="number"
                  step="0.01"
                  placeholder="例如：250000"
                  value={formData.estimatedValue}
                  onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  请输入该资产的当前市场估值，用于计算资产净值
                </p>
              </div>

              {/* 估值对比显示 */}
              {formData.estimatedValue && formData.amount && (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">购买价格</div>
                      <div className="text-lg font-semibold">
                        ¥{parseFloat(formData.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">当前估值</div>
                      <div className="text-lg font-semibold">
                        ¥{parseFloat(formData.estimatedValue).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  {(() => {
                    const purchase = parseFloat(formData.amount);
                    const current = parseFloat(formData.estimatedValue);
                    const diff = current - purchase;
                    const percent = (diff / purchase) * 100;
                    const isPositive = diff >= 0;
                    return (
                      <div className={`mt-2 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        估值变动: {isPositive ? '+' : ''}¥{diff.toLocaleString('zh-CN', { minimumFractionDigits: 2 })} 
                        ({isPositive ? '+' : ''}{percent.toFixed(2)}%)
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {/* 应收款专用字段 */}
          {['REC_PERSONAL_LOAN', 'REC_DEPOSIT', 'REC_SALARY', 'REC_BUSINESS', 'REC_OTHER'].includes(assetType || '') && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="debtorName">欠款人</Label>
                  <Input
                    id="debtorName"
                    placeholder="欠款人姓名/公司"
                    value={formData.debtorName}
                    onChange={(e) => setFormData({ ...formData, debtorName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="debtorContact">联系方式</Label>
                  <Input
                    id="debtorContact"
                    placeholder="手机号/微信等"
                    value={formData.debtorContact}
                    onChange={(e) => setFormData({ ...formData, debtorContact: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="repaymentStatus">收回状态</Label>
                <Select
                  value={formData.repaymentStatus}
                  onValueChange={(value) => setFormData({ ...formData, repaymentStatus: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">待收回</SelectItem>
                    <SelectItem value="partial">部分收回</SelectItem>
                    <SelectItem value="paid">已收回</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {assetType === 'REC_PERSONAL_LOAN' && (
                <div className="space-y-2">
                  <Label htmlFor="interestRate">约定年利率 (%)</Label>
                  <Input
                    id="interestRate"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={formData.interestRate}
                    onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                  />
                </div>
              )}

              {assetType === 'REC_DEPOSIT' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="depositType">押金类型</Label>
                    <Select
                      value={formData.depositType}
                      onValueChange={(value) => setFormData({ ...formData, depositType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rent">租房押金</SelectItem>
                        <SelectItem value="utility">水电燃气押金</SelectItem>
                        <SelectItem value="car">车辆押金</SelectItem>
                        <SelectItem value="membership">会员押金</SelectItem>
                        <SelectItem value="other">其他押金</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depositAddress">关联地址</Label>
                    <Input
                      id="depositAddress"
                      placeholder="例如：xx小区"
                      value={formData.depositAddress}
                      onChange={(e) => setFormData({ ...formData, depositAddress: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {assetType === 'REC_SALARY' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employer">雇主/公司</Label>
                    <Input
                      id="employer"
                      placeholder="公司名称"
                      value={formData.employer}
                      onChange={(e) => setFormData({ ...formData, employer: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salaryMonth">对应月份</Label>
                    <Input
                      id="salaryMonth"
                      type="month"
                      value={formData.salaryMonth}
                      onChange={(e) => setFormData({ ...formData, salaryMonth: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {assetType === 'REC_BUSINESS' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoiceNumber">发票号</Label>
                    <Input
                      id="invoiceNumber"
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contractNumber">合同编号</Label>
                    <Input
                      id="contractNumber"
                      value={formData.contractNumber}
                      onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* 非贵金属资产显示银行名称 */}
          {assetType !== 'ALT_GOLD' && assetType !== 'ALT_PHYSICAL' && !['REC_PERSONAL_LOAN', 'REC_DEPOSIT', 'REC_SALARY', 'REC_BUSINESS', 'REC_OTHER'].includes(assetType || '') && formData.bankName !== undefined && (
            <div className="space-y-2">
              <Label htmlFor="bankName">银行名称</Label>
              <Input
                id="bankName"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              />
            </div>
          )}

          {/* 定期存款显示年利率 */}
          {assetType === 'CASH_FIXED' && (
            <div className="space-y-2">
              <Label htmlFor="interestRate">年利率 (%)</Label>
              <Input
                id="interestRate"
                type="number"
                step="0.01"
                value={formData.interestRate}
                onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
              />
            </div>
          )}

          {/* 货币基金显示7日年化收益率 */}
          {assetType === 'CASH_MONEY_FUND' && (
            <div className="space-y-2">
              <Label htmlFor="yield7Day">7日年化收益率 (%)</Label>
              <Input
                id="yield7Day"
                type="number"
                step="0.01"
                value={formData.yield7Day}
                onChange={(e) => setFormData({ ...formData, yield7Day: e.target.value })}
              />
            </div>
          )}

          {/* 债券/可转债字段 */}
          {(assetType === 'FIXED_BOND' || assetType === 'FIXED_CONVERTIBLE') && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bondCode">债券代码</Label>
                  <Input
                    id="bondCode"
                    value={formData.bondCode}
                    onChange={(e) => setFormData({ ...formData, bondCode: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issuer">发行人</Label>
                  <Input
                    id="issuer"
                    value={formData.issuer}
                    onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="couponRate">票面利率 (%) *</Label>
                <Input
                  id="couponRate"
                  type="number"
                  step="0.01"
                  value={formData.couponRate}
                  onChange={(e) => setFormData({ ...formData, couponRate: e.target.value })}
                />
              </div>

              {assetType === 'FIXED_CONVERTIBLE' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="conversionPrice">转股价格</Label>
                    <Input
                      id="conversionPrice"
                      type="number"
                      step="0.01"
                      value={formData.conversionPrice}
                      onChange={(e) => setFormData({ ...formData, conversionPrice: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stockCode">正股代码</Label>
                    <Input
                      id="stockCode"
                      value={formData.stockCode}
                      onChange={(e) => setFormData({ ...formData, stockCode: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* 理财产品字段 */}
          {assetType === 'FIXED_WEALTH' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="productCode">产品代码</Label>
                  <Input
                    id="productCode"
                    value={formData.productCode}
                    onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="institution">发行机构</Label>
                  <Input
                    id="institution"
                    value={formData.institution}
                    onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expectedReturn">预期收益率 (%) *</Label>
                  <Input
                    id="expectedReturn"
                    type="number"
                    step="0.01"
                    value={formData.expectedReturn}
                    onChange={(e) => setFormData({ ...formData, expectedReturn: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="riskLevel">风险等级</Label>
                  <Select value={formData.riskLevel} onValueChange={(value) => setFormData({ ...formData, riskLevel: value })}>
                    <SelectTrigger id="riskLevel">
                      <SelectValue placeholder="选择风险等级" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="R1">R1 - 低风险</SelectItem>
                      <SelectItem value="R2">R2 - 中低风险</SelectItem>
                      <SelectItem value="R3">R3 - 中等风险</SelectItem>
                      <SelectItem value="R4">R4 - 中高风险</SelectItem>
                      <SelectItem value="R5">R5 - 高风险</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {formData.purchaseDate !== undefined && (
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
              {formData.maturityDate !== undefined && (
                <div className="space-y-2">
                  <Label htmlFor="maturityDate">到期日期</Label>
                  <Input
                    id="maturityDate"
                    type="date"
                    value={formData.maturityDate}
                    onChange={(e) => setFormData({ ...formData, maturityDate: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">备注</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
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
