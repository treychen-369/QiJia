'use client';

import { Card, CardContent } from '@/components/ui/card';

// 导入融合组件
import { AssetPanorama } from '@/components/charts/asset-panorama';

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

interface ChartsGridProps {
  portfolioData: {
    byOverviewGroup: OverviewGroupItem[];
    equityByRegion?: EquityByRegion;
    groupsSubCategories?: Record<string, GroupSubCategories>;
  };
  totalValue: number;
  className?: string;
  historyApiUrl?: string;
}

/**
 * 图表网格组件
 * 使用融合的 AssetPanorama 组件展示趋势和分布
 */
export function ChartsGrid({ portfolioData, totalValue, className = '', historyApiUrl }: ChartsGridProps) {
  return (
    <div className={className}>
      {/* 资产全景：融合趋势图和资产分布 */}
      <AssetPanorama 
        portfolioData={portfolioData}
        totalValue={totalValue}
        defaultRange="30d"
        historyApiUrl={historyApiUrl}
      />
    </div>
  );
}

/**
 * 图表统计摘要卡片
 * 显示关键统计数据的小卡片
 */
interface StatsSummaryProps {
  stats: {
    label: string;
    value: string | number;
    change?: number;
    icon: React.ComponentType<{ className?: string }>;
  }[];
  className?: string;
}

export function StatsSummaryCards({ stats, className = '' }: StatsSummaryProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold">{stat.value}</p>
                  {stat.change !== undefined && (
                    <p className={`text-xs ${stat.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.change >= 0 ? '+' : ''}{stat.change.toFixed(2)}%
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
