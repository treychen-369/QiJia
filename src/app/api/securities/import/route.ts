import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { searchSecurities } from '@/lib/securities-api';
import { isApiEnabled } from '@/lib/securities-api-config';

/**
 * POST /api/securities/import
 * 批量导入证券数据到本地数据库
 * 
 * 功能：
 * 1. 从Tushare API获取证券列表
 * 2. 自动创建缺失的资产类别和地区
 * 3. 批量保存证券到数据库
 * 4. 跳过已存在的证券
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    if (!isApiEnabled()) {
      return NextResponse.json(
        { error: '证券API未启用，请在环境变量中配置' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { source = 'tushare', limit = 100 } = body;

    console.log(`📥 开始批量导入证券数据 (source: ${source}, limit: ${limit})...`);

    // 1. 从API获取证券数据
    const apiResults = await searchSecurities({
      query: '', // 空查询返回全部
      limit: limit,
    });

    if (apiResults.length === 0) {
      return NextResponse.json({
        success: true,
        imported: 0,
        skipped: 0,
        message: 'API未返回数据',
      });
    }

    console.log(`✅ API返回 ${apiResults.length} 条数据`);

    // 2. 确保资产类别和地区存在
    const categoryMap = new Map<string, string>();
    const regionMap = new Map<string, string>();

    // 获取或创建"股票"资产类别
    let stockCategory = await prisma.assetCategory.findUnique({
      where: { name: '股票' },
    });
    if (!stockCategory) {
      stockCategory = await prisma.assetCategory.create({
        data: {
          name: '股票',
          nameEn: 'Stock',
          description: '普通股票',
          sortOrder: 1,
        },
      });
    }
    categoryMap.set('Stock', stockCategory.id);

    // 获取或创建地区
    const regions = [
      { code: 'CN', name: '中国A股', currency: 'CNY' },
      { code: 'HK', name: '香港', currency: 'HKD' },
      { code: 'US', name: '美国', currency: 'USD' },
    ];

    for (const reg of regions) {
      let region = await prisma.region.findUnique({
        where: { code: reg.code },
      });
      if (!region) {
        region = await prisma.region.create({
          data: reg,
        });
      }
      regionMap.set(reg.code, region.id);
    }

    // 3. 批量保存证券
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of apiResults) {
      try {
        // 检查是否已存在
        const existing = await prisma.security.findUnique({
          where: {
            symbol_exchange: {
              symbol: item.symbol,
              exchange: item.exchange || '',
            },
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // 获取资产类别ID和地区ID
        const assetCategoryId = categoryMap.get('Stock') || stockCategory.id;
        const regionId = regionMap.get(item.market) || regionMap.get('CN')!;

        // 创建证券
        await prisma.security.create({
          data: {
            symbol: item.symbol,
            name: item.name,
            nameEn: item.nameEn || item.name,
            assetCategoryId: assetCategoryId,
            regionId: regionId,
            exchange: item.exchange,
            sector: item.sector,
            industry: item.industry,
            isActive: item.isActive !== false,
          },
        });

        imported++;

        if (imported % 20 === 0) {
          console.log(`   ⏳ 已导入 ${imported} 只证券...`);
        }
      } catch (error: any) {
        errors.push(`${item.symbol}: ${error.message}`);
        console.error(`❌ 导入失败: ${item.symbol}`, error.message);
      }
    }

    console.log(`✅ 批量导入完成: 成功 ${imported}, 跳过 ${skipped}, 失败 ${errors.length}`);

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `成功导入 ${imported} 只证券，跳过 ${skipped} 只已存在的证券`,
    });
  } catch (error: any) {
    console.error('批量导入证券失败:', error);
    return NextResponse.json(
      { 
        error: '批量导入失败', 
        details: error.message,
      },
      { status: 500 }
    );
  }
}
