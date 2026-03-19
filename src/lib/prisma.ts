import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 检查是否在构建时（没有真实的数据库连接）
const isBuildTime = process.env.DATABASE_URL?.includes('placeholder') || 
                    process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL

// 延迟初始化 Prisma 客户端，避免构建时连接数据库
function createPrismaClient(): PrismaClient {
  // 构建时返回一个空的代理对象，避免连接数据库
  if (isBuildTime) {
    console.log('[Prisma] Build time detected, skipping database connection')
    return new Proxy({} as PrismaClient, {
      get(target, prop) {
        // 返回一个 noop 函数
        return () => Promise.resolve(null)
      }
    })
  }
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    errorFormat: 'pretty',
  })
}

// 使用 getter 实现真正的延迟初始化
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma