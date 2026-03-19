/**
 * 统一日志服务
 * 
 * 功能：
 * - 可配置的日志等级（DEBUG, INFO, WARN, ERROR）
 * - 生产环境自动关闭敏感信息日志
 * - 支持环境变量配置
 * - 敏感信息脱敏处理
 * 
 * 环境变量：
 * - LOG_LEVEL: 日志等级 (debug, info, warn, error)，默认生产环境为 'warn'，开发环境为 'debug'
 * - LOG_ENABLED: 是否启用日志 ('true' / 'false')，默认 'true'
 * - LOG_SENSITIVE: 是否记录敏感信息 ('true' / 'false')，默认 'false'
 */

// 日志等级枚举
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,  // 完全禁用日志
}

// 日志等级名称映射
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.NONE]: 'NONE',
};

// 日志等级颜色（用于开发环境控制台）
const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: '\x1b[36m',  // Cyan
  [LogLevel.INFO]: '\x1b[32m',   // Green
  [LogLevel.WARN]: '\x1b[33m',   // Yellow
  [LogLevel.ERROR]: '\x1b[31m',  // Red
  [LogLevel.NONE]: '',
};

const RESET_COLOR = '\x1b[0m';

// 敏感字段列表
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn',
  'socialSecurityNumber',
];

// 需要脱敏的字段（部分显示）
const MASK_FIELDS = [
  'email',
  'phone',
  'mobile',
  'userId',
  'accountNumber',
  'bankAccount',
];

// 金额相关字段（在非敏感模式下会被模糊处理）
const AMOUNT_FIELDS = [
  'amount',
  'balance',
  'value',
  'price',
  'cost',
  'total',
  'marketValue',
  'currentValue',
  'purchasePrice',
  'unrealizedPnl',
  'pnl',
];

/**
 * 日志配置
 */
interface LoggerConfig {
  level: LogLevel;
  enabled: boolean;
  showSensitive: boolean;
  showTimestamp: boolean;
  showModule: boolean;
}

/**
 * 获取当前环境
 */
function getEnvironment(): 'development' | 'production' | 'test' {
  return (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development';
}

/**
 * 解析日志等级
 */
function parseLogLevel(level: string | undefined): LogLevel {
  if (!level) return getEnvironment() === 'production' ? LogLevel.WARN : LogLevel.DEBUG;
  
  switch (level.toLowerCase()) {
    case 'debug': return LogLevel.DEBUG;
    case 'info': return LogLevel.INFO;
    case 'warn': return LogLevel.WARN;
    case 'error': return LogLevel.ERROR;
    case 'none': return LogLevel.NONE;
    default: return LogLevel.INFO;
  }
}

/**
 * 获取日志配置
 */
function getConfig(): LoggerConfig {
  const env = getEnvironment();
  const isProduction = env === 'production';
  
  return {
    level: parseLogLevel(process.env.LOG_LEVEL),
    enabled: process.env.LOG_ENABLED !== 'false',
    showSensitive: process.env.LOG_SENSITIVE === 'true' && !isProduction,
    showTimestamp: true,
    showModule: true,
  };
}

/**
 * 脱敏处理邮箱
 * example@domain.com -> ex***@domain.com
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***@***';
  const maskedLocal = local.length > 2 
    ? local.substring(0, 2) + '***' 
    : '***';
  return `${maskedLocal}@${domain}`;
}

/**
 * 脱敏处理字符串
 * 保留前后各2个字符
 */
function maskString(str: string): string {
  if (str.length <= 4) return '****';
  return str.substring(0, 2) + '****' + str.substring(str.length - 2);
}

/**
 * 脱敏处理金额（模糊化）
 * 12345.67 -> ~12k
 */
function maskAmount(amount: number): string {
  if (amount === 0) return '0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  
  if (abs >= 1000000) return `${sign}~${Math.round(abs / 1000000)}M`;
  if (abs >= 1000) return `${sign}~${Math.round(abs / 1000)}k`;
  return `${sign}~${Math.round(abs)}`;
}

/**
 * 对对象进行脱敏处理
 */
function sanitizeData(data: unknown, showSensitive: boolean): unknown {
  if (data === null || data === undefined) return data;
  
  // 处理基本类型
  if (typeof data !== 'object') return data;
  
  // 处理数组
  if (Array.isArray(data)) {
    // 如果数组太长，只显示长度
    if (data.length > 10 && !showSensitive) {
      return `[Array(${data.length})]`;
    }
    return data.map(item => sanitizeData(item, showSensitive));
  }
  
  // 处理对象
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    
    // 完全隐藏敏感字段
    if (SENSITIVE_FIELDS.some(f => lowerKey.includes(f.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    
    // 如果不显示敏感信息，进行脱敏处理
    if (!showSensitive) {
      // 脱敏处理邮箱
      if (lowerKey.includes('email') && typeof value === 'string') {
        sanitized[key] = maskEmail(value);
        continue;
      }
      
      // 脱敏处理需要遮盖的字段
      if (MASK_FIELDS.some(f => lowerKey.includes(f.toLowerCase())) && typeof value === 'string') {
        sanitized[key] = maskString(value);
        continue;
      }
      
      // 模糊处理金额
      if (AMOUNT_FIELDS.some(f => lowerKey.includes(f.toLowerCase())) && typeof value === 'number') {
        sanitized[key] = maskAmount(value);
        continue;
      }
    }
    
    // 递归处理嵌套对象
    sanitized[key] = sanitizeData(value, showSensitive);
  }
  
  return sanitized;
}

/**
 * 格式化日志消息
 */
function formatMessage(
  level: LogLevel,
  module: string,
  message: string,
  data: unknown,
  config: LoggerConfig
): string {
  const parts: string[] = [];
  
  // 时间戳
  if (config.showTimestamp) {
    parts.push(new Date().toISOString());
  }
  
  // 日志等级
  const levelName = LOG_LEVEL_NAMES[level];
  parts.push(`[${levelName}]`);
  
  // 模块名
  if (config.showModule && module) {
    parts.push(`[${module}]`);
  }
  
  // 消息
  parts.push(message);
  
  // 数据
  if (data !== undefined) {
    const sanitizedData = sanitizeData(data, config.showSensitive);
    parts.push(JSON.stringify(sanitizedData, null, 2));
  }
  
  return parts.join(' ');
}

/**
 * Logger 类
 */
class Logger {
  private module: string;
  private config: LoggerConfig;
  
  constructor(module: string = '') {
    this.module = module;
    this.config = getConfig();
  }
  
  /**
   * 刷新配置（用于环境变量更新后）
   */
  refreshConfig(): void {
    this.config = getConfig();
  }
  
  /**
   * 检查是否应该记录该等级的日志
   */
  private shouldLog(level: LogLevel): boolean {
    return this.config.enabled && level >= this.config.level;
  }
  
  /**
   * 输出日志
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;
    
    const formattedMessage = formatMessage(level, this.module, message, data, this.config);
    const color = LOG_LEVEL_COLORS[level];
    
    // 在开发环境使用颜色
    const isServer = typeof window === 'undefined';
    const useColor = isServer && getEnvironment() === 'development';
    
    const output = useColor ? `${color}${formattedMessage}${RESET_COLOR}` : formattedMessage;
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(output);
        break;
      case LogLevel.INFO:
        console.info(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.ERROR:
        console.error(output);
        break;
    }
  }
  
  /**
   * DEBUG 级别日志
   * 用于开发调试，生产环境不输出
   */
  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }
  
  /**
   * INFO 级别日志
   * 用于一般信息记录
   */
  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }
  
  /**
   * WARN 级别日志
   * 用于警告信息
   */
  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }
  
  /**
   * ERROR 级别日志
   * 用于错误信息
   */
  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }
  
  /**
   * 创建子模块 Logger
   */
  child(subModule: string): Logger {
    const childModule = this.module ? `${this.module}:${subModule}` : subModule;
    return new Logger(childModule);
  }
}

// 创建默认 Logger 实例
const defaultLogger = new Logger();

// 导出便捷函数
export const debug = (message: string, data?: unknown) => defaultLogger.debug(message, data);
export const info = (message: string, data?: unknown) => defaultLogger.info(message, data);
export const warn = (message: string, data?: unknown) => defaultLogger.warn(message, data);
export const error = (message: string, data?: unknown) => defaultLogger.error(message, data);

// 创建模块级 Logger 的工厂函数
export function createLogger(module: string): Logger {
  return new Logger(module);
}

// 导出 Logger 类供高级用法
export { Logger };

// 默认导出
export default defaultLogger;
