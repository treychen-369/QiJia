/**
 * 修复Schema迁移 - 确保所有数据库变更已应用
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMigrations() {
  console.log('\n🔧 修复Schema迁移...\n');
  
  try {
    // 1. 创建 HoldingTransferLog 表
    console.log('1. 检查 HoldingTransferLog 表...');
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'holding_transfer_logs'
      ) as exists
    `;
    
    if (!tableExists[0].exists) {
      console.log('   创建 HoldingTransferLog 表...');
      
      await prisma.$executeRaw`
        CREATE TABLE holding_transfer_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          security_id UUID NOT NULL,
          source_account_id UUID NOT NULL,
          target_account_id UUID NOT NULL,
          quantity DECIMAL(15, 6) NOT NULL,
          cost_basis DECIMAL(15, 6) NOT NULL,
          transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          notes TEXT,
          CONSTRAINT fk_transfer_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT fk_transfer_security FOREIGN KEY (security_id) REFERENCES securities(id),
          CONSTRAINT fk_transfer_source FOREIGN KEY (source_account_id) REFERENCES investment_accounts(id),
          CONSTRAINT fk_transfer_target FOREIGN KEY (target_account_id) REFERENCES investment_accounts(id)
        )
      `;
      
      console.log('   ✅ 表创建成功');
      
      // 创建索引
      await prisma.$executeRaw`CREATE INDEX idx_transfer_logs_user ON holding_transfer_logs(user_id)`;
      await prisma.$executeRaw`CREATE INDEX idx_transfer_logs_security ON holding_transfer_logs(security_id)`;
      await prisma.$executeRaw`CREATE INDEX idx_transfer_logs_source ON holding_transfer_logs(source_account_id)`;
      await prisma.$executeRaw`CREATE INDEX idx_transfer_logs_target ON holding_transfer_logs(target_account_id)`;
      await prisma.$executeRaw`CREATE INDEX idx_transfer_logs_date ON holding_transfer_logs(transferred_at DESC)`;
      
      console.log('   ✅ 索引创建成功');
    } else {
      console.log('   ✅ 表已存在');
    }
    
    // 2. 删除冗余字段
    console.log('\n2. 检查冗余字段...');
    const fields = [
      { table: 'account_balances', field: 'total_portfolio_ratio' },
    ];
    
    for (const { table, field } of fields) {
      const columnExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = ${table} 
          AND column_name = ${field}
        ) as exists
      `;
      
      if (columnExists[0].exists) {
        console.log(`   删除 ${table}.${field}...`);
        await prisma.$executeRawUnsafe(
          `ALTER TABLE ${table} DROP COLUMN IF EXISTS ${field}`
        );
        console.log(`   ✅ ${field} 已删除`);
      } else {
        console.log(`   ✅ ${field} 已不存在`);
      }
    }
    
    console.log('\n✅ 所有迁移修复完成！\n');
    
  } catch (error) {
    console.error('\n❌ 修复失败:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMigrations();
