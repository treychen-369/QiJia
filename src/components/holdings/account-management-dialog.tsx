'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Edit, Building2, Trash2 } from 'lucide-react';

interface Account {
  id: string;
  accountName: string;
  accountNumber?: string;
  accountType: string;
  currency: string;
  isActive: boolean;
  brokerId: string;
  broker: {
    id: string;
    name: string;
    code: string;
  };
}

interface Broker {
  id: string;
  name: string;
  code: string;
}

interface AccountManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AccountManagementDialog({ open, onOpenChange, onSuccess }: AccountManagementDialogProps) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    accountName: '',
    accountNumber: '',
    accountType: 'INVESTMENT',
    currency: 'CNY',
    brokerId: '',
    isActive: true,
  });

  useEffect(() => {
    if (open) {
      loadAccounts();
      loadBrokers();
    }
  }, [open]);

  const loadAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      if (!response.ok) throw new Error('加载账户失败');
      const result = await response.json();
      setAccounts(result.data || []);
    } catch (error) {
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  const loadBrokers = async () => {
    try {
      const response = await fetch('/api/brokers');
      if (!response.ok) throw new Error('加载券商失败');
      const result = await response.json();
      setBrokers(result.data || []);
    } catch (error) {
      console.error('加载券商失败:', error);
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      accountName: account.accountName,
      accountNumber: account.accountNumber || '',
      accountType: account.accountType,
      currency: account.currency,
      brokerId: account.brokerId,
      isActive: account.isActive,
    });
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingAccount(null);
    setFormData({
      accountName: '',
      accountNumber: '',
      accountType: 'INVESTMENT',
      currency: 'CNY',
      brokerId: '',
      isActive: true,
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.accountName || !formData.brokerId) {
      toast({
        title: '请填写必填字段',
        description: '账户名称和券商为必填项',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const url = editingAccount ? `/api/accounts/${editingAccount.id}` : '/api/accounts';
      const method = editingAccount ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '操作失败');
      }

      toast({
        title: editingAccount ? '更新成功' : '创建成功',
        description: `账户 ${formData.accountName} 已${editingAccount ? '更新' : '创建'}`,
      });

      setShowForm(false);
      loadAccounts();
      onSuccess?.();
    } catch (error) {
      toast({
        title: '操作失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (account: Account) => {
    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...account,
          isActive: !account.isActive,
        }),
      });

      if (!response.ok) throw new Error('更新失败');

      toast({
        title: '更新成功',
        description: `账户已${!account.isActive ? '启用' : '停用'}`,
      });

      loadAccounts();
      onSuccess?.();
    } catch (error) {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  const getAccountTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      INVESTMENT: '投资账户',
      CASH: '现金账户',
      MARGIN: '保证金账户',
      RETIREMENT: '退休账户',
    };
    return types[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>账户管理</DialogTitle>
            <DialogDescription className="sr-only">
              管理您的投资账户，包括添加、编辑和删除账户
            </DialogDescription>
            <Button size="sm" onClick={handleAdd} disabled={showForm}>
              <Plus className="h-4 w-4 mr-2" />
              添加账户
            </Button>
          </div>
          <DialogDescription>
            管理您的投资账户，包括添加、编辑和启用/停用账户
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 表单区域 */}
          {showForm && (
            <Card className="p-4 bg-slate-50 dark:bg-slate-900 border-2 border-blue-500">
              <div className="space-y-4">
                <h3 className="font-semibold">
                  {editingAccount ? '编辑账户' : '添加新账户'}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>券商 <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.brokerId}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, brokerId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择券商" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={5}>
                        {brokers.map((broker) => (
                          <SelectItem key={broker.id} value={broker.id}>
                            {broker.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>账户名称 <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.accountName}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
                      placeholder="如：长桥港股账户"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>账户编号</Label>
                    <Input
                      value={formData.accountNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                      placeholder="账号后4位或完整账号"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>账户类型</Label>
                    <Select
                      value={formData.accountType}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, accountType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={5}>
                        <SelectItem value="INVESTMENT">投资账户</SelectItem>
                        <SelectItem value="CASH">现金账户</SelectItem>
                        <SelectItem value="MARGIN">保证金账户</SelectItem>
                        <SelectItem value="RETIREMENT">退休账户</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>货币</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={5}>
                        <SelectItem value="CNY">人民币 (CNY)</SelectItem>
                        <SelectItem value="USD">美元 (USD)</SelectItem>
                        <SelectItem value="HKD">港币 (HKD)</SelectItem>
                        <SelectItem value="JPY">日元 (JPY)</SelectItem>
                        <SelectItem value="EUR">欧元 (EUR)</SelectItem>
                        <SelectItem value="GBP">英镑 (GBP)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>启用状态</Label>
                    <Switch
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSubmit} disabled={loading}>
                    {loading ? '保存中...' : editingAccount ? '更新账户' : '创建账户'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setEditingAccount(null);
                    }}
                  >
                    取消
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* 账户列表 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
              现有账户 ({accounts.length})
            </h3>
            
            {accounts.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                暂无账户，点击上方"添加账户"按钮创建
              </div>
            ) : (
              <div className="grid gap-3">
                {accounts.map((account) => (
                  <Card key={account.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-blue-500" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{account.accountName}</span>
                            {account.accountNumber && (
                              <span className="text-xs text-slate-500">({account.accountNumber})</span>
                            )}
                            {!account.isActive && (
                              <Badge variant="secondary" className="text-xs">已停用</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span>{account.broker.name}</span>
                            <span>•</span>
                            <span>{getAccountTypeLabel(account.accountType)}</span>
                            <span>•</span>
                            <span>{account.currency}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleActive(account)}
                        >
                          {account.isActive ? '停用' : '启用'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(account)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
