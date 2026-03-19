'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { FamilyMember } from '@/app/dashboard-v2/layout'
import { useDashboardV2 } from '@/app/dashboard-v2/layout'
import { formatCurrency } from '../use-dashboard-v2-data'

interface FamilyMembersProps {
  visible: boolean
  familyMembers: FamilyMember[]
}

export function FamilyMembersSection({ visible, familyMembers }: FamilyMembersProps) {
  const { apiData } = useDashboardV2()
  const memberBreakdown: any[] = apiData.familyOverview?.memberBreakdown || []

  // 合并 familyMembers 显示信息与 memberBreakdown 的真实数据
  const membersWithData = familyMembers.map((member) => {
    const data = memberBreakdown.find((m: any) => m.userId === member.id)
    return {
      ...member,
      totalAssets: data?.totalAssets ?? 0,
      percentage: data?.percentage ?? 0,
    }
  })

  // 如果没有家庭成员数据 (如 familyMembers 为空但 memberBreakdown 有数据)
  const displayMembers = membersWithData.length > 0
    ? membersWithData
    : memberBreakdown.map((m: any, idx: number) => ({
        id: m.userId,
        name: m.userName || '未知',
        role: m.role || '成员',
        initials: (m.userName || '?')[0],
        color: ['bg-blue-500', 'bg-pink-500', 'bg-amber-500'][idx % 3],
        totalAssets: m.totalAssets ?? 0,
        percentage: m.percentage ?? 0,
      }))

  const barColors = ['bg-blue-500', 'bg-pink-500', 'bg-amber-500', 'bg-emerald-500', 'bg-purple-500']

  return (
    <div className="rounded-2xl border border-amber-200/60 dark:border-amber-800/40 bg-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">成员资产占比</h3>
          <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            {displayMembers.length} 名成员
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {displayMembers.map((member, idx) => (
          <div
            key={member.id}
            className="flex items-center gap-4 rounded-xl p-3.5 transition-colors hover:bg-muted/30"
          >
            <Avatar className="h-10 w-10">
              <AvatarFallback className={`${member.color} text-sm font-semibold text-white`}>
                {member.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{member.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  member.role === '管理员'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {member.role}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{member.percentage.toFixed(1)}%</span>
            </div>
            <span className="text-sm font-semibold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {visible ? formatCurrency(member.totalAssets) : '****'}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-muted">
        {displayMembers.map((member, idx) => (
          <div
            key={member.id}
            className={`${barColors[idx % barColors.length]} transition-all`}
            style={{ width: `${member.percentage}%` }}
          />
        ))}
      </div>
    </div>
  )
}
