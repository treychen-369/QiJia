/**
 * 底层资产敞口类型定义和映射服务
 * 
 * Phase 2: 双重分类架构
 * 用于区分资产的"存放分类"（AssetCategory）和"底层敞口"（UnderlyingType）
 */

// ==================== 底层敞口类型枚举 ====================

export const UnderlyingType = {
  // 权益类
  EQUITY: 'EQUITY',           // 股票/股票型基金/股票ETF
  
  // 固定收益类
  BOND: 'BOND',               // 债券/债券基金/债券ETF
  FIXED_INCOME: 'FIXED_INCOME', // 定期存款/理财产品
  
  // 现金等价物
  CASH: 'CASH',               // 活期存款/货币基金
  
  // 另类投资
  GOLD: 'GOLD',               // 黄金/黄金ETF/黄金基金
  COMMODITY: 'COMMODITY',     // 大宗商品/商品基金
  CRYPTO: 'CRYPTO',           // 数字资产
  COLLECTIBLE: 'COLLECTIBLE', // 收藏品
  
  // 不动产
  REAL_ESTATE: 'REAL_ESTATE', // 房产/REITs
  
  // 应收款
  RECEIVABLE: 'RECEIVABLE',   // 应收款/借出款

  // 特殊类型
  DEPRECIATING: 'DEPRECIATING', // 消耗性资产（汽车等）
  MIXED: 'MIXED',             // 混合型（平衡型基金等）
  OTHER: 'OTHER',             // 其他
} as const;

export type UnderlyingTypeValue = typeof UnderlyingType[keyof typeof UnderlyingType];

// ==================== 底层敞口类型元数据 ====================

export interface UnderlyingTypeInfo {
  code: UnderlyingTypeValue;
  name: string;
  nameEn: string;
  description: string;
  color: string;       // 图表颜色
  icon: string;        // 图标名称
  parentGroup: string; // 父级分组（用于资产概览）
  includeInNetWorth: boolean; // 是否计入净资产
}

export const UNDERLYING_TYPE_INFO: Record<UnderlyingTypeValue, UnderlyingTypeInfo> = {
  [UnderlyingType.EQUITY]: {
    code: 'EQUITY',
    name: '权益类',
    nameEn: 'Equity',
    description: '股票、股票型基金、股票ETF等',
    color: '#3B82F6', // blue-500
    icon: 'TrendingUp',
    parentGroup: 'EQUITY',
    includeInNetWorth: true,
  },
  [UnderlyingType.BOND]: {
    code: 'BOND',
    name: '债券',
    nameEn: 'Bonds',
    description: '国债、企业债、债券基金、债券ETF等',
    color: '#10B981', // emerald-500
    icon: 'FileText',
    parentGroup: 'FIXED_INCOME',
    includeInNetWorth: true,
  },
  [UnderlyingType.FIXED_INCOME]: {
    code: 'FIXED_INCOME',
    name: '固定收益',
    nameEn: 'Fixed Income',
    description: '定期存款、银行理财产品等',
    color: '#14B8A6', // teal-500
    icon: 'PiggyBank',
    parentGroup: 'FIXED_INCOME',
    includeInNetWorth: true,
  },
  [UnderlyingType.CASH]: {
    code: 'CASH',
    name: '现金等价物',
    nameEn: 'Cash Equivalents',
    description: '活期存款、货币基金、券商现金等',
    color: '#6366F1', // indigo-500
    icon: 'Wallet',
    parentGroup: 'CASH',
    includeInNetWorth: true,
  },
  [UnderlyingType.GOLD]: {
    code: 'GOLD',
    name: '黄金',
    nameEn: 'Gold',
    description: '实物黄金、黄金ETF、黄金基金等',
    color: '#F59E0B', // amber-500
    icon: 'Coins',
    parentGroup: 'ALTERNATIVE',
    includeInNetWorth: true,
  },
  [UnderlyingType.COMMODITY]: {
    code: 'COMMODITY',
    name: '大宗商品',
    nameEn: 'Commodities',
    description: '原油、农产品、商品基金等',
    color: '#F97316', // orange-500
    icon: 'Package',
    parentGroup: 'ALTERNATIVE',
    includeInNetWorth: true,
  },
  [UnderlyingType.CRYPTO]: {
    code: 'CRYPTO',
    name: '数字资产',
    nameEn: 'Crypto',
    description: '比特币、以太坊等数字货币',
    color: '#8B5CF6', // violet-500
    icon: 'Zap',
    parentGroup: 'ALTERNATIVE',
    includeInNetWorth: true,
  },
  [UnderlyingType.COLLECTIBLE]: {
    code: 'COLLECTIBLE',
    name: '收藏品',
    nameEn: 'Collectibles',
    description: '艺术品、古董、珠宝等收藏品',
    color: '#EC4899', // pink-500
    icon: 'Gem',
    parentGroup: 'ALTERNATIVE',
    includeInNetWorth: true,
  },
  [UnderlyingType.REAL_ESTATE]: {
    code: 'REAL_ESTATE',
    name: '不动产',
    nameEn: 'Real Estate',
    description: '住宅、商业地产、REITs等',
    color: '#06B6D4', // cyan-500
    icon: 'Home',
    parentGroup: 'REAL_ESTATE',
    includeInNetWorth: true,
  },
  [UnderlyingType.RECEIVABLE]: {
    code: 'RECEIVABLE',
    name: '应收款',
    nameEn: 'Receivables',
    description: '个人借款、押金、薪资报销、商业应收等',
    color: '#0EA5E9', // sky-500
    icon: 'Receipt',
    parentGroup: 'RECEIVABLE',
    includeInNetWorth: true,
  },
  [UnderlyingType.DEPRECIATING]: {
    code: 'DEPRECIATING',
    name: '消耗性资产',
    nameEn: 'Depreciating Assets',
    description: '汽车、电子设备等会贬值的资产',
    color: '#94A3B8', // slate-400
    icon: 'Car',
    parentGroup: 'ALTERNATIVE', // 归入另类投资分组显示
    includeInNetWorth: true, // 计入净资产（虽然会贬值，但仍有市场价值）
  },
  [UnderlyingType.MIXED]: {
    code: 'MIXED',
    name: '混合型',
    nameEn: 'Mixed',
    description: '混合型基金、平衡型产品等',
    color: '#71717A', // zinc-500
    icon: 'Layers',
    parentGroup: 'OTHER',
    includeInNetWorth: true,
  },
  [UnderlyingType.OTHER]: {
    code: 'OTHER',
    name: '其他',
    nameEn: 'Other',
    description: '其他未分类资产',
    color: '#A1A1AA', // zinc-400
    icon: 'HelpCircle',
    parentGroup: 'OTHER',
    includeInNetWorth: true,
  },
};

// ==================== 默认映射规则 ====================

// AssetCategory.code -> UnderlyingType 的默认映射
export const DEFAULT_UNDERLYING_MAPPING: Record<string, UnderlyingTypeValue> = {
  // 权益类 → 默认是权益敞口
  'EQUITY': UnderlyingType.EQUITY,
  'EQUITY_CN': UnderlyingType.EQUITY,
  'EQUITY_US': UnderlyingType.EQUITY,
  'EQUITY_HK': UnderlyingType.EQUITY,
  'EQUITY_JP': UnderlyingType.EQUITY,
  'EQUITY_OTHER': UnderlyingType.EQUITY,
  
  // 固定收益类
  'FIXED_INCOME': UnderlyingType.BOND,
  'FIXED_BOND': UnderlyingType.BOND,
  'FIXED_CONVERTIBLE': UnderlyingType.BOND,
  'FIXED_WEALTH': UnderlyingType.FIXED_INCOME,
  
  // 现金类
  'CASH': UnderlyingType.CASH,
  'CASH_DEMAND': UnderlyingType.CASH,
  'CASH_MONEY_FUND': UnderlyingType.CASH,
  'CASH_BROKER': UnderlyingType.CASH,
  'CASH_FIXED': UnderlyingType.FIXED_INCOME, // 定期存款归入固定收益
  
  // 另类投资
  'ALTERNATIVE': UnderlyingType.OTHER,
  'ALT_GOLD': UnderlyingType.GOLD,
  'ALT_CRYPTO': UnderlyingType.CRYPTO,
  'ALT_COMMODITY': UnderlyingType.COMMODITY,
  'ALT_COLLECTIBLE': UnderlyingType.COLLECTIBLE,
  'ALT_PHYSICAL': UnderlyingType.DEPRECIATING,
  
  // 不动产
  'REAL_ESTATE': UnderlyingType.REAL_ESTATE,
  'RE_RESIDENTIAL': UnderlyingType.REAL_ESTATE,
  'RE_COMMERCIAL': UnderlyingType.REAL_ESTATE,
  'RE_REITS': UnderlyingType.REAL_ESTATE,

  // 应收款
  'RECEIVABLE': UnderlyingType.RECEIVABLE,
  'REC_PERSONAL_LOAN': UnderlyingType.RECEIVABLE,
  'REC_DEPOSIT': UnderlyingType.RECEIVABLE,
  'REC_SALARY': UnderlyingType.RECEIVABLE,
  'REC_BUSINESS': UnderlyingType.RECEIVABLE,
  'REC_OTHER': UnderlyingType.RECEIVABLE,
};

// ==================== 工具函数 ====================

/**
 * 根据 AssetCategory.code 获取默认的底层敞口类型
 */
export function getDefaultUnderlyingType(categoryCode: string): UnderlyingTypeValue {
  return DEFAULT_UNDERLYING_MAPPING[categoryCode] || UnderlyingType.OTHER;
}

/**
 * 获取底层敞口类型的显示信息
 */
export function getUnderlyingTypeInfo(type: string | null | undefined): UnderlyingTypeInfo {
  if (!type || !UNDERLYING_TYPE_INFO[type as UnderlyingTypeValue]) {
    return UNDERLYING_TYPE_INFO[UnderlyingType.OTHER];
  }
  return UNDERLYING_TYPE_INFO[type as UnderlyingTypeValue];
}

/**
 * 判断资产是否应计入净资产
 */
export function shouldIncludeInNetWorth(underlyingType: string | null | undefined): boolean {
  const info = getUnderlyingTypeInfo(underlyingType);
  return info.includeInNetWorth;
}

// ==================== 资产概览分组定义 ====================

export interface AssetOverviewGroup {
  id: string;
  name: string;
  nameEn: string;
  color: string;
  icon: string;
  underlyingTypes: UnderlyingTypeValue[]; // 包含的底层敞口类型
  sortOrder: number;
}

// 资产概览卡片的分组配置
export const ASSET_OVERVIEW_GROUPS: AssetOverviewGroup[] = [
  {
    id: 'equity',
    name: '权益类',
    nameEn: 'Equity',
    color: '#3B82F6',
    icon: 'TrendingUp',
    underlyingTypes: [UnderlyingType.EQUITY],
    sortOrder: 1,
  },
  {
    id: 'fixed_income',
    name: '固定收益',
    nameEn: 'Fixed Income',
    color: '#10B981',
    icon: 'PiggyBank',
    underlyingTypes: [UnderlyingType.BOND, UnderlyingType.FIXED_INCOME],
    sortOrder: 2,
  },
  {
    id: 'cash',
    name: '现金等价物',
    nameEn: 'Cash',
    color: '#6366F1',
    icon: 'Wallet',
    underlyingTypes: [UnderlyingType.CASH],
    sortOrder: 3,
  },
  {
    id: 'real_estate',
    name: '不动产',
    nameEn: 'Real Estate',
    color: '#06B6D4',
    icon: 'Home',
    underlyingTypes: [UnderlyingType.REAL_ESTATE],
    sortOrder: 4,
  },
  {
    id: 'alternative',
    name: '另类投资',
    nameEn: 'Alternative',
    color: '#F59E0B',
    icon: 'Layers',
    underlyingTypes: [
      UnderlyingType.GOLD,
      UnderlyingType.COMMODITY,
      UnderlyingType.CRYPTO,
      UnderlyingType.COLLECTIBLE,
      // 合并原"其他"分组的类型
      UnderlyingType.DEPRECIATING,
      UnderlyingType.MIXED,
      UnderlyingType.OTHER,
    ],
    sortOrder: 5,
  },
  {
    id: 'receivable',
    name: '应收款',
    nameEn: 'Receivables',
    color: '#0EA5E9',
    icon: 'Receipt',
    underlyingTypes: [UnderlyingType.RECEIVABLE],
    sortOrder: 6,
  },
  // 注意："其他"分组已合并到"另类投资"中，不再单独显示
];

/**
 * 根据底层敞口类型获取对应的概览分组
 */
export function getOverviewGroupByUnderlyingType(underlyingType: string | null | undefined): AssetOverviewGroup {
  const type = (underlyingType || UnderlyingType.OTHER) as UnderlyingTypeValue;
  
  const group = ASSET_OVERVIEW_GROUPS.find(g => 
    g.underlyingTypes.includes(type)
  );
  
  return group || ASSET_OVERVIEW_GROUPS[ASSET_OVERVIEW_GROUPS.length - 1]; // 默认返回"另类投资"（已合并原"其他"分组）
}
