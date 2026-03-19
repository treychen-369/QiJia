'use client';

/**
 * 编辑配置目标对话框
 * Phase 5: 从侧边栏触发的配置目标编辑
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
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Target, 
  Loader2,
  Save,
  RotateCcw
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface AllocationTarget {
  categoryCode: string;
  categoryName: string;
  targetPercent: number;
  minPercent: number;
  maxPercent: number;
  color?: string;
}

interface EditTargetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

export function EditTargetsDialog({ 
  open, 
  onOpenChange,
  onSave 
}: EditTargetsDialogProps) {
  const [targets, setTargets] = useState<AllocationTarget[]>([]);
  const [editedTargets, setEditedTargets] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 获取当前目标
  useEffect(() => {
    if (open) {
      fetchTargets();
    }
  }, [open]);

  const fetchTargets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/allocation/targets');
      const result = await response.json();
      
      // API返回格式: { success: true, data: { targets: [...], lastUpdated: ... } }
      if (result.success && result.data?.targets && Array.isArray(result.data.targets)) {
        setTargets(result.data.targets);
        // 初始化编辑状态
        const initial: Record<string, number> = {};
        result.data.targets.forEach((t: AllocationTarget) => {
          initial[t.categoryCode] = t.targetPercent;
        });
        setEditedTargets(initial);
      } else {
        console.warn('配置目标数据格式异常:', result);
        setTargets([]);
      }
    } catch (error) {
      console.error('获取配置目标失败:', error);
      setTargets([]);
    } finally {
      setLoading(false);
    }
  };

  // 计算总百分比
  const totalPercent = Object.values(editedTargets).reduce((sum, val) => sum + val, 0);

  // 更新目标
  const handleSliderChange = (code: string, value: number) => {
    setEditedTargets(prev => ({
      ...prev,
      [code]: value
    }));
  };

  // 重置
  const handleReset = () => {
    const initial: Record<string, number> = {};
    targets.forEach(t => {
      initial[t.categoryCode] = t.targetPercent;
    });
    setEditedTargets(initial);
  };

  // 保存
  const handleSave = async () => {
    if (Math.abs(totalPercent - 100) > 0.5) {
      toast({
        title: '总比例必须为100%',
        description: `当前总比例为 ${totalPercent.toFixed(1)}%，请调整后再保存`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      
      const updates = Object.entries(editedTargets).map(([code, percent]) => ({
        categoryCode: code,
        targetPercent: percent,
      }));

      const response = await fetch('/api/allocation/targets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: updates }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: '保存成功',
          description: '配置目标已更新',
        });
        onSave?.();
        onOpenChange(false);
      } else {
        throw new Error(result.error || '保存失败');
      }
    } catch (error) {
      console.error('保存配置目标失败:', error);
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-500" />
            编辑配置目标
          </DialogTitle>
          <DialogDescription>
            设置各资产类别的目标配置比例
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {targets.map((target) => {
                const currentValue = editedTargets[target.categoryCode] ?? target.targetPercent;
                const hasChanged = currentValue !== target.targetPercent;
                
                return (
                  <div key={target.categoryCode} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{target.categoryName}</span>
                      <div className="flex items-center gap-2">
                        {hasChanged && (
                          <Badge variant="outline" className="text-xs">
                            已修改
                          </Badge>
                        )}
                        <span className="text-lg font-semibold w-16 text-right">
                          {currentValue.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <Slider
                      value={[currentValue]}
                      onValueChange={([value]) => handleSliderChange(target.categoryCode, value)}
                      min={target.minPercent}
                      max={target.maxPercent}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>最小 {target.minPercent}%</span>
                      <span>最大 {target.maxPercent}%</span>
                    </div>
                  </div>
                );
              })}

              {/* 总计显示 */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="font-medium">总计</span>
                  <span className={`text-xl font-bold ${
                    Math.abs(totalPercent - 100) <= 0.5 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {totalPercent.toFixed(1)}%
                  </span>
                </div>
                {Math.abs(totalPercent - 100) > 0.5 && (
                  <p className="text-sm text-red-500 mt-1">
                    总比例必须为100%，请调整各类别比例
                  </p>
                )}
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="mt-4 flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={loading}>
            <RotateCcw className="h-4 w-4 mr-2" />
            重置
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || saving || Math.abs(totalPercent - 100) > 0.5}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
