'use client';

import { Users, User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

export type DashboardView = 'personal' | 'family';

interface FamilyMemberOption {
  userId: string;
  userName: string;
  role: string;
}

interface ViewSwitcherProps {
  currentView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  familyName?: string;
  familyRole?: string; // ADMIN/MEMBER/VIEWER
  members?: FamilyMemberOption[];
  selectedMemberId?: string;
  onSelectMember?: (userId: string | undefined) => void;
}

export function ViewSwitcher({
  currentView,
  onViewChange,
  familyName,
  familyRole,
  members,
  selectedMemberId,
  onSelectMember,
}: ViewSwitcherProps) {
  if (!familyName) return null; // 未加入家庭时不显示

  const isAdmin = familyRole === 'ADMIN';

  return (
    <div className="flex items-center gap-2">
      {/* 视角切换按钮组 */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewChange('personal')}
          className={`h-7 px-3 text-xs rounded-md transition-all ${
            currentView === 'personal'
              ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100 font-medium'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <User className="h-3.5 w-3.5 mr-1" />
          个人
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onViewChange('family');
            onSelectMember?.(undefined); // 切到家庭视角时重置成员选择
          }}
          className={`h-7 px-3 text-xs rounded-md transition-all ${
            currentView === 'family'
              ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100 font-medium'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Users className="h-3.5 w-3.5 mr-1" />
          {familyName}
        </Button>
      </div>

      {/* 管理员：家庭视角下可选择查看特定成员 */}
      {currentView === 'family' && isAdmin && members && members.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
              {selectedMemberId
                ? members.find((m) => m.userId === selectedMemberId)?.userName || '成员'
                : '全部成员'}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-xs">查看成员资产</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSelectMember?.(undefined)}>
              <Users className="h-3.5 w-3.5 mr-2" />
              <span>全部成员（汇总）</span>
              {!selectedMemberId && (
                <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">
                  当前
                </Badge>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {members.map((member) => (
              <DropdownMenuItem
                key={member.userId}
                onClick={() => onSelectMember?.(member.userId)}
              >
                <User className="h-3.5 w-3.5 mr-2" />
                <span>{member.userName}</span>
                <Badge
                  variant="outline"
                  className="ml-auto text-[10px] px-1.5"
                >
                  {member.role === 'ADMIN' ? '管理员' : member.role === 'MEMBER' ? '成员' : '查看者'}
                </Badge>
                {selectedMemberId === member.userId && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                    当前
                  </Badge>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
