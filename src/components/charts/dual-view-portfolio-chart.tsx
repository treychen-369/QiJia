'use client';

import { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrendingUp } from 'lucide-react';

// ==================== 类型定义 ====================

// 一级资产分类（底层敞口）
interface OverviewGroupItem {
  code: string;
  name: string;
  value: number;
  percentage: number;
  color: string;
  count: number;
}

// 二级分类项（通用）
interface SubCategoryItem {
  code: string;
  name: string;
  value: number;
  percentage: number;
  color: string;
  count?: number;
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

// 组件Props
interface DualViewPortfolioChartProps {
  data: {
    byOverviewGroup: OverviewGroupItem[];
    equityByRegion?: EquityByRegion;
    groupsSubCategories?: Record<string, GroupSubCategories>;
  };
  totalValue: number;
}

// ==================== 视图选项配置 ====================

// 视图类型：概览（一级分类）或某个分组的二级分类
type ViewType = 'overview' | 'EQUITY' | 'CASH' | 'FIXED_INCOME' | 'REAL_ESTATE' | 'ALTERNATIVE' | 'RECEIVABLE';

// 视图选项配置
const VIEW_OPTIONS: Array<{
  value: ViewType;
  label: string;
  color: string;
  description: string;
}> = [
  { value: 'overview', label: '资产总览', color: '#3B82F6', description: '按资产底层类型' },
  { value: 'EQUITY', label: '权益类细分', color: '#3B82F6', description: '按投资地区' },
  { value: 'CASH', label: '现金类细分', color: '#10B981', description: '按存放类型' },
  { value: 'FIXED_INCOME', label: '固收类细分', color: '#F59E0B', description: '按产品类型' },
  { value: 'REAL_ESTATE', label: '不动产细分', color: '#EC4899', description: '按资产类型' },
  { value: 'ALTERNATIVE', label: '另类投资细分', color: '#8B5CF6', description: '按投资类型' },
  { value: 'RECEIVABLE', label: '应收款细分', color: '#0EA5E9', description: '按应收类型' },
];

// ==================== 主组件 ====================

export function DualViewPortfolioChart({ data, totalValue }: DualViewPortfolioChartProps) {
  const [viewType, setViewType] = useState<ViewType>('overview');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // 根据选择的视图获取图表数据
  const chartData = useMemo(() => {
    if (viewType === 'overview') {
      // 一级分类：底层敞口概览
      return data.byOverviewGroup.map(item => ({
        code: item.code,
        name: item.name,
        value: item.value,
        percentage: item.percentage,
        color: item.color,
        count: item.count,
      }));
    }

    if (viewType === 'EQUITY') {
      // 权益类：按地区细分
      if (!data.equityByRegion?.byRegion?.length) {
        return [];
      }
      return data.equityByRegion.byRegion.map(item => ({
        code: item.regionCode,
        name: item.regionName,
        value: item.value,
        percentage: item.percentage,
        color: item.color,
        count: item.count,
      }));
    }

    // 其他分组：使用 groupsSubCategories
    const groupData = data.groupsSubCategories?.[viewType];
    if (!groupData?.bySubCategory?.length) {
      return [];
    }
    return groupData.bySubCategory.map(item => ({
      code: item.categoryCode,
      name: item.categoryName,
      value: item.value,
      percentage: item.percentage,
      color: item.color,
      count: item.count,
    }));
  }, [viewType, data]);

  // 计算当前视图的总值
  const currentTotal = useMemo(() => {
    if (viewType === 'overview') {
      return totalValue;
    }
    if (viewType === 'EQUITY') {
      return data.equityByRegion?.total || 0;
    }
    return data.groupsSubCategories?.[viewType]?.total || 0;
  }, [viewType, totalValue, data]);

  // 获取当前视图配置
  const currentViewConfig = VIEW_OPTIONS.find(opt => opt.value === viewType) || VIEW_OPTIONS[0];

  // 过滤可用的视图选项（只显示有数据的选项）
  const availableOptions = useMemo(() => {
    return VIEW_OPTIONS.filter(opt => {
      if (opt.value === 'overview') return true;
      if (opt.value === 'EQUITY') {
        return data.equityByRegion?.byRegion?.length && data.equityByRegion.byRegion.length > 0;
      }
      const groupData = data.groupsSubCategories?.[opt.value];
      return groupData?.bySubCategory?.length && groupData.bySubCategory.length > 0;
    });
  }, [data]);

  const onPieEnter = (_: unknown, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
  };

  // 自定义标签渲染
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  }) => {
    if (percent < 0.05) return null; // 小于5%不显示标签
    
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
        className="text-sm font-bold drop-shadow-lg"
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: SubCategoryItem }> }) => {
    if (!active || !payload || !payload.length) return null;

    const item = payload[0]?.payload;
    if (!item) return null;

    return (
      <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 text-xs">
        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-1">
          {item.name}
        </p>
        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
          ¥{(item.value / 10000).toFixed(1)}万
        </p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
          占比 {item.percentage.toFixed(1)}%
        </p>
        {item.count !== undefined && item.count > 0 && (
          <p className="text-[10px] text-slate-400 mt-1">
            {item.count} 项资产
          </p>
        )}
      </div>
    );
  };

  // 无数据状态
  if (!chartData.length) {
    return (
      <Card className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 border-0 shadow-xl">
        <CardHeader className="pb-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200 text-base sm:text-lg">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span>投资组合分布</span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-slate-500">
            暂无数据
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 border-0 shadow-xl">
      <CardHeader className="pb-2 space-y-2">
        {/* 第一行：标题和下拉选择 */}
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200 text-base sm:text-lg">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span>投资组合分布</span>
          </CardTitle>

          {/* 视图下拉选择 */}
          <Select value={viewType} onValueChange={(v) => setViewType(v as ViewType)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="选择视图" />
            </SelectTrigger>
            <SelectContent>
              {availableOptions.map((option) => (
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
        </div>

        {/* 总资产/分类资产显示 */}
        <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
            {viewType === 'overview' ? '全部资产总值' : `${currentViewConfig.label} · ${currentViewConfig.description}`}
          </p>
          <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-200">
            ¥{(currentTotal / 10000).toFixed(1)}万
          </p>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* 饼图 */}
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={90}
                innerRadius={45}
                fill="#8884d8"
                dataKey="value"
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
                paddingAngle={2}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke={activeIndex === index ? '#ffffff' : 'none'}
                    strokeWidth={activeIndex === index ? 2 : 0}
                    style={{
                      filter: activeIndex === index ? 'brightness(1.1)' : 'brightness(1)',
                      transform: activeIndex === index ? 'scale(1.03)' : 'scale(1)',
                      transformOrigin: 'center',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 图例列表 */}
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            {viewType === 'overview' ? '资产类型明细' : `${currentViewConfig.label}明细`}
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {chartData.map((item, index) => (
              <div
                key={item.code || index}
                className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                  activeIndex === index
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {item.name}
                    </p>
                    {item.count !== undefined && item.count > 0 && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {item.count} 项资产
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    ¥{(item.value / 10000).toFixed(1)}万
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {item.percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
