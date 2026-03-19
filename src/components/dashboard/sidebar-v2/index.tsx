'use client';

/**
 * 侧边栏V2 - 主组件
 * 整合所有侧边栏面板，提供完整的配置管理功能
 */

import { Separator } from '@/components/ui/separator';
import { QuickActionsPanel } from './quick-actions';
import { AIAssistantPanel } from './ai-assistant';
import { LiabilityHealthPanel } from './liability-health';
import { ExchangeRatesPanel } from './exchange-rates';
import type { SidebarV2Props } from './types';

export function SidebarV2({
  // 快速操作
  onAddRecord,
  onImportData,
  onViewActivityLog,
  
  // 配置数据
  liabilityHealth,
  
  // AI建议
  onRequestAIAdvice,
  onViewAdviceHistory,
  latestAdvice,
  canRequestAIAdvice = true,
  
  // 其他回调
  onEditFamilyProfile,
  onManageFamily,
  hasFamilyId,
}: SidebarV2Props) {
  return (
    <div className="p-4 space-y-4">
      {/* 1. 快速操作 */}
      <QuickActionsPanel
        onAddRecord={onAddRecord}
        onEditFamilyProfile={onEditFamilyProfile}
        onImportData={onImportData}
        onViewActivityLog={onViewActivityLog}
        onManageFamily={onManageFamily}
        hasFamilyId={hasFamilyId}
      />

      <Separator />

      {/* 2. AI配置助手 */}
      <AIAssistantPanel
        onRequestAdvice={onRequestAIAdvice}
        onViewHistory={onViewAdviceHistory}
        latestAdvice={latestAdvice}
        canRequestAdvice={canRequestAIAdvice}
      />

      <Separator />

      {/* 3. 负债健康度 */}
      <LiabilityHealthPanel
        data={liabilityHealth}
      />

      <Separator />

      {/* 4. 汇率监控 */}
      <ExchangeRatesPanel />
    </div>
  );
}

// 导出类型
export * from './types';
