'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2, AlertTriangle } from 'lucide-react'

interface Holding {
  id: string
  symbol: string
  name: string
  quantity: number
  marketValue: number
  currency: string
}

interface DeleteHoldingDialogProps {
  holding: Holding | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (holdingId: string) => Promise<void>
}

export function DeleteHoldingDialog({ holding, open, onOpenChange, onConfirm }: DeleteHoldingDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  if (!holding) return null

  const handleConfirm = async () => {
    try {
      setIsDeleting(true)
      await onConfirm(holding.id)
      onOpenChange(false)
    } catch (error) {
      console.error('删除失败:', error)
      // 错误会在父组件处理
    } finally {
      setIsDeleting(false)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    const symbol = currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : '¥'
    return `${symbol}${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            确认删除持仓记录
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                您确定要删除以下持仓记录吗？此操作无法撤销。
              </p>
              
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">股票名称</span>
                  <span className="font-medium">{holding.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">股票代码</span>
                  <span className="font-medium">{holding.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">持仓数量</span>
                  <span className="font-medium">{holding.quantity.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">市场价值</span>
                  <span className="font-medium">
                    {formatCurrency(holding.marketValue, holding.currency)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ <strong>注意：</strong>删除后，此持仓的所有历史数据将被永久清除，无法恢复。
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            确认删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
