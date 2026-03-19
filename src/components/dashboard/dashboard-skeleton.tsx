'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Hero Section 骨架屏
 */
export function HeroSectionSkeleton() {
  return (
    <Card className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 border-0 shadow-xl overflow-hidden">
      <CardContent className="p-6">
        {/* 标题骨架 */}
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-24 bg-slate-300 dark:bg-slate-600 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-8 bg-slate-300 dark:bg-slate-600 rounded animate-pulse" />
            <div className="h-8 w-8 bg-slate-300 dark:bg-slate-600 rounded animate-pulse" />
          </div>
        </div>

        {/* 主指标骨架 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={i === 0 ? 'col-span-2 lg:col-span-1' : ''}>
              <div className="h-4 w-16 bg-slate-300 dark:bg-slate-600 rounded animate-pulse mb-2" />
              <div className="h-8 w-32 bg-slate-300 dark:bg-slate-600 rounded animate-pulse mb-2" />
              <div className="h-3 w-20 bg-slate-300 dark:bg-slate-600 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* 资产构成条骨架 */}
        <div className="mt-6 pt-4 border-t border-slate-300 dark:border-slate-600">
          <div className="h-3 w-full bg-slate-300 dark:bg-slate-600 rounded-full animate-pulse" />
          <div className="flex justify-between mt-3">
            <div className="h-4 w-32 bg-slate-300 dark:bg-slate-600 rounded animate-pulse" />
            <div className="h-4 w-32 bg-slate-300 dark:bg-slate-600 rounded animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 图表骨架屏
 */
export function ChartSkeleton() {
  return (
    <Card className="shadow-xl">
      <CardHeader>
        <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse flex items-center justify-center">
          <div className="w-32 h-32 rounded-full border-8 border-slate-200 dark:border-slate-700" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 侧边栏骨架屏
 */
export function SidebarSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* 快速操作骨架 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 实时监控骨架 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>

      {/* 智能提醒骨架 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 资产列表骨架屏
 */
export function AssetsListSkeleton() {
  return (
    <Card className="shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
      </CardHeader>
      <CardContent>
        {/* Tab 骨架 */}
        <div className="flex gap-2 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          ))}
        </div>
        
        {/* 列表项骨架 */}
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
                  <div className="h-4 w-48 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                </div>
                <div className="text-right">
                  <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
                  <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 完整 Dashboard 骨架屏
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <HeroSectionSkeleton />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <AssetsListSkeleton />
    </div>
  );
}
