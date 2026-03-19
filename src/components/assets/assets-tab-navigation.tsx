'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { TrendingUp, Wallet, PieChart, Home, Coins, Receipt, CreditCard } from 'lucide-react';
import { HoldingsList } from '@/components/dashboard/holdings-list';
import { CashAssetsList } from '@/components/assets/cash-assets-list';
import { FixedIncomeList } from '@/components/assets/fixed-income-list';
import { RealEstateList } from '@/components/assets/real-estate-list';
import { AlternativeList } from '@/components/assets/alternative-list';
import { ReceivablesList } from '@/components/assets/receivables-list';
import { LiabilitiesList } from '@/components/liabilities/liabilities-list';

interface Holding {
  id: string;
  type?: 'holding' | 'cash';
  symbol: string;
  name: string;
  accountName?: string;
  broker?: string;
  marketValueOriginal?: number;
  quantity: number;
  currentPrice: number;
  costBasis: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  sector: string;
  region: string;
  currency: string;
  lastUpdated: string;
}

interface Asset {
  id: string;
  name: string;
  description: string | null;
  assetCategory: {
    id: string;
    name: string;
    code: string | null;
    parent: {
      id: string;
      name: string;
      code: string | null;
    } | null;
  };
  quantity: number;
  unitPrice: number;
  purchasePrice: number;
  currentValue: number;
  originalValue: number | null;
  currency: string;
  unrealizedPnl: number | null;
  unrealizedPnlPercent: number | null;
  purchaseDate: string | null;
  maturityDate: string | null;
  metadata: any;
  lastUpdated: string;
  createdAt: string;
  underlyingType?: string | null;
}

interface LiabilityDetail {
  id: string;
  name: string;
  type: string;
  description?: string;
  principalAmount: number;
  currentBalance: number;
  interestRate?: number;
  monthlyPayment?: number;
  currency: string;
  startDate?: string;
  maturityDate?: string;
  nextPaymentDate?: string;
  metadata?: any;
  isActive: boolean;
  lastUpdated: string;
  createdAt: string;
  currentBalanceCny: number;
  monthlyPaymentCny: number;
  exchangeRate: number;
  remainingMonths?: number;
  totalInterest?: number;
}

interface AssetsTabNavigationProps {
  holdings: Holding[];
  assets?: Asset[];
  liabilities?: LiabilityDetail[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onAddHolding?: () => void;
  onManageAccounts?: () => void;
  defaultTab?: string; // ✅ 新增：默认激活的Tab
  onTabChange?: (tab: string) => void; // ✅ 新增：Tab变化回调
}

export function AssetsTabNavigation({ 
  holdings, 
  assets = [],
  liabilities = [],
  isLoading = false, 
  onRefresh,
  onAddHolding,
  onManageAccounts,
  defaultTab = 'securities', // ✅ 默认值
  onTabChange
}: AssetsTabNavigationProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  // ✅ 当 defaultTab 变化时同步更新
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // ✅ Tab变化时通知父组件
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  // 按资产类型分组
  const cashAssets = assets.filter(asset => {
    const parentCode = asset.assetCategory.parent?.code;
    return parentCode === 'CASH';
  });

  const fixedIncomeAssets = assets.filter(asset => {
    const parentCode = asset.assetCategory.parent?.code;
    return parentCode === 'FIXED_INCOME';
  });

  const realEstateAssets = assets.filter(asset => {
    const parentCode = asset.assetCategory.parent?.code;
    return parentCode === 'REAL_ESTATE';
  });

  const alternativeAssets = assets.filter(asset => {
    const parentCode = asset.assetCategory.parent?.code;
    return parentCode === 'ALTERNATIVE';
  });

  const receivableAssets = assets.filter(asset => {
    const parentCode = asset.assetCategory.parent?.code;
    return parentCode === 'RECEIVABLE';
  });

  return (
    <Card className="overflow-hidden">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="border-b bg-muted/30 px-1 sm:px-2 pt-2 overflow-x-auto scrollbar-hide">
          <TabsList className="h-auto w-full justify-start gap-0.5 sm:gap-1 rounded-none border-none bg-transparent p-0 min-w-max">
            <TabsTrigger
              value="securities"
              className="relative rounded-t-lg border-b-2 border-transparent px-2 sm:px-4 py-2 text-xs sm:text-sm text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-sm whitespace-nowrap"
            >
              <TrendingUp className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">证券持仓</span>
              <span className="sm:hidden">证券</span>
              {holdings.length > 0 && (
                <span className="ml-1 sm:ml-2 rounded-full bg-primary/10 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-primary">
                  {holdings.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="cash"
              className="relative rounded-t-lg border-b-2 border-transparent px-2 sm:px-4 py-2 text-xs sm:text-sm text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-sm whitespace-nowrap"
            >
              <Wallet className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">现金资产</span>
              <span className="sm:hidden">现金</span>
              {cashAssets.length > 0 && (
                <span className="ml-1 sm:ml-2 rounded-full bg-primary/10 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-primary">
                  {cashAssets.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="fixed-income"
              className="relative rounded-t-lg border-b-2 border-transparent px-2 sm:px-4 py-2 text-xs sm:text-sm text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-sm whitespace-nowrap"
            >
              <PieChart className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">固定收益</span>
              <span className="sm:hidden">固收</span>
              {fixedIncomeAssets.length > 0 && (
                <span className="ml-1 sm:ml-2 rounded-full bg-primary/10 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-primary">
                  {fixedIncomeAssets.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="real-estate"
              className="relative rounded-t-lg border-b-2 border-transparent px-2 sm:px-4 py-2 text-xs sm:text-sm text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-sm whitespace-nowrap"
            >
              <Home className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">不动产</span>
              <span className="sm:hidden">房产</span>
              {realEstateAssets.length > 0 && (
                <span className="ml-1 sm:ml-2 rounded-full bg-primary/10 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-primary">
                  {realEstateAssets.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="alternative"
              className="relative rounded-t-lg border-b-2 border-transparent px-2 sm:px-4 py-2 text-xs sm:text-sm text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-sm whitespace-nowrap"
            >
              <Coins className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">另类投资</span>
              <span className="sm:hidden">另类</span>
              {alternativeAssets.length > 0 && (
                <span className="ml-1 sm:ml-2 rounded-full bg-primary/10 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-primary">
                  {alternativeAssets.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="receivables"
              className="relative rounded-t-lg border-b-2 border-transparent px-2 sm:px-4 py-2 text-xs sm:text-sm text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-sm whitespace-nowrap"
            >
              <Receipt className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">应收款</span>
              <span className="sm:hidden">应收</span>
              {receivableAssets.length > 0 && (
                <span className="ml-1 sm:ml-2 rounded-full bg-primary/10 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-primary">
                  {receivableAssets.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="liabilities"
              className="relative rounded-t-lg border-b-2 border-transparent px-2 sm:px-4 py-2 text-xs sm:text-sm text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-sm whitespace-nowrap"
            >
              <CreditCard className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">负债管理</span>
              <span className="sm:hidden">负债</span>
              {liabilities.length > 0 && (
                <span className="ml-1 sm:ml-2 rounded-full bg-red-100 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
                  {liabilities.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="securities" className="m-0 border-none p-0">
          <HoldingsList
            holdings={holdings}
            isLoading={isLoading}
            onRefresh={onRefresh}
            onAddHolding={onAddHolding}
            onManageAccounts={onManageAccounts}
          />
        </TabsContent>

        <TabsContent value="cash" className="m-0 border-none p-0">
          <CashAssetsList
            assets={cashAssets}
            isLoading={isLoading}
            onRefresh={onRefresh}
            onAddSuccess={() => handleTabChange('cash')} // ✅ 添加成功后切换到 cash Tab
          />
        </TabsContent>

        <TabsContent value="fixed-income" className="m-0 border-none p-0">
          <FixedIncomeList
            assets={fixedIncomeAssets}
            isLoading={isLoading}
            onRefresh={onRefresh}
          />
        </TabsContent>

        <TabsContent value="real-estate" className="m-0 border-none p-0">
          <RealEstateList
            assets={realEstateAssets}
            isLoading={isLoading}
            onRefresh={onRefresh}
          />
        </TabsContent>

        <TabsContent value="alternative" className="m-0 border-none p-0">
          <AlternativeList
            assets={alternativeAssets}
            isLoading={isLoading}
            onRefresh={onRefresh}
          />
        </TabsContent>

        <TabsContent value="receivables" className="m-0 border-none p-0">
          <ReceivablesList
            assets={receivableAssets}
            isLoading={isLoading}
            onRefresh={onRefresh}
          />
        </TabsContent>

        <TabsContent value="liabilities" className="m-0 border-none p-0">
          <LiabilitiesList
            liabilities={liabilities as any}
            isLoading={isLoading}
            onRefresh={onRefresh}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
