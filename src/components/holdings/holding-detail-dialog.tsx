'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  DollarSign, 
  BarChart3, 
  ArrowLeftRight,
  Info,
  History
} from 'lucide-react'
import { TransferHoldingDialog } from './transfer-holding-dialog'
import { AssetActivityTimeline } from '@/components/shared/asset-activity-timeline'

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

interface HoldingDetailDialogProps {
  holding: Holding | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh?: () => void
}

export function HoldingDetailDialog({ holding, open, onOpenChange, onRefresh }: HoldingDetailDialogProps) {
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  
  if (!holding) return null

  const formatCurrency = (amount: number, currency: string = 'CNY') => {
    const symbol = currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : '¥'
    return `${symbol}${Math.abs(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`
  }

  const avgCost = holding.averageCost ?? holding.costBasis
  const totalCost = holding.quantity * avgCost
  const totalProfit = holding.unrealizedPnL

  const handleTransfer = () => {
    setTransferDialogOpen(true)
  }

  const handleTransferSuccess = () => {
    setTransferDialogOpen(false)
    onOpenChange(false)
    onRefresh?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            {holding.name}
            <Badge variant="outline">{holding.symbol}</Badge>
          </DialogTitle>
          <DialogDescription className="sr-only">
            查看 {holding.name} ({holding.symbol}) 的持仓详情
          </DialogDescription>
          <DialogDescription>
            查看 {holding.name} 的详细持仓信息和历史表现 · {holding.region} · {holding.sector}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              基本信息
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              更新记录
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: 基本信息 */}
          <TabsContent value="info" className="space-y-6 mt-4">
            {/* 核心指标 */}
            <div className="grid grid-cols-2 gap-4">
              {/* 当前价格 */}
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span>当前价格</span>
                </div>
                <p className="text-2xl font-bold">
                  {formatCurrency(holding.currentPrice, holding.currency)}
                </p>
              </div>

              {/* 持仓数量 */}
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <BarChart3 className="h-4 w-4" />
                  <span>持仓数量</span>
                </div>
                <p className="text-2xl font-bold">
                  {holding.quantity.toLocaleString()}
                </p>
              </div>

              {/* 市值 */}
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
                <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                  市场价值
                </div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(holding.marketValue, holding.currency)}
                </p>
              </div>

              {/* 成本 */}
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                <div className="text-sm text-muted-foreground mb-1">
                  总成本
                </div>
                <p className="text-2xl font-bold">
                  {formatCurrency(totalCost, holding.currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  成本价: {formatCurrency(avgCost, holding.currency)}
                </p>
              </div>
            </div>

            <Separator />

            {/* 盈亏分析 */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                {holding.unrealizedPnL >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
                盈亏分析
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* 未实现盈亏 */}
                <div className={`p-4 rounded-lg ${
                  holding.unrealizedPnL >= 0 
                    ? 'bg-green-50 dark:bg-green-950' 
                    : 'bg-red-50 dark:bg-red-950'
                }`}>
                  <div className="text-sm mb-1">未实现盈亏</div>
                  <p className={`text-2xl font-bold ${
                    holding.unrealizedPnL >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {holding.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(holding.unrealizedPnL, holding.currency)}
                  </p>
                  <p className={`text-sm mt-1 ${
                    holding.unrealizedPnL >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatPercent(holding.unrealizedPnLPercent)}
                  </p>
                </div>

                {/* 今日涨跌 */}
                <div className={`p-4 rounded-lg ${
                  holding.dayChangePercent >= 0 
                    ? 'bg-green-50 dark:bg-green-950' 
                    : 'bg-red-50 dark:bg-red-950'
                }`}>
                  <div className="text-sm mb-1">今日涨跌</div>
                  <p className={`text-2xl font-bold ${
                    holding.dayChangePercent >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {holding.dayChange >= 0 ? '+' : ''}{formatCurrency(holding.dayChange, holding.currency)}
                  </p>
                  <p className={`text-sm mt-1 ${
                    holding.dayChangePercent >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatPercent(holding.dayChangePercent)}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* 详细信息 */}
            <div>
              <h3 className="font-semibold mb-4">详细信息</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">股票代码</span>
                  <span className="font-medium">{holding.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">股票名称</span>
                  <span className="font-medium">{holding.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">所属地区</span>
                  <Badge>{holding.region}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">行业分类</span>
                  <Badge variant="secondary">{holding.sector}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">交易币种</span>
                  <span className="font-medium">{holding.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    最后更新
                  </span>
                  <span className="font-medium text-sm">{holding.lastUpdated}</span>
                </div>
              </div>
            </div>

            {/* 计算说明 */}
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 text-sm">
              <p className="text-blue-800 dark:text-blue-200 mb-2">
                <strong>盈亏计算公式：</strong>
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                未实现盈亏 = (当前价格 - 成本价) × 持仓数量
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                = ({formatCurrency(holding.currentPrice, holding.currency)} - {formatCurrency(avgCost, holding.currency)}) × {holding.quantity.toLocaleString()}
              </p>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                = {holding.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(holding.unrealizedPnL, holding.currency)}
              </p>
            </div>
          </TabsContent>

          {/* Tab 2: 更新记录 */}
          <TabsContent value="history" className="mt-4">
            <AssetActivityTimeline 
              assetId={holding.id}
              assetType="HOLDING"
            />
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          <Button onClick={handleTransfer}>
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            转移持仓
          </Button>
        </DialogFooter>
      </DialogContent>

      <TransferHoldingDialog
        holding={holding ? {
          id: holding.id,
          securityName: holding.name,
          symbol: holding.symbol,
          quantity: holding.quantity,
          averageCost: holding.averageCost ?? holding.costBasis,
          accountId: '',
          accountName: '',
        } : null}
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onSuccess={handleTransferSuccess}
      />
    </Dialog>
  )
}
