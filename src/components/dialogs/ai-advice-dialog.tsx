'use client';

/**
 * AI配置建议对话框
 * Phase 5: 从侧边栏触发的AI建议功能
 * 支持提示词预览和编辑
 * 
 * 优化：使用 Dashboard 缓存数据生成提示词，避免重复调用汇率API
 * 
 * v2.0 重构：
 * - 修复内容截断问题
 * - 优化对话日志显示完整输入输出
 * - 优化提示词Tab布局
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Bot, 
  Sparkles, 
  Loader2, 
  AlertTriangle,
  RefreshCw,
  Eye,
  Edit3,
  ChevronDown,
  ChevronUp,
  FileText,
  Settings,
  Check,
  XCircle,
  CheckCircle2,
  Copy,
  CheckCheck
} from 'lucide-react';
import { formatters, type DashboardData } from '@/lib/api-client';

interface AIAdvice {
  adviceId: string;
  summary: string;
  confidence: number;
  targets: Array<{
    categoryCode: string;
    categoryName: string;
    currentPercent: number;
    suggestedPercent: number;
    reason: string;
  }>;
  actions: Array<{
    priority: number;
    category: string;
    categoryName: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    amount?: number;
    reason: string;
    // ✨ 二级资产信息
    subCategory?: string;
    suggestedProducts?: string[];
  }>;
  risks: string[];
  nextReviewDate: string;
  fullAnalysis: string;
  promptUsed?: {
    systemPrompt: string;
    userPrompt: string;
  };
  // ✨ 原始响应数据（用于对话日志）
  rawResponse?: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    responseTime: number;
    rawJson: string;
  };
}

interface PromptPreview {
  systemPrompt: string;
  userPrompt: string;
  aiConfig: {
    model: string;
    maxTokens: number;
    temperature: number;
  };
}

interface AIAdviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdviceReceived?: () => void;
  // ✨ 接收 Dashboard 缓存数据，避免重复调用API
  dashboardData?: DashboardData | null;
  // ✨ 新增：scope 参数，'family' 时使用家庭聚合数据
  scope?: 'personal' | 'family';
}

// 采纳状态
type AdoptionStatus = 'pending' | 'adopting' | 'adopted' | 'rejected';

// ✨ 复制按钮组件
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };
  
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <CheckCheck className="h-3 w-3 mr-1" />
          已复制
        </>
      ) : (
        <>
          <Copy className="h-3 w-3 mr-1" />
          {label || '复制'}
        </>
      )}
    </Button>
  );
}

export function AIAdviceDialog({ 
  open, 
  onOpenChange,
  onAdviceReceived,
  dashboardData,
  scope = 'personal',
}: AIAdviceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [advice, setAdvice] = useState<AIAdvice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userNotes, setUserNotes] = useState('');
  
  // 提示词相关状态
  const [promptPreview, setPromptPreview] = useState<PromptPreview | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [customUserPrompt, setCustomUserPrompt] = useState('');
  const [promptExpanded, setPromptExpanded] = useState(false);
  
  // ✨ 采纳状态
  const [adoptionStatus, setAdoptionStatus] = useState<AdoptionStatus>('pending');

  // ✨ 对话框关闭时重置状态，确保下次打开时重新获取提示词
  useEffect(() => {
    if (!open) {
      // 延迟重置，避免关闭动画时看到状态变化
      const timer = setTimeout(() => {
        setAdvice(null);
        setPromptPreview(null);
        setError(null);
        setEditMode(false);
        setCustomSystemPrompt('');
        setCustomUserPrompt('');
        setPromptExpanded(false);
        setAdoptionStatus('pending');
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  // 获取提示词预览 - 使用 Dashboard 缓存数据
  const fetchPromptPreview = async () => {
    try {
      setLoadingPrompt(true);
      setError(null);
      
      // ✨ 优化：如果有 dashboardData 且是个人视角，POST 到 API 生成提示词，不重新获取数据
      // 家庭视角不使用个人缓存数据，让API聚合家庭数据
      const useCache = dashboardData && scope !== 'family';
      const requestBody = useCache ? {
        previewOnly: true,
        userNotes: userNotes || undefined,
        scope,
        // 传递缓存数据，避免 API 重新获取
        cachedData: {
          overview: dashboardData.overview,
          allocationData: dashboardData.allocationData,
          portfolio: dashboardData.portfolio,
          // ✨ 修复：传递完整的底层敞口数据（包含二级分类和地区细分）
          underlyingTypePortfolio: dashboardData.underlyingTypePortfolio,
        },
      } : {
        previewOnly: true,
        userNotes: userNotes || undefined,
        scope,
      };
      
      const response = await fetch('/api/allocation/ai-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '获取提示词失败');
      }
      
      if (result.success && result.data) {
        setPromptPreview(result.data);
        setCustomSystemPrompt(result.data.systemPrompt);
        setCustomUserPrompt(result.data.userPrompt);
      }
    } catch (err) {
      console.error('获取提示词预览失败:', err);
      setError(err instanceof Error ? err.message : '获取提示词失败');
    } finally {
      setLoadingPrompt(false);
    }
  };

  // 打开对话框时自动获取提示词预览
  useEffect(() => {
    if (open && !promptPreview && !advice) {
      fetchPromptPreview();
    }
  }, [open, dashboardData]);

  // 请求AI建议
  const requestAdvice = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // ✨ 优化：如果有 dashboardData，传递缓存数据
      const requestBody: Record<string, unknown> = {
        userNotes: userNotes || undefined,
        // 如果在编辑模式且修改了提示词，使用自定义提示词
        customSystemPrompt: editMode ? customSystemPrompt : undefined,
        customUserPrompt: editMode ? customUserPrompt : undefined,
        scope,
      };
      
      // 传递缓存数据（家庭视角不使用个人缓存，让API聚合家庭数据）
      if (dashboardData && scope !== 'family') {
        requestBody.cachedData = {
          overview: dashboardData.overview,
          allocationData: dashboardData.allocationData,
          portfolio: dashboardData.portfolio,
          // ✨ 修复：传递完整的底层敞口数据（包含二级分类和地区细分）
          underlyingTypePortfolio: dashboardData.underlyingTypePortfolio,
        };
      }
      
      const response = await fetch('/api/allocation/ai-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '获取AI建议失败');
      }
      
      if (result.success && result.data) {
        setAdvice(result.data);
        setAdoptionStatus('pending');  // ✨ 重置采纳状态，等待用户操作
        // 注意：不再自动调用 onAdviceReceived，等用户点击"采纳建议"
      } else {
        throw new Error(result.error || '未获取到建议数据');
      }
    } catch (err) {
      console.error('请求AI建议失败:', err);
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  // 重置状态
  const handleClose = () => {
    // ✨ 修复：如果建议已采纳，关闭时刷新数据
    const shouldRefresh = adoptionStatus === 'adopted';
    
    setAdvice(null);
    setError(null);
    setUserNotes('');
    setPromptPreview(null);
    setEditMode(false);
    setCustomSystemPrompt('');
    setCustomUserPrompt('');
    setPromptExpanded(false);
    setAdoptionStatus('pending');  // ✨ 重置采纳状态
    onOpenChange(false);
    
    // ✨ 关闭对话框后再刷新数据
    if (shouldRefresh) {
      onAdviceReceived?.();
    }
  };

  // 重新开始
  const handleReset = () => {
    setAdvice(null);
    setError(null);
    setEditMode(false);
    setAdoptionStatus('pending');  // ✨ 重置采纳状态
    fetchPromptPreview();
  };
  
  // ✨ 采纳建议 - 将建议的配置目标保存到数据库
  const handleAdoptAdvice = async () => {
    if (!advice || !advice.targets || advice.targets.length === 0) {
      setError('没有可采纳的配置建议');
      return;
    }
    
    try {
      setAdoptionStatus('adopting');
      setError(null);
      
      // 将建议的目标配置保存到数据库
      const response = await fetch('/api/allocation/targets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets: advice.targets.map(t => ({
            categoryCode: t.categoryCode,
            targetPercent: t.suggestedPercent,
          })),
          source: 'AI_ADVICE',
          adviceId: advice.adviceId,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAdoptionStatus('adopted');
        // ✨ 修复：不再自动关闭对话框，让用户手动关闭
        // 数据刷新也改为用户关闭对话框时触发
      } else {
        throw new Error(result.error || '保存配置目标失败');
      }
    } catch (err) {
      console.error('采纳建议失败:', err);
      setError(err instanceof Error ? err.message : '采纳建议失败');
      setAdoptionStatus('pending');
    }
  };
  
  // ✨ 不采纳建议
  const handleRejectAdvice = () => {
    setAdoptionStatus('rejected');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        {/* ==================== 头部（固定） ==================== */}
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-500" />
            AI配置建议
          </DialogTitle>
          <DialogDescription>
            基于您的资产配置和家庭情况，获取智能投资建议
          </DialogDescription>
        </DialogHeader>

        {/* ==================== 主体内容（可滚动） ==================== */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* ==================== 未请求状态 - 显示提示词预览 ==================== */}
          {!advice && !loading && (
            <div className="space-y-4">
              {/* 补充说明输入 */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  补充说明（可选）
                </label>
                <Textarea
                  placeholder="例如：近期计划购房，需要预留首付款..."
                  value={userNotes}
                  onChange={(e) => {
                    setUserNotes(e.target.value);
                    // 输入改变时重新获取提示词
                    if (promptPreview) {
                      setPromptPreview(null);
                    }
                  }}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  描述您的特殊情况或需求，AI将据此提供更个性化的建议
                </p>
              </div>

              {/* 提示词预览/编辑区域 */}
              {loadingPrompt ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
                  <span className="text-muted-foreground">正在生成提示词...</span>
                </div>
              ) : promptPreview ? (
                <Collapsible open={promptExpanded} onOpenChange={setPromptExpanded}>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          提示词预览
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditMode(!editMode)}
                            className="h-8"
                          >
                            {editMode ? (
                              <>
                                <Eye className="h-4 w-4 mr-1" />
                                预览模式
                              </>
                            ) : (
                              <>
                                <Edit3 className="h-4 w-4 mr-1" />
                                编辑模式
                              </>
                            )}
                          </Button>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8">
                              {promptExpanded ? (
                                <>
                                  <ChevronUp className="h-4 w-4 mr-1" />
                                  收起
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4 mr-1" />
                                  展开
                                </>
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CollapsibleContent>
                      <CardContent className="space-y-4">
                        {/* AI配置信息 */}
                        <div className="flex items-center gap-4 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs">
                          <div className="flex items-center gap-1">
                            <Settings className="h-3 w-3" />
                            <span className="text-muted-foreground">模型:</span>
                            <span className="font-medium">{promptPreview.aiConfig.model}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">温度:</span>
                            <span className="font-medium ml-1">{promptPreview.aiConfig.temperature}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">最大Token:</span>
                            <span className="font-medium ml-1">{promptPreview.aiConfig.maxTokens}</span>
                          </div>
                        </div>

                        {/* ✨ 使用Tab切换系统提示词和用户提示词 */}
                        <Tabs defaultValue="user" className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="system" className="flex items-center gap-1">
                              🤖 系统提示词
                            </TabsTrigger>
                            <TabsTrigger value="user" className="flex items-center gap-1">
                              📝 用户提示词
                            </TabsTrigger>
                          </TabsList>
                          
                          {/* 系统提示词 Tab */}
                          <TabsContent value="system" className="mt-4">
                            <div className="flex justify-end mb-2">
                              <CopyButton text={promptPreview.systemPrompt} />
                            </div>
                            {editMode ? (
                              <Textarea
                                value={customSystemPrompt}
                                onChange={(e) => setCustomSystemPrompt(e.target.value)}
                                rows={15}
                                className="font-mono text-xs"
                              />
                            ) : (
                              <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded-lg whitespace-pre-wrap max-h-[400px] overflow-y-auto font-mono">
                                {promptPreview.systemPrompt}
                              </pre>
                            )}
                          </TabsContent>
                          
                          {/* 用户提示词 Tab */}
                          <TabsContent value="user" className="mt-4">
                            <div className="flex justify-end mb-2">
                              <CopyButton text={promptPreview.userPrompt} />
                            </div>
                            {editMode ? (
                              <Textarea
                                value={customUserPrompt}
                                onChange={(e) => setCustomUserPrompt(e.target.value)}
                                rows={15}
                                className="font-mono text-xs"
                              />
                            ) : (
                              <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded-lg whitespace-pre-wrap max-h-[400px] overflow-y-auto font-mono">
                                {promptPreview.userPrompt}
                              </pre>
                            )}
                          </TabsContent>
                        </Tabs>

                        {/* 重置提示词按钮（编辑模式下显示） */}
                        {editMode && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCustomSystemPrompt(promptPreview.systemPrompt);
                              setCustomUserPrompt(promptPreview.userPrompt);
                            }}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            重置为默认提示词
                          </Button>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={fetchPromptPreview}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  预览提示词
                </Button>
              )}

              {/* 错误提示 */}
              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                  <AlertTriangle className="h-4 w-4 inline mr-2" />
                  {error}
                </div>
              )}

              {/* 生成按钮 */}
              <Button
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                onClick={requestAdvice}
                disabled={loadingPrompt}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {editMode ? '使用自定义提示词生成AI建议' : '生成AI建议'}
              </Button>
            </div>
          )}

          {/* ==================== 加载中 ==================== */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
              <p className="text-muted-foreground">AI正在分析您的资产配置...</p>
              <p className="text-xs text-muted-foreground mt-1">预计需要10-30秒</p>
            </div>
          )}

          {/* ==================== 建议结果 ==================== */}
          {advice && !loading && (
            <div className="space-y-4">
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="summary">建议摘要</TabsTrigger>
                  <TabsTrigger value="actions">调仓建议</TabsTrigger>
                  <TabsTrigger value="targets">目标配置</TabsTrigger>
                  <TabsTrigger value="prompt">提示词</TabsTrigger>
                  <TabsTrigger value="log">对话日志</TabsTrigger>
                </TabsList>

                {/* 摘要标签页 */}
                <TabsContent value="summary" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">建议摘要</CardTitle>
                        <Badge variant="outline">
                          置信度 {Math.round(advice.confidence * 100)}%
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">{advice.summary}</p>
                    </CardContent>
                  </Card>

                  {/* 风险提示 */}
                  {advice.risks && advice.risks.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          风险提示
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {advice.risks.map((risk, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-yellow-500">•</span>
                              {risk}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* 调仓建议标签页 */}
                <TabsContent value="actions" className="space-y-4 mt-4">
                  {advice.actions && advice.actions.length > 0 ? (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">📈 调仓建议</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {advice.actions.map((action, index) => (
                          <div 
                            key={index}
                            className={`p-4 rounded-lg border ${
                              action.action === 'BUY' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
                              action.action === 'SELL' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
                              'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {/* 头部：优先级、分类名称、操作类型、金额 */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-muted-foreground">
                                  #{action.priority}
                                </span>
                                <span className="font-medium">{action.categoryName}</span>
                                <Badge variant={
                                  action.action === 'BUY' ? 'default' : 
                                  action.action === 'SELL' ? 'destructive' : 
                                  'secondary'
                                }>
                                  {action.action === 'BUY' ? '增配' : action.action === 'SELL' ? '减仓' : '维持'}
                                </Badge>
                              </div>
                              {action.amount && (
                                <span className="font-semibold text-lg">
                                  {formatters.currency(action.amount)}
                                </span>
                              )}
                            </div>
                            
                            {/* ✨ 二级资产信息 */}
                            {action.subCategory && (
                              <div className="mb-2 flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-xs">
                                  {action.subCategory}
                                </Badge>
                                {action.suggestedProducts && action.suggestedProducts.length > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    建议: {action.suggestedProducts.join(', ')}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {/* 原因说明 */}
                            <p className="text-sm text-muted-foreground">
                              {action.reason}
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-muted-foreground">暂无调仓建议</p>
                    </div>
                  )}
                </TabsContent>

                {/* 目标配置标签页 */}
                <TabsContent value="targets" className="space-y-4 mt-4">
                  {advice.targets && advice.targets.length > 0 ? (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">📊 建议配置</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {advice.targets.map((target, index) => {
                          const diff = target.suggestedPercent - target.currentPercent;
                          return (
                            <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <span className="font-medium">{target.categoryName}</span>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-muted-foreground">
                                  当前 {target.currentPercent.toFixed(1)}%
                                </span>
                                <span>→</span>
                                <span className="font-semibold text-blue-600">
                                  建议 {target.suggestedPercent.toFixed(1)}%
                                </span>
                                <span className={diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-slate-500'}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-muted-foreground">暂无配置建议</p>
                    </div>
                  )}
                </TabsContent>

                {/* 提示词标签页 - 重新设计 */}
                <TabsContent value="prompt" className="space-y-4 mt-4">
                  {advice.promptUsed ? (
                    <Tabs defaultValue="system" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="system">🤖 系统提示词</TabsTrigger>
                        <TabsTrigger value="user">📝 用户提示词</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="system" className="mt-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">系统提示词</CardTitle>
                              <CopyButton text={advice.promptUsed.systemPrompt} />
                            </div>
                          </CardHeader>
                          <CardContent>
                            <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded-lg whitespace-pre-wrap max-h-[500px] overflow-y-auto font-mono">
                              {advice.promptUsed.systemPrompt}
                            </pre>
                          </CardContent>
                        </Card>
                      </TabsContent>
                      
                      <TabsContent value="user" className="mt-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">用户提示词</CardTitle>
                              <CopyButton text={advice.promptUsed.userPrompt} />
                            </div>
                          </CardHeader>
                          <CardContent>
                            <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded-lg whitespace-pre-wrap max-h-[500px] overflow-y-auto font-mono">
                              {advice.promptUsed.userPrompt}
                            </pre>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-muted-foreground">暂无提示词记录</p>
                    </div>
                  )}
                </TabsContent>

                {/* ✨ 对话日志标签页 - 完全重写 */}
                <TabsContent value="log" className="space-y-4 mt-4">
                  {/* API 元数据（如果有） */}
                  {advice.rawResponse && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          API 调用信息
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground block">模型</span>
                            <p className="font-mono">{advice.rawResponse.model}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">输入 Tokens</span>
                            <p className="font-mono">{advice.rawResponse.promptTokens.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">输出 Tokens</span>
                            <p className="font-mono">{advice.rawResponse.completionTokens.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">响应时间</span>
                            <p className="font-mono">{(advice.rawResponse.responseTime / 1000).toFixed(2)}s</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 输入输出 Tabs */}
                  <Tabs defaultValue="input" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="input">📤 输入 (Prompt)</TabsTrigger>
                      <TabsTrigger value="output">📥 输出 (Response)</TabsTrigger>
                    </TabsList>
                    
                    {/* 输入 Tab */}
                    <TabsContent value="input" className="mt-4 space-y-4">
                      {/* 系统提示词 */}
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">🤖 系统提示词</CardTitle>
                            {advice.promptUsed?.systemPrompt && (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {advice.promptUsed.systemPrompt.length.toLocaleString()} 字符
                                </Badge>
                                <CopyButton text={advice.promptUsed.systemPrompt} />
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {advice.promptUsed?.systemPrompt ? (
                            <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded-lg whitespace-pre-wrap max-h-[400px] overflow-y-auto font-mono">
                              {advice.promptUsed.systemPrompt}
                            </pre>
                          ) : (
                            <p className="text-muted-foreground text-sm">无系统提示词记录</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* 用户提示词 */}
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">📝 用户提示词</CardTitle>
                            {advice.promptUsed?.userPrompt && (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {advice.promptUsed.userPrompt.length.toLocaleString()} 字符
                                </Badge>
                                <CopyButton text={advice.promptUsed.userPrompt} />
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {advice.promptUsed?.userPrompt ? (
                            <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded-lg whitespace-pre-wrap max-h-[400px] overflow-y-auto font-mono">
                              {advice.promptUsed.userPrompt}
                            </pre>
                          ) : (
                            <p className="text-muted-foreground text-sm">无用户提示词记录</p>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                    
                    {/* 输出 Tab */}
                    <TabsContent value="output" className="mt-4 space-y-4">
                      {/* AI 原始 JSON 响应 */}
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">🤖 AI 原始响应 (JSON)</CardTitle>
                            {advice.rawResponse?.rawJson && (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/20">
                                  {advice.rawResponse.rawJson.length.toLocaleString()} 字符
                                </Badge>
                                <CopyButton text={advice.rawResponse.rawJson} />
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {advice.rawResponse?.rawJson ? (
                            <pre className="text-xs bg-green-50 dark:bg-green-900/20 p-4 rounded-lg whitespace-pre-wrap max-h-[500px] overflow-y-auto font-mono">
                              {(() => {
                                try {
                                  return JSON.stringify(JSON.parse(advice.rawResponse.rawJson), null, 2);
                                } catch {
                                  return advice.rawResponse.rawJson;
                                }
                              })()}
                            </pre>
                          ) : (
                            <div className="space-y-3">
                              <p className="text-muted-foreground text-sm">
                                无原始响应记录（可能使用了规则引擎建议）
                              </p>
                              <p className="text-xs text-muted-foreground">解析后的建议数据：</p>
                              <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded-lg whitespace-pre-wrap max-h-[400px] overflow-y-auto font-mono">
                                {JSON.stringify({
                                  summary: advice.summary,
                                  confidence: advice.confidence,
                                  targets: advice.targets,
                                  actions: advice.actions,
                                  risks: advice.risks,
                                  nextReviewDate: advice.nextReviewDate,
                                }, null, 2)}
                              </pre>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* fullAnalysis 详细分析 */}
                      {advice.fullAnalysis && (
                        <Card>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">📊 详细分析报告</CardTitle>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20">
                                  {advice.fullAnalysis.length.toLocaleString()} 字符
                                </Badge>
                                <CopyButton text={advice.fullAnalysis} />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <pre className="text-xs bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                              {advice.fullAnalysis}
                            </pre>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              </Tabs>

              {/* ✨ 采纳/不采纳按钮区域 */}
              {adoptionStatus === 'pending' && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
                  <div className="text-center mb-4">
                    <p className="text-sm font-medium">是否采纳此建议？</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      采纳后将更新您的配置目标，用于追踪配置偏离
                    </p>
                  </div>
                  <div className="flex justify-center gap-4">
                    <Button
                      variant="outline"
                      className="min-w-[120px]"
                      onClick={handleRejectAdvice}
                    >
                      <XCircle className="h-4 w-4 mr-2 text-slate-500" />
                      暂不采纳
                    </Button>
                    <Button
                      className="min-w-[120px] bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                      onClick={handleAdoptAdvice}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      采纳建议
                    </Button>
                  </div>
                </div>
              )}
              
              {/* ✨ 采纳中状态 */}
              {adoptionStatus === 'adopting' && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    <span className="text-sm font-medium">正在保存配置目标...</span>
                  </div>
                </div>
              )}
              
              {/* ✨ 已采纳状态 */}
              {adoptionStatus === 'adopted' && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">
                      建议已采纳！配置目标已更新
                    </span>
                  </div>
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    点击"关闭"按钮刷新页面数据
                  </p>
                </div>
              )}
              
              {/* ✨ 不采纳状态 */}
              {adoptionStatus === 'rejected' && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      已跳过此建议，您可以重新生成或关闭对话框
                    </p>
                  </div>
                </div>
              )}

              {/* 重新生成按钮 */}
              <Button
                variant="outline"
                className="w-full text-slate-700 dark:text-slate-300"
                onClick={handleReset}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                重新生成
              </Button>
            </div>
          )}
        </div>

        {/* ==================== 底部（固定） ==================== */}
        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t bg-white dark:bg-slate-950">
          <Button variant="outline" onClick={handleClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
