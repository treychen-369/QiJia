/**
 * 本月资产变动 API
 * 
 * GET /api/portfolio/monthly-changes
 * - 返回本月净资产变化、各分类变动、重要操作事件
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SnapshotService } from '@/lib/services/snapshot-service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const result = await SnapshotService.getMonthlyChanges(session.user.id);

    return NextResponse.json({
      success: true,
      data: result,
      calculatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API错误] /api/portfolio/monthly-changes:', error);
    return NextResponse.json({ error: '获取本月资产变动失败' }, { status: 500 });
  }
}
