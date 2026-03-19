'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface Holding {
  id: string
  symbol: string
  name: string
  quantity: number
  currentPrice: number
  costBasis: number
  averageCost?: number // 成本单价（原币种）
  marketValue: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  dayChange: number
  dayChangePercent: number
  sector: string
  region: string
  currency: string
  lastUpdated: string
}

interface EditHoldingDialogProps {
  holding: Holding | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (holdingId: string, data: EditHoldingData) => Promise<void>
}

export interface EditHoldingData {
  quantity: number
  costBasis: number
  currentPrice: number
  currency: string
}

export function EditHoldingDialog({ holding, open, onOpenChange, onSave }: EditHoldingDialogProps) {
  const [formData, setFormData] = useState<EditHoldingData>({
    quantity: 0,
    costBasis: 0,
    currentPrice: 0,
    currency: 'CNY',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 当holding变化时更新表单数据
  useEffect(() => {
    if (holding) {
      setFormData({
        quantity: holding.quantity,
        costBasis: holding.averageCost ?? holding.costBasis,
        currentPrice: holding.currentPrice,
        currency: holding.currency || 'CNY',
      })
      setErrors({})
    }
  }, [holding])

  if (!holding) return null

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (formData.quantity <= 0) {
      newErrors.quantity = '持仓数量必须大于0'
    }

    if (formData.costBasis <= 0) {
      newErrors.costBasis = '成本价必须大于0'
    }

    if (formData.currentPrice <= 0) {
      newErrors.currentPrice = '当前价格必须大于0'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return

    try {
      setIsSaving(true)
      await onSave(holding.id, formData)
      onOpenChange(false)
    } catch (error) {
      console.error('保存失败:', error)
      setErrors({ submit: '保存失败，请重试' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (field: keyof EditHoldingData, value: string) => {
    // 允许空字符串和数字输入
    const numValue = value === '' ? 0 : parseFloat(value) || 0
    setFormData(prev => ({ ...prev, [field]: numValue }))
    
    // 清除该字段的错误
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  // 处理输入框聚焦时的行为
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // 如果值是0，则全选内容，方便用户直接输入
    if (e.target.value === '0') {
      e.target.select()
    }
  }

  // 计算预览
  const previewMarketValue = formData.quantity * formData.currentPrice
  const previewTotalCost = formData.quantity * formData.costBasis
  const previewUnrealizedPnL = previewMarketValue - previewTotalCost
  const previewPnLPercent = previewTotalCost > 0 
    ? (previewUnrealizedPnL / previewTotalCost) * 100 
    : 0

  const formatCurrency = (amount: number) => {
    const symbol = formData.currency === 'USD' ? '$' : formData.currency === 'HKD' ? 'HK$' : '¥'
    return `${symbol}${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>编辑持仓</DialogTitle>
          <DialogDescription>
            修改 {holding.name} ({holding.symbol}) 的持仓信息
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 货币类型 */}
          <div className="space-y-2">
            <Label htmlFor="currency">
              货币类型 <span className="text-red-500">*</span>
            </Label>
            <select
              id="currency"
              value={formData.currency}
              onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="CNY">人民币 (CNY)</option>
              <option value="USD">美元 (USD)</option>
              <option value="HKD">港币 (HKD)</option>
            </select>
          </div>

          {/* 持仓数量 */}
          <div className="space-y-2">
            <Label htmlFor="quantity">
              持仓数量 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              step="1"
              value={formData.quantity}
              onChange={(e) => handleInputChange('quantity', e.target.value)}
              onFocus={handleInputFocus}
              placeholder="请输入持仓数量"
              className={errors.quantity ? 'border-red-500' : ''}
            />
            {errors.quantity && (
              <p className="text-sm text-red-500">{errors.quantity}</p>
            )}
          </div>

          {/* 成本价 */}
          <div className="space-y-2">
            <Label htmlFor="costBasis">
              成本价 ({formData.currency}) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="costBasis"
              type="number"
              min="0"
              step="0.01"
              value={formData.costBasis}
              onChange={(e) => handleInputChange('costBasis', e.target.value)}
              onFocus={handleInputFocus}
              placeholder="请输入成本价"
              className={errors.costBasis ? 'border-red-500' : ''}
            />
            {errors.costBasis && (
              <p className="text-sm text-red-500">{errors.costBasis}</p>
            )}
          </div>

          {/* 当前价格 */}
          <div className="space-y-2">
            <Label htmlFor="currentPrice">
              当前价格 ({formData.currency}) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="currentPrice"
              type="number"
              min="0"
              step="0.01"
              value={formData.currentPrice}
              onChange={(e) => handleInputChange('currentPrice', e.target.value)}
              onFocus={handleInputFocus}
              placeholder="请输入当前价格"
              className={errors.currentPrice ? 'border-red-500' : ''}
            />
            {errors.currentPrice && (
              <p className="text-sm text-red-500">{errors.currentPrice}</p>
            )}
          </div>

          {/* 预览计算 */}
          {formData.quantity > 0 && formData.costBasis > 0 && formData.currentPrice > 0 && (
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-2">
              <h4 className="font-medium text-sm mb-3">预览计算</h4>
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">市场价值</span>
                <span className="font-medium">{formatCurrency(previewMarketValue)}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">总成本</span>
                <span className="font-medium">{formatCurrency(previewTotalCost)}</span>
              </div>
              
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">未实现盈亏</span>
                  <span className={`font-bold ${
                    previewUnrealizedPnL >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {previewUnrealizedPnL >= 0 ? '+' : ''}{formatCurrency(previewUnrealizedPnL)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">盈亏比例</span>
                  <span className={`font-bold ${
                    previewPnLPercent >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {previewPnLPercent >= 0 ? '+' : ''}{previewPnLPercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {errors.submit && (
            <p className="text-sm text-red-500 text-center">{errors.submit}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
