#!/usr/bin/env node

/**
 * Schema 清理脚本
 * 删除13个未使用的冗余字段
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('\n🧹 开始 Schema 清理...\n');

  try {
    // 1. 读取迁移SQL
    const sqlPath = path.join(__dirname, 'schema-cleanup-migration.sql');
    const migrationSQL = fs.readFileSync(sqlPath, 'utf8');

    // 2. 执行迁移（Prisma不支持直接执行DDL，需要通过原始SQL）
    console.log('📋 执行数据库迁移...');
    
    // 分割SQL语句并执行
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && s !== 'BEGIN' && s !== 'COMMIT');

    for (const statement of statements) {
      if (statement.includes('ALTER TABLE') || statement.includes('DROP COLUMN')) {
        try {
          await prisma.$executeRawUnsafe(statement);
          console.log(`✅ ${statement.substring(0, 50)}...`);
        } catch (error) {
          if (error.message.includes('does not exist')) {
            console.log(`⏭️  字段已删除，跳过: ${statement.substring(0, 50)}...`);
          } else {
            throw error;
          }
        }
      }
    }

    // 3. 验证清理结果
    console.log('\n📊 验证清理结果...\n');

    const verifyQuery = `
      SELECT 
        table_name,
        COUNT(*) as column_count
      FROM information_schema.columns 
      WHERE table_schema = 'public'
        AND table_name IN (
          'price_history', 'transactions', 'asset_categories', 
          'portfolio_history', 'regions', 'account_balances'
        )
      GROUP BY table_name
      ORDER BY table_name;
    `;

    const results = await prisma.$queryRawUnsafe(verifyQuery);
    
    console.log('表名                    | 剩余列数');
    console.log('------------------------|----------');
    results.forEach(row => {
      console.log(`${row.table_name.padEnd(23)} | ${row.column_count}`);
    });

    // 4. 重新生成 Prisma Client
    console.log('\n🔄 重新生成 Prisma Client...');
    const { execSync } = require('child_process');
    execSync('npx prisma generate', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

    console.log('\n✅ Schema 清理完成！\n');
    console.log('已删除字段：');
    console.log('  ❌ PriceHistory: openPrice, highPrice, lowPrice, adjustedClose, dividendAmount, splitRatio, volume (7个)');
    console.log('  ❌ Transaction: settlementDate, externalId (2个)');
    console.log('  ❌ AssetCategory: colorCode (1个)');
    console.log('  ❌ PortfolioHistory: totalValueUsd (1个)');
    console.log('  ❌ Region: timezone (1个)');
    console.log('  ❌ AccountBalance: totalPortfolioRatio (1个)');
    console.log('\n📈 总计删除: 13个冗余字段\n');

  } catch (error) {
    console.error('\n❌ 清理失败:', error.message);
    console.error('\n请手动执行迁移SQL文件:');
    console.error('  psql -U postgres -d finance_system -f scripts/schema-cleanup-migration.sql\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
