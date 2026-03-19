'use client';

/**
 * AI建议历史对话框
 * Phase 5: 从侧边栏触发的建议历史查看
 * 
 * v2.0 重构：
 * - 与 ai-advice-dialog.tsx 保持一致的布局
 * - 添加完整的提示词和对话日志Tab
 * - 修复内容截断问题
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  History, 
  Bot, 
  Loader2,
  ArrowLeft,
  AlertTriangle,
  Settings,
  Copy,
  CheckCheck
} from 'lucide-react';
import { formatters } from '@/lib/api-client';

interface AdviceHistoryItem {
  id: string;
  summary: string;
  status: string;
  createdAt: string;
}

interface AdviceDetail {
  id: string;
  summary: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  appliedAt?: string;
  confidence?: number;
  advice?: {
    targets?: Array<{
      categoryCode: string;
      categoryName: string;
      currentPercent: number;
      suggestedPercent: number;
      reason: string;
    }>;
    actions?: Array<{
      priority: number;
      category: string;
      categoryName: string;
      action: 'BUY' | 'SELL' | 'HOLD';
      amount?: number;
      reason: string;
      subCategory?: string;
      suggestedProducts?: string[];
    }>;
    risks?: string[];
    fullAnalysis?: string;
  };
  portfolioSnapshot?: {
    totalAssets: number;
    allocation: Array<{
      type?: string;
      typeName?: string;
      code?: string;
      name?: string;
      value: number;
      percentage: number;
    }>;
  };
  // ✨ v2.0：新增字段
  promptUsed?: {
    systemPrompt: string;
    userPrompt: string;
  };
  rawResponse?: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    responseTime: number;
    rawJson: string;
  };
  userFeedback?: string;
}

interface AdviceHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope?: 'personal' | 'family';
}

// ✨ 复制按钮组件（与 ai-advice-dialog 一致）
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

export function AdviceHistoryDialog({ 
  open, 
  onOpenChange,
  scope = 'personal',
}: AdviceHistoryDialogProps) {
  const [history, setHistory] = useState<AdviceHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdvice, setSelectedAdvice] = useState<AdviceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 获取历史列表
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const scopeParam = scope === 'family' ? '&scope=family' : '';
      const response = await fetch(`/api/allocation/advice-history?limit=20${scopeParam}`);
      const result = await response.json();
      
      if (result.success) {
        setHistory(result.data || []);
      } else {
        console.error('获取建议历史失败:', result.error);
        setHistory([]);
      }
    } catch (error) {
      console.error('获取建议历史失败:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  // 获取详情
  const fetchDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      const response = await fetch(`/api/allocation/advice-history/${id}`);
      const result = await response.json();
      
      if (result.success) {
        setSelectedAdvice(result.data);
      } else {
        console.error('获取详情失败:', result.error);
      }
    } catch (error) {
      console.error('获取详情失败:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchHistory();
      setSelectedAdvice(null); // 重置选中状态
    }
  }, [open, fetchHistory]);

  // 获取状态标签样式
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">已采纳</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">未采纳</Badge>;
      case 'PARTIAL':
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">部分采纳</Badge>;
      default:
        return <Badge variant="outline">待处理</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        {/* ==================== 头部（固定） ==================== */}
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-500" />
            AI建议历史
          </DialogTitle>
          <DialogDescription>
            查看历史AI建议记录和执行情况
          </DialogDescription>
        </DialogHeader>

        {/* ==================== 主体内容（可滚动） ==================== */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* 列表视图 */}
          {!selectedAdvice && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">暂无AI建议历史</h3>
                  <p className="text-sm text-muted-foreground">
                    点击"获取AI建议"按钮，生成您的第一条配置建议
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div 
                      key={item.id}
                      className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => fetchDetail(item.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium line-clamp-2">{item.summary}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(item.createdAt).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {getStatusBadge(item.status)}
                          {detailLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 详情加载中 */}
          {detailLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mr-2" />
              <span className="text-muted-foreground">加载详情中...</span>
            </div>
          )}

          {/* ==================== 详情视图 ==================== */}
          {selectedAdvice && !detailLoading && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAdvice(null)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回列表
              </Button>

              {/* 基础信息 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm">
                <div>
                  <span className="text-muted-foreground block">生成时间</span>
                  <p className="font-medium">{new Date(selectedAdvice.createdAt).toLocaleString('zh-CN')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground block">置信度</span>
                  <p className="font-medium">
                    {selectedAdvice.confidence ? `${(selectedAdvice.confidence * 100).toFixed(0)}%` : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground block">有效期</span>
                  <p className="font-medium">{new Date(selectedAdvice.expiresAt).toLocaleDateString('zh-CN')}</p>
                </div>
                <div className="flex items-center">
                  {getStatusBadge(selectedAdvice.status)}
                </div>
              </div>

              {/* ✨ 5个Tab与AI建议对话框一致 */}
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
                          置信度 {selectedAdvice.confidence ? Math.round(selectedAdvice.confidence * 100) : 0}%
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">{selectedAdvice.summary}</p>
                    </CardContent>
                  </Card>

                  {/* 风险提示 */}
                  {selectedAdvice.advice?.risks && selectedAdvice.advice.risks.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          风险提示
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {selectedAdvice.advice.risks.map((risk, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-yellow-500">•</span>
                              {risk}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* 当时的资产快照 */}
                  {selectedAdvice.portfolioSnapshot && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">📸 当时的资产快照</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-sm text-muted-foreground">总资产</p>
                          <p className="text-2xl font-bold">
                            {formatters.currency(selectedAdvice.portfolioSnapshot.totalAssets)}
                          </p>
                        </div>
                        <div className="space-y-2">
                          {selectedAdvice.portfolioSnapshot.allocation.map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-2 border-b last:border-b-0">
                              <span>{item.typeName || item.name || item.type || item.code}</span>
                              <div className="flex items-center gap-4">
                                <span className="text-muted-foreground">{item.percentage.toFixed(1)}%</span>
                                <span className="font-semibold">{formatters.currency(item.value)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* 调仓建议标签页 */}
                <TabsContent value="actions" className="space-y-4 mt-4">
                  {selectedAdvice.advice?.actions && selectedAdvice.advice.actions.length > 0 ? (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">📈 调仓建议</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedAdvice.advice.actions.map((action, index) => (
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
                            
                            {/* 二级资产信息 */}
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
                  {selectedAdvice.advice?.targets && selectedAdvice.advice.targets.length > 0 ? (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">📊 建议配置</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {selectedAdvice.advice.targets.map((target, index) => {
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

                {/* 提示词标签页 */}
                <TabsContent value="prompt" className="space-y-4 mt-4">
                  {selectedAdvice.promptUsed ? (
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
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {selectedAdvice.promptUsed.systemPrompt.length.toLocaleString()} 字符
                                </Badge>
                                <CopyButton text={selectedAdvice.promptUsed.systemPrompt} />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded-lg whitespace-pre-wrap max-h-[500px] overflow-y-auto font-mono">
                              {selectedAdvice.promptUsed.systemPrompt}
                            </pre>
                          </CardContent>
                        </Card>
                      </TabsContent>
                      
                      <TabsContent value="user" className="mt-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">用户提示词</CardTitle>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {selectedAdvice.promptUsed.userPrompt.length.toLocaleString()} 字符
                                </Badge>
                                <CopyButton text={selectedAdvice.promptUsed.userPrompt} />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded-lg whitespace-pre-wrap max-h-[500px] overflow-y-auto font-mono">
                              {selectedAdvice.promptUsed.userPrompt}
                            </pre>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-muted-foreground">暂无提示词记录</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        早期版本的建议可能未保存提示词信息
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* 对话日志标签页 */}
                <TabsContent value="log" className="space-y-4 mt-4">
                  {/* API 元数据（如果有） */}
                  {selectedAdvice.rawResponse && (
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
                            <p className="font-mono">{selectedAdvice.rawResponse.model}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">输入 Tokens</span>
                            <p className="font-mono">{selectedAdvice.rawResponse.promptTokens.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">输出 Tokens</span>
                            <p className="font-mono">{selectedAdvice.rawResponse.completionTokens.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">响应时间</span>
                            <p className="font-mono">{(selectedAdvice.rawResponse.responseTime / 1000).toFixed(2)}s</p>
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
                            {selectedAdvice.promptUsed?.systemPrompt && (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {selectedAdvice.promptUsed.systemPrompt.length.toLocaleString()} 字符
                                </Badge>
                                <CopyButton text={selectedAdvice.promptUsed.systemPrompt} />
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {selectedAdvice.promptUsed?.systemPrompt ? (
                            <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded-lg whitespace-pre-wrap max-h-[400px] overflow-y-auto font-mono">
                              {selectedAdvice.promptUsed.systemPrompt}
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
                            {selectedAdvice.promptUsed?.userPrompt && (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {selectedAdvice.promptUsed.userPrompt.length.toLocaleString()} 字符
                                </Badge>
                                <CopyButton text={selectedAdvice.promptUsed.userPrompt} />
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {selectedAdvice.promptUsed?.userPrompt ? (
                            <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded-lg whitespace-pre-wrap max-h-[400px] overflow-y-auto font-mono">
                              {selectedAdvice.promptUsed.userPrompt}
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
                            {selectedAdvice.rawResponse?.rawJson && (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/20">
                                  {selectedAdvice.rawResponse.rawJson.length.toLocaleString()} 字符
                                </Badge>
                                <CopyButton text={selectedAdvice.rawResponse.rawJson} />
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {selectedAdvice.rawResponse?.rawJson ? (
                            <pre className="text-xs bg-green-50 dark:bg-green-900/20 p-4 rounded-lg whitespace-pre-wrap max-h-[500px] overflow-y-auto font-mono">
                              {(() => {
                                try {
                                  return JSON.stringify(JSON.parse(selectedAdvice.rawResponse!.rawJson), null, 2);
                                } catch {
                                  return selectedAdvice.rawResponse!.rawJson;
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
                                  summary: selectedAdvice.summary,
                                  confidence: selectedAdvice.confidence,
                                  targets: selectedAdvice.advice?.targets,
                                  actions: selectedAdvice.advice?.actions,
                                  risks: selectedAdvice.advice?.risks,
                                }, null, 2)}
                              </pre>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* fullAnalysis 详细分析 */}
                      {selectedAdvice.advice?.fullAnalysis && (
                        <Card>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">📊 详细分析报告</CardTitle>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20">
                                  {selectedAdvice.advice.fullAnalysis.length.toLocaleString()} 字符
                                </Badge>
                                <CopyButton text={selectedAdvice.advice.fullAnalysis} />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <pre className="text-xs bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                              {selectedAdvice.advice.fullAnalysis}
                            </pre>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>

        {/* ==================== 底部（固定） ==================== */}
        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t bg-white dark:bg-slate-950">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
