// 汇率服务

// 本地默认汇率（兜底值）
const LOCAL_DEFAULT_RATES: ExchangeRates = {
  baseCurrency: 'CNY',
  rates: {
    USD: 7.2,
    HKD: 0.92,
    CNY: 1,
  },
  lastUpdated: new Date().toISOString(),
  source: 'local-fallback',
  error: '使用本地默认汇率',
}

export interface ExchangeRates {
  baseCurrency: string
  rates: {
    USD: number
    HKD: number
    CNY: number
    [key: string]: number
  }
  lastUpdated: string
  source: string
  error?: string
  cachedAt?: string
}

export interface ExchangeRateResponse {
  success: boolean
  data: ExchangeRates
  cached?: boolean
  message?: string
  error?: string
  warning?: string
}

/**
 * 获取当前汇率（从数据库缓存读取）
 */
export async function getExchangeRates(): Promise<ExchangeRates> {
  try {
    const response = await fetch('/api/exchange-rates', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })

    if (!response.ok) {
      console.warn('获取汇率API调用失败，使用本地默认值')
      return LOCAL_DEFAULT_RATES
    }

    const result: ExchangeRateResponse = await response.json()
    
    if (!result.success || !result.data) {
      console.warn('汇率数据格式错误，使用本地默认值')
      return LOCAL_DEFAULT_RATES
    }

    return result.data
  } catch (error) {
    console.error('获取汇率失败:', error)
    // 发生错误时返回本地默认汇率
    return LOCAL_DEFAULT_RATES
  }
}

/**
 * 手动刷新汇率（只在用户点击刷新按钮时调用）
 */
export async function refreshExchangeRates(): Promise<ExchangeRates> {
  try {
    const response = await fetch('/api/exchange-rates', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.warn('刷新汇率API调用失败，使用本地默认值')
      return LOCAL_DEFAULT_RATES
    }

    const result: ExchangeRateResponse = await response.json()
    
    // 即使success为false，也可能返回了fallback数据
    if (result.data) {
      return result.data
    }
    
    console.warn('刷新汇率返回空数据，使用本地默认值')
    return LOCAL_DEFAULT_RATES
  } catch (error) {
    console.error('刷新汇率失败:', error)
    // 发生错误时返回本地默认汇率
    return LOCAL_DEFAULT_RATES
  }
}

/**
 * 格式化汇率显示
 */
export function formatExchangeRate(rate: number, decimals: number = 4): string {
  return rate.toFixed(decimals)
}

/**
 * 货币转换
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRates
): number {
  if (fromCurrency === toCurrency) {
    return amount
  }

  // 转换逻辑：先转换为基础货币（CNY），再转换为目标货币
  if (fromCurrency === rates.baseCurrency) {
    // 从 CNY 转换到其他货币
    return amount / rates.rates[toCurrency]
  } else if (toCurrency === rates.baseCurrency) {
    // 从其他货币转换到 CNY
    return amount * rates.rates[fromCurrency]
  } else {
    // 从非CNY货币转换到另一个非CNY货币
    const amountInCny = amount * rates.rates[fromCurrency]
    return amountInCny / rates.rates[toCurrency]
  }
}

/**
 * 获取货币符号
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    CNY: '¥',
    USD: '$',
    HKD: 'HK$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  }
  return symbols[currency] || currency
}

/**
 * 格式化货币金额
 */
export function formatCurrencyAmount(
  amount: number,
  currency: string,
  showSymbol: boolean = true
): string {
  const formatted = amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  if (showSymbol) {
    return `${getCurrencySymbol(currency)}${formatted}`
  }

  return formatted
}

// 汇率缓存（内存级别，避免频繁API调用）
let ratesCache: {
  rates: Record<string, number>;
  fetchedAt: number;
  source: string;
} | null = null;

// 缓存有效期：5分钟（实时性与性能平衡）
const CACHE_TTL_MS = 5 * 60 * 1000;

// 数据库缓存有效期：24小时（外部API不可达时使用数据库中上次成功的汇率）
const DB_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// 并发请求去重：多个并发 getRate() 调用共享同一个 fetchLiveRates() promise
let inflightFetchPromise: Promise<{ rates: Record<string, number>; source: string }> | null = null;

/**
 * 从数据库缓存读取汇率（优先于外部API）
 */
async function fetchRatesFromDatabase(): Promise<{ rates: Record<string, number>; source: string; updatedAt: string } | null> {
  try {
    const { prisma } = await import('./prisma');
    const config = await prisma.systemConfig.findUnique({
      where: { configKey: 'EXCHANGE_RATES' },
    });
    
    if (!config || !config.configValue) return null;
    
    const cached = config.configValue as any;
    if (!cached.rates || !cached.lastUpdated) return null;
    
    // 检查数据库缓存是否过期（24小时）
    const cacheAge = Date.now() - new Date(cached.lastUpdated).getTime();
    if (cacheAge > DB_CACHE_TTL_MS) {
      console.log('📦 [ExchangeRateService] 数据库缓存已过期（超过24小时）');
      return null;
    }
    
    return {
      rates: cached.rates,
      source: cached.source || 'unknown',
      updatedAt: cached.lastUpdated,
    };
  } catch {
    return null;
  }
}

/**
 * 从实时API获取汇率数据
 * 支持多个API源容错
 */
async function fetchLiveRates(): Promise<{ rates: Record<string, number>; source: string }> {
  const apis = [
    {
      name: 'exchangerate-api.com',
      url: 'https://api.exchangerate-api.com/v4/latest/CNY',
      parse: (data: any) => ({
        USD: 1 / (data.rates?.USD || 0.139),
        HKD: 1 / (data.rates?.HKD || 1.085),
        JPY: 1 / (data.rates?.JPY || 20.8),
        EUR: 1 / (data.rates?.EUR || 0.128),
        GBP: 1 / (data.rates?.GBP || 0.109),
        CNY: 1,
      })
    },
    {
      name: 'frankfurter.app',
      url: 'https://api.frankfurter.app/latest?from=CNY',
      parse: (data: any) => ({
        USD: 1 / (data.rates?.USD || 0.139),
        HKD: 1 / (data.rates?.HKD || 1.085),
        JPY: 1 / (data.rates?.JPY || 20.8),
        EUR: 1 / (data.rates?.EUR || 0.128),
        GBP: 1 / (data.rates?.GBP || 0.109),
        CNY: 1,
      })
    }
  ];

  for (const api of apis) {
    try {
      const response = await fetch(api.url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000), // 8秒超时
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const rates = api.parse(data);
      
      console.log(`✅ [ExchangeRateService] 从 ${api.name} 获取实时汇率成功`);
      
      return { rates, source: api.name };
    } catch (error: any) {
      // 超时错误只打简短日志，不打堆栈
      const msg = error?.name === 'TimeoutError' || error?.message?.includes('timeout')
        ? `超时` : (error?.message || '未知错误');
      console.warn(`⚠️ [ExchangeRateService] ${api.name}: ${msg}`);
    }
  }

  // 所有API都失败，尝试从数据库缓存获取
  const dbCache = await fetchRatesFromDatabase();
  if (dbCache) {
    console.log(`📦 [ExchangeRateService] 外部API不可达，使用数据库缓存汇率（原始来源: ${dbCache.source}，缓存时间: ${dbCache.updatedAt}）`);
    return { rates: dbCache.rates, source: `db-cache` };
  }

  // 数据库也没有，返回本地默认值
  console.warn('⚠️ [ExchangeRateService] 所有源均不可达，使用本地默认汇率');
  return {
    rates: LOCAL_DEFAULT_RATES.rates,
    source: 'fallback'
  };
}

/**
 * 后端专用的汇率服务
 * 用于API routes中的货币转换
 * 
 * 特性：
 * 1. 优先使用实时API获取汇率
 * 2. 内存缓存5分钟，平衡实时性和性能
 * 3. 多API容错机制
 */
export const exchangeRateService = {
  /**
   * 获取指定货币对的汇率
   * @param fromCurrency 源货币
   * @param toCurrency 目标货币
   * @returns 汇率值
   */
  async getRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    try {
      // 检查内存缓存是否有效
      const now = Date.now();
      if (ratesCache && (now - ratesCache.fetchedAt) < CACHE_TTL_MS) {
        // 使用缓存
        const rates = ratesCache.rates;
        const result = this.calculateRate(fromCurrency, toCurrency, rates);
        return result;
      }

      // 缓存过期或不存在，获取实时汇率（并发去重）
      let isInitiator = false;
      if (!inflightFetchPromise) {
        // 发起新请求，并让后续并发请求共享
        isInitiator = true;
        inflightFetchPromise = fetchLiveRates();
      }
      
      let fetchResult: { rates: Record<string, number>; source: string };
      try {
        fetchResult = await inflightFetchPromise;
      } finally {
        if (isInitiator) {
          inflightFetchPromise = null;
        }
      }
      
      const { rates, source } = fetchResult;
      
      // 更新内存缓存
      ratesCache = {
        rates,
        fetchedAt: now,
        source
      };

      // 只有发起请求的那个调用才更新数据库缓存（避免并发写入）
      if (isInitiator) {
        this.updateDatabaseCache(rates, source).catch(err => {
          console.error('❌ [ExchangeRateService] 更新数据库缓存失败:', err);
        });
      }

      return this.calculateRate(fromCurrency, toCurrency, rates);
    } catch (error) {
      console.error('❌ [ExchangeRateService] 获取汇率失败，使用默认汇率:', error);
      return this.calculateRate(fromCurrency, toCurrency, LOCAL_DEFAULT_RATES.rates);
    }
  },

  /**
   * 计算汇率
   */
  calculateRate(fromCurrency: string, toCurrency: string, rates: Record<string, number>): number {
    // 汇率说明：rates中的值表示 1 外币 = rate CNY
    // 例如：USD: 7.2 表示 1 USD = 7.2 CNY
    
    if (fromCurrency === 'CNY') {
      // CNY 转其他货币：1 CNY = 1/rate 外币
      return 1 / (rates[toCurrency] || 1);
    } else if (toCurrency === 'CNY') {
      // 其他货币转 CNY：1 外币 = rate CNY
      return rates[fromCurrency] || 1;
    } else {
      // 其他货币互转：通过CNY中转
      const fromRate = rates[fromCurrency] || 1;
      const toRate = rates[toCurrency] || 1;
      return fromRate / toRate;
    }
  },

  /**
   * 更新数据库缓存（异步）
   */
  async updateDatabaseCache(rates: Record<string, number>, source: string): Promise<void> {
    const { prisma } = await import('./prisma');
    
    await prisma.systemConfig.upsert({
      where: { configKey: 'EXCHANGE_RATES' },
      update: {
        configValue: {
          baseCurrency: 'CNY',
          rates,
          lastUpdated: new Date().toISOString(),
          source
        }
      },
      create: {
        configKey: 'EXCHANGE_RATES',
        configValue: {
          baseCurrency: 'CNY',
          rates,
          lastUpdated: new Date().toISOString(),
          source
        }
      }
    });
    
    console.log('✅ [ExchangeRateService] 数据库缓存已更新');
  },

  /**
   * 强制刷新汇率（绕过缓存）
   */
  async forceRefresh(): Promise<Record<string, number>> {
    const { rates, source } = await fetchLiveRates();
    
    // 更新内存缓存
    ratesCache = {
      rates,
      fetchedAt: Date.now(),
      source
    };

    // 更新数据库缓存
    await this.updateDatabaseCache(rates, source);
    
    return rates;
  },

  /**
   * 获取当前汇率信息（调试用）
   */
  getRateInfo(): { rates: Record<string, number>; source: string; age: number } | null {
    if (!ratesCache) return null;
    
    return {
      rates: ratesCache.rates,
      source: ratesCache.source,
      age: Math.floor((Date.now() - ratesCache.fetchedAt) / 1000) // 秒
    };
  },

  /**
   * 转换货币金额
   */
  async convert(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    const rate = await this.getRate(fromCurrency, toCurrency);
    return amount * rate;
  }
};

