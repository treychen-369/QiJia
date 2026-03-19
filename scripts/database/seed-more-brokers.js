/**
 * 补充更多常用券商
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 补充券商列表
const additionalBrokers = [
  // 中国券商（补充）
  { name: '中银国际', code: 'BOCI', country: 'CN' },
  { name: '申万宏源', code: 'SWHYSC', country: 'CN' },
  { name: '兴业证券', code: 'XYE', country: 'CN' },
  { name: '东吴证券', code: 'DWZQ', country: 'CN' },
  { name: '中金公司', code: 'CICC', country: 'CN' },
  { name: '光大证券', code: 'EBSCN', country: 'CN' },
  { name: '方正证券', code: 'FOUNDERSC', country: 'CN' },
  { name: '银河证券', code: 'CIHSC', country: 'CN' },
  { name: '国信证券', code: 'GUOSEN', country: 'CN' },
  { name: '中泰证券', code: 'ZHAOSHANG', country: 'CN' },
  { name: '东兴证券', code: 'DXZQ', country: 'CN' },
  { name: '华西证券', code: 'HUAXI', country: 'CN' },
  { name: '西南证券', code: 'XNZQ', country: 'CN' },
  { name: '中原证券', code: 'CCNEW', country: 'CN' },
  { name: '国元证券', code: 'GYZQ', country: 'CN' },
  { name: '东北证券', code: 'NEZS', country: 'CN' },
  
  // 香港券商（补充）
  { name: '中银国际证券', code: 'BOCI_HK', country: 'HK' },
  { name: '工银国际', code: 'ICBCI', country: 'HK' },
  { name: '建银国际', code: 'CCB_INTL', country: 'HK' },
  { name: '农银国际', code: 'ABC_INTL', country: 'HK' },
  { name: '交银国际', code: 'BOCOM_INTL', country: 'HK' },
  { name: '招银国际', code: 'CMB_INTL', country: 'HK' },
  { name: '华泰国际', code: 'HTSC_INTL', country: 'HK' },
  { name: '中信证券(香港)', code: 'CITIC_HK', country: 'HK' },
  { name: '国泰君安(香港)', code: 'GTJA_HK', country: 'HK' },
  { name: '海通国际', code: 'HAITONG_INTL', country: 'HK' },
  { name: '盈透证券', code: 'IB_HK', country: 'HK' },
  { name: '辉立证券', code: 'PHILLIP', country: 'HK' },
  { name: '尚乘证券', code: 'AMTD', country: 'HK' },
  
  // 其他国家券商
  { name: 'Fidelity', code: 'FIDELITY', country: 'US' },
  { name: 'Vanguard', code: 'VANGUARD', country: 'US' },
  { name: 'Merrill Lynch', code: 'ML', country: 'US' },
  { name: 'Morgan Stanley', code: 'MS', country: 'US' },
  { name: 'Goldman Sachs', code: 'GS', country: 'US' },
  { name: 'Nomura', code: 'NOMURA', country: 'JP' },
  { name: 'Daiwa Securities', code: 'DAIWA', country: 'JP' },
  { name: 'SBI Securities', code: 'SBI', country: 'JP' },
];

async function seedMoreBrokers() {
  console.log('📝 开始添加补充券商...\n');
  console.log('='.repeat(60));

  let added = 0;
  let skipped = 0;
  let errors = 0;

  for (const broker of additionalBrokers) {
    try {
      // 检查是否已存在
      const existing = await prisma.broker.findFirst({
        where: {
          OR: [
            { name: broker.name },
            { code: broker.code },
          ],
        },
      });

      if (existing) {
        console.log(`⏭️  跳过: ${broker.name} (已存在)`);
        skipped++;
        continue;
      }

      // 创建券商
      await prisma.broker.create({
        data: {
          name: broker.name,
          code: broker.code,
          country: broker.country,
          isActive: true,
        },
      });

      console.log(`✅ 添加: ${broker.name} (${broker.code}, ${broker.country})`);
      added++;

    } catch (error) {
      console.error(`❌ 失败: ${broker.name} - ${error.message}`);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 添加完成统计:');
  console.log('='.repeat(60));
  console.log(`✅ 新增: ${added} 个券商`);
  console.log(`⏭️  跳过: ${skipped} 个 (已存在)`);
  console.log(`❌ 失败: ${errors} 个`);

  // 显示当前总数
  const totalCount = await prisma.broker.count();
  console.log(`\n📈 当前券商总数: ${totalCount} 个`);

  // 按国家统计
  const byCountry = await prisma.broker.groupBy({
    by: ['country'],
    _count: true,
    orderBy: {
      _count: {
        country: 'desc',
      },
    },
  });

  console.log('\n按国家/地区分布:');
  const countryNames = {
    CN: '中国',
    HK: '香港',
    US: '美国',
    JP: '日本',
    UK: '英国',
    SG: '新加坡',
  };
  
  byCountry.forEach(item => {
    const name = countryNames[item.country] || item.country;
    console.log(`  • ${name}: ${item._count} 个`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('💡 提示:');
  console.log('  1. 券商已添加到数据库，可立即在UI中使用');
  console.log('  2. 如需添加更多券商，可在UI中使用"添加自定义券商"功能');
  console.log('  3. 重启开发服务器以确保数据更新');
  console.log('='.repeat(60));
}

seedMoreBrokers()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
