'use client'

import { useDashboardV2 } from './layout'
import { OverviewTab } from '@/components/dashboard-v2/overview-tab'
import { AssetsTab } from '@/components/dashboard-v2/assets-tab'
import { LiabilitiesTab } from '@/components/dashboard-v2/liabilities-tab'
import { TrendsTab } from '@/components/dashboard-v2/trends-tab'
import { FutureTab } from '@/components/dashboard-v2/future-tab'
import { FamilyTab } from '@/components/dashboard-v2/family-tab'
import { SettingsTab } from '@/components/dashboard-v2/settings-tab'
import { useViewConfig } from '@/components/dashboard-v2/use-view-config'

export default function DashboardV2Page() {
  const { activeTab, viewMode } = useDashboardV2()
  const { features } = useViewConfig()

  return (
    <div key={activeTab} style={{ animation: 'fadeSlideIn 0.2s ease-out' }}>
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'assets' && <AssetsTab />}
      {activeTab === 'liabilities' && <LiabilitiesTab />}
      {activeTab === 'trends' && <TrendsTab />}
      {activeTab === 'future' && features.showFutureContent && <FutureTab />}
      {activeTab === 'family' && viewMode === 'family' && <FamilyTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  )
}
