'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  RefreshCw, 
  Settings, 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Play,
  Pause,
  Trash2,
  TestTube
} from 'lucide-react';

interface SyncService {
  type: string;
  name: string;
  isEnabled: boolean;
  lastSyncTime?: string;
  connectionStatus: 'connected' | 'disconnected' | 'unknown';
}

interface SyncSchedule {
  userId: string;
  symbols: string[];
  config: {
    enabledServices: string[];
    syncInterval: number;
    maxRetries: number;
    timeout: number;
  };
  nextSyncTime: string;
  isActive: boolean;
}

interface SyncStats {
  totalSchedules: number;
  activeSchedules: number;
  totalServices: number;
  enabledServices: number;
  isRunning: boolean;
}

export default function SyncSettingsPage() {
  const [services, setServices] = useState<SyncService[]>([]);
  const [schedule, setSchedule] = useState<SyncSchedule | null>(null);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 表单状态
  const [symbols, setSymbols] = useState<string>('');
  const [selectedServices, setSelectedServices] = useState<string[]>(['eastmoney']);
  const [syncInterval, setSyncInterval] = useState<number>(5);
  const [maxRetries, setMaxRetries] = useState<number>(3);
  const [timeout, setTimeout] = useState<number>(10);

  // 加载数据
  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sync/status?checkConnection=true');
      const data = await response.json();

      if (data.success) {
        setServices(data.data.services);
        setStats(data.data.stats);
        
        if (data.data.userSchedule) {
          const userSchedule = data.data.userSchedule;
          setSchedule({
            userId: '',
            symbols: [], // 需要从其他API获取
            config: {
              enabledServices: userSchedule.enabledServices,
              syncInterval: userSchedule.intervalMinutes * 60000,
              maxRetries: 3,
              timeout: 10000
            },
            nextSyncTime: userSchedule.nextSyncTime,
            isActive: userSchedule.isActive
          });
          
          // 设置表单默认值
          setSelectedServices(userSchedule.enabledServices);
          setSyncInterval(userSchedule.intervalMinutes);
        }
      }
    } catch (error) {
      console.error('加载同步状态失败:', error);
      setError('加载同步状态失败');
    } finally {
      setLoading(false);
    }
  };

  // 测试服务连接
  const testService = async (serviceType: string) => {
    try {
      setTesting(serviceType);
      const response = await fetch('/api/sync/status/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType,
          testSymbols: ['000001', '600000'] // 测试用股票代码
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`${serviceType} 连接测试成功`);
        await loadSyncStatus(); // 刷新状态
      } else {
        setError(`${serviceType} 连接测试失败: ${data.data?.tests?.connection?.error || '未知错误'}`);
      }
    } catch (error) {
      setError(`测试 ${serviceType} 连接失败`);
    } finally {
      setTesting(null);
    }
  };

  // 手动同步
  const manualSync = async () => {
    if (!symbols.trim()) {
      setError('请输入股票代码');
      return;
    }

    try {
      setSyncing(true);
      const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);
      
      const response = await fetch('/api/sync/stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: symbolList,
          services: selectedServices,
          force: true
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`同步成功，更新了 ${data.data.totalUpdated} 条数据`);
      } else {
        setError(`同步失败: ${data.errors?.join(', ') || '未知错误'}`);
      }
    } catch (error) {
      setError('手动同步失败');
    } finally {
      setSyncing(false);
    }
  };

  // 创建/更新同步计划
  const saveSchedule = async () => {
    if (!symbols.trim()) {
      setError('请输入股票代码');
      return;
    }

    try {
      const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);
      
      const response = await fetch('/api/sync/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: symbolList,
          config: {
            enabledServices: selectedServices,
            syncInterval: syncInterval * 60000, // 转换为毫秒
            maxRetries,
            timeout: timeout * 1000 // 转换为毫秒
          }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess('同步计划保存成功');
        await loadSyncStatus();
      } else {
        setError(`保存同步计划失败: ${data.error}`);
      }
    } catch (error) {
      setError('保存同步计划失败');
    }
  };

  // 切换同步计划状态
  const toggleSchedule = async (isActive: boolean) => {
    try {
      const response = await fetch('/api/sync/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`同步计划已${isActive ? '启动' : '暂停'}`);
        await loadSyncStatus();
      } else {
        setError(`${isActive ? '启动' : '暂停'}同步计划失败: ${data.error}`);
      }
    } catch (error) {
      setError(`${isActive ? '启动' : '暂停'}同步计划失败`);
    }
  };

  // 删除同步计划
  const deleteSchedule = async () => {
    if (!confirm('确定要删除同步计划吗？')) return;

    try {
      const response = await fetch('/api/sync/schedule', {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess('同步计划已删除');
        setSchedule(null);
        await loadSyncStatus();
      } else {
        setError(`删除同步计划失败: ${data.error}`);
      }
    } catch (error) {
      setError('删除同步计划失败');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'disconnected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge variant="default" className="bg-green-100 text-green-800">已连接</Badge>;
      case 'disconnected':
        return <Badge variant="destructive">未连接</Badge>;
      default:
        return <Badge variant="secondary">未知</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">数据同步设置</h1>
          <p className="text-muted-foreground mt-2">
            配置和管理股票数据的自动同步功能
          </p>
        </div>
        <Button onClick={loadSyncStatus} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新状态
        </Button>
      </div>

      {/* 错误和成功提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="services" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="services">数据源管理</TabsTrigger>
          <TabsTrigger value="schedule">定时同步</TabsTrigger>
          <TabsTrigger value="manual">手动同步</TabsTrigger>
          <TabsTrigger value="status">系统状态</TabsTrigger>
        </TabsList>

        {/* 数据源管理 */}
        <TabsContent value="services" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                数据源服务
              </CardTitle>
              <CardDescription>
                管理和测试各个股票数据源的连接状态
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {services.map((service) => (
                  <div key={service.type} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(service.connectionStatus)}
                      <div>
                        <h3 className="font-medium">{service.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {service.lastSyncTime ? 
                            `最后同步: ${new Date(service.lastSyncTime).toLocaleString()}` : 
                            '尚未同步'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {getStatusBadge(service.connectionStatus)}
                      <Button
                        onClick={() => testService(service.type)}
                        disabled={testing === service.type}
                        variant="outline"
                        size="sm"
                      >
                        {testing === service.type ? (
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <TestTube className="h-4 w-4 mr-2" />
                        )}
                        测试连接
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 定时同步 */}
        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                定时同步计划
              </CardTitle>
              <CardDescription>
                设置股票数据的自动同步计划
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 当前计划状态 */}
              {schedule && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">当前同步计划</h3>
                    <div className="flex items-center space-x-2">
                      <Badge variant={schedule.isActive ? "default" : "secondary"}>
                        {schedule.isActive ? '运行中' : '已暂停'}
                      </Badge>
                      <Button
                        onClick={() => toggleSchedule(!schedule.isActive)}
                        variant="outline"
                        size="sm"
                      >
                        {schedule.isActive ? (
                          <>
                            <Pause className="h-4 w-4 mr-2" />
                            暂停
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            启动
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={deleteSchedule}
                        variant="outline"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">同步间隔:</span>
                      <span className="ml-2">{Math.floor(schedule.config.syncInterval / 60000)} 分钟</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">下次同步:</span>
                      <span className="ml-2">{new Date(schedule.nextSyncTime).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">启用服务:</span>
                      <span className="ml-2">{schedule.config.enabledServices.join(', ')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 同步计划配置 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="symbols">股票代码</Label>
                    <Input
                      id="symbols"
                      placeholder="输入股票代码，用逗号分隔，如: 000001,600000"
                      value={symbols}
                      onChange={(e) => setSymbols(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="services">启用的数据源</Label>
                    <Select value={selectedServices[0]} onValueChange={(value) => setSelectedServices([value])}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择数据源" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eastmoney">东方财富</SelectItem>
                        <SelectItem value="tonghuashun">同花顺</SelectItem>
                        <SelectItem value="xueqiu">雪球</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="interval">同步间隔 (分钟)</Label>
                    <Select value={syncInterval.toString()} onValueChange={(value) => setSyncInterval(Number(value))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 分钟</SelectItem>
                        <SelectItem value="5">5 分钟</SelectItem>
                        <SelectItem value="15">15 分钟</SelectItem>
                        <SelectItem value="30">30 分钟</SelectItem>
                        <SelectItem value="60">1 小时</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="retries">最大重试次数</Label>
                    <Select value={maxRetries.toString()} onValueChange={(value) => setMaxRetries(Number(value))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 次</SelectItem>
                        <SelectItem value="3">3 次</SelectItem>
                        <SelectItem value="5">5 次</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Button onClick={saveSchedule} className="w-full">
                <Clock className="h-4 w-4 mr-2" />
                保存同步计划
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 手动同步 */}
        <TabsContent value="manual" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <RefreshCw className="h-5 w-5 mr-2" />
                手动同步
              </CardTitle>
              <CardDescription>
                立即执行股票数据同步
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="manual-symbols">股票代码</Label>
                <Input
                  id="manual-symbols"
                  placeholder="输入股票代码，用逗号分隔"
                  value={symbols}
                  onChange={(e) => setSymbols(e.target.value)}
                />
              </div>

              <div>
                <Label>选择数据源</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['eastmoney', 'tonghuashun', 'xueqiu'].map((service) => (
                    <label key={service} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedServices.includes(service)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedServices([...selectedServices, service]);
                          } else {
                            setSelectedServices(selectedServices.filter(s => s !== service));
                          }
                        }}
                      />
                      <span className="text-sm">
                        {service === 'eastmoney' ? '东方财富' : 
                         service === 'tonghuashun' ? '同花顺' : '雪球'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Button 
                onClick={manualSync} 
                disabled={syncing || !symbols.trim()}
                className="w-full"
              >
                {syncing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {syncing ? '同步中...' : '立即同步'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 系统状态 */}
        <TabsContent value="status" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Activity className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">总服务数</p>
                    <p className="text-2xl font-bold">{stats?.totalServices || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">启用服务</p>
                    <p className="text-2xl font-bold">{stats?.enabledServices || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">活跃计划</p>
                    <p className="text-2xl font-bold">{stats?.activeSchedules || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Settings className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">系统状态</p>
                    <p className="text-2xl font-bold">
                      {stats?.isRunning ? '运行中' : '已停止'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}