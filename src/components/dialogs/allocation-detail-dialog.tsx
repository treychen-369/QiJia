'use client';

/**
 * 配置分析详情对话框
 * 展示完整的配置分析信息：偏离情况、告警、评分明细
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Target, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Loader2,
  Sparkles,
  Settings,
  BarChart3,
  ArrowRight
} from 'lucide-react';

interface DeviationItem {
  categoryCode: string;
  categoryName: string;
  currentPercent: number;
  targetPercent: number;
  deviation: number;
  deviationStatus: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

interface AlertItem {
  type: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestion?: string;
}

interface ScoreBreakdown {
  category: string;
  score: number;
  maxScore: number;
  description: string;
}

interface AllocationDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestAIAdvice?: () => void;
  onEditTargets?: () => void;
}

export function AllocationDetailDialog({ 
  open, 
  onOpenChange,
  onRequestAIAdvice,
  onEditTargets
}: AllocationDetailDialogProps) {
  const [loading, setLoading] = useState(true);
  const [overallScore, setOverallScore] = useState(0);
  const [deviations, setDeviations] = useState<DeviationItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown[]>([]);

  // 获取配置分析数据
  useEffect(() => {
    if (open) {
      fetchAllocationData();
    }
  }, [open]);

  const fetchAllocationData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/allocation/analysis');
      const result = await response.json();
      
      if (result.success && result.data) {
        setOverallScore(result.data.overallScore || 0);
        setDeviations(result.data.fullAnalysis || result.data.topDeviations || []);
        setAlerts(result.data.alerts || []);
        setScoreBreakdown(result.data.scoreBreakdown || []);
      }
    } catch (error) {
      console.error('获取配置分析失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CRITICAL': return 'text-red-500';
      case 'WARNING': return 'text-yellow-500';
      default: return 'text-green-500';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'CRITICAL': return 'bg-red-100 dark:bg-red-900/30';
      case 'WARNING': return 'bg-yellow-100 dark:bg-yellow-900/30';
      default: return 'bg-green-100 dark:bg-green-900/30';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            配置分析详情
          </DialogTitle>
          <DialogDescription>
            查看资产配置的健康度评分和偏离分析
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-6 py-2">
              {/* 综合评分卡片 */}
              <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-0">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center justify-center w-20 h-20 rounded-full ${
                        overallScore >= 80 
                          ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                          : overallScore >= 60 
                            ? 'bg-yellow-100 dark:bg-yellow-900/30'
                            : 'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        <span className={`text-3xl font-bold ${
                          overallScore >= 80 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : overallScore >= 60 
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-red-600 dark:text-red-400'
                        }`}>
                          {overallScore}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">目标达成度</h3>
                        <p className="text-sm text-muted-foreground">
                          {overallScore >= 80 
                            ? '配置健康，继续保持！' 
                            : overallScore >= 60 
                              ? '存在一些偏离，建议关注'
                              : '偏离较大，建议及时调整'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {overallScore >= 80 ? (
                        <CheckCircle className="h-8 w-8 text-emerald-500" />
                      ) : overallScore >= 60 ? (
                        <AlertTriangle className="h-8 w-8 text-yellow-500" />
                      ) : (
                        <AlertCircle className="h-8 w-8 text-red-500" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 各类别偏离分析 */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  配置偏离分析
                </h4>
                <div className="space-y-3">
                  {deviations.map((item) => (
                    <div 
                      key={item.categoryCode} 
                      className={`p-3 rounded-lg border ${getStatusBg(item.deviationStatus)}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{item.categoryName}</span>
                        <div className="flex items-center gap-2">
                          {item.deviationStatus !== 'NORMAL' && (
                            <Badge 
                              variant={item.deviationStatus === 'CRITICAL' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {item.deviation > 0 ? '超配' : '低配'}
                            </Badge>
                          )}
                          <span className={`text-sm font-semibold ${getStatusColor(item.deviationStatus)}`}>
                            {item.deviation > 0 ? '+' : ''}{item.deviation.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>当前: {item.currentPercent.toFixed(1)}%</span>
                            <span>目标: {item.targetPercent.toFixed(1)}%</span>
                          </div>
                          <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            {/* 目标位置指示线 */}
                            <div 
                              className="absolute top-0 bottom-0 w-0.5 bg-slate-400 dark:bg-slate-500 z-10"
                              style={{ left: `${Math.min(item.targetPercent, 100)}%` }}
                            />
                            {/* 当前进度 */}
                            <div 
                              className={`h-full rounded-full transition-all ${
                                item.deviationStatus === 'NORMAL' 
                                  ? 'bg-emerald-500' 
                                  : item.deviationStatus === 'WARNING'
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(item.currentPercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 告警信息 */}
              {alerts.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    告警信息
                  </h4>
                  <div className="space-y-2">
                    {alerts.map((alert, index) => (
                      <div 
                        key={index}
                        className="p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-start gap-3">
                          <Badge variant={getSeverityColor(alert.severity) as any} className="text-xs shrink-0">
                            {alert.severity === 'HIGH' ? '高' : alert.severity === 'MEDIUM' ? '中' : '低'}
                          </Badge>
                          <div className="flex-1">
                            <p className="text-sm">{alert.message}</p>
                            {alert.suggestion && (
                              <p className="text-xs text-muted-foreground mt-1">
                                建议: {alert.suggestion}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 评分明细 */}
              {scoreBreakdown.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    评分明细
                  </h4>
                  <div className="space-y-2">
                    {scoreBreakdown.map((item, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">{item.category}</span>
                            <span className="text-sm font-medium">{item.score}/{item.maxScore}</span>
                          </div>
                          <Progress value={(item.score / item.maxScore) * 100} className="h-1.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* 底部操作按钮 */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={onRequestAIAdvice}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            AI建议
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onEditTargets?.();
              }}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              调整目标
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
