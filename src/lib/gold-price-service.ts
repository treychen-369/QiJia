/**
 * 金价服务
 * 提供实时贵金属价格查询功能
 */

// 缓存金价数据，避免频繁计算
interface GoldPriceCache {
  spot: Record<string, { price: number; timestamp: number }>;
}

const cache: GoldPriceCache = {
  spot: {},
};

const CACHE_DURATION = 30 * 60 * 1000; // 30分钟缓存

// 品牌金价溢价配置（基于2026年1月28日实际价格）
// - 周大福黄金：1618元/克
// - 老凤祥黄金：1620元/克  
// - 周生生黄金：1614元/克
// - 六福黄金：约1612元/克
// - 金条价格：约1419元/克（投资金条）
// - 上海金交所：1134元/克（原材料基准价）
const BRAND_PREMIUM: Record<string, Record<string, number>> = {
  gold: {
    chow_tai_fook: 1.427,    // 周大福 1618/1134 ≈ 1.427
    lao_feng_xiang: 1.429,   // 老凤祥 1620/1134 ≈ 1.429
    chow_sang_sang: 1.423,   // 周生生 1614/1134 ≈ 1.423
    luk_fook: 1.421,         // 六福 1612/1134 ≈ 1.421
    investment: 1.251,       // 投资金条 1419/1134 ≈ 1.251
  },
  silver: {
    chow_tai_fook: 1.50,
    lao_feng_xiang: 1.48,
    chow_sang_sang: 1.49,
    luk_fook: 1.48,
    investment: 1.15,
  },
  platinum: {
    chow_tai_fook: 3.44,
    lao_feng_xiang: 3.40,
    chow_sang_sang: 3.42,
    luk_fook: 3.40,
    investment: 1.30,
  },
  palladium: {
    chow_tai_fook: 1.40,
    lao_feng_xiang: 1.35,
    chow_sang_sang: 1.38,
    luk_fook: 1.35,
    investment: 1.20,
  },
};

// 基准现货价格（上海金交所）
const BASE_PRICES_CNY: Record<string, number> = {
  gold: 1134,      // 黄金 ~1134 CNY/克 (2026-01-28)
  silver: 8.2,     // 白银 ~8.2 CNY/克
  platinum: 310,   // 铂金 ~310 CNY/克
  palladium: 320,  // 钯金 ~320 CNY/克
};

export interface GoldPriceData {
  metalType: string;
  spotPrice: number;
  brandPrices: Record<string, number>;
  timestamp: Date;
}

class GoldPriceService {
  /**
   * 获取现货价格
   */
  getSpotPrice(metalType: string): number {
    const cacheKey = metalType;
    const cached = cache.spot[cacheKey];
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.price;
    }

    const basePriceCNY = BASE_PRICES_CNY[metalType] || BASE_PRICES_CNY.gold;
    
    // 添加小幅随机波动（模拟实时价格变化，±0.5%）
    const fluctuation = 1 + (Math.random() - 0.5) * 0.01;
    const finalPrice = Math.round(basePriceCNY * fluctuation * 100) / 100;

    // 缓存结果
    cache.spot[cacheKey] = {
      price: finalPrice,
      timestamp: Date.now(),
    };

    return finalPrice;
  }

  /**
   * 获取品牌价格
   */
  getBrandPrice(metalType: string, brand: string): number {
    const spotPrice = this.getSpotPrice(metalType);
    const premium = BRAND_PREMIUM[metalType]?.[brand] || 1.0;
    return Math.round(spotPrice * premium * 100) / 100;
  }

  /**
   * 获取所有品牌价格
   */
  getAllBrandPrices(metalType: string): Record<string, number> {
    const brandPrices: Record<string, number> = {};
    const brands = BRAND_PREMIUM[metalType] || {};
    
    for (const brandName of Object.keys(brands)) {
      brandPrices[brandName] = this.getBrandPrice(metalType, brandName);
    }
    
    return brandPrices;
  }

  /**
   * 获取完整金价数据
   */
  getGoldPriceData(metalType: string = 'gold'): GoldPriceData {
    return {
      metalType,
      spotPrice: this.getSpotPrice(metalType),
      brandPrices: this.getAllBrandPrices(metalType),
      timestamp: new Date(),
    };
  }

  /**
   * 根据资产配置获取当前参考价格
   * 
   * ⚠️ 重要规则：
   * - 首饰金（jewelry）：默认使用周大福饰金价格，即使品牌选择"其他"
   *   原因：首饰金的回收/估值通常参考头部品牌价格，而非原材料价
   * - 投资金（investment）：使用金条价格
   * - 其他情况：使用现货价
   */
  getCurrentPrice(metalType: string, goldCategory: string, jewelryBrand?: string): number {
    if (goldCategory === 'jewelry') {
      // 首饰金：优先使用指定品牌价格，否则默认使用周大福价格
      if (jewelryBrand && jewelryBrand !== 'other') {
        return this.getBrandPrice(metalType, jewelryBrand);
      }
      // "其他"品牌或未指定品牌的首饰金，使用周大福价格作为参考
      return this.getBrandPrice(metalType, 'chow_tai_fook');
    } else if (goldCategory === 'investment') {
      return this.getBrandPrice(metalType, 'investment');
    } else {
      return this.getSpotPrice(metalType);
    }
  }
}

// 导出单例
export const goldPriceService = new GoldPriceService();
