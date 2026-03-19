/**
 * 证券数据同步服务基类
 * 提供统一的数据同步接口和错误处理机制
 */

export interface SyncResult {
  success: boolean;
  updatedCount: number;
  errors: string[];
  lastSyncTime: Date;
  source: string;
}

export interface StockData {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  pe?: number;
  pb?: number;
  lastUpdated: Date;
  currency: string;
  exchange: string;
}

export interface PortfolioHolding {
  symbol: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  lastUpdated: Date;
}

export abstract class BaseSyncService {
  protected serviceName: string;
  protected isEnabled: boolean = true;
  protected lastSyncTime?: Date;
  protected syncInterval: number = 5 * 60 * 1000; // 5分钟默认间隔

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  /**
   * 获取股票实时价格数据
   */
  abstract getStockPrices(symbols: string[]): Promise<StockData[]>;

  /**
   * 获取用户持仓数据
   */
  abstract getPortfolioHoldings(userId: string): Promise<PortfolioHolding[]>;

  /**
   * 验证服务连接状态
   */
  abstract validateConnection(): Promise<boolean>;

  /**
   * 执行数据同步
   */
  async syncData(userId: string, symbols: string[]): Promise<SyncResult> {
    const startTime = new Date();
    const errors: string[] = [];
    let updatedCount = 0;

    try {
      // 验证连接
      const isConnected = await this.validateConnection();
      if (!isConnected) {
        throw new Error(`${this.serviceName} 连接失败`);
      }

      // 获取股票价格数据
      const stockData = await this.getStockPrices(symbols);
      
      // 获取持仓数据
      const holdings = await this.getPortfolioHoldings(userId);

      // 更新数据库
      updatedCount = await this.updateDatabase(userId, stockData, holdings);

      this.lastSyncTime = new Date();

      return {
        success: true,
        updatedCount,
        errors,
        lastSyncTime: this.lastSyncTime,
        source: this.serviceName
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      errors.push(errorMessage);
      
      console.error(`[${this.serviceName}] 同步失败:`, error);

      return {
        success: false,
        updatedCount,
        errors,
        lastSyncTime: startTime,
        source: this.serviceName
      };
    }
  }

  /**
   * 更新数据库
   */
  protected async updateDatabase(
    userId: string, 
    stockData: StockData[], 
    holdings: PortfolioHolding[]
  ): Promise<number> {
    // 这里将在具体实现中连接数据库
    // 暂时返回模拟数据
    return stockData.length + holdings.length;
  }

  /**
   * 设置同步间隔
   */
  setSyncInterval(intervalMs: number): void {
    this.syncInterval = intervalMs;
  }

  /**
   * 启用/禁用服务
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      serviceName: this.serviceName,
      isEnabled: this.isEnabled,
      lastSyncTime: this.lastSyncTime,
      syncInterval: this.syncInterval
    };
  }

  /**
   * 格式化错误信息
   */
  protected formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * 重试机制
   */
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
      }
    }

    throw lastError!;
  }
}