const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function importData() {
  console.log('开始导入数据...');
  
  const data = JSON.parse(fs.readFileSync('data_export.json', 'utf-8'));
  
  // 按依赖顺序导入（注意：外键约束）
  const importOrder = [
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
  
  for (const table of importOrder) {
    if (data[table] && data[table].length > 0) {
      try {
        // 处理日期字段
        const records = data[table].map(record => {
          const processed = {};
          for (const [key, value] of Object.entries(record)) {
            if (value && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
              processed[key] = new Date(value);
            } else {
              processed[key] = value;
            }
          }
          return processed;
        });
        
        // 使用 createMany 批量插入
        const result = await prisma[table].createMany({
          data: records,
          skipDuplicates: true,
        });
        console.log(`✅ ${table}: 导入 ${result.count} 条记录`);
      } catch (e) {
        console.log(`❌ ${table}: 导入失败 - ${e.message}`);
      }
    } else {
      console.log(`⏭️ ${table}: 无数据，跳过`);
    }
  }
  
  console.log('\n数据导入完成！');
  await prisma.$disconnect();
}

importData().catch(console.error);
