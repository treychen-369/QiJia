/**
 * 同步计划管理API
 * 提供定时同步的设置、查询和管理功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { syncManager, SyncConfig } from '@/lib/sync/sync-manager';
import { z } from 'zod';

// 请求参数验证schema
const scheduleCreateSchema = z.object({
  symbols: z.array(z.string()).min(1).max(100),
  config: z.object({
    enabledServices: z.array(z.enum(['tonghuashun', 'eastmoney', 'xueqiu'])).min(1),
    syncInterval: z.number().min(60000).max(24 * 60 * 60 * 1000), // 1分钟到24小时
    maxRetries: z.number().min(1).max(5).default(3),
    timeout: z.number().min(5000).max(30000).default(10000)
  })
});

const scheduleUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  config: z.object({
    enabledServices: z.array(z.enum(['tonghuashun', 'eastmoney', 'xueqiu'])).min(1).optional(),
    syncInterval: z.number().min(60000).max(24 * 60 * 60 * 1000).optional(),
    maxRetries: z.number().min(1).max(5).optional(),
    timeout: z.number().min(5000).max(30000).optional()
  }).optional()
});

/**
 * POST /api/sync/schedule - 创建或更新同步计划
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户认证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求参数
    const body = await request.json();
    const validation = scheduleCreateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: '请求参数无效',
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { symbols, config } = validation.data;
    const userId = session.user.id;

    // 创建完整的同步配置
    const fullConfig: SyncConfig = {
      enabledServices: config.enabledServices,
      syncInterval: config.syncInterval,
      maxRetries: config.maxRetries,
      timeout: config.timeout,
      fallbackOrder: ['eastmoney', 'tonghuashun', 'xueqiu']
    };

    // 设置定时同步
    await syncManager.scheduleSync(userId, symbols, fullConfig);

    // 获取创建的计划信息
    const schedule = syncManager.getSchedule(userId);

    return NextResponse.json({
      success: true,
      data: {
        userId: schedule?.userId,
        symbols: schedule?.symbols,
        config: schedule?.config,
        nextSyncTime: schedule?.nextSyncTime,
        isActive: schedule?.isActive
      },
      message: '同步计划创建成功'
    });

  } catch (error) {
    console.error('创建同步计划API错误:', error);
    
    return NextResponse.json(
      { 
        error: '创建同步计划失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync/schedule - 获取用户的同步计划
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户认证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const schedule = syncManager.getSchedule(userId);

    if (!schedule) {
      return NextResponse.json({
        success: true,
        data: null,
        message: '未找到同步计划'
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: schedule.userId,
        symbols: schedule.symbols,
        config: schedule.config,
        nextSyncTime: schedule.nextSyncTime,
        isActive: schedule.isActive,
        stats: {
          symbolCount: schedule.symbols.length,
          enabledServices: schedule.config.enabledServices.length,
          intervalMinutes: Math.floor(schedule.config.syncInterval / 60000)
        }
      }
    });

  } catch (error) {
    console.error('获取同步计划API错误:', error);
    
    return NextResponse.json(
      { 
        error: '获取同步计划失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sync/schedule - 更新同步计划
 */
export async function PATCH(request: NextRequest) {
  try {
    // 验证用户认证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求参数
    const body = await request.json();
    const validation = scheduleUpdateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: '请求参数无效',
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const currentSchedule = syncManager.getSchedule(userId);

    if (!currentSchedule) {
      return NextResponse.json(
        { error: '未找到同步计划' },
        { status: 404 }
      );
    }

    const { isActive, config } = validation.data;

    // 更新活跃状态
    if (typeof isActive === 'boolean') {
      if (isActive) {
        // 重新启动同步
        await syncManager.scheduleSync(
          currentSchedule.userId,
          currentSchedule.symbols,
          currentSchedule.config
        );
      } else {
        // 停止同步
        syncManager.stopScheduledSync(userId);
      }
    }

    // 更新配置
    if (config) {
      const updatedConfig: SyncConfig = {
        ...currentSchedule.config,
        ...config
      };

      // 如果计划是活跃的，重新设置同步
      if (currentSchedule.isActive) {
        await syncManager.scheduleSync(
          currentSchedule.userId,
          currentSchedule.symbols,
          updatedConfig
        );
      }
    }

    // 获取更新后的计划信息
    const updatedSchedule = syncManager.getSchedule(userId);

    return NextResponse.json({
      success: true,
      data: {
        userId: updatedSchedule?.userId,
        symbols: updatedSchedule?.symbols,
        config: updatedSchedule?.config,
        nextSyncTime: updatedSchedule?.nextSyncTime,
        isActive: updatedSchedule?.isActive
      },
      message: '同步计划更新成功'
    });

  } catch (error) {
    console.error('更新同步计划API错误:', error);
    
    return NextResponse.json(
      { 
        error: '更新同步计划失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sync/schedule - 删除同步计划
 */
export async function DELETE(request: NextRequest) {
  try {
    // 验证用户认证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const schedule = syncManager.getSchedule(userId);

    if (!schedule) {
      return NextResponse.json(
        { error: '未找到同步计划' },
        { status: 404 }
      );
    }

    // 停止并删除同步计划
    syncManager.stopScheduledSync(userId);

    return NextResponse.json({
      success: true,
      message: '同步计划删除成功'
    });

  } catch (error) {
    console.error('删除同步计划API错误:', error);
    
    return NextResponse.json(
      { 
        error: '删除同步计划失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}