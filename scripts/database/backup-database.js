/**
 * 数据库备份脚本
 * 导出关键数据到JSON文件
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups');
  const backupFile = path.join(backupDir, `database-backup-${timestamp}.json`);

  // 确保备份目录存在
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log('🔄 开始备份数据库...\n');

  try {
    const backup = {};

    // 1. 备份资产分类
    console.log('📦 备份资产分类...');
    backup.assetCategories = await prisma.assetCategory.findMany({
      include: {
        _count: {
          select: { securities: true }
        }
      }
    });
    console.log(`  ✅ 已备份 ${backup.assetCategories.length} 个资产分类`);

    // 2. 备份证券
    console.log('📦 备份证券...');
    backup.securities = await prisma.security.findMany({
      include: {
        assetCategory: {
          select: { id: true, name: true }
        },
        region: {
          select: { id: true, code: true, name: true }
        }
      }
    });
    console.log(`  ✅ 已备份 ${backup.securities.length} 个证券`);

    // 3. 备份持仓（只备份关键字段）
    console.log('📦 备份持仓...');
    backup.holdings = await prisma.holding.findMany({
      select: {
        id: true,
        userId: true,
        securityId: true,
        accountId: true,
        quantity: true,
        averageCost: true,
        currentPrice: true,
        marketValueCny: true,
        unrealizedPnl: true,
        unrealizedPnlPercent: true,
        lastUpdated: true
      }
    });
    console.log(`  ✅ 已备份 ${backup.holdings.length} 个持仓记录`);

    // 4. 备份账户
    console.log('📦 备份账户...');
    backup.accounts = await prisma.investmentAccount.findMany({
      include: {
        broker: {
          select: { id: true, name: true }
        }
      }
    });
    console.log(`  ✅ 已备份 ${backup.accounts.length} 个账户`);

    // 5. 备份SystemConfig
    console.log('📦 备份系统配置...');
    backup.systemConfigs = await prisma.systemConfig.findMany();
    console.log(`  ✅ 已备份 ${backup.systemConfigs.length} 个系统配置`);

    // 添加元数据
    backup.metadata = {
      backupTime: new Date().toISOString(),
      version: '1.0',
      description: '资产分类升级前的数据备份'
    };

    // 写入文件
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf-8');

    console.log('\n✅ 备份完成！');
    console.log(`📁 备份文件: ${backupFile}`);
    console.log(`📊 文件大小: ${(fs.statSync(backupFile).size / 1024).toFixed(2)} KB`);

    // 统计信息
    console.log('\n📊 备份统计:');
    console.log(`  - 资产分类: ${backup.assetCategories.length} 条`);
    console.log(`  - 证券: ${backup.securities.length} 条`);
    console.log(`  - 持仓: ${backup.holdings.length} 条`);
    console.log(`  - 账户: ${backup.accounts.length} 条`);
    console.log(`  - 系统配置: ${backup.systemConfigs.length} 条`);

    return backupFile;

  } catch (error) {
    console.error('❌ 备份失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  backupDatabase()
    .then(() => {
      console.log('\n✨ 数据库备份成功！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 备份过程出错:', error);
      process.exit(1);
    });
}

module.exports = { backupDatabase };
