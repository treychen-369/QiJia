'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
import { TrendingUp, TrendingDown, Loader2, RefreshCw } from 'lucide-react';

interface HistoricalDataPoint {
  date: string;
  totalValue: number;
  cashBalance: number;
  investedValue: number;
  unrealizedPnl: number;
  dailyReturn?: number;
  // 新增：一级资产类型
  equityAssets?: number;
  fixedIncomeAssets?: number;
  cashEquivalents?: number;
  realEstateAssets?: number;
  alternativeAssets?: number;
  receivableAssets?: number;
  // 新增：总资产、负债、净资产
  totalAssets?: number;
  totalLiabilities?: number;
  netWorth?: number;
}

// 指标配置
const METRIC_OPTIONS = [
  { value: 'totalAssets', label: '总资产', color: '#3B82F6', gradientId: 'colorTotalAssets' },
  { value: 'netWorth', label: '净资产', color: '#10B981', gradientId: 'colorNetWorth' },
  { value: 'totalLiabilities', label: '负债', color: '#EF4444', gradientId: 'colorLiabilities' },
  { value: 'equityAssets', label: '权益类投资', color: '#8B5CF6', gradientId: 'colorEquity' },
  { value: 'fixedIncomeAssets', label: '固定收益类', color: '#F59E0B', gradientId: 'colorFixedIncome' },
  { value: 'cashEquivalents', label: '现金等价物', color: '#06B6D4', gradientId: 'colorCash' },
  { value: 'realEstateAssets', label: '不动产类', color: '#EC4899', gradientId: 'colorRealEstate' },
  { value: 'alternativeAssets', label: '另类投资', color: '#84CC16', gradientId: 'colorAlternative' },
  { value: 'receivableAssets', label: '应收款', color: '#0EA5E9', gradientId: 'colorReceivable' },
];

interface HistoricalTrendChartProps {
  initialData?: HistoricalDataPoint[];
  defaultRange?: '7d' | '30d' | '90d' | '1y';
}

export function HistoricalTrendChart({ 
  initialData = [], 
  defaultRange = '30d' 
}: HistoricalTrendChartProps) {
  const [data, setData] = useState<HistoricalDataPoint[]>(initialData);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>(defaultRange);
  const [selectedMetric, setSelectedMetric] = useState<string>('totalAssets');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取当前选中的指标配置
  const currentMetricConfig = METRIC_OPTIONS.find(m => m.value === selectedMetric) || METRIC_OPTIONS[0];

  // 加载历史数据
  const loadHistoricalData = async (range: '7d' | '30d' | '90d' | '1y') => {
    try {
      setIsLoading(true);
      setError(null);

      const daysMap = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365,
      };
      const days = daysMap[range];

      const response = await fetch(`/api/portfolio/history?days=${days}`, {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error('获取历史数据失败');
      }

      const result = await response.json();
      
      if (result.success && result.data?.trend) {
        const formattedData: HistoricalDataPoint[] = result.data.trend.map((item: any) => ({
          date: item.date,
          totalValue: Number(item.totalValue || 0),
          cashBalance: Number(item.cashBalance || 0),
          investedValue: Number(item.investedValue || 0),
          unrealizedPnl: Number(item.unrealizedPnl || 0),
          dailyReturn: Number(item.dailyReturn || 0),
          // 新增字段
          equityAssets: Number(item.equityAssets || 0),
          fixedIncomeAssets: Number(item.fixedIncomeAssets || 0),
          cashEquivalents: Number(item.cashEquivalents || 0),
          realEstateAssets: Number(item.realEstateAssets || 0),
          alternativeAssets: Number(item.alternativeAssets || 0),
          totalAssets: Number(item.totalAssets || item.totalValue || 0),
          totalLiabilities: Number(item.totalLiabilities || 0),
          netWorth: Number(item.netWorth || item.totalValue || 0),
        }));
        setData(formattedData);
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

  // 初始加载和范围变化时重新加载
  useEffect(() => {
    if (initialData.length === 0) {
      loadHistoricalData(timeRange);
    }
  }, [timeRange]);

  const handleTimeRangeChange = (range: '7d' | '30d' | '90d' | '1y') => {
    setTimeRange(range);
  };

  const handleRefresh = () => {
    loadHistoricalData(timeRange);
  };

  // 获取指标值
  const getMetricValue = (dataPoint: HistoricalDataPoint, metric: string): number => {
    return (dataPoint as any)[metric] || 0;
  };

  // 计算统计数据
  const latestData = data.length > 0 ? data[data.length - 1] : null;
  const firstData = data.length > 0 ? data[0] : null;
  
  const latestValue = latestData ? getMetricValue(latestData, selectedMetric) : 0;
  const firstValue = firstData ? getMetricValue(firstData, selectedMetric) : 0;
  const totalChange = latestValue - firstValue;
  const totalChangePercent = firstValue > 0
    ? ((latestValue - firstValue) / firstValue) * 100
    : 0;
  const isPositive = totalChange >= 0;

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (timeRange === '7d' || timeRange === '30d') {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
    return `${date.getMonth() + 1}月`;
  };

  // 获取指标显示名称
  const getMetricDisplayName = (metric: string): string => {
    const config = METRIC_OPTIONS.find(m => m.value === metric);
    return config ? config.label : '总资产';
  };

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-green-50 dark:from-slate-900 dark:to-green-950 border-0 shadow-xl">
      <CardHeader className="pb-2 space-y-2">
        {/* 第一行：标题和操作 */}
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200 text-base sm:text-lg">
            <div className="p-1.5 bg-green-100 dark:bg-green-900 rounded-lg">
              {isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
            </div>
            <span>资产趋势</span>
            {data.length > 0 && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal hidden sm:inline">
                ({data.length}个数据点)
              </span>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-1">
            {/* 刷新按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-7 w-7 p-0"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>

            {/* 时间范围选择 */}
            <div className="flex gap-0.5">
              {(['7d', '30d', '90d', '1y'] as const).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleTimeRangeChange(range)}
                  disabled={isLoading}
                  className="h-7 px-2 text-[10px] sm:text-xs"
                >
                  {range}
                </Button>
              ))}
            </div>
          </div>
        </div>
        
        {/* 第二行：指标选择和统计信息 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          {/* 指标下拉选择 */}
          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs">
              <SelectValue placeholder="选择指标" />
            </SelectTrigger>
            <SelectContent>
              {METRIC_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2.5 h-2.5 rounded-full" 
                      style={{ backgroundColor: option.color }}
                    />
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 统计信息 */}
          {latestData && (
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200 truncate">
                  ¥{latestValue.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  当前{getMetricDisplayName(selectedMetric)}
                </p>
              </div>
              {firstData && firstValue > 0 && (
                <div className="shrink-0">
                  <p className={`text-sm sm:text-base font-semibold ${
                    isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {isPositive ? '+' : ''}¥{(Math.abs(totalChange) / 10000).toFixed(1)}万
                  </p>
                  <p className={`text-[10px] sm:text-xs ${
                    isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {isPositive ? '+' : ''}{totalChangePercent.toFixed(2)}%
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading && data.length === 0 ? (
          <div className="h-56 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-56 flex items-center justify-center">
            <div className="text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm">暂无历史数据</p>
              <p className="text-xs mt-1">请先创建快照或稍后重试</p>
            </div>
          </div>
        ) : (
          <div className="h-56 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
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
                          <p className="font-medium text-slate-800 dark:text-slate-200 mb-1.5">
                            {new Date(dataPoint.date).toLocaleDateString('zh-CN')}
                          </p>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-3">
                              <span className="text-slate-500 dark:text-slate-400">
                                {getMetricDisplayName(selectedMetric)}:
                              </span>
                              <span className="font-medium" style={{ color: currentMetricConfig.color }}>
                                ¥{value.toLocaleString('zh-CN')}
                              </span>
                            </div>
                            {/* 显示其他关键指标 */}
                            {selectedMetric !== 'totalAssets' && dataPoint.totalAssets && (
                              <div className="flex justify-between gap-3">
                                <span className="text-slate-500 dark:text-slate-400">总资产:</span>
                                <span className="font-medium">
                                  ¥{(dataPoint.totalAssets / 10000).toFixed(1)}万
                                </span>
                              </div>
                            )}
                            {selectedMetric !== 'netWorth' && dataPoint.netWorth && (
                              <div className="flex justify-between gap-3">
                                <span className="text-slate-500 dark:text-slate-400">净资产:</span>
                                <span className="font-medium">
                                  ¥{(dataPoint.netWorth / 10000).toFixed(1)}万
                                </span>
                              </div>
                            )}
                            {selectedMetric !== 'totalLiabilities' && dataPoint.totalLiabilities && dataPoint.totalLiabilities > 0 && (
                              <div className="flex justify-between gap-3">
                                <span className="text-slate-500 dark:text-slate-400">负债:</span>
                                <span className="font-medium text-red-500">
                                  ¥{(dataPoint.totalLiabilities / 10000).toFixed(1)}万
                                </span>
                              </div>
                            )}
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
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
