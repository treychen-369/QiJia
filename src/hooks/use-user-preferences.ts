'use client'

import { useState, useEffect } from 'react'
import { getUserPreferences, type UserPreferences } from '@/lib/user-preferences'

/**
 * React Hook for user preferences
 * Automatically updates when preferences change
 */
export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(() => getUserPreferences())

  useEffect(() => {
    // 监听偏好设置变化
    const handlePreferencesChange = (event: CustomEvent<UserPreferences>) => {
      setPreferences(event.detail)
    }

    window.addEventListener('preferences-changed', handlePreferencesChange as EventListener)

    return () => {
      window.removeEventListener('preferences-changed', handlePreferencesChange as EventListener)
    }
  }, [])

  return preferences
}
