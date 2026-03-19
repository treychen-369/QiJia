'use client'

import { useState, useEffect } from 'react'
import { Settings } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  getUserPreferences,
  saveUserPreferences,
  getColorSchemeName,
  type ColorScheme,
} from '@/lib/user-preferences'

export function PreferencesDialog() {
  const [open, setOpen] = useState(false)
  const [colorScheme, setColorScheme] = useState<ColorScheme>('red-green')

  useEffect(() => {
    const prefs = getUserPreferences()
    setColorScheme(prefs.colorScheme)
  }, [open])

  const handleSave = () => {
    saveUserPreferences({ colorScheme })
    setOpen(false)
  }

  const handleReset = () => {
    setColorScheme('red-green')
    saveUserPreferences({ colorScheme: 'red-green' })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          偏好设置
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>偏好设置</DialogTitle>
          <DialogDescription>
            自定义您的使用体验
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 涨跌颜色设置 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">涨跌颜色方案</Label>
            <div className="space-y-2">
              <div
                onClick={() => setColorScheme('red-green')}
                className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  colorScheme === 'red-green'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex-1">
                  <div className="font-medium mb-1">涨红跌绿（默认）</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    中国大陆股市习惯
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-red-600 dark:text-red-400 font-semibold">
                      +5.23% ↑
                    </span>
                    <span className="text-green-600 dark:text-green-400 font-semibold">
                      -3.45% ↓
                    </span>
                  </div>
                </div>
                {colorScheme === 'red-green' && (
                  <div className="ml-4 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                )}
              </div>

              <div
                onClick={() => setColorScheme('green-red')}
                className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  colorScheme === 'green-red'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex-1">
                  <div className="font-medium mb-1">涨绿跌红</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    国际股市习惯（美股、港股）
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-green-600 dark:text-green-400 font-semibold">
                      +5.23% ↑
                    </span>
                    <span className="text-red-600 dark:text-red-400 font-semibold">
                      -3.45% ↓
                    </span>
                  </div>
                </div>
                {colorScheme === 'green-red' && (
                  <div className="ml-4 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleReset}>
            恢复默认
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
