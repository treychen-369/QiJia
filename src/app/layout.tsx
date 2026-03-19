import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { QueryProvider } from '@/components/providers/query-provider'
import { AuthProvider } from '@/components/providers/auth-provider'
import { Toaster } from '@/components/ui/toaster'

// 使用系统字体栈，避免构建时从 Google Fonts 下载字体（国内服务器可能无法访问）

export const metadata: Metadata = {
  title: {
    default: 'QiJia - 齐家',
    template: '%s | QiJia',
  },
  description: '专业的家庭财务管理系统，支持多账户投资组合管理、自动数据同步、智能分析建议',
  keywords: ['财务管理', '投资组合', '股票', 'ETF', '资产配置', '家庭理财', 'QiJia', '齐家'],
  authors: [{ name: 'QiJia Contributors' }],
  creator: 'QiJia Contributors',
  publisher: 'QiJia Contributors',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // 使用生产环境 URL 作为 metadataBase
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: '/',
    title: 'QiJia - 齐家',
    description: '专业的家庭财务管理系统',
    siteName: 'QiJia',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QiJia - 齐家',
    description: '专业的家庭财务管理系统',
  },
  robots: {
    index: false, // 个人系统，不需要被搜索引擎索引
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          themes={['light', 'dark', 'blue-pro']}
          disableTransitionOnChange
        >
          <AuthProvider>
            <QueryProvider>
              <div className="relative flex min-h-screen flex-col">
                <div className="flex-1">
                  {children}
                </div>
              </div>
              <Toaster />
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}