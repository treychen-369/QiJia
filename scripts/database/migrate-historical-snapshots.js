/**
 * Phase 2.4: 补充历史快照的全量资产字段
 * 
 * 用于迁移旧快照数据，添加 totalAssets, totalCashAssets, totalOtherAssets, totalLiabilities, netWorth 字段
 * 
 * 策略：
 * 1. 对于没有 totalAssets 的旧快照，使用 totalValueCny 作为基础
 * 2. 由于历史数据无法准确重建，设置保守的估计值
 * 
 * 用法：
 *   node scripts/migrate-historical-snapshots.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateSnapshots() {
  console.log('========================================');
  console.log('   Phase 2.4: 历史快照数据迁移');
  console.log('========================================\n');

  // 查找所有没有 totalAssets 字段的快照
  const oldSnapshots = await prisma.portfolioHistory.findMany({
    where: {
      OR: [
        { totalAssets: null },
        { totalAssets: 0 }
      ]
    },
    orderBy: { snapshotDate: 'asc' }
  });

  console.log(`📊 找到 ${oldSnapshots.length} 条需要迁移的旧快照\n`);

  if (oldSnapshots.length === 0) {
    console.log('✅ 没有需要迁移的快照，所有数据已是最新格式！');
    await prisma.$disconnect();
    return;
  }

  // 逐条更新
  let successCount = 0;
  let errorCount = 0;

  for (const snapshot of oldSnapshots) {
    try {
      const dateStr = snapshot.snapshotDate.toISOString().split('T')[0];
      const totalValueCny = Number(snapshot.totalValueCny || 0);
      
      // 对于旧快照，我们只知道证券+券商现金的值
      // 保守估计：假设当时没有其他资产和负债
      const migratedData = {
        totalAssets: totalValueCny,       // 使用证券值作为总资产（保守估计）
        totalCashAssets: 0,               // 未知，设为0
        totalOtherAssets: 0,              // 未知，设为0
        totalLiabilities: 0,              // 未知，设为0
        netWorth: totalValueCny           // 等于总资产
      };

      await prisma.portfolioHistory.update({
        where: { id: snapshot.id },
        data: migratedData
      });

      console.log(`  ✅ ${dateStr} | 总资产: ¥${totalValueCny.toFixed(2)} (从 totalValueCny 迁移)`);
      successCount++;
    } catch (error) {
      console.error(`  ❌ ${snapshot.snapshotDate.toISOString().split('T')[0]} | 错误:`, error.message);
      errorCount++;
    }
  }

  console.log('\n========================================');
  console.log('           迁移完成');
  console.log('========================================');
  console.log(`  ✅ 成功: ${successCount} 条`);
  console.log(`  ❌ 失败: ${errorCount} 条`);
  console.log('');
  console.log('⚠️ 注意: 旧快照的 totalAssets 使用 totalValueCny（仅证券）作为估计值');
  console.log('   这意味着今日收益计算对于旧数据可能不够准确');
  console.log('   建议从今天开始使用新的快照脚本创建完整数据');

  await prisma.$disconnect();
}

migrateSnapshots().catch(e => {
  console.error('❌ 迁移失败:', e);
  process.exit(1);
});
