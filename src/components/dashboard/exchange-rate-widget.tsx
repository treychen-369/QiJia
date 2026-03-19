'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, TrendingUp, Clock } from 'lucide-react'
import { 
  getExchangeRates, 
  refreshExchangeRates, 
  formatExchangeRate,
  type ExchangeRates 
} from '@/lib/exchange-rate-service'

export function ExchangeRateWidget() {
  const [rates, setRates] = useState<ExchangeRates | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)

  // 加载汇率
  const loadRates = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await getExchangeRates()
      setRates(data)
      setLastRefreshTime(new Date())
    } catch (err) {
      console.error('加载汇率失败:', err)
      // 不再抛出错误，而是显示警告信息
      setError(err instanceof Error ? err.message : '加载失败')
      // 即使失败也尝试使用本地默认值
    } finally {
      setIsLoading(false)
    }
  }

  // 手动刷新汇率
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      setError(null)
      const data = await refreshExchangeRates()
      setRates(data)
      setLastRefreshTime(new Date())
      
      // 显示刷新结果提示
      if (data.source === 'fallback' || data.source === 'local-fallback') {
        setError('无法获取实时汇率，已使用默认值')
      }
    } catch (err) {
      console.error('刷新汇率失败:', err)
      setError(err instanceof Error ? err.message : '刷新失败')
    } finally {
      setIsRefreshing(false)
    }
  }

  // 初始加载
  useEffect(() => {
    loadRates()
  }, [])

  // 移除自动刷新逻辑，只在用户手动点击时刷新

  // 格式化更新时间
  const formatUpdateTime = (date: Date | null) => {
    if (!date) return '未知'
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diff < 60) return `${diff}秒前`
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
    return date.toLocaleString('zh-CN')
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">实时汇率</h3>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-6 w-full animate-pulse rounded bg-muted" />
          <div className="h-6 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-600">使用默认汇率</h3>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-md p-1 hover:bg-yellow-500/20 disabled:opacity-50"
            title="重新获取"
          >
            <RefreshCw
              className={`h-4 w-4 text-yellow-600 ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        
        {/* 显示默认汇率 */}
        {rates && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between rounded-md bg-muted/50 p-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">USD/CNY</span>
                <span className="text-xs text-muted-foreground">美元</span>
              </div>
              <span className="font-mono font-semibold">
                {formatExchangeRate(rates.rates.USD)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/50 p-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">HKD/CNY</span>
                <span className="text-xs text-muted-foreground">港币</span>
              </div>
              <span className="font-mono font-semibold">
                {formatExchangeRate(rates.rates.HKD)}
              </span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">实时汇率</h3>
          {rates?.source && (
            <span className="text-xs text-muted-foreground">
              ({rates.source === 'fallback' ? '默认' : '实时'})
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="rounded-md p-1 hover:bg-accent disabled:opacity-50"
          title="刷新汇率"
        >
          <RefreshCw
            className={`h-4 w-4 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {rates && (
        <>
          <div className="mt-4 space-y-2">
            {/* USD 汇率 */}
            <div className="flex items-center justify-between rounded-md bg-muted/50 p-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">USD/CNY</span>
                <span className="text-xs text-muted-foreground">美元</span>
              </div>
              <span className="font-mono font-semibold">
                {formatExchangeRate(rates.rates.USD)}
              </span>
            </div>

            {/* HKD 汇率 */}
            <div className="flex items-center justify-between rounded-md bg-muted/50 p-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">HKD/CNY</span>
                <span className="text-xs text-muted-foreground">港币</span>
              </div>
              <span className="font-mono font-semibold">
                {formatExchangeRate(rates.rates.HKD)}
              </span>
            </div>
          </div>

          {/* 更新时间 */}
          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>更新于: {formatUpdateTime(lastRefreshTime)}</span>
          </div>

          {/* 错误提示 */}
          {rates.error && (
            <div className="mt-2 rounded-md bg-yellow-500/10 p-2 text-xs text-yellow-600">
              ⚠️ {rates.error}
            </div>
          )}
        </>
      )}
    </div>
  )
}
