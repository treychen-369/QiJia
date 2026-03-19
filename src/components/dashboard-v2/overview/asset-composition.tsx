'use client'

import { useState } from 'react'
import { useSettings } from '@/components/dashboard-v2/use-settings'

export interface CompositionItem {
  label: string
  value: string
  rawValue: number
  pct: number
  color: string
  code?: string
}

export interface SubGroupItem {
  name: string
  value: number
  formattedValue: string
  change: string
  positive: boolean
}

export interface SubGroup {
  name: string
  color: string
  value: number
  formattedValue: string
  percentage: number
  count: number
  items: SubGroupItem[]
}

interface AssetCompositionProps {
  compositionData: CompositionItem[]
  categorySubGroups: Record<string, SubGroup[]>
  defaultTopAssets: { name: string; value: string; change: string; positive: boolean; subtitle: string; category: string }[]
  visible: boolean
}

export function AssetComposition({ compositionData, categorySubGroups, defaultTopAssets, visible }: AssetCompositionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const { pnlColor, fmt } = useSettings()

  const handleCategoryClick = (label: string) => {
    setSelectedCategory(prev => prev === label ? null : label)
  }

  const selectedComp = selectedCategory ? compositionData.find(c => c.label === selectedCategory) : null
  const subGroups = selectedCategory ? (categorySubGroups[selectedCategory] || []) : []
  const totalItemCount = subGroups.reduce((sum, g) => sum + g.count, 0)
  const totalValue = compositionData.reduce((sum, c) => sum + c.rawValue, 0)

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex flex-col lg:flex-row">
        {/* Left: Donut Chart + Legend */}
        <div className="flex flex-col items-center border-b border-border p-3 sm:p-6 lg:w-[340px] lg:shrink-0 lg:border-b-0 lg:border-r">
          <h3 className="mb-3 sm:mb-5 self-start text-sm font-semibold text-foreground">资产构成</h3>

          {/* SVG Donut - Interactive */}
          <div className="relative mb-3 sm:mb-6">
            <svg className="h-[120px] w-[120px] sm:h-[200px] sm:w-[200px]" viewBox="0 0 200 200" role="img" aria-label="资产构成饼图">
              {(() => {
                const cx = 100, cy = 100, r = 72
                const baseStroke = 28, activeStroke = 38
                const circumference = 2 * Math.PI * r
                let accumulated = 0
                return compositionData.map((item) => {
                  const isActive = selectedCategory === item.label
                  const isOther = selectedCategory !== null && !isActive
                  const dashLength = (item.pct / 100) * circumference
                  const dashOffset = -accumulated * circumference / 100
                  accumulated += item.pct
                  return (
                    <circle
                      key={item.label}
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill="none"
                      stroke={item.color}
                      strokeWidth={isActive ? activeStroke : baseStroke}
                      strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                      strokeDashoffset={dashOffset}
                      transform="rotate(-90 100 100)"
                      className="transition-all duration-300 ease-out"
                      style={{
                        cursor: 'pointer',
                        opacity: isOther ? 0.35 : 1,
                        filter: isActive ? `drop-shadow(0 0 6px ${item.color}60)` : 'none',
                      }}
                      onClick={() => handleCategoryClick(item.label)}
                    />
                  )
                })
              })()}
              <text x="100" y="92" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: '11px' }}>
                {selectedCategory || '总资产'}
              </text>
              <text x="100" y="112" textAnchor="middle" className="fill-foreground font-bold" style={{ fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>
                {visible ? (selectedComp ? selectedComp.value : fmt(totalValue)) : '****'}
              </text>
              {selectedCategory && (
                <text x="100" y="128" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: '10px' }}>
                  {selectedComp?.pct.toFixed(1)}%
                </text>
              )}
            </svg>
          </div>

          {/* Legend - Clickable */}
          <div className="flex w-full flex-col gap-0.5 sm:gap-1">
            {compositionData.map((item) => {
              const isActive = selectedCategory === item.label
              return (
                <button
                  key={item.label}
                  onClick={() => handleCategoryClick(item.label)}
                  aria-pressed={isActive}
                  className={`flex items-center justify-between rounded-lg px-2 py-1 sm:px-2.5 sm:py-1.5 text-left transition-all ${
                    isActive
                      ? 'bg-muted shadow-sm ring-1 ring-border'
                      : 'hover:bg-muted/30'
                  } ${selectedCategory && !isActive ? 'opacity-50' : 'opacity-100'}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`shrink-0 rounded-full transition-all ${isActive ? 'h-2.5 w-2.5 sm:h-3 sm:w-3' : 'h-2 w-2 sm:h-2.5 sm:w-2.5'}`}
                      style={{ backgroundColor: item.color }}
                    />
                    <span className={`text-xs sm:text-sm ${isActive ? 'font-semibold text-foreground' : 'text-foreground'}`}>
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {isActive && (
                      <span className="hidden text-[11px] text-muted-foreground sm:inline" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {visible ? item.value : '****'}
                      </span>
                    )}
                    <span className={`text-xs sm:text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {item.pct.toFixed(1)}%
                    </span>
                  </div>
                </button>
              )
            })}
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="mt-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                清除筛选
              </button>
            )}
          </div>
        </div>

        {/* Right: Sub-group cards or default TOP 5 */}
        <div className="flex flex-1 flex-col p-3 sm:p-6">
          {selectedCategory && selectedComp ? (
            <>
              {/* Header */}
              <div className="mb-4 flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedComp.color }} />
                <h3 className="text-sm font-semibold text-foreground">
                  {selectedCategory} 细分
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {subGroups.length} 个类别 · {totalItemCount} 项资产
                </span>
              </div>

              {/* Sub-group cards grid */}
              {subGroups.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">暂无数据</div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {subGroups.map((group, gIdx) => (
                    <div
                      key={group.name}
                      className="overflow-hidden rounded-xl border border-border p-4 transition-all hover:shadow-sm"
                      style={{
                        borderLeftWidth: '3px',
                        borderLeftColor: group.color,
                        animation: 'fadeSlideIn 0.25s ease-out both',
                        animationDelay: `${gIdx * 60}ms`,
                      }}
                    >
                      {/* Sub-group header */}
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group.color }} />
                          <span className="text-sm font-semibold text-foreground">{group.name}</span>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {group.count} 项
                        </span>
                      </div>

                      {/* Sub-group value */}
                      <div className="mb-1 text-base font-bold" style={{ color: group.color, fontVariantNumeric: 'tabular-nums' }}>
                        {visible ? group.formattedValue : '****'}
                      </div>
                      <div className="mb-3 text-[11px] text-muted-foreground">
                        占{selectedCategory} {group.percentage.toFixed(1)}%
                      </div>

                      {/* Items list (max 3, sorted by value desc) */}
                      {group.items.length > 0 && (
                        <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
                          {group.items.slice(0, 3).map((item, iIdx) => (
                            <div key={`${item.name}-${iIdx}`} className="flex items-center justify-between text-xs">
                              <span className="max-w-[120px] truncate text-foreground">{item.name}</span>
                              <span className="font-medium text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {visible ? item.formattedValue : '****'}
                              </span>
                            </div>
                          ))}
                          {group.items.length > 3 && (
                            <span className="text-[10px] text-muted-foreground/60">
                              +{group.items.length - 3} 更多
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Default: TOP 5 assets */}
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">资产 TOP 5</h3>
                <span className="text-[11px] text-muted-foreground">按市值排序</span>
              </div>

              {/* Table Header */}
              <div className="mb-1.5 sm:mb-2 grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-border px-2 sm:px-3 pb-1.5 sm:pb-2 text-[10px] sm:text-[11px] font-medium text-muted-foreground sm:gap-4">
                <span>名称</span>
                <span className="w-16 text-right sm:w-24">市值</span>
                <span className="hidden w-16 text-right sm:block">涨跌</span>
              </div>

              {/* Table Rows */}
              <div className="flex flex-col gap-0.5">
                {defaultTopAssets.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">暂无数据</div>
                ) : defaultTopAssets.map((asset, idx) => (
                  <div
                    key={`top-${idx}-${asset.name}`}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl px-2 py-2 transition-all hover:bg-muted/30 sm:gap-4 sm:px-3 sm:py-2.5"
                    style={{ animation: 'fadeSlideIn 0.25s ease-out both', animationDelay: `${idx * 40}ms` }}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden sm:gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary sm:h-8 sm:w-8 sm:text-xs">
                        {idx + 1}
                      </div>
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        <span className="truncate text-xs font-medium text-foreground sm:text-sm">{asset.name}</span>
                        <span className="hidden text-[11px] text-muted-foreground sm:block">{asset.subtitle}</span>
                      </div>
                    </div>
                    <span className="w-16 text-right text-xs font-semibold text-foreground sm:w-24 sm:text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {visible ? asset.value : '****'}
                    </span>
                    <span className={`hidden w-16 text-right text-xs font-semibold sm:block ${pnlColor(asset.positive ? 1 : -1)}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {asset.change}
                    </span>
                  </div>
                ))}
              </div>

              {/* Category Value Comparison - horizontal bar chart */}
              <div className="mt-3 border-t border-border pt-3 sm:mt-4 sm:pt-4">
                <span className="mb-2 block text-[11px] sm:text-xs font-medium text-muted-foreground sm:mb-3">各类资产市值对比</span>
                <div className="flex flex-col gap-1.5 sm:gap-2">
                  {compositionData.map((item) => {
                    const maxVal = compositionData[0]?.rawValue || 1
                    const barWidth = (item.rawValue / maxVal) * 100
                    return (
                      <button
                        key={item.label}
                        onClick={() => handleCategoryClick(item.label)}
                        className="group/bar flex items-center gap-2 sm:gap-3 rounded-lg px-1 py-0.5 sm:py-1 transition-colors hover:bg-muted/30"
                      >
                        <span className="w-12 shrink-0 text-[10px] sm:w-16 sm:text-[11px] text-muted-foreground">{item.label}</span>
                        <div className="relative flex h-4 sm:h-5 flex-1 items-center">
                          <div
                            className="h-full rounded-md transition-all group-hover/bar:opacity-90"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: item.color,
                              opacity: 0.7,
                              minWidth: '4px',
                            }}
                          />
                        </div>
                        <span className="w-16 shrink-0 text-right text-[10px] sm:w-20 sm:text-[11px] font-medium text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {visible ? item.value : '****'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
