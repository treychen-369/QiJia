/**
 * 数据迁移脚本：为现有资产设置默认的 underlyingType
 * 
 * Phase 2: 双重分类架构实施
 * 日期: 2026-02-01
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 默认映射规则：AssetCategory.code -> UnderlyingType
const DEFAULT_UNDERLYING_MAPPING = {
  // 权益类 → 默认是权益敞口
  'EQUITY': 'EQUITY',
  'EQUITY_CN': 'EQUITY',
  'EQUITY_US': 'EQUITY',
  'EQUITY_HK': 'EQUITY',
  'EQUITY_JP': 'EQUITY',
  'EQUITY_OTHER': 'EQUITY',
  
  // 固定收益类
  'FIXED_INCOME': 'BOND',
  'FIXED_BOND': 'BOND',
  'FIXED_CONVERTIBLE': 'BOND',  // 可转债本质是债券
  'FIXED_WEALTH': 'FIXED_INCOME',
  
  // 现金类
  'CASH': 'CASH',
  'CASH_DEMAND': 'CASH',
  'CASH_MONEY_FUND': 'CASH',
  'CASH_BROKER': 'CASH',
  'CASH_FIXED': 'FIXED_INCOME',  // 定期存款归入固定收益
  
  // 另类投资
  'ALTERNATIVE': 'OTHER',
  'ALT_GOLD': 'GOLD',
  'ALT_CRYPTO': 'CRYPTO',
  'ALT_COMMODITY': 'COMMODITY',
  'ALT_COLLECTIBLE': 'COLLECTIBLE',
  'ALT_PHYSICAL': 'DEPRECIATING',
  
  // 不动产
  'REAL_ESTATE': 'REAL_ESTATE',
  'RE_RESIDENTIAL': 'REAL_ESTATE',
  'RE_COMMERCIAL': 'REAL_ESTATE',
  'RE_REITS': 'REAL_ESTATE',
};

// 特殊证券的底层敞口映射（需要覆盖默认值）
// 这些证券虽然存放在证券账户，但底层敞口不是权益类
const SPECIAL_SECURITIES_MAPPING = {
  // 黄金ETF
  '518880': 'GOLD',    // 华安黄金ETF
  '159934': 'GOLD',    // 易方达黄金ETF
  '159812': 'GOLD',    // 博时黄金ETF
  '518800': 'GOLD',    // 国泰黄金ETF
  '159937': 'GOLD',    // 华安黄金ETF联接
  
  // 债券ETF
  '511260': 'BOND',    // 十年国债ETF
  '511010': 'BOND',    // 国债ETF
  '511220': 'BOND',    // 城投ETF
  '511020': 'BOND',    // 活跃国债ETF
  
  // 原油/商品
  '160416': 'COMMODITY', // 南方原油LOF
  '161815': 'COMMODITY', // 银华抗通胀
  '164701': 'COMMODITY', // 添富商品
  '160216': 'COMMODITY', // 国泰商品
  
  // 货币基金（在证券账户中）
  '511880': 'CASH',    // 银华日利
  '511660': 'CASH',    // 建信添益
  '511690': 'CASH',    // 交银货币
  
  // 可转债（归入债券）
  // 可转债代码通常以 11/12 开头，这里只列举ETF
  '511380': 'BOND',    // 可转债ETF
};

async function migrateUnderlyingType() {
  console.log('🚀 开始迁移 underlyingType...\n');
  
  // 1. 获取所有资产分类的映射
  const categories = await prisma.assetCategory.findMany({
    select: { id: true, code: true, name: true }
  });
  
  const categoryCodeMap = new Map();
  categories.forEach(cat => {
    categoryCodeMap.set(cat.id, cat.code);
  });
  
  console.log(`📊 加载了 ${categories.length} 个资产分类\n`);
  
  // 2. 迁移 Security 表
  console.log('=== 迁移 Security 表 ===');
  const securities = await prisma.security.findMany({
    where: { underlyingType: null },
    include: { assetCategory: true }
  });
  
  let securityUpdated = 0;
  let securitySpecial = 0;
  
  for (const security of securities) {
    let underlyingType = null;
    
    // 先检查是否是特殊证券
    if (SPECIAL_SECURITIES_MAPPING[security.symbol]) {
      underlyingType = SPECIAL_SECURITIES_MAPPING[security.symbol];
      securitySpecial++;
      console.log(`  ✨ 特殊映射: ${security.symbol} (${security.name}) → ${underlyingType}`);
    } else {
      // 使用默认映射
      const categoryCode = security.assetCategory?.code;
      underlyingType = DEFAULT_UNDERLYING_MAPPING[categoryCode] || 'OTHER';
    }
    
    if (underlyingType) {
      await prisma.security.update({
        where: { id: security.id },
        data: { underlyingType }
      });
      securityUpdated++;
    }
  }
  
  console.log(`✅ Security: 更新 ${securityUpdated} 条记录，其中特殊映射 ${securitySpecial} 条\n`);
  
  // 3. 迁移 Asset 表
  console.log('=== 迁移 Asset 表 ===');
  const assets = await prisma.asset.findMany({
    where: { underlyingType: null },
    include: { assetCategory: true }
  });
  
  let assetUpdated = 0;
  
  for (const asset of assets) {
    const categoryCode = asset.assetCategory?.code;
    const underlyingType = DEFAULT_UNDERLYING_MAPPING[categoryCode] || 'OTHER';
    
    await prisma.asset.update({
      where: { id: asset.id },
      data: { underlyingType }
    });
    assetUpdated++;
    
    // 打印定期存款的特殊处理
    if (categoryCode === 'CASH_FIXED') {
      console.log(`  💰 定期存款: ${asset.name} → FIXED_INCOME (原分类: CASH_FIXED)`);
    }
  }
  
  console.log(`✅ Asset: 更新 ${assetUpdated} 条记录\n`);
  
  // 4. 统计迁移结果
  console.log('=== 迁移完成统计 ===');
  
  const securityStats = await prisma.security.groupBy({
    by: ['underlyingType'],
    _count: { id: true }
  });
  
  console.log('\n📈 Security 底层敞口分布:');
  securityStats.forEach(s => {
    console.log(`  ${s.underlyingType || 'NULL'}: ${s._count.id} 条`);
  });
  
  const assetStats = await prisma.asset.groupBy({
    by: ['underlyingType'],
    _count: { id: true }
  });
  
  console.log('\n📈 Asset 底层敞口分布:');
  assetStats.forEach(s => {
    console.log(`  ${s.underlyingType || 'NULL'}: ${s._count.id} 条`);
  });
  
  console.log('\n✅ 迁移完成！');
}

// 运行迁移
migrateUnderlyingType()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
