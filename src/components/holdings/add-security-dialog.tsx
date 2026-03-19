'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

interface AddSecurityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface SecurityFormData {
  symbol: string;
  name: string;
  nameEn: string;
  assetCategoryId: string;
  regionId: string;
  exchange: string;
  sector: string;
  industry: string;
}

export function AddSecurityDialog({ open, onOpenChange, onSuccess }: AddSecurityDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'search' | 'create'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedSecurity, setSelectedSecurity] = useState<any>(null);
  
  const [formData, setFormData] = useState<SecurityFormData>({
    symbol: '',
    name: '',
    nameEn: '',
    assetCategoryId: '',
    regionId: '',
    exchange: '',
    sector: '',
    industry: '',
  });

  // 搜索已有证券
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      // 先搜索本地数据库
      const localResponse = await fetch(`/api/securities?search=${encodeURIComponent(searchQuery)}`);
      if (!localResponse.ok) throw new Error('搜索失败');
      
      const localData = await localResponse.json();
      let securities = localData.data || [];
      
      // 如果本地没有结果，尝试API搜索
      if (securities.length === 0) {
        console.log('本地无结果，尝试API搜索...');
        const apiResponse = await fetch(`/api/securities?search=${encodeURIComponent(searchQuery)}&useApi=true`);
        
        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          securities = apiData.data || [];
          
          if (securities.length > 0 && apiData.source === 'api') {
            toast({
              title: '在线搜索成功',
              description: `从Tushare找到 ${securities.length} 条结果，可以选择后保存到本地`,
            });
          }
        }
      }
      
      setSearchResults(securities);
      
      if (securities.length === 0) {
        toast({
          title: '未找到匹配证券',
          description: '您可以手动创建新证券',
        });
        setSearchMode('create');
        setFormData(prev => ({ ...prev, symbol: searchQuery, name: searchQuery }));
      }
    } catch (error) {
      toast({
        title: '搜索失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // 创建新证券
  const handleCreate = async () => {
    // 验证必填字段
    if (!formData.symbol || !formData.name || !formData.assetCategoryId || !formData.regionId) {
      toast({
        title: '请填写必填字段',
        description: '证券代码、名称、资产类别和市场地区为必填项',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/securities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建失败');
      }

      const data = await response.json();
      
      toast({
        title: '创建成功',
        description: `证券 ${data.security.name} 已添加`,
      });

      onOpenChange(false);
      onSuccess?.();
      resetForm();
    } catch (error) {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSearchMode('search');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedSecurity(null);
    setFormData({
      symbol: '',
      name: '',
      nameEn: '',
      assetCategoryId: '',
      regionId: '',
      exchange: '',
      sector: '',
      industry: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加证券</DialogTitle>
          <DialogDescription>
            搜索现有证券或创建新的投资标的
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 搜索模式 */}
          {searchMode === 'search' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="输入证券代码或名称（如：00700 或 腾讯）"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={loading}>
                  {loading ? '搜索中...' : '搜索'}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {searchResults.map((security) => (
                    <div
                      key={security.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setSelectedSecurity(security);
                        setFormData({
                          symbol: security.symbol,
                          name: security.name,
                          nameEn: security.nameEn || '',
                          assetCategoryId: security.assetCategoryId,
                          regionId: security.regionId,
                          exchange: security.exchange || '',
                          sector: security.sector || '',
                          industry: security.industry || '',
                        });
                        setSearchMode('create');
                      }}
                    >
                      <div className="font-medium">{security.symbol} - {security.name}</div>
                      <div className="text-sm text-gray-500">
                        {security.exchange} | {security.assetCategory?.name} | {security.region?.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={() => setSearchMode('create')}
                >
                  未找到？手动创建新证券
                </Button>
              </div>
            </div>
          )}

          {/* 创建模式 */}
          {searchMode === 'create' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">证券信息</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchMode('search')}
                >
                  返回搜索
                </Button>
              </div>

              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="symbol">
                    证券代码 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="symbol"
                    placeholder="如：00700.HK"
                    value={formData.symbol}
                    onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">
                    证券名称 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="如：腾讯控股"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nameEn">英文名称</Label>
                  <Input
                    id="nameEn"
                    placeholder="如：Tencent Holdings"
                    value={formData.nameEn}
                    onChange={(e) => setFormData(prev => ({ ...prev, nameEn: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exchange">交易所</Label>
                  <Input
                    id="exchange"
                    placeholder="如：HKEX, NYSE"
                    value={formData.exchange}
                    onChange={(e) => setFormData(prev => ({ ...prev, exchange: e.target.value }))}
                  />
                </div>
              </div>

              {/* 分类信息 - 占位符，实际需要从API获取选项 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assetCategoryId">
                    资产类别 <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.assetCategoryId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, assetCategoryId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择资产类别" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={5}>
                      <SelectItem value="stock">股票</SelectItem>
                      <SelectItem value="fund">基金</SelectItem>
                      <SelectItem value="etf">ETF</SelectItem>
                      <SelectItem value="bond">债券</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    暂时使用占位符，需要集成资产类别API
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regionId">
                    市场地区 <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.regionId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, regionId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择市场地区" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={5}>
                      <SelectItem value="hk">香港</SelectItem>
                      <SelectItem value="us">美国</SelectItem>
                      <SelectItem value="cn">中国</SelectItem>
                      <SelectItem value="jp">日本</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    暂时使用占位符，需要集成地区API
                  </p>
                </div>
              </div>

              {/* 行业信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sector">行业</Label>
                  <Input
                    id="sector"
                    placeholder="如：科技"
                    value={formData.sector}
                    onChange={(e) => setFormData(prev => ({ ...prev, sector: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">板块</Label>
                  <Input
                    id="industry"
                    placeholder="如：互联网服务"
                    value={formData.industry}
                    onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          {searchMode === 'create' && (
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? '创建中...' : '创建证券'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
