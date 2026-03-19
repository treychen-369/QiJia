import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { searchSecurities } from '@/lib/securities-api';
import { isApiEnabled } from '@/lib/securities-api-config';

// 创建证券的验证Schema
const createSecuritySchema = z.object({
  symbol: z.string().min(1, '证券代码不能为空').max(20),
  name: z.string().min(1, '证券名称不能为空').max(200),
  nameEn: z.string().max(200).optional(),
  assetCategoryId: z.string().uuid('资产类别ID无效'),
  regionId: z.string().uuid('地区ID无效'),
  exchange: z.string().max(20).optional(),
  sector: z.string().max(100).optional(),
  industry: z.string().max(100).optional(),
});

// GET /api/securities - 搜索/获取证券列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const useApi = searchParams.get('useApi') === 'true';

    // 优先搜索本地数据库
    const whereClause = query
      ? {
          OR: [
            { symbol: { contains: query, mode: 'insensitive' as const } },
            { name: { contains: query, mode: 'insensitive' as const } },
            { nameEn: { contains: query, mode: 'insensitive' as const } },
          ],
          isActive: true,
        }
      : { isActive: true };

    const localSecurities = await prisma.security.findMany({
      where: whereClause,
      include: {
        assetCategory: { select: { name: true, nameEn: true } },
        region: { select: { name: true, code: true, currency: true } },
      },
      take: limit,
      orderBy: [{ symbol: 'asc' }],
    });

    // 如果找到本地数据或未启用API，直接返回
    if (localSecurities.length > 0 || !useApi || !isApiEnabled()) {
      return NextResponse.json({
        success: true,
        data: localSecurities,
        count: localSecurities.length,
        source: 'local',
      });
    }

    // 如果本地没有数据且启用了API，则尝试API搜索
    if (query && isApiEnabled()) {
      try {
        console.log(`🔍 本地未找到"${query}"，尝试API搜索...`);
        
        const apiResults = await searchSecurities({
          query,
          limit,
        });

        console.log(`✅ API返回 ${apiResults.length} 条结果`);

        // 转换API结果为前端格式
        const formattedResults = apiResults.map(item => ({
          id: `api-${item.symbol}`,
          symbol: item.symbol,
          name: item.name,
          nameEn: item.nameEn,
          exchange: item.exchange,
          sector: item.sector,
          industry: item.industry,
          isActive: item.isActive,
          assetCategory: { name: '股票', nameEn: 'Stock' },
          region: { 
            name: item.market === 'CN' ? '中国A股' : item.market === 'HK' ? '香港' : '美国',
            code: item.market,
            currency: item.currency,
          },
          _isApiResult: true, // 标记为API结果
        }));

        return NextResponse.json({
          success: true,
          data: formattedResults,
          count: formattedResults.length,
          source: 'api',
          message: `从${process.env.SECURITIES_API_PROVIDER || 'API'}找到 ${formattedResults.length} 条结果`,
        });
      } catch (apiError: any) {
        console.error('API搜索失败:', apiError.message);
        // API失败时返回空结果，不影响用户体验
        return NextResponse.json({
          success: true,
          data: [],
          count: 0,
          source: 'api-error',
          error: apiError.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: localSecurities,
      count: localSecurities.length,
      source: 'local',
    });
  } catch (error: any) {
    console.error('获取证券列表失败:', error);
    return NextResponse.json(
      { error: '获取证券列表失败', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/securities - 创建新证券
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    
    // 验证输入
    const validation = createSecuritySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: '输入验证失败', 
          details: validation.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // 检查证券是否已存在
    const existing = await prisma.security.findUnique({
      where: {
        symbol_exchange: {
          symbol: data.symbol,
          exchange: data.exchange || '',
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: '证券代码已存在', existing },
        { status: 409 }
      );
    }

    // 创建证券
    const security = await prisma.security.create({
      data: {
        symbol: data.symbol,
        name: data.name,
        nameEn: data.nameEn,
        assetCategoryId: data.assetCategoryId,
        regionId: data.regionId,
        exchange: data.exchange,
        sector: data.sector,
        industry: data.industry,
      },
      include: {
        assetCategory: { select: { name: true, nameEn: true } },
        region: { select: { name: true, code: true, currency: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: security,
      message: '证券创建成功',
    }, { status: 201 });

  } catch (error: any) {
    console.error('创建证券失败:', error);
    return NextResponse.json(
      { error: '创建证券失败', details: error.message },
      { status: 500 }
    );
  }
}
