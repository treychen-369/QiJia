/**
 * 测试数据 Seed API
 * 
 * 仅在非生产环境可用。
 * POST /api/test/seed — 创建测试用户 + 完整业务数据
 * DELETE /api/test/seed — 清理测试数据
 * 
 * 创建的测试数据包含确定性的数值，用于验证所有计算公式。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// 安全检查：禁止生产环境使用
function isProductionGuard() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: '此接口仅在开发/测试环境可用' },
      { status: 403 }
    );
  }
  return null;
}

const TEST_USER_EMAIL = 'e2e-test-user@finance.test';
const TEST_USER_EMAIL_2 = 'e2e-test-user2@finance.test';
const TEST_FAMILY_NAME = 'E2E测试家庭';

export async function POST(request: NextRequest) {
  const guard = isProductionGuard();
  if (guard) return guard;

  try {
    // 先清理旧数据（幂等）
    await cleanupTestData();

    // 查找基础数据（券商、证券、资产分类）
    const broker = await prisma.broker.findFirst({ where: { isActive: true } });
    if (!broker) {
      return NextResponse.json({ error: '没有可用的券商数据，请先运行 seed 脚本' }, { status: 400 });
    }

    // 查找 CNY 证券（A股）和 USD 证券（美股）
    const cnySecurity = await prisma.security.findFirst({
      where: { 
        region: { currency: 'CNY' },
        isActive: true 
      },
      include: { region: true }
    });
    const usdSecurity = await prisma.security.findFirst({
      where: { 
        region: { currency: 'USD' },
        isActive: true 
      },
      include: { region: true }
    });

    if (!cnySecurity) {
      return NextResponse.json({ error: '没有可用的 CNY 证券数据' }, { status: 400 });
    }

    // 查找资产分类
    const cashCategory = await prisma.assetCategory.findFirst({
      where: { code: { startsWith: 'CASH' } }
    });
    const otherCategory = await prisma.assetCategory.findFirst({
      where: { code: { startsWith: 'RE' } }
    });
    // fallback: 用任意分类
    const anyCategory = cashCategory || otherCategory || await prisma.assetCategory.findFirst();

    if (!anyCategory) {
      return NextResponse.json({ error: '没有可用的资产分类数据' }, { status: 400 });
    }

    // 预先计算密码哈希（耗时操作不放在事务内）
    const hashedPassword = await bcrypt.hash('test123456', 12);

    // 如果有 USD 证券，查找美股券商
    let usBroker = broker;
    if (usdSecurity) {
      usBroker = await prisma.broker.findFirst({ where: { country: 'US', isActive: true } }) || broker;
    }

    // ========== 事务创建完整测试数据（纯写操作，减少事务内耗时） ==========
    const result = await prisma.$transaction(async (tx) => {

      // --- 用户1：主用户，有完整数据 ---
      const user1 = await tx.user.create({
        data: {
          name: 'E2E测试用户',
          email: TEST_USER_EMAIL,
          password: hashedPassword,
          role: 'USER',
        }
      });

      // --- 用户2：家庭成员 ---
      const user2 = await tx.user.create({
        data: {
          name: 'E2E测试成员',
          email: TEST_USER_EMAIL_2,
          password: hashedPassword,
          role: 'USER',
        }
      });

      // --- 创建家庭 ---
      const family = await tx.family.create({
        data: {
          name: TEST_FAMILY_NAME,
          createdBy: user1.id,
        }
      });

      // --- 家庭成员关系 ---
      await tx.familyMember.create({
        data: { userId: user1.id, familyId: family.id, role: 'ADMIN' }
      });
      await tx.familyMember.create({
        data: { userId: user2.id, familyId: family.id, role: 'MEMBER' }
      });

      // --- 用户1：CNY 投资账户 ---
      const account1 = await tx.investmentAccount.create({
        data: {
          userId: user1.id,
          brokerId: broker.id,
          accountName: 'E2E测试-A股账户',
          accountNumber: 'E2E-CNY-001',
          currency: 'CNY',
          accountType: 'INVESTMENT',
          cashBalance: 50000,
          cashBalanceCny: 50000,
          cashExchangeRate: 1,
          cashLastUpdated: new Date(),
        }
      });

      // --- 用户1：USD 投资账户（如果有美股证券） ---
      let account2: any = null;
      if (usdSecurity) {
        account2 = await tx.investmentAccount.create({
          data: {
            userId: user1.id,
            brokerId: usBroker.id,
            accountName: 'E2E测试-美股账户',
            accountNumber: 'E2E-USD-001',
            currency: 'USD',
            accountType: 'INVESTMENT',
            cashBalance: 5000,
            cashBalanceCny: 5000 * 7.25,  // 假设汇率 7.25
            cashExchangeRate: 7.25,
            cashLastUpdated: new Date(),
          }
        });
      }

      // --- 用户1：CNY 持仓 ---
      // 确定性数据：100股，成本18.50，现价22.00
      const holding1 = await tx.holding.create({
        data: {
          userId: user1.id,
          accountId: account1.id,
          securityId: cnySecurity.id,
          quantity: 100,
          averageCost: 18.50,
          currentPrice: 22.00,
          // 计算字段（服务层会实时重算，这里写入方便直接查询验证）
          costBasis: 100 * 18.50,           // 1850
          marketValueOriginal: 100 * 22.00, // 2200
          marketValueCny: 100 * 22.00,      // 2200（CNY，汇率1）
          unrealizedPnl: 100 * 22.00 - 100 * 18.50,  // 350
          unrealizedPnlPercent: ((22.00 - 18.50) / 18.50) * 100, // 18.9189%
        }
      });

      // --- 用户1：USD 持仓（如果有） ---
      let holding2: any = null;
      if (usdSecurity && account2) {
        // 50股，成本150.00 USD，现价180.00 USD
        holding2 = await tx.holding.create({
          data: {
            userId: user1.id,
            accountId: account2.id,
            securityId: usdSecurity.id,
            quantity: 50,
            averageCost: 150.00,
            currentPrice: 180.00,
            costBasis: 50 * 150.00,           // 7500 USD
            marketValueOriginal: 50 * 180.00, // 9000 USD
            marketValueCny: 50 * 180.00 * 7.25, // 65250 CNY
            unrealizedPnl: 50 * 180.00 - 50 * 150.00,  // 1500 USD
            unrealizedPnlPercent: ((180.00 - 150.00) / 150.00) * 100, // 20%
          }
        });
      }

      // --- 用户1：现金资产（存款） ---
      const asset1 = await tx.asset.create({
        data: {
          userId: user1.id,
          name: 'E2E测试-银行存款',
          assetCategoryId: cashCategory?.id || anyCategory.id,
          currency: 'CNY',
          purchasePrice: 100000,
          currentValue: 100000,
          originalValue: 100000,
          metadata: { type: '活期存款', bankName: '测试银行' },
        }
      });

      // --- 用户1：其他资产（不动产） ---
      const asset2 = await tx.asset.create({
        data: {
          userId: user1.id,
          name: 'E2E测试-房产',
          assetCategoryId: otherCategory?.id || anyCategory.id,
          currency: 'CNY',
          purchasePrice: 2000000,
          currentValue: 2500000,
          originalValue: 2000000,
          metadata: { type: '住宅', location: '上海' },
        }
      });

      // --- 用户1：负债 ---
      const liability1 = await tx.liability.create({
        data: {
          userId: user1.id,
          name: 'E2E测试-房贷',
          type: 'MORTGAGE',
          principalAmount: 1500000,
          currentBalance: 1200000,
          interestRate: 3.85,
          monthlyPayment: 8500,
          currency: 'CNY',
          startDate: new Date('2020-01-01'),
          maturityDate: new Date('2050-01-01'),
        }
      });

      const liability2 = await tx.liability.create({
        data: {
          userId: user1.id,
          name: 'E2E测试-信用卡',
          type: 'CREDIT_CARD',
          principalAmount: 50000,
          currentBalance: 15000,
          interestRate: 0,
          currency: 'CNY',
        }
      });

      // --- 用户2（家庭成员）：也有一些数据 ---
      const account3 = await tx.investmentAccount.create({
        data: {
          userId: user2.id,
          brokerId: broker.id,
          accountName: 'E2E测试-成员账户',
          accountNumber: 'E2E-CNY-002',
          currency: 'CNY',
          accountType: 'INVESTMENT',
          cashBalance: 30000,
          cashBalanceCny: 30000,
          cashExchangeRate: 1,
          cashLastUpdated: new Date(),
        }
      });

      const holding3 = await tx.holding.create({
        data: {
          userId: user2.id,
          accountId: account3.id,
          securityId: cnySecurity.id,
          quantity: 200,
          averageCost: 19.00,
          currentPrice: 22.00,
          costBasis: 200 * 19.00,
          marketValueOriginal: 200 * 22.00,
          marketValueCny: 200 * 22.00,
          unrealizedPnl: 200 * 22.00 - 200 * 19.00,
          unrealizedPnlPercent: ((22.00 - 19.00) / 19.00) * 100,
        }
      });

      const asset3 = await tx.asset.create({
        data: {
          userId: user2.id,
          name: 'E2E测试-成员存款',
          assetCategoryId: cashCategory?.id || anyCategory.id,
          currency: 'CNY',
          purchasePrice: 50000,
          currentValue: 50000,
          originalValue: 50000,
        }
      });

      // --- 用户1：AccountBalance 快照（用于现金余额计算） ---
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      await tx.accountBalance.create({
        data: {
          userId: user1.id,
          accountId: account1.id,
          snapshotDate: today,
          cashBalanceOriginal: 50000,
          cashBalanceCny: 50000,
          totalMarketValueOriginal: 2200,
          totalMarketValueCny: 2200,
          exchangeRate: 1,
        }
      });

      if (account2) {
        await tx.accountBalance.create({
          data: {
            userId: user1.id,
            accountId: account2.id,
            snapshotDate: today,
            cashBalanceOriginal: 5000,
            cashBalanceCny: 5000 * 7.25,
            totalMarketValueOriginal: 9000,
            totalMarketValueCny: 9000 * 7.25,
            exchangeRate: 7.25,
          }
        });
      }

      // --- 用户1：PortfolioHistory 快照（用于趋势测试） ---
      const daysAgo7 = new Date(today);
      daysAgo7.setDate(daysAgo7.getDate() - 7);
      const daysAgo3 = new Date(today);
      daysAgo3.setDate(daysAgo3.getDate() - 3);

      await tx.portfolioHistory.create({
        data: {
          userId: user1.id,
          snapshotDate: daysAgo7,
          totalValueCny: 2600000,
          cashBalanceCny: 50000,
          investedAmountCny: 50000,
          totalAssets: 2600000,
          totalLiabilities: 1215000,
          netWorth: 1385000,
          totalOtherAssets: 2500000,
          totalCashAssets: 50000,
          equityAssets: 50000,
        }
      });
      await tx.portfolioHistory.create({
        data: {
          userId: user1.id,
          snapshotDate: daysAgo3,
          totalValueCny: 2610000,
          cashBalanceCny: 50000,
          investedAmountCny: 51000,
          totalAssets: 2610000,
          totalLiabilities: 1215000,
          netWorth: 1395000,
          totalOtherAssets: 2500000,
          totalCashAssets: 50000,
          equityAssets: 51000,
        }
      });
      await tx.portfolioHistory.create({
        data: {
          userId: user1.id,
          snapshotDate: today,
          totalValueCny: 2650000,
          cashBalanceCny: 50000,
          investedAmountCny: 52200,
          totalAssets: 2650000,
          totalLiabilities: 1215000,
          netWorth: 1435000,
          totalOtherAssets: 2500000,
          totalCashAssets: 50000,
          equityAssets: 52200,
        }
      });

      return {
        user1: { id: user1.id, email: user1.email, name: user1.name },
        user2: { id: user2.id, email: user2.email, name: user2.name },
        family: { id: family.id, name: family.name },
        accounts: {
          cny: { id: account1.id, name: account1.accountName, currency: 'CNY' },
          usd: account2 ? { id: account2.id, name: account2.accountName, currency: 'USD' } : null,
          member: { id: account3.id, name: account3.accountName, currency: 'CNY' },
        },
        holdings: {
          cny: { 
            id: holding1.id,
            security: cnySecurity.name,
            symbol: cnySecurity.symbol,
            quantity: 100, averageCost: 18.50, currentPrice: 22.00,
            costBasis: 1850, marketValue: 2200, unrealizedPnl: 350,
            unrealizedPnlPercent: 18.9189,
          },
          usd: holding2 ? {
            id: holding2.id,
            security: usdSecurity!.name,
            symbol: usdSecurity!.symbol,
            quantity: 50, averageCost: 150.00, currentPrice: 180.00,
            costBasis: 7500, marketValue: 9000, unrealizedPnl: 1500,
            unrealizedPnlPercent: 20.0,
          } : null,
          member: {
            id: holding3.id,
            security: cnySecurity.name,
            quantity: 200, averageCost: 19.00, currentPrice: 22.00,
            costBasis: 3800, marketValue: 4400, unrealizedPnl: 600,
            unrealizedPnlPercent: 15.7895,
          },
        },
        assets: {
          deposit: { id: asset1.id, name: asset1.name, value: 100000 },
          property: { id: asset2.id, name: asset2.name, value: 2500000 },
          memberDeposit: { id: asset3.id, name: asset3.name, value: 50000 },
        },
        liabilities: {
          mortgage: { id: liability1.id, name: liability1.name, balance: 1200000 },
          creditCard: { id: liability2.id, name: liability2.name, balance: 15000 },
        },
        // 预计算的期望值（供测试断言使用）
        expected: {
          user1: {
            totalLiabilities: 1215000,
            // 注意：totalAssets 和 netWorth 由服务层实时计算，
            // 受汇率影响，这里提供 CNY-only 的基准值
            cnyHoldingsValue: 2200,
            cashInAccounts: 50000, // CNY 账户现金
          },
          user2: {
            holdingsValue: 4400,
            cashInAccounts: 30000,
          },
        },
      };
    }, { timeout: 60000 });

    return NextResponse.json({
      success: true,
      message: 'E2E 测试数据已创建',
      data: result,
    }, { status: 201 });

  } catch (error: any) {
    console.error('创建测试数据失败:', error);
    return NextResponse.json(
      { error: '创建测试数据失败', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const guard = isProductionGuard();
  if (guard) return guard;

  try {
    await cleanupTestData();
    return NextResponse.json({ success: true, message: '测试数据已清理' });
  } catch (error: any) {
    console.error('清理测试数据失败:', error);
    return NextResponse.json(
      { error: '清理测试数据失败', details: error.message },
      { status: 500 }
    );
  }
}

async function cleanupTestData() {
  const testUsers = await prisma.user.findMany({
    where: {
      email: { in: [TEST_USER_EMAIL, TEST_USER_EMAIL_2] }
    },
    select: { id: true }
  });

  if (testUsers.length === 0) return;

  const userIds = testUsers.map(u => u.id);

  // 按依赖顺序删除（先子后父）
  await prisma.portfolioHistory.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.accountBalance.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.holding.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.asset.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.liability.deleteMany({ where: { userId: { in: userIds } } });

  // 删除投资账户
  await prisma.investmentAccount.deleteMany({ where: { userId: { in: userIds } } });

  // 删除家庭关系
  await prisma.familyMember.deleteMany({ where: { userId: { in: userIds } } });
  
  // 删除测试家庭
  await prisma.family.deleteMany({ where: { name: TEST_FAMILY_NAME } });

  // 删除用户（CASCADE 会清理 Session/Account）
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
