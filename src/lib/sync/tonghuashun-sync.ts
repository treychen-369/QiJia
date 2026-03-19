/**
 * 同花顺数据同步服务
 * 通过同花顺API获取股票数据和持仓信息
 */

import { BaseSyncService, StockData, PortfolioHolding } from './base-sync-service';

interface TonghuashunConfig {
  apiKey?: string;
  baseUrl: string;
  timeout: number;
}

interface TonghuashunStockResponse {
  code: string;
  name: string;
  price: number;
  change: number;
  percent: number;
  volume: number;
  market_cap?: number;
  pe?: number;
  pb?: number;
  timestamp: number;
}

interface TonghuashunHoldingResponse {
  stock_code: string;
  stock_name: string;
  hold_amount: number;
  cost_price: number;
  current_price: number;
  market_value: number;
  profit_loss: number;
  profit_rate: number;
  update_time: number;
}

export class TonghuashunSyncService extends BaseSyncService {
  private config: TonghuashunConfig;
  private apiHeaders: Record<string, string>;

  constructor(config?: Partial<TonghuashunConfig>) {
    super('同花顺');
    
    this.config = {
      baseUrl: 'https://api.10jqka.com.cn',
      timeout: 10000,
      ...config
    };

    this.apiHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'QiJia/1.0',
      ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
    };
  }

  /**
   * 获取股票实时价格数据
   */
  async getStockPrices(symbols: string[]): Promise<StockData[]> {
    return this.retryOperation(async () => {
      const results: StockData[] = [];
      
      // 批量获取股票数据，每次最多20只
      const batchSize = 20;
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        const batchData = await this.fetchStockBatch(batch);
        results.push(...batchData);
      }

      return results;
    });
  }

  /**
   * 批量获取股票数据
   */
  private async fetchStockBatch(symbols: string[]): Promise<StockData[]> {
    const symbolsParam = symbols.join(',');
    const url = `${this.config.baseUrl}/api/stock/realtime?codes=${symbolsParam}`;

    try {
      const response = await fetch(url, {
        headers: this.apiHeaders,
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        throw new Error(`同花顺API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error_code !== 0) {
        throw new Error(`同花顺API错误: ${data.error_description || '未知错误'}`);
      }

      return this.transformStockData(data.result || []);
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('同花顺API请求超时');
      }
      throw error;
    }
  }

  /**
   * 转换股票数据格式
   */
  private transformStockData(apiData: TonghuashunStockResponse[]): StockData[] {
    return apiData.map(item => ({
      symbol: item.code,
      name: item.name,
      currentPrice: item.price,
      change: item.change,
      changePercent: item.percent,
      volume: item.volume,
      marketCap: item.market_cap,
      pe: item.pe,
      pb: item.pb,
      lastUpdated: new Date(item.timestamp * 1000),
      currency: 'CNY',
      exchange: this.getExchangeBySymbol(item.code)
    }));
  }

  /**
   * 根据股票代码判断交易所
   */
  private getExchangeBySymbol(symbol: string): string {
    if (symbol.startsWith('00') || symbol.startsWith('30')) {
      return 'SZSE'; // 深交所
    } else if (symbol.startsWith('60') || symbol.startsWith('68')) {
      return 'SSE'; // 上交所
    } else if (symbol.startsWith('43') || symbol.startsWith('83')) {
      return 'NEEQ'; // 新三板
    }
    return 'UNKNOWN';
  }

  /**
   * 获取用户持仓数据
   */
  async getPortfolioHoldings(userId: string): Promise<PortfolioHolding[]> {
    return this.retryOperation(async () => {
      const url = `${this.config.baseUrl}/api/portfolio/holdings`;
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: this.apiHeaders,
          body: JSON.stringify({ user_id: userId }),
          signal: AbortSignal.timeout(this.config.timeout)
        });

        if (!response.ok) {
          throw new Error(`持仓数据获取失败: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error_code !== 0) {
          throw new Error(`持仓API错误: ${data.error_description || '未知错误'}`);
        }

        return this.transformHoldingData(data.result || []);
      } catch (error) {
        // 如果是认证错误，可能需要重新登录
        if (error instanceof Error && error.message.includes('401')) {
          throw new Error('同花顺账户认证失败，请检查登录状态');
        }
        throw error;
      }
    });
  }

  /**
   * 转换持仓数据格式
   */
  private transformHoldingData(apiData: TonghuashunHoldingResponse[]): PortfolioHolding[] {
    return apiData.map(item => ({
      symbol: item.stock_code,
      quantity: item.hold_amount,
      averageCost: item.cost_price,
      currentPrice: item.current_price,
      marketValue: item.market_value,
      unrealizedPnL: item.profit_loss,
      unrealizedPnLPercent: item.profit_rate,
      lastUpdated: new Date(item.update_time * 1000)
    }));
  }

  /**
   * 验证服务连接状态
   */
  async validateConnection(): Promise<boolean> {
    try {
      const url = `${this.config.baseUrl}/api/health`;
      const response = await fetch(url, {
        headers: this.apiHeaders,
        signal: AbortSignal.timeout(5000)
      });

      return response.ok;
    } catch (error) {
      console.error('同花顺连接验证失败:', error);
      return false;
    }
  }

  /**
   * 设置API密钥
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.apiHeaders['Authorization'] = `Bearer ${apiKey}`;
  }

  /**
   * 获取支持的股票市场
   */
  getSupportedMarkets(): string[] {
    return ['SSE', 'SZSE', 'NEEQ']; // 上交所、深交所、新三板
  }

  /**
   * 获取API使用统计
   */
  async getApiUsageStats(): Promise<{
    dailyQuota: number;
    usedQuota: number;
    remainingQuota: number;
    resetTime: Date;
  }> {
    try {
      const url = `${this.config.baseUrl}/api/quota`;
      const response = await fetch(url, {
        headers: this.apiHeaders,
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        return {
          dailyQuota: data.daily_quota || 1000,
          usedQuota: data.used_quota || 0,
          remainingQuota: data.remaining_quota || 1000,
          resetTime: new Date(data.reset_time * 1000 || Date.now() + 24 * 60 * 60 * 1000)
        };
      }
    } catch (error) {
      console.warn('获取API使用统计失败:', error);
    }

    // 返回默认值
    return {
      dailyQuota: 1000,
      usedQuota: 0,
      remainingQuota: 1000,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }
}