/**
 * 证券数据API配置
 * 
 * 支持的数据源：
 * 1. Tushare - 中国A股、港股、美股数据
 * 2. Yahoo Finance - 全球市场数据（免费）
 * 3. Alpha Vantage - 美股数据（免费有限额）
 */

export interface SecurityApiConfig {
  enabled: boolean;
  provider: 'tushare' | 'yahoo' | 'alphavantage' | 'manual';
  apiKey?: string;
  endpoint?: string;
  rateLimit?: number; // 每分钟请求次数
}

// API配置（从环境变量读取）
export const apiConfig: SecurityApiConfig = {
  enabled: process.env.SECURITIES_API_ENABLED === 'true',
  provider: (process.env.SECURITIES_API_PROVIDER as any) || 'manual',
  apiKey: process.env.SECURITIES_API_KEY,
  endpoint: process.env.SECURITIES_API_ENDPOINT,
  rateLimit: parseInt(process.env.SECURITIES_API_RATE_LIMIT || '60'),
};

// 检查API是否可用
export function isApiEnabled(): boolean {
  return apiConfig.enabled && !!apiConfig.apiKey;
}

// 根据市场代码获取API提供商
export function getProviderForMarket(market: string): string {
  switch (market) {
    case 'CN':
      return 'tushare'; // A股优先使用Tushare
    case 'HK':
      return apiConfig.provider === 'tushare' ? 'tushare' : 'yahoo';
    case 'US':
      return apiConfig.provider === 'alphavantage' ? 'alphavantage' : 'yahoo';
    default:
      return 'yahoo'; // 其他市场使用Yahoo Finance
  }
}

/**
 * 证券搜索接口
 */
export interface SecuritySearchParams {
  query: string;
  market?: string; // CN, HK, US等
  limit?: number;
}

export interface SecurityApiResult {
  symbol: string;
  name: string;
  nameEn?: string;
  exchange: string;
  market: string;
  currency: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  isActive: boolean;
}

/**
 * 价格更新接口
 */
export interface PriceUpdateParams {
  symbols: string[];
  market: string;
}

export interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  timestamp: Date;
}

/**
 * API速率限制管理
 */
class RateLimiter {
  private requests: number[] = [];
  private limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // 清理1分钟前的请求记录
    this.requests = this.requests.filter(time => time > oneMinuteAgo);
    
    return this.requests.length < this.limit;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getWaitTime(): number {
    if (this.canMakeRequest()) return 0;
    
    const oldestRequest = this.requests[0];
    const waitTime = 60000 - (Date.now() - oldestRequest);
    return Math.max(0, waitTime);
  }
}

export const rateLimiter = new RateLimiter(apiConfig.rateLimit || 60);

/**
 * 日志记录
 */
export function logApiCall(provider: string, action: string, params?: any) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Securities API] ${provider} - ${action}`, params || '');
  }
}

export function logApiError(provider: string, action: string, error: any) {
  console.error(`[Securities API Error] ${provider} - ${action}:`, error.message);
}
