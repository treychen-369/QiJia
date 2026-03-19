/**
 * 证券价格更新服务
 * 
 * 功能：
 * 1. 从多个数据源获取实时股票价格
 * 2. 更新数据库中的持仓价格
 * 3. 记录操作日志
 */
import { prisma } from '@/lib/prisma';
import { exchangeRateService } from '@/lib/exchange-rate-service';
import { ActivityLogService } from './activity-log-service';

// 股票价格数据接口
interface StockQuote {
  symbol: string;
  price: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  timestamp?: Date;
  source: string;
}

// 价格更新结果
interface PriceUpdateResult {
  success: boolean;
  totalUpdated: number;
  totalFailed: number;
  updates: Array<{
    holdingId: string;
    symbol: string;
    previousPrice: number;
    newPrice: number;
    change: number;
    changePercent: number;
  }>;
  errors: string[];
  source: string;
  timestamp: Date;
}

export class PriceUpdateService {
  // 数据源配置
  private static readonly DATA_SOURCES = {
    // 东方财富 - 主要数据源
    eastmoney: {
      name: '东方财富',
      priority: 1,
      supportedMarkets: ['CN', 'HK', 'US'],
    },
    // 新浪财经 - 备用数据源
    sina: {
      name: '新浪财经',
      priority: 2,
      supportedMarkets: ['CN', 'HK', 'US'],
    },
    // 腾讯股票 - 备用数据源
    tencent: {
      name: '腾讯股票',
      priority: 3,
      supportedMarkets: ['CN', 'HK'],
    },
  };

  /**
   * 更新所有持仓的价格
   */
  static async updateAllPrices(userId: string): Promise<PriceUpdateResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const updates: PriceUpdateResult['updates'] = [];
    let source = '';

    try {
      // 1. 获取用户所有持仓
      const holdings = await prisma.holding.findMany({
        where: { userId },
        include: {
          security: {
            include: { region: true },
          },
          account: true,
        },
      });

      if (holdings.length === 0) {
        return {
          success: true,
          totalUpdated: 0,
          totalFailed: 0,
          updates: [],
          errors: [],
          source: 'none',
          timestamp: new Date(),
        };
      }

      // 2. 按市场分组
      const holdingsByMarket = this.groupByMarket(holdings);
      console.log(`📊 [PriceUpdate] 持仓分组:`, Array.from(holdingsByMarket.entries()).map(([m, h]: [string, any[]]) => `${m}: ${h.length}条`).join(', '));
      
      // 3. 获取各市场的实时价格
      const quotes = new Map<string, StockQuote>();
      
      for (const [market, marketHoldings] of Array.from(holdingsByMarket.entries()) as [string, any[]][]) {
        const symbols = marketHoldings.map((h: any) => h.security.symbol);
        console.log(`🔍 [PriceUpdate] 获取 ${market} 市场价格, 股票代码:`, symbols);
        
        const marketQuotes = await this.fetchPricesByMarket(market, symbols);
        console.log(`📈 [PriceUpdate] ${market} 市场返回 ${marketQuotes.length} 条价格数据:`, 
          marketQuotes.map(q => `${q.symbol}=${q.price}`).join(', '));
        
        if (marketQuotes.length > 0) {
          source = marketQuotes[0].source;
          // 同时存储多种格式的键（处理港股代码差异）
          marketQuotes.forEach(q => {
            quotes.set(q.symbol, q);
            // 港股：同时存储带前导零和不带前导零的版本
            if (market === 'HK') {
              quotes.set(q.symbol.padStart(5, '0'), q);
              quotes.set(q.symbol.replace(/^0+/, ''), q);
            }
          });
        }
      }
      
      console.log(`📋 [PriceUpdate] 价格映射中的所有键:`, Array.from(quotes.keys()).join(', '));

      // 4. 更新数据库
      for (const holding of holdings) {
        // 尝试多种格式匹配
        const symbol = holding.security.symbol;
        const paddedSymbol = symbol.padStart(5, '0');
        const trimmedSymbol = symbol.replace(/^0+/, '');
        // 处理带点的美股代码（如 BRK.B -> BRK）
        const baseSymbol = symbol.split('.')[0];
        
        let quote = quotes.get(symbol) 
          || quotes.get(paddedSymbol)
          || quotes.get(trimmedSymbol)
          || quotes.get(symbol.toUpperCase())
          || quotes.get(baseSymbol)
          || quotes.get(baseSymbol.toUpperCase());
        
        if (!quote) {
          errors.push(`无法获取 ${symbol} 的价格`);
          continue;
        }

        const previousPrice = Number(holding.currentPrice || 0);
        const newPrice = quote.price;

        // 价格相同则跳过
        if (Math.abs(previousPrice - newPrice) < 0.001) {
          continue;
        }

        // 计算新的市值和盈亏
        const quantity = Number(holding.quantity);
        const averageCost = Number(holding.averageCost);
        const exchangeRate = await exchangeRateService.getRate(holding.account.currency, 'CNY');
        
        const marketValueOriginal = quantity * newPrice;
        const marketValueCny = marketValueOriginal * exchangeRate;
        const costBasis = quantity * averageCost;
        const costBasisCny = costBasis * exchangeRate;
        const unrealizedPnl = marketValueCny - costBasisCny;
        const unrealizedPnlPercent = costBasisCny > 0 ? (unrealizedPnl / costBasisCny) * 100 : 0;

        // 更新数据库
        await prisma.holding.update({
          where: { id: holding.id },
          data: {
            currentPrice: newPrice,
            marketValueOriginal,
            marketValueCny,
            unrealizedPnl,
            unrealizedPnlPercent,
            lastUpdated: new Date(),
          },
        });

        updates.push({
          holdingId: holding.id,
          symbol: holding.security.symbol,
          previousPrice,
          newPrice,
          change: newPrice - previousPrice,
          changePercent: previousPrice > 0 ? ((newPrice - previousPrice) / previousPrice) * 100 : 0,
        });
      }

      // 5. 记录操作日志
      if (updates.length > 0) {
        await ActivityLogService.logPriceUpdates(
          userId,
          updates.map(u => {
            const holding = holdings.find(h => h.id === u.holdingId);
            return {
              assetId: u.holdingId,
              assetName: holding?.security.name || u.symbol,
              assetSymbol: u.symbol,
              previousPrice: u.previousPrice,
              newPrice: u.newPrice,
              currency: holding?.account.currency || 'CNY',
            };
          }),
          'api'
        );
      }

      console.log(`📈 [PriceUpdate] 完成价格更新: ${updates.length}/${holdings.length} 条, 耗时 ${Date.now() - startTime}ms`);

      return {
        success: true,
        totalUpdated: updates.length,
        totalFailed: errors.length,
        updates,
        errors,
        source: source || 'unknown',
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('❌ [PriceUpdate] 更新失败:', error);
      return {
        success: false,
        totalUpdated: updates.length,
        totalFailed: 1,
        updates,
        errors: [error instanceof Error ? error.message : '未知错误'],
        source: 'error',
        timestamp: new Date(),
      };
    }
  }

  /**
   * 按市场分组持仓
   */
  private static groupByMarket(holdings: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    for (const holding of holdings) {
      const market = this.getMarketCode(holding.security.symbol, holding.security.region?.code);
      
      if (!groups.has(market)) {
        groups.set(market, []);
      }
      groups.get(market)!.push(holding);
    }
    
    return groups;
  }

  /**
   * 判断市场代码
   */
  private static getMarketCode(symbol: string, regionCode?: string): string {
    // 根据region判断
    if (regionCode) {
      if (regionCode === 'HK') return 'HK';
      if (regionCode === 'US') return 'US';
      if (regionCode === 'CN' || regionCode === 'A_SHARE') return 'CN';
    }
    
    // 根据股票代码判断
    if (/^\d{4,5}$/.test(symbol)) return 'HK';  // 港股：4-5位数字
    if (/^\d{6}$/.test(symbol)) return 'CN';    // A股：6位数字
    if (/^[A-Z]+$/.test(symbol)) return 'US';   // 美股：纯字母
    
    return 'CN'; // 默认A股
  }

  /**
   * 按市场获取价格
   */
  private static async fetchPricesByMarket(market: string, symbols: string[]): Promise<StockQuote[]> {
    // 尝试多个数据源（根据市场选择不同优先级）
    let quotes: StockQuote[] = [];
    
    // 美股优先使用腾讯（支持更多股票，包括 BRK.B 这类带点的代码）
    if (market === 'US') {
      try {
        quotes = await this.fetchFromTencent(market, symbols);
        if (quotes.length > 0) return quotes;
      } catch (e) {
        console.warn(`腾讯股票数据源失败 (${market}):`, e);
      }
    }
    
    // 东方财富（A股和港股的首选）
    try {
      quotes = await this.fetchFromEastmoney(market, symbols);
      if (quotes.length > 0) return quotes;
    } catch (e) {
      console.warn(`东方财富数据源失败 (${market}):`, e);
    }

    // 备用：新浪财经
    try {
      quotes = await this.fetchFromSina(market, symbols);
      if (quotes.length > 0) return quotes;
    } catch (e) {
      console.warn(`新浪财经数据源失败 (${market}):`, e);
    }

    // 最后备用：腾讯股票（非美股）
    if (market !== 'US') {
      try {
        quotes = await this.fetchFromTencent(market, symbols);
        if (quotes.length > 0) return quotes;
      } catch (e) {
        console.warn(`腾讯股票数据源失败 (${market}):`, e);
      }
    }

    return quotes;
  }

  /**
   * 东方财富数据源
   */
  private static async fetchFromEastmoney(market: string, symbols: string[]): Promise<StockQuote[]> {
    const quotes: StockQuote[] = [];
    
    // 构建东方财富API参数
    const secIds = symbols.map(symbol => {
      if (market === 'CN') {
        // A股代码规则：
        // 6开头：上海主板股票 (市场代码1)
        // 5开头：上海基金/ETF (市场代码1)
        // 0/3开头：深圳股票 (市场代码0)
        // 1开头：深圳基金/ETF (市场代码0)
        const isShanghai = symbol.startsWith('6') || symbol.startsWith('5');
        return isShanghai ? `1.${symbol}` : `0.${symbol}`;
      } else if (market === 'HK') {
        // 港股
        return `116.${symbol.padStart(5, '0')}`;
      } else if (market === 'US') {
        // 美股
        return `105.${symbol}`;
      }
      return `0.${symbol}`;
    }).join(',');

    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f4,f12,f14&secids=${secIds}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://quote.eastmoney.com/',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.data?.diff) {
        for (const item of data.data.diff) {
          if (item.f2 !== '-') {
            quotes.push({
              symbol: item.f12,
              price: parseFloat(item.f2),
              change: parseFloat(item.f4 || '0'),
              changePercent: parseFloat(item.f3 || '0'),
              source: '东方财富',
              timestamp: new Date(),
            });
          }
        }
      }
    } catch (error) {
      console.error('东方财富API错误:', error);
      throw error;
    }

    return quotes;
  }

  /**
   * 新浪财经数据源
   */
  private static async fetchFromSina(market: string, symbols: string[]): Promise<StockQuote[]> {
    const quotes: StockQuote[] = [];
    
    // 构建新浪股票代码
    const sinaSymbols = symbols.map(symbol => {
      if (market === 'CN') {
        // 6/5开头是上海，0/1/3开头是深圳
        const isShanghai = symbol.startsWith('6') || symbol.startsWith('5');
        return isShanghai ? `sh${symbol}` : `sz${symbol}`;
      } else if (market === 'HK') {
        return `hk${symbol.padStart(5, '0')}`;
      } else if (market === 'US') {
        return `gb_${symbol.toLowerCase()}`;
      }
      return `sz${symbol}`;
    }).join(',');

    const url = `https://hq.sinajs.cn/list=${sinaSymbols}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://finance.sina.com.cn/',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      const lines = text.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const match = line.match(/var hq_str_(\w+)="([^"]+)"/);
        if (match) {
          const [, code, data] = match;
          const parts = data.split(',');
          
          if (parts.length >= 4) {
            let symbol = code;
            let price = 0;
            
            if (market === 'CN') {
              symbol = code.replace(/^(sh|sz)/, '');
              price = parseFloat(parts[3]); // 当前价格
            } else if (market === 'HK') {
              symbol = code.replace(/^hk/, '');
              price = parseFloat(parts[6]); // 当前价格
            } else if (market === 'US') {
              symbol = code.replace(/^gb_/, '').toUpperCase();
              price = parseFloat(parts[1]); // 当前价格
            }
            
            if (price > 0) {
              quotes.push({
                symbol,
                price,
                source: '新浪财经',
                timestamp: new Date(),
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('新浪财经API错误:', error);
      throw error;
    }

    return quotes;
  }

  /**
   * 腾讯股票数据源
   */
  private static async fetchFromTencent(market: string, symbols: string[]): Promise<StockQuote[]> {
    const quotes: StockQuote[] = [];
    
    // 构建腾讯股票代码
    const qqSymbols = symbols.map(symbol => {
      if (market === 'CN') {
        // 6/5开头是上海，0/1/3开头是深圳
        const isShanghai = symbol.startsWith('6') || symbol.startsWith('5');
        return isShanghai ? `sh${symbol}` : `sz${symbol}`;
      } else if (market === 'HK') {
        return `hk${symbol.padStart(5, '0')}`;
      } else if (market === 'US') {
        return `us${symbol.toUpperCase()}`;
      }
      return `sz${symbol}`;
    }).join(',');

    const url = `https://qt.gtimg.cn/q=${qqSymbols}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://gu.qq.com/',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      const lines = text.split(';').filter(line => line.trim());

      for (const line of lines) {
        // 修改正则以匹配带点的股票代码（如 usBRK.B）
        const match = line.match(/v_([\w.]+)="([^"]+)"/);
        if (match) {
          const [, code, data] = match;
          const parts = data.split('~');
          
          if (parts.length >= 4) {
            let symbol = code;
            const price = parseFloat(parts[3]); // 当前价格
            
            if (market === 'CN') {
              symbol = code.replace(/^(sh|sz)/, '');
            } else if (market === 'HK') {
              symbol = code.replace(/^hk/, '');
            } else if (market === 'US') {
              // 美股代码需要处理后缀（如 .N, .AM）
              symbol = code.replace(/^us/, '').replace(/\.\w+$/, '').toUpperCase();
            }
            
            if (price > 0) {
              quotes.push({
                symbol,
                price,
                change: parseFloat(parts[31] || '0'),
                changePercent: parseFloat(parts[32] || '0'),
                source: '腾讯股票',
                timestamp: new Date(),
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('腾讯股票API错误:', error);
      throw error;
    }

    return quotes;
  }

  /**
   * 批量更新所有用户的持仓价格（供定时任务调用）
   */
  static async updateAllUsersPrices(): Promise<{
    success: number;
    failed: number;
    totalUpdated: number;
    errors: Array<{ userId: string; error: string }>;
  }> {
    // 查询所有有持仓的活跃用户
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        holdings: { some: {} },
      },
      select: { id: true, email: true },
    });

    let successCount = 0;
    let failedCount = 0;
    let totalUpdated = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    for (const user of users) {
      try {
        const result = await this.updateAllPrices(user.id);
        if (result.success) {
          successCount++;
          totalUpdated += result.totalUpdated;
          console.log(`✅ [PriceUpdate] 用户 ${user.email}: 更新 ${result.totalUpdated} 条`);
        } else {
          failedCount++;
          errors.push({ userId: user.id, error: result.errors.join('; ') });
          console.warn(`⚠️ [PriceUpdate] 用户 ${user.email}: ${result.errors.join('; ')}`);
        }
      } catch (error) {
        failedCount++;
        const msg = error instanceof Error ? error.message : String(error);
        errors.push({ userId: user.id, error: msg });
        console.error(`❌ [PriceUpdate] 用户 ${user.email} 失败:`, msg);
      }
    }

    return { success: successCount, failed: failedCount, totalUpdated, errors };
  }

  /**
   * 获取单个股票的实时价格
   */
  static async getStockPrice(symbol: string, market: string): Promise<StockQuote | null> {
    const quotes = await this.fetchPricesByMarket(market, [symbol]);
    return quotes.find(q => q.symbol === symbol) || null;
  }

  /**
   * 检查市场是否开盘
   */
  static isMarketOpen(market: string): boolean {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const day = now.getDay();
    
    // 周末不开盘
    if (day === 0 || day === 6) return false;
    
    const currentTime = hour * 60 + minute;
    
    switch (market) {
      case 'CN':
        // A股：9:30-11:30, 13:00-15:00 (北京时间)
        return (currentTime >= 570 && currentTime <= 690) || 
               (currentTime >= 780 && currentTime <= 900);
      case 'HK':
        // 港股：9:30-12:00, 13:00-16:00 (香港时间)
        return (currentTime >= 570 && currentTime <= 720) || 
               (currentTime >= 780 && currentTime <= 960);
      case 'US':
        // 美股：21:30-4:00 (北京时间，夏令时)
        return currentTime >= 1290 || currentTime <= 240;
      default:
        return true;
    }
  }
}
