'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Users, 
  UserPlus, 
  Crown, 
  Shield, 
  Eye,
  Mail,
  Calendar,
  MoreHorizontal,
  Trash2,
  Settings,
  Copy,
  Check
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

interface FamilyMember {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
    createdAt: string;
  };
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: string;
  isCreator: boolean;
}

interface FamilyData {
  id: string;
  name: string;
  description: string;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  memberCount: number;
}

interface Invitation {
  id: string;
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  token?: string;
  inviter: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  expiresAt: string;
}

export default function FamilySettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  // Phase 4: 创建家庭
  const [isCreatingFamily, setIsCreatingFamily] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newFamilyDesc, setNewFamilyDesc] = useState('');

  useEffect(() => {
    fetchFamilyData();
  }, []);

  const fetchFamilyData = async () => {
    try {
      const response = await fetch('/api/family/members');
      const data = await response.json();
      
      if (data.family) {
        setFamily({
          id: data.family.id,
          name: data.family.name,
          description: data.family.description || '',
          creator: { id: data.family.createdBy, name: '', email: '' },
          createdAt: data.family.createdAt,
          memberCount: data.members?.length || 0,
        });
        setMembers((data.members || []).map((m: any) => ({
          ...m,
          isCreator: m.user?.id === data.family.createdBy,
        })));
        // 如果有家庭，加载邀请列表
        fetchInvitations();
      } else {
        setFamily(null);
        setMembers([]);
      }
    } catch (error) {
      toast.error('获取家庭信息失败');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const response = await fetch('/api/family/invite');
      const data = await response.json();
      setInvitations(data.invitations || []);
    } catch (error) {
      console.error('获取邀请列表失败:', error);
    }
  };

  const handleCreateFamily = async () => {
    if (!newFamilyName.trim()) {
      toast.error('请输入家庭名称');
      return;
    }
    setIsCreatingFamily(true);
    try {
      const response = await fetch('/api/family/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFamilyName.trim(), description: newFamilyDesc.trim() }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('家庭创建成功');
        setNewFamilyName('');
        setNewFamilyDesc('');
        await updateSession(); // 刷新 session 以获取新的 familyId
        fetchFamilyData();
      } else {
        toast.error(data.error || '创建家庭失败');
      }
    } catch (error) {
      toast.error('创建家庭失败');
    } finally {
      setIsCreatingFamily(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      toast.error('请输入邮箱地址');
      return;
    }

    setIsInviting(true);
    
    try {
      const response = await fetch('/api/family/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('邀请已发送');
        setInviteEmail('');
        setInviteRole('MEMBER');
        setShowInviteDialog(false);
        fetchInvitations();
      } else {
        toast.error(data.error || '发送邀请失败');
      }
    } catch (error) {
      toast.error('发送邀请失败');
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: 'ADMIN' | 'MEMBER' | 'VIEWER') => {
    try {
      const response = await fetch('/api/family/members', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId,
          role: newRole,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('成员角色更新成功');
        fetchFamilyData();
      } else {
        toast.error(data.error || '更新成员角色失败');
      }
    } catch (error) {
      toast.error('更新成员角色失败');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const response = await fetch(`/api/family/members?memberId=${memberId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('成员已移除');
        fetchFamilyData();
      } else {
        toast.error(data.error || '移除成员失败');
      }
    } catch (error) {
      toast.error('移除成员失败');
    }
  };

  const copyInviteLink = async (invitation: Invitation) => {
    const inviteLink = `${window.location.origin}/auth/invite/${invitation.token || invitation.id}`;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInviteId(invitation.id);
      toast.success('邀请链接已复制');
      
      setTimeout(() => {
        setCopiedInviteId(null);
      }, 2000);
    } catch (error) {
      toast.error('复制失败');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'MEMBER':
        return <Shield className="h-4 w-4 text-blue-500" />;
      case 'VIEWER':
        return <Eye className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return '管理员';
      case 'MEMBER':
        return '成员';
      case 'VIEWER':
        return '查看者';
      default:
        return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'MEMBER':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'VIEWER':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'ACCEPTED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const currentUserMember = members.find(m => m.user.id === session?.user?.id);
  const isAdmin = currentUserMember?.role === 'ADMIN';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            家庭管理
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            管理家庭成员和权限设置
          </p>
        </div>

        {/* 未加入家庭时：显示创建家庭入口 */}
        {!family && (
          <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                创建家庭
              </CardTitle>
              <p className="text-slate-600 dark:text-slate-400">
                创建一个家庭来汇总管理家庭成员的资产
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="familyName">家庭名称</Label>
                  <Input
                    id="familyName"
                    placeholder="例如：Trey的家庭"
                    value={newFamilyName}
                    onChange={(e) => setNewFamilyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="familyDesc">描述（可选）</Label>
                  <Input
                    id="familyDesc"
                    placeholder="家庭描述"
                    value={newFamilyDesc}
                    onChange={(e) => setNewFamilyDesc(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleCreateFamily}
                  disabled={isCreatingFamily || !newFamilyName.trim()}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {isCreatingFamily ? '创建中...' : '创建家庭'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 家庭信息卡片 */}
        {family && (
          <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                {family.name}
              </CardTitle>
              <p className="text-slate-600 dark:text-slate-400">
                {family.description}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {family.memberCount}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    家庭成员
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    创建者
                  </p>
                  <p className="text-slate-800 dark:text-slate-200">
                    {family.creator.name}
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    创建时间
                  </p>
                  <p className="text-slate-800 dark:text-slate-200">
                    {new Date(family.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 家庭成员列表 */}
        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                家庭成员
              </CardTitle>
              {isAdmin && (
                <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                      <UserPlus className="h-4 w-4 mr-2" />
                      邀请成员
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>邀请家庭成员</DialogTitle>
                      <DialogDescription>
                        输入要邀请的用户邮箱地址和角色权限
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">邮箱地址</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="user@example.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">角色权限</Label>
                        <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">管理员 - 完全权限</SelectItem>
                            <SelectItem value="MEMBER">成员 - 编辑权限</SelectItem>
                            <SelectItem value="VIEWER">查看者 - 只读权限</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowInviteDialog(false)}
                      >
                        取消
                      </Button>
                      <Button
                        onClick={handleInviteMember}
                        disabled={isInviting}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      >
                        {isInviting ? '发送中...' : '发送邀请'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {members.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold">
                        {member.user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                          {member.user.name}
                        </h3>
                        {member.isCreator && (
                          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            <Crown className="h-3 w-3 mr-1" />
                            创建者
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {member.user.email}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        加入时间: {new Date(member.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Badge className={getRoleBadgeColor(member.role)}>
                      {getRoleIcon(member.role)}
                      <span className="ml-1">{getRoleLabel(member.role)}</span>
                    </Badge>
                    
                    {isAdmin && !member.isCreator && member.user.id !== session?.user?.id && (
                      <div className="flex items-center gap-2">
                        <Select
                          value={member.role}
                          onValueChange={(value: any) => handleUpdateMemberRole(member.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">管理员</SelectItem>
                            <SelectItem value="MEMBER">成员</SelectItem>
                            <SelectItem value="VIEWER">查看者</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>确认移除成员</AlertDialogTitle>
                              <AlertDialogDescription>
                                您确定要移除 {member.user.name} 吗？此操作无法撤销。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveMember(member.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                移除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 邀请记录 */}
        {isAdmin && invitations.length > 0 && (
          <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                邀请记录
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {invitation.email}
                        </p>
                        <Badge className={getRoleBadgeColor(invitation.role)}>
                          {getRoleLabel(invitation.role)}
                        </Badge>
                        <Badge className={getStatusBadgeColor(invitation.status)}>
                          {invitation.status === 'PENDING' ? '待接受' : 
                           invitation.status === 'ACCEPTED' ? '已接受' :
                           invitation.status === 'REJECTED' ? '已拒绝' : '已过期'}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        邀请者: {invitation.inviter.name} • 
                        发送时间: {new Date(invitation.createdAt).toLocaleDateString()} •
                        过期时间: {new Date(invitation.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    
                    {invitation.status === 'PENDING' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyInviteLink(invitation)}
                        className="flex items-center gap-2"
                      >
                        {copiedInviteId === invitation.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        {copiedInviteId === invitation.id ? '已复制' : '复制链接'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}