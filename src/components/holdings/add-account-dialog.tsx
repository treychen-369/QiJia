'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { AddBrokerDialog } from '@/components/brokers/add-broker-dialog';

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface Broker {
  id: string;
  name: string;
  code: string;
  country: string;
}

interface AccountFormData {
  brokerId: string;
  accountName: string;
  accountNumber: string;
  currency: string;
  accountType: string;
  isActive: boolean;
}

export function AddAccountDialog({ open, onOpenChange, onSuccess }: AddAccountDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loadingBrokers, setLoadingBrokers] = useState(false);
  const [showAddBroker, setShowAddBroker] = useState(false);
  
  const [formData, setFormData] = useState<AccountFormData>({
    brokerId: '',
    accountName: '',
    accountNumber: '',
    currency: 'CNY',
    accountType: 'INVESTMENT',
    isActive: true,
  });

  // 加载券商列表
  useEffect(() => {
    if (open) {
      loadBrokers();
    }
  }, [open]);

  const loadBrokers = async () => {
    setLoadingBrokers(true);
    try {
      const response = await fetch('/api/brokers');
      if (!response.ok) throw new Error('加载券商列表失败');
      
      const result = await response.json();
      setBrokers(result.data || []);
    } catch (error) {
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setLoadingBrokers(false);
    }
  };

  const handleBrokerAdded = () => {
    loadBrokers(); // 重新加载券商列表
    toast({
      title: '券商已添加',
      description: '现在可以选择新添加的券商了',
    });
  };

  const handleSubmit = async () => {
    // 验证必填字段
    if (!formData.brokerId || !formData.accountName || !formData.currency) {
      toast({
        title: '请填写必填字段',
        description: '券商、账户名称和货币为必填项',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建失败');
      }

      const data = await response.json();
      
      toast({
        title: '创建成功',
        description: `账户 ${data.account.accountName} 已添加`,
      });

      onOpenChange(false);
      onSuccess?.();
      resetForm();
    } catch (error) {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      brokerId: '',
      accountName: '',
      accountNumber: '',
      currency: 'CNY',
      accountType: 'INVESTMENT',
      isActive: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>添加投资账户</DialogTitle>
          <DialogDescription>
            创建新的投资账户以管理您的持仓
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 券商选择 */}
          <div className="space-y-2">
            <Label htmlFor="brokerId">
              券商 <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.brokerId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, brokerId: value }))}
              disabled={loadingBrokers}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingBrokers ? '加载中...' : '选择券商'} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={5}>
                {brokers.length === 0 ? (
                  <div className="p-2 text-sm text-gray-500 text-center">
                    {loadingBrokers ? '加载中...' : '暂无券商数据'}
                  </div>
                ) : (
                  brokers.map((broker) => (
                    <SelectItem key={broker.id} value={broker.id}>
                      {broker.name} ({broker.country})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between">
              {brokers.length === 0 && !loadingBrokers ? (
                <p className="text-xs text-gray-500">
                  暂无券商数据，请点击右侧按钮添加
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  找不到您的券商？
                </p>
              )}
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setShowAddBroker(true)}
                className="h-auto p-0 text-xs"
              >
                + 添加自定义券商
              </Button>
            </div>
          </div>

          {/* 账户名称 */}
          <div className="space-y-2">
            <Label htmlFor="accountName">
              账户名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="accountName"
              placeholder="如：长桥港股账户、中信主账户"
              value={formData.accountName}
              onChange={(e) => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
            />
            <p className="text-xs text-gray-500">
              建议使用便于识别的名称
            </p>
          </div>

          {/* 账户编号 */}
          <div className="space-y-2">
            <Label htmlFor="accountNumber">账户编号（可选）</Label>
            <Input
              id="accountNumber"
              placeholder="如：后4位或完整账号"
              value={formData.accountNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
            />
          </div>

          {/* 货币和账户类型 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">
                货币 <span className="text-red-500">*</span>
              </Label>
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

            <div className="space-y-2">
              <Label htmlFor="accountType">
                账户类型 <span className="text-red-500">*</span>
              </Label>
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
          </div>

          {/* 是否启用 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isActive">启用账户</Label>
              <p className="text-xs text-gray-500">
                停用的账户不会显示在持仓列表中
              </p>
            </div>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading || loadingBrokers}>
            {loading ? '创建中...' : '创建账户'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* 添加券商对话框 */}
      <AddBrokerDialog
        open={showAddBroker}
        onOpenChange={setShowAddBroker}
        onSuccess={handleBrokerAdded}
      />
    </Dialog>
  );
}
