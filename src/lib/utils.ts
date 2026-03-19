import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化货币显示
 */
export function formatCurrency(
  amount: number,
  currency: string = 'CNY',
  locale: string = 'zh-CN'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * 格式化百分比
 */
export function formatPercentage(
  value: number,
  decimals: number = 2
): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * 格式化数字（添加千分位分隔符）
 */
export function formatNumber(
  value: number,
  decimals: number = 2,
  locale: string = 'zh-CN'
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * 计算盈亏颜色类名
 */
export function getPnlColorClass(value: number): string {
  if (value > 0) return 'profit-positive'
  if (value < 0) return 'profit-negative'
  return 'profit-neutral'
}

/**
 * 格式化日期
 */
export function formatDate(
  date: Date | string,
  format: 'short' | 'medium' | 'long' = 'medium',
  locale: string = 'zh-CN'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  const optionsMap: Record<string, Intl.DateTimeFormatOptions> = {
    short: { year: 'numeric', month: 'numeric', day: 'numeric' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    }
  }
  
  const options = optionsMap[format]
  
  return new Intl.DateTimeFormat(locale, options).format(dateObj)
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * 生成随机ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15)
}

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T
  if (typeof obj === 'object') {
    const clonedObj = {} as { [key: string]: any }
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key])
      }
    }
    return clonedObj as T
  }
  return obj
}

/**
 * 检查是否为有效的数字
 */
export function isValidNumber(value: any): boolean {
  return typeof value === 'number' && !isNaN(value) && isFinite(value)
}

/**
 * 安全的数字转换
 */
export function safeNumber(value: any, defaultValue: number = 0): number {
  const num = Number(value)
  return isValidNumber(num) ? num : defaultValue
}

/**
 * 计算收益率
 */
export function calculateReturn(
  currentValue: number,
  originalValue: number
): number {
  if (originalValue === 0) return 0
  return (currentValue - originalValue) / originalValue
}

/**
 * 计算年化收益率
 */
export function calculateAnnualizedReturn(
  currentValue: number,
  originalValue: number,
  days: number
): number {
  if (originalValue === 0 || days === 0) return 0
  const totalReturn = currentValue / originalValue
  return Math.pow(totalReturn, 365 / days) - 1
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

/**
 * 检查是否为移动设备
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
}

/**
 * 复制到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}