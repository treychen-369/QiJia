/**
 * 资产分类升级脚本 - Phase 1
 * 完善顶层6大分类 + 添加二级分类
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 顶层5大分类配置（权益类和基金类合并）
const TOP_LEVEL_CATEGORIES = [
  {
    code: 'EQUITY',
    name: '权益类投资',
    nameEn: 'Equity Investments',
    level: 1,
    color: '#3B82F6',
    icon: 'trending-up',
    riskLevel: 'HIGH',
    liquidity: 'MEDIUM',
    expectedReturn: 'HIGH',
    suggestedMinPercent: 40.00,
    suggestedMaxPercent: 70.00,
    sortOrder: 1,
    description: '包括股票、基金等权益性投资，按投资标的所属经济体分类'
  },
  {
    code: 'CASH',
    name: '现金及现金等价物',
    nameEn: 'Cash & Cash Equivalents',
    level: 1,
    color: '#10B981',
    icon: 'wallet',
    riskLevel: 'LOW',
    liquidity: 'HIGH',
    expectedReturn: 'LOW',
    suggestedMinPercent: 3.00,
    suggestedMaxPercent: 10.00,
    sortOrder: 2,
    description: '流动性最强的资产，包括活期存款、定期存款、货币基金等'
  },
  {
    code: 'FIXED_INCOME',
    name: '固定收益类',
    nameEn: 'Fixed Income Assets',
    level: 1,
    color: '#F59E0B',
    icon: 'shield',
    riskLevel: 'LOW',
    liquidity: 'MEDIUM',
    expectedReturn: 'LOW',
    suggestedMinPercent: 20.00,
    suggestedMaxPercent: 40.00,
    sortOrder: 3,
    description: '提供固定或可预测收益的投资，包括债券、理财产品等'
  },
  {
    code: 'REAL_ESTATE',
    name: '不动产类',
    nameEn: 'Real Estate Assets',
    level: 1,
    color: '#6366F1',
    icon: 'home',
    riskLevel: 'MEDIUM',
    liquidity: 'LOW',
    expectedReturn: 'MEDIUM',
    suggestedMinPercent: 0.00,
    suggestedMaxPercent: 50.00,
    sortOrder: 4,
    description: '实物资产，包括房产、REITs等，具有保值增值功能'
  },
  {
    code: 'ALTERNATIVE',
    name: '另类投资',
    nameEn: 'Alternative Investments',
    level: 1,
    color: '#EC4899',
    icon: 'sparkles',
    riskLevel: 'VERY_HIGH',
    liquidity: 'LOW',
    expectedReturn: 'HIGH',
    suggestedMinPercent: 0.00,
    suggestedMaxPercent: 15.00,
    sortOrder: 5,
    description: '非传统投资品，包括贵金属、大宗商品、数字资产、收藏品等'
  }
];

// 二级分类配置
const SECOND_LEVEL_CATEGORIES = [
  // 权益类 - 按投资标的所属地区分类
  { code: 'EQUITY_CN', name: '中国资产', nameEn: 'China Assets', parentCode: 'EQUITY', sortOrder: 1, description: 'A股、中概股、投资中国的基金等（按公司实际所属地）' },
  { code: 'EQUITY_US', name: '美国资产', nameEn: 'US Assets', parentCode: 'EQUITY', sortOrder: 2, description: '美股本土公司、投资美国的基金（如标普500 ETF）' },
  { code: 'EQUITY_JP', name: '日本资产', nameEn: 'Japan Assets', parentCode: 'EQUITY', sortOrder: 3, description: '日股、投资日本的基金（如日经225 ETF）' },
  { code: 'EQUITY_HK', name: '香港资产', nameEn: 'Hong Kong Assets', parentCode: 'EQUITY', sortOrder: 4, description: '香港本地公司（港交所、汇丰等）' },
  { code: 'EQUITY_OTHER', name: '其他地区', nameEn: 'Other Regions', parentCode: 'EQUITY', sortOrder: 5, description: '欧洲、新兴市场等其他地区资产' },
  
  // 现金类 - 按流动性分类
  { code: 'CASH_DEMAND', name: '活期存款', nameEn: 'Demand Deposit', parentCode: 'CASH', sortOrder: 1, description: '银行活期账户，随时可取' },
  { code: 'CASH_FIXED', name: '定期存款', nameEn: 'Fixed Deposit', parentCode: 'CASH', sortOrder: 2, description: '银行定期存款，期限3个月至5年' },
  { code: 'CASH_MONEY_FUND', name: '货币基金', nameEn: 'Money Market Fund', parentCode: 'CASH', sortOrder: 3, description: '如余额宝、零钱通等货币市场基金' },
  { code: 'CASH_BROKER', name: '券商现金', nameEn: 'Brokerage Cash', parentCode: 'CASH', sortOrder: 4, description: '证券账户中的可用现金' },
  
  // 固定收益类 - 按类型分类
  { code: 'FIXED_BOND', name: '债券', nameEn: 'Bond', parentCode: 'FIXED_INCOME', sortOrder: 1, description: '国债、地方政府债、公司债等' },
  { code: 'FIXED_CONVERTIBLE', name: '可转债', nameEn: 'Convertible Bond', parentCode: 'FIXED_INCOME', sortOrder: 2, description: '可转换公司债券' },
  { code: 'FIXED_WEALTH', name: '理财产品', nameEn: 'Wealth Management', parentCode: 'FIXED_INCOME', sortOrder: 3, description: '银行理财、信托产品等' },
  
  // 不动产类 - 按类型分类
  { code: 'RE_RESIDENTIAL', name: '住宅房产', nameEn: 'Residential', parentCode: 'REAL_ESTATE', sortOrder: 1, description: '自住房、投资性住宅' },
  { code: 'RE_COMMERCIAL', name: '商业地产', nameEn: 'Commercial', parentCode: 'REAL_ESTATE', sortOrder: 2, description: '商铺、写字楼等' },
  { code: 'RE_REITS', name: '房地产信托', nameEn: 'REITs', parentCode: 'REAL_ESTATE', sortOrder: 3, description: '公募REITs、海外REITs等' },
  
  // 另类投资 - 按类型分类
  { code: 'ALT_GOLD', name: '贵金属', nameEn: 'Precious Metals', parentCode: 'ALTERNATIVE', sortOrder: 1, description: '黄金、白银等贵金属' },
  { code: 'ALT_COMMODITY', name: '大宗商品', nameEn: 'Commodities', parentCode: 'ALTERNATIVE', sortOrder: 2, description: '原油、农产品、工业金属等' },
  { code: 'ALT_CRYPTO', name: '数字资产', nameEn: 'Cryptocurrency', parentCode: 'ALTERNATIVE', sortOrder: 3, description: '比特币、以太坊等加密货币' },
  { code: 'ALT_COLLECTIBLE', name: '收藏品', nameEn: 'Collectibles', parentCode: 'ALTERNATIVE', sortOrder: 4, description: '艺术品、古董、名酒等' }
];

async function main() {
  console.log('🚀 开始升级资产分类...\n');

  try {
    // Step 1: 创建顶层分类
    console.log('📦 Step 1: 创建顶层6大分类...');
    const topLevelMap = new Map();
    
    for (const category of TOP_LEVEL_CATEGORIES) {
      const existing = await prisma.assetCategory.findUnique({
        where: { code: category.code }
      });

      if (existing) {
        // 更新现有分类
        const updated = await prisma.assetCategory.update({
          where: { id: existing.id },
          data: {
            name: category.name,
            nameEn: category.nameEn,
            level: category.level,
            color: category.color,
            icon: category.icon,
            riskLevel: category.riskLevel,
            liquidity: category.liquidity,
            expectedReturn: category.expectedReturn,
            suggestedMinPercent: category.suggestedMinPercent,
            suggestedMaxPercent: category.suggestedMaxPercent,
            sortOrder: category.sortOrder,
            description: category.description
          }
        });
        console.log(`  ✅ 更新: ${category.name} (${category.code})`);
        topLevelMap.set(category.code, updated.id);
      } else {
        // 创建新分类
        const created = await prisma.assetCategory.create({
          data: category
        });
        console.log(`  ✨ 创建: ${category.name} (${category.code})`);
        topLevelMap.set(category.code, created.id);
      }
    }
    console.log(`✅ 顶层分类完成: ${topLevelMap.size} 个\n`);

    // Step 2: 创建二级分类
    console.log('📦 Step 2: 创建二级分类...');
    let secondLevelCount = 0;
    
    for (const category of SECOND_LEVEL_CATEGORIES) {
      const parentId = topLevelMap.get(category.parentCode);
      if (!parentId) {
        console.log(`  ⚠️  跳过: ${category.name} (找不到父分类 ${category.parentCode})`);
        continue;
      }

      const existing = await prisma.assetCategory.findUnique({
        where: { code: category.code }
      });

      const data = {
        name: category.name,
        nameEn: category.nameEn,
        code: category.code,
        level: 2,
        parentId: parentId,
        sortOrder: category.sortOrder,
        description: category.description
      };

      if (existing) {
        await prisma.assetCategory.update({
          where: { id: existing.id },
          data
        });
        console.log(`  ✅ 更新: ${category.name} (${category.code})`);
      } else {
        await prisma.assetCategory.create({ data });
        console.log(`  ✨ 创建: ${category.name} (${category.code})`);
      }
      secondLevelCount++;
    }
    console.log(`✅ 二级分类完成: ${secondLevelCount} 个\n`);

    // Step 3: 数据迁移 - 将现有的旧分类映射到新分类
    console.log('📦 Step 3: 迁移现有证券分类...');
    
    // 查找现有的旧分类
    const oldCategories = await prisma.assetCategory.findMany({
      where: {
        OR: [
          { code: null },
          { level: null }
        ]
      },
      include: {
        securities: {
          include: {
            region: true  // 包含region信息用于智能判断
          }
        }
      }
    });

    console.log(`  找到 ${oldCategories.length} 个旧分类需要迁移`);

    // 分类映射规则（合并股票和基金到权益类）
    const MIGRATION_MAP = {
      '股票': 'EQUITY_CN',        // 默认中国资产
      'A股': 'EQUITY_CN',
      '港股': 'EQUITY_CN',        // 大部分港股是中国公司
      '美股': 'EQUITY_US',        // 默认美国资产，中概股需特殊处理
      '基金': 'EQUITY_CN',        // 默认中国基金
      '股票型基金': 'EQUITY_CN',
      '债券型基金': 'FIXED_BOND',
      '混合型基金': 'EQUITY_CN',
      '指数基金': 'EQUITY_CN',    // 需根据标的判断
      '货币基金': 'CASH_MONEY_FUND',
      '债券': 'FIXED_BOND',
      '国债': 'FIXED_BOND',
      '黄金': 'ALT_GOLD',
      '房产': 'RE_RESIDENTIAL',
      '现金': 'CASH'
    };

    // 中概股列表（在美上市的中国公司）
    const CHINESE_ADR_SYMBOLS = [
      'PDD', 'BABA', 'JD', 'BIDU', 'NIO', 'XPEV', 'LI', 'BILI', 'TME', 
      'NTES', 'VIPS', 'ZTO', 'ATHM', 'BZUN', 'WB', 'HUYA', 'DOYU',
      'IQ', 'SOHU', 'SINA', 'YY', 'MOMO', 'QFIN', 'LX', 'TIGR'
    ];

    // 美国ETF/基金关键词
    const US_FUND_KEYWORDS = [
      '标普', 'S&P', 'SP500', '纳斯达克', 'NASDAQ', 'QQQ',
      '道琼斯', 'DOW', '美国50', 'US50', '美股'
    ];

    // 智能判断证券的目标国家
    function detectTargetCountry(security) {
      const { symbol, name, region } = security;
      
      // 1. 检查是否是中概股
      if (CHINESE_ADR_SYMBOLS.includes(symbol.toUpperCase())) {
        return 'CN';
      }
      
      // 2. 检查名称中是否包含美国基金关键词
      if (US_FUND_KEYWORDS.some(keyword => name.includes(keyword))) {
        return 'US';
      }
      
      // 3. 检查名称中是否包含中国相关
      if (name.includes('中国') || name.includes('沪深') || name.includes('A股')) {
        return 'CN';
      }
      
      // 4. 检查名称中是否包含日本相关
      if (name.includes('日本') || name.includes('日经')) {
        return 'JP';
      }
      
      // 5. 根据region推测（兜底）
      if (region?.code === 'CN' || region?.code === 'SH' || region?.code === 'SZ') {
        return 'CN';
      } else if (region?.code === 'US') {
        return 'US';  // 美股市场，默认美国（中概股已在步骤1处理）
      } else if (region?.code === 'HK') {
        return 'CN';  // 港股大部分是中国公司
      } else if (region?.code === 'JP') {
        return 'JP';
      }
      
      // 6. 默认返回null（待手动设置）
      return null;
    }

    let migratedCount = 0;
    for (const oldCat of oldCategories) {
      const targetCode = MIGRATION_MAP[oldCat.name];
      if (!targetCode) {
        console.log(`  ⚠️  无映射规则: ${oldCat.name} (包含 ${oldCat.securities.length} 个证券)`);
        continue;
      }

      const targetCategory = await prisma.assetCategory.findUnique({
        where: { code: targetCode }
      });

      if (!targetCategory) {
        console.log(`  ⚠️  找不到目标分类: ${targetCode}`);
        continue;
      }

      // 将所有证券迁移到新分类，同时设置targetCountry
      if (oldCat.securities.length > 0) {
        for (const security of oldCat.securities) {
          const targetCountry = detectTargetCountry(security);
          
          await prisma.security.update({
            where: { id: security.id },
            data: { 
              assetCategoryId: targetCategory.id,
              targetCountry: targetCountry
            }
          });
          
          const countryLabel = targetCountry ? `[${targetCountry}]` : '[未设置]';
          console.log(`    - ${security.symbol} ${security.name} ${countryLabel}`);
        }
        console.log(`  ✅ 迁移: ${oldCat.name} -> ${targetCategory.name} (${oldCat.securities.length} 个证券)`);
        migratedCount += oldCat.securities.length;
      }

      // 删除旧分类（如果没有子分类）
      const hasChildren = await prisma.assetCategory.count({
        where: { parentId: oldCat.id }
      });
      
      if (hasChildren === 0) {
        await prisma.assetCategory.delete({
          where: { id: oldCat.id }
        });
        console.log(`  🗑️  删除旧分类: ${oldCat.name}`);
      }
    }
    console.log(`✅ 数据迁移完成: ${migratedCount} 个证券\n`);

    // Step 4: 验证结果
    console.log('📊 Step 4: 验证结果...\n');
    
    const allCategories = await prisma.assetCategory.findMany({
      include: {
        _count: {
          select: { securities: true }
        }
      },
      orderBy: [
        { level: 'asc' },
        { sortOrder: 'asc' }
      ]
    });

    console.log('顶层分类:');
    allCategories.filter(c => c.level === 1).forEach(cat => {
      console.log(`  ${cat.sortOrder}. ${cat.name} (${cat.code}) - ${cat._count.securities} 个证券`);
      console.log(`     颜色: ${cat.color}, 风险: ${cat.riskLevel}, 流动性: ${cat.liquidity}`);
    });

    console.log('\n二级分类:');
    allCategories.filter(c => c.level === 2).forEach(cat => {
      const parent = allCategories.find(p => p.id === cat.parentId);
      console.log(`  ${parent?.name} > ${cat.name} (${cat.code}) - ${cat._count.securities} 个证券`);
    });

    console.log('\n✨ 升级完成！');

  } catch (error) {
    console.error('❌ 升级失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
