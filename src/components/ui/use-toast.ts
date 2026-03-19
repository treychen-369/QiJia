import hotToast from 'react-hot-toast'

interface ToastOptions {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

// 直接导出的 toast 函数
export function toast({ title, description, variant }: ToastOptions) {
  const message = description ? `${title}\n${description}` : title

  if (variant === 'destructive') {
    return hotToast.error(message)
  }

  return hotToast.success(message)
}

// Hook 形式（向后兼容）
export function useToast() {
  return { toast }
}
