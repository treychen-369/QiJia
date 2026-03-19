/**
 * 东方财富数据同步服务
 * 通过东方财富API获取股票数据和持仓信息
 */

import { BaseSyncService, StockData, PortfolioHolding } from './base-sync-service';

interface EastmoneyConfig {
  baseUrl: string;
  timeout: number;
  userAgent: string;
}

interface EastmoneyQuoteResponse {
  f2: number;  // 最新价
  f3: number;  // 涨跌幅
  f4: number;  // 涨跌额
  f5: number;  // 成交量
  f6: number;  // 成交额
  f12: string; // 股票代码
  f14: string; // 股票名称
  f15: number; // 最高价
  f16: number; // 最低价
  f17: number; // 开盘价
  f18: number; // 昨收价
  f20: number; // 总市值
  f21: number; // 流通市值
  f23: number; // 市盈率
  f24: number; // 市净率
}

export class EastmoneySyncService extends BaseSyncService {
  private config: EastmoneyConfig;

  constructor(config?: Partial<EastmoneyConfig>) {
    super('东方财富');
    
    this.config = {
      baseUrl: 'https://push2.eastmoney.com',
      timeout: 10000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...config
    };
  }

  /**
   * 获取股票实时价格数据
   */
  async getStockPrices(symbols: string[]): Promise<StockData[]> {
    return this.retryOperation(async () => {
      const results: StockData[] = [];
      
      // 东方财富支持批量查询，但建议分批处理
      const batchSize = 50;
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
    // 转换股票代码格式 (添加市场前缀)
    const formattedSymbols = symbols.map(symbol => this.formatSymbolForApi(symbol));
    const symbolsParam = formattedSymbols.join(',');

    const url = `${this.config.baseUrl}/api/qt/ulist.np/get` +
      `?fltt=2&invt=2&fields=f2,f3,f4,f5,f6,f12,f14,f15,f16,f17,f18,f20,f21,f23,f24` +
      `&secids=${symbolsParam}&_=${Date.now()}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.config.userAgent,
          'Referer': 'https://quote.eastmoney.com/',
          'Accept': 'application/json, text/plain, */*'
        },
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        throw new Error(`东方财富API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.data || !data.data.diff) {
        throw new Error('东方财富API返回数据格式错误');
      }

      return this.transformQuoteData(data.data.diff);
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('东方财富API请求超时');
      }
      throw error;
    }
  }

  /**
   * 格式化股票代码为API所需格式
   */
  private formatSymbolForApi(symbol: string): string {
    // 根据股票代码添加市场标识
    if (symbol.startsWith('00') || symbol.startsWith('30')) {
      return `0.${symbol}`; // 深市
    } else if (symbol.startsWith('60') || symbol.startsWith('68')) {
      return `1.${symbol}`; // 沪市
    } else if (symbol.startsWith('43') || symbol.startsWith('83')) {
      return `0.${symbol}`; // 新三板归类到深市
    }
    return `1.${symbol}`; // 默认沪市
  }

  /**
   * 转换行情数据格式
   */
  private transformQuoteData(apiData: EastmoneyQuoteResponse[]): StockData[] {
    return apiData.map(item => ({
      symbol: item.f12,
      name: item.f14,
      currentPrice: item.f2 || 0,
      change: item.f4 || 0,
      changePercent: item.f3 || 0,
      volume: item.f5 || 0,
      marketCap: item.f20,
      pe: item.f23,
      pb: item.f24,
      lastUpdated: new Date(),
      currency: 'CNY',
      exchange: this.getExchangeBySymbol(item.f12)
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
   * 注意：东方财富的持仓数据需要登录认证，这里提供框架
   */
  async getPortfolioHoldings(userId: string): Promise<PortfolioHolding[]> {
    return this.retryOperation(async () => {
      // 东方财富的持仓数据获取需要特殊处理
      // 可能需要通过模拟登录或其他方式获取
      console.warn('东方财富持仓数据获取需要登录认证，当前返回空数据');
      
      // 这里可以实现具体的持仓数据获取逻辑
      // 或者提示用户手动导入持仓数据
      return [];
    });
  }

  /**
   * 验证服务连接状态
   */
  async validateConnection(): Promise<boolean> {
    try {
      // 测试获取一只股票的数据来验证连接
      const testUrl = `${this.config.baseUrl}/api/qt/ulist.np/get` +
        `?fltt=2&invt=2&fields=f2,f12,f14&secids=1.000001&_=${Date.now()}`;
      
      const response = await fetch(testUrl, {
        headers: {
          'User-Agent': this.config.userAgent,
          'Referer': 'https://quote.eastmoney.com/'
        },
        signal: AbortSignal.timeout(5000)
      });

      return response.ok;
    } catch (error) {
      console.error('东方财富连接验证失败:', error);
      return false;
    }
  }

  /**
   * 获取股票详细信息
   */
  async getStockDetail(symbol: string): Promise<{
    symbol: string;
    name: string;
    industry: string;
    concept: string[];
    fundamentals: {
      pe: number;
      pb: number;
      roe: number;
      eps: number;
      bps: number;
    };
  } | null> {
    try {
      const formattedSymbol = this.formatSymbolForApi(symbol);
      const url = `${this.config.baseUrl}/api/qt/stock/get` +
        `?fltt=2&invt=2&fields=f57,f58,f84,f85,f86,f87,f88&secid=${formattedSymbol}&_=${Date.now()}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.config.userAgent,
          'Referer': 'https://quote.eastmoney.com/'
        },
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      if (!data.data) {
        return null;
      }

      const stockData = data.data;
      return {
        symbol: symbol,
        name: stockData.f58 || '',
        industry: stockData.f127 || '',
        concept: [], // 需要额外API获取概念板块
        fundamentals: {
          pe: stockData.f84 || 0,
          pb: stockData.f85 || 0,
          roe: stockData.f86 || 0,
          eps: stockData.f87 || 0,
          bps: stockData.f88 || 0
        }
      };
    } catch (error) {
      console.error('获取股票详细信息失败:', error);
      return null;
    }
  }

  /**
   * 获取市场指数数据
   */
  async getMarketIndices(): Promise<StockData[]> {
    const indices = [
      '1.000001', // 上证指数
      '0.399001', // 深证成指
      '0.399006', // 创业板指
      '1.000300', // 沪深300
      '0.399905'  // 中证500
    ];

    try {
      const symbolsParam = indices.join(',');
      const url = `${this.config.baseUrl}/api/qt/ulist.np/get` +
        `?fltt=2&invt=2&fields=f2,f3,f4,f5,f6,f12,f14&secids=${symbolsParam}&_=${Date.now()}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.config.userAgent,
          'Referer': 'https://quote.eastmoney.com/'
        },
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        throw new Error('获取市场指数失败');
      }

      const data = await response.json();
      return this.transformQuoteData(data.data?.diff || []);
    } catch (error) {
      console.error('获取市场指数失败:', error);
      return [];
    }
  }

  /**
   * 获取支持的股票市场
   */
  getSupportedMarkets(): string[] {
    return ['SSE', 'SZSE', 'NEEQ'];
  }

  /**
   * 获取热门股票
   */
  async getHotStocks(limit: number = 20): Promise<StockData[]> {
    try {
      const url = `${this.config.baseUrl}/api/qt/clist/get` +
        `?pn=1&pz=${limit}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23` +
        `&fields=f2,f3,f4,f5,f6,f12,f14&_=${Date.now()}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.config.userAgent,
          'Referer': 'https://quote.eastmoney.com/'
        },
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        throw new Error('获取热门股票失败');
      }

      const data = await response.json();
      return this.transformQuoteData(data.data?.diff || []);
    } catch (error) {
      console.error('获取热门股票失败:', error);
      return [];
    }
  }
}