const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function exportData() {
  console.log('开始导出数据...');
  
  const data = {};
  
  // 按依赖顺序导出
  const tables = [
    'user',
    'region',
    'assetCategory',
    'broker',
    'security',
    'account',
    'holding',
    'asset',
    'transaction',
    'portfolioHistory',
    'priceHistory',
    'assetActivityLog',
    'holdingTransferLog',
    'familyFinancialProfile',
    'userAllocationTarget',
    'allocationAdvice',
    'syncConfiguration',
    'syncLog',
    'systemConfig',
  ];
  
  for (const table of tables) {
    try {
      if (prisma[table]) {
        const records = await prisma[table].findMany();
        data[table] = records;
        console.log(`${table}: ${records.length} 条记录`);
      }
    } catch (e) {
      console.log(`${table}: 跳过 (${e.message})`);
    }
  }
  
  // 保存为JSON
  fs.writeFileSync('data_export.json', JSON.stringify(data, null, 2));
  console.log('\n数据已导出到 data_export.json');
  
  await prisma.$disconnect();
}

exportData().catch(console.error);
