import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WelcomeScreen } from '@/components/welcome/welcome-screen'

export const metadata: Metadata = {
  title: '首页',
  description: 'Trey家庭财务管理系统首页',
}

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  // 如果用户已登录，重定向到仪表板
  if (session) {
    redirect('/dashboard-v2')
  }

  // 未登录用户显示欢迎页面
  return <WelcomeScreen />
}