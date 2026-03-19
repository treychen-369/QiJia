'use client'

import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  TrendingUp,
  Target,
  Users,
  Settings,
  MoreHorizontal,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'

interface MobileBottomNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
  viewMode: 'personal' | 'family'
  hasFamilyId: boolean
}

interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  familyOnly?: boolean
  hiddenInPersonalWithFamily?: boolean
}

const allNavItems: NavItem[] = [
  { id: 'overview', label: '总览', icon: LayoutDashboard },
  { id: 'assets', label: '资产', icon: Wallet },
  { id: 'liabilities', label: '负债', icon: CreditCard },
  { id: 'trends', label: '趋势', icon: TrendingUp },
  { id: 'future', label: '规划', icon: Target, hiddenInPersonalWithFamily: true },
  { id: 'family', label: '家庭', icon: Users, familyOnly: true },
  { id: 'settings', label: '设置', icon: Settings },
]

export function MobileBottomNav({ activeTab, onTabChange, viewMode, hasFamilyId }: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const isFamily = viewMode === 'family'

  const visibleNav = allNavItems.filter((item) => {
    if (item.familyOnly && !isFamily) return false
    if (item.hiddenInPersonalWithFamily && viewMode === 'personal' && hasFamilyId) return false
    return true
  })

  // 底部栏最多显示4个主要Tab + 更多按钮
  const MAX_VISIBLE = 4
  const mainTabs = visibleNav.slice(0, MAX_VISIBLE)
  const moreTabs = visibleNav.slice(MAX_VISIBLE)
  const hasMore = moreTabs.length > 0

  // 如果当前激活的 tab 在 more 中，高亮"更多"按钮
  const isActiveInMore = moreTabs.some(t => t.id === activeTab)

  return (
    <>
      {/* More overlay */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={() => setMoreOpen(false)} />
          <div
            className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-50 rounded-2xl border border-border bg-card p-2 shadow-xl lg:hidden"
            style={{ animation: 'fadeSlideIn 0.2s ease-out' }}
          >
            <div className="grid grid-cols-4 gap-1">
              {moreTabs.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id)
                      setMoreOpen(false)
                    }}
                    className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-center transition-colors ${
                      isActive
                        ? isFamily
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-medium leading-none">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around px-1 py-1">
          {mainTabs.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id)
                  setMoreOpen(false)
                }}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors ${
                  isActive
                    ? isFamily
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                <div className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? isFamily
                      ? 'bg-amber-500/10'
                      : 'bg-primary/10'
                    : ''
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`text-[10px] leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            )
          })}

          {/* More button */}
          {hasMore && (
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors ${
                isActiveInMore || moreOpen
                  ? isFamily
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors ${
                isActiveInMore || moreOpen
                  ? isFamily
                    ? 'bg-amber-500/10'
                    : 'bg-primary/10'
                  : ''
              }`}>
                <MoreHorizontal className="h-4 w-4" />
              </div>
              <span className={`text-[10px] leading-none ${isActiveInMore ? 'font-semibold' : 'font-medium'}`}>
                更多
              </span>
            </button>
          )}
        </div>
      </nav>
    </>
  )
}
