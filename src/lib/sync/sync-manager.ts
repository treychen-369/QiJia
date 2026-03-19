/**
 * 数据同步管理器
 * 统一管理多个数据源的同步服务
 */

import { BaseSyncService, SyncResult, StockData, PortfolioHolding } from './base-sync-service';
import { TonghuashunSyncService } from './tonghuashun-sync';
import { EastmoneySyncService } from './eastmoney-sync';
import { XueqiuSyncService } from './xueqiu-sync';

export type SyncServiceType = 'tonghuashun' | 'eastmoney' | 'xueqiu';

export interface SyncConfig {
  enabledServices: SyncServiceType[];
  syncInterval: number; // 同步间隔（毫秒）
  maxRetries: number;
  timeout: number;
  fallbackOrder: SyncServiceType[]; // 失败时的备用服务顺序
}

export interface AggregatedSyncResult {
  success: boolean;
  totalUpdated: number;
  serviceResults: Map<SyncServiceType, SyncResult>;
  errors: string[];
  duration: number;
  timestamp: Date;
}

export interface SyncSchedule {
  userId: string;
  symbols: string[];
  config: SyncConfig;
  nextSyncTime: Date;
  isActive: boolean;
}

export class SyncManager {
  private services: Map<SyncServiceType, BaseSyncService>;
  private schedules: Map<string, SyncSchedule>;
  private syncTimers: Map<string, NodeJS.Timeout>;
  private isRunning: boolean = false;

  constructor() {
    this.services = new Map();
    this.schedules = new Map();
    this.syncTimers = new Map();
    
    this.initializeServices();
  }

  /**
   * 初始化所有同步服务
   */
  private initializeServices(): void {
    this.services.set('tonghuashun', new TonghuashunSyncService());
    this.services.set('eastmoney', new EastmoneySyncService());
    this.services.set('xueqiu', new XueqiuSyncService());
  }

  /**
   * 获取指定类型的同步服务
   */
  getService(type: SyncServiceType): BaseSyncService | undefined {
    return this.services.get(type);
  }

  /**
   * 获取所有可用的同步服务
   */
  getAllServices(): Map<SyncServiceType, BaseSyncService> {
    return new Map(this.services);
  }

  /**
   * 执行单次数据同步
   */
  async syncOnce(
    userId: string, 
    symbols: string[], 
    config: Partial<SyncConfig> = {}
  ): Promise<AggregatedSyncResult> {
    const startTime = Date.now();
    const timestamp = new Date();
    
    const fullConfig: SyncConfig = {
      enabledServices: ['eastmoney', 'tonghuashun', 'xueqiu'],
      syncInterval: 5 * 60 * 1000,
      maxRetries: 3,
      timeout: 10000,
      fallbackOrder: ['eastmoney', 'tonghuashun', 'xueqiu'],
      ...config
    };

    const serviceResults = new Map<SyncServiceType, SyncResult>();
    const errors: string[] = [];
    let totalUpdated = 0;
    let hasSuccess = false;

    // 并行执行所有启用的服务
    const syncPromises = fullConfig.enabledServices.map(async (serviceType) => {
      const service = this.services.get(serviceType);
      if (!service) {
        const error = `服务 ${serviceType} 未找到`;
        errors.push(error);
        return;
      }

      try {
        const result = await service.syncData(userId, symbols);
        serviceResults.set(serviceType, result);
        
        if (result.success) {
          hasSuccess = true;
          totalUpdated += result.updatedCount;
        } else {
          errors.push(...result.errors);
        }
      } catch (error) {
        const errorMessage = `${serviceType} 同步失败: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMessage);
        
        serviceResults.set(serviceType, {
          success: false,
          updatedCount: 0,
          errors: [errorMessage],
          lastSyncTime: timestamp,
          source: serviceType
        });
      }
    });

    await Promise.allSettled(syncPromises);

    // 如果所有服务都失败，尝试备用服务
    if (!hasSuccess && fullConfig.fallbackOrder.length > 0) {
      for (const fallbackService of fullConfig.fallbackOrder) {
        if (fullConfig.enabledServices.includes(fallbackService)) {
          continue; // 已经尝试过了
        }

        const service = this.services.get(fallbackService);
        if (service) {
          try {
            const result = await service.syncData(userId, symbols);
            serviceResults.set(fallbackService, result);
            
            if (result.success) {
              hasSuccess = true;
              totalUpdated += result.updatedCount;
              break;
            }
          } catch (error) {
            // 备用服务失败不记录错误，避免过多错误信息
          }
        }
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: hasSuccess,
      totalUpdated,
      serviceResults,
      errors,
      duration,
      timestamp
    };
  }

  /**
   * 设置定时同步
   */
  async scheduleSync(
    userId: string,
    symbols: string[],
    config: SyncConfig
  ): Promise<void> {
    // 停止现有的定时任务
    this.stopScheduledSync(userId);

    const schedule: SyncSchedule = {
      userId,
      symbols,
      config,
      nextSyncTime: new Date(Date.now() + config.syncInterval),
      isActive: true
    };

    this.schedules.set(userId, schedule);

    // 设置定时器
    const timer = setInterval(async () => {
      if (schedule.isActive) {
        try {
          await this.syncOnce(userId, symbols, config);
          schedule.nextSyncTime = new Date(Date.now() + config.syncInterval);
        } catch (error) {
          console.error(`用户 ${userId} 定时同步失败:`, error);
        }
      }
    }, config.syncInterval);

    this.syncTimers.set(userId, timer);
  }

  /**
   * 停止定时同步
   */
  stopScheduledSync(userId: string): void {
    const timer = this.syncTimers.get(userId);
    if (timer) {
      clearInterval(timer);
      this.syncTimers.delete(userId);
    }

    const schedule = this.schedules.get(userId);
    if (schedule) {
      schedule.isActive = false;
    }
  }

  /**
   * 获取用户的同步计划
   */
  getSchedule(userId: string): SyncSchedule | undefined {
    return this.schedules.get(userId);
  }

  /**
   * 获取所有活跃的同步计划
   */
  getActiveSchedules(): SyncSchedule[] {
    return Array.from(this.schedules.values()).filter(schedule => schedule.isActive);
  }

  /**
   * 验证所有服务的连接状态
   */
  async validateAllConnections(): Promise<Map<SyncServiceType, boolean>> {
    const results = new Map<SyncServiceType, boolean>();
    
    const validationPromises = Array.from(this.services.entries()).map(async ([type, service]) => {
      try {
        const isConnected = await service.validateConnection();
        results.set(type, isConnected);
      } catch (error) {
        results.set(type, false);
      }
    });

    await Promise.allSettled(validationPromises);
    return results;
  }

  /**
   * 获取服务状态统计
   */
  getServicesStatus(): Array<{
    type: SyncServiceType;
    name: string;
    isEnabled: boolean;
    lastSyncTime?: Date;
    status: 'connected' | 'disconnected' | 'unknown';
  }> {
    return Array.from(this.services.entries()).map(([type, service]) => ({
      type,
      name: service.getStatus().serviceName,
      isEnabled: service.getStatus().isEnabled,
      lastSyncTime: service.getStatus().lastSyncTime,
      status: 'unknown' as const // 需要调用 validateConnection 来获取实际状态
    }));
  }

  /**
   * 批量获取股票数据（智能选择最佳数据源）
   */
  async getStockPrices(symbols: string[]): Promise<{
    data: StockData[];
    source: SyncServiceType;
    errors: string[];
  }> {
    const preferredOrder: SyncServiceType[] = ['eastmoney', 'tonghuashun', 'xueqiu'];
    
    for (const serviceType of preferredOrder) {
      const service = this.services.get(serviceType);
      if (!service) continue;

      try {
        const data = await service.getStockPrices(symbols);
        return {
          data,
          source: serviceType,
          errors: []
        };
      } catch (error) {
        console.warn(`${serviceType} 获取股票数据失败:`, error);
        continue;
      }
    }

    return {
      data: [],
      source: 'eastmoney',
      errors: ['所有数据源都无法获取股票数据']
    };
  }

  /**
   * 启动同步管理器
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('数据同步管理器已启动');
  }

  /**
   * 停止同步管理器
   */
  stop(): void {
    if (!this.isRunning) return;

    // 停止所有定时任务
    for (const userId of Array.from(this.syncTimers.keys())) {
      this.stopScheduledSync(userId);
    }

    this.isRunning = false;
    console.log('数据同步管理器已停止');
  }

  /**
   * 获取同步统计信息
   */
  getStats(): {
    totalSchedules: number;
    activeSchedules: number;
    totalServices: number;
    enabledServices: number;
    isRunning: boolean;
  } {
    const activeSchedules = this.getActiveSchedules();
    const enabledServices = Array.from(this.services.values())
      .filter(service => service.getStatus().isEnabled).length;

    return {
      totalSchedules: this.schedules.size,
      activeSchedules: activeSchedules.length,
      totalServices: this.services.size,
      enabledServices,
      isRunning: this.isRunning
    };
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.stop();
    this.schedules.clear();
    this.syncTimers.clear();
  }
}

// 全局同步管理器实例
export const syncManager = new SyncManager();