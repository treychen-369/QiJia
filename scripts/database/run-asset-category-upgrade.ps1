# 资产分类升级 - 一键执行脚本
# PowerShell 版本

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  资产分类升级 - Phase 1" -ForegroundColor Cyan
Write-Host "  完善顶层6大分类 + 添加21个二级分类" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否在正确的目录
$currentPath = Get-Location
if (-not (Test-Path "prisma/schema.prisma")) {
    Write-Host "❌ 错误: 请在项目根目录运行此脚本！" -ForegroundColor Red
    Write-Host "当前路径: $currentPath" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ 当前路径: $currentPath" -ForegroundColor Green
Write-Host ""

# Step 1: 备份数据库（可选）
Write-Host "📦 Step 1: 是否备份数据库？(建议)" -ForegroundColor Yellow
$backup = Read-Host "输入 Y 备份，N 跳过 [Y/n]"
if ($backup -ne "n" -and $backup -ne "N") {
    Write-Host "正在备份数据库..." -ForegroundColor Cyan
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = "backup_asset_categories_$timestamp.sql"
    
    # 使用 pg_dump 备份（需要安装 PostgreSQL 客户端）
    $env:DATABASE_URL -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)" | Out-Null
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
    
    if ($dbHost) {
        pg_dump -h $dbHost -p $dbPort -U $dbUser -d $dbName -t asset_categories -t securities > $backupFile
        if ($?) {
            Write-Host "  ✅ 备份完成: $backupFile" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  备份失败（可能未安装 pg_dump），继续执行..." -ForegroundColor Yellow
        }
    }
}
Write-Host ""

# Step 2: 生成数据库迁移
Write-Host "📦 Step 2: 生成数据库迁移..." -ForegroundColor Cyan
npx prisma migrate dev --name add-asset-category-hierarchy --skip-seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 迁移生成失败！" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ 迁移生成完成" -ForegroundColor Green
Write-Host ""

# Step 3: 执行数据升级脚本
Write-Host "📦 Step 3: 执行数据升级脚本..." -ForegroundColor Cyan
Write-Host "  这将创建6个顶层分类 + 21个二级分类，并迁移现有数据" -ForegroundColor Yellow
Write-Host ""

node scripts/upgrade-asset-categories.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 数据升级失败！" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: 重新生成 Prisma Client
Write-Host "📦 Step 4: 重新生成 Prisma Client..." -ForegroundColor Cyan
npm run db:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Prisma Client 生成失败！" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Prisma Client 生成完成" -ForegroundColor Green
Write-Host ""

# Step 5: 验证结果
Write-Host "📊 Step 5: 验证结果..." -ForegroundColor Cyan
Write-Host ""
Write-Host "执行验证查询..." -ForegroundColor Yellow

$verifyQuery = @"
SELECT 
  c.level,
  c.code,
  c.name,
  c.color,
  (SELECT COUNT(*) FROM securities WHERE asset_category_id = c.id) as security_count
FROM asset_categories c
WHERE c.level = 1
ORDER BY c.sort_order;
"@

# 使用 Prisma Studio 或直接查询数据库
Write-Host "请在 Prisma Studio 中验证结果，或运行以下查询：" -ForegroundColor Yellow
Write-Host $verifyQuery -ForegroundColor Gray
Write-Host ""

# 完成提示
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  ✨ 升级完成！" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "接下来的步骤：" -ForegroundColor Cyan
Write-Host "1. 重启开发服务器: npm run dev" -ForegroundColor White
Write-Host "2. 打开浏览器并清除缓存 (Ctrl + Shift + R)" -ForegroundColor White
Write-Host "3. 查看投资组合页面，验证新分类是否正确显示" -ForegroundColor White
Write-Host ""
Write-Host "详细文档请参考: ASSET_CATEGORY_UPGRADE_PHASE1.md" -ForegroundColor Yellow
Write-Host ""

# 提示重启服务器
$restart = Read-Host "是否立即重启开发服务器？[Y/n]"
if ($restart -ne "n" -and $restart -ne "N") {
    Write-Host ""
    Write-Host "正在重启开发服务器..." -ForegroundColor Cyan
    Write-Host "按 Ctrl+C 停止服务器" -ForegroundColor Yellow
    Write-Host ""
    npm run dev
}
