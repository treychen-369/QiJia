'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

export default function InviteAcceptPage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    familyName?: string;
  } | null>(null);

  const handleAccept = async () => {
    if (!session?.user?.id) {
      router.push(`/auth/signin?callbackUrl=/auth/invite/${token}`);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/family/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'accept' }),
      });
      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.message || '已成功加入家庭',
          familyName: data.family?.name,
        });
        await updateSession(); // 刷新 session 以获取新的 familyId
      } else {
        setResult({
          success: false,
          message: data.error || '接受邀请失败',
        });
      }
    } catch {
      setResult({ success: false, message: '网络错误，请稍后重试' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/family/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'reject' }),
      });
      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, message: '已拒绝邀请' });
      } else {
        setResult({ success: false, message: data.error || '操作失败' });
      }
    } catch {
      setResult({ success: false, message: '网络错误' });
    } finally {
      setIsLoading(false);
    }
  };

  // 如果已有结果
  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-0 shadow-xl">
          <CardContent className="pt-8 text-center space-y-4">
            {result.success ? (
              <>
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {result.message}
                </h2>
                {result.familyName && (
                  <p className="text-slate-600 dark:text-slate-400">
                    家庭：{result.familyName}
                  </p>
                )}
                <Button
                  onClick={() => router.push('/dashboard-v2')}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                >
                  前往仪表盘
                </Button>
              </>
            ) : (
              <>
                <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  操作失败
                </h2>
                <p className="text-slate-600 dark:text-slate-400">{result.message}</p>
                <Button variant="outline" onClick={() => router.push('/dashboard-v2')}>
                  返回首页
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // 未登录
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-0 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl w-fit mb-4">
              <Users className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-xl">家庭邀请</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              你收到了一个家庭邀请，请先登录以接受邀请
            </p>
            <div className="space-y-2">
              <Button
                onClick={() => router.push(`/auth/signin?callbackUrl=/auth/invite/${token}`)}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              >
                登录
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/auth/signup?callbackUrl=/auth/invite/${token}`)}
                className="w-full"
              >
                注册新账号
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 已登录 - 显示接受/拒绝操作
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-0 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl w-fit mb-4">
            <Users className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-xl">家庭邀请</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            你好 <span className="font-medium text-slate-800 dark:text-slate-200">{session?.user?.name}</span>，
            你收到了一个加入家庭的邀请
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={handleAccept}
              disabled={isLoading}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            >
              {isLoading ? '处理中...' : '接受邀请'}
            </Button>
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={isLoading}
            >
              拒绝
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
