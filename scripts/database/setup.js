#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 QiJia (齐家) 快速设置脚本');
console.log('=====================================\n');

// 检查Node.js版本
function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 18) {
    console.error('❌ 需要Node.js 18或更高版本，当前版本:', nodeVersion);
    process.exit(1);
  }
  
  console.log('✅ Node.js版本检查通过:', nodeVersion);
}

// 检查环境文件
function checkEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('✅ 已创建 .env.local 文件');
      console.log('⚠️  请编辑 .env.local 文件配置必要的环境变量');
    } else {
      console.log('⚠️  未找到 .env.example 文件');
    }
  } else {
    console.log('✅ .env.local 文件已存在');
  }
}

// 执行命令
function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description}完成`);
  } catch (error) {
    console.error(`❌ ${description}失败:`, error.message);
    throw error;
  }
}

// 主要设置流程
async function main() {
  try {
    // 1. 检查Node.js版本
    checkNodeVersion();
    
    // 2. 检查环境文件
    checkEnvFile();
    
    // 3. 安装依赖
    runCommand('npm install', '安装项目依赖');
    
    // 4. 类型检查
    runCommand('npm run type-check', 'TypeScript类型检查');
    
    // 5. 生成Prisma客户端
    runCommand('npm run db:generate', '生成Prisma客户端');
    
    // 6. 数据库推送（如果配置了数据库）
    try {
      runCommand('npm run db:push', '推送数据库架构');
      
      // 7. 运行种子数据
      runCommand('npm run db:seed', '初始化种子数据');
    } catch (error) {
      console.log('⚠️  数据库操作失败，请检查数据库配置');
      console.log('   请确保在 .env.local 中正确配置了 DATABASE_URL');
    }
    
    console.log('\n🎉 设置完成！');
    console.log('\n📋 下一步操作:');
    console.log('1. 编辑 .env.local 文件配置环境变量');
    console.log('2. 确保PostgreSQL数据库正在运行');
    console.log('3. 运行 npm run dev 启动开发服务器');
    console.log('4. 访问 http://localhost:3000');
    console.log('\n🔑 默认登录信息:');
    console.log('   邮箱: admin@example.com');
    console.log('   密码: admin123456');
    
  } catch (error) {
    console.error('\n❌ 设置过程中出现错误');
    console.error('请查看上面的错误信息并解决问题后重新运行');
    process.exit(1);
  }
}

main();