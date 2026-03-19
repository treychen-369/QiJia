/**
 * 现金余额迁移脚本
 * 
 * 功能：将 AccountBalance 快照表中的最新现金余额迁移到 InvestmentAccount 表
 * 
 * 使用方法：
 * node scripts/migrate-cash-balance.js
 * 
 * 2026-01-31 创建
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateCashBalance() {
  console.log('🚀 开始迁移现金余额数据...\n');

  try {
    // 获取所有账户
    const accounts = await prisma.investmentAccount.findMany({
      include: { broker: true }
    });

    console.log(`找到 ${accounts.length} 个投资账户\n`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const account of accounts) {
      // 获取该账户的最新余额快照
      const latestBalance = await prisma.accountBalance.findFirst({
        where: { accountId: account.id },
        orderBy: { snapshotDate: 'desc' }
      });

      if (!latestBalance) {
        console.log(`⏭️  ${account.accountName} (${account.broker.name}): 无快照数据，跳过`);
        skippedCount++;
        continue;
      }

      // 检查是否已经有现金余额
      const currentCashBalance = Number(account.cashBalance) || 0;
      const snapshotCashBalance = Number(latestBalance.cashBalanceOriginal) || 0;

      if (currentCashBalance > 0) {
        console.log(`✓  ${account.accountName} (${account.broker.name}): 已有现金余额 ${currentCashBalance} ${account.currency}，跳过`);
        skippedCount++;
        continue;
      }

      if (snapshotCashBalance === 0) {
        console.log(`⏭️  ${account.accountName} (${account.broker.name}): 快照现金为0，跳过`);
        skippedCount++;
        continue;
      }

      // 迁移数据
      await prisma.investmentAccount.update({
        where: { id: account.id },
        data: {
          cashBalance: snapshotCashBalance,
          cashBalanceCny: Number(latestBalance.cashBalanceCny) || snapshotCashBalance,
          cashExchangeRate: Number(latestBalance.exchangeRate) || 1,
          cashLastUpdated: latestBalance.snapshotDate
        }
      });

      console.log(`✅ ${account.accountName} (${account.broker.name}): 迁移成功 ${snapshotCashBalance} ${account.currency}`);
      migratedCount++;
    }

    console.log('\n📊 迁移完成统计:');
    console.log(`   - 迁移成功: ${migratedCount} 个账户`);
    console.log(`   - 跳过: ${skippedCount} 个账户`);
    console.log(`   - 总计: ${accounts.length} 个账户`);

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行迁移
migrateCashBalance()
  .then(() => {
    console.log('\n✨ 迁移脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 迁移脚本执行失败:', error);
    process.exit(1);
  });
