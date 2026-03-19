/**
 * 初始化券商数据脚本
 * 为新用户或空数据库初始化常用券商
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BROKERS = [
  { name: '长桥证券', code: 'LONGBRIDGE', country: 'CN' },
  { name: '中信证券', code: 'CITIC', country: 'CN' },
  { name: '华泰证券', code: 'HUATAI', country: 'CN' },
  { name: '招商证券', code: 'CMB', country: 'CN' },
  { name: '广发证券', code: 'GF', country: 'CN' },
  { name: '国泰君安', code: 'GTJA', country: 'CN' },
  { name: '海通证券', code: 'HAITONG', country: 'CN' },
  { name: '东方财富', code: 'EASTMONEY', country: 'CN' },
  { name: 'Interactive Brokers', code: 'IB', country: 'US' },
  { name: 'Charles Schwab', code: 'SCHWAB', country: 'US' },
  { name: 'TD Ameritrade', code: 'TDA', country: 'US' },
  { name: 'E*TRADE', code: 'ETRADE', country: 'US' },
  { name: 'Robinhood', code: 'ROBINHOOD', country: 'US' },
  { name: 'Tiger Brokers', code: 'TIGER', country: 'CN' },
  { name: '富途证券', code: 'FUTU', country: 'CN' },
  { name: '老虎证券', code: 'UP', country: 'CN' },
];

async function initBrokers() {
  console.log('🚀 开始初始化券商数据...\n');

  try {
    // 检查是否已有数据
    const existingCount = await prisma.broker.count();
    
    if (existingCount > 0) {
      console.log(`ℹ️  数据库中已有 ${existingCount} 个券商`);
      console.log('   是否继续添加？(将跳过重复的券商)\n');
    }

    let createdCount = 0;
    let skippedCount = 0;

    for (const brokerData of BROKERS) {
      try {
        // 检查是否已存在
        const existing = await prisma.broker.findFirst({
          where: {
            OR: [
              { name: brokerData.name },
              { code: brokerData.code },
            ],
          },
        });

        if (existing) {
          console.log(`⏭️  跳过: ${brokerData.name} (已存在)`);
          skippedCount++;
          continue;
        }

        // 创建券商
        await prisma.broker.create({
          data: brokerData,
        });

        console.log(`✅ 创建: ${brokerData.name} (${brokerData.code})`);
        createdCount++;

      } catch (error) {
        console.error(`❌ 创建失败: ${brokerData.name}`, error.message);
      }
    }

    console.log('\n📊 初始化完成:');
    console.log(`   - 新创建: ${createdCount} 个券商`);
    console.log(`   - 跳过: ${skippedCount} 个券商`);
    console.log(`   - 总数: ${await prisma.broker.count()} 个券商`);

  } catch (error) {
    console.error('❌ 初始化失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

initBrokers();
