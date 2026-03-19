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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  DollarSign, 
  Wallet, 
  Building2,
  BarChart3,
  Info,
  RefreshCw,
  Loader2,
  History
} from 'lucide-react';
import { formatters } from '@/lib/api-client';
import { getPnLColorClass } from '@/lib/user-preferences';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { AssetActivityTimeline } from '@/components/shared/asset-activity-timeline';
import { getDefaultUnderlyingType, getOverviewGroupByUnderlyingType } from '@/lib/underlying-type';

interface Asset {
  id: string;
  name: string;
  description: string | null;
  assetCategory: {
    name: string;
    code: string | null;
  };
  quantity: number;
  purchasePrice: number;
  currentValue: number;
  currency: string;
  unrealizedPnl: number | null;
  unrealizedPnlPercent: number | null;
  purchaseDate: string | null;
  maturityDate: string | null;
  metadata: any;
  lastUpdated: string;
  underlyingType?: string | null;
}

interface AssetDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function AssetDetailDialog({
  open,
  onOpenChange,
  asset,
  onEdit,
  onDelete,
}: AssetDetailDialogProps) {
  const metadata = asset.metadata || {};
  const preferences = useUserPreferences();

  // 统计分类计算
  const categoryCode = asset.assetCategory?.code || '';
  const defaultUnderlyingType = getDefaultUnderlyingType(categoryCode);
  const effectiveGroup = asset.underlyingType
    ? getOverviewGroupByUnderlyingType(asset.underlyingType)
    : getOverviewGroupByUnderlyingType(defaultUnderlyingType);
  const defaultGroup = getOverviewGroupByUnderlyingType(defaultUnderlyingType);
  const isOverridden = !!asset.underlyingType && asset.underlyingType !== defaultUnderlyingType;
  
  // 实时金价状态
  const [goldPriceData, setGoldPriceData] = useState<{
    spotPrice: number;
    brandPrices: Record<string, number>;
    timestamp: string;
  } | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);

  // 获取实时金价
  const fetchGoldPrice = async () => {
    if (!metadata.metalType) return;
    
    setIsLoadingPrice(true);
    try {
      const response = await fetch(`/api/gold-price?metalType=${metadata.metalType}`);
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

  // 打开对话框时获取金价（如果是贵金属）
  useEffect(() => {
    if (open && metadata.weight && metadata.metalType) {
      fetchGoldPrice();
    }
  }, [open, metadata.metalType]);

  // 计算当前估值
  const getCurrentPrice = () => {
    if (!goldPriceData || !metadata.weight) return null;
    
    // 根据投资类型选择对应的金价
    if (metadata.goldCategory === 'jewelry' && metadata.jewelryBrand && metadata.jewelryBrand !== 'other') {
      return goldPriceData.brandPrices[metadata.jewelryBrand] || goldPriceData.spotPrice;
    }
    return goldPriceData.spotPrice;
  };

  const currentPrice = getCurrentPrice();
  const currentEstimatedValue = currentPrice && metadata.weight ? currentPrice * metadata.weight : null;
  const estimatedPnl = currentEstimatedValue ? currentEstimatedValue - asset.purchasePrice : null;
  const estimatedPnlPercent = estimatedPnl && asset.purchasePrice ? (estimatedPnl / asset.purchasePrice) * 100 : null;

  const formatCurrency = (amount: number) => {
    const symbol = asset.currency === 'USD' ? '$' : asset.currency === 'HKD' ? 'HK$' : '¥';
    return `${symbol}${Math.abs(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  // 检查是否有收益数据
  const hasProfit = asset.unrealizedPnl !== null && asset.unrealizedPnl !== 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            {asset.name}
            <Badge variant="outline">{asset.assetCategory.name}</Badge>
            {isOverridden && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                统计归入: {effectiveGroup.name}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            查看 {asset.name} 的详细信息和收益表现 · {asset.currency}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              基本信息
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              更新记录
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: 基本信息 */}
          <TabsContent value="info" className="space-y-6 mt-4">
          {/* 核心指标 - 根据资产类型显示不同内容 */}
          {metadata.weight ? (
            // 贵金属特殊显示
            <div className="space-y-4">
              {/* 投资类型标签 */}
              <div className="flex items-center gap-2">
                <Badge variant={metadata.goldCategory === 'investment' ? 'default' : 'secondary'}>
                  {metadata.goldCategory === 'investment' ? '投资金' : '首饰金'}
                </Badge>
                {metadata.jewelryBrand && metadata.jewelryBrand !== 'other' && (
                  <Badge variant="outline">
                    {metadata.jewelryBrand === 'chow_tai_fook' ? '周大福' :
                     metadata.jewelryBrand === 'lao_feng_xiang' ? '老凤祥' :
                     metadata.jewelryBrand === 'chow_sang_sang' ? '周生生' :
                     metadata.jewelryBrand === 'luk_fook' ? '六福珠宝' : metadata.jewelryBrand}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* 当前估值 */}
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span>当前估值</span>
                    {isLoadingPrice && <Loader2 className="h-3 w-3 animate-spin" />}
                  </div>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {currentEstimatedValue 
                      ? formatCurrency(currentEstimatedValue)
                      : formatCurrency(asset.currentValue)}
                  </p>
                  {currentEstimatedValue && (
                    <p className="text-xs text-muted-foreground mt-1">
                      基于实时金价估算
                    </p>
                  )}
                </div>

                {/* 购买总金额 */}
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Wallet className="h-4 w-4" />
                    <span>购买成本</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(asset.purchasePrice)}
                  </p>
                </div>

                {/* 估算盈亏 */}
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    {estimatedPnl && estimatedPnl >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <span>估算盈亏</span>
                  </div>
                  {estimatedPnl !== null && estimatedPnlPercent !== null ? (
                    <>
                      <p className={`text-2xl font-bold ${getPnLColorClass(estimatedPnl, preferences.colorScheme)}`}>
                        {estimatedPnl >= 0 ? '+' : ''}{formatCurrency(estimatedPnl)}
                      </p>
                      <p className={`text-sm ${getPnLColorClass(estimatedPnlPercent, preferences.colorScheme)}`}>
                        {estimatedPnlPercent >= 0 ? '+' : ''}{estimatedPnlPercent.toFixed(2)}%
                      </p>
                    </>
                  ) : (
                    <p className="text-lg text-muted-foreground">--</p>
                  )}
                </div>
              </div>

              {/* 重量信息 */}
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    贵金属详情
                  </span>
                  <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                    {metadata.weight} 克
                  </span>
                </div>
              </div>

              {/* 单价对比 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 购买单价 */}
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="text-sm text-muted-foreground mb-1">购买单价</div>
                  <p className="text-lg font-semibold">
                    {formatCurrency(metadata.unitPrice || 0)}/克
                  </p>
                  {metadata.spotPriceAtPurchase && (
                    <p className="text-xs text-muted-foreground mt-1">
                      购买时现货价：¥{metadata.spotPriceAtPurchase.toFixed(2)}/克
                    </p>
                  )}
                </div>

                {/* 当前金价 */}
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground mb-1">当前金价</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={fetchGoldPrice}
                      disabled={isLoadingPrice}
                    >
                      <RefreshCw className={`h-3 w-3 ${isLoadingPrice ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  {currentPrice ? (
                    <>
                      <p className="text-lg font-semibold">
                        {formatCurrency(currentPrice)}/克
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {metadata.goldCategory === 'jewelry' && metadata.jewelryBrand !== 'other'
                          ? `${metadata.jewelryBrand === 'chow_tai_fook' ? '周大福' :
                              metadata.jewelryBrand === 'lao_feng_xiang' ? '老凤祥' :
                              metadata.jewelryBrand === 'chow_sang_sang' ? '周生生' :
                              metadata.jewelryBrand === 'luk_fook' ? '六福' : '品牌'}参考价`
                          : '国际现货价'}
                        {goldPriceData && ` · ${new Date(goldPriceData.timestamp).toLocaleTimeString('zh-CN')}`}
                      </p>
                    </>
                  ) : (
                    <p className="text-lg text-muted-foreground">--</p>
                  )}
                </div>
              </div>

              {/* 现货价对比（仅首饰金显示） */}
              {metadata.goldCategory === 'jewelry' && goldPriceData && (
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">国际现货价参考</span>
                    <span className="font-medium">¥{goldPriceData.spotPrice.toFixed(2)}/克</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    首饰金通常比现货价高10-15%，包含工艺和品牌溢价
                  </p>
                </div>
              )}
            </div>
          ) : (
            // 通用显示
            <div className="grid grid-cols-3 gap-4">
              {/* 当前价值 */}
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span>当前价值</span>
                </div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(asset.currentValue)}
                </p>
              </div>

              {/* 购买价格 */}
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Wallet className="h-4 w-4" />
                  <span>购买价格</span>
                </div>
                <p className="text-2xl font-bold">
                  {formatCurrency(asset.purchasePrice)}
                </p>
              </div>

              {/* 数量 */}
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <BarChart3 className="h-4 w-4" />
                  <span>数量</span>
                </div>
                <p className="text-2xl font-bold">
                  {asset.quantity.toLocaleString('zh-CN', { 
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 6 
                  })}
                </p>
              </div>
            </div>
          )}

          {/* 收益分析（如果有收益数据） */}
          {hasProfit && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  {asset.unrealizedPnl! >= 0 ? (
                    <TrendingUp className={`h-5 w-5 ${getPnLColorClass(1, preferences.colorScheme)}`} />
                  ) : (
                    <TrendingDown className={`h-5 w-5 ${getPnLColorClass(-1, preferences.colorScheme)}`} />
                  )}
                  收益分析
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  {/* 收益金额 */}
                  <div className={`p-4 rounded-lg ${
                    asset.unrealizedPnl! >= 0 
                      ? 'bg-green-50 dark:bg-green-950' 
                      : 'bg-red-50 dark:bg-red-950'
                  }`}>
                    <div className="text-sm mb-1">收益金额</div>
                    <p className={`text-2xl font-bold ${getPnLColorClass(asset.unrealizedPnl!, preferences.colorScheme)}`}>
                      {asset.unrealizedPnl! >= 0 ? '+' : ''}{formatCurrency(asset.unrealizedPnl!)}
                    </p>
                  </div>

                  {/* 收益率 */}
                  <div className={`p-4 rounded-lg ${
                    (asset.unrealizedPnlPercent || 0) >= 0 
                      ? 'bg-green-50 dark:bg-green-950' 
                      : 'bg-red-50 dark:bg-red-950'
                  }`}>
                    <div className="text-sm mb-1">收益率</div>
                    <p className={`text-2xl font-bold ${getPnLColorClass(asset.unrealizedPnlPercent || 0, preferences.colorScheme)}`}>
                      {formatPercent(asset.unrealizedPnlPercent || 0)}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* 详细信息 - 两列对比表 */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Info className="h-5 w-5" />
              详细信息
            </h3>
            <div className="space-y-3">
              {/* 资产信息 */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <div className="text-sm text-muted-foreground">存放分类</div>
                <div className="text-sm font-medium">{asset.assetCategory?.name}</div>

                <div className="text-sm text-muted-foreground">统计分类</div>
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: effectiveGroup.color }}
                  />
                  {effectiveGroup.name}
                  {isOverridden ? (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">(自定义)</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">(默认)</span>
                  )}
                </div>

                {metadata.bankName && (
                  <>
                    <div className="text-sm text-muted-foreground">银行名称</div>
                    <div className="text-sm font-medium">{metadata.bankName}</div>
                  </>
                )}

                {metadata.accountNumber && (
                  <>
                    <div className="text-sm text-muted-foreground">账户后四位</div>
                    <div className="text-sm font-medium">****{metadata.accountNumber}</div>
                  </>
                )}

                {metadata.interestRate && (
                  <>
                    <div className="text-sm text-muted-foreground">年利率</div>
                    <div className="text-sm font-medium">{metadata.interestRate}%</div>
                  </>
                )}

                {metadata.yield7Day && (
                  <>
                    <div className="text-sm text-muted-foreground">7日年化收益率</div>
                    <div className="text-sm font-medium">{metadata.yield7Day}%</div>
                  </>
                )}

                {metadata.fundCode && (
                  <>
                    <div className="text-sm text-muted-foreground">基金代码</div>
                    <div className="text-sm font-medium">{metadata.fundCode}</div>
                  </>
                )}

                {metadata.brokerName && (
                  <>
                    <div className="text-sm text-muted-foreground">券商名称</div>
                    <div className="text-sm font-medium">{metadata.brokerName}</div>
                  </>
                )}

                {/* 贵金属特有字段 */}
                {metadata.metalType && (
                  <>
                    <div className="text-sm text-muted-foreground">贵金属类型</div>
                    <div className="text-sm font-medium">{metadata.metalType}</div>
                  </>
                )}

                {metadata.purity && (
                  <>
                    <div className="text-sm text-muted-foreground">纯度</div>
                    <div className="text-sm font-medium">{metadata.purity}</div>
                  </>
                )}

                {metadata.weight && (
                  <>
                    <div className="text-sm text-muted-foreground">重量（克）</div>
                    <div className="text-sm font-medium">{metadata.weight} 克</div>
                  </>
                )}

                {metadata.certificate && (
                  <>
                    <div className="text-sm text-muted-foreground">证书编号</div>
                    <div className="text-sm font-medium">{metadata.certificate}</div>
                  </>
                )}

                {/* 数字资产特有字段 */}
                {metadata.cryptoSymbol && (
                  <>
                    <div className="text-sm text-muted-foreground">代币符号</div>
                    <div className="text-sm font-medium">{metadata.cryptoSymbol}</div>
                  </>
                )}

                {metadata.blockchain && (
                  <>
                    <div className="text-sm text-muted-foreground">区块链网络</div>
                    <div className="text-sm font-medium">{metadata.blockchain}</div>
                  </>
                )}

                {metadata.walletAddress && (
                  <>
                    <div className="text-sm text-muted-foreground">钱包地址</div>
                    <div className="text-sm font-medium truncate max-w-[200px]" title={metadata.walletAddress}>
                      {metadata.walletAddress}
                    </div>
                  </>
                )}

                {/* 大宗商品特有字段 */}
                {metadata.commodityType && (
                  <>
                    <div className="text-sm text-muted-foreground">商品类型</div>
                    <div className="text-sm font-medium">{metadata.commodityType}</div>
                  </>
                )}

                {metadata.unit && (
                  <>
                    <div className="text-sm text-muted-foreground">计量单位</div>
                    <div className="text-sm font-medium">{metadata.unit}</div>
                  </>
                )}

                {metadata.contract && (
                  <>
                    <div className="text-sm text-muted-foreground">合约代码</div>
                    <div className="text-sm font-medium">{metadata.contract}</div>
                  </>
                )}

                {/* 收藏品特有字段 */}
                {metadata.collectibleType && (
                  <>
                    <div className="text-sm text-muted-foreground">收藏类型</div>
                    <div className="text-sm font-medium">{metadata.collectibleType}</div>
                  </>
                )}

                {metadata.artist && (
                  <>
                    <div className="text-sm text-muted-foreground">艺术家/作者</div>
                    <div className="text-sm font-medium">{metadata.artist}</div>
                  </>
                )}

                {metadata.year && (
                  <>
                    <div className="text-sm text-muted-foreground">年份</div>
                    <div className="text-sm font-medium">{metadata.year}</div>
                  </>
                )}

                {metadata.condition && (
                  <>
                    <div className="text-sm text-muted-foreground">品相</div>
                    <div className="text-sm font-medium">{metadata.condition}</div>
                  </>
                )}

                {metadata.appraisalValue && metadata.appraisalValue > 0 && (
                  <>
                    <div className="text-sm text-muted-foreground">评估价值</div>
                    <div className="text-sm font-medium">
                      {formatCurrency(metadata.appraisalValue)}
                    </div>
                  </>
                )}

                {/* 应收款特有字段 */}
                {metadata.debtorName && (
                  <>
                    <div className="text-sm text-muted-foreground">欠款人</div>
                    <div className="text-sm font-medium">{metadata.debtorName}</div>
                  </>
                )}

                {metadata.debtorContact && (
                  <>
                    <div className="text-sm text-muted-foreground">联系方式</div>
                    <div className="text-sm font-medium">{metadata.debtorContact}</div>
                  </>
                )}

                {metadata.repaymentStatus && (
                  <>
                    <div className="text-sm text-muted-foreground">收回状态</div>
                    <div className="text-sm font-medium">
                      {metadata.repaymentStatus === 'paid' ? '已收回' :
                       metadata.repaymentStatus === 'partial' ? '部分收回' : '待收回'}
                    </div>
                  </>
                )}

                {metadata.depositType && (
                  <>
                    <div className="text-sm text-muted-foreground">押金类型</div>
                    <div className="text-sm font-medium">
                      {metadata.depositType === 'rent' ? '租房押金' :
                       metadata.depositType === 'utility' ? '水电燃气押金' :
                       metadata.depositType === 'car' ? '车辆押金' :
                       metadata.depositType === 'membership' ? '会员押金' : '其他押金'}
                    </div>
                  </>
                )}

                {metadata.depositAddress && (
                  <>
                    <div className="text-sm text-muted-foreground">关联地址</div>
                    <div className="text-sm font-medium">{metadata.depositAddress}</div>
                  </>
                )}

                {metadata.employer && (
                  <>
                    <div className="text-sm text-muted-foreground">雇主/公司</div>
                    <div className="text-sm font-medium">{metadata.employer}</div>
                  </>
                )}

                {metadata.salaryMonth && (
                  <>
                    <div className="text-sm text-muted-foreground">对应月份</div>
                    <div className="text-sm font-medium">{metadata.salaryMonth}</div>
                  </>
                )}

                {metadata.invoiceNumber && (
                  <>
                    <div className="text-sm text-muted-foreground">发票号</div>
                    <div className="text-sm font-medium">{metadata.invoiceNumber}</div>
                  </>
                )}

                {metadata.contractNumber && (
                  <>
                    <div className="text-sm text-muted-foreground">合同编号</div>
                    <div className="text-sm font-medium">{metadata.contractNumber}</div>
                  </>
                )}

                <div className="text-sm text-muted-foreground">币种</div>
                <div className="text-sm font-medium">{asset.currency}</div>

                {asset.purchaseDate && (
                  <>
                    <div className="text-sm text-muted-foreground">购买日期</div>
                    <div className="text-sm font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(asset.purchaseDate).toLocaleDateString('zh-CN')}
                    </div>
                  </>
                )}

                {asset.maturityDate && (
                  <>
                    <div className="text-sm text-muted-foreground">到期日期</div>
                    <div className="text-sm font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(asset.maturityDate).toLocaleDateString('zh-CN')}
                    </div>
                  </>
                )}

                <div className="text-sm text-muted-foreground">最后更新</div>
                <div className="text-sm font-medium">
                  {new Date(asset.lastUpdated).toLocaleString('zh-CN')}
                </div>
              </div>
            </div>
          </div>

          {/* 备注 */}
          {asset.description && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">备注</h3>
                <p className="text-sm text-muted-foreground">{asset.description}</p>
              </div>
            </>
          )}
          </TabsContent>

          {/* Tab 2: 更新记录 */}
          <TabsContent value="history" className="mt-4">
            <AssetActivityTimeline 
              assetId={asset.id}
              assetType="CASH_ASSET"
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          {onEdit && (
            <Button variant="outline" onClick={onEdit}>
              编辑
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              删除
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
