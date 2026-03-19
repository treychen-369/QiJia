/**
 * 用户偏好设置管理
 */

export type ColorScheme = 'red-green' | 'green-red'

export interface UserPreferences {
  colorScheme: ColorScheme // 'red-green' = 涨红跌绿, 'green-red' = 涨绿跌红
}

const PREFERENCES_KEY = 'finance-app-preferences'

const DEFAULT_PREFERENCES: UserPreferences = {
  colorScheme: 'red-green' // 默认涨红跌绿
}

/**
 * 获取用户偏好设置
 */
export function getUserPreferences(): UserPreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_PREFERENCES
  }

  try {
    const stored = localStorage.getItem(PREFERENCES_KEY)
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) }
    }
  } catch (error) {
    console.error('Failed to load user preferences:', error)
  }

  return DEFAULT_PREFERENCES
}

/**
 * 保存用户偏好设置
 */
export function saveUserPreferences(preferences: Partial<UserPreferences>): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const current = getUserPreferences()
    const updated = { ...current, ...preferences }
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated))
    
    // 触发自定义事件，通知其他组件更新
    window.dispatchEvent(new CustomEvent('preferences-changed', { detail: updated }))
  } catch (error) {
    console.error('Failed to save user preferences:', error)
  }
}

/**
 * 根据用户偏好获取涨跌颜色类名
 */
export function getPnLColorClass(value: number, colorScheme?: ColorScheme): string {
  const scheme = colorScheme || getUserPreferences().colorScheme
  
  if (value > 0) {
    return scheme === 'red-green' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
  } else if (value < 0) {
    return scheme === 'red-green' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
  }
  
  return 'text-slate-600 dark:text-slate-400'
}

/**
 * 获取深色背景上的盈亏颜色类名（用于Hero卡片等深色背景）
 * 使用柔和的颜色，避免刺眼
 */
export function getPnLColorClassOnDark(value: number, colorScheme?: ColorScheme): string {
  const scheme = colorScheme || getUserPreferences().colorScheme
  
  if (value > 0) {
    // 涨：柔和的绿色或暖白色
    return scheme === 'red-green' ? 'text-orange-200' : 'text-emerald-300'
  } else if (value < 0) {
    // 跌：柔和的蓝绿色或红色
    return scheme === 'red-green' ? 'text-cyan-300' : 'text-rose-300'
  }
  
  return 'text-white/60'
}

/**
 * 根据用户偏好获取涨跌背景色类名
 */
export function getPnLBgColorClass(value: number, colorScheme?: ColorScheme): string {
  const scheme = colorScheme || getUserPreferences().colorScheme
  
  if (value > 0) {
    return scheme === 'red-green' 
      ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300' 
      : 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
  } else if (value < 0) {
    return scheme === 'red-green' 
      ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
      : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
  }
  
  return 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
}

/**
 * 获取颜色方案的显示名称
 */
export function getColorSchemeName(scheme: ColorScheme): string {
  return scheme === 'red-green' ? '涨红跌绿' : '涨绿跌红'
}
