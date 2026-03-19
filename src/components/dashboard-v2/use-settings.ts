'use client'

import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react'

// ─── Types ─────────────────────────────────────────────
export type ThemeMode = 'light' | 'dark' | 'blue-pro'
export type PnLColorScheme = 'red-green' | 'green-red'
export type CurrencyUnit = 'CNY' | 'USD' | 'HKD'
export type AmountFormat = 'compact' | 'full'
export type DefaultView = 'personal' | 'family'

export interface NotificationSources {
  maturityReminder: boolean    // 到期提醒（存款/国债/贷款到期）
  paymentReminder: boolean     // 还款提醒（信用卡/贷款还款日）
  largeChangeAlert: boolean    // 大额变动提醒
  aiSuggestion: boolean        // AI配置建议/风险提示
}

export interface SettingsData {
  theme: ThemeMode
  pnlColor: PnLColorScheme
  currency: CurrencyUnit
  amountFormat: AmountFormat
  defaultHidden: boolean
  defaultView: DefaultView
  exchangeSource: 'auto' | 'manual'
  refreshFreq: 'realtime' | 'daily' | 'weekly'
  reminderDays: 3 | 7 | 15
  largeChangeAlert: boolean
  largeChangeThreshold: number
  aiFrequency: 'weekly' | 'monthly' | 'manual'
  // 通知来源开关
  notificationSources: NotificationSources
}

export const defaultSettings: SettingsData = {
  theme: 'light',
  pnlColor: 'red-green',
  currency: 'CNY',
  amountFormat: 'compact',
  defaultHidden: false,
  defaultView: 'personal',
  exchangeSource: 'auto',
  refreshFreq: 'daily',
  reminderDays: 3,
  largeChangeAlert: true,
  largeChangeThreshold: 5,
  aiFrequency: 'weekly',
  notificationSources: {
    maturityReminder: true,
    paymentReminder: true,
    largeChangeAlert: true,
    aiSuggestion: true,
  },
}

// ─── localStorage ──────────────────────────────────────
const STORAGE_KEY = 'qijia-settings'

export function loadSettings(): SettingsData {
  if (typeof window === 'undefined') return defaultSettings
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw)
    return {
      ...defaultSettings,
      ...parsed,
      // 深度合并嵌套对象，确保新增字段有默认值
      notificationSources: {
        ...defaultSettings.notificationSources,
        ...(parsed.notificationSources || {}),
      },
    }
  } catch {
    return defaultSettings
  }
}

export function saveSettings(data: SettingsData) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* ignore quota errors */ }
}

// ─── Utility functions driven by settings ──────────────

/** Get PnL text color class based on color scheme setting */
export function getPnlTextColor(value: number, scheme: PnLColorScheme): string {
  if (value > 0) {
    return scheme === 'red-green' ? 'text-red-600' : 'text-emerald-600'
  } else if (value < 0) {
    return scheme === 'red-green' ? 'text-emerald-600' : 'text-red-500'
  }
  return 'text-muted-foreground'
}

/** Get PnL background color class */
export function getPnlBgColor(value: number, scheme: PnLColorScheme): string {
  if (value > 0) {
    return scheme === 'red-green'
      ? 'bg-red-50 text-red-700'
      : 'bg-emerald-50 text-emerald-700'
  } else if (value < 0) {
    return scheme === 'red-green'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-red-50 text-red-700'
  }
  return 'bg-muted text-muted-foreground'
}

/** Format amount based on settings (currency + compact/full) */
export function formatAmount(
  amount: number,
  format: AmountFormat,
  currency: CurrencyUnit = 'CNY',
): string {
  const symbol = currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : '¥'

  if (format === 'compact') {
    if (Math.abs(amount) >= 10000) {
      return `${symbol}${(amount / 10000).toFixed(amount >= 100000000 ? 0 : 1)}万`
    }
    return `${symbol}${amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
  }

  // full format
  return `${symbol}${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Context ───────────────────────────────────────────
export interface SettingsContextValue {
  settings: SettingsData
  loaded: boolean
  update: (patch: Partial<SettingsData>) => void
  /** Get PnL text color */
  pnlColor: (value: number) => string
  /** Get PnL bg color */
  pnlBg: (value: number) => string
  /** Is "positive" (up) direction */
  isPositive: (value: number) => boolean
  /** Format amount respecting currency & format settings */
  fmt: (amount: number, currencyOverride?: CurrencyUnit) => string
}

const SettingsCtx = createContext<SettingsContextValue>(null!)
export const useSettings = () => useContext(SettingsCtx)
export const SettingsContext = SettingsCtx
