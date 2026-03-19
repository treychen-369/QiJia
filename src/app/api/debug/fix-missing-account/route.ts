import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    return NextResponse.json({
      success: true,
      message: '此调试接口已禁用'
    });
  } catch (error) {
    console.error('Fix missing account error:', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
