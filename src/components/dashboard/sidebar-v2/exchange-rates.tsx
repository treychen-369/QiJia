'use client';

/**
 * 汇率监控面板
 * 显示主要货币汇率
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, 
  RefreshCw,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { 
  getExchangeRates, 
  refreshExchangeRates, 
  formatExchangeRate,
  type ExchangeRates 
} from '@/lib/exchange-rate-service';

// 货币配置
const CURRENCY_CONFIG = [
  { code: 'USD', name: '美元', flag: '🇺🇸' },
  { code: 'HKD', name: '港币', flag: '🇭🇰' },
  { code: 'JPY', name: '日元', flag: '🇯🇵' },
];

// 骨架屏
function ExchangeRatesSkeleton() {
  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-2 px-0 pt-0">
        <Skeleton className="h-4 w-20" />
      </CardHeader>
      <CardContent className="px-0 pb-0 space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

export function ExchangeRatesPanel() {
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 加载汇率
  const loadRates = async () => {
    try {
      setIsLoading(true);
      const data = await getExchangeRates();
      setRates(data);
    } catch (error) {
      console.error('加载汇率失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 刷新汇率
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const data = await refreshExchangeRates();
      setRates(data);
    } catch (error) {
      console.error('刷新汇率失败:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  if (isLoading) {
    return <ExchangeRatesSkeleton />;
  }

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-2 px-0 pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              汇率监控
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="space-y-1">
          {CURRENCY_CONFIG.map((currency) => {
            const rate = rates?.rates?.[currency.code];
            return (
              <div 
                key={currency.code}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{currency.flag}</span>
                  <span className="text-sm text-muted-foreground">{currency.code}/CNY</span>
                </div>
                <span className="text-sm font-medium">
                  {rate ? formatExchangeRate(rate) : '-'}
                </span>
              </div>
            );
          })}
        </div>
        {rates?.lastUpdated && (
          <p className="text-xs text-muted-foreground text-right mt-2">
            更新于 {new Date(rates.lastUpdated).toLocaleTimeString('zh-CN', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
