import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 开始 QiJia 数据库种子数据初始化...')

  // ============================================================
  // 1. 创建用户
  // ============================================================
  const hashedPassword = await bcrypt.hash('admin123456', 12)
  const demoPassword = await bcrypt.hash('demo123456', 12)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: '张明',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })
  console.log('✅ 创建管理员用户:', adminUser.email)

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: '李华',
      password: demoPassword,
      role: 'USER',
    },
  })
  console.log('✅ 创建演示用户:', demoUser.email)

  // ============================================================
  // 2. 创建家庭
  // ============================================================
  const family = await prisma.family.upsert({
    where: { id: 'demo-family' },
    update: {},
    create: {
      id: 'demo-family',
      name: '齐家示范家庭',
      description: '这是一个包含完整资产配置的示范家庭，帮助您快速体验系统功能',
      createdBy: adminUser.id,
    },
  })
  console.log('✅ 创建家庭:', family.name)

  // 添加家庭成员
  await prisma.familyMember.upsert({
    where: { userId_familyId: { userId: adminUser.id, familyId: family.id } },
    update: {},
    create: {
      userId: adminUser.id,
      familyId: family.id,
      role: 'ADMIN',
      joinedAt: new Date(),
    },
  })

  await prisma.familyMember.upsert({
    where: { userId_familyId: { userId: demoUser.id, familyId: family.id } },
    update: {},
    create: {
      userId: demoUser.id,
      familyId: family.id,
      role: 'MEMBER',
      joinedAt: new Date(),
    },
  })
  console.log('✅ 添加家庭成员')

  // 家庭财务档案
  await prisma.familyFinancialProfile.upsert({
    where: { familyId: family.id },
    update: {},
    create: {
      familyId: family.id,
      householdMembers: 3,
      primaryEarnerAge: 35,
      childrenCount: 1,
      elderlyCount: 0,
      dependentsCount: 1,
      riskTolerance: 'MODERATE',
      investmentHorizon: 'LONG',
      emergencyFundMonths: 6,
    },
  })
  console.log('✅ 创建家庭财务档案')

  // ============================================================
  // 3. 创建地区
  // ============================================================
  const regionCN = await prisma.region.upsert({
    where: { code: 'CN' },
    update: {},
    create: { name: '中国大陆', code: 'CN', currency: 'CNY' },
  })
  const regionHK = await prisma.region.upsert({
    where: { code: 'HK' },
    update: {},
    create: { name: '中国香港', code: 'HK', currency: 'HKD' },
  })
  const regionUS = await prisma.region.upsert({
    where: { code: 'US' },
    update: {},
    create: { name: '美国', code: 'US', currency: 'USD' },
  })
  console.log('✅ 创建地区: CN, HK, US')

  // ============================================================
  // 4. 创建资产分类体系（两级）
  // ============================================================

  // --- 一级分类 ---
  const catEquity = await prisma.assetCategory.upsert({
    where: { code: 'EQUITY' },
    update: {},
    create: {
      name: '权益类', nameEn: 'Equity', code: 'EQUITY',
      level: 1, sortOrder: 1, color: '#ef4444', icon: 'TrendingUp',
      riskLevel: 'HIGH', liquidity: 'HIGH',
    },
  })
  const catCash = await prisma.assetCategory.upsert({
    where: { code: 'CASH' },
    update: {},
    create: {
      name: '现金等价物', nameEn: 'Cash Equivalent', code: 'CASH',
      level: 1, sortOrder: 2, color: '#22c55e', icon: 'Banknote',
      riskLevel: 'LOW', liquidity: 'HIGH',
    },
  })
  const catFixed = await prisma.assetCategory.upsert({
    where: { code: 'FIXED_INCOME' },
    update: {},
    create: {
      name: '固定收益', nameEn: 'Fixed Income', code: 'FIXED_INCOME',
      level: 1, sortOrder: 3, color: '#3b82f6', icon: 'Shield',
      riskLevel: 'LOW', liquidity: 'MEDIUM',
    },
  })
  const catAlt = await prisma.assetCategory.upsert({
    where: { code: 'ALTERNATIVE' },
    update: {},
    create: {
      name: '另类投资', nameEn: 'Alternative', code: 'ALTERNATIVE',
      level: 1, sortOrder: 4, color: '#f59e0b', icon: 'Gem',
      riskLevel: 'HIGH', liquidity: 'LOW',
    },
  })
  const catProperty = await prisma.assetCategory.upsert({
    where: { code: 'PROPERTY' },
    update: {},
    create: {
      name: '不动产', nameEn: 'Real Estate', code: 'PROPERTY',
      level: 1, sortOrder: 5, color: '#8b5cf6', icon: 'Home',
      riskLevel: 'MEDIUM', liquidity: 'LOW',
    },
  })

  // --- 二级分类 ---
  const catStockCN = await prisma.assetCategory.upsert({
    where: { code: 'EQUITY_STOCK_CN' },
    update: {},
    create: {
      name: 'A股股票', nameEn: 'A-Share Stock', code: 'EQUITY_STOCK_CN',
      level: 2, sortOrder: 1, parentId: catEquity.id, color: '#ef4444',
    },
  })
  const catStockHK = await prisma.assetCategory.upsert({
    where: { code: 'EQUITY_STOCK_HK' },
    update: {},
    create: {
      name: '港股', nameEn: 'HK Stock', code: 'EQUITY_STOCK_HK',
      level: 2, sortOrder: 2, parentId: catEquity.id, color: '#f97316',
    },
  })
  const catFundETF = await prisma.assetCategory.upsert({
    where: { code: 'EQUITY_ETF' },
    update: {},
    create: {
      name: 'ETF基金', nameEn: 'ETF', code: 'EQUITY_ETF',
      level: 2, sortOrder: 3, parentId: catEquity.id, color: '#fb923c',
    },
  })
  const catCashDeposit = await prisma.assetCategory.upsert({
    where: { code: 'CASH_DEPOSIT' },
    update: {},
    create: {
      name: '活期存款', nameEn: 'Demand Deposit', code: 'CASH_DEPOSIT',
      level: 2, sortOrder: 1, parentId: catCash.id, color: '#22c55e',
    },
  })
  const catCashFixed = await prisma.assetCategory.upsert({
    where: { code: 'CASH_FIXED' },
    update: {},
    create: {
      name: '定期存款', nameEn: 'Fixed Deposit', code: 'CASH_FIXED',
      level: 2, sortOrder: 2, parentId: catCash.id, color: '#16a34a',
    },
  })
  const catCashMoneyFund = await prisma.assetCategory.upsert({
    where: { code: 'CASH_MONEY_FUND' },
    update: {},
    create: {
      name: '货币基金', nameEn: 'Money Market Fund', code: 'CASH_MONEY_FUND',
      level: 2, sortOrder: 3, parentId: catCash.id, color: '#15803d',
    },
  })
  const catFixedBond = await prisma.assetCategory.upsert({
    where: { code: 'FIXED_BOND' },
    update: {},
    create: {
      name: '国债/债券', nameEn: 'Bond', code: 'FIXED_BOND',
      level: 2, sortOrder: 1, parentId: catFixed.id, color: '#3b82f6',
    },
  })
  const catFixedInsurance = await prisma.assetCategory.upsert({
    where: { code: 'FIXED_INSURANCE' },
    update: {},
    create: {
      name: '保险理财', nameEn: 'Insurance', code: 'FIXED_INSURANCE',
      level: 2, sortOrder: 2, parentId: catFixed.id, color: '#2563eb',
    },
  })
  const catAltGold = await prisma.assetCategory.upsert({
    where: { code: 'ALT_GOLD' },
    update: {},
    create: {
      name: '黄金', nameEn: 'Gold', code: 'ALT_GOLD',
      level: 2, sortOrder: 1, parentId: catAlt.id, color: '#f59e0b',
    },
  })
  console.log('✅ 创建资产分类体系（5个一级 + 9个二级）')

  // ============================================================
  // 5. 创建券商
  // ============================================================
  const brokerHTSC = await prisma.broker.upsert({
    where: { code: 'HTSC' },
    update: {},
    create: { name: '华泰证券', code: 'HTSC', country: 'CN', isActive: true },
  })
  const brokerFUTU = await prisma.broker.upsert({
    where: { code: 'FUTU' },
    update: {},
    create: { name: '富途证券', code: 'FUTU', country: 'HK', isActive: true },
  })
  const brokerICBC = await prisma.broker.upsert({
    where: { code: 'ICBC' },
    update: {},
    create: { name: '工商银行', code: 'ICBC', country: 'CN', isActive: true },
  })
  console.log('✅ 创建券商: HTSC, FUTU, ICBC')

  // ============================================================
  // 6. 创建投资账户
  // ============================================================
  const accountAShare = await prisma.investmentAccount.upsert({
    where: { userId_brokerId_accountNumber: { userId: adminUser.id, brokerId: brokerHTSC.id, accountNumber: 'A00001' } },
    update: {},
    create: {
      userId: adminUser.id,
      brokerId: brokerHTSC.id,
      accountName: 'A股证券账户',
      accountNumber: 'A00001',
      currency: 'CNY',
      accountType: 'INVESTMENT',
      cashBalance: 25600.00,
    },
  })
  const accountHK = await prisma.investmentAccount.upsert({
    where: { userId_brokerId_accountNumber: { userId: adminUser.id, brokerId: brokerFUTU.id, accountNumber: 'HK00001' } },
    update: {},
    create: {
      userId: adminUser.id,
      brokerId: brokerFUTU.id,
      accountName: '港股账户',
      accountNumber: 'HK00001',
      currency: 'HKD',
      accountType: 'INVESTMENT',
      cashBalance: 5000.00,
    },
  })
  const accountBank = await prisma.investmentAccount.upsert({
    where: { userId_brokerId_accountNumber: { userId: adminUser.id, brokerId: brokerICBC.id, accountNumber: 'BANK001' } },
    update: {},
    create: {
      userId: adminUser.id,
      brokerId: brokerICBC.id,
      accountName: '银行理财账户',
      accountNumber: 'BANK001',
      currency: 'CNY',
      accountType: 'BANK',
    },
  })
  console.log('✅ 创建投资账户: A股、港股、银行理财')

  // ============================================================
  // 7. 创建证券
  // ============================================================
  const secMaotai = await prisma.security.upsert({
    where: { symbol_exchange: { symbol: '600519', exchange: 'SSE' } },
    update: {},
    create: {
      symbol: '600519', name: '贵州茅台', nameEn: 'Kweichow Moutai',
      assetCategoryId: catStockCN.id, regionId: regionCN.id,
      exchange: 'SSE', sector: '食品饮料', industry: '白酒',
      underlyingType: 'CN_STOCK',
    },
  })
  const secCMB = await prisma.security.upsert({
    where: { symbol_exchange: { symbol: '600036', exchange: 'SSE' } },
    update: {},
    create: {
      symbol: '600036', name: '招商银行', nameEn: 'China Merchants Bank',
      assetCategoryId: catStockCN.id, regionId: regionCN.id,
      exchange: 'SSE', sector: '金融', industry: '银行',
      underlyingType: 'CN_STOCK',
    },
  })
  const secPingAn = await prisma.security.upsert({
    where: { symbol_exchange: { symbol: '601318', exchange: 'SSE' } },
    update: {},
    create: {
      symbol: '601318', name: '中国平安', nameEn: 'Ping An Insurance',
      assetCategoryId: catStockCN.id, regionId: regionCN.id,
      exchange: 'SSE', sector: '金融', industry: '保险',
      underlyingType: 'CN_STOCK',
    },
  })
  const secCSI300ETF = await prisma.security.upsert({
    where: { symbol_exchange: { symbol: '510300', exchange: 'SSE' } },
    update: {},
    create: {
      symbol: '510300', name: '沪深300ETF', nameEn: 'CSI 300 ETF',
      assetCategoryId: catFundETF.id, regionId: regionCN.id,
      exchange: 'SSE', sector: '指数基金',
      underlyingType: 'CN_ETF',
    },
  })
  const secTencent = await prisma.security.upsert({
    where: { symbol_exchange: { symbol: '00700', exchange: 'HKEX' } },
    update: {},
    create: {
      symbol: '00700', name: '腾讯控股', nameEn: 'Tencent Holdings',
      assetCategoryId: catStockHK.id, regionId: regionHK.id,
      exchange: 'HKEX', sector: '信息技术', industry: '互联网',
      underlyingType: 'HK_STOCK',
    },
  })
  const secMeituan = await prisma.security.upsert({
    where: { symbol_exchange: { symbol: '03690', exchange: 'HKEX' } },
    update: {},
    create: {
      symbol: '03690', name: '美团-W', nameEn: 'Meituan',
      assetCategoryId: catStockHK.id, regionId: regionHK.id,
      exchange: 'HKEX', sector: '消费', industry: '本地生活',
      underlyingType: 'HK_STOCK',
    },
  })
  console.log('✅ 创建证券: 茅台、招行、平安、300ETF、腾讯、美团')

  // ============================================================
  // 8. 创建持仓（A股 + 港股）
  // ============================================================
  const holdingsData = [
    { account: accountAShare, security: secMaotai, qty: 100, avgCost: 1680, curPrice: 1520, currency: 'CNY' },
    { account: accountAShare, security: secCMB, qty: 500, avgCost: 32.50, curPrice: 38.80, currency: 'CNY' },
    { account: accountAShare, security: secPingAn, qty: 300, avgCost: 42.00, curPrice: 48.50, currency: 'CNY' },
    { account: accountAShare, security: secCSI300ETF, qty: 2000, avgCost: 3.85, curPrice: 4.12, currency: 'CNY' },
    { account: accountHK, security: secTencent, qty: 200, avgCost: 320.00, curPrice: 395.00, currency: 'HKD' },
    { account: accountHK, security: secMeituan, qty: 300, avgCost: 108.00, curPrice: 145.00, currency: 'HKD' },
  ]

  for (const h of holdingsData) {
    const costBasis = h.qty * h.avgCost
    const marketValue = h.qty * h.curPrice
    const pnl = marketValue - costBasis
    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0

    await prisma.holding.upsert({
      where: { userId_accountId_securityId: { userId: adminUser.id, accountId: h.account.id, securityId: h.security.id } },
      update: { currentPrice: h.curPrice, marketValueOriginal: marketValue, unrealizedPnl: pnl, unrealizedPnlPercent: pnlPercent },
      create: {
        userId: adminUser.id,
        accountId: h.account.id,
        securityId: h.security.id,
        quantity: h.qty,
        averageCost: h.avgCost,
        currentPrice: h.curPrice,
        costBasis: costBasis,
        marketValueOriginal: marketValue,
        marketValueCny: marketValue,  // 简化处理，港股需乘汇率
        unrealizedPnl: pnl,
        unrealizedPnlPercent: pnlPercent,
      },
    })
  }
  console.log('✅ 创建持仓: 4只A股 + 2只港股')

  // ============================================================
  // 9. 创建现金/固收/另类资产
  // ============================================================

  // 活期存款
  await prisma.asset.create({
    data: {
      userId: adminUser.id,
      assetCategoryId: catCashDeposit.id,
      name: '工商银行活期',
      purchasePrice: 50000,
      currentValue: 50000,
      currency: 'CNY',
      underlyingType: 'CASH_DEPOSIT',
      metadata: { bankName: '工商银行', accountType: '活期' },
    },
  })

  // 货币基金
  await prisma.asset.create({
    data: {
      userId: adminUser.id,
      assetCategoryId: catCashMoneyFund.id,
      name: '余额宝',
      purchasePrice: 100000,
      currentValue: 100680,
      currency: 'CNY',
      unrealizedPnl: 680,
      unrealizedPnlPercent: 0.68,
      purchaseDate: new Date('2025-06-01'),
      underlyingType: 'CASH_MONEY_FUND',
      metadata: { yield7Day: 1.85, fundName: '天弘余额宝' },
    },
  })

  // 定期存款
  await prisma.asset.create({
    data: {
      userId: adminUser.id,
      assetCategoryId: catCashFixed.id,
      name: '大额存单 3年期',
      purchasePrice: 200000,
      currentValue: 206400,
      currency: 'CNY',
      unrealizedPnl: 6400,
      unrealizedPnlPercent: 3.20,
      purchaseDate: new Date('2024-01-15'),
      maturityDate: new Date('2027-01-15'),
      underlyingType: 'CASH_FIXED',
      metadata: { interestRate: 3.20, bankName: '工商银行', term: '3年' },
    },
  })

  // 国债
  await prisma.asset.create({
    data: {
      userId: adminUser.id,
      assetCategoryId: catFixedBond.id,
      name: '国债 2024年第3期',
      purchasePrice: 100000,
      currentValue: 102500,
      currency: 'CNY',
      unrealizedPnl: 2500,
      unrealizedPnlPercent: 2.50,
      purchaseDate: new Date('2024-06-01'),
      maturityDate: new Date('2027-06-01'),
      underlyingType: 'FIXED_BOND',
      metadata: { interestRate: 2.50, bondType: '储蓄国债', term: '3年' },
    },
  })

  // 保险理财
  await prisma.asset.create({
    data: {
      userId: adminUser.id,
      assetCategoryId: catFixedInsurance.id,
      name: '增额终身寿险',
      purchasePrice: 100000,
      currentValue: 103500,
      currency: 'CNY',
      unrealizedPnl: 3500,
      unrealizedPnlPercent: 3.50,
      purchaseDate: new Date('2023-03-01'),
      underlyingType: 'FIXED_INSURANCE',
      metadata: { insurerName: '中国人寿', productName: '鑫享未来', guaranteedRate: 3.50 },
    },
  })

  // 黄金
  await prisma.asset.create({
    data: {
      userId: adminUser.id,
      assetCategoryId: catAltGold.id,
      name: '实物黄金',
      quantity: 50,
      unitPrice: 580,
      purchasePrice: 27500,
      currentValue: 29000,
      currency: 'CNY',
      unrealizedPnl: 1500,
      unrealizedPnlPercent: 5.45,
      purchaseDate: new Date('2024-03-15'),
      underlyingType: 'ALT_GOLD',
      metadata: { goldType: '实物金条', unit: '克', purchasePricePerGram: 550, currentPricePerGram: 580 },
    },
  })

  console.log('✅ 创建资产: 活期存款、货币基金、定期存单、国债、保险、黄金')

  // ============================================================
  // 10. 创建负债
  // ============================================================
  await prisma.liability.create({
    data: {
      userId: adminUser.id,
      name: '住房贷款',
      type: 'MORTGAGE',
      principalAmount: 1500000,
      remainingAmount: 1280000,
      interestRate: 3.45,
      currency: 'CNY',
      startDate: new Date('2022-06-01'),
      endDate: new Date('2052-06-01'),
      monthlyPayment: 6680,
      status: 'ACTIVE',
      metadata: { bankName: '工商银行', loanType: '公积金+商贷组合', lpr: 3.45 },
    },
  })
  console.log('✅ 创建负债: 住房贷款')

  // ============================================================
  // 完成
  // ============================================================
  console.log('')
  console.log('🎉 QiJia 数据库种子数据初始化完成！')
  console.log('')
  console.log('📊 创建的数据:')
  console.log('- 2个用户 (admin@example.com / demo@example.com)')
  console.log('- 1个家庭 (齐家示范家庭) + 家庭财务档案')
  console.log('- 3个投资账户 (A股、港股、银行理财)')
  console.log('- 6只证券持仓 (茅台、招行、平安、300ETF、腾讯、美团)')
  console.log('- 6项现金/固收/另类资产')
  console.log('- 1项负债 (住房贷款)')
  console.log('')
  console.log('🚀 登录账户:')
  console.log('   管理员: admin@example.com / admin123456')
  console.log('   演示:   demo@example.com / demo123456')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ 种子数据初始化失败:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
