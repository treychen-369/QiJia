'use client';

import { useState } from 'react';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Plus, 
  Upload, 
  RefreshCw, 
  Menu,
  Bot,
  TrendingUp,
  Users,
  DollarSign,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';

interface LiabilityHealthData {
  totalLiabilities?: number;
  liabilityRatio: number;
  dti?: number;
  monthlyPayment?: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

interface MobileBottomBarProps {
  onAddRecord: () => void;
  onImportData: () => void;
  onSyncData: () => void;
  onRequestAIAdvice?: () => void;
  onEditFamilyProfile?: () => void;
  liabilityHealth?: LiabilityHealthData;
  isSyncing?: boolean;
  className?: string;
  canRequestAIAdvice?: boolean;
  latestAdvice?: {
    id: string;
    summary: string;
    createdAt: string;
  };
}

/**
 * 移动端底部操作栏
 * 主栏：AI建议、添加、家庭、负债、更多
 * 更多面板：导入、同步
 */
export function MobileBottomBar({
  onAddRecord,
  onImportData,
  onSyncData,
  onRequestAIAdvice,
  onEditFamilyProfile,
  liabilityHealth,
  isSyncing = false,
  className = '',
  canRequestAIAdvice = true,
  latestAdvice
}: MobileBottomBarProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isLiabilityOpen, setIsLiabilityOpen] = useState(false);

  // 获取负债健康度状态样式
  const getLiabilityStatusStyle = (status: 'HEALTHY' | 'WARNING' | 'CRITICAL') => {
    switch (status) {
      case 'HEALTHY':
        return {
          colorClass: 'text-green-600 dark:text-green-400',
          bgClass: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
          icon: CheckCircle,
          label: '健康'
        };
      case 'WARNING':
        return {
          colorClass: 'text-yellow-600 dark:text-yellow-400',
          bgClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
          icon: AlertCircle,
          label: '关注'
        };
      case 'CRITICAL':
        return {
          colorClass: 'text-red-600 dark:text-red-400',
          bgClass: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
          icon: AlertCircle,
          label: '预警'
        };
    }
  };

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-lg z-50 ${className}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around py-2 px-2">
        {/* 1. AI建议 - 仅管理员可用 */}
        {canRequestAIAdvice ? (
          <BottomBarButton 
            icon={Bot} 
            label="AI建议" 
            onClick={() => onRequestAIAdvice?.()}
            primary={!!latestAdvice}
            badge={latestAdvice ? 'NEW' : undefined}
          />
        ) : (
          <BottomBarButton 
            icon={Bot} 
            label="AI建议" 
            onClick={() => {}}
            disabled
          />
        )}
        
        {/* 2. 添加 */}
        <BottomBarButton 
          icon={Plus} 
          label="添加" 
          onClick={onAddRecord}
        />
        
        {/* 3. 家庭档案 */}
        <BottomBarButton 
          icon={Users} 
          label="家庭" 
          onClick={() => onEditFamilyProfile?.()}
        />
        
        {/* 4. 负债健康度 - 打开详情面板 */}
        <Sheet open={isLiabilityOpen} onOpenChange={setIsLiabilityOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center py-1 px-2 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors relative">
              <DollarSign className="h-5 w-5" />
              <span className="text-xs mt-1">负债</span>
              {liabilityHealth && liabilityHealth.status !== 'HEALTHY' && (
                <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${liabilityHealth.status === 'CRITICAL' ? 'bg-red-500' : 'bg-yellow-500'}`} />
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh] overflow-y-auto">
            <SheetHeader className="pb-4">
              <SheetTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-orange-500" />
                负债健康度
              </SheetTitle>
              <SheetDescription className="sr-only">
                查看负债健康度详情，包括负债率、债务收入比等指标
              </SheetDescription>
            </SheetHeader>
            
            {/* 负债健康度内容 */}
            <div className="space-y-4">
              {/* 无负债状态 */}
              {(!liabilityHealth || liabilityHealth.liabilityRatio === 0) ? (
                <Card className="border-0 shadow-none bg-green-50 dark:bg-green-900/20">
                  <CardContent className="p-4 text-center">
                    <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      无负债，财务状况良好
                    </p>
                    <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
                      保持当前状态，继续积累资产
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* 状态卡片 */}
                  {liabilityHealth.status && (() => {
                    const style = getLiabilityStatusStyle(liabilityHealth.status);
                    return (
                      <Card className="border-0 shadow-none bg-slate-50 dark:bg-slate-800/50">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-muted-foreground">整体状态</span>
                            <Badge className={style.bgClass}>
                              {style.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <style.icon className={`h-5 w-5 ${style.colorClass}`} />
                            <span className={`text-lg font-semibold ${style.colorClass}`}>
                              {liabilityHealth.liabilityRatio.toFixed(1)}%
                            </span>
                            <span className="text-xs text-muted-foreground">负债率</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* 详细指标 */}
                  <div className="space-y-3">
                    {/* 总负债 */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">总负债</span>
                      <span className="text-sm font-semibold">
                        ¥{(liabilityHealth.totalLiabilities || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* DTI - 服务层已返回百分比值，无需再乘100 */}
                    {liabilityHealth.dti !== undefined && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">债务收入比 (DTI)</span>
                          <span className={`text-sm font-semibold ${(liabilityHealth.dti || 0) > 40 ? 'text-red-500' : 'text-green-500'}`}>
                            {(liabilityHealth.dti || 0).toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={liabilityHealth.dti || 0} className="h-1.5" />
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {(liabilityHealth.dti || 0) > 40 ? '建议控制在40%以下' : '债务收入比健康'}
                        </p>
                      </div>
                    )}

                    {/* 月还款 */}
                    {liabilityHealth.monthlyPayment !== undefined && liabilityHealth.monthlyPayment > 0 && (
                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-muted-foreground">月还款额</span>
                        <span className="text-sm font-semibold text-orange-600">
                          ¥{liabilityHealth.monthlyPayment.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 提示信息 */}
                  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      负债率 = 总负债 / 总资产。建议保持在50%以下，以确保财务安全。
                    </p>
                  </div>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
        
        {/* 5. 更多 - 包含导入、同步 */}
        <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center py-1 px-2 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors relative">
              <Menu className="h-5 w-5" />
              <span className="text-xs mt-1">更多</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[70vh] overflow-y-auto">
            <SheetHeader className="pb-2">
              <SheetTitle className="text-base">功能面板</SheetTitle>
              <SheetDescription className="sr-only">
                更多功能选项，包括导入数据和同步数据
              </SheetDescription>
            </SheetHeader>
            
            {/* 1. 导入 */}
            <button
              onClick={() => { setIsMoreOpen(false); onImportData(); }}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-slate-500" />
                <span className="text-sm">导入数据</span>
              </div>
              <TrendingUp className="h-4 w-4 text-slate-400" />
            </button>
            
            <Separator className="my-2" />
            
            {/* 2. 同步 */}
            <button
              onClick={() => { setIsMoreOpen(false); onSyncData(); }}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 text-slate-500 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="text-sm">同步数据</span>
              </div>
              {isSyncing && <span className="text-xs text-blue-500">同步中...</span>}
            </button>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

/**
 * 底部栏按钮
 */
function BottomBarButton({
  icon: Icon,
  label,
  onClick,
  primary = false,
  loading = false,
  badge,
  disabled = false
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  primary?: boolean;
  loading?: boolean;
  badge?: string;
  disabled?: boolean;
}) {
  if (primary) {
    return (
      <button
        onClick={onClick}
        disabled={loading || disabled}
        className="flex flex-col items-center justify-center py-1 px-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl -mt-4 shadow-lg relative"
      >
        <Icon className={`h-6 w-6 ${loading ? 'animate-spin' : ''}`} />
        <span className="text-xs mt-0.5 font-medium">{label}</span>
        {badge && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full">
            {badge}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`flex flex-col items-center justify-center py-1 px-3 transition-colors relative ${disabled ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-600 dark:text-slate-400 hover:text-primary'}`}
    >
      <Icon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
      <span className="text-xs mt-1">{label}</span>
      {badge && (
        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}

/**
 * 更多功能按钮
 */
function MoreActionButton({
  icon: Icon,
  label,
  onClick,
  badge
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
    >
      <Icon className="h-6 w-6 text-slate-700 dark:text-slate-300" />
      <span className="text-xs mt-1.5 text-slate-600 dark:text-slate-400">{label}</span>
      {badge && (
        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-blue-500 text-white text-[10px] rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}
