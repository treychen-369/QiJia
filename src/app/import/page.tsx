'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { FileUpload } from '@/components/import/file-upload'
import { DataPreview } from '@/components/import/data-preview'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowLeft, Download, HelpCircle, Users, LogOut, Settings, User, ChevronDown } from 'lucide-react'
import Link from 'next/link'

interface ImportState {
  step: 'upload' | 'preview' | 'importing' | 'success'
  file: File | null
  previewData: any | null
  importResult: any | null
  error: string | null
  overwriteMode: boolean
}

export default function ImportPage() {
  const { data: session, status } = useSession()
  const [state, setState] = useState<ImportState>({
    step: 'upload',
    file: null,
    previewData: null,
    importResult: null,
    error: null,
    overwriteMode: true // 默认使用覆盖模式
  })

  // 如果未登录，重定向到登录页
  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  }

  if (!session) {
    redirect('/auth/signin')
  }

  const handleFileSelect = async (file: File) => {
    setState(prev => ({ ...prev, file, error: null }))

    try {
      // 验证文件
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/import/validate', {
        method: 'POST',
        body: formData,
        credentials: 'include' // 确保包含cookies
      })

      const result = await response.json()

      if (result.success) {
        setState(prev => ({
          ...prev,
          step: 'preview',
          previewData: result.data
        }))
        toast.success('文件解析成功！')
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || '文件验证失败'
        }))
        toast.error(result.error || '文件验证失败')
      }
    } catch (error) {
      const errorMessage = '文件处理失败，请重试'
      setState(prev => ({ ...prev, error: errorMessage }))
      toast.error(errorMessage)
    }
  }

  const handleFileRemove = () => {
    setState({
      step: 'upload',
      file: null,
      previewData: null,
      importResult: null,
      error: null,
      overwriteMode: state.overwriteMode // 保持覆盖模式设置
    })
  }

  const handleImport = async () => {
    if (!state.file) return

    setState(prev => ({ ...prev, step: 'importing' }))

    try {
      const formData = new FormData()
      formData.append('file', state.file)
      formData.append('options', JSON.stringify({ 
        overwrite: state.overwriteMode 
      }))

      console.log('Sending import request...');
      const response = await fetch('/api/import/excel', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      let result;
      try {
        result = await response.json();
        console.log('Response JSON:', result);
      } catch (jsonError) {
        console.error('Failed to parse JSON:', jsonError);
        const text = await response.text();
        console.error('Response text:', text);
        throw new Error(`服务器返回了无效的响应 (${response.status}): ${text}`);
      }

      if (result.success) {
        setState(prev => ({
          ...prev,
          step: 'success',
          importResult: result.data
        }))
        toast.success('数据导入成功！')
      } else {
        console.error('Import failed:', result);
        const errorMessage = result.error || '数据导入失败';
        const detailsMessage = result.details ? 
          (typeof result.details === 'string' ? result.details : JSON.stringify(result.details, null, 2)) : 
          '';
        
        setState(prev => ({
          ...prev,
          step: 'preview',
          error: `${errorMessage}${detailsMessage ? '\n\n详细信息:\n' + detailsMessage : ''}`
        }))
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('Import error:', error)
      const errorMessage = error instanceof Error ? error.message : '导入过程中发生错误，请重试'
      setState(prev => ({
        ...prev,
        step: 'preview',
        error: errorMessage
      }))
      toast.error(errorMessage)
    }
  }

  const handleStartOver = () => {
    setState({
      step: 'upload',
      file: null,
      previewData: null,
      importResult: null,
      error: null,
      overwriteMode: true
    })
  }

  const handleDownloadTemplate = () => {
    try {
      // 创建模板内容
      const templateContent = `财务数据导入模板

=== 账户余额 (account_balance) ===
账户名称,余额,货币,账户类型,备注
招商银行储蓄卡,50000,CNY,储蓄账户,主要储蓄账户
支付宝余额,8500,CNY,电子钱包,日常支付账户
微信零钱,1200,CNY,电子钱包,小额支付

=== 资产明细 (asset_details) ===
资产名称,股票代码,持有数量,当前价格,市场价值,成本基础,未实现盈亏,资产类型,所属市场
平安银行,000001,1000,12.50,12500,11800,700,股票,SZ
招商银行,600036,500,34.50,17250,16500,750,股票,SH
贵州茅台,600519,10,1650,16500,16000,500,股票,SH

=== 投资计划 (investment_plan) ===
计划名称,目标金额,当前金额,目标日期,风险等级,状态,预期收益率,投资类型
稳健投资计划,100000,46250,2026-12-31,中等,进行中,8%,混合型
高收益计划,50000,16500,2027-06-30,高,进行中,15%,股票型

=== 市场数据 (market_details) ===
指数名称,指数代码,当前点位,昨收点位,涨跌点数,涨跌幅,成交量,日期
上证指数,000001,3200,3180,20,0.63%,250000000,2026-01-24
深证成指,399001,11500,11450,50,0.44%,180000000,2026-01-24

=== 策略输出 (strategy_output) ===
策略名称,推荐股票,股票代码,推荐理由,目标价格,风险评级,推荐时间,有效期
价值投资策略,平安银行,000001,估值合理基本面良好,15.00,B,2026-01-24,2026-03-24
成长投资策略,招商银行,600036,业绩增长稳定行业前景好,40.00,A,2026-01-24,2026-04-24

使用说明：
1. 请根据上述格式准备您的数据
2. 每个部分对应一个CSV文件或Excel工作表
3. 保持列名不变，填入您的实际数据
4. 日期格式：YYYY-MM-DD
5. 数字请使用阿拉伯数字，不要包含货币符号
6. 上传时请选择对应的文件类型进行导入
`;

      // 创建并下载文件
      const blob = new Blob([templateContent], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '财务数据导入模板.txt';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('模板文件下载成功！');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('模板文件下载失败，请重试');
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut({ 
        callbackUrl: '/',
        redirect: true 
      });
    } catch (error) {
      console.error('退出登录失败:', error);
      toast.error('退出登录失败，请重试');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <Link href="/dashboard-v2">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回仪表板
            </Button>
          </Link>
          
          {/* 用户菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {session?.user?.name || 'User'}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {session?.user?.name || 'User'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {session?.user?.email || ''}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.location.href = '/dashboard-v2'}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span>返回仪表板</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.href = '/settings/sync'}>
                <Settings className="mr-2 h-4 w-4" />
                <span>系统设置</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleSignOut}
                className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>退出登录</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          数据导入
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mt-2">
          将您的Excel财务数据导入到系统中
        </p>
      </div>

      {/* 步骤指示器 */}
      <div className="mb-8">
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-2 ${
            state.step === 'upload' ? 'text-blue-600' : 
            ['preview', 'importing', 'success'].includes(state.step) ? 'text-green-600' : 'text-gray-400'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              state.step === 'upload' ? 'bg-blue-600 text-white' :
              ['preview', 'importing', 'success'].includes(state.step) ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              1
            </div>
            <span className="font-medium">上传文件</span>
          </div>
          
          <div className={`w-8 h-0.5 ${
            ['preview', 'importing', 'success'].includes(state.step) ? 'bg-green-600' : 'bg-gray-300'
          }`} />
          
          <div className={`flex items-center space-x-2 ${
            state.step === 'preview' ? 'text-blue-600' : 
            ['importing', 'success'].includes(state.step) ? 'text-green-600' : 'text-gray-400'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              state.step === 'preview' ? 'bg-blue-600 text-white' :
              ['importing', 'success'].includes(state.step) ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              2
            </div>
            <span className="font-medium">预览数据</span>
          </div>
          
          <div className={`w-8 h-0.5 ${
            state.step === 'success' ? 'bg-green-600' : 'bg-gray-300'
          }`} />
          
          <div className={`flex items-center space-x-2 ${
            state.step === 'success' ? 'text-green-600' : 'text-gray-400'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              state.step === 'success' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              3
            </div>
            <span className="font-medium">导入完成</span>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="space-y-6">
        {state.step === 'upload' && (
          <>
            {/* 使用说明 */}
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-blue-900 dark:text-blue-100">导入说明</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-blue-800 dark:text-blue-200">
                <ul className="space-y-2 text-sm">
                  <li>• 支持导入您现有的Excel财务数据文件</li>
                  <li>• 系统会自动识别账户余额、资产明细、投资计划等数据</li>
                  <li>• 导入前会进行数据验证，确保格式正确</li>
                  <li>• 建议先下载模板文件，了解标准格式</li>
                </ul>
                <div className="mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-blue-700 border-blue-300 hover:bg-blue-100"
                    onClick={handleDownloadTemplate}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载模板文件
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 导入选项 */}
            <Card>
              <CardHeader>
                <CardTitle>导入选项</CardTitle>
                <CardDescription>
                  选择数据导入的方式
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id="overwrite"
                      name="importMode"
                      checked={state.overwriteMode}
                      onChange={() => setState(prev => ({ ...prev, overwriteMode: true }))}
                      className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                    />
                    <label htmlFor="overwrite" className="flex-1 cursor-pointer">
                      <div className="font-medium text-gray-900 dark:text-white">
                        覆盖模式（推荐）
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        清空现有数据，用新文件完全替换。适合全量数据更新。
                      </div>
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id="merge"
                      name="importMode"
                      checked={!state.overwriteMode}
                      onChange={() => setState(prev => ({ ...prev, overwriteMode: false }))}
                      className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                    />
                    <label htmlFor="merge" className="flex-1 cursor-pointer">
                      <div className="font-medium text-gray-900 dark:text-white">
                        增量模式
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        保留现有数据，只添加或更新新数据。可能导致数据重复。
                      </div>
                    </label>
                  </div>
                  
                  {state.overwriteMode && (
                    <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <div className="flex items-start space-x-2">
                        <div className="text-amber-600 dark:text-amber-400 mt-0.5">⚠️</div>
                        <div className="text-sm text-amber-800 dark:text-amber-200">
                          <strong>注意：</strong>覆盖模式将删除您的所有现有财务数据，包括账户余额、持仓信息、投资计划等。此操作不可撤销，请确保新文件包含完整的数据。
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 文件上传 */}
            <FileUpload
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              error={state.error || undefined}
            />
          </>
        )}

        {state.step === 'preview' && state.previewData && (
          <DataPreview
            data={state.previewData}
            onImport={handleImport}
            isImporting={false}
          />
        )}

        {state.step === 'importing' && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">正在导入数据...</h3>
              <p className="text-muted-foreground">
                请稍候，系统正在处理您的数据，这可能需要几分钟时间
              </p>
            </CardContent>
          </Card>
        )}

        {state.step === 'success' && state.importResult && (
          <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="text-green-900 dark:text-green-100 flex items-center">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                数据导入成功！
              </CardTitle>
              <CardDescription className="text-green-700 dark:text-green-300">
                您的财务数据已成功导入系统，现在可以开始使用各项功能了
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* 导入摘要 */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {state.importResult.importResult?.summary?.accountBalances?.created || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">账户余额</div>
                </div>
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {state.importResult.importResult?.summary?.holdings?.created || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">持仓记录</div>
                </div>
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {state.importResult.importResult?.summary?.investmentPlans?.created || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">投资计划</div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/dashboard-v2" className="flex-1">
                  <Button className="w-full">
                    查看仪表板
                  </Button>
                </Link>
                <Button variant="outline" onClick={handleStartOver} className="flex-1">
                  导入更多数据
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}