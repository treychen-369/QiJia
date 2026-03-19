import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 汇率数据存储在系统配置中
const EXCHANGE_RATE_KEY = 'EXCHANGE_RATES'

// 默认汇率（兜底值）
const DEFAULT_RATES = {
  baseCurrency: 'CNY',
  rates: {
    USD: 7.2,   // 1 USD = 7.2 CNY
    HKD: 0.92,  // 1 HKD = 0.92 CNY
    CNY: 1,
  },
  lastUpdated: new Date().toISOString(),
  source: 'fallback',
}

// 汇率API列表（按优先级排序）
const EXCHANGE_RATE_APIS = [
  {
    name: 'exchangerate-api.com',
    fetch: async () => {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/CNY', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000), // 5秒超时
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      return {
        USD: 1 / (data.rates.USD || 0.139),
        HKD: 1 / (data.rates.HKD || 1.085),
        CNY: 1,
      }
    }
  },
  {
    name: 'fixer.io (备用)',
    fetch: async () => {
      // Fixer.io API需要API key，这里仅作为示例结构
      // 实际使用时需要注册获取API key
      const response = await fetch('https://api.fixer.io/latest?base=CNY', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      return {
        USD: 1 / (data.rates.USD || 0.139),
        HKD: 1 / (data.rates.HKD || 1.085),
        CNY: 1,
      }
    }
  },
  {
    name: 'frankfurter.app (备用2)',
    fetch: async () => {
      const response = await fetch('https://api.frankfurter.app/latest?from=CNY', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      return {
        USD: 1 / (data.rates.USD || 0.139),
        HKD: 1 / (data.rates.HKD || 1.085),
        CNY: 1,
      }
    }
  }
]

// 从多个API获取汇率（带容错）
async function fetchLiveExchangeRates() {
  const errors: string[] = []
  
  // 尝试每个API
  for (const api of EXCHANGE_RATE_APIS) {
    try {
      console.log(`尝试从 ${api.name} 获取汇率...`)
      const rates = await api.fetch()
      
      console.log(`✅ 成功从 ${api.name} 获取汇率`)
      return {
        baseCurrency: 'CNY',
        rates,
        lastUpdated: new Date().toISOString(),
        source: api.name,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误'
      console.error(`❌ ${api.name} 失败:`, errorMsg)
      errors.push(`${api.name}: ${errorMsg}`)
    }
  }
  
  // 所有API都失败，返回默认值
  console.warn('⚠️ 所有汇率API都失败，使用默认汇率')
  return {
    ...DEFAULT_RATES,
    error: `所有API调用失败: ${errors.join('; ')}`,
  }
}

// GET - 获取当前汇率（只从数据库读取，不自动更新）
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 从数据库获取缓存的汇率
    const cachedConfig = await prisma.systemConfig.findUnique({
      where: { configKey: EXCHANGE_RATE_KEY }
    })

    let rates: any = null
    let fromCache = false

    if (cachedConfig && cachedConfig.configValue) {
      rates = cachedConfig.configValue
      
      // 添加缓存时间信息
      rates.cachedAt = cachedConfig.updatedAt
      fromCache = true
      
      console.log('✅ 使用数据库缓存的汇率')
    } else {
      // 数据库没有缓存，使用默认值
      console.log('⚠️ 数据库无缓存，使用默认汇率')
      rates = DEFAULT_RATES
    }

    return NextResponse.json({
      success: true,
      data: rates,
      cached: fromCache,
    })
  } catch (error) {
    console.error('获取汇率错误:', error)
    
    // 发生错误时，返回默认汇率
    return NextResponse.json({
      success: true,
      data: {
        ...DEFAULT_RATES,
        error: '读取缓存失败，使用默认汇率',
      },
      cached: false,
    })
  }
}

// POST - 手动刷新汇率（用户点击刷新按钮）
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    console.log('📡 用户手动刷新汇率...')
    
    // 尝试从多个API获取最新汇率
    const rates = await fetchLiveExchangeRates()
    
    // 保存到数据库（使用upsert）
    try {
      await prisma.systemConfig.upsert({
        where: { configKey: EXCHANGE_RATE_KEY },
        update: { configValue: rates },
        create: {
          configKey: EXCHANGE_RATE_KEY,
          configValue: rates,
        }
      })
      console.log('✅ 汇率已保存到数据库')
    } catch (dbError) {
      console.error('❌ 保存汇率到数据库失败:', dbError)
      // 即使保存失败，也返回获取到的汇率
    }

    // 根据数据源判断是否成功
    const isSuccess = rates.source !== 'fallback'

    return NextResponse.json({
      success: isSuccess,
      data: rates,
      message: isSuccess 
        ? `汇率已更新 (来源: ${rates.source})` 
        : '所有API调用失败，使用默认汇率',
      warning: (rates as any).error,
    })
  } catch (error) {
    console.error('刷新汇率错误:', error)
    
    // 出错时，尝试使用默认汇率
    try {
      await prisma.systemConfig.upsert({
        where: { configKey: EXCHANGE_RATE_KEY },
        update: { configValue: DEFAULT_RATES },
        create: {
          configKey: EXCHANGE_RATE_KEY,
          configValue: DEFAULT_RATES,
        }
      })
    } catch (dbError) {
      console.error('保存默认汇率失败:', dbError)
    }
    
    return NextResponse.json({
      success: false,
      data: DEFAULT_RATES,
      error: '刷新失败，已使用默认汇率',
      details: error instanceof Error ? error.message : '未知错误',
    })
  }
}


