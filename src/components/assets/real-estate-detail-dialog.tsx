'use client';

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
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  DollarSign, 
  Wallet, 
  MapPin,
  Ruler,
  Banknote,
  Info,
  Clock,
  PiggyBank,
  Calculator,
  Target,
  AlertCircle,
  History
} from 'lucide-react';
import { formatters } from '@/lib/api-client';
import { getPnLColorClass } from '@/lib/user-preferences';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { AssetActivityTimeline } from '@/components/shared/asset-activity-timeline';

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
}

interface RealEstateDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function RealEstateDetailDialog({
  open,
  onOpenChange,
  asset,
  onEdit,
  onDelete,
}: RealEstateDetailDialogProps) {
  const metadata = asset.metadata || {};
  const preferences = useUserPreferences();
  
  // 获取 API 计算的专业指标
  const metrics = metadata._realEstateMetrics || {};

  const formatCurrency = (amount: number) => {
    const symbol = asset.currency === 'USD' ? '$' : asset.currency === 'HKD' ? 'HK$' : '¥';
    return `${symbol}${Math.abs(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  // 物业类型显示
  const getPropertyTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      'residential': '住宅',
      'apartment': '公寓',
      'villa': '别墅',
      'townhouse': '联排别墅',
      'flat': '平层',
      'commercial': '商铺',
      'office': '办公楼',
      'retail': '零售商铺',
      'warehouse': '仓库',
      'industrial': '工业厂房',
      'hotel': '酒店',
      'land': '土地'
    };
    return typeMap[type] || type;
  };

  // 租金收益率颜色分级
  const getRentalYieldColor = (yield_: number) => {
    if (yield_ >= 5) return 'text-green-600 dark:text-green-400';
    if (yield_ >= 3) return 'text-amber-600 dark:text-amber-400';
    if (yield_ > 0) return 'text-orange-600 dark:text-orange-400';
    return 'text-slate-400';
  };

  // 租售比评级
  const getPriceToRentRating = (ratio: number) => {
    if (ratio === 0) return { text: '-', color: 'text-slate-400', desc: '无租金数据', level: 0 };
    if (ratio <= 15) return { text: '优秀', color: 'text-green-600', desc: '15年内回本，投资价值高', level: 4 };
    if (ratio <= 25) return { text: '良好', color: 'text-blue-600', desc: '15-25年回本，合理范围', level: 3 };
    if (ratio <= 35) return { text: '一般', color: 'text-amber-600', desc: '25-35年回本，需谨慎', level: 2 };
    return { text: '偏高', color: 'text-red-600', desc: '35年以上回本，投资风险较高', level: 1 };
  };

  // 判断是否是REITs
  const isREITs = asset.assetCategory.code === 'RE_REITS';
  
  // 从 metrics 或 metadata 获取数据
  const monthlyRent = metrics.monthlyRent || Number(metadata.rentalIncome || metadata.monthlyRent || 0);
  const annualRent = metrics.annualRent || monthlyRent * 12;
  const grossRentalYield = metrics.grossRentalYield || (asset.currentValue > 0 ? (annualRent / asset.currentValue) * 100 : 0);
  const netRentalYield = metrics.netRentalYield || grossRentalYield;
  const priceToRentRatio = metrics.priceToRentRatio || (annualRent > 0 ? asset.currentValue / annualRent : 0);
  const accumulatedRent = metrics.accumulatedRent || 0;
  const totalReturn = metrics.totalReturn || ((asset.unrealizedPnl || 0) + accumulatedRent);
  const totalReturnPercent = metrics.totalReturnPercent || (asset.purchasePrice > 0 ? (totalReturn / asset.purchasePrice) * 100 : 0);
  const holdingYears = metrics.holdingYears || 0;
  const vacancyRate = metrics.vacancyRate || Number(metadata.vacancyRate || 0);
  const annualExpenses = metrics.annualExpenses || Number(metadata.annualExpenses || 0);
  
  const priceToRentRating = getPriceToRentRating(priceToRentRatio);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            {asset.name}
            <Badge variant="outline">{asset.assetCategory.name}</Badge>
          </DialogTitle>
          <DialogDescription>
            查看 {asset.name} 的详细信息和投资分析 · {asset.currency}
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
          {/* 物业类型和地址 */}
          {!isREITs && (metadata.propertyType || metadata.address) && (
            <div className="flex items-center gap-2 flex-wrap">
              {metadata.propertyType && (
                <Badge variant="default" className="bg-blue-500">
                  {getPropertyTypeLabel(metadata.propertyType)}
                </Badge>
              )}
              {metadata.address && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {metadata.address}
                </Badge>
              )}
              {holdingYears > 0 && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  持有 {holdingYears.toFixed(1)} 年
                </Badge>
              )}
            </div>
          )}

          {/* 核心价值指标 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 当前估值 */}
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 mb-1">
                <DollarSign className="h-4 w-4" />
                <span>当前估值</span>
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(asset.currentValue)}
              </p>
              {metadata.area && metrics.pricePerSqm > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  单价 ¥{metrics.pricePerSqm.toLocaleString()}/㎡
                </p>
              )}
            </div>

            {/* 购买价格 */}
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Wallet className="h-4 w-4" />
                <span>购买成本</span>
              </div>
              <p className="text-2xl font-bold">
                {formatCurrency(asset.purchasePrice)}
              </p>
              {asset.purchaseDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(asset.purchaseDate).toLocaleDateString('zh-CN')} 购入
                </p>
              )}
            </div>
          </div>

          {/* 资本增值 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 增值金额 */}
            <div className={`p-4 rounded-lg ${
              (asset.unrealizedPnl || 0) >= 0 
                ? 'bg-green-50 dark:bg-green-950' 
                : 'bg-red-50 dark:bg-red-950'
            }`}>
              <div className="flex items-center gap-2 text-sm mb-1">
                {(asset.unrealizedPnl || 0) >= 0 ? (
                  <TrendingUp className={`h-4 w-4 ${getPnLColorClass(1, preferences.colorScheme)}`} />
                ) : (
                  <TrendingDown className={`h-4 w-4 ${getPnLColorClass(-1, preferences.colorScheme)}`} />
                )}
                <span>资本增值</span>
              </div>
              <p className={`text-2xl font-bold ${getPnLColorClass(asset.unrealizedPnl || 0, preferences.colorScheme)}`}>
                {(asset.unrealizedPnl || 0) >= 0 ? '+' : ''}{formatCurrency(asset.unrealizedPnl || 0)}
              </p>
              <p className={`text-xs mt-1 ${getPnLColorClass(asset.unrealizedPnlPercent || 0, preferences.colorScheme)}`}>
                {formatPercent(asset.unrealizedPnlPercent || 0)}
              </p>
            </div>

            {/* 综合回报 */}
            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 mb-1">
                <Calculator className="h-4 w-4" />
                <span>综合回报</span>
              </div>
              <p className={`text-2xl font-bold ${getPnLColorClass(totalReturn, preferences.colorScheme)}`}>
                {totalReturn >= 0 ? '+' : ''}{formatCurrency(totalReturn)}
              </p>
              <p className={`text-xs mt-1 ${getPnLColorClass(totalReturnPercent, preferences.colorScheme)}`}>
                {formatPercent(totalReturnPercent)} 总回报率
              </p>
            </div>
          </div>

          {/* 租金收益分析 */}
          {monthlyRent > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <PiggyBank className="h-5 w-5 text-amber-500" />
                  租金收益分析
                </h3>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 月租金 */}
                  <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950">
                    <div className="text-sm text-amber-700 dark:text-amber-300 mb-1">月租金</div>
                    <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                      {formatCurrency(monthlyRent)}
                    </p>
                    {metadata.area && metrics.rentPerSqm > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ¥{metrics.rentPerSqm.toFixed(1)}/㎡/月
                      </p>
                    )}
                  </div>

                  {/* 毛租金收益率 */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 cursor-help">
                          <div className="flex items-center gap-1 text-sm text-amber-700 dark:text-amber-300 mb-1">
                            毛租金收益率
                            <Info className="h-3 w-3" />
                          </div>
                          <p className={`text-xl font-bold ${getRentalYieldColor(grossRentalYield)}`}>
                            {grossRentalYield.toFixed(2)}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            年租 {formatCurrency(annualRent)}
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">毛租金收益率 (Gross Rental Yield)</p>
                        <p className="text-xs text-muted-foreground">= 年租金 / 当前市值 × 100%</p>
                        <p className="text-xs mt-1">
                          = {formatCurrency(annualRent)} / {formatCurrency(asset.currentValue)} × 100%
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* 净租金收益率 */}
                  {(vacancyRate > 0 || annualExpenses > 0) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 cursor-help">
                            <div className="flex items-center gap-1 text-sm text-green-700 dark:text-green-300 mb-1">
                              净租金收益率
                              <Info className="h-3 w-3" />
                            </div>
                            <p className={`text-xl font-bold ${getRentalYieldColor(netRentalYield)}`}>
                              {netRentalYield.toFixed(2)}%
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              扣除空置和支出
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">净租金收益率 (Net Rental Yield)</p>
                          <p className="text-xs text-muted-foreground">= (年租金 × (1-空置率) - 年支出) / 市值</p>
                          {vacancyRate > 0 && <p className="text-xs">空置率: {vacancyRate}%</p>}
                          {annualExpenses > 0 && <p className="text-xs">年支出: {formatCurrency(annualExpenses)}</p>}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  {/* 累计租金 */}
                  {accumulatedRent > 0 && (
                    <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950">
                      <div className="text-sm text-amber-700 dark:text-amber-300 mb-1">累计租金</div>
                      <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                        {formatCurrency(accumulatedRent)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        自购买以来
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* 投资评估指标 */}
          <Separator />
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              投资评估指标
            </h3>

            <div className="space-y-4">
              {/* 租售比评估 */}
              {priceToRentRatio > 0 && (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">租售比</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>租售比 = 房价 / 年租金</p>
                            <p className="text-xs text-muted-foreground">表示多少年的租金可以覆盖房价</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{priceToRentRatio.toFixed(1)}</span>
                      <span className="text-muted-foreground">年</span>
                      <Badge className={`${priceToRentRating.color} bg-opacity-20`}>
                        {priceToRentRating.text}
                      </Badge>
                    </div>
                  </div>
                  <Progress value={Math.min(priceToRentRating.level * 25, 100)} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {priceToRentRating.desc}
                  </p>
                </div>
              )}

              {/* 综合年化收益率 */}
              {monthlyRent > 0 && (
                <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
                        <Calculator className="h-4 w-4" />
                        综合年化收益率
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        年化增值率 + 租金收益率
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${getPnLColorClass(metrics.totalAnnualYield || (asset.unrealizedPnlPercent || 0) + grossRentalYield, preferences.colorScheme)}`}>
                        {formatPercent(metrics.totalAnnualYield || ((asset.unrealizedPnlPercent || 0) / Math.max(holdingYears, 1)) + grossRentalYield)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {holdingYears > 0 ? `${((asset.unrealizedPnlPercent || 0) / holdingYears).toFixed(2)}%` : formatPercent(asset.unrealizedPnlPercent || 0)} + {grossRentalYield.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 投资回报分析 */}
              {monthlyRent > 0 && accumulatedRent > 0 && (
                <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Banknote className="h-4 w-4" />
                    投资回报构成
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">资本增值</span>
                      <span className={`font-medium ${getPnLColorClass(asset.unrealizedPnl || 0, preferences.colorScheme)}`}>
                        {formatCurrency(asset.unrealizedPnl || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">累计租金</span>
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {formatCurrency(accumulatedRent)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">总回报</span>
                      <span className={`text-lg font-bold ${getPnLColorClass(totalReturn, preferences.colorScheme)}`}>
                        {totalReturn >= 0 ? '+' : ''}{formatCurrency(totalReturn)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* 详细信息 */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Info className="h-5 w-5" />
              详细信息
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {/* 面积 */}
              {metadata.area && (
                <>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Ruler className="h-4 w-4" />
                    面积
                  </div>
                  <div className="text-sm font-medium">{metadata.area} 平米</div>
                </>
              )}

              {/* 单价 */}
              {metadata.unitPrice_perSqm && (
                <>
                  <div className="text-sm text-muted-foreground">购买单价</div>
                  <div className="text-sm font-medium">{formatCurrency(metadata.unitPrice_perSqm)}/㎡</div>
                </>
              )}

              {/* 空置率 */}
              {vacancyRate > 0 && (
                <>
                  <div className="text-sm text-muted-foreground">空置率</div>
                  <div className="text-sm font-medium">{vacancyRate}%</div>
                </>
              )}

              {/* 年度支出 */}
              {annualExpenses > 0 && (
                <>
                  <div className="text-sm text-muted-foreground">年度支出</div>
                  <div className="text-sm font-medium">{formatCurrency(annualExpenses)}</div>
                </>
              )}

              {/* 预期年增值率 */}
              {metadata.annualAppreciation && (
                <>
                  <div className="text-sm text-muted-foreground">预期年增值率</div>
                  <div className="text-sm font-medium">{metadata.annualAppreciation}%</div>
                </>
              )}

              {/* REITs特有字段 */}
              {metadata.fundCode && (
                <>
                  <div className="text-sm text-muted-foreground">基金代码</div>
                  <div className="text-sm font-medium">{metadata.fundCode}</div>
                </>
              )}

              {metadata.fundName && (
                <>
                  <div className="text-sm text-muted-foreground">基金名称</div>
                  <div className="text-sm font-medium">{metadata.fundName}</div>
                </>
              )}

              {metadata.dividendYield && (
                <>
                  <div className="text-sm text-muted-foreground">股息率</div>
                  <div className="text-sm font-medium">{metadata.dividendYield}%</div>
                </>
              )}

              {/* 通用字段 */}
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

              <div className="text-sm text-muted-foreground">最后更新</div>
              <div className="text-sm font-medium">
                {new Date(asset.lastUpdated).toLocaleString('zh-CN')}
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
              assetType="REAL_ESTATE"
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
