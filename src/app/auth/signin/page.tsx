'use client';

import { useState, useEffect } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Chrome, 
  Github,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard-v2';
  const error = searchParams?.get('error');

  useEffect(() => {
    // 检查是否已登录
    getSession().then((session) => {
      if (session) {
        router.push(callbackUrl);
      }
    });
  }, [router, callbackUrl]);

  useEffect(() => {
    // 处理OAuth错误
    if (error) {
      const errorMessages: {[key: string]: string} = {
        'OAuthSignin': 'OAuth登录出错',
        'OAuthCallback': 'OAuth回调出错',
        'OAuthCreateAccount': '创建OAuth账户出错',
        'EmailCreateAccount': '创建邮箱账户出错',
        'Callback': '回调出错',
        'OAuthAccountNotLinked': '该邮箱已使用其他方式注册，请使用原方式登录',
        'EmailSignin': '邮箱登录出错',
        'CredentialsSignin': '邮箱或密码错误',
        'SessionRequired': '需要登录',
        'default': '登录出错，请重试'
      };
      
      const message = errorMessages[error || 'default'] || errorMessages.default || '登录出错，请重试';
      toast.error(message);
    }
  }, [error]);

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.email) {
      newErrors.email = '请输入邮箱地址';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }
    
    if (!formData.password) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 6) {
      newErrors.password = '密码至少6位';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });
      
      if (result?.error) {
        toast.error(result.error);
      } else if (result?.ok) {
        toast.success('登录成功！');
        router.push(callbackUrl);
      }
    } catch (error) {
      toast.error('登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    setIsLoading(true);
    try {
      await signIn(provider, { callbackUrl });
    } catch (error) {
      toast.error('登录失败，请重试');
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo和标题 */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"
          >
            <span className="text-2xl font-bold text-white">Q</span>
          </motion.div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            QiJia
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            登录您的财务管理系统
          </p>
        </div>

        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-0 shadow-2xl">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-center text-slate-800 dark:text-slate-200">
              欢迎回来
            </CardTitle>
            <p className="text-center text-slate-600 dark:text-slate-400">
              选择登录方式继续使用
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* OAuth登录按钮 - 暂时注释掉，避免配置问题 */}
            {/* 
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-12 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
                onClick={() => handleOAuthSignIn('google')}
                disabled={isLoading}
              >
                <Chrome className="w-5 h-5 mr-3 text-red-500" />
                使用 Google 登录
              </Button>
              
              <Button
                variant="outline"
                className="w-full h-12 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
                onClick={() => handleOAuthSignIn('github')}
                disabled={isLoading}
              >
                <Github className="w-5 h-5 mr-3" />
                使用 GitHub 登录
              </Button>
            </div>
            */}

            {/* 分割线 - 暂时注释掉 */}
            {/*
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-900 px-2 text-slate-500 dark:text-slate-400">
                  或使用邮箱登录
                </span>
              </div>
            </div>
            */}

            {/* 邮箱登录表单 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">
                  邮箱地址
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your-email@example.com"
                    value={formData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('email', e.target.value)}
                    className={`pl-10 h-12 ${errors.email ? 'border-red-500 focus:border-red-500' : ''}`}
                    disabled={isLoading}
                  />
                </div>
                {errors.email && (
                  <div className="flex items-center gap-1 text-red-500 text-sm">
                    <AlertCircle className="h-3 w-3" />
                    {errors.email}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">
                  密码
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    value={formData.password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('password', e.target.value)}
                    className={`pl-10 pr-10 h-12 ${errors.password ? 'border-red-500 focus:border-red-500' : ''}`}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <div className="flex items-center gap-1 text-red-500 text-sm">
                    <AlertCircle className="h-3 w-3" />
                    {errors.password}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  忘记密码？
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                {isLoading ? '登录中...' : '登录'}
              </Button>
            </form>

            {/* 注册链接 */}
            <div className="text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                还没有账户？{' '}
                <Link
                  href="/auth/signup"
                  className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  立即注册
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 功能特性 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-center"
        >
          <div className="grid grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex flex-col items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>安全可靠</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>多人共享</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>实时同步</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}