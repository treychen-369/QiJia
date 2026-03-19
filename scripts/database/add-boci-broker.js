/**
 * 添加中银国际券商到数据库
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addBOCIBroker() {
  console.log('📝 添加中银国际券商...\n');

  try {
    // 检查是否已存在
    const existing = await prisma.broker.findFirst({
      where: {
        OR: [
          { name: '中银国际' },
          { code: 'BOCI' },
        ],
      },
    });

    if (existing) {
      console.log('✅ 中银国际券商已存在');
      console.log(`   ID: ${existing.id}`);
      console.log(`   名称: ${existing.name}`);
      console.log(`   代码: ${existing.code}`);
      console.log(`   国家: ${existing.country}`);
      return existing;
    }

    // 创建中银国际券商
    const broker = await prisma.broker.create({
      data: {
        name: '中银国际',
        code: 'BOCI',
        country: 'CN',
        isActive: true,
      },
    });

    console.log('✅ 中银国际券商添加成功！');
    console.log(`   ID: ${broker.id}`);
    console.log(`   名称: ${broker.name}`);
    console.log(`   代码: ${broker.code}`);
    console.log(`   国家: ${broker.country}`);

    return broker;
  } catch (error) {
    console.error('❌ 添加失败:', error);
    throw error;
  }
}

addBOCIBroker()
  .then(() => {
    console.log('\n✅ 操作完成');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
