'use client';

import { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';

// 投资组合饼图
interface PortfolioPieChartProps {
  data: Array<{
    name: string;
    value: number;
    color: string;
    percentage: number;
  }>;
}

export function PortfolioPieChart({ data }: PortfolioPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
  };

  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 border-0 shadow-xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Percent className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          投资组合分布
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
                className="drop-shadow-lg"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke={activeIndex === index ? '#fff' : 'none'}
                    strokeWidth={activeIndex === index ? 2 : 0}
                    style={{
                      filter: activeIndex === index ? 'brightness(1.1)' : 'none',
                      transform: activeIndex === index ? 'scale(1.05)' : 'scale(1)',
                      transformOrigin: 'center',
                      transition: 'all 0.2s ease-in-out',
                    }}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0]?.payload;
                    if (!data) return null;
                    return (
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {data.name}
                        </p>
                        <p className="text-blue-600 dark:text-blue-400">
                          ¥{data.value.toLocaleString()}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          占比: {data.percentage.toFixed(2)}%
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* 图例 */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-slate-600 dark:text-slate-400 truncate">
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// 收益趋势图
interface TrendChartProps {
  data: Array<{
    date: string;
    value: number;
    profit: number;
    profitRate: number;
  }>;
  timeRange: '7d' | '30d' | '90d' | '1y';
  onTimeRangeChange: (range: '7d' | '30d' | '90d' | '1y') => void;
}

export function TrendChart({ data, timeRange, onTimeRangeChange }: TrendChartProps) {
  const latestData = data[data.length - 1];
  const isPositive = (latestData?.profit || 0) >= 0;

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-green-50 dark:from-slate-900 dark:to-green-950 border-0 shadow-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              {isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
            </div>
            资产趋势
          </CardTitle>
          
          <div className="flex gap-1">
            {(['7d', '30d', '90d', '1y'] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onTimeRangeChange(range)}
                className="h-8 px-3 text-xs"
              >
                {range}
              </Button>
            ))}
          </div>
        </div>
        
        {latestData && (
          <div className="flex items-center gap-4 mt-2">
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                ¥{latestData.value.toLocaleString()}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">总资产</p>
            </div>
            <div>
              <p className={`text-lg font-semibold ${
                isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {isPositive ? '+' : ''}¥{latestData.profit.toLocaleString()}
              </p>
              <p className={`text-sm ${
                isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {isPositive ? '+' : ''}{latestData.profitRate.toFixed(2)}%
              </p>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#60A5FA" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'currentColor' }}
                tickFormatter={(value) => `¥${(value / 10000).toFixed(0)}万`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0]?.payload;
                    if (!data) return null;
                    return (
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {label}
                        </p>
                        <p className="text-blue-600 dark:text-blue-400">
                          总资产: ¥{data.value.toLocaleString()}
                        </p>
                        <p className={`${
                          data.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          收益: {data.profit >= 0 ? '+' : ''}¥{data.profit.toLocaleString()}
                        </p>
                        <p className={`text-sm ${
                          data.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          收益率: {data.profit >= 0 ? '+' : ''}{data.profitRate.toFixed(2)}%
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#60A5FA"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
                className="drop-shadow-sm"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// 资产配置对比图
interface AllocationChartProps {
  currentData: Array<{
    category: string;
    current: number;
    target: number;
    deviation: number;
  }>;
}

export function AllocationChart({ currentData }: AllocationChartProps) {
  return (
    <Card className="bg-gradient-to-br from-slate-50 to-purple-50 dark:from-slate-900 dark:to-purple-950 border-0 shadow-xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
          <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
            <DollarSign className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          资产配置分析
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={currentData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="category" 
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'currentColor' }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0]?.payload;
                    if (!data) return null;
                    return (
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {label}
                        </p>
                        <p className="text-blue-600 dark:text-blue-400">
                          当前配置: {data.current.toFixed(1)}%
                        </p>
                        <p className="text-purple-600 dark:text-purple-400">
                          目标配置: {data.target.toFixed(1)}%
                        </p>
                        <p className={`${
                          data.deviation >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                        }`}>
                          偏离: {data.deviation > 0 ? '+' : ''}{data.deviation.toFixed(1)}%
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Bar 
                dataKey="current" 
                fill="#60A5FA" 
                name="当前配置"
                radius={[2, 2, 0, 0]}
                className="drop-shadow-sm"
              />
              <Bar 
                dataKey="target" 
                fill="#8B5CF6" 
                name="目标配置"
                radius={[2, 2, 0, 0]}
                className="drop-shadow-sm"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* 偏离度指示器 */}
        <div className="mt-4 space-y-2">
          {currentData.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {item.category}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {item.current.toFixed(1)}% / {item.target.toFixed(1)}%
                </span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  Math.abs(item.deviation) <= 2 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : Math.abs(item.deviation) <= 5
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                }`}>
                  {item.deviation > 0 ? '+' : ''}{item.deviation.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}