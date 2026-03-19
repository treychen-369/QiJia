'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Wallet, 
  PiggyBank, 
  Target,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { getPnLColorClass } from '@/lib/user-preferences';

interface AssetData {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  cashBalance: number;
  investedAmount: number;
  todayChange: number;
  todayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
}

interface AccountCash {
  id: string;
  name: string;
  broker: string;
  currency: string;
  cashBalance: number;
  cashBalanceOriginal: number;
}

interface AssetOverviewProps {
  data: AssetData;
  accounts?: AccountCash[]; // 账户现金详情
  isLoading?: boolean;
  onRefresh?: () => void;
}

interface CardData {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  gradient: string;
  bgGradient: string;
  description: string;
}

export function AssetOverview({ data, accounts = [], isLoading = false, onRefresh }: AssetOverviewProps) {
  const preferences = useUserPreferences(); // 获取用户偏好
  const [isVisible, setIsVisible] = useState(true);
  const [showCashDetail, setShowCashDetail] = useState(false); // 控制现金详情展开
  const [animatedValues, setAnimatedValues] = useState({
    totalAssets: 0,
    netWorth: 0,
    todayChange: 0,
    totalReturn: 0,
  });

  // 数字动画效果
  useEffect(() => {
    const duration = 1000; // 1秒动画
    const steps = 60; // 60帧
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      setAnimatedValues({
        totalAssets: data.totalAssets * easeOutQuart,
        netWorth: data.netWorth * easeOutQuart,
        todayChange: data.todayChange * easeOutQuart,
        totalReturn: data.totalReturn * easeOutQuart,
      });
      
      if (currentStep >= steps) {
        clearInterval(timer);
        setAnimatedValues({
          totalAssets: data.totalAssets,
          netWorth: data.netWorth,
          todayChange: data.todayChange,
          totalReturn: data.totalReturn,
        });
      }
    }, stepDuration);
    
    return () => clearInterval(timer);
  }, [data]);

  const formatCurrency = (amount: number, currency: string = 'CNY') => {
    if (!isVisible) return '****';
    const symbol = currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : '¥';
    return `${symbol}${amount.toLocaleString('zh-CN', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2 
    })}`;
  };

  const formatPercent = (percent: number) => {
    if (!isVisible) return '**%';
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  const cards: CardData[] = [
    {
      title: '总资产',
      value: animatedValues.totalAssets,
      icon: DollarSign,
      color: 'blue',
      gradient: 'from-blue-500 to-blue-600',
      bgGradient: 'from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900',
      description: '持仓 + 现金 + 其他'
    },
    {
      title: '净资产',
      value: animatedValues.netWorth,
      icon: Wallet,
      color: 'green',
      gradient: 'from-green-500 to-green-600',
      bgGradient: 'from-green-50 to-green-100 dark:from-green-950 dark:to-green-900',
      description: '总资产 - 负债(0)'
    },
    {
      title: '现金余额',
      value: data.cashBalance,
      icon: PiggyBank,
      color: 'purple',
      gradient: 'from-purple-500 to-purple-600',
      bgGradient: 'from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900',
      description: '所有账户现金总和'
    },
    {
      title: '持仓金额',
      value: data.investedAmount,
      icon: Target,
      color: 'orange',
      gradient: 'from-orange-500 to-orange-600',
      bgGradient: 'from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900',
      description: '所有账户股票持仓总和'
    },
  ];

  return (
    <div className="space-y-6">
      {/* 控制栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
          资产概览
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsVisible(!isVisible)}
            className="h-9"
          >
            {isVisible ? (
              <Eye className="h-4 w-4 mr-2" />
            ) : (
              <EyeOff className="h-4 w-4 mr-2" />
            )}
            {isVisible ? '隐藏' : '显示'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-9"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* 主要资产卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, index) => {
          const Icon = card.icon;
          const isCashCard = card.title === '现金余额';
          
          return (
            <Card 
              key={card.title}
              className={`bg-gradient-to-br ${card.bgGradient} border-0 shadow-xl hover:shadow-2xl transition-all duration-300 ${isCashCard ? 'cursor-pointer' : 'hover:scale-105'}`}
              style={{
                animationDelay: `${index * 100}ms`,
                animation: 'fadeInUp 0.6s ease-out forwards',
              }}
              onClick={() => isCashCard && accounts.length > 0 && setShowCashDetail(!showCashDetail)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    {card.title}
                    {isCashCard && accounts.length > 0 && (
                      <span className="ml-1 text-xs text-slate-500">
                        ({accounts.length}个账户)
                      </span>
                    )}
                  </span>
                  <div className={`p-2 bg-gradient-to-r ${card.gradient} rounded-lg shadow-lg`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(card.value)}
                    </p>
                    {isCashCard && accounts.length > 0 && (
                      showCashDetail ? (
                        <ChevronUp className="h-5 w-5 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-500" />
                      )
                    )}
                  </div>
                  {card.title === '总资产' && (
                    <div className="flex items-center gap-1">
                      {data.todayChangePercent >= 0 ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <span className={`text-xs font-medium ${
                        data.todayChangePercent >= 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        今日 {formatPercent(data.todayChangePercent)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 现金详情展开区域 */}
      {showCashDetail && accounts.length > 0 && (
        <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 border-purple-200 dark:border-purple-800 shadow-xl">
          <CardHeader>
            <CardTitle className="text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              证券账户可用现金明细
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.filter(acc => Number(acc.cashBalanceOriginal) > 0).map((account) => (
                <div
                  key={account.id}
                  className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-purple-200 dark:border-purple-700 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                        {account.broker}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {account.name}
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs rounded-full">
                      {account.currency}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                      {formatCurrency(Number(account.cashBalanceOriginal), account.currency)}
                    </p>
                    {account.currency !== 'CNY' && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        ≈ {formatCurrency(Number(account.cashBalance), 'CNY')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 收益概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 今日收益 */}
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-0 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <div className={`p-2 rounded-lg ${
                data.todayChangePercent >= 0 
                  ? preferences.colorScheme === 'red-green' 
                    ? 'bg-red-100 dark:bg-red-900' 
                    : 'bg-green-100 dark:bg-green-900'
                  : preferences.colorScheme === 'red-green'
                    ? 'bg-green-100 dark:bg-green-900'
                    : 'bg-red-100 dark:bg-red-900'
              }`}>
                {data.todayChangePercent >= 0 ? (
                  <TrendingUp className={`h-4 w-4 ${getPnLColorClass(1, preferences.colorScheme)}`} />
                ) : (
                  <TrendingDown className={`h-4 w-4 ${getPnLColorClass(-1, preferences.colorScheme)}`} />
                )}
              </div>
              今日收益
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className={`text-3xl font-bold ${getPnLColorClass(data.todayChangePercent, preferences.colorScheme)}`}>
                {formatCurrency(animatedValues.todayChange)}
              </p>
              <p className={`text-lg font-semibold ${getPnLColorClass(data.todayChangePercent, preferences.colorScheme)}`}>
                {formatPercent(data.todayChangePercent)}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                相比昨日收盘
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 总收益 */}
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-0 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <div className={`p-2 rounded-lg ${
                data.totalReturnPercent >= 0 
                  ? 'bg-blue-100 dark:bg-blue-900' 
                  : 'bg-red-100 dark:bg-red-900'
              }`}>
                {data.totalReturnPercent >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                )}
              </div>
              累计收益
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className={`text-3xl font-bold ${getPnLColorClass(data.totalReturnPercent, preferences.colorScheme)}`}>
                {formatCurrency(animatedValues.totalReturn)}
              </p>
              <p className={`text-lg font-semibold ${getPnLColorClass(data.totalReturnPercent, preferences.colorScheme)}`}>
                {formatPercent(data.totalReturnPercent)}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                总投资回报率
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 添加CSS动画
const styles = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// 将样式注入到页面
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}