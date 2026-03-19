/**
 * 初始化资产类别数据 - 标准家庭资产分类
 * 运行: node scripts/seed-asset-categories.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const assetCategories = [
  {
    name: '现金',
    nameEn: 'Cash',
    categoryType: 'CASH',
    description: '现金及现金等价物，包括货币基金、活期存款等高流动性资产',
    colorCode: '#10B981', // 绿色
    sortOrder: 1,
    isActive: true
  },
  {
    name: '股票',
    nameEn: 'Stocks',
    categoryType: 'EQUITY',
    description: '权益类资产，包括A股、港股、美股等个股',
    colorCode: '#3B82F6', // 蓝色
    sortOrder: 2,
    isActive: true
  },
  {
    name: '基金',
    nameEn: 'Funds',
    categoryType: 'FUND',
    description: '基金类资产，包括指数基金、ETF、主动型基金等',
    colorCode: '#8B5CF6', // 紫色
    sortOrder: 3,
    isActive: true
  },
  {
    name: '债券',
    nameEn: 'Bonds',
    categoryType: 'FIXED_INCOME',
    description: '固定收益类资产，包括国债、企业债、可转债等',
    colorCode: '#F59E0B', // 橙色
    sortOrder: 4,
    isActive: true
  },
  {
    name: '黄金',
    nameEn: 'Gold',
    categoryType: 'ALTERNATIVE',
    description: '贵金属投资，包括实物黄金、黄金ETF等',
    colorCode: '#FCD34D', // 金色
    sortOrder: 5,
    isActive: true
  },
  {
    name: 'REITs',
    nameEn: 'Real Estate Investment Trusts',
    categoryType: 'ALTERNATIVE',
    description: '不动产投资信托基金',
    colorCode: '#6366F1', // 靛蓝
    sortOrder: 6,
    isActive: true
  },
  {
    name: '商品期货',
    nameEn: 'Commodities',
    categoryType: 'ALTERNATIVE',
    description: '大宗商品投资，包括原油、天然气等',
    colorCode: '#EC4899', // 粉色
    sortOrder: 7,
    isActive: true
  },
  {
    name: '虚拟货币',
    nameEn: 'Cryptocurrency',
    categoryType: 'ALTERNATIVE',
    description: '数字货币资产，包括比特币、以太坊等',
    colorCode: '#F97316', // 深橙
    sortOrder: 8,
    isActive: true
  },
  {
    name: '房产',
    nameEn: 'Real Estate',
    categoryType: 'REAL_ESTATE',
    description: '实物不动产，包括住宅、商铺等',
    colorCode: '#0EA5E9', // 天蓝
    sortOrder: 9,
    isActive: true
  },
  {
    name: '其他',
    nameEn: 'Others',
    categoryType: 'OTHER',
    description: '其他类型资产',
    colorCode: '#94A3B8', // 灰色
    sortOrder: 99,
    isActive: true
  }
];

async function main() {
  console.log('开始初始化资产类别数据...');

  try {
    for (const category of assetCategories) {
      const result = await prisma.assetCategory.upsert({
        where: { name: category.name },
        update: {
          nameEn: category.nameEn,
          categoryType: category.categoryType,
          description: category.description,
          colorCode: category.colorCode,
          sortOrder: category.sortOrder,
          isActive: category.isActive
        },
        create: category
      });
      console.log(`✓ 资产类别已创建/更新: ${result.name} (${result.nameEn})`);
    }

    console.log('\n✅ 资产类别数据初始化完成！');
    console.log(`\n共处理 ${assetCategories.length} 个资产类别：`);
    console.log('1. 现金及现金等价物');
    console.log('2. 权益类资产（股票）');
    console.log('3. 基金类资产');
    console.log('4. 固定收益类资产（债券）');
    console.log('5-8. 另类投资（黄金、REITs、商品、虚拟货币）');
    console.log('9. 不动产');
    console.log('10. 其他资产');

  } catch (error) {
    console.error('❌ 初始化失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
