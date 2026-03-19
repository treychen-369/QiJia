'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Upload, 
  Download, 
  RefreshCw, 
  Settings, 
  Calculator,
  Bell,
  Target,
  TrendingUp,
  FileText,
  Zap
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  gradient: string;
  bgGradient: string;
  onClick: () => void;
  badge?: string;
  disabled?: boolean;
}

interface QuickActionsProps {
  onAddRecord: () => void;
  onImportData: () => void;
  onExportData: () => void;
  onSyncData: () => void;
  onSettings: () => void;
  isSyncing?: boolean;
  lastSyncTime?: string;
}

export function QuickActions({
  onAddRecord,
  onImportData,
  onExportData,
  onSyncData,
  onSettings,
  isSyncing = false,
  lastSyncTime
}: QuickActionsProps) {
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  const primaryActions: QuickAction[] = [
    {
      id: 'add-record',
      title: '添加记录',
      description: '手动添加交易或持仓记录',
      icon: Plus,
      color: 'blue',
      gradient: 'from-blue-500 to-blue-600',
      bgGradient: 'from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900',
      onClick: onAddRecord,
    },
    {
      id: 'import-data',
      title: '导入数据',
      description: '从Excel或CSV文件导入财务数据',
      icon: Upload,
      color: 'green',
      gradient: 'from-green-500 to-green-600',
      bgGradient: 'from-green-50 to-green-100 dark:from-green-950 dark:to-green-900',
      onClick: onImportData,
    },
    {
      id: 'sync-data',
      title: '同步数据',
      description: '从证券软件同步最新持仓数据',
      icon: RefreshCw,
      color: 'purple',
      gradient: 'from-purple-500 to-purple-600',
      bgGradient: 'from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900',
      onClick: onSyncData,
      badge: lastSyncTime ? `上次: ${lastSyncTime}` : undefined,
      disabled: isSyncing,
    },
  ];

  const secondaryActions: QuickAction[] = [
    {
      id: 'export-data',
      title: '导出数据',
      description: '导出为Excel格式备份',
      icon: Download,
      color: 'slate',
      gradient: 'from-slate-500 to-slate-600',
      bgGradient: 'from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700',
      onClick: onExportData,
    },
    {
      id: 'calculator',
      title: '投资计算器',
      description: '计算收益率和风险指标',
      icon: Calculator,
      color: 'teal',
      gradient: 'from-teal-500 to-teal-600',
      bgGradient: 'from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900',
      onClick: () => console.log('Calculator clicked'),
    },
    {
      id: 'alerts',
      title: '价格提醒',
      description: '设置股价涨跌提醒',
      icon: Bell,
      color: 'yellow',
      gradient: 'from-yellow-500 to-yellow-600',
      bgGradient: 'from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900',
      onClick: () => console.log('Alerts clicked'),
      badge: 'NEW',
    },
    {
      id: 'rebalance',
      title: '资产再平衡',
      description: '分析并调整投资组合配置',
      icon: Target,
      color: 'indigo',
      gradient: 'from-indigo-500 to-indigo-600',
      bgGradient: 'from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900',
      onClick: () => console.log('Rebalance clicked'),
    },
    {
      id: 'performance',
      title: '业绩分析',
      description: '查看投资业绩和基准对比',
      icon: TrendingUp,
      color: 'pink',
      gradient: 'from-pink-500 to-pink-600',
      bgGradient: 'from-pink-50 to-pink-100 dark:from-pink-950 dark:to-pink-900',
      onClick: () => console.log('Performance clicked'),
    },
    {
      id: 'tax-report',
      title: '税务报告',
      description: '生成投资税务相关报告',
      icon: FileText,
      color: 'cyan',
      gradient: 'from-cyan-500 to-cyan-600',
      bgGradient: 'from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900',
      onClick: () => console.log('Tax report clicked'),
    },
    {
      id: 'settings',
      title: '系统设置',
      description: '配置账户和同步设置',
      icon: Settings,
      color: 'gray',
      gradient: 'from-gray-500 to-gray-600',
      bgGradient: 'from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700',
      onClick: onSettings,
    },
  ];

  const renderActionCard = (action: QuickAction, isPrimary: boolean = false) => {
    const Icon = action.icon;
    const isHovered = hoveredAction === action.id;
    
    return (
      <Card
        key={action.id}
        className={`bg-gradient-to-br ${action.bgGradient} border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group ${
          isPrimary ? 'hover:scale-105' : 'hover:scale-102'
        } ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onMouseEnter={() => !action.disabled && setHoveredAction(action.id)}
        onMouseLeave={() => setHoveredAction(null)}
        onClick={() => !action.disabled && action.onClick()}
      >
        <CardContent className={`p-${isPrimary ? '6' : '4'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-${isPrimary ? '3' : '2'} bg-gradient-to-r ${action.gradient} rounded-lg shadow-lg ${
                  isHovered ? 'scale-110' : ''
                } transition-transform duration-200`}>
                  <Icon className={`h-${isPrimary ? '6' : '4'} w-${isPrimary ? '6' : '4'} text-white`} />
                </div>
                {action.badge && (
                  <Badge 
                    variant={action.badge === 'NEW' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {action.badge}
                  </Badge>
                )}
              </div>
              
              <h3 className={`font-semibold text-slate-800 dark:text-slate-200 mb-1 ${
                isPrimary ? 'text-lg' : 'text-base'
              }`}>
                {action.title}
              </h3>
              
              <p className={`text-slate-600 dark:text-slate-400 ${
                isPrimary ? 'text-sm' : 'text-xs'
              }`}>
                {action.description}
              </p>
            </div>
            
            {action.id === 'sync-data' && isSyncing && (
              <div className="ml-2">
                <Zap className="h-4 w-4 text-purple-500 animate-pulse" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* 主要操作 */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
          快速操作
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {primaryActions.map(action => renderActionCard(action, true))}
        </div>
      </div>

      {/* 更多功能 */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
          更多功能
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {secondaryActions.map(action => renderActionCard(action, false))}
        </div>
      </div>

      {/* 快捷键提示 */}
      <Card className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-0 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-1">
                快捷键提示
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                使用键盘快捷键提高操作效率
              </p>
            </div>
            <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">Ctrl</kbd>
                <span>+</span>
                <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">N</kbd>
                <span>添加记录</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">Ctrl</kbd>
                <span>+</span>
                <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">I</kbd>
                <span>导入数据</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">F5</kbd>
                <span>同步数据</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}