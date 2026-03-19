'use client'

import React, { useState } from 'react'
import { CheckCircle2, AlertTriangle, Info, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { formatCurrency, formatPercentage, cn } from '@/lib/utils'

interface DataPreviewProps {
  data: {
    validation: {
      isValid: boolean
      errors: string[]
      warnings: string[]
    }
    preview: {
      accountBalances: any[]
      assetDetails: any[]
      investmentPlans: any[]
      marketDetails: any[]
      strategyOutputs: any[]
    }
    summary: {
      totalSheets: number
      processedSheets: number
      totalRows: number
      processedRows: number
      errorRows: number
    }
    canImport: boolean
  }
  onImport: () => void
  isImporting?: boolean
}

export function DataPreview({ data, onImport, isImporting = false }: DataPreviewProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true,
    validation: true,
    preview: false
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const { validation, preview, summary, canImport } = data

  return (
    <div className="space-y-6">
      {/* 验证状态概览 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {validation.isValid ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              )}
              <CardTitle className="text-lg">
                {validation.isValid ? '数据验证通过' : '数据验证失败'}
              </CardTitle>
            </div>
            <Badge variant={validation.isValid ? 'default' : 'destructive'}>
              {validation.isValid ? '可以导入' : '需要修复'}
            </Badge>
          </div>
          <CardDescription>
            {validation.isValid 
              ? '所有数据格式正确，可以安全导入到系统中'
              : '发现数据问题，请检查并修复后重新上传'
            }
          </CardDescription>
        </CardHeader>
      </Card>

      {/* 数据摘要 */}
      <Collapsible 
        open={expandedSections.summary || false} 
        onOpenChange={() => toggleSection('summary')}
      >
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">数据摘要</CardTitle>
                {expandedSections.summary ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{summary.processedSheets}</div>
                  <div className="text-sm text-muted-foreground">工作表</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{summary.processedRows}</div>
                  <div className="text-sm text-muted-foreground">数据行</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {summary.processedRows - summary.errorRows}
                  </div>
                  <div className="text-sm text-muted-foreground">成功解析</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-danger-600">{summary.errorRows}</div>
                  <div className="text-sm text-muted-foreground">解析错误</div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 验证结果 */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <Collapsible 
          open={expandedSections.validation || false} 
          onOpenChange={() => toggleSection('validation')}
        >
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">验证结果</CardTitle>
                  <div className="flex items-center space-x-2">
                    {validation.errors.length > 0 && (
                      <Badge variant="destructive">{validation.errors.length} 错误</Badge>
                    )}
                    {validation.warnings.length > 0 && (
                      <Badge variant="secondary">{validation.warnings.length} 警告</Badge>
                    )}
                    {expandedSections.validation ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {validation.errors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-danger-600 mb-2">错误</h4>
                    <div className="space-y-2">
                      {validation.errors.map((error, index) => (
                        <div key={index} className="flex items-start space-x-2 text-sm">
                          <AlertTriangle className="w-4 h-4 text-danger-600 mt-0.5 flex-shrink-0" />
                          <span className="text-danger-700">{error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {validation.warnings.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-yellow-600 mb-2">警告</h4>
                    <div className="space-y-2">
                      {validation.warnings.map((warning, index) => (
                        <div key={index} className="flex items-start space-x-2 text-sm">
                          <Info className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <span className="text-warning-700">{warning}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* 数据预览 */}
      <Collapsible 
        open={expandedSections.preview || false} 
        onOpenChange={() => toggleSection('preview')}
      >
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">数据预览</CardTitle>
                {expandedSections.preview ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </div>
              <CardDescription>
                查看解析后的数据样例，确认格式正确
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <Tabs defaultValue="accounts" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="accounts">账户余额</TabsTrigger>
                  <TabsTrigger value="assets">资产明细</TabsTrigger>
                  <TabsTrigger value="plans">投资计划</TabsTrigger>
                  <TabsTrigger value="market">市场数据</TabsTrigger>
                  <TabsTrigger value="strategy">策略输出</TabsTrigger>
                </TabsList>

                <TabsContent value="accounts" className="mt-4">
                  <AccountBalancePreview data={preview.accountBalances} />
                </TabsContent>

                <TabsContent value="assets" className="mt-4">
                  <AssetDetailPreview data={preview.assetDetails} />
                </TabsContent>

                <TabsContent value="plans" className="mt-4">
                  <InvestmentPlanPreview data={preview.investmentPlans} />
                </TabsContent>

                <TabsContent value="market" className="mt-4">
                  <MarketDataPreview data={preview.marketDetails} />
                </TabsContent>

                <TabsContent value="strategy" className="mt-4">
                  <StrategyOutputPreview data={preview.strategyOutputs} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 导入按钮 */}
      <div className="flex justify-end space-x-4">
        <Button
          onClick={onImport}
          disabled={!canImport || isImporting}
          size="lg"
          className="min-w-32"
        >
          {isImporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              导入中...
            </>
          ) : (
            '确认导入'
          )}
        </Button>
      </div>
    </div>
  )
}

// 各个数据类型的预览组件
function AccountBalancePreview({ data }: { data: any[] }) {
  if (data.length === 0) {
    return <div className="text-center text-muted-foreground py-8">暂无账户余额数据</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">账户名称</th>
            <th className="text-left p-2">币种</th>
            <th className="text-right p-2">当前市值</th>
            <th className="text-right p-2">现金余额</th>
            <th className="text-right p-2">总体占比</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index} className="border-b">
              <td className="p-2 font-medium">{item.accountName}</td>
              <td className="p-2">{item.currency}</td>
              <td className="p-2 text-right number-display">
                {formatCurrency(item.currentValueCny)}
              </td>
              <td className="p-2 text-right number-display">
                {formatCurrency(item.cashBalanceOriginal)}
              </td>
              <td className="p-2 text-right">
                {formatPercentage(item.totalRatio)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AssetDetailPreview({ data }: { data: any[] }) {
  if (data.length === 0) {
    return <div className="text-center text-muted-foreground py-8">暂无资产明细数据</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">资产类别</th>
            <th className="text-left p-2">标的地区</th>
            <th className="text-left p-2">标的名称</th>
            <th className="text-right p-2">市值(¥)</th>
            <th className="text-right p-2">占比</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index} className="border-b">
              <td className="p-2">{item.assetCategory}</td>
              <td className="p-2">{item.region}</td>
              <td className="p-2 font-medium">{item.security}</td>
              <td className="p-2 text-right number-display">
                {formatCurrency(item.valueCny)}
              </td>
              <td className="p-2 text-right">
                {formatPercentage(item.ratio)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function InvestmentPlanPreview({ data }: { data: any[] }) {
  if (data.length === 0) {
    return <div className="text-center text-muted-foreground py-8">暂无投资计划数据</div>
  }

  return (
    <div className="space-y-4">
      {data.map((item, index) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">总盘子</div>
                <div className="font-medium">{formatCurrency(item.totalPortfolio)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">可投资金额</div>
                <div className="font-medium">{formatCurrency(item.availableCash)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">投资比例</div>
                <div className="font-medium">{formatPercentage(item.investmentRatio)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">计划投资额</div>
                <div className="font-medium">{formatCurrency(item.plannedInvestment)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function MarketDataPreview({ data }: { data: any[] }) {
  if (data.length === 0) {
    return <div className="text-center text-muted-foreground py-8">暂无市场数据</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">指数名称</th>
            <th className="text-left p-2">代码</th>
            <th className="text-right p-2">当前点位</th>
            <th className="text-right p-2">PE</th>
            <th className="text-right p-2">估值百分位</th>
            <th className="text-left p-2">状态</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index} className="border-b">
              <td className="p-2 font-medium">{item.indexName}</td>
              <td className="p-2 font-mono">{item.code}</td>
              <td className="p-2 text-right number-display">{item.currentLevel}</td>
              <td className="p-2 text-right">{item.peRatio}</td>
              <td className="p-2 text-right">{formatPercentage(item.valuationPercentile)}</td>
              <td className="p-2">
                <Badge variant={item.status === '合理' ? 'default' : 'secondary'}>
                  {item.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StrategyOutputPreview({ data }: { data: any[] }) {
  if (data.length === 0) {
    return <div className="text-center text-muted-foreground py-8">暂无策略输出数据</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">资产类别</th>
            <th className="text-right p-2">当前市值</th>
            <th className="text-right p-2">当前占比</th>
            <th className="text-right p-2">目标占比</th>
            <th className="text-right p-2">偏离度</th>
            <th className="text-left p-2">建议操作</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index} className="border-b">
              <td className="p-2 font-medium">{item.assetCategory}</td>
              <td className="p-2 text-right number-display">
                {formatCurrency(item.currentValue)}
              </td>
              <td className="p-2 text-right">{formatPercentage(item.currentRatio)}</td>
              <td className="p-2 text-right">{formatPercentage(item.targetRatio)}</td>
              <td className={cn(
                "p-2 text-right",
                item.deviation > 0 ? "text-red-600" : item.deviation < 0 ? "text-green-600" : ""
              )}>
                {formatPercentage(Math.abs(item.deviation))}
              </td>
              <td className="p-2">
                <Badge variant={
                  item.recommendedAction === '增持' ? 'default' : 
                  item.recommendedAction === '减持' ? 'destructive' : 'secondary'
                }>
                  {item.recommendedAction}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}