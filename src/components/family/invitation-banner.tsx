'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle, XCircle, X, Loader2 } from 'lucide-react';

interface Invitation {
  id: string;
  token: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  family: {
    name: string;
  };
  inviter: {
    name: string;
    email: string;
  };
}

export function InvitationBanner() {
  const { data: session, update: updateSession } = useSession();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // 如果用户已有家庭，不查询邀请
  const hasFamilyId = !!session?.user?.familyId;

  useEffect(() => {
    if (hasFamilyId || !session?.user?.id) return;

    const fetchInvitations = async () => {
      try {
        const res = await fetch('/api/family/invite?type=received');
        if (res.ok) {
          const data = await res.json();
          setInvitations(data.invitations || []);
        }
      } catch (err) {
        console.error('获取邀请列表失败:', err);
      }
    };

    fetchInvitations();
  }, [hasFamilyId, session?.user?.id]);

  const handleAction = async (invitation: Invitation, action: 'accept' | 'reject') => {
    setProcessingId(invitation.id);
    try {
      const res = await fetch('/api/family/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: invitation.token, action }),
      });

      if (res.ok) {
        if (action === 'accept') {
          await updateSession();
          // 刷新页面以加载家庭数据
          window.location.reload();
        } else {
          // 拒绝后移除该邀请
          setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
        }
      } else {
        const data = await res.json();
        console.error('操作失败:', data.error);
      }
    } catch (err) {
      console.error('操作邀请失败:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  // 过滤已忽略的邀请
  const visibleInvitations = invitations.filter(inv => !dismissed.has(inv.id));

  if (visibleInvitations.length === 0) return null;

  const roleLabels: Record<string, string> = {
    ADMIN: '管理员',
    MEMBER: '成员',
    VIEWER: '观察者',
  };

  return (
    <div className="space-y-3 mb-6">
      {visibleInvitations.map((invitation) => (
        <Card
          key={invitation.id}
          className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50 border border-blue-200 dark:border-blue-800 shadow-md"
        >
          <CardContent className="py-4 px-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg shrink-0">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    <span className="font-semibold">{invitation.inviter?.name || '某用户'}</span>
                    {' '}邀请你加入家庭{' '}
                    <span className="font-semibold">{invitation.family?.name || '未知家庭'}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs">
                      {roleLabels[invitation.role] || invitation.role}
                    </Badge>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(invitation.expiresAt) > new Date()
                        ? `${Math.ceil((new Date(invitation.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} 天后过期`
                        : '已过期'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => handleAction(invitation, 'accept')}
                  disabled={!!processingId}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
                >
                  {processingId === invitation.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      接受
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(invitation, 'reject')}
                  disabled={!!processingId}
                  className="text-slate-600 dark:text-slate-400"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  拒绝
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDismiss(invitation.id)}
                  className="h-8 w-8 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
