/**
 * 添加应收款资产分类
 * 
 * 使用方法:
 *   node scripts/database/seed-receivable-categories.js
 * 
 * 需要设置环境变量 DATABASE_URL 或在 .env.local 中配置
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedReceivableCategories() {
  console.log('📦 开始添加应收款分类...');

  // 1. 创建一级分类：应收款
  const parentCategory = await prisma.assetCategory.upsert({
    where: { code: 'RECEIVABLE' },
    update: {
      name: '应收款',
      description: '应收账款类资产，包括个人借款、押金、工资薪酬等',
    },
    create: {
      name: '应收款',
      code: 'RECEIVABLE',
      level: 1,
      description: '应收账款类资产，包括个人借款、押金、工资薪酬等',
    },
  });

  console.log(`✅ 一级分类创建成功: ${parentCategory.name} (${parentCategory.id})`);

  // 2. 创建二级分类
  const subCategories = [
    {
      name: '个人借款',
      code: 'REC_PERSONAL_LOAN',
      description: '借给亲友的个人借款',
    },
    {
      name: '押金/保证金',
      code: 'REC_DEPOSIT',
      description: '租房押金、其他保证金等',
    },
    {
      name: '薪资/报销',
      code: 'REC_SALARY',
      description: '待发薪资、报销款项等',
    },
    {
      name: '商业应收',
      code: 'REC_BUSINESS',
      description: '商业往来中的应收账款',
    },
    {
      name: '其他应收',
      code: 'REC_OTHER',
      description: '其他类型的应收款项',
    },
  ];

  for (const sub of subCategories) {
    const category = await prisma.assetCategory.upsert({
      where: { code: sub.code },
      update: {
        name: sub.name,
        description: sub.description,
        parentId: parentCategory.id,
      },
      create: {
        name: sub.name,
        code: sub.code,
        level: 2,
        description: sub.description,
        parentId: parentCategory.id,
      },
    });
    console.log(`  ✅ 二级分类: ${category.name} (${category.code})`);
  }

  console.log('\n🎉 应收款分类添加完成！');
}

seedReceivableCategories()
  .catch((error) => {
    console.error('❌ 添加失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
