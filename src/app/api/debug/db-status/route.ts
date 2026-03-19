import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 简单的数据库连接测试
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json({
      success: true,
      status: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database status check error:', error);
    return NextResponse.json({
      success: false,
      status: 'disconnected',
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}
