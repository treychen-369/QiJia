'use client';

import { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
  header?: ReactNode;
}

/**
 * 三区布局容器
 * - 左主区域 (70%): 核心指标、图表、资产列表
 * - 右侧边栏 (30%): 快速操作、实时监控、智能提醒
 * - 响应式设计: 移动端隐藏侧边栏，改为底部Sheet
 */
export function DashboardLayout({ children, sidebar, header }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950">
      {/* 顶部导航 */}
      {header}
      
      {/* 主内容区 */}
      <div className="flex-1 flex">
        {/* 左主区域 - 可滚动 */}
        <main className="flex-1 lg:w-[70%] overflow-auto">
          {/* pb-20 为移动端底部栏留出空间，lg 断点及以上恢复正常 */}
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-6">
            {children}
          </div>
        </main>
        
        {/* 右侧边栏 - 桌面端常驻 */}
        {sidebar && (
          <aside className="hidden lg:block w-[30%] max-w-sm border-l border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-auto">
              {sidebar}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/**
 * Dashboard 内容区域间距组件
 */
export function DashboardSection({ 
  children, 
  className = '' 
}: { 
  children: ReactNode; 
  className?: string;
}) {
  return (
    <section className={`space-y-6 ${className}`}>
      {children}
    </section>
  );
}
