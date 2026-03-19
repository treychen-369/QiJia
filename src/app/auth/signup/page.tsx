'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Chrome, 
  Github,
  AlertCircle,
  CheckCircle,
  Loader2,
  Shield
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function SignUpPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.name.trim()) {
      newErrors.name = '请输入姓名';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = '姓名至少2个字符';
    }
    
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
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '请确认密码';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次密码输入不一致';
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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email,
          password: formData.password,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '注册失败');
      }
      
      toast.success('注册成功！正在登录...');
      
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });
      
      if (result?.ok) {
        router.push('/dashboard-v2');
      } else {
        toast.error('自动登录失败，请手动登录');
        router.push('/auth/signin');
      }
    } catch (error: any) {
      toast.error(error.message || '注册失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    setIsLoading(true);
    try {
      await signIn(provider, { callbackUrl: '/dashboard-v2' });
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

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
  const strengthLabels = ['很弱', '弱', '一般', '强', '很强'];

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
            创建您的财务管理账户
          </p>
        </div>

        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-0 shadow-2xl">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-center text-slate-800 dark:text-slate-200">
              创建账户
            </CardTitle>
            <p className="text-center text-slate-600 dark:text-slate-400">
              填写基本信息开始使用
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
              <>
                {/* OAuth注册按钮 */}
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full h-12 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
                    onClick={() => handleOAuthSignIn('google')}
                    disabled={isLoading}
                  >
                    <Chrome className="w-5 h-5 mr-3 text-red-500" />
                    使用 Google 注册
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full h-12 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
                    onClick={() => handleOAuthSignIn('github')}
                    disabled={isLoading}
                  >
                    <Github className="w-5 h-5 mr-3" />
                    使用 GitHub 注册
                  </Button>
                </div>

                {/* 分割线 */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-slate-900 px-2 text-slate-500 dark:text-slate-400">
                      或使用邮箱注册
                    </span>
                  </div>
                </div>

                {/* 注册表单 */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">
                      姓名
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="请输入您的姓名"
                        value={formData.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('name', e.target.value)}
                        className={`pl-10 h-12 ${errors.name ? 'border-red-500 focus:border-red-500' : ''}`}
                        disabled={isLoading}
                      />
                    </div>
                    {errors.name && (
                      <div className="flex items-center gap-1 text-red-500 text-sm">
                        <AlertCircle className="h-3 w-3" />
                        {errors.name}
                      </div>
                    )}
                  </div>

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
                    
                    {/* 密码强度指示器 */}
                    {formData.password && (
                      <div className="space-y-1">
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full ${
                                i < passwordStrength ? strengthColors[passwordStrength - 1] : 'bg-slate-200 dark:bg-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          密码强度: {passwordStrength > 0 ? strengthLabels[passwordStrength - 1] : '请输入密码'}
                        </p>
                      </div>
                    )}
                    
                    {errors.password && (
                      <div className="flex items-center gap-1 text-red-500 text-sm">
                        <AlertCircle className="h-3 w-3" />
                        {errors.password}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-slate-700 dark:text-slate-300">
                      确认密码
                    </Label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="请再次输入密码"
                        value={formData.confirmPassword}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('confirmPassword', e.target.value)}
                        className={`pl-10 pr-10 h-12 ${errors.confirmPassword ? 'border-red-500 focus:border-red-500' : ''}`}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <div className="flex items-center gap-1 text-red-500 text-sm">
                        <AlertCircle className="h-3 w-3" />
                        {errors.confirmPassword}
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    {isLoading ? '创建中...' : '完成注册'}
                  </Button>
                </form>
              </>

            {/* 登录链接 */}
            <div className="text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                已有账户？{' '}
                <Link
                  href="/auth/signin"
                  className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  立即登录
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}