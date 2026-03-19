const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createSystemConfigTable() {
  try {
    console.log('正在创建 system_config 表...');
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS system_config (
        config_key VARCHAR(100) PRIMARY KEY,
        config_value JSONB NOT NULL,
        description TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    
    console.log('✅ system_config 表创建成功！');
    
    // 初始化默认汇率
    await prisma.$executeRaw`
      INSERT INTO system_config (config_key, config_value, description)
      VALUES (
        'EXCHANGE_RATES',
        '{"baseCurrency":"CNY","rates":{"USD":7.2,"HKD":0.92,"CNY":1},"lastUpdated":"2026-01-24T00:00:00.000Z","source":"default"}'::jsonb,
        '汇率配置（基准货币：人民币）'
      )
      ON CONFLICT (config_key) DO NOTHING
    `;
    
    console.log('✅ 默认汇率已初始化！');
    
  } catch (error) {
    console.error('❌ 创建表失败:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createSystemConfigTable()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
