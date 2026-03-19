'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Loader2, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ==================== 类型定义 ====================

interface HistoricalDataPoint {
  date: string;
  totalAssets?: number;
  netWorth?: number;
  totalLiabilities?: number;
  equityAssets?: number;
  fixedIncomeAssets?: number;
  cashEquivalents?: number;
  realEstateAssets?: number;
  alternativeAssets?: number;
  receivableAssets?: number;
}

// 一级资产分类
interface OverviewGroupItem {
  code: string;
  name: string;
  value: number;
  percentage: number;
  color: string;
  count: number;
}

// 权益类按地区细分
interface EquityByRegion {
  total: number;
  count: number;
  byRegion: Array<{
    regionCode: string;
    regionName: string;
    value: number;
    percentage: number;
    count: number;
    color: string;
  }>;
}

// 各资产分组的二级分类
interface GroupSubCategories {
  groupCode: string;
  groupName: string;
  total: number;
  count: number;
  bySubCategory: Array<{
    categoryCode: string;
    categoryName: string;
    value: number;
    percentage: number;
    count: number;
    color: string;
  }>;
}

interface AssetPanoramaProps {
  portfolioData: {
    byOverviewGroup: OverviewGroupItem[];
    equityByRegion?: EquityByRegion;
    groupsSubCategories?: Record<string, GroupSubCategories>;
  };
  totalValue: number;
  defaultRange?: '7d' | '30d' | '90d' | '1y';
  historyApiUrl?: string; // 自定义历史数据API地址（家庭视角使用 /api/family/history）
}

// ==================== 指标配置 ====================

// 指标选项（与趋势图数据字段对应）
const METRIC_OPTIONS = [
  { value: 'totalAssets', label: '总资产', color: '#3B82F6', gradientId: 'colorTotalAssets', groupCode: null },
  { value: 'netWorth', label: '净资产', color: '#10B981', gradientId: 'colorNetWorth', groupCode: null },
  { value: 'totalLiabilities', label: '负债', color: '#EF4444', gradientId: 'colorLiabilities', groupCode: null },
  { value: 'equityAssets', label: '权益类', color: '#3B82F6', gradientId: 'colorEquity', groupCode: 'EQUITY' },
  { value: 'cashEquivalents', label: '现金类', color: '#10B981', gradientId: 'colorCash', groupCode: 'CASH' },
  { value: 'fixedIncomeAssets', label: '固收类', color: '#F59E0B', gradientId: 'colorFixedIncome', groupCode: 'FIXED_INCOME' },
  { value: 'realEstateAssets', label: '不动产', color: '#EC4899', gradientId: 'colorRealEstate', groupCode: 'REAL_ESTATE' },
  { value: 'alternativeAssets', label: '另类投资', color: '#8B5CF6', gradientId: 'colorAlternative', groupCode: 'ALTERNATIVE' },
  { value: 'receivableAssets', label: '应收款', color: '#0EA5E9', gradientId: 'colorReceivable', groupCode: 'RECEIVABLE' },
];

// ==================== 主组件 ====================

export function AssetPanorama({ 
  portfolioData, 
  totalValue,
  defaultRange = '30d',
  historyApiUrl = '/api/portfolio/history',
}: AssetPanoramaProps) {
  const [historyData, setHistoryData] = useState<HistoricalDataPoint[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>(defaultRange);
  const [selectedMetric, setSelectedMetric] = useState<string>('totalAssets');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // 获取当前选中的指标配置
  const currentMetricConfig = METRIC_OPTIONS.find(m => m.value === selectedMetric) || METRIC_OPTIONS[0];

  // 判断是否是概览指标（总资产/净资产/负债）
  const isOverviewMetric = ['totalAssets', 'netWorth', 'totalLiabilities'].includes(selectedMetric);

  // 加载历史数据
  const loadHistoricalData = async (range: '7d' | '30d' | '90d' | '1y') => {
    try {
      setIsLoading(true);
      setError(null);

      const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
      const days = daysMap[range];

      const response = await fetch(`${historyApiUrl}?days=${days}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) throw new Error('获取历史数据失败');

      const result = await response.json();
      
      if (result.success && result.data?.trend) {
        const formattedData: HistoricalDataPoint[] = result.data.trend.map((item: Record<string, unknown>) => ({
          date: item.date as string,
          totalAssets: Number(item.totalAssets || item.totalValue || 0),
          netWorth: Number(item.netWorth || item.totalValue || 0),
          totalLiabilities: Number(item.totalLiabilities || 0),
          equityAssets: Number(item.equityAssets || 0),
          fixedIncomeAssets: Number(item.fixedIncomeAssets || 0),
          cashEquivalents: Number(item.cashEquivalents || 0),
          realEstateAssets: Number(item.realEstateAssets || 0),
          alternativeAssets: Number(item.alternativeAssets || 0),
          receivableAssets: Number(item.receivableAssets || 0),
        }));
        setHistoryData(formattedData);
      } else {
        throw new Error(result.error || '数据格式错误');
      }
    } catch (err) {
      console.error('加载历史数据失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 初始加载（apiUrl 变化时也重新加载，支持视角切换）
  useEffect(() => {
    loadHistoricalData(timeRange);
  }, [timeRange, historyApiUrl]);

  // 获取指标值
  const getMetricValue = (dataPoint: HistoricalDataPoint, metric: string): number => {
    return (dataPoint as unknown as Record<string, unknown>)[metric] as number || 0;
  };

  // 计算统计数据
  const latestData = historyData.length > 0 ? historyData[historyData.length - 1] : null;
  const firstData = historyData.length > 0 ? historyData[0] : null;
  const latestValue = latestData ? getMetricValue(latestData, selectedMetric) : 0;
  const firstValue = firstData ? getMetricValue(firstData, selectedMetric) : 0;
  const totalChange = latestValue - firstValue;
  const totalChangePercent = firstValue > 0 ? ((latestValue - firstValue) / firstValue) * 100 : 0;
  const isPositive = totalChange >= 0;

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (timeRange === '7d' || timeRange === '30d') {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
    return `${date.getMonth() + 1}月`;
  };

  // 获取二级分类数据（用于饼图）
  const subCategoryData = useMemo(() => {
    if (isOverviewMetric) return null;

    const groupCode = currentMetricConfig.groupCode;
    if (!groupCode) return null;

    if (groupCode === 'EQUITY') {
      // 权益类使用地区细分
      if (!portfolioData.equityByRegion?.byRegion?.length) return null;
      return portfolioData.equityByRegion.byRegion.map(item => ({
        code: item.regionCode,
        name: item.regionName,
        value: item.value,
        percentage: item.percentage,
        color: item.color,
        count: item.count,
      }));
    }

    // 其他分组使用 groupsSubCategories
    const groupData = portfolioData.groupsSubCategories?.[groupCode];
    if (!groupData?.bySubCategory?.length) return null;
    return groupData.bySubCategory.map(item => ({
      code: item.categoryCode,
      name: item.categoryName,
      value: item.value,
      percentage: item.percentage,
      color: item.color,
      count: item.count,
    }));
  }, [selectedMetric, portfolioData, isOverviewMetric, currentMetricConfig.groupCode]);

  // 自定义饼图标签
  const renderPieLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent,
  }: {
    cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number;
  }) => {
    if (percent < 0.08) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-xs font-bold drop-shadow-lg">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 border-0 shadow-xl">
      <CardHeader className="pb-2 space-y-2">
        {/* 第一行：标题 + 刷新 + 时间范围 */}
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200 text-base sm:text-lg">
            <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
              {isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
            </div>
            <span>资产全景</span>
          </CardTitle>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadHistoricalData(timeRange)}
              disabled={isLoading}
              className="h-7 w-7 p-0"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
            <div className="flex gap-0.5">
              {(['7d', '30d', '90d', '1y'] as const).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                  disabled={isLoading}
                  className="h-7 px-2 text-[10px] sm:text-xs"
                >
                  {range}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* 第二行：指标选择 + 统计信息 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs">
              <SelectValue placeholder="选择指标" />
            </SelectTrigger>
            <SelectContent>
              {METRIC_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: option.color }} />
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {latestData && (
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200 truncate">
                  ¥{latestValue.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  当前{currentMetricConfig.label}
                </p>
              </div>
              {firstData && firstValue > 0 && (
                <div className="shrink-0">
                  <p className={`text-sm sm:text-base font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isPositive ? '+' : ''}¥{(Math.abs(totalChange) / 10000).toFixed(1)}万
                  </p>
                  <p className={`text-[10px] sm:text-xs ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isPositive ? '+' : ''}{totalChangePercent.toFixed(2)}%
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* 趋势图 */}
        {isLoading && historyData.length === 0 ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : historyData.length === 0 ? (
          <div className="h-40 flex items-center justify-center">
            <div className="text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm">暂无历史数据</p>
            </div>
          </div>
        ) : (
          <div className="h-40 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <defs>
                  {METRIC_OPTIONS.map((option) => (
                    <linearGradient key={option.gradientId} id={option.gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={option.color} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={option.color} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" stroke="currentColor" strokeOpacity={0.1} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: 'currentColor', fontSize: 10 }}
                  tickFormatter={formatDate}
                  axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: 'currentColor', fontSize: 10 }}
                  tickFormatter={(value) => `¥${(value / 10000).toFixed(0)}万`}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const dataPoint = payload[0].payload as HistoricalDataPoint;
                      const value = getMetricValue(dataPoint, selectedMetric);
                      return (
                        <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-xs">
                          <p className="font-medium text-slate-800 dark:text-slate-200 mb-1">
                            {new Date(dataPoint.date).toLocaleDateString('zh-CN')}
                          </p>
                          <div className="flex justify-between gap-3">
                            <span className="text-slate-500">{currentMetricConfig.label}:</span>
                            <span className="font-medium" style={{ color: currentMetricConfig.color }}>
                              ¥{(value / 10000).toFixed(1)}万
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={selectedMetric}
                  stroke={currentMetricConfig.color}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={`url(#${currentMetricConfig.gradientId})`}
                  animationDuration={500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 资产构成区域 */}
        {isOverviewMetric ? (
          // 概览指标：显示资产构成比例条
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">资产构成</p>

            {/* 比例条 */}
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
              {(portfolioData.byOverviewGroup || []).map((item, index) => (
                <div
                  key={item.code}
                  className="h-full transition-all duration-300 cursor-pointer hover:opacity-80"
                  style={{ 
                    width: `${item.percentage}%`, 
                    backgroundColor: item.color,
                  }}
                  title={`${item.name}: ${item.percentage.toFixed(1)}%`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                />
              ))}
            </div>

            {/* 图例 - 带金额、百分比和下拉箭头 */}
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {(portfolioData.byOverviewGroup || []).map((item, index) => (
                <button
                  key={item.code}
                  onClick={() => { setIsDetailExpanded(isDetailExpanded && activeIndex === index ? false : true); setActiveIndex(index); }}
                  className={`flex items-center gap-1.5 text-xs transition-opacity cursor-pointer group ${
                    activeIndex !== null && activeIndex !== index ? 'opacity-50' : ''
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => !isDetailExpanded && setActiveIndex(null)}
                >
                  <div 
                    className="h-3.5 w-3.5 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300">{item.name}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    ¥{item.value >= 10000 ? `${(item.value / 10000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}` : item.value.toLocaleString('zh-CN')}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">({item.percentage.toFixed(1)}%)</span>
                  <span className={`flex items-center justify-center h-4 w-4 rounded-full transition-colors ${
                    isDetailExpanded && activeIndex === index
                      ? 'bg-slate-300 dark:bg-slate-600'
                      : 'bg-slate-200 dark:bg-slate-700 group-hover:bg-slate-300 dark:group-hover:bg-slate-600'
                  }`}>
                    {isDetailExpanded && activeIndex === index ? (
                      <ChevronUp className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                    )}
                  </span>
                </button>
              ))}
            </div>

            {/* 展开的明细列表 */}
            {isDetailExpanded && activeIndex !== null && (portfolioData.byOverviewGroup || [])[activeIndex] && (
              <div className="mt-1 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50">
                {(() => {
                  const item = (portfolioData.byOverviewGroup || [])[activeIndex];
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            ¥{item.value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                          <span className="text-[10px] text-slate-500 ml-2">{item.percentage.toFixed(1)}%</span>
                          {item.count > 0 && (
                            <span className="text-[10px] text-slate-400 ml-2">{item.count} 项</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : subCategoryData && subCategoryData.length > 0 ? (
          // 分类指标：显示二级分类饼图
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {currentMetricConfig.label}细分
            </p>
            
            <div className="flex items-start gap-4">
              {/* 迷你饼图 */}
              <div className="w-28 h-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={subCategoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderPieLabel}
                      outerRadius={50}
                      innerRadius={25}
                      dataKey="value"
                      paddingAngle={2}
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      {subCategoryData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke={activeIndex === index ? '#ffffff' : 'none'}
                          strokeWidth={activeIndex === index ? 2 : 0}
                          style={{
                            filter: activeIndex === index ? 'brightness(1.1)' : 'brightness(1)',
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-lg border text-xs">
                              <p className="font-medium">{item.name}</p>
                              <p style={{ color: item.color }}>¥{(item.value / 10000).toFixed(1)}万 ({item.percentage.toFixed(1)}%)</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* 图例列表 */}
              <div className="flex-1 space-y-1">
                {subCategoryData.map((item, index) => (
                  <div 
                    key={item.code}
                    className={`flex items-center justify-between p-1.5 rounded transition-colors cursor-pointer ${
                      activeIndex === index ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-slate-700 dark:text-slate-300">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        ¥{(item.value / 10000).toFixed(1)}万
                      </span>
                      <span className="text-[10px] text-slate-500 w-10 text-right">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // 无二级分类数据
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-center">
            <p className="text-xs text-slate-500">该分类暂无细分数据</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
