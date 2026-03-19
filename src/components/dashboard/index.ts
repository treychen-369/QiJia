// Dashboard 组件导出索引
// 便于从单一入口导入所有 Dashboard 相关组件

// 布局组件
export { DashboardLayout, DashboardSection } from './dashboard-layout';

// 核心组件
export { HeroSection } from './hero-section';
export { Sidebar } from './sidebar';
export { MobileBottomBar } from './mobile-bottom-bar';

// 骨架屏组件
export { 
  DashboardSkeleton,
  HeroSectionSkeleton,
  ChartSkeleton,
  SidebarSkeleton,
  AssetsListSkeleton
} from './dashboard-skeleton';

// 保留原有组件（向后兼容）
export { AssetOverview } from './asset-overview';
export { QuickActions } from './quick-actions';
export { ExchangeRateWidget } from './exchange-rate-widget';
export { HoldingsList } from './holdings-list';
