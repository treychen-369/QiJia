/**
 * 证券数据预置脚本
 * 
 * 功能：
 * 1. 初始化资产类别和地区数据
 * 2. 导入常用证券（A股、港股、美股热门股票）
 * 3. 为后续API集成做准备
 * 
 * 使用方法：
 * node scripts/seed-securities.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 资产类别数据
const assetCategories = [
  { name: '股票', nameEn: 'Stock', description: '普通股票', sortOrder: 1 },
  { name: 'ETF', nameEn: 'ETF', description: '交易所交易基金', sortOrder: 2 },
  { name: '基金', nameEn: 'Fund', description: '公募/私募基金', sortOrder: 3 },
  { name: '债券', nameEn: 'Bond', description: '企业债、国债等', sortOrder: 4 },
  { name: '期货', nameEn: 'Future', description: '商品期货、股指期货', sortOrder: 5 },
  { name: '期权', nameEn: 'Option', description: '股票期权、指数期权', sortOrder: 6 },
  { name: '现金', nameEn: 'Cash', description: '现金及现金等价物', sortOrder: 7 },
];

// 地区数据
const regions = [
  { name: '中国A股', code: 'CN', currency: 'CNY' },
  { name: '香港', code: 'HK', currency: 'HKD' },
  { name: '美国', code: 'US', currency: 'USD' },
  { name: '日本', code: 'JP', currency: 'JPY' },
  { name: '英国', code: 'UK', currency: 'GBP' },
  { name: '新加坡', code: 'SG', currency: 'SGD' },
];

// 热门证券数据
const getSecuritiesData = (categoryMap, regionMap) => [
  // === 中国A股热门股票 ===
  // 科技
  { symbol: '600519', name: '贵州茅台', nameEn: 'Kweichow Moutai', category: '股票', region: 'CN', exchange: 'SSE', sector: '食品饮料', industry: '白酒' },
  { symbol: '000858', name: '五粮液', nameEn: 'Wuliangye', category: '股票', region: 'CN', exchange: 'SZSE', sector: '食品饮料', industry: '白酒' },
  { symbol: '300750', name: '宁德时代', nameEn: 'CATL', category: '股票', region: 'CN', exchange: 'SZSE', sector: '新能源', industry: '电池' },
  { symbol: '601318', name: '中国平安', nameEn: 'Ping An', category: '股票', region: 'CN', exchange: 'SSE', sector: '金融', industry: '保险' },
  { symbol: '600036', name: '招商银行', nameEn: 'CMB', category: '股票', region: 'CN', exchange: 'SSE', sector: '金融', industry: '银行' },
  { symbol: '000333', name: '美的集团', nameEn: 'Midea', category: '股票', region: 'CN', exchange: 'SZSE', sector: '家电', industry: '白电' },
  { symbol: '601012', name: '隆基绿能', nameEn: 'LONGi', category: '股票', region: 'CN', exchange: 'SSE', sector: '新能源', industry: '光伏' },
  { symbol: '002594', name: '比亚迪', nameEn: 'BYD', category: '股票', region: 'CN', exchange: 'SZSE', sector: '汽车', industry: '新能源汽车' },
  { symbol: '600900', name: '长江电力', nameEn: 'CGP', category: '股票', region: 'CN', exchange: 'SSE', sector: '公用事业', industry: '水电' },
  { symbol: '601888', name: '中国中免', nameEn: 'China Tourism', category: '股票', region: 'CN', exchange: 'SSE', sector: '消费', industry: '免税' },
  
  // A股ETF
  { symbol: '510300', name: '沪深300ETF', nameEn: 'CSI300 ETF', category: 'ETF', region: 'CN', exchange: 'SSE', sector: 'ETF', industry: '指数基金' },
  { symbol: '510500', name: '中证500ETF', nameEn: 'CSI500 ETF', category: 'ETF', region: 'CN', exchange: 'SSE', sector: 'ETF', industry: '指数基金' },
  { symbol: '159915', name: '创业板ETF', nameEn: 'ChiNext ETF', category: 'ETF', region: 'CN', exchange: 'SZSE', sector: 'ETF', industry: '指数基金' },
  { symbol: '512100', name: '中证1000ETF', nameEn: 'CSI1000 ETF', category: 'ETF', region: 'CN', exchange: 'SSE', sector: 'ETF', industry: '指数基金' },
  
  // === 香港股票 ===
  // 科技
  { symbol: '00700', name: '腾讯控股', nameEn: 'Tencent', category: '股票', region: 'HK', exchange: 'HKEX', sector: '科技', industry: '互联网' },
  { symbol: '09988', name: '阿里巴巴-SW', nameEn: 'Alibaba', category: '股票', region: 'HK', exchange: 'HKEX', sector: '科技', industry: '电商' },
  { symbol: '09618', name: '京东集团-SW', nameEn: 'JD.com', category: '股票', region: 'HK', exchange: 'HKEX', sector: '科技', industry: '电商' },
  { symbol: '03690', name: '美团-W', nameEn: 'Meituan', category: '股票', region: 'HK', exchange: 'HKEX', sector: '科技', industry: '本地服务' },
  { symbol: '01810', name: '小米集团-W', nameEn: 'Xiaomi', category: '股票', region: 'HK', exchange: 'HKEX', sector: '科技', industry: '消费电子' },
  { symbol: '00981', name: '中芯国际', nameEn: 'SMIC', category: '股票', region: 'HK', exchange: 'HKEX', sector: '科技', industry: '半导体' },
  { symbol: '02015', name: '理想汽车-W', nameEn: 'Li Auto', category: '股票', region: 'HK', exchange: 'HKEX', sector: '汽车', industry: '新能源汽车' },
  { symbol: '09866', name: '蔚来-SW', nameEn: 'NIO', category: '股票', region: 'HK', exchange: 'HKEX', sector: '汽车', industry: '新能源汽车' },
  { symbol: '09868', name: '小鹏汽车-W', nameEn: 'XPeng', category: '股票', region: 'HK', exchange: 'HKEX', sector: '汽车', industry: '新能源汽车' },
  { symbol: '01024', name: '快手-W', nameEn: 'Kuaishou', category: '股票', region: 'HK', exchange: 'HKEX', sector: '科技', industry: '短视频' },
  { symbol: '09999', name: '网易-S', nameEn: 'NetEase', category: '股票', region: 'HK', exchange: 'HKEX', sector: '科技', industry: '游戏' },
  { symbol: '00175', name: '吉利汽车', nameEn: 'Geely', category: '股票', region: 'HK', exchange: 'HKEX', sector: '汽车', industry: '汽车制造' },
  
  // 金融地产
  { symbol: '00005', name: '汇丰控股', nameEn: 'HSBC', category: '股票', region: 'HK', exchange: 'HKEX', sector: '金融', industry: '银行' },
  { symbol: '01299', name: '友邦保险', nameEn: 'AIA', category: '股票', region: 'HK', exchange: 'HKEX', sector: '金融', industry: '保险' },
  { symbol: '02318', name: '中国平安', nameEn: 'Ping An', category: '股票', region: 'HK', exchange: 'HKEX', sector: '金融', industry: '保险' },
  { symbol: '02388', name: '中银香港', nameEn: 'BOC Hong Kong', category: '股票', region: 'HK', exchange: 'HKEX', sector: '金融', industry: '银行' },
  { symbol: '01113', name: '长实集团', nameEn: 'CK Hutchison', category: '股票', region: 'HK', exchange: 'HKEX', sector: '地产', industry: '房地产' },
  
  // 能源消费
  { symbol: '00883', name: '中国海洋石油', nameEn: 'CNOOC', category: '股票', region: 'HK', exchange: 'HKEX', sector: '能源', industry: '石油' },
  { symbol: '01918', name: '融创中国', nameEn: 'Sunac', category: '股票', region: 'HK', exchange: 'HKEX', sector: '地产', industry: '房地产' },
  { symbol: '01211', name: '比亚迪股份', nameEn: 'BYD Company', category: '股票', region: 'HK', exchange: 'HKEX', sector: '汽车', industry: '新能源汽车' },
  { symbol: '02020', name: '安踏体育', nameEn: 'ANTA Sports', category: '股票', region: 'HK', exchange: 'HKEX', sector: '消费', industry: '服装' },
  { symbol: '06690', name: '海尔智家', nameEn: 'Haier Smart Home', category: '股票', region: 'HK', exchange: 'HKEX', sector: '家电', industry: '白电' },
  
  // 港股ETF
  { symbol: '02800', name: '盈富基金', nameEn: 'Tracker Fund', category: 'ETF', region: 'HK', exchange: 'HKEX', sector: 'ETF', industry: '指数基金' },
  { symbol: '03040', name: '南方恒生科技', nameEn: 'CSOP Hang Seng Tech', category: 'ETF', region: 'HK', exchange: 'HKEX', sector: 'ETF', industry: '科技' },
  
  // === 美国股票 ===
  // 科技巨头 (FAANG+)
  { symbol: 'AAPL', name: '苹果', nameEn: 'Apple Inc.', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '科技', industry: '消费电子' },
  { symbol: 'MSFT', name: '微软', nameEn: 'Microsoft', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '科技', industry: '软件' },
  { symbol: 'GOOGL', name: '谷歌A', nameEn: 'Alphabet Inc.', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '科技', industry: '互联网' },
  { symbol: 'AMZN', name: '亚马逊', nameEn: 'Amazon', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '科技', industry: '电商' },
  { symbol: 'META', name: 'Meta', nameEn: 'Meta Platforms', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '科技', industry: '社交媒体' },
  { symbol: 'TSLA', name: '特斯拉', nameEn: 'Tesla', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '汽车', industry: '电动车' },
  { symbol: 'NVDA', name: '英伟达', nameEn: 'NVIDIA', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '科技', industry: '芯片' },
  { symbol: 'NFLX', name: '奈飞', nameEn: 'Netflix', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '科技', industry: '流媒体' },
  
  // 半导体芯片
  { symbol: 'AMD', name: 'AMD', nameEn: 'Advanced Micro Devices', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '科技', industry: '芯片' },
  { symbol: 'INTC', name: '英特尔', nameEn: 'Intel', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '科技', industry: '芯片' },
  { symbol: 'TSM', name: '台积电', nameEn: 'TSMC', category: '股票', region: 'US', exchange: 'NYSE', sector: '科技', industry: '半导体' },
  { symbol: 'AVGO', name: '博通', nameEn: 'Broadcom', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '科技', industry: '芯片' },
  { symbol: 'QCOM', name: '高通', nameEn: 'Qualcomm', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '科技', industry: '芯片' },
  
  // 金融
  { symbol: 'JPM', name: '摩根大通', nameEn: 'JPMorgan Chase', category: '股票', region: 'US', exchange: 'NYSE', sector: '金融', industry: '银行' },
  { symbol: 'BAC', name: '美国银行', nameEn: 'Bank of America', category: '股票', region: 'US', exchange: 'NYSE', sector: '金融', industry: '银行' },
  { symbol: 'WFC', name: '富国银行', nameEn: 'Wells Fargo', category: '股票', region: 'US', exchange: 'NYSE', sector: '金融', industry: '银行' },
  { symbol: 'GS', name: '高盛', nameEn: 'Goldman Sachs', category: '股票', region: 'US', exchange: 'NYSE', sector: '金融', industry: '投资银行' },
  { symbol: 'MS', name: '摩根士丹利', nameEn: 'Morgan Stanley', category: '股票', region: 'US', exchange: 'NYSE', sector: '金融', industry: '投资银行' },
  { symbol: 'V', name: '维萨', nameEn: 'Visa', category: '股票', region: 'US', exchange: 'NYSE', sector: '金融', industry: '支付' },
  { symbol: 'MA', name: '万事达', nameEn: 'Mastercard', category: '股票', region: 'US', exchange: 'NYSE', sector: '金融', industry: '支付' },
  { symbol: 'BRK.B', name: '伯克希尔B', nameEn: 'Berkshire Hathaway B', category: '股票', region: 'US', exchange: 'NYSE', sector: '金融', industry: '保险' },
  
  // 消费
  { symbol: 'NKE', name: '耐克', nameEn: 'Nike', category: '股票', region: 'US', exchange: 'NYSE', sector: '消费', industry: '服装' },
  { symbol: 'SBUX', name: '星巴克', nameEn: 'Starbucks', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '消费', industry: '餐饮' },
  { symbol: 'MCD', name: '麦当劳', nameEn: 'McDonald\'s', category: '股票', region: 'US', exchange: 'NYSE', sector: '消费', industry: '餐饮' },
  { symbol: 'KO', name: '可口可乐', nameEn: 'Coca-Cola', category: '股票', region: 'US', exchange: 'NYSE', sector: '消费', industry: '饮料' },
  { symbol: 'PEP', name: '百事可乐', nameEn: 'PepsiCo', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '消费', industry: '饮料' },
  { symbol: 'WMT', name: '沃尔玛', nameEn: 'Walmart', category: '股票', region: 'US', exchange: 'NYSE', sector: '消费', industry: '零售' },
  { symbol: 'COST', name: '好市多', nameEn: 'Costco', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '消费', industry: '零售' },
  { symbol: 'HD', name: '家得宝', nameEn: 'Home Depot', category: '股票', region: 'US', exchange: 'NYSE', sector: '消费', industry: '零售' },
  
  // 医疗健康
  { symbol: 'JNJ', name: '强生', nameEn: 'Johnson & Johnson', category: '股票', region: 'US', exchange: 'NYSE', sector: '医疗', industry: '制药' },
  { symbol: 'UNH', name: '联合健康', nameEn: 'UnitedHealth', category: '股票', region: 'US', exchange: 'NYSE', sector: '医疗', industry: '医疗保险' },
  { symbol: 'PFE', name: '辉瑞', nameEn: 'Pfizer', category: '股票', region: 'US', exchange: 'NYSE', sector: '医疗', industry: '制药' },
  { symbol: 'ABBV', name: '艾伯维', nameEn: 'AbbVie', category: '股票', region: 'US', exchange: 'NYSE', sector: '医疗', industry: '制药' },
  { symbol: 'TMO', name: '赛默飞世尔', nameEn: 'Thermo Fisher', category: '股票', region: 'US', exchange: 'NYSE', sector: '医疗', industry: '医疗器械' },
  
  // 能源
  { symbol: 'XOM', name: '埃克森美孚', nameEn: 'Exxon Mobil', category: '股票', region: 'US', exchange: 'NYSE', sector: '能源', industry: '石油' },
  { symbol: 'CVX', name: '雪佛龙', nameEn: 'Chevron', category: '股票', region: 'US', exchange: 'NYSE', sector: '能源', industry: '石油' },
  
  // 新兴科技
  { symbol: 'CRM', name: 'Salesforce', nameEn: 'Salesforce', category: '股票', region: 'US', exchange: 'NYSE', sector: '科技', industry: '云计算' },
  { symbol: 'ORCL', name: '甲骨文', nameEn: 'Oracle', category: '股票', region: 'US', exchange: 'NYSE', sector: '科技', industry: '数据库' },
  { symbol: 'ADBE', name: 'Adobe', nameEn: 'Adobe', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '科技', industry: '软件' },
  { symbol: 'PYPL', name: 'PayPal', nameEn: 'PayPal', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '金融科技', industry: '支付' },
  { symbol: 'SQ', name: 'Block', nameEn: 'Block Inc.', category: '股票', region: 'US', exchange: 'NYSE', sector: '金融科技', industry: '支付' },
  { symbol: 'SHOP', name: 'Shopify', nameEn: 'Shopify', category: '股票', region: 'US', exchange: 'NYSE', sector: '科技', industry: '电商SaaS' },
  { symbol: 'UBER', name: '优步', nameEn: 'Uber', category: '股票', region: 'US', exchange: 'NYSE', sector: '科技', industry: '出行' },
  { symbol: 'ABNB', name: '爱彼迎', nameEn: 'Airbnb', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '科技', industry: '民宿' },
  { symbol: 'COIN', name: 'Coinbase', nameEn: 'Coinbase', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '金融科技', industry: '加密货币' },
  
  // 中概股
  { symbol: 'BABA', name: '阿里巴巴', nameEn: 'Alibaba ADR', category: '股票', region: 'US', exchange: 'NYSE', sector: '科技', industry: '电商' },
  { symbol: 'JD', name: '京东', nameEn: 'JD.com ADR', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '科技', industry: '电商' },
  { symbol: 'PDD', name: '拼多多', nameEn: 'PDD Holdings', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '科技', industry: '电商' },
  { symbol: 'BIDU', name: '百度', nameEn: 'Baidu ADR', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '科技', industry: '搜索' },
  { symbol: 'NIO', name: '蔚来', nameEn: 'NIO ADR', category: '股票', region: 'US', exchange: 'NYSE', sector: '汽车', industry: '电动车' },
  { symbol: 'LI', name: '理想汽车', nameEn: 'Li Auto ADR', category: '股票', region: 'US', exchange: 'NASDAQ', sector: '汽车', industry: '电动车' },
  { symbol: 'XPEV', name: '小鹏汽车', nameEn: 'XPeng ADR', category: '股票', region: 'US', exchange: 'NYSE', sector: '汽车', industry: '电动车' },
  
  // 美股ETF
  { symbol: 'SPY', name: '标普500ETF', nameEn: 'SPDR S&P 500', category: 'ETF', region: 'US', exchange: 'NYSE', sector: 'ETF', industry: '指数基金' },
  { symbol: 'QQQ', name: '纳斯达克100ETF', nameEn: 'Invesco QQQ', category: 'ETF', region: 'US', exchange: 'NASDAQ', sector: 'ETF', industry: '科技' },
  { symbol: 'IWM', name: '罗素2000ETF', nameEn: 'iShares Russell 2000', category: 'ETF', region: 'US', exchange: 'NYSE', sector: 'ETF', industry: '小盘股' },
  { symbol: 'VTI', name: '全市场ETF', nameEn: 'Vanguard Total Stock Market', category: 'ETF', region: 'US', exchange: 'NYSE', sector: 'ETF', industry: '指数基金' },
  { symbol: 'VOO', name: '先锋500ETF', nameEn: 'Vanguard S&P 500', category: 'ETF', region: 'US', exchange: 'NYSE', sector: 'ETF', industry: '指数基金' },
  { symbol: 'DIA', name: '道琼斯ETF', nameEn: 'SPDR Dow Jones', category: 'ETF', region: 'US', exchange: 'NYSE', sector: 'ETF', industry: '指数基金' },
  { symbol: 'ARKK', name: 'ARK创新ETF', nameEn: 'ARK Innovation', category: 'ETF', region: 'US', exchange: 'NYSE', sector: 'ETF', industry: '科技创新' },
];

async function main() {
  console.log('🚀 开始预置证券数据...\n');

  try {
    // === 1. 初始化资产类别 ===
    console.log('📁 Step 1/4: 初始化资产类别...');
    const categoryMap = {};
    
    for (const cat of assetCategories) {
      const existing = await prisma.assetCategory.findUnique({
        where: { name: cat.name }
      });
      
      if (existing) {
        categoryMap[cat.name] = existing.id;
        console.log(`   ✓ 资产类别已存在: ${cat.name}`);
      } else {
        const created = await prisma.assetCategory.create({
          data: cat
        });
        categoryMap[cat.name] = created.id;
        console.log(`   ✓ 创建资产类别: ${cat.name}`);
      }
    }
    console.log(`   ✅ 资产类别初始化完成 (${assetCategories.length}个)\n`);

    // === 2. 初始化地区数据 ===
    console.log('🌍 Step 2/4: 初始化地区数据...');
    const regionMap = {};
    
    for (const reg of regions) {
      const existing = await prisma.region.findUnique({
        where: { code: reg.code }
      });
      
      if (existing) {
        regionMap[reg.code] = existing.id;
        console.log(`   ✓ 地区已存在: ${reg.name} (${reg.code})`);
      } else {
        const created = await prisma.region.create({
          data: reg
        });
        regionMap[reg.code] = created.id;
        console.log(`   ✓ 创建地区: ${reg.name} (${reg.code})`);
      }
    }
    console.log(`   ✅ 地区数据初始化完成 (${regions.length}个)\n`);

    // === 3. 导入证券数据 ===
    console.log('📈 Step 3/4: 导入证券数据...');
    const securities = getSecuritiesData(categoryMap, regionMap);
    
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const sec of securities) {
      try {
        const existing = await prisma.security.findUnique({
          where: {
            symbol_exchange: {
              symbol: sec.symbol,
              exchange: sec.exchange || ''
            }
          }
        });

        if (existing) {
          skipped++;
          continue;
        }

        await prisma.security.create({
          data: {
            symbol: sec.symbol,
            name: sec.name,
            nameEn: sec.nameEn,
            assetCategoryId: categoryMap[sec.category],
            regionId: regionMap[sec.region],
            exchange: sec.exchange,
            sector: sec.sector,
            industry: sec.industry,
            isActive: true
          }
        });

        created++;
        
        if (created % 20 === 0) {
          console.log(`   ⏳ 已导入 ${created} 只证券...`);
        }
      } catch (error) {
        errors++;
        console.error(`   ❌ 导入失败: ${sec.symbol} - ${error.message}`);
      }
    }

    console.log(`   ✅ 证券数据导入完成`);
    console.log(`      • 新增: ${created} 只`);
    console.log(`      • 跳过: ${skipped} 只 (已存在)`);
    console.log(`      • 失败: ${errors} 只\n`);

    // === 4. 统计信息 ===
    console.log('📊 Step 4/4: 生成统计报告...');
    
    const stats = await prisma.$transaction([
      prisma.security.count(),
      prisma.security.groupBy({
        by: ['regionId'],
        _count: true
      }),
      prisma.security.groupBy({
        by: ['assetCategoryId'],
        _count: true
      })
    ]);

    console.log(`\n✅ 预置数据导入完成！\n`);
    console.log('=' .repeat(60));
    console.log('📊 数据统计:');
    console.log('=' .repeat(60));
    console.log(`总证券数量: ${stats[0]} 只\n`);
    
    console.log('按地区分布:');
    for (const item of stats[1]) {
      const region = regions.find(r => regionMap[r.code] === item.regionId);
      console.log(`  • ${region?.name || 'Unknown'}: ${item._count} 只`);
    }
    
    console.log('\n按类别分布:');
    for (const item of stats[2]) {
      const category = assetCategories.find(c => categoryMap[c.name] === item.assetCategoryId);
      console.log(`  • ${category?.name || 'Unknown'}: ${item._count} 只`);
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('💡 下一步:');
    console.log('  1. 重启开发服务器以应用更改');
    console.log('  2. 在添加持仓时即可搜索证券');
    console.log('  3. 如需更多证券，可手动创建或等待API集成');
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('\n❌ 预置数据导入失败:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
