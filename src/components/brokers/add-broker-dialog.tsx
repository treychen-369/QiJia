'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

interface AddBrokerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface BrokerFormData {
  name: string;
  code: string;
  country: string;
}

export function AddBrokerDialog({ open, onOpenChange, onSuccess }: AddBrokerDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<BrokerFormData>({
    name: '',
    code: '',
    country: 'CN',
  });

  const handleSubmit = async () => {
    // 验证必填字段
    if (!formData.name || !formData.code || !formData.country) {
      toast({
        title: '请填写必填字段',
        description: '券商名称、券商代码和国家地区为必填项',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/brokers', {
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
        description: `券商 ${data.data.name} 已添加`,
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
      name: '',
      code: '',
      country: 'CN',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>添加自定义券商</DialogTitle>
          <DialogDescription>
            创建一个新的券商，后续可在创建账户时选择
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 券商名称 */}
          <div className="space-y-2">
            <Label htmlFor="name">
              券商名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="如：中银国际、华西证券"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
            <p className="text-xs text-gray-500">
              请输入完整的券商名称
            </p>
          </div>

          {/* 券商代码 */}
          <div className="space-y-2">
            <Label htmlFor="code">
              券商代码 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="code"
              placeholder="如：BOCI、HUAXI"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
            />
            <p className="text-xs text-gray-500">
              建议使用英文缩写，系统会自动转为大写
            </p>
          </div>

          {/* 国家地区 */}
          <div className="space-y-2">
            <Label htmlFor="country">
              国家地区 <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.country}
              onValueChange={(value) => setFormData(prev => ({ ...prev, country: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CN">中国 (CN)</SelectItem>
                <SelectItem value="HK">香港 (HK)</SelectItem>
                <SelectItem value="US">美国 (US)</SelectItem>
                <SelectItem value="UK">英国 (UK)</SelectItem>
                <SelectItem value="JP">日本 (JP)</SelectItem>
                <SelectItem value="SG">新加坡 (SG)</SelectItem>
                <SelectItem value="TW">台湾 (TW)</SelectItem>
                <SelectItem value="KR">韩国 (KR)</SelectItem>
                <SelectItem value="AU">澳大利亚 (AU)</SelectItem>
                <SelectItem value="CA">加拿大 (CA)</SelectItem>
                <SelectItem value="DE">德国 (DE)</SelectItem>
                <SelectItem value="FR">法国 (FR)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 提示信息 */}
          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-900">
            <p className="font-medium mb-1">💡 温馨提示</p>
            <ul className="space-y-1 text-xs">
              <li>• 券商代码需要唯一，不能与已有券商重复</li>
              <li>• 创建后的券商会立即在账户选择中可用</li>
              <li>• 如需修改或删除券商，请联系管理员</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? '创建中...' : '创建券商'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
