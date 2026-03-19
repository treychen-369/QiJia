/**
 * 雪球数据同步服务
 * 通过雪球API获取股票数据和组合信息
 */

import { BaseSyncService, StockData, PortfolioHolding } from './base-sync-service';

interface XueqiuConfig {
  baseUrl: string;
  timeout: number;
  token?: string;
}

interface XueqiuQuoteResponse {
  symbol: string;
  name: string;
  current: number;
  chg: number;
  percent: number;
  volume: number;
  market_capital: number;
  pe_ttm: number;
  pb: number;
  timestamp: number;
  currency: string;
  exchange: string;
}

interface XueqiuPortfolioResponse {
  stocks: Array<{
    symbol: string;
    name: string;
    weight: number;
    price: number;
    change: number;
    percent: number;
  }>;
  net_value: number;
  total_gain: number;
  annualized_gain: number;
  updated_at: number;
}

export class XueqiuSyncService extends BaseSyncService {
  private config: XueqiuConfig;
  private cookies: string = '';

  constructor(config?: Partial<XueqiuConfig>) {
    super('雪球');
    
    this.config = {
      baseUrl: 'https://stock.xueqiu.com',
      timeout: 10000,
      ...config
    };
  }

  /**
   * 初始化雪球会话（获取必要的cookies）
   */
  private async initializeSession(): Promise<void> {
    try {
      const response = await fetch('https://xueqiu.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        signal: AbortSignal.timeout(5000)
      });

      const setCookieHeaders = response.headers.getSetCookie();
      this.cookies = setCookieHeaders.map(cookie => cookie.split(';')[0]).join('; ');
    } catch (error) {
      console.warn('雪球会话初始化失败，将使用无认证模式:', error);
    }
  }

  /**
   * 获取请求头
   */
  private getHeaders(): Record<string, string> {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': 'https://xueqiu.com/',
      'Accept': 'application/json, text/plain, */*',
      ...(this.cookies && { 'Cookie': this.cookies }),
      ...(this.config.token && { 'Authorization': `Bearer ${this.config.token}` })
    };
  }

  /**
   * 获取股票实时价格数据
   */
  async getStockPrices(symbols: string[]): Promise<StockData[]> {
    return this.retryOperation(async () => {
      // 确保会话已初始化
      if (!this.cookies) {
        await this.initializeSession();
      }

      const results: StockData[] = [];
      
      // 雪球API支持批量查询，但建议分批处理
      const batchSize = 30;
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        const batchData = await this.fetchQuoteBatch(batch);
        results.push(...batchData);
      }

      return results;
    });
  }

  /**
   * 批量获取股票行情数据
   */
  private async fetchQuoteBatch(symbols: string[]): Promise<StockData[]> {
    // 转换股票代码格式
    const formattedSymbols = symbols.map(symbol => this.formatSymbolForXueqiu(symbol));
    const symbolsParam = formattedSymbols.join(',');

    const url = `${this.config.baseUrl}/v5/stock/batch/quote.json?symbol=${symbolsParam}&extend=detail`;

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        throw new Error(`雪球API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error_code && data.error_code !== 0) {
        throw new Error(`雪球API错误: ${data.error_description || '未知错误'}`);
      }

      return this.transformQuoteData(data.data?.items || []);
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('雪球API请求超时');
      }
      throw error;
    }
  }

  /**
   * 格式化股票代码为雪球格式
   */
  private formatSymbolForXueqiu(symbol: string): string {
    // 雪球的股票代码格式：SH600000, SZ000001
    if (symbol.startsWith('60') || symbol.startsWith('68')) {
      return `SH${symbol}`;
    } else if (symbol.startsWith('00') || symbol.startsWith('30')) {
      return `SZ${symbol}`;
    } else if (symbol.startsWith('43') || symbol.startsWith('83')) {
      return `BJ${symbol}`; // 北交所
    }
    return symbol;
  }

  /**
   * 转换行情数据格式
   */
  private transformQuoteData(apiData: any[]): StockData[] {
    return apiData.map(item => {
      const quote = item.quote || {};
      return {
        symbol: this.extractSymbolCode(quote.symbol || ''),
        name: quote.name || '',
        currentPrice: quote.current || 0,
        change: quote.chg || 0,
        changePercent: quote.percent || 0,
        volume: quote.volume || 0,
        marketCap: quote.market_capital,
        pe: quote.pe_ttm,
        pb: quote.pb,
        lastUpdated: new Date(quote.timestamp || Date.now()),
        currency: 'CNY',
        exchange: this.getExchangeFromSymbol(quote.symbol || '')
      };
    });
  }

  /**
   * 从雪球格式提取股票代码
   */
  private extractSymbolCode(xueqiuSymbol: string): string {
    if (xueqiuSymbol.startsWith('SH') || xueqiuSymbol.startsWith('SZ') || xueqiuSymbol.startsWith('BJ')) {
      return xueqiuSymbol.substring(2);
    }
    return xueqiuSymbol;
  }

  /**
   * 从雪球格式获取交易所
   */
  private getExchangeFromSymbol(xueqiuSymbol: string): string {
    if (xueqiuSymbol.startsWith('SH')) {
      return 'SSE';
    } else if (xueqiuSymbol.startsWith('SZ')) {
      return 'SZSE';
    } else if (xueqiuSymbol.startsWith('BJ')) {
      return 'BSE';
    }
    return 'UNKNOWN';
  }

  /**
   * 获取用户持仓数据（雪球组合）
   */
  async getPortfolioHoldings(userId: string): Promise<PortfolioHolding[]> {
    return this.retryOperation(async () => {
      // 雪球的组合数据需要登录认证
      if (!this.config.token) {
        console.warn('雪球组合数据需要登录认证，请设置token');
        return [];
      }

      const url = `${this.config.baseUrl}/cubes/rebalancing/history.json?cube_symbol=${userId}&count=1`;

      try {
        const response = await fetch(url, {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(this.config.timeout)
        });

        if (!response.ok) {
          throw new Error(`雪球组合数据获取失败: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error_code && data.error_code !== 0) {
          throw new Error(`雪球组合API错误: ${data.error_description || '未知错误'}`);
        }

        return this.transformPortfolioData(data.data || []);
      } catch (error) {
        console.error('获取雪球组合数据失败:', error);
        return [];
      }
    });
  }

  /**
   * 转换组合数据格式
   */
  private transformPortfolioData(apiData: any[]): PortfolioHolding[] {
    const holdings: PortfolioHolding[] = [];
    
    if (apiData.length > 0 && apiData[0].rebalancing_histories) {
      const latestRebalancing = apiData[0].rebalancing_histories[0];
      
      if (latestRebalancing && latestRebalancing.holdings) {
        latestRebalancing.holdings.forEach((holding: any) => {
          holdings.push({
            symbol: this.extractSymbolCode(holding.stock_symbol),
            quantity: holding.weight * 100, // 雪球用权重表示，转换为数量概念
            averageCost: holding.price || 0,
            currentPrice: holding.price || 0,
            marketValue: holding.weight * latestRebalancing.net_value,
            unrealizedPnL: 0, // 需要额外计算
            unrealizedPnLPercent: 0,
            lastUpdated: new Date(latestRebalancing.updated_at)
          });
        });
      }
    }

    return holdings;
  }

  /**
   * 验证服务连接状态
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.initializeSession();
      
      // 测试获取上证指数数据
      const url = `${this.config.baseUrl}/v5/stock/quote.json?symbol=SH000001&extend=detail`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000)
      });

      return response.ok;
    } catch (error) {
      console.error('雪球连接验证失败:', error);
      return false;
    }
  }

  /**
   * 获取股票详细信息
   */
  async getStockDetail(symbol: string): Promise<{
    symbol: string;
    name: string;
    description: string;
    industry: string;
    tags: string[];
    fundamentals: any;
  } | null> {
    try {
      const xueqiuSymbol = this.formatSymbolForXueqiu(symbol);
      const url = `${this.config.baseUrl}/v5/stock/quote.json?symbol=${xueqiuSymbol}&extend=detail`;

      const response = await fetch(url, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      if (!data.data || !data.data.quote) {
        return null;
      }

      const quote = data.data.quote;
      return {
        symbol: symbol,
        name: quote.name || '',
        description: quote.description || '',
        industry: quote.industry || '',
        tags: quote.tags || [],
        fundamentals: {
          pe: quote.pe_ttm,
          pb: quote.pb,
          roe: quote.roe,
          roa: quote.roa,
          gross_profit_rate: quote.gross_profit_rate
        }
      };
    } catch (error) {
      console.error('获取雪球股票详细信息失败:', error);
      return null;
    }
  }

  /**
   * 获取热门股票和话题
   */
  async getTrendingStocks(): Promise<{
    hotStocks: StockData[];
    hotTopics: string[];
  }> {
    try {
      const [stocksResponse, topicsResponse] = await Promise.all([
        fetch(`${this.config.baseUrl}/v5/stock/hot_stock/list.json`, {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(this.config.timeout)
        }),
        fetch(`${this.config.baseUrl}/v4/hot/word/query.json`, {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(this.config.timeout)
        })
      ]);

      const stocksData = stocksResponse.ok ? await stocksResponse.json() : { data: [] };
      const topicsData = topicsResponse.ok ? await topicsResponse.json() : { data: [] };

      return {
        hotStocks: this.transformQuoteData(stocksData.data || []),
        hotTopics: (topicsData.data || []).map((item: any) => item.word).slice(0, 10)
      };
    } catch (error) {
      console.error('获取雪球热门数据失败:', error);
      return {
        hotStocks: [],
        hotTopics: []
      };
    }
  }

  /**
   * 设置认证token
   */
  setToken(token: string): void {
    this.config.token = token;
  }

  /**
   * 获取支持的股票市场
   */
  getSupportedMarkets(): string[] {
    return ['SSE', 'SZSE', 'BSE', 'HKEX', 'NASDAQ', 'NYSE'];
  }
}