'use server';

import { NextRequest, NextResponse } from 'next/server';
import { goldPriceService } from '@/lib/gold-price-service';

/**
 * 金价查询API
 * 
 * 支持的金价类型：
 * - spot: 国际黄金现货价（XAU/USD 换算成 CNY/克）
 * - chow_tai_fook: 周大福金价
 * - lao_feng_xiang: 老凤祥金价
 * 
 * 贵金属类型：
 * - gold: 黄金
 * - silver: 白银
 * - platinum: 铂金
 * - palladium: 钯金
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metalType = searchParams.get('metalType') || 'gold';
    const brand = searchParams.get('brand') || 'chow_tai_fook';

    // 获取金价数据
    const priceData = goldPriceService.getGoldPriceData(metalType);

    // 金属类型中文名称
    const metalNames: Record<string, string> = {
      gold: '黄金',
      silver: '白银',
      platinum: '铂金',
      palladium: '钯金',
    };

    // 品牌中文名称
    const brandNames: Record<string, string> = {
      chow_tai_fook: '周大福',
      lao_feng_xiang: '老凤祥',
      chow_sang_sang: '周生生',
      luk_fook: '六福珠宝',
    };

    return NextResponse.json({
      success: true,
      data: {
        metalType,
        metalName: metalNames[metalType] || metalType,
        spotPrice: priceData.spotPrice,  // 现货价格 (CNY/克)
        brandPrices: priceData.brandPrices,  // 各品牌价格
        selectedBrand: brand,
        selectedBrandName: brandNames[brand] || brand,
        selectedBrandPrice: priceData.brandPrices[brand] || priceData.spotPrice,
        unit: 'CNY/克',
        timestamp: priceData.timestamp.toISOString(),
        note: '价格数据仅供参考，实际交易请以品牌门店报价为准',
      },
    });
  } catch (error) {
    console.error('获取金价失败:', error);
    return NextResponse.json(
      { success: false, error: '获取金价失败' },
      { status: 500 }
    );
  }
}
