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
import { CreditCard, Home as HomeIcon, Car, Building, Loader2 } from 'lucide-react';
import { LiabilityType as PrismaLiabilityType } from '@prisma/client';

interface LiabilityData {
  id: string;
  name: string;
  type: PrismaLiabilityType;
  description?: string;
  principalAmount: number;
  currentBalance: number;
  interestRate?: number;
  monthlyPayment?: number;
  currency: string;
  startDate?: string;
  maturityDate?: string;
  nextPaymentDate?: string;
  metadata?: any;
}

interface AddLiabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editData?: LiabilityData | null;
}

type LiabilityType = 'mortgage' | 'car_loan' | 'personal_loan' | 'credit_card';

// 将 Prisma 类型转换为表单类型
function prismaTypeToFormType(type: PrismaLiabilityType): LiabilityType | '' {
  const mapping: Record<PrismaLiabilityType, LiabilityType | ''> = {
    MORTGAGE: 'mortgage',
    CAR_LOAN: 'car_loan',
    PERSONAL_LOAN: 'personal_loan',
    CREDIT_CARD: 'credit_card',
    BUSINESS_LOAN: 'personal_loan',
    STUDENT_LOAN: 'personal_loan',
    PAYABLE: 'personal_loan',
    OTHER: 'personal_loan',
  };
  return mapping[type] || '';
}

export function AddLiabilityDialog({ open, onOpenChange, onSuccess, editData }: AddLiabilityDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [liabilityType, setLiabilityType] = useState<LiabilityType | ''>('');

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    principalAmount: '',
    currentBalance: '',
    interestRate: '',
    monthlyPayment: '',
    currency: 'CNY',
    startDate: '',
    maturityDate: '',
    nextPaymentDate: '',
    // 房贷特有字段
    propertyAddress: '',
    loanToValue: '', // 贷款价值比（LTV）
    // 车贷特有字段
    vehicleMake: '', // 车辆品牌
    vehicleModel: '', // 车型
    vehicleYear: '', // 年份
    // 信用卡特有字段
    cardNumber: '', // 卡号后4位
    creditLimit: '', // 信用额度
    bank: '', // 发卡银行
    // 个人贷款特有字段
    loanPurpose: '', // 贷款用途
    lender: '', // 出借方
  });

  // 编辑模式：初始化表单数据
  useEffect(() => {
    if (open && editData) {
      const metadata = editData.metadata || {};
      setLiabilityType(prismaTypeToFormType(editData.type));
      setFormData({
        name: editData.name || '',
        description: editData.description || '',
        principalAmount: editData.principalAmount?.toString() || '',
        currentBalance: editData.currentBalance?.toString() || '',
        interestRate: editData.interestRate?.toString() || '',
        monthlyPayment: editData.monthlyPayment?.toString() || '',
        currency: editData.currency || 'CNY',
        startDate: editData.startDate ? new Date(editData.startDate).toISOString().split('T')[0] : '',
        maturityDate: editData.maturityDate ? new Date(editData.maturityDate).toISOString().split('T')[0] : '',
        nextPaymentDate: editData.nextPaymentDate ? new Date(editData.nextPaymentDate).toISOString().split('T')[0] : '',
        propertyAddress: metadata.propertyAddress || '',
        loanToValue: metadata.loanToValue?.toString() || '',
        vehicleMake: metadata.vehicleMake || '',
        vehicleModel: metadata.vehicleModel || '',
        vehicleYear: metadata.vehicleYear || '',
        cardNumber: metadata.cardNumber || '',
        creditLimit: metadata.creditLimit?.toString() || '',
        bank: metadata.bank || '',
        loanPurpose: metadata.loanPurpose || '',
        lender: metadata.lender || '',
      });
    } else if (open && !editData) {
      // 添加模式：重置表单
      setLiabilityType('');
      setFormData({
        name: '',
        description: '',
        principalAmount: '',
        currentBalance: '',
        interestRate: '',
        monthlyPayment: '',
        currency: 'CNY',
        startDate: '',
        maturityDate: '',
        nextPaymentDate: '',
        propertyAddress: '',
        loanToValue: '',
        vehicleMake: '',
        vehicleModel: '',
        vehicleYear: '',
        cardNumber: '',
        creditLimit: '',
        bank: '',
        loanPurpose: '',
        lender: '',
      });
    }
  }, [open, editData]);

  const handleLiabilityTypeChange = (type: LiabilityType) => {
    setLiabilityType(type);
    // 只在添加模式下重置表单
    if (!editData) {
      setFormData({
        name: '',
        description: '',
        principalAmount: '',
        currentBalance: '',
        interestRate: '',
        monthlyPayment: '',
        currency: 'CNY',
        startDate: '',
        maturityDate: '',
        nextPaymentDate: '',
        propertyAddress: '',
        loanToValue: '',
        vehicleMake: '',
        vehicleModel: '',
        vehicleYear: '',
        cardNumber: '',
        creditLimit: '',
        bank: '',
        loanPurpose: '',
        lender: '',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!liabilityType) {
      toast({
        variant: 'destructive',
        title: '请选择负债类型',
      });
      return;
    }

    if (!formData.name || !formData.principalAmount || !formData.currentBalance) {
      toast({
        variant: 'destructive',
        title: '请填写必填项',
        description: '负债名称、本金和当前余额为必填项',
      });
      return;
    }

    setIsLoading(true);

    try {
      // 构建元数据
      const metadata: any = { type: liabilityType };

      if (liabilityType === 'mortgage') {
        metadata.propertyAddress = formData.propertyAddress;
        metadata.loanToValue = parseFloat(formData.loanToValue || '0');
      } else if (liabilityType === 'car_loan') {
        metadata.vehicleMake = formData.vehicleMake;
        metadata.vehicleModel = formData.vehicleModel;
        metadata.vehicleYear = formData.vehicleYear;
      } else if (liabilityType === 'credit_card') {
        metadata.cardNumber = formData.cardNumber;
        metadata.creditLimit = parseFloat(formData.creditLimit || '0');
        metadata.bank = formData.bank;
      } else if (liabilityType === 'personal_loan') {
        metadata.loanPurpose = formData.loanPurpose;
        metadata.lender = formData.lender;
      }

      const isEdit = !!editData;
      const url = '/api/liabilities';
      const method = isEdit ? 'PUT' : 'POST';

      const bodyData: any = {
        name: formData.name,
        description: formData.description,
        currentBalance: parseFloat(formData.currentBalance),
        interestRate: parseFloat(formData.interestRate || '0'),
        monthlyPayment: parseFloat(formData.monthlyPayment || '0'),
        nextPaymentDate: formData.nextPaymentDate || null,
        metadata,
      };

      // 编辑模式需要 id
      if (isEdit) {
        bodyData.id = editData.id;
      } else {
        // 添加模式需要完整字段
        bodyData.type = liabilityType;
        bodyData.principalAmount = parseFloat(formData.principalAmount);
        bodyData.currency = formData.currency;
        bodyData.startDate = formData.startDate || null;
        bodyData.maturityDate = formData.maturityDate || null;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || (isEdit ? '更新失败' : '创建失败'));
      }

      toast({
        title: isEdit ? '更新成功' : '创建成功',
        description: isEdit ? '负债已更新' : '负债已添加',
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error(editData ? '更新负债失败:' : '创建负债失败:', error);
      toast({
        variant: 'destructive',
        title: editData ? '更新失败' : '创建失败',
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderLiabilityTypeSelector = () => (
    <div className="space-y-4">
      <Label>选择负债类型 *</Label>
      <div className="grid grid-cols-4 gap-3">
        <Button
          type="button"
          variant={liabilityType === 'mortgage' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleLiabilityTypeChange('mortgage')}
        >
          <HomeIcon className="h-6 w-6" />
          <span>房贷</span>
        </Button>
        <Button
          type="button"
          variant={liabilityType === 'car_loan' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleLiabilityTypeChange('car_loan')}
        >
          <Car className="h-6 w-6" />
          <span>车贷</span>
        </Button>
        <Button
          type="button"
          variant={liabilityType === 'personal_loan' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleLiabilityTypeChange('personal_loan')}
        >
          <Building className="h-6 w-6" />
          <span>个人贷款</span>
        </Button>
        <Button
          type="button"
          variant={liabilityType === 'credit_card' ? 'default' : 'outline'}
          className="h-auto flex-col gap-2 py-4"
          onClick={() => handleLiabilityTypeChange('credit_card')}
        >
          <CreditCard className="h-6 w-6" />
          <span>信用卡</span>
        </Button>
      </div>
    </div>
  );

  const renderFormFields = () => {
    if (!liabilityType) return null;

    return (
      <div className="space-y-4">
        {/* 基础信息 */}
        <div className="space-y-2">
          <Label htmlFor="name">负债名称 *</Label>
          <Input
            id="name"
            placeholder={
              liabilityType === 'mortgage' ? '例如：海淀区公寓房贷' :
              liabilityType === 'car_loan' ? '例如：奔驰E300车贷' :
              liabilityType === 'credit_card' ? '例如：招商银行信用卡' :
              '例如：装修贷款'
            }
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">描述</Label>
          <Textarea
            id="description"
            placeholder="补充说明信息"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>

        {/* 房贷特有字段 */}
        {liabilityType === 'mortgage' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="propertyAddress">房产地址</Label>
              <Input
                id="propertyAddress"
                placeholder="例如：北京市海淀区中关村大街1号"
                value={formData.propertyAddress}
                onChange={(e) => setFormData({ ...formData, propertyAddress: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="loanToValue">贷款价值比（LTV %）</Label>
              <Input
                id="loanToValue"
                type="number"
                step="0.01"
                placeholder="70.00"
                value={formData.loanToValue}
                onChange={(e) => setFormData({ ...formData, loanToValue: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">贷款金额占房产价值的百分比</p>
            </div>
          </>
        )}

        {/* 车贷特有字段 */}
        {liabilityType === 'car_loan' && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicleMake">车辆品牌</Label>
                <Input
                  id="vehicleMake"
                  placeholder="例如：奔驰"
                  value={formData.vehicleMake}
                  onChange={(e) => setFormData({ ...formData, vehicleMake: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleModel">车型</Label>
                <Input
                  id="vehicleModel"
                  placeholder="例如：E300"
                  value={formData.vehicleModel}
                  onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleYear">年份</Label>
                <Input
                  id="vehicleYear"
                  placeholder="例如：2023"
                  value={formData.vehicleYear}
                  onChange={(e) => setFormData({ ...formData, vehicleYear: e.target.value })}
                />
              </div>
            </div>
          </>
        )}

        {/* 信用卡特有字段 */}
        {liabilityType === 'credit_card' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bank">发卡银行</Label>
                <Input
                  id="bank"
                  placeholder="例如：招商银行"
                  value={formData.bank}
                  onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cardNumber">卡号后4位</Label>
                <Input
                  id="cardNumber"
                  placeholder="例如：1234"
                  maxLength={4}
                  value={formData.cardNumber}
                  onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="creditLimit">信用额度</Label>
              <Input
                id="creditLimit"
                type="number"
                step="0.01"
                placeholder="50000.00"
                value={formData.creditLimit}
                onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
              />
            </div>
          </>
        )}

        {/* 个人贷款特有字段 */}
        {liabilityType === 'personal_loan' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lender">出借方</Label>
                <Input
                  id="lender"
                  placeholder="例如：中国银行"
                  value={formData.lender}
                  onChange={(e) => setFormData({ ...formData, lender: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loanPurpose">贷款用途</Label>
                <Select
                  value={formData.loanPurpose}
                  onValueChange={(value) => setFormData({ ...formData, loanPurpose: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择用途" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="renovation">装修</SelectItem>
                    <SelectItem value="education">教育</SelectItem>
                    <SelectItem value="medical">医疗</SelectItem>
                    <SelectItem value="business">经营</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}

        {/* 通用金额字段 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="principalAmount">本金总额 *</Label>
            <Input
              id="principalAmount"
              type="number"
              step="0.01"
              placeholder="1000000.00"
              value={formData.principalAmount}
              onChange={(e) => setFormData({ ...formData, principalAmount: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currentBalance">当前余额 *</Label>
            <Input
              id="currentBalance"
              type="number"
              step="0.01"
              placeholder="800000.00"
              value={formData.currentBalance}
              onChange={(e) => setFormData({ ...formData, currentBalance: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="interestRate">年利率（%）</Label>
            <Input
              id="interestRate"
              type="number"
              step="0.01"
              placeholder="4.50"
              value={formData.interestRate}
              onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthlyPayment">月供（元）</Label>
            <Input
              id="monthlyPayment"
              type="number"
              step="0.01"
              placeholder="5000.00"
              value={formData.monthlyPayment}
              onChange={(e) => setFormData({ ...formData, monthlyPayment: e.target.value })}
            />
          </div>
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

        {/* 日期字段 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">开始日期</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maturityDate">到期日期</Label>
            <Input
              id="maturityDate"
              type="date"
              value={formData.maturityDate}
              onChange={(e) => setFormData({ ...formData, maturityDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nextPaymentDate">下次还款日</Label>
            <Input
              id="nextPaymentDate"
              type="date"
              value={formData.nextPaymentDate}
              onChange={(e) => setFormData({ ...formData, nextPaymentDate: e.target.value })}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? '编辑负债' : '添加负债'}</DialogTitle>
          <DialogDescription className="sr-only">
            {editData ? '编辑' : '添加'}房贷、车贷、个人贷款或信用卡负债
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {renderLiabilityTypeSelector()}
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
            <Button type="submit" disabled={isLoading || !liabilityType}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? (editData ? '更新中...' : '创建中...') : (editData ? '保存' : '创建')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
