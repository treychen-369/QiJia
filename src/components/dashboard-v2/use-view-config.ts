'use client'

import { useMemo } from 'react'
import { useDashboardV2, type ViewMode } from '@/app/dashboard-v2/layout'
import type { DashboardV2DataState } from './use-dashboard-v2-data'

// ─── 主题配置 ───

export interface ThemeConfig {
  /** 主强调色 Tailwind class（如 'amber' | 'blue'） */
  accent: string
  /** 背景渐变 class */
  bgGradient: string
  /** Header 边框 class */
  headerBorder: string
  /** Tab 下划线激活色 class */
  tabActiveText: string
  tabActiveBar: string
  /** 进度条/圆环色 class */
  progressBar: string
  /** 按钮色系 */
  buttonPrimary: string
  buttonBorder: string
  /** 标签色 */
  tagBg: string
  tagText: string
  /** 图标色 */
  iconColor: string
}

const personalTheme: ThemeConfig = {
  accent: 'blue',
  bgGradient: 'bg-gradient-to-br from-slate-50/60 via-blue-50/20 to-background dark:from-slate-950/40 dark:via-blue-950/10 dark:to-background',
  headerBorder: 'border-border',
  tabActiveText: 'text-primary',
  tabActiveBar: 'bg-primary',
  progressBar: 'bg-primary',
  buttonPrimary: 'border-primary/30 text-primary hover:bg-primary/5',
  buttonBorder: 'border-primary/30',
  tagBg: 'bg-primary/10',
  tagText: 'text-primary',
  iconColor: 'text-primary',
}

const familyTheme: ThemeConfig = {
  accent: 'amber',
  bgGradient: 'bg-gradient-to-br from-amber-50/40 via-orange-50/20 to-background dark:from-amber-950/20 dark:via-orange-950/10 dark:to-background',
  headerBorder: 'border-amber-200/60 dark:border-amber-800/40',
  tabActiveText: 'text-amber-700 dark:text-amber-400',
  tabActiveBar: 'bg-amber-500',
  progressBar: 'bg-amber-500',
  buttonPrimary: 'border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30',
  buttonBorder: 'border-amber-200 dark:border-amber-800',
  tagBg: 'bg-amber-500/10',
  tagText: 'text-amber-600',
  iconColor: 'text-amber-500',
}

// ─── 功能开关 ───

export interface FeatureFlags {
  /** 是否显示 AI 顾问入口 */
  showAiAdvisor: boolean
  /** 是否显示 AI 洞察（总览页） */
  showAiInsight: boolean
  /** 是否显示未来 Tab 内容（再平衡计划） */
  showFutureContent: boolean
  /** 是否显示家庭管理 Tab */
  showFamilyTab: boolean
  /** 是否显示家庭成员选择器 */
  showMemberSelector: boolean
  /** 是否显示家庭成员占比区块 */
  showFamilyMembersSection: boolean
  /** 是否使用家庭转移（vs 个人转移） */
  useFamilyTransfer: boolean
}

// ─── 数据源选择器 ───

export interface DataSelectors {
  /** API scope 参数 */
  scope: 'personal' | 'family'
  /** 趋势数据 API 路径 */
  trendApiPath: string
  /** 获取 Holdings 数据 */
  getHoldings: (data: DashboardV2DataState) => any[]
  /** 获取 Assets 数据 */
  getAssets: (data: DashboardV2DataState) => any[]
  /** 获取 Liabilities 数据 */
  getLiabilities: (data: DashboardV2DataState) => any[]
  /** 获取 Allocation 分析数据 */
  getAllocation: (data: DashboardV2DataState) => any | null
  /** 获取总资产概览 */
  getOverview: (data: DashboardV2DataState) => any | null
  /** 获取底层资产构成 */
  getUnderlyingTypePortfolio: (data: DashboardV2DataState) => any | null
  /** 获取全量资产 Top N */
  getTopAssets: (data: DashboardV2DataState) => any[]
}

const personalDataSelectors: DataSelectors = {
  scope: 'personal',
  trendApiPath: '/api/portfolio/history',
  getHoldings: (d) => d.dashboardData?.allHoldings || [],
  getAssets: (d) => d.assets || [],
  getLiabilities: (d) => d.liabilities || [],
  getAllocation: (d) => d.dashboardData?.allocationData || null,
  getOverview: (d) => d.dashboardData?.overview || null,
  getUnderlyingTypePortfolio: (d) => d.dashboardData?.underlyingTypePortfolio || null,
  getTopAssets: (d) => (d.dashboardData as any)?.topAssets || [],
}

const familyDataSelectors: DataSelectors = {
  scope: 'family',
  trendApiPath: '/api/family/history',
  getHoldings: (d) => d.familyHoldings || [],
  getAssets: (d) => d.familyAssets || [],
  getLiabilities: (d) => d.familyLiabilities || [],
  getAllocation: (d) => d.familyAllocationData || null,
  getOverview: (d) => d.familyOverview || null,
  getUnderlyingTypePortfolio: (d) => {
    const fo = d.familyOverview
    if (!fo) return null
    return {
      byOverviewGroup: (fo.assetDistribution || []).map((dd: any) => ({
        code: dd.category,
        name: dd.categoryName,
        value: dd.value,
        percentage: dd.percentage,
        color: dd.color,
      })),
      equityByRegion: fo.equityByRegion || undefined,
      groupsSubCategories: fo.groupsSubCategories || undefined,
    }
  },
  getTopAssets: (d) => d.familyTopAssets || [],  // 家庭模式：服务端合并后的全量资产 Top 5
}

// ─── 导航配置 ───

export interface NavConfig {
  /** 可见的 Tab ID 列表 */
  visibleTabs: string[]
  /** StatCards 标题 */
  totalAssetsLabel: string
}

// ─── 完整视图配置 ───

export interface ViewConfig {
  mode: ViewMode
  isFamily: boolean
  theme: ThemeConfig
  features: FeatureFlags
  data: DataSelectors
  nav: NavConfig
}

/**
 * 集中式视图配置 Hook
 * 
 * 所有个人/家庭视图差异通过此 Hook 统一管理。
 * 新增差异项只需在此文件中添加配置，无需修改各组件的 isFamily 判断。
 * 
 * @example
 * const { theme, features, data } = useViewConfig()
 * // theme.iconColor → 'text-primary' | 'text-amber-500'
 * // features.showAiAdvisor → true | false
 * // data.getHoldings(apiData) → holdings[]
 */
export function useViewConfig(): ViewConfig {
  const { viewMode, apiData } = useDashboardV2()
  const isFamily = viewMode === 'family'
  const hasFamilyId = apiData.hasFamilyId

  return useMemo<ViewConfig>(() => {
    if (isFamily) {
      return {
        mode: 'family',
        isFamily: true,
        theme: familyTheme,
        features: {
          showAiAdvisor: true,
          showAiInsight: true,
          showFutureContent: true,
          showFamilyTab: true,
          showMemberSelector: true,
          showFamilyMembersSection: true,
          useFamilyTransfer: true,
        },
        data: familyDataSelectors,
        nav: {
          visibleTabs: ['overview', 'assets', 'liabilities', 'trends', 'future', 'family', 'settings'],
          totalAssetsLabel: '家庭总资产',
        },
      }
    }

    // 个人模式
    return {
      mode: 'personal',
      isFamily: false,
      theme: personalTheme,
      features: {
        showAiAdvisor: false,
        showAiInsight: !hasFamilyId, // 已加入家庭时隐藏（避免与家庭模式 AI 分析重复）
        showFutureContent: !hasFamilyId, // 已加入家庭时隐藏（数据不完整，应切到家庭视图使用）
        showFamilyTab: false,
        showMemberSelector: false,
        showFamilyMembersSection: false,
        useFamilyTransfer: false,
      },
      data: personalDataSelectors,
      nav: {
        visibleTabs: ['overview', 'assets', 'liabilities', 'trends', 'settings'],
        totalAssetsLabel: '总资产',
      },
    }
  }, [isFamily, hasFamilyId])
}

/**
 * 快捷函数：根据 ViewConfig 获取当前视图的数据
 */
export function useViewData() {
  const { apiData } = useDashboardV2()
  const config = useViewConfig()

  return useMemo(() => ({
    holdings: config.data.getHoldings(apiData),
    assets: config.data.getAssets(apiData),
    liabilities: config.data.getLiabilities(apiData),
    allocation: config.data.getAllocation(apiData),
    overview: config.data.getOverview(apiData),
    underlyingTypePortfolio: config.data.getUnderlyingTypePortfolio(apiData),
    topAssets: config.data.getTopAssets(apiData),
    scope: config.data.scope,
    trendApiPath: config.data.trendApiPath,
  }), [apiData, config.data])
}
