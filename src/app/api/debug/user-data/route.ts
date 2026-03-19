import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    return NextResponse.json({
      success: true,
      message: '此调试接口已禁用',
      userId: session.user.id
    });
  } catch (error) {
    console.error('User data debug error:', error);
    return NextResponse.json({ error: '获取数据失败' }, { status: 500 });
  }
}
