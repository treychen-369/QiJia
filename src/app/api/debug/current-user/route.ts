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
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      }
    });
  } catch (error) {
    console.error('Debug current-user error:', error);
    return NextResponse.json({ error: '获取用户信息失败' }, { status: 500 });
  }
}
