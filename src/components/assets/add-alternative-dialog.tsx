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
import { Coins, Bitcoin, Diamond, Package, Loader2, Car } from 'lucide-react';

interface AddAlternativeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type AssetType = 'ALT_GOLD' | 'ALT_CRYPTO' | 'ALT_COMMODITY' | 'ALT_COLLECTIBLE' | 'ALT_PHYSICAL';

interface AssetCategory {
  id: string;
  code: string;
  name: string;
}

export function AddAlternativeDialog({ open, onOpenChange, onSuccess }: AddAlternativeDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [assetType, setAssetType] = useState<AssetType | ''>('');
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  // 金价相关状态
  const [goldPriceData, setGoldPriceData] = useState<{
    spotPrice: number;
    brandPrices: Record<string, number>;
    timestamp: string;
  } | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    currency: 'CNY',
    quantity: '',
    unitPrice: '',
    // 贵金属特有字段
    metalType: '', // 黄金/白银/铂金等
    purity: '', // 纯度（例如：999/9999）
    weight: '', // 重量（克）
    certificate: '', // 证书编号
    goldCategory: '', // 投资类型：investment（投资金）或 jewelry（首饰金）
    jewelryBrand: '', // 首饰品牌
    // 数字资产特有字段
    cryptoSymbol: '', // 代币符号（例如：BTC/ETH）
    walletAddress: '', // 钱包地址
    blockchain: '', // 区块链（例如：Ethereum/Bitcoin）
    // 大宗商品特有字段
    commodityType: '', // 商品类型（原油/天然气/农产品等）
    unit: '', // 单位（桶/吨/公斤）
    contract: '', // 合约代码
    // 收藏品特有字段
    collectibleType: '', // 收藏品类型（艺术品/古董/邮票/钱币等）
    artist: '', // 艺术家/制造商
    year: '', // 年份
    condition: '', // 品相
    appraisalValue: '', // 评估价值
    // 实物资产特有字段
    physicalType: '', // 实物类型（汽车/珠宝/手表等）
    brand: '', // 品牌
    model: '', // 型号
    purchaseYear: '', // 购买年份
    estimatedValue: '', // 估值
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
        // 筛选另类投资类二级分类
        const alternativeCategories = data.data.filter(
          (cat: any) => cat.parent?.code === 'ALTERNATIVE' && cat.level === 2
        );
        setCategories(alternativeCategories);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      toast({
        variant: 'destructive',
        title: '加载失败',
        description: '无法加载另类投资分类，请刷新页面重试',
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
      metalType: '',
      purity: '',
      weight: '',
      certificate: '',
      goldCategory: '',
      jewelryBrand: '',
      cryptoSymbol: '',
      walletAddress: '',
      blockchain: '',
      commodityType: '',
      unit: '',
      contract: '',
      collectibleType: '',
      artist: '',
      year: '',
      condition: '',
      appraisalValue: '',
      physicalType: '',
      brand: '',
      model: '',
      purchaseYear: '',
      estimatedValue: '',
      purchaseDate: '',
    });
    // 重置金价数据
    setGoldPriceData(null);
  };

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

  // 当贵金属类型变化时，获取对应的金价
  useEffect(() => {
    if (assetType === 'ALT_GOLD' && formData.metalType) {
      fetchGoldPrice(formData.metalType);
    }
  }, [assetType, formData.metalType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!assetType) {
      toast({
        variant: 'destructive',
        title: '请选择资产类型',
      });
      return;
    }

    // 贵金属特殊验证
    if (assetType === 'ALT_GOLD') {
      if (!formData.name || !formData.weight || !formData.unitPrice || !formData.metalType || !formData.goldCategory) {
        toast({
          variant: 'destructive',
          title: '请填写必填项',
          description: '资产名称、贵金属类型、投资类型、重量和单价为必填项',
        });
        return;
      }
      // 首饰金需要选择品牌
      if (formData.goldCategory === 'jewelry' && !formData.jewelryBrand) {
        toast({
          variant: 'destructive',
          title: '请填写必填项',
          description: '首饰金需要选择品牌',
        });
        return;
      }
    } else {
      // 其他类型验证
      if (!formData.name || !formData.amount) {
        toast({
          variant: 'destructive',
          title: '请填写必填项',
          description: '资产名称和金额为必填项',
        });
        return;
      }
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

      if (assetType === 'ALT_GOLD') {
        metadata.metalType = formData.metalType;
        metadata.purity = formData.purity;
        metadata.weight = parseFloat(formData.weight || '0');
        metadata.unitPrice = parseFloat(formData.unitPrice || '0'); // 购买单价
        metadata.certificate = formData.certificate;
        metadata.goldCategory = formData.goldCategory; // investment | jewelry
        metadata.jewelryBrand = formData.jewelryBrand; // 首饰品牌
        // 保存当时的参考金价
        if (goldPriceData) {
          metadata.spotPriceAtPurchase = goldPriceData.spotPrice;
          if (formData.goldCategory === 'jewelry' && formData.jewelryBrand) {
            metadata.brandPriceAtPurchase = goldPriceData.brandPrices[formData.jewelryBrand];
          }
        }
      } else if (assetType === 'ALT_CRYPTO') {
        metadata.cryptoSymbol = formData.cryptoSymbol;
        metadata.walletAddress = formData.walletAddress;
        metadata.blockchain = formData.blockchain;
      } else if (assetType === 'ALT_COMMODITY') {
        metadata.commodityType = formData.commodityType;
        metadata.unit = formData.unit;
        metadata.contract = formData.contract;
      } else if (assetType === 'ALT_COLLECTIBLE') {
        metadata.collectibleType = formData.collectibleType;
        metadata.artist = formData.artist;
        metadata.year = formData.year;
        metadata.condition = formData.condition;
        metadata.appraisalValue = parseFloat(formData.appraisalValue || '0');
      } else if (assetType === 'ALT_PHYSICAL') {
        metadata.physicalType = formData.physicalType;
        metadata.brand = formData.brand;
        metadata.model = formData.model;
        metadata.purchaseYear = formData.purchaseYear;
        metadata.estimatedValue = parseFloat(formData.estimatedValue || '0');
      }

      // 根据资产类型计算数量、单价和总金额
      let quantity = 1;
      let unitPrice = 0;
      let purchaseAmount = 0;
      
      if (assetType === 'ALT_GOLD') {
        // 贵金属：数量=重量(克)，单价=用户输入的每克单价，总金额=重量×单价
        const weight = parseFloat(formData.weight || '0');
        const pricePerGram = parseFloat(formData.unitPrice || '0');
        quantity = weight;  // 数量 = 重量（克）
        unitPrice = pricePerGram;  // 单价 = 每克单价
        purchaseAmount = weight * pricePerGram;  // 总金额 = 重量 × 单价
      } else if (assetType === 'ALT_CRYPTO') {
        // 数字资产：数量由用户输入
        quantity = parseFloat(formData.quantity || '1');
        purchaseAmount = parseFloat(formData.amount || '0');
        if (quantity > 0) {
          unitPrice = purchaseAmount / quantity;
        }
      } else {
        // 其他类型
        quantity = parseFloat(formData.quantity || '1');
        purchaseAmount = parseFloat(formData.amount || '0');
        if (quantity > 0) {
          unitPrice = purchaseAmount / quantity;
        }
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
          quantity,
          unitPrice,
          purchasePrice: purchaseAmount,
          originalValue: purchaseAmount,
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
        description: '另类投资已添加',
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
      <div className="grid grid-cols-5 gap-3">
        <Button
          type="button"
          variant={assetType === 'ALT_GOLD' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleAssetTypeChange('ALT_GOLD')}
        >
          <Coins className="h-6 w-6" />
          <span>贵金属</span>
        </Button>
        <Button
          type="button"
          variant={assetType === 'ALT_CRYPTO' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleAssetTypeChange('ALT_CRYPTO')}
        >
          <Bitcoin className="h-6 w-6" />
          <span>数字资产</span>
        </Button>
        <Button
          type="button"
          variant={assetType === 'ALT_COMMODITY' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleAssetTypeChange('ALT_COMMODITY')}
        >
          <Package className="h-6 w-6" />
          <span>大宗商品</span>
        </Button>
        <Button
          type="button"
          variant={assetType === 'ALT_COLLECTIBLE' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleAssetTypeChange('ALT_COLLECTIBLE')}
        >
          <Diamond className="h-6 w-6" />
          <span>收藏品</span>
        </Button>
        <Button
          type="button"
          variant={assetType === 'ALT_PHYSICAL' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleAssetTypeChange('ALT_PHYSICAL')}
        >
          <Car className="h-6 w-6" />
          <span>实物资产</span>
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
              assetType === 'ALT_GOLD' ? '例如：999纯金金条' :
              assetType === 'ALT_CRYPTO' ? '例如：比特币BTC' :
              assetType === 'ALT_COMMODITY' ? '例如：WTI原油期货' :
              assetType === 'ALT_PHYSICAL' ? '例如：特斯拉Model 3' :
              '例如：清代瓷器'
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

        {/* 贵金属特有字段 */}
        {assetType === 'ALT_GOLD' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="metalType">贵金属类型 *</Label>
                <Select
                  value={formData.metalType}
                  onValueChange={(value) => setFormData({ ...formData, metalType: value })}
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
                  onValueChange={(value) => setFormData({ ...formData, goldCategory: value, jewelryBrand: '' })}
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
                <Label htmlFor="jewelryBrand">首饰品牌 *</Label>
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
                  {isLoadingPrice && (
                    <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                  )}
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
                {/* 快捷填入按钮 */}
                {goldPriceData && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                    onClick={() => {
                      const price = formData.goldCategory === 'jewelry' && formData.jewelryBrand && formData.jewelryBrand !== 'other'
                        ? goldPriceData.brandPrices[formData.jewelryBrand] || goldPriceData.spotPrice
                        : goldPriceData.spotPrice;
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

        {/* 数字资产特有字段 */}
        {assetType === 'ALT_CRYPTO' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cryptoSymbol">代币符号</Label>
                <Input
                  id="cryptoSymbol"
                  placeholder="例如：BTC"
                  value={formData.cryptoSymbol}
                  onChange={(e) => setFormData({ ...formData, cryptoSymbol: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blockchain">区块链</Label>
                <Select
                  value={formData.blockchain}
                  onValueChange={(value) => setFormData({ ...formData, blockchain: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择区块链" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bitcoin">Bitcoin</SelectItem>
                    <SelectItem value="ethereum">Ethereum</SelectItem>
                    <SelectItem value="binance">Binance Smart Chain</SelectItem>
                    <SelectItem value="polygon">Polygon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="walletAddress">钱包地址</Label>
              <Input
                id="walletAddress"
                placeholder="例如：0x..."
                value={formData.walletAddress}
                onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">持有数量</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.00000001"
                  placeholder="0.5"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitPrice">单价</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  placeholder="50000.00"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                />
              </div>
            </div>
          </>
        )}

        {/* 大宗商品特有字段 */}
        {assetType === 'ALT_COMMODITY' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="commodityType">商品类型</Label>
              <Select
                value={formData.commodityType}
                onValueChange={(value) => setFormData({ ...formData, commodityType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择商品类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crude_oil">原油</SelectItem>
                  <SelectItem value="natural_gas">天然气</SelectItem>
                  <SelectItem value="wheat">小麦</SelectItem>
                  <SelectItem value="corn">玉米</SelectItem>
                  <SelectItem value="soybeans">大豆</SelectItem>
                  <SelectItem value="cotton">棉花</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contract">合约代码</Label>
                <Input
                  id="contract"
                  placeholder="例如：CL202412"
                  value={formData.contract}
                  onChange={(e) => setFormData({ ...formData, contract: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">单位</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择单位" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="barrel">桶</SelectItem>
                    <SelectItem value="ton">吨</SelectItem>
                    <SelectItem value="kg">公斤</SelectItem>
                    <SelectItem value="bushel">蒲式耳</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">数量</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="1"
                  placeholder="1000"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitPrice">单价</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  placeholder="80.00"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                />
              </div>
            </div>
          </>
        )}

        {/* 收藏品特有字段 */}
        {assetType === 'ALT_COLLECTIBLE' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="collectibleType">收藏品类型</Label>
              <Select
                value={formData.collectibleType}
                onValueChange={(value) => setFormData({ ...formData, collectibleType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="art">艺术品</SelectItem>
                  <SelectItem value="antique">古董</SelectItem>
                  <SelectItem value="stamp">邮票</SelectItem>
                  <SelectItem value="coin">钱币</SelectItem>
                  <SelectItem value="watch">名表</SelectItem>
                  <SelectItem value="jewelry">珠宝</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="artist">艺术家/制造商</Label>
                <Input
                  id="artist"
                  placeholder="例如：徐悲鸿"
                  value={formData.artist}
                  onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">年份</Label>
                <Input
                  id="year"
                  placeholder="例如：1920"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="condition">品相</Label>
                <Select
                  value={formData.condition}
                  onValueChange={(value) => setFormData({ ...formData, condition: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择品相" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mint">全新（Mint）</SelectItem>
                    <SelectItem value="excellent">优秀（Excellent）</SelectItem>
                    <SelectItem value="good">良好（Good）</SelectItem>
                    <SelectItem value="fair">一般（Fair）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="appraisalValue">评估价值</Label>
                <Input
                  id="appraisalValue"
                  type="number"
                  step="0.01"
                  placeholder="1000000.00"
                  value={formData.appraisalValue}
                  onChange={(e) => setFormData({ ...formData, appraisalValue: e.target.value })}
                />
              </div>
            </div>
          </>
        )}

        {/* 实物资产特有字段 */}
        {assetType === 'ALT_PHYSICAL' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="physicalType">实物类型 *</Label>
              <Select
                value={formData.physicalType}
                onValueChange={(value) => setFormData({ ...formData, physicalType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="car">汽车</SelectItem>
                  <SelectItem value="motorcycle">摩托车</SelectItem>
                  <SelectItem value="watch">手表</SelectItem>
                  <SelectItem value="jewelry">珠宝首饰</SelectItem>
                  <SelectItem value="electronics">电子设备</SelectItem>
                  <SelectItem value="furniture">家具</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">品牌</Label>
                <Input
                  id="brand"
                  placeholder="例如：特斯拉、劳力士"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">型号</Label>
                <Input
                  id="model"
                  placeholder="例如：Model 3、Submariner"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchaseYear">购买年份</Label>
                <Input
                  id="purchaseYear"
                  type="number"
                  placeholder="例如：2023"
                  value={formData.purchaseYear}
                  onChange={(e) => setFormData({ ...formData, purchaseYear: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedValue">当前估值</Label>
                <Input
                  id="estimatedValue"
                  type="number"
                  step="0.01"
                  placeholder="例如：250000"
                  value={formData.estimatedValue}
                  onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
                />
              </div>
            </div>
          </>
        )}

        {/* 通用字段 - 贵金属不需要手动输入总金额 */}
        {assetType !== 'ALT_GOLD' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">总金额 *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="100000.00"
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
        )}

        {/* 贵金属的币种选择 */}
        {assetType === 'ALT_GOLD' && (
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
        )}

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
          <DialogTitle>添加另类投资</DialogTitle>
          <DialogDescription className="sr-only">
            添加贵金属、数字资产、大宗商品或收藏品
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
