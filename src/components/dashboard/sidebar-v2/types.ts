/**
 * 侧边栏V2 类型定义
 * Phase 1: 定义所有侧边栏组件需要的类型
 */

import { ExchangeRates } from '@/lib/exchange-rate-service';

// ==================== 主组件Props ====================

export interface SidebarV2Props {
  // 快速操作回调
  onAddRecord: () => void;
  onImportData: () => void;
  onViewActivityLog?: () => void;  // 查看更新记录
  
  // 配置数据（Phase 3接入真实数据）
  liabilityHealth?: LiabilityHealthData;
  
  // AI建议相关
  onRequestAIAdvice?: () => void;
  onViewAdviceHistory?: () => void;
  latestAdvice?: LatestAdvice;
  canRequestAIAdvice?: boolean;    // 是否有权发起AI建议（家庭非管理员无权）
  
  // 其他回调
  onEditFamilyProfile?: () => void;
  onManageFamily?: () => void;    // Phase 4: 家庭管理
  hasFamilyId?: boolean;          // Phase 4: 是否已加入家庭
}

// ==================== 配置健康度 ====================

export interface AllocationHealthData {
  score: number;  // 0-100
  deviations: DeviationItem[];
  scoreBreakdown?: {
    deviationScore: number;
    diversityScore: number;
    liquidityScore: number;
    debtScore: number;
  };
}

export interface DeviationItem {
  category: string;
  categoryCode?: string;
  currentPercent?: number;
  targetPercent?: number;
  deviation: number;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

// ==================== 负债健康度 ====================

export interface LiabilityHealthData {
  totalLiabilities?: number;
  liabilityRatio: number;  // 负债率（已是百分比值，如 10.5 表示 10.5%）
  dti?: number;            // 债务收入比（已是百分比值，如 15.2 表示 15.2%）
  monthlyPayment?: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

// ==================== AI建议 ====================

export interface LatestAdvice {
  id?: string;
  summary: string;
  createdAt: string;
  status?: string;
}

// ==================== 子组件Props ====================

export interface QuickActionsPanelProps {
  onAddRecord: () => void;
  onEditFamilyProfile?: () => void;  // 编辑家庭档案
  onImportData: () => void;
  onViewActivityLog?: () => void;  // 查看更新记录
  onManageFamily?: () => void;     // Phase 4: 家庭管理
  hasFamilyId?: boolean;           // Phase 4: 是否已加入家庭
}

export interface AIAssistantPanelProps {
  onRequestAdvice?: () => void;
  onViewHistory?: () => void;
  latestAdvice?: LatestAdvice;
  isLoading?: boolean;
  canRequestAdvice?: boolean;      // 是否有权发起AI建议
}

export interface HealthSummaryPanelProps {
  data?: AllocationHealthData;
  onEditTargets?: () => void;
  onViewDetail?: () => void;
  isLoading?: boolean;
}

export interface LiabilityHealthPanelProps {
  data?: LiabilityHealthData;
  isLoading?: boolean;
}


