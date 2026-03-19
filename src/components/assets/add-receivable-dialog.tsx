'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { User, Building2, Briefcase, HelpCircle, Loader2 } from 'lucide-react';

interface AddReceivableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ReceivableType = 'REC_PERSONAL_LOAN' | 'REC_DEPOSIT' | 'REC_SALARY' | 'REC_BUSINESS' | 'REC_OTHER';

interface AssetCategory {
  id: string;
  code: string;
  name: string;
}

export function AddReceivableDialog({ open, onOpenChange, onSuccess }: AddReceivableDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [receivableType, setReceivableType] = useState<ReceivableType | ''>('');
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    currency: 'CNY',
    // 应收款通用字段
    debtorName: '',
    debtorContact: '',
    interestRate: '',
    dueDate: '',
    lendDate: '',
    repaymentStatus: 'pending',
    // 押金特有字段
    depositType: '',
    depositAddress: '',
    // 薪资特有字段
    employer: '',
    salaryMonth: '',
    // 商业应收特有字段
    companyName: '',
    invoiceNumber: '',
    contractNumber: '',
  });

  // 加载分类
  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/asset-categories');
      const data = await response.json();
      if (data.success) {
        const receivableCategories = data.data.filter(
          (cat: any) => cat.parent?.code === 'RECEIVABLE' && cat.level === 2
        );
        setCategories(receivableCategories);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      toast({
        variant: 'destructive',
        title: '加载失败',
        description: '无法加载应收款分类，请刷新页面重试',
      });
    }
  };

  const handleTypeChange = (type: ReceivableType) => {
    setReceivableType(type);
    const category = categories.find(c => c.code === type);
    if (category) {
      setSelectedCategoryId(category.id);
    }
    // 重置表单（保留通用字段）
    setFormData({
      name: '',
      description: '',
      amount: '',
      currency: 'CNY',
      debtorName: '',
      debtorContact: '',
      interestRate: '',
      dueDate: '',
      lendDate: '',
      repaymentStatus: 'pending',
      depositType: '',
      depositAddress: '',
      employer: '',
      salaryMonth: '',
      companyName: '',
      invoiceNumber: '',
      contractNumber: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!receivableType) {
      toast({ variant: 'destructive', title: '请选择应收款类型' });
      return;
    }

    if (!formData.name || !formData.amount) {
      toast({
        variant: 'destructive',
        title: '请填写必填项',
        description: '应收款名称和金额为必填项',
      });
      return;
    }

    if (!selectedCategoryId) {
      toast({
        variant: 'destructive',
        title: '分类错误',
        description: '未能识别应收款分类，请重新选择类型',
      });
      return;
    }

    setIsLoading(true);

    try {
      // 构建元数据
      const metadata: any = {
        debtorName: formData.debtorName,
        debtorContact: formData.debtorContact,
        repaymentStatus: formData.repaymentStatus,
      };

      if (formData.interestRate) {
        metadata.interestRate = parseFloat(formData.interestRate);
      }

      // 类型特有字段
      if (receivableType === 'REC_DEPOSIT') {
        metadata.depositType = formData.depositType;
        metadata.depositAddress = formData.depositAddress;
      } else if (receivableType === 'REC_SALARY') {
        metadata.employer = formData.employer;
        metadata.salaryMonth = formData.salaryMonth;
      } else if (receivableType === 'REC_BUSINESS') {
        metadata.companyName = formData.companyName;
        metadata.invoiceNumber = formData.invoiceNumber;
        metadata.contractNumber = formData.contractNumber;
      }

      const purchaseAmount = parseFloat(formData.amount || '0');

      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          assetCategoryId: selectedCategoryId,
          quantity: 1,
          unitPrice: purchaseAmount,
          purchasePrice: purchaseAmount,
          originalValue: purchaseAmount,
          currency: formData.currency,
          purchaseDate: formData.lendDate || null,
          maturityDate: formData.dueDate || null,
          metadata,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '创建失败');
      }

      toast({
        title: '创建成功',
        description: '应收款已添加',
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('创建应收款失败:', error);
      toast({
        variant: 'destructive',
        title: '创建失败',
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderTypeSelector = () => (
    <div className="space-y-4">
      <Label>选择应收款类型 *</Label>
      <div className="grid grid-cols-5 gap-3">
        <Button
          type="button"
          variant={receivableType === 'REC_PERSONAL_LOAN' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleTypeChange('REC_PERSONAL_LOAN')}
        >
          <User className="h-6 w-6" />
          <span className="text-xs">个人借款</span>
        </Button>
        <Button
          type="button"
          variant={receivableType === 'REC_DEPOSIT' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleTypeChange('REC_DEPOSIT')}
        >
          <Building2 className="h-6 w-6" />
          <span className="text-xs">押金/保证金</span>
        </Button>
        <Button
          type="button"
          variant={receivableType === 'REC_SALARY' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleTypeChange('REC_SALARY')}
        >
          <Briefcase className="h-6 w-6" />
          <span className="text-xs">薪资/报销</span>
        </Button>
        <Button
          type="button"
          variant={receivableType === 'REC_BUSINESS' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleTypeChange('REC_BUSINESS')}
        >
          <Building2 className="h-6 w-6" />
          <span className="text-xs">商业应收</span>
        </Button>
        <Button
          type="button"
          variant={receivableType === 'REC_OTHER' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleTypeChange('REC_OTHER')}
        >
          <HelpCircle className="h-6 w-6" />
          <span className="text-xs">其他应收</span>
        </Button>
      </div>
    </div>
  );

  const renderFormFields = () => {
    if (!receivableType) return null;

    return (
      <div className="space-y-4">
        {/* 基础信息 */}
        <div className="space-y-2">
          <Label htmlFor="name">应收款名称 *</Label>
          <Input
            id="name"
            placeholder={
              receivableType === 'REC_PERSONAL_LOAN' ? '例如：借给张三购房款' :
              receivableType === 'REC_DEPOSIT' ? '例如：xx小区租房押金' :
              receivableType === 'REC_SALARY' ? '例如：2月工资' :
              receivableType === 'REC_BUSINESS' ? '例如：甲公司货款' :
              '例如：代付款项'
            }
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount">应收金额 *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="100000.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">币种</Label>
            <Select
              value={formData.currency}
              onValueChange={(value) => setFormData({ ...formData, currency: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CNY">CNY 人民币</SelectItem>
                <SelectItem value="USD">USD 美元</SelectItem>
                <SelectItem value="HKD">HKD 港币</SelectItem>
                <SelectItem value="EUR">EUR 欧元</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 通用字段：欠款人信息 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="debtorName">
              {receivableType === 'REC_BUSINESS' ? '对方公司/个人' : '欠款人'}
            </Label>
            <Input
              id="debtorName"
              placeholder={
                receivableType === 'REC_PERSONAL_LOAN' ? '例如：张三' :
                receivableType === 'REC_DEPOSIT' ? '例如：房东王先生' :
                receivableType === 'REC_SALARY' ? '例如：XX公司' :
                receivableType === 'REC_BUSINESS' ? '例如：甲方公司' :
                '例如：对方姓名'
              }
              value={formData.debtorName}
              onChange={(e) => setFormData({ ...formData, debtorName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="debtorContact">联系方式</Label>
            <Input
              id="debtorContact"
              placeholder="手机号/微信等"
              value={formData.debtorContact}
              onChange={(e) => setFormData({ ...formData, debtorContact: e.target.value })}
            />
          </div>
        </div>

        {/* 日期和状态 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lendDate">
              {receivableType === 'REC_PERSONAL_LOAN' ? '借出日期' : 
               receivableType === 'REC_DEPOSIT' ? '支付日期' : '发生日期'}
            </Label>
            <Input
              id="lendDate"
              type="date"
              value={formData.lendDate}
              onChange={(e) => setFormData({ ...formData, lendDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">
              {receivableType === 'REC_PERSONAL_LOAN' ? '约定还款日' : 
               receivableType === 'REC_DEPOSIT' ? '预计退还日' : '预计收回日'}
            </Label>
            <Input
              id="dueDate"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="repaymentStatus">收回状态</Label>
            <Select
              value={formData.repaymentStatus}
              onValueChange={(value) => setFormData({ ...formData, repaymentStatus: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">待收回</SelectItem>
                <SelectItem value="partial">部分收回</SelectItem>
                <SelectItem value="paid">已收回</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* 个人借款才显示利率 */}
          {receivableType === 'REC_PERSONAL_LOAN' && (
            <div className="space-y-2">
              <Label htmlFor="interestRate">约定年利率 (%)</Label>
              <Input
                id="interestRate"
                type="number"
                step="0.01"
                placeholder="0（无息借款）"
                value={formData.interestRate}
                onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
              />
            </div>
          )}
        </div>

        {/* 押金特有字段 */}
        {receivableType === 'REC_DEPOSIT' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="depositType">押金类型</Label>
              <Select
                value={formData.depositType}
                onValueChange={(value) => setFormData({ ...formData, depositType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">租房押金</SelectItem>
                  <SelectItem value="utility">水电燃气押金</SelectItem>
                  <SelectItem value="car">车辆押金</SelectItem>
                  <SelectItem value="membership">会员押金</SelectItem>
                  <SelectItem value="other">其他押金</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="depositAddress">关联地址/场所</Label>
              <Input
                id="depositAddress"
                placeholder="例如：xx小区x栋x单元"
                value={formData.depositAddress}
                onChange={(e) => setFormData({ ...formData, depositAddress: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* 薪资特有字段 */}
        {receivableType === 'REC_SALARY' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employer">雇主/公司</Label>
              <Input
                id="employer"
                placeholder="例如：XX科技有限公司"
                value={formData.employer}
                onChange={(e) => setFormData({ ...formData, employer: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salaryMonth">对应月份</Label>
              <Input
                id="salaryMonth"
                type="month"
                value={formData.salaryMonth}
                onChange={(e) => setFormData({ ...formData, salaryMonth: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* 商业应收特有字段 */}
        {receivableType === 'REC_BUSINESS' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">发票号</Label>
                <Input
                  id="invoiceNumber"
                  placeholder="例如：INV-2026-001"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractNumber">合同编号</Label>
                <Input
                  id="contractNumber"
                  placeholder="例如：CON-2026-001"
                  value={formData.contractNumber}
                  onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                />
              </div>
            </div>
          </>
        )}

        {/* 描述/备注 */}
        <div className="space-y-2">
          <Label htmlFor="description">备注</Label>
          <Textarea
            id="description"
            placeholder="补充说明信息"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加应收款</DialogTitle>
          <DialogDescription className="sr-only">
            添加个人借款、押金、薪资报销或商业应收等
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {renderTypeSelector()}
          {renderFormFields()}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading || !receivableType}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? '创建中...' : '创建'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
