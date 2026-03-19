'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AddHoldingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface Account {
  id: string;
  accountName: string;
  broker: { id: string; name: string; code?: string; country?: string } | null;
  currency: string;
}

interface Security {
  id: string;
  symbol: string;
  name: string;
  nameEn?: string;
  exchange?: string;
  assetCategory?: { name: string };
  region?: { name: string };
}

export function AddHoldingDialog({ open, onOpenChange, onSuccess }: AddHoldingDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'security' | 'holding'>('security');
  
  // 账户和证券数据
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [securities, setSecurities] = useState<Security[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // 搜索
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Security[]>([]);
  const [searching, setSearching] = useState(false);
  
  // 选中的证券
  const [selectedSecurity, setSelectedSecurity] = useState<Security | null>(null);
  
  // 持仓表单
  const [holdingForm, setHoldingForm] = useState({
    accountId: '',
    quantity: '',
    averageCost: '',
    currentPrice: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // 加载初始数据
  useEffect(() => {
    if (open) {
      loadInitialData();
      resetForm();
    }
  }, [open]);

  const loadInitialData = async () => {
    setLoadingData(true);
    try {
      const [accountsRes, securitiesRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/securities?limit=200'), // 加载前200个证券
      ]);

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(accountsData.data || []);
      }

      if (securitiesRes.ok) {
        const securitiesData = await securitiesRes.json();
        // 修复：API返回的字段是 data 而不是 securities
        setSecurities(securitiesData.data || []);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoadingData(false);
    }
  };

  // 手动刷新证券数据（从API获取并保存到本地）
  const handleRefreshSecurities = async () => {
    setRefreshing(true);
    try {
      toast({
        title: '正在刷新...',
        description: '从Tushare API获取最新数据（将消耗积分）',
      });
      
      // 调用批量导入API
      const response = await fetch('/api/securities/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'tushare',
          limit: 100, // 每次最多导入100条
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '刷新失败');
      }
      
      const result = await response.json();
      
      // 重新加载本地数据
      await loadInitialData();
      
      toast({
        title: '刷新成功',
        description: `成功导入 ${result.imported} 只证券，跳过 ${result.skipped} 只已存在的证券`,
      });
    } catch (error) {
      toast({
        title: '刷新失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  // 搜索证券（优先本地，本地无结果时不自动使用API，需手动刷新）
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      // 只搜索本地数据库，不自动调用API（节省积分）
      const localResponse = await fetch(`/api/securities?search=${encodeURIComponent(searchQuery)}&limit=50`);
      if (!localResponse.ok) throw new Error('搜索失败');
      
      const localResult = await localResponse.json();
      const results = localResult.data || [];
      
      setSearchResults(results);
      
      if (results.length === 0) {
        toast({
          title: '本地未找到结果',
          description: '请尝试"所有证券"标签页的"从API刷新"按钮获取更多数据',
        });
      }
    } catch (error) {
      toast({
        title: '搜索失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // 选择证券
  const handleSelectSecurity = (security: Security) => {
    setSelectedSecurity(security);
    setStep('holding');
  };

  // 提交持仓
  const handleSubmitHolding = async () => {
    if (!selectedSecurity) return;

    // 验证
    if (!holdingForm.accountId || !holdingForm.quantity || !holdingForm.averageCost) {
      toast({
        title: '请填写必填字段',
        description: '账户、数量和成本价为必填项',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          securityId: selectedSecurity.id,
          accountId: holdingForm.accountId,
          quantity: parseFloat(holdingForm.quantity),
          averageCost: parseFloat(holdingForm.averageCost),
          currentPrice: holdingForm.currentPrice ? parseFloat(holdingForm.currentPrice) : parseFloat(holdingForm.averageCost),
          purchaseDate: holdingForm.purchaseDate,
          notes: holdingForm.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建失败');
      }

      const data = await response.json();
      
      toast({
        title: '添加成功',
        description: `持仓 ${selectedSecurity.name} 已添加`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: '添加失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep('security');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedSecurity(null);
    setHoldingForm({
      accountId: '',
      quantity: '',
      averageCost: '',
      currentPrice: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'security' ? '选择证券' : '添加持仓'}
          </DialogTitle>
          <DialogDescription>
            {step === 'security' 
              ? '搜索并选择要添加的证券，或创建新证券' 
              : '填写持仓信息，包括数量和成本价'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 'security' && (
            <div className="space-y-4">
              {/* 搜索证券 */}
              <div className="space-y-2">
                <Label>搜索证券</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="输入证券代码或名称（如：00700 或 腾讯）"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={searching}>
                    {searching ? '搜索中...' : '搜索'}
                  </Button>
                </div>
              </div>

              <Tabs defaultValue="search" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="search">搜索结果</TabsTrigger>
                  <TabsTrigger value="all">所有证券</TabsTrigger>
                </TabsList>

                <TabsContent value="search" className="space-y-2">
                  {searchResults.length > 0 ? (
                    <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                      {searchResults.map((security) => (
                        <div
                          key={security.id}
                          className="p-3 hover:bg-gray-50 cursor-pointer transition"
                          onClick={() => handleSelectSecurity(security)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">
                                {security.symbol} - {security.name}
                              </div>
                              {security.nameEn && (
                                <div className="text-sm text-gray-500">{security.nameEn}</div>
                              )}
                              <div className="text-xs text-gray-500 mt-1">
                                {security.exchange} | {security.assetCategory?.name} | {security.region?.name}
                              </div>
                            </div>
                            <Button size="sm" variant="outline">
                              选择
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      {searchQuery ? '未找到匹配的证券' : '请输入搜索关键词'}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="all" className="space-y-2">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm text-gray-500">
                      共 {securities.length} 只证券
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={handleRefreshSecurities}
                      disabled={refreshing}
                    >
                      {refreshing ? '刷新中...' : '🔄 从API刷新'}
                    </Button>
                  </div>
                  
                  {securities.length > 0 ? (
                    <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                      {securities.map((security) => (
                        <div
                          key={security.id}
                          className="p-3 hover:bg-gray-50 cursor-pointer transition"
                          onClick={() => handleSelectSecurity(security)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">
                                {security.symbol} - {security.name}
                              </div>
                              {security.nameEn && (
                                <div className="text-sm text-gray-500">{security.nameEn}</div>
                              )}
                              <div className="text-xs text-gray-500 mt-1">
                                {security.exchange} | {security.assetCategory?.name} | {security.region?.name}
                              </div>
                            </div>
                            <Button size="sm" variant="outline">
                              选择
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      暂无证券数据，点击上方"从API刷新"按钮获取数据
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="text-center pt-4">
                <p className="text-sm text-gray-500 mb-2">未找到您要的证券？</p>
                <Button variant="outline" onClick={() => toast({ title: '功能开发中' })}>
                  创建新证券
                </Button>
              </div>
            </div>
          )}

          {step === 'holding' && selectedSecurity && (
            <div className="space-y-4">
              {/* 选中的证券 */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-lg">
                      {selectedSecurity.symbol} - {selectedSecurity.name}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {selectedSecurity.exchange} | {selectedSecurity.assetCategory?.name}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setStep('security');
                      setSelectedSecurity(null);
                    }}
                  >
                    更换证券
                  </Button>
                </div>
              </div>

              {/* 持仓表单 */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accountId">
                    投资账户 <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={holdingForm.accountId}
                    onValueChange={(value) => setHoldingForm(prev => ({ ...prev, accountId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择账户" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={5}>
                      {accounts.length === 0 ? (
                        <div className="p-2 text-sm text-gray-500 text-center">
                          暂无账户，请先创建账户
                        </div>
                      ) : (
                        accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.accountName} - {account.broker?.name || '未知券商'} ({account.currency})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">
                      持有数量 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="quantity"
                      type="number"
                      placeholder="100"
                      value={holdingForm.quantity}
                      onChange={(e) => setHoldingForm(prev => ({ ...prev, quantity: e.target.value }))}
                      step="0.01"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="averageCost">
                      平均成本 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="averageCost"
                      type="number"
                      placeholder="350.50"
                      value={holdingForm.averageCost}
                      onChange={(e) => setHoldingForm(prev => ({ ...prev, averageCost: e.target.value }))}
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPrice">当前价格（可选）</Label>
                    <Input
                      id="currentPrice"
                      type="number"
                      placeholder="如不填写，将使用平均成本"
                      value={holdingForm.currentPrice}
                      onChange={(e) => setHoldingForm(prev => ({ ...prev, currentPrice: e.target.value }))}
                      step="0.01"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="purchaseDate">购买日期</Label>
                    <Input
                      id="purchaseDate"
                      type="date"
                      value={holdingForm.purchaseDate}
                      onChange={(e) => setHoldingForm(prev => ({ ...prev, purchaseDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">备注（可选）</Label>
                  <Input
                    id="notes"
                    placeholder="如：首次建仓、加仓等"
                    value={holdingForm.notes}
                    onChange={(e) => setHoldingForm(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              {/* 计算预览 */}
              {holdingForm.quantity && holdingForm.averageCost && (
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm">持仓预览</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">总成本：</span>
                      <span className="font-medium ml-2">
                        ¥{(parseFloat(holdingForm.quantity) * parseFloat(holdingForm.averageCost)).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">当前市值：</span>
                      <span className="font-medium ml-2">
                        ¥{(parseFloat(holdingForm.quantity) * (parseFloat(holdingForm.currentPrice) || parseFloat(holdingForm.averageCost))).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          {step === 'holding' && (
            <Button onClick={handleSubmitHolding} disabled={loading}>
              {loading ? '添加中...' : '添加持仓'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
