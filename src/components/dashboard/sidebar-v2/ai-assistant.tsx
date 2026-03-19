'use client';

/**
 * AI配置助手面板
 * 提供AI建议入口和最近建议摘要
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, History, Sparkles } from 'lucide-react';
import type { AIAssistantPanelProps } from './types';

export function AIAssistantPanel({
  onRequestAdvice,
  onViewHistory,
  latestAdvice,
  isLoading = false,
  canRequestAdvice = true,
}: AIAssistantPanelProps) {
  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-2 px-0 pt-0">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-blue-500" />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            AI配置助手
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 space-y-3">
        {/* 获取AI建议按钮 - 仅有权限时显示 */}
        {canRequestAdvice ? (
          <Button
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            onClick={onRequestAdvice}
            disabled={isLoading}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {isLoading ? '分析中...' : '获取AI建议'}
          </Button>
        ) : (
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-center">
            <p className="text-xs text-muted-foreground">
              仅家庭管理员可发起AI建议
            </p>
          </div>
        )}

        {/* 最近建议摘要 */}
        {latestAdvice ? (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">最近建议</span>
              <Badge variant="outline" className="text-xs">
                {formatTime(latestAdvice.createdAt)}
              </Badge>
            </div>
            <p className="text-sm line-clamp-2 text-slate-700 dark:text-slate-300">
              {latestAdvice.summary}
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-center">
            <p className="text-xs text-muted-foreground">
              {canRequestAdvice ? '暂无AI建议，点击上方按钮获取' : '暂无AI建议'}
            </p>
          </div>
        )}

        {/* 查看历史链接 */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground hover:text-foreground"
          onClick={onViewHistory}
        >
          <History className="h-4 w-4 mr-2" />
          查看建议历史
        </Button>
      </CardContent>
    </Card>
  );
}
