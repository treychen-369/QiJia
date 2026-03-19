/**
 * 初始化汇率数据到数据库
 * 如果数据库没有汇率缓存，设置默认值
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const DEFAULT_RATES = {
  baseCurrency: 'CNY',
  rates: {
    USD: 7.2,   // 1 USD = 7.2 CNY
    HKD: 0.92,  // 1 HKD = 0.92 CNY
    CNY: 1,
  },
  lastUpdated: new Date().toISOString(),
  source: 'default-initialization',
}

async function initExchangeRates() {
  try {
    console.log('🔍 检查数据库汇率配置...')

    // 检查是否已有汇率配置
    const existing = await prisma.systemConfig.findUnique({
      where: { configKey: 'EXCHANGE_RATES' }
    })

    if (existing) {
      console.log('✅ 数据库已有汇率配置，无需初始化')
      console.log('当前配置:', existing.configValue)
      console.log('更新时间:', existing.updatedAt)
    } else {
      console.log('⚠️ 数据库没有汇率配置，正在初始化默认值...')
      
      // 插入默认汇率
      await prisma.systemConfig.create({
        data: {
          configKey: 'EXCHANGE_RATES',
          configValue: DEFAULT_RATES,
        }
      })
      
      console.log('✅ 默认汇率已初始化到数据库')
      console.log('默认配置:', DEFAULT_RATES)
    }

    console.log('\n💡 提示:')
    console.log('- 系统会优先使用数据库缓存的汇率')
    console.log('- 点击"刷新"按钮可手动更新汇率')
    console.log('- 如果所有外部API失败，会自动使用默认汇率')

  } catch (error) {
    console.error('❌ 初始化失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

initExchangeRates()
