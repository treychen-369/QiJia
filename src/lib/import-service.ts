import { prisma } from '@/lib/prisma'
import { ParsedExcelData, ExcelParseResult } from '@/lib/excel-parser'
import { safeNumber } from '@/lib/utils'
import { createLogger } from '@/lib/logger'

const logger = createLogger('ImportService');

// 导入结果类型
export interface ImportResult {
  success: boolean
  message: string
  summary: {
    accountBalances: { created: number; updated: number; errors: number }
    holdings: { created: number; updated: number; errors: number }
    transactions: { created: number; updated: number; errors: number }
    investmentPlans: { created: number; updated: number; errors: number }
    marketData: { created: number; updated: number; errors: number }
    strategies: { created: number; updated: number; errors: number }
  }
  errors: string[]
  warnings: string[]
}

/**
 * 数据导入服务类
 */
export class ImportService {
  private userId: string
  private errors: string[] = []
  private warnings: string[] = []

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * 导入Excel解析后的数据
   */
  async importParsedData(parseResult: ExcelParseResult, options: { overwrite?: boolean } = {}): Promise<ImportResult> {
    this.errors = []
    this.warnings = []

    if (!parseResult.success || !parseResult.data) {
      return {
        success: false,
        message: '数据解析失败，无法导入',
        summary: this.getEmptySummary(),
        errors: parseResult.errors.map(e => `${e.sheet}第${e.row}行: ${e.message}`),
        warnings: parseResult.warnings
      }
    }

    const summary = this.getEmptySummary()

    try {
      // 0. 验证用户存在
      await this.validateUser()

      // 1. 清空数据（如果需要）
      if (options.overwrite) {
        await this.clearUserDataSafely()
        this.warnings.push('已清空现有数据，进行全量覆盖导入')
      }

      // 2. 预创建所有需要的基础数据（券商、地区、资产类别等）
      await this.preCreateMasterData(parseResult.data!)

      // 3. 分别导入各类数据，每类使用独立事务
      summary.accountBalances = await this.importAccountBalancesSafely(parseResult.data!.accountBalances)
      summary.holdings = await this.importAssetDetailsSafely(parseResult.data!.assetDetails)
      summary.investmentPlans = await this.importInvestmentPlansSafely(parseResult.data!.investmentPlans)
      summary.marketData = await this.importMarketDetailsSafely(parseResult.data!.marketDetails)
      summary.strategies = await this.importStrategyOutputsSafely(parseResult.data!.strategyOutputs)

      return {
        success: this.errors.length === 0,
        message: this.errors.length === 0 ? '数据导入成功' : '数据导入完成，但存在部分错误',
        summary,
        errors: this.errors,
        warnings: this.warnings
      }

    } catch (error) {
      console.error('数据导入失败:', error)
      return {
        success: false,
        message: `数据导入失败: ${error instanceof Error ? error.message : '未知错误'}`,
        summary,
        errors: [...this.errors, error instanceof Error ? error.message : '未知错误'],
        warnings: this.warnings
      }
    }
  }

  /**
   * 验证用户存在
   */
  private async validateUser() {
    try {
      const user = await prisma.user.findUnique({
        where: { id: this.userId }
      })

      if (!user) {
        throw new Error(`用户不存在: ${this.userId}`)
      }

      console.log(`验证用户成功: ${user.email} (${user.name})`)
    } catch (error) {
      console.error('用户验证失败:', error)
      throw error
    }
  }

  /**
   * 预创建所有需要的基础数据（券商、地区、资产类别等）
   */
  private async preCreateMasterData(data: ParsedExcelData) {
    console.log('开始预创建基础数据...')
    
    try {
      // 收集所有需要的券商名称
      const brokerNames = new Set<string>()
      
      // 从账户余额中提取券商
      data.accountBalances?.forEach(item => {
        const brokerName = this.extractBrokerName(item.accountName)
        console.log(`从账户 "${item.accountName}" 提取券商: "${brokerName}"`)
        brokerNames.add(brokerName)
      })
      
      // 从资产明细中提取券商
      data.assetDetails?.forEach(item => {
        if (item.sourceAccount) {
          const brokerName = this.extractBrokerName(item.sourceAccount)
          console.log(`从资产账户 "${item.sourceAccount}" 提取券商: "${brokerName}"`)
          brokerNames.add(brokerName)
        }
      })

      console.log('需要预创建的券商:', Array.from(brokerNames))

      // 预创建券商
      for (const brokerName of Array.from(brokerNames)) {
        await this.ensureBrokerExists(brokerName)
      }

      // 收集所有需要的地区
      const regionNames = new Set<string>()
      data.assetDetails?.forEach(item => {
        if (item.region) {
          regionNames.add(item.region)
        }
      })

      console.log('需要预创建的地区:', Array.from(regionNames))

      // 预创建地区
      for (const regionName of Array.from(regionNames)) {
        await this.ensureRegionExists(regionName)
      }

      // 收集所有需要的资产类别
      const categoryNames = new Set<string>()
      data.assetDetails?.forEach(item => {
        if (item.assetCategory) {
          categoryNames.add(item.assetCategory)
        }
      })

      console.log('需要预创建的资产类别:', Array.from(categoryNames))

      // 预创建资产类别
      for (const categoryName of Array.from(categoryNames)) {
        await this.ensureAssetCategoryExists(categoryName)
      }

      // 收集所有需要的市场指数
      const marketIndices = new Set<{name: string, code: string, type: string}>()
      data.marketDetails?.forEach(item => {
        if (item.indexName && item.code && item.type) {
          marketIndices.add({
            name: item.indexName,
            code: item.code,
            type: item.type
          })
        }
      })

      console.log('需要预创建的市场指数:', Array.from(marketIndices))

      // 预创建市场指数
      for (const index of Array.from(marketIndices)) {
        await this.ensureMarketIndexExists(index.name, index.code, index.type)
      }

      console.log('基础数据预创建完成')
    } catch (error) {
      console.error('预创建基础数据失败:', error)
      this.warnings.push(`预创建基础数据时出现警告: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 确保券商存在（使用独立事务）
   */
  private async ensureBrokerExists(brokerName: string) {
    try {
      console.log(`开始确保券商存在: ${brokerName}`)
      const brokerCode = brokerName.toLowerCase().replace(/[^a-z0-9]/g, '')
      
      // 先在事务外检查是否已存在
      const existingBroker = await prisma.broker.findFirst({
        where: { name: brokerName }
      })

      if (existingBroker) {
        console.log(`券商已存在: ${brokerName} (ID: ${existingBroker.id})`)
        return
      }

      // 如果不存在，在事务中创建
      await prisma.$transaction(async (tx: any) => {
        // 再次检查，避免并发创建
        const doubleCheck = await tx.broker.findFirst({
          where: { name: brokerName }
        })

        if (doubleCheck) {
          console.log(`券商已存在(二次检查): ${brokerName} (ID: ${doubleCheck.id})`)
          return
        }

        // 检查code是否冲突，如果冲突则生成新的
        let finalCode = brokerCode
        let attempt = 0
        while (attempt < 5) {
          const codeExists = await tx.broker.findFirst({
            where: { code: finalCode }
          })
          
          if (!codeExists) {
            break
          }
          
          attempt++
          finalCode = `${brokerCode}${attempt}`
        }

        const created = await tx.broker.create({
          data: {
            name: brokerName,
            code: finalCode,
            country: this.inferCountryFromBroker(brokerName)
          }
        })
        console.log(`成功创建券商: ${brokerName} (ID: ${created.id}, Code: ${finalCode})`)
      })
    } catch (error) {
      console.error(`确保券商存在失败 (${brokerName}):`, error)
      // 不抛出错误，只记录警告
      this.warnings.push(`预创建券商失败: ${brokerName} - ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 确保地区存在（使用独立事务）
   */
  private async ensureRegionExists(regionName: string) {
    try {
      await prisma.$transaction(async (tx: any) => {
        const existing = await tx.region.findFirst({
          where: { name: regionName }
        })

        if (!existing) {
          await tx.region.create({
            data: {
              name: regionName,
              code: this.getRegionCode(regionName),
              currency: this.getRegionCurrency(regionName)
            }
          })
          console.log(`创建地区: ${regionName}`)
        }
      })
    } catch (error) {
      console.error(`确保地区存在失败 (${regionName}):`, error)
    }
  }

  /**
   * 确保资产类别存在（使用独立事务）
   */
  private async ensureAssetCategoryExists(categoryName: string) {
    try {
      await prisma.$transaction(async (tx: any) => {
        const existing = await tx.assetCategory.findFirst({
          where: { name: categoryName }
        })

        if (!existing) {
          await tx.assetCategory.create({
            data: {
              name: categoryName,
              nameEn: this.translateCategoryName(categoryName)
            }
          })
          console.log(`创建资产类别: ${categoryName}`)
        }
      })
    } catch (error) {
      console.error(`确保资产类别存在失败 (${categoryName}):`, error)
    }
  }

  /**
   * 确保市场指数存在（使用独立事务）
   */
  private async ensureMarketIndexExists(indexName: string, code: string, type: string) {
    try {
      await prisma.$transaction(async (tx: any) => {
        const existing = await tx.marketIndex.findFirst({
          where: { 
            OR: [
              { name: indexName },
              { symbol: code }
            ]
          }
        })

        if (!existing) {
          await tx.marketIndex.create({
            data: {
              name: indexName,
              symbol: code,
              indexType: type,
              dataSource: 'Excel导入'
            }
          })
          console.log(`创建市场指数: ${indexName}`)
        }
      })
    } catch (error) {
      console.error(`确保市场指数存在失败 (${indexName}):`, error)
    }
  }
  private async clearUserDataSafely() {
    console.log(`开始清空用户 ${this.userId} 的现有数据`)
    
    try {
      // 使用独立事务清空数据
      await prisma.$transaction(async (tx: any) => {
        // 按照外键依赖顺序删除数据
        // 1. 删除账户余额快照
        const deletedBalances = await tx.accountBalance.deleteMany({
          where: { userId: this.userId }
        })
        console.log(`删除了 ${deletedBalances.count} 条账户余额记录`)
        
        // 2. 删除持仓数据
        const deletedHoldings = await tx.holding.deleteMany({
          where: { userId: this.userId }
        })
        console.log(`删除了 ${deletedHoldings.count} 条持仓记录`)
        
        // 3. 删除交易记录
        const deletedTransactions = await tx.transaction.deleteMany({
          where: { userId: this.userId }
        })
        console.log(`删除了 ${deletedTransactions.count} 条交易记录`)
        
        // 4. 删除投资计划
        const deletedPlans = await tx.investmentPlan.deleteMany({
          where: { userId: this.userId }
        })
        console.log(`删除了 ${deletedPlans.count} 条投资计划`)
        
        // 5. 删除资产配置策略
        const deletedStrategies = await tx.assetAllocationStrategy.deleteMany({
          where: { userId: this.userId }
        })
        console.log(`删除了 ${deletedStrategies.count} 条资产配置策略`)
        
        // 6. 删除投资账户
        const deletedAccounts = await tx.investmentAccount.deleteMany({
          where: { userId: this.userId }
        })
        console.log(`删除了 ${deletedAccounts.count} 条投资账户`)
        
        // 7. 删除组合历史记录
        const deletedHistory = await tx.portfolioHistory.deleteMany({
          where: { userId: this.userId }
        })
        console.log(`删除了 ${deletedHistory.count} 条组合历史记录`)
        
        // 8. 删除同步配置
        const deletedConfigs = await tx.syncConfiguration.deleteMany({
          where: { userId: this.userId }
        })
        console.log(`删除了 ${deletedConfigs.count} 条同步配置`)
        
        console.log(`用户 ${this.userId} 的现有数据已清空`)
      })
    } catch (error) {
      console.error('清空用户数据时发生错误:', error)
      this.errors.push(`清空用户数据失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 安全导入账户余额数据
   */
  private async importAccountBalancesSafely(data: any[]): Promise<{ created: number; updated: number; errors: number }> {
    let created = 0
    let updated = 0
    let errors = 0

    for (const item of data) {
      try {
        await prisma.$transaction(async (tx: any) => {
          // 查找或创建券商
          const broker = await this.findOrCreateBroker(tx, item.accountName)
          
          // 查找或创建投资账户
          const account = await this.findOrCreateAccount(tx, broker.id, item.accountName, item.currency)

          // 创建或更新账户余额快照
          const balanceData = {
            userId: this.userId,
            accountId: account.id,
            snapshotDate: new Date(item.date || new Date()),
            cashBalanceOriginal: safeNumber(item.cashBalanceOriginal),
            cashBalanceCny: safeNumber(item.currentValueCny) - safeNumber(item.currentValueOriginal) + safeNumber(item.cashBalanceOriginal),
            totalMarketValueOriginal: safeNumber(item.currentValueOriginal),
            totalMarketValueCny: safeNumber(item.currentValueCny),
            investableRatio: safeNumber(item.investableRatio, 1.0),
            investableAmountCny: safeNumber(item.investableAmountCny),
            totalPortfolioRatio: safeNumber(item.totalRatio),
            exchangeRate: safeNumber(item.exchangeRate, 1),
            notes: item.notes || null
          }

          const existing = await tx.accountBalance.findFirst({
            where: {
              userId: this.userId,
              accountId: account.id,
              snapshotDate: balanceData.snapshotDate
            }
          })

          if (existing) {
            await tx.accountBalance.update({
              where: { id: existing.id },
              data: balanceData
            })
            updated++
          } else {
            await tx.accountBalance.create({
              data: balanceData
            })
            created++
          }
        })
      } catch (error) {
        errors++
        console.error(`账户余额导入失败 (${item.accountName}):`, error)
        this.errors.push(`账户余额导入失败 (${item.accountName}): ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return { created, updated, errors }
  }

  /**
   * 安全导入资产明细（持仓数据）
   */
  private async importAssetDetailsSafely(data: any[]): Promise<{ created: number; updated: number; errors: number }> {
    let created = 0
    let updated = 0
    let errors = 0

    for (const item of data) {
      try {
        // 跳过现金类资产
        if (item.security === '现金余额' || item.assetCategory === '现金') {
          continue
        }

        await prisma.$transaction(async (tx: any) => {
          // 查找或创建资产类别
          const category = await this.findOrCreateAssetCategory(tx, item.assetCategory)
          
          // 查找或创建地区
          const region = await this.findOrCreateRegion(tx, item.region)
          
          // 查找或创建证券
          const security = await this.findOrCreateSecurity(tx, item.security, category.id, region.id, item.region)
          
          // 查找账户
          let account = await this.findAccountByName(tx, item.sourceAccount)
          if (!account) {
            // 如果找不到账户，尝试创建一个默认账户
            this.warnings.push(`未找到账户: ${item.sourceAccount}，将创建默认账户`)
            const broker = await this.findOrCreateBroker(tx, item.sourceAccount || '默认券商')
            account = await this.findOrCreateAccount(tx, broker.id, item.sourceAccount || '默认账户', 'CNY')
          }

          // 创建或更新持仓
          const holdingData = {
            userId: this.userId,
            accountId: account.id,
            securityId: security.id,
            quantity: 1,
            averageCost: safeNumber(item.valueOriginal),
            currentPrice: safeNumber(item.valueOriginal),
            marketValueOriginal: safeNumber(item.valueOriginal),
            marketValueCny: safeNumber(item.valueCny),
            unrealizedPnl: 0,
            unrealizedPnlPercent: 0,
            costBasis: safeNumber(item.valueOriginal),
            lastUpdated: new Date(item.date || new Date())
          }

          const existing = await tx.holding.findFirst({
            where: {
              userId: this.userId,
              accountId: account.id,
              securityId: security.id
            }
          })

          if (existing) {
            await tx.holding.update({
              where: { id: existing.id },
              data: holdingData
            })
            updated++
          } else {
            await tx.holding.create({
              data: holdingData
            })
            created++
          }
        })
      } catch (error) {
        errors++
        console.error(`持仓数据导入失败 (${item.security}):`, error)
        this.errors.push(`持仓数据导入失败 (${item.security}): ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return { created, updated, errors }
  }

  /**
   * 安全导入投资计划
   */
  private async importInvestmentPlansSafely(data: any[]): Promise<{ created: number; updated: number; errors: number }> {
    let created = 0
    let updated = 0
    let errors = 0

    for (const item of data) {
      try {
        await prisma.$transaction(async (tx: any) => {
          const planData = {
            userId: this.userId,
            planDate: new Date(item.date || new Date()),
            totalPortfolioValue: safeNumber(item.targetAmount), // 将目标金额映射到总盘子
            availableCash: 0, // 默认值
            investmentRatio: 0.8, // 默认80%投资比例
            plannedInvestmentAmount: safeNumber(item.targetAmount) * 0.8, // 计划投资额
            sp500Allocation: 0,
            goldAllocation: 0,
            japanAllocation: 0,
            chinaAllocation: 0,
            cashReserve: safeNumber(item.targetAmount) * 0.2, // 20%现金储备
            notes: `计划名称: ${item.planName || ''}, 当前进度: ${item.currentProgress || ''}, 预期收益率: ${item.expectedReturn || ''}, 风险等级: ${item.riskLevel || ''}, 执行状态: ${item.executionStatus || ''}`
          }

          const existing = await tx.investmentPlan.findFirst({
            where: {
              userId: this.userId,
              planDate: planData.planDate
            }
          })

          if (existing) {
            await tx.investmentPlan.update({
              where: { id: existing.id },
              data: planData
            })
            updated++
          } else {
            await tx.investmentPlan.create({
              data: planData
            })
            created++
          }
        })
      } catch (error) {
        errors++
        console.error(`投资计划导入失败:`, error)
        this.errors.push(`投资计划导入失败: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return { created, updated, errors }
  }

  /**
   * 安全导入市场数据
   */
  private async importMarketDetailsSafely(data: any[]): Promise<{ created: number; updated: number; errors: number }> {
    let created = 0
    let updated = 0
    let errors = 0

    for (const item of data) {
      try {
        await prisma.$transaction(async (tx: any) => {
          // 查找或创建市场指数
          const index = await this.findOrCreateMarketIndex(tx, item.indexName, item.code, item.type)

          const marketData = {
            indexId: index.id,
            dataDate: new Date(),
            currentLevel: safeNumber(item.currentLevel),
            peRatio: safeNumber(item.peRatio),
            historicalPeMedian: safeNumber(item.historicalPeMedian),
            valuationPercentile: safeNumber(item.valuationPercentile),
            valuationStatus: this.mapValuationStatus(item.status),
            signalWeight: safeNumber(item.signalWeight, 1)
          }

          const existing = await tx.marketData.findFirst({
            where: {
              indexId: index.id,
              dataDate: marketData.dataDate
            }
          })

          if (existing) {
            await tx.marketData.update({
              where: { id: existing.id },
              data: marketData
            })
            updated++
          } else {
            await tx.marketData.create({
              data: marketData
            })
            created++
          }
        })
      } catch (error) {
        errors++
        console.error(`市场数据导入失败 (${item.indexName}):`, error)
        this.errors.push(`市场数据导入失败 (${item.indexName}): ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return { created, updated, errors }
  }

  /**
   * 安全导入策略输出
   */
  private async importStrategyOutputsSafely(data: any[]): Promise<{ created: number; updated: number; errors: number }> {
    let created = 0
    let updated = 0
    let errors = 0

    for (const item of data) {
      try {
        await prisma.$transaction(async (tx: any) => {
          const strategyData = {
            userId: this.userId,
            assetCategory: item.assetCategory,
            currentValue: safeNumber(item.currentValue),
            currentRatio: safeNumber(item.currentRatio),
            targetRatio: safeNumber(item.targetRatio),
            deviation: safeNumber(item.deviation),
            recommendedAction: item.recommendedAction,
            notes: item.notes || null,
            snapshotDate: new Date()
          }

          const existing = await tx.assetAllocationStrategy.findFirst({
            where: {
              userId: this.userId,
              assetCategory: item.assetCategory,
              snapshotDate: strategyData.snapshotDate
            }
          })

          if (existing) {
            await tx.assetAllocationStrategy.update({
              where: { id: existing.id },
              data: strategyData
            })
            updated++
          } else {
            await tx.assetAllocationStrategy.create({
              data: strategyData
            })
            created++
          }
        })
      } catch (error) {
        errors++
        console.error(`策略数据导入失败 (${item.assetCategory}):`, error)
        this.errors.push(`策略数据导入失败 (${item.assetCategory}): ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return { created, updated, errors }
  }

  /**
   * 导入账户余额数据（原版本，保留用于事务内调用）
   */
  private async importAccountBalances(tx: any, data: any[]): Promise<{ created: number; updated: number; errors: number }> {
    let created = 0
    let updated = 0
    let errors = 0

    for (const item of data) {
      try {
        // 查找或创建券商
        const broker = await this.findOrCreateBroker(tx, item.accountName)
        
        // 查找或创建投资账户
        const account = await this.findOrCreateAccount(tx, broker.id, item.accountName, item.currency)

        // 创建或更新账户余额快照
        const balanceData = {
          userId: this.userId,
          accountId: account.id,
          snapshotDate: new Date(item.date || new Date()), // 确保有默认日期
          cashBalanceOriginal: safeNumber(item.cashBalanceOriginal),
          cashBalanceCny: safeNumber(item.currentValueCny) - safeNumber(item.currentValueOriginal) + safeNumber(item.cashBalanceOriginal),
          totalMarketValueOriginal: safeNumber(item.currentValueOriginal),
          totalMarketValueCny: safeNumber(item.currentValueCny),
          investableRatio: safeNumber(item.investableRatio, 1.0),
          investableAmountCny: safeNumber(item.investableAmountCny),
          totalPortfolioRatio: safeNumber(item.totalRatio),
          exchangeRate: safeNumber(item.exchangeRate, 1),
          notes: item.notes || null
        }

        const existing = await tx.accountBalance.findFirst({
          where: {
            userId: this.userId,
            accountId: account.id,
            snapshotDate: balanceData.snapshotDate
          }
        })

        if (existing) {
          await tx.accountBalance.update({
            where: { id: existing.id },
            data: balanceData
          })
          updated++
        } else {
          await tx.accountBalance.create({
            data: balanceData
          })
          created++
        }

      } catch (error) {
        errors++
        console.error(`账户余额导入失败 (${item.accountName}):`, error)
        this.errors.push(`账户余额导入失败 (${item.accountName}): ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return { created, updated, errors }
  }

  /**
   * 导入资产明细（持仓数据）（原版本，保留用于事务内调用）
   */
  private async importAssetDetails(tx: any, data: any[]): Promise<{ created: number; updated: number; errors: number }> {
    let created = 0
    let updated = 0
    let errors = 0

    for (const item of data) {
      try {
        // 跳过现金类资产
        if (item.security === '现金余额' || item.assetCategory === '现金') {
          continue
        }

        // 查找或创建资产类别
        const category = await this.findOrCreateAssetCategory(tx, item.assetCategory)
        
        // 查找或创建地区
        const region = await this.findOrCreateRegion(tx, item.region)
        
        // 查找或创建证券
        const security = await this.findOrCreateSecurity(tx, item.security, category.id, region.id, item.region)
        
        // 查找账户 - 改进查找逻辑
        let account = await this.findAccountByName(tx, item.sourceAccount)
        if (!account) {
          // 如果找不到账户，尝试创建一个默认账户
          this.warnings.push(`未找到账户: ${item.sourceAccount}，将创建默认账户`)
          const broker = await this.findOrCreateBroker(tx, item.sourceAccount || '默认券商')
          account = await this.findOrCreateAccount(tx, broker.id, item.sourceAccount || '默认账户', 'CNY')
        }

        // 创建或更新持仓
        const holdingData = {
          userId: this.userId,
          accountId: account.id,
          securityId: security.id,
          quantity: 1, // Excel中没有数量信息，暂时设为1
          averageCost: safeNumber(item.valueOriginal),
          currentPrice: safeNumber(item.valueOriginal),
          marketValueOriginal: safeNumber(item.valueOriginal),
          marketValueCny: safeNumber(item.valueCny),
          unrealizedPnl: 0, // 需要后续计算
          unrealizedPnlPercent: 0,
          costBasis: safeNumber(item.valueOriginal),
          lastUpdated: new Date(item.date || new Date())
        }

        const existing = await tx.holding.findFirst({
          where: {
            userId: this.userId,
            accountId: account.id,
            securityId: security.id
          }
        })

        if (existing) {
          await tx.holding.update({
            where: { id: existing.id },
            data: holdingData
          })
          updated++
        } else {
          await tx.holding.create({
            data: holdingData
          })
          created++
        }

      } catch (error) {
        errors++
        console.error(`持仓数据导入失败 (${item.security}):`, error)
        this.errors.push(`持仓数据导入失败 (${item.security}): ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return { created, updated, errors }
  }

  /**
   * 导入投资计划（原版本，保留用于事务内调用）
   */
  private async importInvestmentPlans(tx: any, data: any[]): Promise<{ created: number; updated: number; errors: number }> {
    let created = 0
    let updated = 0
    let errors = 0

    for (const item of data) {
      try {
        const planData = {
          userId: this.userId,
          planDate: new Date(item.date || new Date()),
          totalPortfolioValue: safeNumber(item.totalPortfolio),
          availableCash: safeNumber(item.availableCash),
          investmentRatio: safeNumber(item.investmentRatio),
          plannedInvestmentAmount: safeNumber(item.plannedInvestment),
          sp500Allocation: safeNumber(item.sp500Allocation),
          goldAllocation: safeNumber(item.goldAllocation),
          japanAllocation: safeNumber(item.japanAllocation),
          chinaAllocation: safeNumber(item.chinaAllocation),
          cashReserve: safeNumber(item.cashReserve)
        }

        const existing = await tx.investmentPlan.findFirst({
          where: {
            userId: this.userId,
            planDate: planData.planDate
          }
        })

        if (existing) {
          await tx.investmentPlan.update({
            where: { id: existing.id },
            data: planData
          })
          updated++
        } else {
          await tx.investmentPlan.create({
            data: planData
          })
          created++
        }

      } catch (error) {
        errors++
        console.error(`投资计划导入失败:`, error)
        this.errors.push(`投资计划导入失败: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return { created, updated, errors }
  }

  /**
   * 导入市场数据（原版本，保留用于事务内调用）
   */
  private async importMarketDetails(tx: any, data: any[]): Promise<{ created: number; updated: number; errors: number }> {
    let created = 0
    let updated = 0
    let errors = 0

    for (const item of data) {
      try {
        // 查找或创建市场指数
        const index = await this.findOrCreateMarketIndex(tx, item.indexName, item.code, item.type)

        const marketData = {
          indexId: index.id,
          dataDate: new Date(),
          currentLevel: safeNumber(item.currentLevel),
          peRatio: safeNumber(item.peRatio),
          historicalPeMedian: safeNumber(item.historicalPeMedian),
          valuationPercentile: safeNumber(item.valuationPercentile),
          valuationStatus: this.mapValuationStatus(item.status),
          signalWeight: safeNumber(item.signalWeight, 1)
        }

        const existing = await tx.marketData.findFirst({
          where: {
            indexId: index.id,
            dataDate: marketData.dataDate
          }
        })

        if (existing) {
          await tx.marketData.update({
            where: { id: existing.id },
            data: marketData
          })
          updated++
        } else {
          await tx.marketData.create({
            data: marketData
          })
          created++
        }

      } catch (error) {
        errors++
        this.errors.push(`市场数据导入失败 (${item.indexName}): ${error}`)
      }
    }

    return { created, updated, errors }
  }

  /**
   * 导入策略输出（原版本，保留用于事务内调用）
   */
  private async importStrategyOutputs(tx: any, data: any[]): Promise<{ created: number; updated: number; errors: number }> {
    let created = 0
    let updated = 0
    let errors = 0

    for (const item of data) {
      try {
        const strategyData = {
          userId: this.userId,
          assetCategory: item.assetCategory,
          currentValue: safeNumber(item.currentValue),
          currentRatio: safeNumber(item.currentRatio),
          targetRatio: safeNumber(item.targetRatio),
          deviation: safeNumber(item.deviation),
          recommendedAction: item.recommendedAction,
          notes: item.notes || null,
          snapshotDate: new Date()
        }

        const existing = await tx.assetAllocationStrategy.findFirst({
          where: {
            userId: this.userId,
            assetCategory: item.assetCategory,
            snapshotDate: strategyData.snapshotDate
          }
        })

        if (existing) {
          await tx.assetAllocationStrategy.update({
            where: { id: existing.id },
            data: strategyData
          })
          updated++
        } else {
          await tx.assetAllocationStrategy.create({
            data: strategyData
          })
          created++
        }

      } catch (error) {
        errors++
        this.errors.push(`策略数据导入失败 (${item.assetCategory}): ${error}`)
      }
    }

    return { created, updated, errors }
  }

  // 辅助方法：查找券商（不创建，因为已经预创建了）
  private async findOrCreateBroker(tx: any, accountName: string) {
    const brokerName = this.extractBrokerName(accountName)
    console.log(`正在查找券商: "${brokerName}" (从账户名: "${accountName}")`)
    
    try {
      // 直接查找，因为已经在预创建阶段创建了
      const broker = await tx.broker.findFirst({
        where: { name: brokerName }
      })
      
      if (broker) {
        console.log(`找到券商: ${brokerName} (ID: ${broker.id})`)
        return broker
      }
      
      console.log(`未找到券商: ${brokerName}，尝试创建`)
      // 如果没找到，尝试在当前事务中创建（作为备用方案）
      const brokerCode = brokerName.toLowerCase().replace(/[^a-z0-9]/g, '')
      const created = await tx.broker.create({
        data: {
          name: brokerName,
          code: brokerCode,
          country: this.inferCountryFromBroker(brokerName)
        }
      })
      console.log(`备用创建券商成功: ${brokerName} (ID: ${created.id})`)
      return created
      
    } catch (error) {
      console.error(`查找券商失败 (${brokerName}):`, error)
      throw new Error(`无法查找券商: ${brokerName}`)
    }
  }

  // 辅助方法：查找或创建投资账户
  private async findOrCreateAccount(tx: any, brokerId: string, accountName: string, currency: string) {
    try {
      // 生成账户号码（如果没有的话）
      const accountNumber = accountName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      
      const account = await tx.investmentAccount.upsert({
        where: {
          userId_brokerId_accountNumber: {
            userId: this.userId,
            brokerId: brokerId,
            accountNumber: accountNumber
          }
        },
        update: {
          accountName: accountName,
          currency: currency || 'CNY'
        },
        create: {
          userId: this.userId,
          brokerId: brokerId,
          accountName: accountName,
          accountNumber: accountNumber,
          currency: currency || 'CNY',
          accountType: 'INVESTMENT'
        }
      })
      
      return account
    } catch (error) {
      console.error(`创建或查找投资账户失败 (${accountName}):`, error)
      
      // 如果upsert失败，尝试直接查找
      const existingAccount = await tx.investmentAccount.findFirst({
        where: {
          userId: this.userId,
          brokerId: brokerId,
          accountName: accountName
        }
      })
      
      if (existingAccount) {
        return existingAccount
      }
      
      throw new Error(`无法创建或查找投资账户: ${accountName}`)
    }
  }

  // 辅助方法：查找或创建资产类别（简化版）
  private async findOrCreateAssetCategory(tx: any, categoryName: string) {
    try {
      // 直接查找，因为已经预创建了
      const category = await tx.assetCategory.findFirst({
        where: { name: categoryName }
      })
      
      if (category) {
        return category
      }
      
      // 备用创建
      return await tx.assetCategory.create({
        data: {
          name: categoryName,
          nameEn: this.translateCategoryName(categoryName)
        }
      })
    } catch (error) {
      console.error(`查找资产类别失败 (${categoryName}):`, error)
      throw new Error(`无法查找资产类别: ${categoryName}`)
    }
  }

  // 辅助方法：查找或创建地区（简化版）
  private async findOrCreateRegion(tx: any, regionName: string) {
    try {
      // 直接查找，因为已经预创建了
      const region = await tx.region.findFirst({
        where: { name: regionName }
      })
      
      if (region) {
        return region
      }
      
      // 备用创建
      return await tx.region.create({
        data: {
          name: regionName,
          code: this.getRegionCode(regionName),
          currency: this.getRegionCurrency(regionName)
        }
      })
    } catch (error) {
      console.error(`查找地区失败 (${regionName}):`, error)
      throw new Error(`无法查找地区: ${regionName}`)
    }
  }

  // 辅助方法：查找或创建证券
  private async findOrCreateSecurity(tx: any, securityName: string, categoryId: string, regionId: string, regionName: string) {
    // 首先尝试按名称查找
    let security = await tx.security.findFirst({
      where: { 
        name: securityName,
        assetCategoryId: categoryId,
        regionId: regionId
      }
    })

    if (!security) {
      const exchange = this.inferExchange(securityName, regionName)
      let symbol = this.extractSymbol(securityName)
      
      // 检查symbol是否已存在，如果存在则生成新的
      let attempts = 0
      while (attempts < 5) {
        const existingBySymbol = await tx.security.findFirst({
          where: {
            symbol: symbol,
            exchange: exchange
          }
        })
        
        if (!existingBySymbol) {
          break
        }
        
        // 如果symbol已存在，生成新的
        symbol = this.extractSymbol(securityName)
        attempts++
      }
      
      security = await tx.security.create({
        data: {
          symbol: symbol,
          name: securityName,
          assetCategoryId: categoryId,
          regionId: regionId,
          exchange: exchange
        }
      })
    }

    return security
  }

  // 辅助方法：查找或创建市场指数（简化版）
  private async findOrCreateMarketIndex(tx: any, indexName: string, code: string, type: string) {
    try {
      // 直接查找，因为已经预创建了
      let index = await tx.marketIndex.findFirst({
        where: { 
          OR: [
            { name: indexName },
            { symbol: code }
          ]
        }
      })

      if (!index) {
        // 备用创建
        index = await tx.marketIndex.create({
          data: {
            name: indexName,
            symbol: code,
            indexType: type,
            dataSource: 'Excel导入'
          }
        })
      }

      return index
    } catch (error) {
      console.error(`查找市场指数失败 (${indexName}):`, error)
      throw new Error(`无法查找市场指数: ${indexName}`)
    }
  }

  // 辅助方法：根据账户名查找账户
  private async findAccountByName(tx: any, accountName: string) {
    // 首先尝试精确匹配
    let account = await tx.investmentAccount.findFirst({
      where: {
        userId: this.userId,
        accountName: accountName
      }
    })
    
    // 如果精确匹配失败，再尝试包含匹配
    if (!account) {
      account = await tx.investmentAccount.findFirst({
        where: {
          userId: this.userId,
          accountName: {
            contains: accountName
          }
        }
      })
    }
    
    return account
  }

  // 工具方法
  private extractBrokerName(accountName: string): string {
    if (accountName.includes('平安')) return '平安证券'
    if (accountName.includes('长桥')) return '长桥证券'
    if (accountName.includes('A股')) return '平安证券'
    if (accountName.includes('美股')) return '长桥证券'
    if (accountName.includes('港股')) return '长桥证券'
    return accountName
  }

  private inferCountryFromAccount(accountName: string): string {
    if (accountName.includes('美股')) return 'US'
    if (accountName.includes('港股')) return 'HK'
    return 'CN'
  }

  private inferCountryFromBroker(brokerName: string): string {
    if (brokerName.includes('长桥')) return 'HK'
    if (brokerName.includes('平安')) return 'CN'
    return 'CN'
  }

  private translateCategoryName(name: string): string {
    const translations: Record<string, string> = {
      '股票': 'Stock',
      'ETF': 'ETF',
      '贵金属': 'Precious Metal',
      '现金': 'Cash'
    }
    return translations[name] || name
  }

  private getRegionCode(regionName: string): string {
    const codes: Record<string, string> = {
      '中国': 'CN',
      '美国': 'US',
      '日本': 'JP',
      '香港': 'HK',
      '黄金': 'GOLD'
    }
    return codes[regionName] || regionName.substring(0, 2).toUpperCase()
  }

  private getRegionCurrency(regionName: string): string {
    const currencies: Record<string, string> = {
      '中国': 'CNY',
      '美国': 'USD',
      '日本': 'JPY',
      '香港': 'HKD',
      '黄金': 'USD'
    }
    return currencies[regionName] || 'CNY'
  }

  private extractSymbol(securityName: string): string {
    // 生成更唯一的symbol，避免冲突
    const cleanName = securityName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').substring(0, 10)
    const timestamp = Date.now().toString()
    const random = Math.random().toString(36).substring(2, 6)
    return `${cleanName}_${timestamp}_${random}`.substring(0, 20)
  }

  private inferExchange(securityName: string, regionName: string): string {
    if (securityName.includes('ETF') && regionName.includes('中国')) return 'SSE'
    if (regionName.includes('美国')) return 'NYSE'
    if (regionName.includes('香港')) return 'HKEX'
    if (regionName.includes('日本')) return 'TSE'
    return 'SSE'
  }

  private mapValuationStatus(status: string): string {
    if (status.includes('低估')) return 'LOW'
    if (status.includes('高估')) return 'HIGH'
    return 'FAIR'
  }

  private getEmptySummary() {
    return {
      accountBalances: { created: 0, updated: 0, errors: 0 },
      holdings: { created: 0, updated: 0, errors: 0 },
      transactions: { created: 0, updated: 0, errors: 0 },
      investmentPlans: { created: 0, updated: 0, errors: 0 },
      marketData: { created: 0, updated: 0, errors: 0 },
      strategies: { created: 0, updated: 0, errors: 0 }
    }
  }
}

/**
 * 便捷的导入函数
 */
export async function importExcelData(userId: string, parseResult: ExcelParseResult, options: { overwrite?: boolean } = {}): Promise<ImportResult> {
  const importService = new ImportService(userId)
  return await importService.importParsedData(parseResult, options)
}