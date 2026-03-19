/**
 * 导出当前数据库中的持仓数据
 * 用于对比前端显示的真实数据
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function exportData() {
  console.log('📊 正在导出数据库数据...\n');

  try {
    // 1. 获取所有投资账户
    const accounts = await prisma.investmentAccount.findMany({
      include: {
        broker: true,
      },
      orderBy: { accountName: 'asc' },
    });

    console.log('📁 投资账户:');
    accounts.forEach(acc => {
      console.log(`  - ${acc.accountName} (${acc.broker.name}) [${acc.currency}]`);
    });
    console.log('');

    // 2. 获取所有持仓
    const holdings = await prisma.holding.findMany({
      include: {
        security: {
          include: {
            assetCategory: true,
            region: true,
          },
        },
        account: {
          include: {
            broker: true,
          },
        },
      },
      orderBy: { marketValueCny: 'desc' },
    });

    console.log('📈 持仓明细:');
    holdings.forEach(h => {
      console.log(`  ${h.security.name} (${h.security.symbol})`);
      console.log(`    账户: ${h.account.accountName}`);
      console.log(`    持仓: ${h.quantity}`);
      console.log(`    成本: ${h.averageCost}`);
      console.log(`    现价: ${h.currentPrice}`);
      console.log(`    市值: ${h.marketValueCny} CNY (${h.marketValueOriginal} ${h.account.currency})`);
      console.log(`    盈亏: ${h.unrealizedPnl} (${h.unrealizedPnlPercent}%)`);
      console.log('');
    });

    // 3. 获取最新账户余额
    const balances = await prisma.accountBalance.findMany({
      include: {
        account: {
          include: {
            broker: true,
          },
        },
      },
      orderBy: { snapshotDate: 'desc' },
    });

    // 按账户分组取最新
    const latestBalances = balances.reduce((acc, balance) => {
      const accountId = balance.accountId;
      if (!acc[accountId] || balance.snapshotDate > acc[accountId].snapshotDate) {
        acc[accountId] = balance;
      }
      return acc;
    }, {});

    console.log('💰 账户余额 (最新快照):');
    Object.values(latestBalances).forEach(b => {
      console.log(`  ${b.account.accountName}:`);
      console.log(`    快照日期: ${b.snapshotDate}`);
      console.log(`    现金: ${b.cashBalanceCny} CNY (${b.cashBalanceOriginal} ${b.account.currency})`);
      console.log(`    总市值: ${b.totalMarketValueCny} CNY`);
      console.log('');
    });

    // 4. 导出为JSON文件
    const exportData = {
      exportTime: new Date().toISOString(),
      accounts: accounts.map(acc => ({
        id: acc.id,
        name: acc.accountName,
        broker: acc.broker.name,
        currency: acc.currency,
      })),
      holdings: holdings.map(h => ({
        id: h.id,
        securityName: h.security.name,
        symbol: h.security.symbol,
        accountName: h.account.accountName,
        broker: h.account.broker.name,
        quantity: Number(h.quantity),
        averageCost: Number(h.averageCost),
        currentPrice: Number(h.currentPrice),
        marketValueCny: Number(h.marketValueCny),
        marketValueOriginal: Number(h.marketValueOriginal),
        unrealizedPnl: Number(h.unrealizedPnl),
        unrealizedPnlPercent: Number(h.unrealizedPnlPercent),
        currency: h.account.currency,
        region: h.security.region.name,
        category: h.security.assetCategory.name,
      })),
      balances: Object.values(latestBalances).map(b => ({
        accountId: b.accountId,
        accountName: b.account.accountName,
        broker: b.account.broker.name,
        snapshotDate: b.snapshotDate.toISOString(),
        cashBalanceCny: Number(b.cashBalanceCny),
        cashBalanceOriginal: Number(b.cashBalanceOriginal),
        totalMarketValueCny: Number(b.totalMarketValueCny),
        currency: b.account.currency,
      })),
    };

    const outputPath = path.join(__dirname, '..', 'current-data-export.json');
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
    console.log(`✅ 数据已导出到: ${outputPath}\n`);

    // 5. 计算统计
    const totalHoldingsValue = holdings.reduce((sum, h) => sum + Number(h.marketValueCny), 0);
    const totalCash = Object.values(latestBalances).reduce((sum, b) => sum + Number(b.cashBalanceCny), 0);
    const totalAssets = totalHoldingsValue + totalCash;

    console.log('📊 统计汇总:');
    console.log(`  持仓总市值: ¥${totalHoldingsValue.toFixed(2)}`);
    console.log(`  现金总额: ¥${totalCash.toFixed(2)}`);
    console.log(`  资产总额: ¥${totalAssets.toFixed(2)}`);
    console.log('');

  } catch (error) {
    console.error('❌ 导出失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportData();
