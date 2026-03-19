/**
 * 证券数据API集成
 * 
 * 提供统一的证券搜索和价格更新接口
 * 支持多个数据源: Tushare, Yahoo Finance, Alpha Vantage
 */

import {
  apiConfig,
  isApiEnabled,
  SecuritySearchParams,
  SecurityApiResult,
  PriceUpdateParams,
  PriceData,
  rateLimiter,
  logApiCall,
  logApiError,
} from './securities-api-config';

/**
 * 搜索证券
 * @param params 搜索参数
 * @returns 证券列表
 */
export async function searchSecurities(params: SecuritySearchParams): Promise<SecurityApiResult[]> {
  // 如果API未启用，返回空数组（使用本地数据库）
  if (!isApiEnabled()) {
    return [];
  }

  // 检查速率限制
  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getWaitTime();
    throw new Error(`API速率限制，请${Math.ceil(waitTime / 1000)}秒后重试`);
  }

  try {
    logApiCall(apiConfig.provider, 'searchSecurities', params);
    rateLimiter.recordRequest();

    switch (apiConfig.provider) {
      case 'tushare':
        return await searchTushare(params);
      case 'yahoo':
        return await searchYahoo(params);
      case 'alphavantage':
        return await searchAlphaVantage(params);
      default:
        return [];
    }
  } catch (error: any) {
    logApiError(apiConfig.provider, 'searchSecurities', error);
    throw error;
  }
}

/**
 * 更新证券价格
 * @param params 更新参数
 * @returns 价格数据
 */
export async function updatePrices(params: PriceUpdateParams): Promise<PriceData[]> {
  if (!isApiEnabled()) {
    throw new Error('证券价格API未启用');
  }

  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getWaitTime();
    throw new Error(`API速率限制，请${Math.ceil(waitTime / 1000)}秒后重试`);
  }

  try {
    logApiCall(apiConfig.provider, 'updatePrices', params);
    rateLimiter.recordRequest();

    switch (apiConfig.provider) {
      case 'tushare':
        return await fetchPricesTushare(params);
      case 'yahoo':
        return await fetchPricesYahoo(params);
      case 'alphavantage':
        return await fetchPricesAlphaVantage(params);
      default:
        return [];
    }
  } catch (error: any) {
    logApiError(apiConfig.provider, 'updatePrices', error);
    throw error;
  }
}

// ===== Tushare实现 =====

async function searchTushare(params: SecuritySearchParams): Promise<SecurityApiResult[]> {
  try {
    // Tushare搜索接口 - 获取所有股票基本信息
    const response = await fetch(apiConfig.endpoint || 'https://api.tushare.pro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_name: 'stock_basic',
        token: apiConfig.apiKey,
        params: {
          list_status: 'L', // 只返回上市中的股票
        },
        fields: 'ts_code,symbol,name,area,industry,market,exchange,list_status',
      }),
    });

    if (!response.ok) {
      throw new Error(`Tushare API请求失败: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.code !== 0) {
      throw new Error(`Tushare API错误 (code: ${data.code}): ${data.msg || '未知错误'}`);
    }

    if (!data.data || !data.data.items) {
      return [];
    }

    // 在客户端过滤匹配的结果
    const query = params.query.toLowerCase();
    const results = data.data.items
      .filter((item: any[]) => {
        const tsCode = item[0]?.toLowerCase() || ''; // ts_code: 000001.SZ
        const symbol = item[1]?.toLowerCase() || ''; // symbol: 000001
        const name = item[2]?.toLowerCase() || ''; // name: 平安银行
        
        return tsCode.includes(query) || 
               symbol.includes(query) || 
               name.includes(query);
      })
      .map((item: any[]) => {
        const tsCode = item[0]; // 如: 000001.SZ
        const symbol = item[1]; // 如: 000001
        const name = item[2]; // 如: 平安银行
        const area = item[3]; // 地区
        const industry = item[4]; // 行业
        const market = item[5]; // 市场类型
        const exchange = item[6]; // 交易所
        const listStatus = item[7]; // 上市状态

        // 根据ts_code后缀判断市场
        let regionCode = 'CN';
        let currency = 'CNY';
        let exchangeName = exchange;
        
        if (tsCode.includes('.HK')) {
          regionCode = 'HK';
          currency = 'HKD';
          exchangeName = 'HKEX';
        } else if (tsCode.includes('.SH')) {
          exchangeName = 'SSE'; // 上交所
        } else if (tsCode.includes('.SZ')) {
          exchangeName = 'SZSE'; // 深交所
        } else if (tsCode.includes('.BJ')) {
          exchangeName = 'BSE'; // 北交所
        }

        return {
          symbol: symbol,
          name: name,
          nameEn: name,
          exchange: exchangeName,
          market: regionCode,
          currency: currency,
          sector: area || '未分类',
          industry: industry || '未分类',
          marketCap: undefined,
          isActive: listStatus === 'L',
        };
      })
      .slice(0, params.limit || 50);

    return results;
  } catch (error: any) {
    console.error('Tushare搜索失败:', error);
    throw error;
  }
}

async function fetchPricesTushare(params: PriceUpdateParams): Promise<PriceData[]> {
  try {
    // 转换symbol为ts_code格式 (需要加上交易所后缀)
    const tsCodes = params.symbols.map(symbol => {
      // 简单判断：6开头的是上交所，0/3开头的是深交所
      if (symbol.startsWith('6')) {
        return `${symbol}.SH`;
      } else if (symbol.startsWith('0') || symbol.startsWith('3')) {
        return `${symbol}.SZ`;
      } else if (symbol.startsWith('8') || symbol.startsWith('4')) {
        return `${symbol}.BJ`;
      }
      return symbol;
    });

    const response = await fetch(apiConfig.endpoint || 'https://api.tushare.pro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_name: 'daily',
        token: apiConfig.apiKey,
        params: {
          ts_code: tsCodes.join(','),
        },
        fields: 'ts_code,trade_date,close,pre_close,change,pct_chg,vol',
      }),
    });

    if (!response.ok) {
      throw new Error(`Tushare API请求失败: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.code !== 0) {
      throw new Error(`Tushare API错误: ${data.msg || '未知错误'}`);
    }

    if (!data.data || !data.data.items) {
      return [];
    }

    return data.data.items.map((item: any[]) => {
      const tsCode = item[0];
      const symbol = tsCode.split('.')[0]; // 去掉交易所后缀
      const tradeDate = item[1];
      const close = parseFloat(item[2]);
      const preClose = parseFloat(item[3]);
      const change = parseFloat(item[4]);
      const pctChg = parseFloat(item[5]);
      const volume = parseFloat(item[6]);

      return {
        symbol: symbol,
        price: close,
        change: change,
        changePercent: pctChg,
        volume: volume,
        timestamp: new Date(tradeDate),
      };
    });
  } catch (error: any) {
    console.error('Tushare价格获取失败:', error);
    throw error;
  }
}

// ===== Yahoo Finance实现 =====

async function searchYahoo(params: SecuritySearchParams): Promise<SecurityApiResult[]> {
  try {
    // 使用Yahoo Finance搜索API
    const query = encodeURIComponent(params.query);
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${query}&quotesCount=25&newsCount=0`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API错误: ${response.statusText}`);
    }

    const data = await response.json();
    const quotes = data.quotes || [];
    
    return quotes
      .filter((quote: any) => quote.quoteType === 'EQUITY' || quote.quoteType === 'ETF')
      .map((quote: any) => {
        // 判断市场
        let market = 'US';
        let currency = 'USD';
        let exchange = quote.exchange || '';
        
        if (quote.symbol.includes('.HK')) {
          market = 'HK';
          currency = 'HKD';
        } else if (quote.symbol.includes('.SS') || quote.symbol.includes('.SZ')) {
          market = 'CN';
          currency = 'CNY';
        }
        
        return {
          symbol: quote.symbol,
          name: quote.longname || quote.shortname || quote.symbol,
          nameEn: quote.longname || quote.shortname,
          exchange: exchange,
          market: market,
          currency: currency,
          sector: quote.sector || '未分类',
          industry: quote.industry || '未分类',
          isActive: true,
        };
      })
      .slice(0, params.limit || 50);
  } catch (error: any) {
    console.error('Yahoo Finance搜索失败:', error);
    throw error;
  }
}

async function fetchPricesYahoo(params: PriceUpdateParams): Promise<PriceData[]> {
  try {
    const symbols = params.symbols.join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API错误: ${response.statusText}`);
    }

    const data = await response.json();
    const quotes = data.quoteResponse?.result || [];
    
    return quotes.map((quote: any) => ({
      symbol: quote.symbol,
      price: quote.regularMarketPrice || 0,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      volume: quote.regularMarketVolume || 0,
      timestamp: new Date(quote.regularMarketTime * 1000),
    }));
  } catch (error: any) {
    console.error('Yahoo Finance价格获取失败:', error);
    throw error;
  }
}

// ===== Alpha Vantage实现 =====

async function searchAlphaVantage(params: SecuritySearchParams): Promise<SecurityApiResult[]> {
  // TODO: 实现Alpha Vantage搜索
  // 文档: https://www.alphavantage.co/documentation/
  
  const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(params.query)}&apikey=${apiConfig.apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Alpha Vantage API错误: ${response.statusText}`);
  }

  const data = await response.json();
  
  return (data.bestMatches || []).map((item: any) => ({
    symbol: item['1. symbol'],
    name: item['2. name'],
    nameEn: item['2. name'],
    exchange: item['4. region'],
    market: 'US',
    currency: item['8. currency'],
    isActive: true,
  })).slice(0, params.limit || 50);
}

async function fetchPricesAlphaVantage(params: PriceUpdateParams): Promise<PriceData[]> {
  // TODO: 实现Alpha Vantage价格获取
  console.warn('Alpha Vantage价格获取功能待实现');
  return [];
}

// ===== 工具函数 =====

function getCurrency(market: string): string {
  const currencyMap: Record<string, string> = {
    CN: 'CNY',
    HK: 'HKD',
    US: 'USD',
    JP: 'JPY',
    UK: 'GBP',
    SG: 'SGD',
  };
  return currencyMap[market] || 'USD';
}

/**
 * 批量导入证券到数据库
 * @param securities API返回的证券列表
 */
export async function importSecuritiesToDb(securities: SecurityApiResult[]): Promise<number> {
  // TODO: 实现批量导入逻辑
  // 1. 检查证券是否已存在
  // 2. 创建不存在的证券
  // 3. 更新已存在证券的信息
  
  console.warn('批量导入功能待实现');
  return 0;
}

/**
 * 同步证券状态（检测退市等）
 */
export async function syncSecurityStatus(): Promise<void> {
  // TODO: 实现证券状态同步
  // 1. 获取所有活跃证券
  // 2. 检查是否退市
  // 3. 更新isActive字段
  
  console.warn('证券状态同步功能待实现');
}
