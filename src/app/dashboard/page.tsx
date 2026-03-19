'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// 新布局组件
import { DashboardLayout, DashboardSection } from '@/components/dashboard/dashboard-layout';
import { HeroSection } from '@/components/dashboard/hero-section';
import { Sidebar } from '@/components/dashboard/sidebar';
import { SidebarV2 } from '@/components/dashboard/sidebar-v2';
import { MobileBottomBar } from '@/components/dashboard/mobile-bottom-bar';
import { DashboardSkeleton, SidebarSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ViewSwitcher, type DashboardView } from '@/components/dashboard/view-switcher';
import { FamilyOverviewCard } from '@/components/family/family-overview-card';
import { InvitationBanner } from '@/components/family/invitation-banner';
import { FamilyTransferDialog } from '@/components/family/family-transfer-dialog';

// 图表组件
import { ChartsGrid } from '@/components/charts/charts-grid';
import { AssetsTabNavigation } from '@/components/assets/assets-tab-navigation';
import { PreferencesDialog } from '@/components/settings/preferences-dialog';
import { AddHoldingDialog } from '@/components/holdings/add-holding-dialog';
import { AccountManagementDialog } from '@/components/holdings/account-management-dialog';

// Phase 5: 侧边栏对话框组件
import { AIAdviceDialog } from '@/components/dialogs/ai-advice-dialog';
import { FamilyProfileDialog } from '@/components/dialogs/family-profile-dialog';
import { AdviceHistoryDialog } from '@/components/dialogs/advice-history-dialog';
import { EditTargetsDialog } from '@/components/dialogs/edit-targets-dialog';
import { ActivityLogDialog } from '@/components/dialogs/activity-log-dialog';
import { AllocationDetailDialog } from '@/components/dialogs/allocation-detail-dialog';

// UI组件
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  Users,
  LogOut,
  Settings,
  User,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { apiClient, type DashboardData } from '@/lib/api-client';
import { toast } from '@/components/ui/use-toast';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('2小时前');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [liabilities, setLiabilities] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeAssetsTab, setActiveAssetsTab] = useState('securities');
  
  // 对话框状态
  const [addHoldingDialogOpen, setAddHoldingDialogOpen] = useState(false);
  const [addAccountDialogOpen, setAddAccountDialogOpen] = useState(false);
  
  // Phase 5: 侧边栏对话框状态
  const [aiAdviceDialogOpen, setAIAdviceDialogOpen] = useState(false);
  const [familyProfileDialogOpen, setFamilyProfileDialogOpen] = useState(false);
  const [adviceHistoryDialogOpen, setAdviceHistoryDialogOpen] = useState(false);
  const [editTargetsDialogOpen, setEditTargetsDialogOpen] = useState(false);
  const [activityLogDialogOpen, setActivityLogDialogOpen] = useState(false);
  const [allocationDetailDialogOpen, setAllocationDetailDialogOpen] = useState(false);
  const [familyTransferDialogOpen, setFamilyTransferDialogOpen] = useState(false);
  
  // ========== Phase 1: 侧边栏版本切换（测试用） ==========
  // 设置为 true 使用新侧边栏，false 使用旧侧边栏
  const [useNewSidebar, setUseNewSidebar] = useState(true);

  // ========== Phase 4: 家庭视角 ==========
  const [currentView, setCurrentView] = useState<DashboardView>('personal');
  const [familyOverview, setFamilyOverview] = useState<any>(null);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>(undefined);
  const [isFamilyLoading, setIsFamilyLoading] = useState(false);
  const [familyHoldings, setFamilyHoldings] = useState<any[]>([]);
  const [familyAssets, setFamilyAssets] = useState<any[]>([]);
  const [familyLiabilities, setFamilyLiabilities] = useState<any[]>([]);
  const [familyAllocationData, setFamilyAllocationData] = useState<any>(null);

  // ========== 成员筛选：按 selectedMemberId 过滤家庭数据 ==========
  const filteredFamilyHoldings = useMemo(() => {
    if (!selectedMemberId) return familyHoldings;
    return familyHoldings.filter((h: any) => h.ownerId === selectedMemberId);
  }, [familyHoldings, selectedMemberId]);

  const filteredFamilyAssets = useMemo(() => {
    if (!selectedMemberId) return familyAssets;
    return familyAssets.filter((a: any) => a.ownerId === selectedMemberId);
  }, [familyAssets, selectedMemberId]);

  const filteredFamilyLiabilities = useMemo(() => {
    if (!selectedMemberId) return familyLiabilities;
    return familyLiabilities.filter((l: any) => l.ownerId === selectedMemberId);
  }, [familyLiabilities, selectedMemberId]);

  // 选中成员时，使用后端精确计算的成员数据
  const filteredFamilyOverview = useMemo(() => {
    if (!selectedMemberId || !familyOverview) return familyOverview;
    
    const member = familyOverview.memberBreakdown?.find(
      (m: any) => m.userId === selectedMemberId
    );
    if (!member) return familyOverview;
    
    return {
      ...familyOverview,
      familyName: `${member.userName}的资产`,
      totalAssets: member.totalAssets,
      totalLiabilities: member.totalLiabilities,
      netWorth: member.netWorth,
      totalUnrealizedPnl: member.totalUnrealizedPnl || 0,
      totalUnrealizedPnlPercent: member.totalUnrealizedPnlPercent || 0,
      todayPnl: member.todayPnl || 0,
      todayPnlPercent: member.todayPnlPercent || 0,
      memberCount: 1,
      memberBreakdown: [{
        ...member,
        percentage: 100,
      }],
    };
  }, [familyOverview, selectedMemberId]);

  // 加载家庭数据
  const loadFamilyData = useCallback(async () => {
    if (!session?.user?.familyId) return;
    setIsFamilyLoading(true);
    try {
      const [overviewRes, membersRes, dashboardRes] = await Promise.all([
        fetch('/api/family/overview'),
        fetch('/api/family/members'),
        fetch('/api/family/dashboard'),
      ]);
      if (overviewRes.ok) {
        const overviewData = await overviewRes.json();
        setFamilyOverview(overviewData);
      }
      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setFamilyMembers(membersData.members || []);
      }
      if (dashboardRes.ok) {
        const dashboardData = await dashboardRes.json();
        if (dashboardData.success) {
          // 转换持仓数据格式（与个人视角一致）
          const holdings = (dashboardData.holdings || []).map((h: any) => ({
            ...h,
            lastUpdated: new Date(h.lastUpdated).toLocaleString('zh-CN', {
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit'
            })
          }));
          setFamilyHoldings(holdings);
          setFamilyAssets(dashboardData.assets || []);
          setFamilyLiabilities(dashboardData.liabilities || []);
          setFamilyAllocationData(dashboardData.allocationData || null);
        }
      }
    } catch (err) {
      console.error('加载家庭数据失败:', err);
    } finally {
      setIsFamilyLoading(false);
    }
  }, [session?.user?.familyId]);

  // 加载仪表板数据
  // silent=true 时不显示全页骨架屏（用于弹窗保存后的静默刷新）
  const loadDashboardData = async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);
      const data = await apiClient.getDashboardData();
      setDashboardData(data);
      
      // 加载资产数据
      try {
        const assetsResponse = await fetch('/api/assets');
        const assetsData = await assetsResponse.json();
        if (assetsData.success) {
          setAssets(assetsData.data);
        }
      } catch (assetsError) {
        console.error('加载资产数据失败:', assetsError);
      }

      // 加载负债数据
      try {
        const liabilitiesResponse = await fetch('/api/liabilities');
        const liabilitiesData = await liabilitiesResponse.json();
        if (liabilitiesData.success) {
          setLiabilities(liabilitiesData.data);
        }
      } catch (liabilitiesError) {
        console.error('加载负债数据失败:', liabilitiesError);
      }
    } catch (error) {
      console.error('加载仪表板数据失败:', error);
      const errorMessage = error instanceof Error ? error.message : '加载数据失败';
      
      if (errorMessage.includes('未授权') || errorMessage.includes('401')) {
        router.push('/');
        return;
      }
      
      // 检测是否在 CodeBuddy Preview 窗口中
      const isPreviewWindow = typeof window !== 'undefined' && 
        (window.location.protocol === 'file:' || 
         window.location.hostname.includes('webview') ||
         window.location.hostname === '');
      
      if (isPreviewWindow) {
        setError('Preview 窗口限制：请在浏览器中直接访问页面以获取完整功能');
      } else {
        setError(errorMessage);
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  // 检查用户认证状态并加载数据
  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }
    
    if (status === 'authenticated') {
      loadDashboardData();
      // Phase 4: 如果用户属于家庭，预加载家庭数据
      if (session?.user?.familyId) {
        loadFamilyData();
      }
    }
  }, [status, router]);

  // 操作处理函数
  const handleAddRecord = () => {
    setAddHoldingDialogOpen(true);
  };

  const handleImportData = () => {
    router.push('/import');
  };

  const handleExportData = () => {
    console.log('Exporting data...');
  };

  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
      await loadDashboardData();
      setLastSyncTime('刚刚');
    } catch (error) {
      console.error('同步数据失败:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSettings = () => {
    router.push('/settings/sync');
  };

  const handleSignOut = async () => {
    try {
      await signOut({ 
        callbackUrl: '/',
        redirect: true 
      });
    } catch (error) {
      console.error('退出登录失败:', error);
    }
  };

  // 加载状态 - 使用骨架屏
  if (status === 'loading' || isLoading) {
    return (
      <DashboardLayout 
        header={
          <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
            <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="h-8 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
                  <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </header>
        }
        sidebar={<SidebarSkeleton />}
      >
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 mb-4">加载数据失败: {error}</p>
          <Button onClick={() => loadDashboardData()}>重试</Button>
        </div>
      </div>
    );
  }

  // 无数据状态
  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">暂无数据</p>
        </div>
      </div>
    );
  }

  // 数据转换
  const heroData = {
    totalAssets: dashboardData.overview.totalAssets,
    // ✅ Phase 1.2: 使用API返回的真实净资产（总资产 - 总负债）
    netWorth: dashboardData.overview.netWorth ?? dashboardData.overview.totalAssets,
    totalLiabilities: dashboardData.overview.totalLiabilities ?? 0,
    // ✅ 现金流动性 = 证券账户现金 + 活期存款
    cashBalance: dashboardData.overview.totalCash,
    investedAmount: dashboardData.overview.totalInvestmentValue,
    // ✅ 新增资产构成明细
    totalCashAssets: dashboardData.overview.totalCashAssets ?? 0,
    totalOtherAssets: dashboardData.overview.totalOtherAssets ?? 0,
    todayChange: dashboardData.overview.todayPnl,
    todayChangePercent: dashboardData.overview.todayPnlPercent,
    totalReturn: dashboardData.overview.totalUnrealizedPnl,
    totalReturnPercent: dashboardData.overview.totalUnrealizedPnlPercent,
  };

  // ✨ 重构：投资组合分布数据（只保留底层敞口 + 二级分类）
  const dualViewPortfolioData = {
    byOverviewGroup: dashboardData.underlyingTypePortfolio?.byOverviewGroup || [],
    equityByRegion: dashboardData.underlyingTypePortfolio?.equityByRegion,
    groupsSubCategories: dashboardData.underlyingTypePortfolio?.groupsSubCategories,
  };

  // 账户现金数据
  const accountsCashData = dashboardData.accounts.map(account => ({
    id: account.id,
    name: account.name,
    broker: account.broker,
    currency: account.currency,
    cashBalance: Number(account.cashBalance),
    cashBalanceOriginal: Number(account.cashBalanceOriginal),
  }));

  // 添加账户现金项到持仓列表
  const cashData = dashboardData.accounts
    .filter(account => Number(account.cashBalanceOriginal) > 0)
    .map(account => ({
      id: `cash-${account.id}`,
      type: 'cash' as const,
      symbol: 'CASH',
      name: `可用现金 - ${account.broker}`,
      accountId: account.id,
      accountName: account.name,
      broker: account.broker,
      quantity: 1,
      currentPrice: Number(account.cashBalanceOriginal),
      costBasis: Number(account.cashBalanceOriginal),
      marketValue: Number(account.cashBalance),
      marketValueOriginal: Number(account.cashBalanceOriginal),
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      dayChange: 0,
      dayChangePercent: 0,
      sector: '现金',
      region: account.currency === 'USD' ? '美国' : account.currency === 'HKD' ? '香港' : '中国',
      currency: account.currency,
      lastUpdated: new Date(account.lastUpdated).toLocaleString('zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
    }));

  // 合并持仓和现金数据
  const allHoldingsData = [
    ...dashboardData.allHoldings.map(holding => ({
      ...holding,
      lastUpdated: new Date(holding.lastUpdated).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    })),
    ...cashData
  ];

  // 渲染顶部导航
  const renderHeader = () => (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              QiJia
            </h1>
            {/* Phase 4: 家庭/个人视角切换 */}
            {session?.user?.familyId && (
              <ViewSwitcher
                currentView={currentView}
                onViewChange={(view) => {
                  setCurrentView(view);
                  if (view === 'family') {
                    loadFamilyData();
                  }
                }}
                familyName={familyOverview?.familyName || '我的家庭'}
                familyRole={session?.user?.familyRole}
                members={familyMembers.map((m: any) => ({
                  userId: m.user?.id || m.userId,
                  userName: m.user?.name || '未知',
                  role: m.role,
                }))}
                selectedMemberId={selectedMemberId}
                onSelectMember={setSelectedMemberId}
              />
            )}
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Calendar className="h-4 w-4" />
              <span>{new Date().toLocaleDateString('zh-CN', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
              <Clock className="h-4 w-4 ml-2" />
              <span>实时更新</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 lg:gap-4">
            {/* 回到新版按钮 */}
            <button
              onClick={() => router.push('/dashboard-v2')}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:shadow-md hover:opacity-90"
            >
              <Sparkles className="h-3 w-3" />
              <span className="hidden sm:inline">回到新版</span>
            </button>

            {/* 偏好设置 */}
            <PreferencesDialog />
            
            {/* 同步状态 - 桌面端显示 */}
            <div className="hidden sm:flex items-center gap-2">
              {isSyncing ? (
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm">同步中...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm hidden lg:inline">已同步</span>
                </div>
              )}
            </div>
            
            {/* 用户菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  <span className="hidden sm:inline text-sm font-medium text-slate-700 dark:text-slate-300">
                    {session?.user?.name || 'User'}
                  </span>
                  <ChevronDown className="h-4 w-4 text-slate-500 hidden sm:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {session?.user?.name || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session?.user?.email || ''}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>系统设置</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );

  // 渲染侧边栏
  const renderSidebar = () => {
    // ========== Phase 3: 使用新侧边栏 + 真实数据 ==========
    if (useNewSidebar) {
      // 从 dashboardData.allocationData.liabilityInfo 提取负债健康度数据
      const liabilityHealth = dashboardData?.allocationData?.liabilityInfo ? {
        totalLiabilities: dashboardData.allocationData.liabilityInfo.totalLiabilities,
        liabilityRatio: dashboardData.allocationData.liabilityInfo.liabilityRatio,
        dti: dashboardData.allocationData.liabilityInfo.dti,
        monthlyPayment: dashboardData.allocationData.liabilityInfo.monthlyPayment,
        status: dashboardData.allocationData.liabilityInfo.debtHealthStatus,
      } : undefined;
      
      // 最近AI建议：家庭视角下使用家庭级建议，所有成员共享可见
      const sidebarAdviceSource = currentView === 'family' 
        ? familyAllocationData 
        : dashboardData?.allocationData;
      const latestAdvice = sidebarAdviceSource?.latestAdvice ? {
        id: sidebarAdviceSource.latestAdvice.id,
        summary: sidebarAdviceSource.latestAdvice.summary,
        status: sidebarAdviceSource.latestAdvice.status,
        createdAt: sidebarAdviceSource.latestAdvice.createdAt,
      } : undefined;

      // AI建议功能仅限家庭管理员使用（个人视角和家庭视角都一样）
      const canRequestAIAdvice = session?.user?.familyRole === 'ADMIN';
      
      return (
        <SidebarV2
          onAddRecord={handleAddRecord}
          onImportData={handleImportData}
          onViewActivityLog={() => setActivityLogDialogOpen(true)}
          // ✅ Phase 3: 使用真实数据
          liabilityHealth={liabilityHealth}
          latestAdvice={latestAdvice}
          canRequestAIAdvice={canRequestAIAdvice}
          // ✅ Phase 5: 对话框回调
          onRequestAIAdvice={() => setAIAdviceDialogOpen(true)}
          onViewAdviceHistory={() => setAdviceHistoryDialogOpen(true)}
          onEditFamilyProfile={() => setFamilyProfileDialogOpen(true)}
          // ✅ Phase 4: 家庭管理
          onManageFamily={() => router.push('/settings/family')}
          hasFamilyId={!!session?.user?.familyId}
        />
      );
    }
    
    // 旧侧边栏（后备）
    return (
      <Sidebar
        onAddRecord={handleAddRecord}
        onImportData={handleImportData}
        onSyncData={handleSyncData}
        onSettings={handleSettings}
        onEditTargets={() => setEditTargetsDialogOpen(true)}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
      />
    );
  };

  return (
    <>
      <DashboardLayout 
        header={renderHeader()} 
        sidebar={renderSidebar()}
      >
        <DashboardSection>
          {/* 待处理的家庭邀请通知 */}
          <InvitationBanner />

          {/* Phase 4: 家庭视角 - 家庭概览卡片 */}
          {currentView === 'family' && filteredFamilyOverview && (
            <FamilyOverviewCard
              data={{
                familyName: filteredFamilyOverview.familyName,
                totalAssets: filteredFamilyOverview.totalAssets,
                totalLiabilities: filteredFamilyOverview.totalLiabilities,
                netWorth: filteredFamilyOverview.netWorth,
                totalUnrealizedPnl: filteredFamilyOverview.totalUnrealizedPnl,
                totalUnrealizedPnlPercent: filteredFamilyOverview.totalUnrealizedPnlPercent,
                todayPnl: filteredFamilyOverview.todayPnl,
                todayPnlPercent: filteredFamilyOverview.todayPnlPercent,
                memberCount: filteredFamilyOverview.memberCount,
                memberBreakdown: filteredFamilyOverview.memberBreakdown || [],
                assetDistribution: filteredFamilyOverview.assetDistribution || [],
              }}
              isLoading={isFamilyLoading}
              onRefresh={loadFamilyData}
              onSelectMember={(userId) => {
                setSelectedMemberId(userId);
              }}
              allocationHealth={!selectedMemberId && familyAllocationData ? {
                score: familyAllocationData.overallScore,
                topDeviation: familyAllocationData.topDeviations?.[0] ? {
                  category: familyAllocationData.topDeviations[0].categoryName,
                  deviation: familyAllocationData.topDeviations[0].deviation,
                  status: familyAllocationData.topDeviations[0].deviationStatus,
                } : undefined,
                alertCount: familyAllocationData.alerts?.filter((a: any) => 
                  a.severity === 'HIGH' || a.severity === 'MEDIUM'
                ).length || 0,
                fullAnalysis: familyAllocationData.fullAnalysis,
                alerts: familyAllocationData.alerts,
                scoreBreakdown: familyAllocationData.scoreBreakdown,
                latestAdvice: familyAllocationData.latestAdvice,
              } : undefined}
              onEditTargets={() => setEditTargetsDialogOpen(true)}
              onRequestAIAdvice={() => setAIAdviceDialogOpen(true)}
              canRequestAIAdvice={session?.user?.familyRole === 'ADMIN'}
              onTransfer={session?.user?.familyRole === 'ADMIN' ? () => setFamilyTransferDialogOpen(true) : undefined}
              equityByRegion={filteredFamilyOverview.equityByRegion}
              groupsSubCategories={filteredFamilyOverview.groupsSubCategories}
            />
          )}

          {/* P0: 核心指标区 - 家庭视角下隐藏个人概览 */}
          {currentView !== 'family' && (
          <HeroSection 
            data={heroData}
            accounts={accountsCashData}
            assetTypeDistribution={dashboardData.dualViewPortfolio?.byAssetType || []}
            underlyingTypeDistribution={{
              byUnderlyingType: dashboardData.underlyingTypePortfolio?.byUnderlyingType || [],
              byOverviewGroup: dashboardData.underlyingTypePortfolio?.byOverviewGroup || [],
              equityByRegion: dashboardData.underlyingTypePortfolio?.equityByRegion as any,
              groupsSubCategories: dashboardData.underlyingTypePortfolio?.groupsSubCategories as any
            }}
            allocationHealth={dashboardData?.allocationData ? {
              score: dashboardData.allocationData.overallScore,
              topDeviation: dashboardData.allocationData.topDeviations?.[0] ? {
                category: dashboardData.allocationData.topDeviations[0].categoryName,
                deviation: dashboardData.allocationData.topDeviations[0].deviation,
                status: dashboardData.allocationData.topDeviations[0].deviationStatus,
              } : undefined,
              alertCount: dashboardData.allocationData.alerts?.filter((a: any) => 
                a.severity === 'HIGH' || a.severity === 'MEDIUM'
              ).length || 0,
              fullAnalysis: dashboardData.allocationData.fullAnalysis,
              alerts: dashboardData.allocationData.alerts,
              scoreBreakdown: dashboardData.allocationData.scoreBreakdown,
              latestAdvice: dashboardData.allocationData.latestAdvice,
            } : undefined}
            isLoading={isSyncing}
            onRefresh={handleSyncData}
            onEditTargets={() => setEditTargetsDialogOpen(true)}
            onViewAllocationDetail={() => setAllocationDetailDialogOpen(true)}
            onRequestAIAdvice={() => setAIAdviceDialogOpen(true)}
            hasFamilyId={!!session?.user?.familyId}
            onSwitchToFamily={() => setCurrentView('family')}
          />
          )}

          {/* P1: 资产列表Tab */}
          <div id="assets-section">
            <AssetsTabNavigation
              holdings={currentView === 'family' ? filteredFamilyHoldings : allHoldingsData}
              assets={currentView === 'family' ? filteredFamilyAssets : assets}
              liabilities={currentView === 'family' ? filteredFamilyLiabilities : liabilities}
              isLoading={isFamilyLoading}
              onRefresh={currentView === 'family' ? loadFamilyData : loadDashboardData}
            onAddHolding={() => setAddHoldingDialogOpen(true)}
            onManageAccounts={() => setAddAccountDialogOpen(true)}
            defaultTab={activeAssetsTab}
            onTabChange={setActiveAssetsTab}
          />
          </div>

          {/* ===== 以下功能待优化，暂时放在页面底部 ===== */}
          
          {/* P3: 图表区域（投资组合分布、资产趋势） */}
          <ChartsGrid 
            portfolioData={currentView === 'family' && filteredFamilyOverview 
              ? { 
                  byOverviewGroup: (filteredFamilyOverview.assetDistribution || []).map((d: any) => ({
                    code: d.category,
                    name: d.categoryName,
                    value: d.value,
                    percentage: d.percentage,
                    count: 0,
                    color: d.color || '#94A3B8',
                  })),
                }
              : dualViewPortfolioData as any
            }
            totalValue={currentView === 'family' && filteredFamilyOverview 
              ? filteredFamilyOverview.totalAssets 
              : heroData.totalAssets
            }
            historyApiUrl={currentView === 'family' ? '/api/family/history' : undefined}
          />
        </DashboardSection>
      </DashboardLayout>

      {/* 移动端底部操作栏 */}
      <MobileBottomBar
        onAddRecord={handleAddRecord}
        onImportData={handleImportData}
        onSyncData={handleSyncData}
        onRequestAIAdvice={() => setAIAdviceDialogOpen(true)}
        onEditFamilyProfile={() => setFamilyProfileDialogOpen(true)}
        canRequestAIAdvice={session?.user?.familyRole === 'ADMIN'}
        liabilityHealth={dashboardData?.allocationData?.liabilityInfo ? {
          totalLiabilities: dashboardData.allocationData.liabilityInfo.totalLiabilities,
          liabilityRatio: dashboardData.allocationData.liabilityInfo.liabilityRatio,
          dti: dashboardData.allocationData.liabilityInfo.dti,
          monthlyPayment: dashboardData.allocationData.liabilityInfo.monthlyPayment,
          status: dashboardData.allocationData.liabilityInfo.debtHealthStatus,
        } : undefined}
        latestAdvice={(() => {
          const source = currentView === 'family' 
            ? familyAllocationData 
            : dashboardData?.allocationData;
          return source?.latestAdvice ? {
            id: source.latestAdvice.id,
            summary: source.latestAdvice.summary,
            createdAt: source.latestAdvice.createdAt,
          } : undefined;
        })()}
        isSyncing={isSyncing}
        className="lg:hidden"
      />

      {/* 对话框 */}
      <AddHoldingDialog
        open={addHoldingDialogOpen}
        onOpenChange={setAddHoldingDialogOpen}
        onSuccess={() => {
          setAddHoldingDialogOpen(false);
          loadDashboardData(true);
        }}
      />

      <AccountManagementDialog
        open={addAccountDialogOpen}
        onOpenChange={setAddAccountDialogOpen}
        onSuccess={() => {
          loadDashboardData(true);
        }}
      />

      {/* Phase 5: 侧边栏对话框 */}
      <AIAdviceDialog
        open={aiAdviceDialogOpen}
        onOpenChange={setAIAdviceDialogOpen}
        onAdviceReceived={() => {
          loadDashboardData(true);
        }}
        // ✨ 优化：传递缓存数据，避免重复调用汇率API
        dashboardData={dashboardData}
        // ✨ 家庭视角时使用家庭聚合数据
        scope={currentView === 'family' ? 'family' : 'personal'}
      />

      <FamilyProfileDialog
        open={familyProfileDialogOpen}
        onOpenChange={setFamilyProfileDialogOpen}
        onSave={() => {
          loadDashboardData(true);
        }}
      />

      <AdviceHistoryDialog
        open={adviceHistoryDialogOpen}
        onOpenChange={setAdviceHistoryDialogOpen}
        scope={currentView === 'family' ? 'family' : 'personal'}
      />

      <EditTargetsDialog
        open={editTargetsDialogOpen}
        onOpenChange={setEditTargetsDialogOpen}
        onSave={() => {
          loadDashboardData(true);
        }}
      />

      <ActivityLogDialog
        open={activityLogDialogOpen}
        onOpenChange={setActivityLogDialogOpen}
        onViewDetail={(assetId, assetType, assetName) => {
          // 关闭对话框
          setActivityLogDialogOpen(false);
          
          // 根据资产类型切换到对应的Tab
          const tabMapping: Record<string, string> = {
            'HOLDING': 'securities',
            'CASH_ASSET': 'cash',
            'REAL_ESTATE': 'real-estate',
            'OTHER_ASSET': 'cash',
            'LIABILITY': 'liabilities',
          };
          
          const targetTab = tabMapping[assetType] || 'securities';
          setActiveAssetsTab(targetTab);
          
          // 滚动到资产列表区域
          setTimeout(() => {
            const assetsSection = document.getElementById('assets-section');
            if (assetsSection) {
              assetsSection.scrollIntoView({ behavior: 'smooth' });
            }
          }, 100);
          
          toast({
            title: `查看 ${assetName}`,
            description: `已切换到${assetType === 'HOLDING' ? '证券持仓' : assetType === 'CASH_ASSET' ? '现金资产' : assetType === 'REAL_ESTATE' ? '不动产' : '资产'}列表`,
          });
        }}
      />

      {/* 配置分析详情对话框 */}
      <AllocationDetailDialog
        open={allocationDetailDialogOpen}
        onOpenChange={setAllocationDetailDialogOpen}
        onRequestAIAdvice={() => {
          setAllocationDetailDialogOpen(false);
          setAIAdviceDialogOpen(true);
        }}
        onEditTargets={() => {
          setAllocationDetailDialogOpen(false);
          setEditTargetsDialogOpen(true);
        }}
      />

      {/* 家庭资产转移对话框 */}
      {session?.user?.familyId && (
        <FamilyTransferDialog
          open={familyTransferDialogOpen}
          onOpenChange={setFamilyTransferDialogOpen}
          familyId={session.user.familyId}
          familyName={familyOverview?.familyName || '我的家庭'}
          members={familyMembers}
          currentUserId={session.user.id || ''}
          onSuccess={() => {
            loadFamilyData();
            loadDashboardData(true);
          }}
        />
      )}
    </>
  );
}
