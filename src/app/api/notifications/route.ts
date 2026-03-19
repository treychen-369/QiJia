/**
 * 通知提醒 API
 *
 * GET /api/notifications
 * 查询参数:
 * - reminderDays: 提前提醒天数（默认7）
 * - largeChangeThreshold: 大额变动阈值百分比（默认5）
 *
 * 多来源聚合通知：
 * 1. 资产到期（存款/国债）
 * 2. 负债还款（信用卡/贷款）
 * 3. 大额资产变动
 * 4. AI配置建议/风险提示
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NotificationService } from '@/lib/services/notification-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reminderDays = parseInt(searchParams.get('reminderDays') || '7', 10);
    const largeChangeThreshold = parseFloat(searchParams.get('largeChangeThreshold') || '5');

    const result = await NotificationService.getNotifications(
      session.user.id,
      reminderDays,
      largeChangeThreshold,
    );

    return NextResponse.json({
      success: true,
      data: result,
      calculatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API错误] /api/notifications:', error);
    return NextResponse.json({ error: '获取通知数据失败' }, { status: 500 });
  }
}
