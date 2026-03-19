'use client';

/**
 * 快速操作面板
 * 包含添加持仓、家庭档案、导入数据、查看记录
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Upload, Clock, Users, Home } from 'lucide-react';
import type { QuickActionsPanelProps } from './types';

export function QuickActionsPanel({
  onAddRecord,
  onEditFamilyProfile,
  onImportData,
  onViewActivityLog,
  onManageFamily,
  hasFamilyId,
}: QuickActionsPanelProps) {
  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-2 px-0 pt-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          快速操作
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={onAddRecord}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            <Plus className="h-4 w-4 mr-1" />
            添加
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onEditFamilyProfile}
          >
            <Users className="h-4 w-4 mr-1" />
            档案
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onImportData}
          >
            <Upload className="h-4 w-4 mr-1" />
            导入
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onViewActivityLog}
          >
            <Clock className="h-4 w-4 mr-1" />
            记录
          </Button>
          {onManageFamily && (
            <Button
              size="sm"
              variant="outline"
              onClick={onManageFamily}
            >
              <Home className="h-4 w-4 mr-1" />
              {hasFamilyId ? '家庭' : '创建家庭'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
