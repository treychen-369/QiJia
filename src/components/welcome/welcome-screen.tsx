'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { motion } from 'framer-motion'
import { 
  TrendingUp, 
  PieChart, 
  BarChart3, 
  Shield, 
  Smartphone, 
  Zap,
  Github,
  Mail,
  ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const features = [
  {
    icon: PieChart,
    title: '智能资产配置',
    description: '基于现代投资组合理论，自动分析资产配置比例，提供专业的调仓建议'
  },
  {
    icon: TrendingUp,
    title: '实时数据同步',
    description: '对接多个券商平台，自动同步持仓数据，告别手动更新的繁琐'
  },
  {
    icon: BarChart3,
    title: '可视化分析',
    description: '丰富的图表展示，直观了解投资收益、资产趋势和风险分布'
  },
  {
    icon: Shield,
    title: '数据安全保护',
    description: '银行级数据加密，本地部署，确保您的财务隐私绝对安全'
  },
  {
    icon: Smartphone,
    title: '多端同步',
    description: '支持网页端和微信小程序，随时随地查看投资组合状态'
  },
  {
    icon: Zap,
    title: '智能提醒',
    description: '基于市场估值和个人策略，及时提醒调仓时机和投资机会'
  }
]

export function WelcomeScreen() {
  const [isLoading, setIsLoading] = useState<string | null>(null)

  const handleSignIn = async (provider: string) => {
    setIsLoading(provider)
    try {
      await signIn(provider, { callbackUrl: '/dashboard-v2' })
    } catch (error) {
      console.error('Sign in error:', error)
    } finally {
      setIsLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="container mx-auto px-4 py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-flex items-center justify-center w-20 h-20 bg-primary-600 rounded-2xl mb-6"
              >
                <TrendingUp className="w-10 h-10 text-white" />
              </motion.div>
              <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 dark:text-white mb-6">
                QiJia{' '}
                <span className="bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
                  齐家
                </span>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
                专业的家庭财务管理系统，让投资决策更智能，资产配置更科学
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Button
                size="lg"
                onClick={() => handleSignIn('google')}
                disabled={isLoading === 'google'}
                className="bg-white text-gray-900 hover:bg-gray-50 border border-gray-300 px-8 py-3 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {isLoading === 'google' ? (
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Mail className="w-5 h-5 mr-2" />
                )}
                使用 Google 登录
              </Button>
              
              <Button
                size="lg"
                variant="outline"
                onClick={() => handleSignIn('github')}
                disabled={isLoading === 'github'}
                className="px-8 py-3 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {isLoading === 'github' ? (
                  <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Github className="w-5 h-5 mr-2" />
                )}
                使用 GitHub 登录
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="text-sm text-gray-500 dark:text-gray-400 mt-6"
            >
              登录即表示您同意我们的服务条款和隐私政策
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              为什么选择我们的系统？
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              基于现代投资理论和最佳实践，为您提供专业级的财务管理体验
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <Card className="h-full hover:shadow-lg transition-all duration-300 border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                  <CardHeader>
                    <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-gray-600 dark:text-gray-300 leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <Card className="max-w-4xl mx-auto border-0 bg-gradient-to-r from-primary-600 to-primary-800 text-white shadow-2xl">
              <CardContent className="p-12">
                <h3 className="text-3xl sm:text-4xl font-bold mb-6">
                  开始您的智能理财之旅
                </h3>
                <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
                  从Excel表格到专业系统，让数据驱动您的投资决策
                </p>
                <Button
                  size="lg"
                  onClick={() => handleSignIn('google')}
                  disabled={!!isLoading}
                  className="bg-white text-primary-600 hover:bg-gray-50 px-8 py-3 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  立即开始
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-600 dark:text-gray-400">
            <p>&copy; 2025 QiJia. 专为家庭财务管理而设计.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}