'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, 
  Upload, 
  RefreshCw, 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  CheckCircle,
  Target,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Settings,
  PieChart
} from 'lucide-react';
import { 
  getExchangeRates, 
  refreshExchangeRates, 
  formatExchangeRate,
  type ExchangeRates 
} from '@/lib/exchange-rate-service';

interface SidebarProps {
  onAddRecord: () => void;
  onImportData: () => void;
  onSyncData: () => void;
  onSettings: () => void;
  onEditTargets?: () => void;  // 新增：编辑配置目标
  isSyncing?: boolean;
  lastSyncTime?: string;
  allocationHealth?: AllocationHealthData;
  alerts?: AlertItem[];
}

interface AllocationHealthData {
  score: number; // 0-100
  deviations: {
    category: string;
    current: number;
    target: number;
    deviation: number;
  }[];
}

interface AlertItem {
  id: string;
  type: 'error' | 'warning' | 'success' | 'info';
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}

/**
 * 侧边栏组件
 * 包含：快速操作、实时监控、智能提醒
 */
export function Sidebar({
  onAddRecord,
  onImportData,
  onSyncData,
  onSettings,
  onEditTargets,
  isSyncing = false,
  lastSyncTime,
  allocationHealth,
  alerts = []
}: SidebarProps) {
  return (
    <div className="p-4 space-y-4">
      {/* 快速操作 */}
      <QuickActionsPanel 
        onAddRecord={onAddRecord}
        onImportData={onImportData}
        onSyncData={onSyncData}
        onSettings={onSettings}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
      />
      
      {/* 实时监控 */}
      <LiveMonitorPanel allocationHealth={allocationHealth} />
      
      {/* 智能提醒 */}
      <AlertsPanel alerts={alerts} />
    </div>
  );
}

/**
 * 快速操作面板
 */
function QuickActionsPanel({
  onAddRecord,
  onImportData,
  onSyncData,
  onSettings,
  onEditTargets,
  isSyncing,
  lastSyncTime
}: {
  onAddRecord: () => void;
  onImportData: () => void;
  onSyncData: () => void;
  onSettings: () => void;
  onEditTargets?: () => void;
  isSyncing?: boolean;
  lastSyncTime?: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>快速操作</span>
          {lastSyncTime && (
            <span className="text-xs text-muted-foreground font-normal">
              {lastSyncTime}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* 主要操作 - 网格布局 */}
        <div className="grid grid-cols-3 gap-2">
          <QuickActionButton 
            icon={Plus} 
            label="添加" 
            onClick={onAddRecord}
            color="blue"
          />
          <QuickActionButton 
            icon={Upload} 
            label="导入" 
            onClick={onImportData}
            color="green"
          />
          <QuickActionButton 
            icon={RefreshCw} 
            label="同步" 
            onClick={onSyncData}
            color="purple"
            loading={isSyncing}
          />
        </div>
        
        <Separator className="my-3" />
        
        {/* 次要操作 */}
        <div className="grid grid-cols-2 gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 text-xs w-full bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 border-purple-200"
            onClick={onEditTargets}
          >
            <PieChart className="h-3.5 w-3.5 mr-1.5 text-purple-600" />
            <span className="text-purple-700">配置目标</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 text-xs"
            onClick={onSettings}
          >
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            设置
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 快速操作按钮
 */
function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  color = 'blue',
  loading = false
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  color?: 'blue' | 'green' | 'purple' | 'orange';
  loading?: boolean;
}) {
  const colorClasses = {
    blue: 'bg-blue-500 hover:bg-blue-600',
    green: 'bg-green-500 hover:bg-green-600',
    purple: 'bg-purple-500 hover:bg-purple-600',
    orange: 'bg-orange-500 hover:bg-orange-600',
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`
        flex flex-col items-center justify-center p-3 rounded-lg
        ${colorClasses[color]} text-white
        transition-all duration-200 hover:scale-105 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
    >
      <Icon className={`h-5 w-5 mb-1 ${loading ? 'animate-spin' : ''}`} />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

/**
 * 实时监控面板
 */
function LiveMonitorPanel({ 
  allocationHealth 
}: { 
  allocationHealth?: AllocationHealthData;
}) {
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // 加载汇率
  const loadRates = async () => {
    try {
      setIsLoading(true);
      const data = await getExchangeRates();
      setRates(data);
      setLastRefreshTime(new Date());
    } catch (err) {
      console.error('加载汇率失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 手动刷新汇率
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const data = await refreshExchangeRates();
      setRates(data);
      setLastRefreshTime(new Date());
    } catch (err) {
      console.error('刷新汇率失败:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  // 格式化更新时间
  const formatUpdateTime = (date: Date | null) => {
    if (!date) return '未知';
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    return date.toLocaleString('zh-CN');
  };

  // 默认配置健康度数据
  const healthData = allocationHealth || {
    score: 85,
    deviations: [
      { category: 'A股', current: 36, target: 38, deviation: -2 },
      { category: '美股', current: 28, target: 32, deviation: -4 },
      { category: '港股', current: 20, target: 18, deviation: 2 },
    ]
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            实时监控
          </span>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="rounded-md p-1 hover:bg-accent disabled:opacity-50"
            title="刷新汇率"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 汇率区域 */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>汇率</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatUpdateTime(lastRefreshTime)}
            </span>
          </div>
          
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-8 w-full animate-pulse rounded bg-muted" />
              <div className="h-8 w-full animate-pulse rounded bg-muted" />
            </div>
          ) : rates ? (
            <div className="space-y-2">
              <ExchangeRateRow 
                pair="USD/CNY" 
                rate={rates.rates.USD} 
                label="美元"
              />
              <ExchangeRateRow 
                pair="HKD/CNY" 
                rate={rates.rates.HKD} 
                label="港币"
              />
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-2">
              加载失败
            </div>
          )}
        </div>

        <Separator />

        {/* 配置健康度 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">配置健康度</span>
            <Badge 
              variant={healthData.score >= 80 ? 'default' : healthData.score >= 60 ? 'secondary' : 'destructive'}
              className="text-xs"
            >
              {healthData.score}%
            </Badge>
          </div>
          
          {/* 健康度进度条 */}
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                healthData.score >= 80 ? 'bg-green-500' : 
                healthData.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${healthData.score}%` }}
            />
          </div>

          {/* 偏离度列表 */}
          <div className="space-y-1.5">
            {healthData.deviations.map((item) => (
              <div 
                key={item.category}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-muted-foreground">{item.category}</span>
                <span className={`flex items-center gap-1 font-medium ${
                  Math.abs(item.deviation) <= 2 ? 'text-green-600' :
                  Math.abs(item.deviation) <= 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {item.deviation > 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {item.deviation > 0 ? '+' : ''}{item.deviation.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 汇率行组件
 */
function ExchangeRateRow({
  pair,
  rate,
  label
}: {
  pair: string;
  rate: number;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md bg-muted/50 p-2">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{pair}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="font-mono font-semibold text-sm">
        {formatExchangeRate(rate)}
      </span>
    </div>
  );
}

/**
 * 智能提醒面板
 */
function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  // 默认提醒数据
  const defaultAlerts: AlertItem[] = [
    {
      id: '1',
      type: 'warning',
      title: '美股配置偏低',
      description: '当前28%，目标32%，建议增持4%',
      action: '查看建议'
    },
    {
      id: '2',
      type: 'info',
      title: '定期再平衡提醒',
      description: '距离上次再平衡已过30天',
      action: '立即执行'
    },
    {
      id: '3',
      type: 'success',
      title: '港股配置正常',
      description: '当前20%，目标18%，偏离+2%',
    }
  ];

  const displayAlerts = alerts.length > 0 ? alerts : defaultAlerts;
  const alertCount = displayAlerts.filter(a => a.type !== 'success').length;

  const getAlertIcon = (type: AlertItem['type']) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAlertBgColor = (type: AlertItem['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900';
      case 'success':
        return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900';
      default:
        return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900';
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          智能提醒
          {alertCount > 0 && (
            <Badge variant="destructive" className="text-xs h-5 px-1.5">
              {alertCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-2.5 rounded-lg border ${getAlertBgColor(alert.type)}`}
          >
            <div className="flex items-start gap-2">
              {getAlertIcon(alert.type)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  {alert.title}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {alert.description}
                </p>
                {alert.action && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 mt-1 text-xs"
                    onClick={alert.onAction}
                  >
                    {alert.action} →
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
