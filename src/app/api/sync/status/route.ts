/**
 * 同步服务状态API
 * 提供同步服务的状态查询和健康检查功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { syncManager } from '@/lib/sync/sync-manager';

/**
 * GET /api/sync/status - 获取同步服务状态
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

    const { searchParams } = new URL(request.url);
    const checkConnection = searchParams.get('checkConnection') === 'true';

    // 获取基本服务状态
    const servicesStatus = syncManager.getServicesStatus();
    const stats = syncManager.getStats();

    // 如果需要检查连接状态
    let connectionStatus: Map<string, boolean> | undefined;
    if (checkConnection) {
      connectionStatus = await syncManager.validateAllConnections();
    }

    // 合并状态信息
    const detailedServices = servicesStatus.map(service => ({
      ...service,
      connectionStatus: connectionStatus ? 
        (connectionStatus.get(service.type) ? 'connected' : 'disconnected') : 
        'unknown'
    }));

    // 获取用户的同步计划
    const userId = session.user.id;
    const userSchedule = syncManager.getSchedule(userId);

    return NextResponse.json({
      success: true,
      data: {
        // 服务状态
        services: detailedServices,
        
        // 系统统计
        stats: {
          ...stats,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          timestamp: new Date()
        },

        // 用户同步计划
        userSchedule: userSchedule ? {
          isActive: userSchedule.isActive,
          symbolCount: userSchedule.symbols.length,
          nextSyncTime: userSchedule.nextSyncTime,
          intervalMinutes: Math.floor(userSchedule.config.syncInterval / 60000),
          enabledServices: userSchedule.config.enabledServices
        } : null,

        // 系统健康状态
        health: {
          overall: detailedServices.some(s => s.connectionStatus === 'connected') ? 'healthy' : 'degraded',
          availableServices: detailedServices.filter(s => s.connectionStatus === 'connected').length,
          totalServices: detailedServices.length
        }
      }
    });

  } catch (error) {
    console.error('获取同步状态API错误:', error);
    
    return NextResponse.json(
      { 
        error: '获取同步状态失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync/status/test - 测试指定服务的连接
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
    const { serviceType, testSymbols } = body;

    if (!serviceType || !['tonghuashun', 'eastmoney', 'xueqiu'].includes(serviceType)) {
      return NextResponse.json(
        { error: '无效的服务类型' },
        { status: 400 }
      );
    }

    const service = syncManager.getService(serviceType);
    if (!service) {
      return NextResponse.json(
        { error: '服务未找到' },
        { status: 404 }
      );
    }

    const startTime = Date.now();
    const testResults: any = {
      serviceType,
      timestamp: new Date(),
      tests: {}
    };

    // 测试连接
    try {
      const connectionResult = await service.validateConnection();
      testResults.tests.connection = {
        success: connectionResult,
        duration: Date.now() - startTime,
        error: connectionResult ? null : '连接失败'
      };
    } catch (error) {
      testResults.tests.connection = {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : '连接测试失败'
      };
    }

    // 测试数据获取（如果提供了测试股票代码）
    if (testSymbols && Array.isArray(testSymbols) && testSymbols.length > 0) {
      const dataTestStart = Date.now();
      try {
        const stockData = await service.getStockPrices(testSymbols.slice(0, 5)); // 最多测试5只股票
        testResults.tests.dataFetch = {
          success: stockData.length > 0,
          duration: Date.now() - dataTestStart,
          resultCount: stockData.length,
          sampleData: stockData.slice(0, 2), // 返回前2条数据作为样本
          error: stockData.length === 0 ? '未获取到数据' : null
        };
      } catch (error) {
        testResults.tests.dataFetch = {
          success: false,
          duration: Date.now() - dataTestStart,
          resultCount: 0,
          error: error instanceof Error ? error.message : '数据获取测试失败'
        };
      }
    }

    // 计算总体测试结果
    const allTests = Object.values(testResults.tests) as Array<{ success: boolean }>;
    const overallSuccess = allTests.length > 0 && allTests.every(test => test.success);

    return NextResponse.json({
      success: overallSuccess,
      data: {
        ...testResults,
        overall: {
          success: overallSuccess,
          totalDuration: Date.now() - startTime,
          testsRun: allTests.length,
          testsPass: allTests.filter(test => test.success).length
        }
      }
    });

  } catch (error) {
    console.error('服务连接测试API错误:', error);
    
    return NextResponse.json(
      { 
        error: '服务测试失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}